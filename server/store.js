import { DatabaseSync, backup } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  AppError,
  fold,
  parse,
  termSchema,
  glossarySchema,
  noteSchema,
} from "./domain.js";
export class Store {
  constructor(path, actor = "Tradutor local") {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.actor = actor;
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
   CREATE TABLE IF NOT EXISTS glossaries(id TEXT PRIMARY KEY,data TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS terms(id TEXT PRIMARY KEY,data TEXT NOT NULL,version INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS versions(id INTEGER PRIMARY KEY,term_id TEXT NOT NULL REFERENCES terms(id),version INTEGER NOT NULL,actor TEXT NOT NULL,at TEXT NOT NULL,action TEXT NOT NULL,snapshot TEXT NOT NULL,UNIQUE(term_id,version));
   CREATE TRIGGER IF NOT EXISTS versions_no_update BEFORE UPDATE ON versions BEGIN SELECT RAISE(ABORT,'Histórico imutável'); END;
   CREATE TRIGGER IF NOT EXISTS versions_no_delete BEFORE DELETE ON versions BEGIN SELECT RAISE(ABORT,'Histórico imutável'); END;
   CREATE VIRTUAL TABLE IF NOT EXISTS term_search USING fts5(term_id UNINDEXED,content,tokenize='trigram');
   CREATE INDEX IF NOT EXISTS terms_glossary ON terms(json_extract(data,'$.glossaryId'));
   CREATE INDEX IF NOT EXISTS terms_category ON terms(json_extract(data,'$.category'));
   CREATE TABLE IF NOT EXISTS imports(id TEXT PRIMARY KEY,data TEXT NOT NULL,expires INTEGER NOT NULL,result TEXT);
  `);
  }
  tx(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const v = fn();
      this.db.exec("COMMIT");
      return v;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  glossaryList() {
    return this.db
      .prepare(
        "SELECT data FROM glossaries ORDER BY json_extract(data,'$.name')",
      )
      .all()
      .map((x) => ({
        ...JSON.parse(x.data),
        count: Number(
          this.db
            .prepare(
              "SELECT count(*) AS n FROM terms WHERE json_extract(data,'$.glossaryId')=?",
            )
            .get(JSON.parse(x.data).id).n,
        ),
      }));
  }
  glossary(id) {
    const r = this.db.prepare("SELECT data FROM glossaries WHERE id=?").get(id);
    if (!r) throw new AppError("Glossário não encontrado.", 404);
    return JSON.parse(r.data);
  }
  createGlossary(input) {
    const d = parse(glossarySchema, input);
    if (
      this.glossaryList().some(
        (g) =>
          fold(g.name) === fold(d.name) &&
          fold(g.client) === fold(d.client) &&
          g.sourceLang === d.sourceLang &&
          g.targetLang === d.targetLang,
      )
    )
      throw new AppError(
        "Este glossário já existe para o cliente e par de idiomas.",
        409,
      );
    const v = { ...d, id: randomUUID(), createdAt: new Date().toISOString() };
    this.db
      .prepare("INSERT INTO glossaries VALUES(?,?)")
      .run(v.id, JSON.stringify(v));
    return v;
  }
  get(id) {
    const r = this.db.prepare("SELECT data FROM terms WHERE id=?").get(id);
    if (!r) throw new AppError("Termo não encontrado.", 404);
    return JSON.parse(r.data);
  }
  validate(input) {
    const d = parse(termSchema, input);
    if (d.glossaryId) {
      const g = this.glossary(d.glossaryId);
      if (g.sourceLang !== d.sourceLang || g.targetLang !== d.targetLang)
        throw new AppError(
          "O par de idiomas deve corresponder ao glossário.",
          422,
          { glossaryId: "Selecione um glossário com os mesmos idiomas." },
        );
    }
    return d;
  }
  duplicate(d, except = "") {
    return this.db
      .prepare("SELECT data FROM terms WHERE id<>?")
      .all(except)
      .some((r) => {
        const t = JSON.parse(r.data);
        return (
          fold(t.original) === fold(d.original) &&
          fold(t.translation) === fold(d.translation) &&
          t.sourceLang === d.sourceLang &&
          t.targetLang === d.targetLang &&
          t.glossaryId === d.glossaryId &&
          fold(t.project) === fold(d.project) &&
          fold(t.work) === fold(d.work) &&
          t.category === d.category
        );
      });
  }
  write(t, action) {
    this.db
      .prepare(
        "INSERT INTO terms VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,version=excluded.version",
      )
      .run(t.id, JSON.stringify(t), t.version);
    this.db.prepare("DELETE FROM term_search WHERE term_id=?").run(t.id);
    this.db
      .prepare("INSERT INTO term_search VALUES(?,?)")
      .run(
        t.id,
        fold(
          [
            t.original,
            t.translation,
            ...t.variations.map((v) => v.translation),
          ].join(" "),
        ),
      );
    this.db
      .prepare(
        "INSERT INTO versions(term_id,version,actor,at,action,snapshot) VALUES(?,?,?,?,?,?)",
      )
      .run(t.id, t.version, this.actor, t.updatedAt, action, JSON.stringify(t));
    return t;
  }
  create(input) {
    return this.tx(() => this.createInternal(input));
  }
  createInternal(input) {
    const d = this.validate(input);
    if (this.duplicate(d))
      throw new AppError("Este termo já está cadastrado neste contexto.", 409);
    const at = new Date().toISOString();
    return this.write(
      {
        ...d,
        id: randomUUID(),
        version: 1,
        notes: [],
        createdAt: at,
        updatedAt: at,
      },
      "Termo criado",
    );
  }
  update(id, input, version) {
    return this.tx(() => {
      const before = this.get(id);
      this.checkVersion(before, version);
      const d = this.validate(input);
      if (this.duplicate(d, id))
        throw new AppError(
          "Este termo já está cadastrado neste contexto.",
          409,
        );
      return this.write(
        {
          ...before,
          ...d,
          version: before.version + 1,
          updatedAt: new Date().toISOString(),
        },
        "Termo atualizado",
      );
    });
  }
  checkVersion(t, v) {
    if (!Number.isInteger(v) || v !== t.version)
      throw new AppError(
        "Este registro foi atualizado em outra aba. Recarregue o termo antes de salvar; seu texto foi preservado.",
        409,
      );
  }
  note(id, input, version, noteId) {
    return this.tx(() => {
      const t = this.get(id);
      this.checkVersion(t, version);
      const d = parse(noteSchema, input);
      const at = new Date().toISOString();
      if (noteId && !t.notes.some((n) => n.id === noteId))
        throw new AppError("Nota não encontrada.", 404);
      const n = {
        ...d,
        id: noteId || randomUUID(),
        actor: this.actor,
        updatedAt: at,
      };
      return this.write(
        {
          ...t,
          notes: noteId
            ? t.notes.map((x) => (x.id === noteId ? n : x))
            : [...t.notes, n],
          version: t.version + 1,
          updatedAt: at,
        },
        noteId ? "Nota atualizada" : "Nota adicionada",
      );
    });
  }
  history(id) {
    this.get(id);
    return this.db
      .prepare(
        "SELECT version,actor,at,action,snapshot FROM versions WHERE term_id=? ORDER BY version DESC",
      )
      .all(id)
      .map((v) => ({ ...v, snapshot: JSON.parse(v.snapshot) }));
  }
  list(params = {}, all = false) {
    const where = [],
      args = [];
    const q = fold(String(params.q || "").trim()).slice(0, 200);
    if (q) {
      if (q.length >= 3 && !/[%_]/.test(q)) {
        where.push(
          "t.id IN (SELECT term_id FROM term_search WHERE content LIKE ?)",
        );
        args.push("%" + q + "%");
      } else {
        where.push(
          "t.id IN (SELECT term_id FROM term_search WHERE instr(content,?)>0)",
        );
        args.push(q);
      }
    }
    for (const field of [
      "glossaryId",
      "project",
      "work",
      "sourceLang",
      "targetLang",
    ])
      if (params[field]) {
        where.push(`json_extract(t.data,'$.${field}')=?`);
        args.push(String(params[field]));
      }
    for (const field of ["category", "tones", "tags"]) {
      const values = Array.isArray(params[field])
        ? params[field]
        : params[field]
          ? [params[field]]
          : [];
      if (values.length) {
        if (values.length > 30) throw new AppError("Muitos filtros.");
        if (field === "category") {
          where.push(
            `json_extract(t.data,'$.category') IN (${values.map(() => "?").join(",")})`,
          );
        } else
          where.push(
            `EXISTS(SELECT 1 FROM json_each(t.data,'$.${field}') WHERE value IN (${values.map(() => "?").join(",")}))`,
          );
        args.push(...values.map(String));
      }
    }
    const clause = where.length ? " WHERE " + where.join(" AND ") : "";
    const total = Number(
      this.db.prepare("SELECT count(*) AS n FROM terms t" + clause).get(...args)
        .n,
    );
    const page = Math.max(
      1,
      Math.min(100000, Number.parseInt(params.page) || 1),
    );
    const pageSize = Math.max(
      1,
      Math.min(50, Number.parseInt(params.pageSize) || 12),
    );
    const order =
      params.sort === "alpha"
        ? "json_extract(t.data,'$.original') COLLATE NOCASE ASC"
        : "json_extract(t.data,'$.updatedAt') DESC,t.id";
    const rows = this.db
      .prepare(
        "SELECT t.data FROM terms t" +
          clause +
          " ORDER BY " +
          order +
          (all ? "" : " LIMIT ? OFFSET ?"),
      )
      .all(...args, ...(all ? [] : [pageSize, (page - 1) * pageSize]));
    return {
      items: rows.map((r) => JSON.parse(r.data)),
      total,
      page,
      pageSize,
    };
  }
  metadata() {
    const all = this.list({}, true).items;
    return {
      projects: [...new Set(all.map((t) => t.project).filter(Boolean))].sort(),
      works: [...new Set(all.map((t) => t.work).filter(Boolean))].sort(),
      tags: [...new Set(all.flatMap((t) => t.tags))].sort(),
      total: all.length,
      actor: this.actor,
    };
  }
  preview(rows, context) {
    const id = randomUUID();
    const data = { rows: rows.map((r, i) => ({ ...r, index: i })), context };
    this.db.prepare("DELETE FROM imports WHERE expires<?").run(Date.now());
    this.db
      .prepare("INSERT INTO imports VALUES(?,?,?,NULL)")
      .run(id, JSON.stringify(data), Date.now() + 3600000);
    return { id, ...data };
  }
  commitImport(id, selected) {
    return this.tx(() => {
      const row = this.db.prepare("SELECT * FROM imports WHERE id=?").get(id);
      if (!row || row.expires < Date.now())
        throw new AppError("A prévia expirou. Envie o arquivo novamente.", 410);
      if (row.result) return JSON.parse(row.result);
      const d = JSON.parse(row.data);
      if (
        !Array.isArray(selected) ||
        !selected.length ||
        selected.length > 2000 ||
        selected.some(
          (i) => !Number.isInteger(i) || i < 0 || i >= d.rows.length,
        )
      )
        throw new AppError("Selecione termos válidos para importar.");
      let created = 0,
        skipped = 0;
      for (const i of new Set(selected)) {
        const r = d.rows[i];
        const value = this.validate({
          ...d.context,
          original: r.original,
          translation: r.translation,
        });
        if (this.duplicate(value)) {
          skipped++;
          continue;
        }
        this.createInternal(value);
        created++;
      }
      const result = { created, skipped };
      this.db
        .prepare("UPDATE imports SET result=? WHERE id=?")
        .run(JSON.stringify(result), id);
      return result;
    });
  }
  async backup(folder) {
    mkdirSync(folder, { recursive: true });
    const path = join(
      folder,
      `lexica-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`,
    );
    await backup(this.db, path);
    return path;
  }
  close() {
    this.db.close();
  }
}
