import { createHash } from "node:crypto";
import { setImmediate } from "node:timers/promises";
import { AppError, fold } from "./domain.js";
import { language } from "./tmx.js";
import { OpusClient, selection } from "./opus-client.js";

export class TranslationMemory {
  constructor(store, client = new OpusClient()) {
    this.store = store;
    this.db = store.db;
    this.client = client;
    this.busy = false;
    this.running = null;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tm_datasets(id TEXT PRIMARY KEY,data TEXT NOT NULL,status TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS tm_units(id INTEGER PRIMARY KEY,dataset_id TEXT NOT NULL REFERENCES tm_datasets(id),original TEXT NOT NULL,translation TEXT NOT NULL,normalized TEXT NOT NULL,UNIQUE(dataset_id,original,translation));
      CREATE INDEX IF NOT EXISTS tm_exact ON tm_units(normalized,dataset_id);
      CREATE VIRTUAL TABLE IF NOT EXISTS tm_search USING fts5(original,content='tm_units',content_rowid='id',tokenize='unicode61 remove_diacritics 2');
      CREATE TRIGGER IF NOT EXISTS tm_insert AFTER INSERT ON tm_units BEGIN INSERT INTO tm_search(rowid,original) VALUES(new.id,new.original); END;
      CREATE TRIGGER IF NOT EXISTS tm_delete AFTER DELETE ON tm_units BEGIN INSERT INTO tm_search(tm_search,rowid,original) VALUES('delete',old.id,old.original); END;
    `);
    for (const row of this.db
      .prepare("SELECT data FROM tm_datasets WHERE status='importing'")
      .all())
      this.fail(
        JSON.parse(row.data),
        "Importação interrompida pelo encerramento do servidor. Tente novamente.",
      );
    // Older imports already stopped after N pairs; they sampled from the file
    // start but did not persist that provenance explicitly.
    for (const row of this.db
      .prepare("SELECT data FROM tm_datasets WHERE status='ready'")
      .all()) {
      const dataset = JSON.parse(row.data);
      if (dataset.coverage === "sample" && !dataset.sampleMethod)
        this.save({ ...dataset, sampleMethod: "beginning" });
    }
  }
  list() {
    return this.db
      .prepare("SELECT data FROM tm_datasets ORDER BY rowid DESC")
      .all()
      .map((x) => JSON.parse(x.data));
  }
  get(id) {
    const row = this.db
      .prepare("SELECT data FROM tm_datasets WHERE id=?")
      .get(id);
    if (!row) throw new AppError("Importação não encontrada.", 404);
    return JSON.parse(row.data);
  }
  save(data) {
    this.db
      .prepare(
        "INSERT INTO tm_datasets VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,status=excluded.status",
      )
      .run(data.id, JSON.stringify(data), data.status);
  }
  fail(job, message) {
    this.store.tx(() => {
      this.db.prepare("DELETE FROM tm_units WHERE dataset_id=?").run(job.id);
      this.save({ ...job, status: "failed", error: message, importedPairs: 0 });
    });
  }
  async start(input) {
    const query = selection(input);
    const maxPairs = input.maxPairs ?? 10000;
    if (
      !query.corpus ||
      typeof input.datasetId !== "string" ||
      !/^[a-f0-9]{64}$/.test(input.datasetId) ||
      !Number.isInteger(maxPairs) ||
      maxPairs < 1 ||
      maxPairs > 100000
    )
      throw new AppError(
        "Selecione um dataset e um limite entre 1 e 100.000 pares.",
        422,
      );
    if (this.busy)
      throw new AppError("Já existe uma importação OPUS em andamento.", 409);
    this.busy = true;
    try {
      // Resolve again against the official catalog. Clients never submit a download URL.
      const dataset = (await this.client.catalog(query)).find(
        (x) => x.id === input.datasetId,
      );
      if (!dataset)
        throw new AppError(
          "Dataset indisponível. Atualize o catálogo OPUS.",
          404,
        );
      const id = createHash("sha256")
        .update(dataset.id + ":" + maxPairs)
        .digest("hex");
      const existing = this.db
        .prepare("SELECT data FROM tm_datasets WHERE id=? AND status='ready'")
        .get(id);
      if (existing) {
        this.busy = false;
        return JSON.parse(existing.data);
      }
      const job = {
        ...dataset,
        datasetId: dataset.id,
        id,
        maxPairs,
        status: "importing",
        importedPairs: 0,
        startedAt: new Date().toISOString(),
        stats: {},
      };
      this.save(job);
      this.running = this.import(job).finally(() => {
        this.busy = false;
        this.running = null;
      });
      return { ...job };
    } catch (error) {
      this.busy = false;
      throw error;
    }
  }
  async import(job) {
    const insert = this.db.prepare(
      "INSERT OR IGNORE INTO tm_units(dataset_id,original,translation,normalized) VALUES(?,?,?,?)",
    );
    let batch = [];
    const flush = () =>
      this.store.tx(() => {
        for (const pair of batch)
          job.importedPairs += Number(
            insert.run(
              job.id,
              pair.original,
              pair.translation,
              fold(pair.original),
            ).changes,
          );
        batch = [];
        this.save(job);
      });
    try {
      for await (const pair of this.client.pairs(job, {
        maxPairs: job.maxPairs,
        stats: job.stats,
      })) {
        batch.push(pair);
        if (batch.length >= 500) {
          flush();
          await setImmediate();
        }
      }
      flush();
      if (!job.importedPairs)
        throw new AppError("Nenhum par válido encontrado.", 422);
      this.save({
        ...job,
        status: "ready",
        completedAt: new Date().toISOString(),
        coverage: job.stats.limited ? "sample" : "complete",
        sampleMethod: job.stats.limited ? "beginning" : null,
      });
    } catch (error) {
      this.fail(
        job,
        error instanceof AppError
          ? error.message
          : "Falha ao salvar a memória de tradução.",
      );
    }
  }
  suggestions(input) {
    const source = language(input.source),
      target = language(input.target);
    const q = typeof input.q === "string" ? input.q.trim() : "";
    const limit = Number(input.limit ?? 10);
    if (
      !q ||
      q.length > 2000 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 50 ||
      (input.corpus !== undefined &&
        (typeof input.corpus !== "string" || input.corpus.length > 100))
    )
      throw new AppError(
        "Informe um trecho de até 2.000 caracteres e limite de 1 a 50 sugestões.",
        422,
      );
    const conditions =
      "d.status='ready' AND json_extract(d.data,'$.source')=? AND json_extract(d.data,'$.target')=?" +
      (input.corpus ? " AND json_extract(d.data,'$.corpus')=?" : "");
    const args = [source, target, ...(input.corpus ? [input.corpus] : [])];
    const select = "u.original,u.translation,d.data";
    const exact = this.db
      .prepare(
        `SELECT ${select} FROM tm_units u JOIN tm_datasets d ON d.id=u.dataset_id WHERE u.normalized=? AND ${conditions} LIMIT ?`,
      )
      .all(fold(q), ...args, limit);
    const words = [...new Set(q.match(/[\p{L}\p{N}]+/gu) || [])].slice(0, 12);
    const similar =
      words.length && exact.length < limit
        ? this.db
            .prepare(
              `SELECT ${select} FROM tm_search JOIN tm_units u ON u.id=tm_search.rowid JOIN tm_datasets d ON d.id=u.dataset_id WHERE tm_search MATCH ? AND ${conditions} AND u.normalized<>? ORDER BY bm25(tm_search) LIMIT ?`,
            )
            .all(
              words.map((w) => '"' + w + '"').join(" OR "),
              ...args,
              fold(q),
              limit - exact.length,
            )
        : [];
    return [
      ...exact.map((x) => ({ ...x, match: "exact" })),
      ...similar.map((x) => ({ ...x, match: "related" })),
    ].map(({ data, ...pair }) => {
      const d = JSON.parse(data);
      return {
        ...pair,
        source,
        target,
        corpus: d.corpus,
        version: d.version,
        datasetId: d.id,
        sourceUrl: d.downloadUrl,
        coverage: d.coverage,
        sampleMethod: d.sampleMethod,
      };
    });
  }
  suggestionsBatch(input) {
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new AppError("Informe os trechos e o par de idiomas.", 422);
    const source = language(input.source);
    const target = language(input.target);
    const { segments, corpus } = input;
    if (
      !Array.isArray(segments) ||
      segments.length < 1 ||
      segments.length > 30 ||
      segments.some(
        (s) => typeof s !== "string" || !s.trim() || s.length > 2000,
      ) ||
      segments.reduce((sum, s) => sum + s.length, 0) > 20000 ||
      (corpus !== undefined &&
        (typeof corpus !== "string" || corpus.length > 100))
    )
      throw new AppError(
        "Envie de 1 a 30 trechos, cada um com até 2.000 caracteres e total de até 20.000.",
        422,
      );
    const cache = new Map();
    return segments.map((segment) => {
      const key = fold(segment.trim());
      if (!cache.has(key))
        cache.set(
          key,
          this.suggestions({ source, target, corpus, q: segment, limit: 5 }),
        );
      return { segment, suggestions: cache.get(key) };
    });
  }
}
