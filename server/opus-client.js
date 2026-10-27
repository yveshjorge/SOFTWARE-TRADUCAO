import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGunzip } from "node:zlib";
import { AppError } from "./domain.js";
import { language, parseTmx, readTmxFile } from "./tmx.js";

export const opusLinks = {
  catalog: "https://opus.nlpl.eu/opusapi/",
  onlineSearch: "https://opus.nlpl.eu/bin/opuscqp.pl",
  explorer: "https://opus.nlpl.eu/explore/",
};
export function selection(input) {
  const source = language(input.source),
    target = language(input.target);
  if (source === target)
    throw new AppError("Escolha dois idiomas diferentes.", 422);
  const corpus = input.corpus ?? "",
    version = input.version ?? "latest";
  if (
    typeof corpus !== "string" ||
    !/^[A-Za-z0-9_.-]{0,100}$/.test(corpus) ||
    typeof version !== "string" ||
    !/^[A-Za-z0-9_.-]{1,100}$/.test(version)
  )
    throw new AppError("Coleção ou versão OPUS inválida.", 422);
  return { source, target, corpus, version };
}
export function safeOpusUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new AppError("URL OPUS inválida.", 502);
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !["opus.nlpl.eu", "object.pouta.csc.fi"].includes(url.hostname) ||
    (url.hostname === "object.pouta.csc.fi" &&
      !url.pathname.startsWith("/OPUS-"))
  )
    throw new AppError(
      "O OPUS retornou um endereço de download não autorizado.",
      502,
    );
  return url;
}

export class OpusClient {
  constructor({
    fetchImpl = fetch,
    maxDownloadBytes = 1024 ** 3,
    maxXmlBytes = 4 * 1024 ** 3,
  } = {}) {
    this.fetch = fetchImpl;
    this.maxDownloadBytes = maxDownloadBytes;
    this.maxXmlBytes = maxXmlBytes;
  }
  async request(value, signal) {
    let url = safeOpusUrl(value);
    try {
      for (let redirects = 0; redirects <= 5; redirects++) {
        const response = await this.fetch(url, { redirect: "manual", signal });
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          await response.body?.cancel();
          const next = response.headers.get("location");
          if (!next) throw new AppError("Redirecionamento OPUS inválido.", 502);
          url = safeOpusUrl(new URL(next, url).href);
          continue;
        }
        if (!response.ok) {
          await response.body?.cancel();
          throw new AppError(
            `OPUS indisponível (HTTP ${response.status}). Tente novamente.`,
            502,
          );
        }
        return response;
      }
      throw new AppError("O OPUS excedeu o limite de redirecionamentos.", 502);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "Não foi possível conectar ao OPUS. Verifique a internet e tente novamente.",
        502,
      );
    }
  }
  async catalog(input) {
    const query = selection(input);
    const url = new URL(opusLinks.catalog);
    url.search = new URLSearchParams({
      ...query,
      preprocessing: "tmx",
    }).toString();
    const response = await this.request(url, AbortSignal.timeout(30000));
    try {
      const chunks = [];
      let bytes = 0;
      for await (const chunk of Readable.fromWeb(response.body)) {
        bytes += chunk.length;
        if (bytes > 2 * 1024 ** 2) throw new Error("Catalog too large");
        chunks.push(chunk);
      }
      const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!Array.isArray(data.corpora)) throw new Error("Invalid catalog");
      return data.corpora
        .filter(
          (row) =>
            row.preprocessing === "tmx" &&
            (!query.corpus || row.corpus === query.corpus) &&
            (query.version === "latest" || row.version === query.version) &&
            [row.source?.toLowerCase(), row.target?.toLowerCase()]
              .sort()
              .join("|") === [query.source, query.target].sort().join("|"),
        )
        .map((row) => {
          if (typeof row.corpus !== "string" || typeof row.version !== "string")
            throw new Error("Invalid dataset");
          const downloadUrl = safeOpusUrl(row.url).href;
          const dataset = {
            corpus: row.corpus,
            version: row.version,
            source: query.source,
            target: query.target,
            downloadUrl,
            estimatedPairs: Number(row.alignment_pairs) || 0,
          };
          return {
            ...dataset,
            id: createHash("sha256")
              .update(JSON.stringify(dataset))
              .digest("hex"),
          };
        });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "O OPUS retornou um catálogo inválido ou incompleto.",
        502,
      );
    }
  }

  async *pairs(dataset, { maxPairs, stats }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15 * 60 * 1000);
    timeout.unref();
    let input, xml, temp, pumping;
    try {
      const response = await this.request(
        dataset.downloadUrl,
        controller.signal,
      );
      input = Readable.fromWeb(response.body);
      const iterator = input[Symbol.asyncIterator]();
      let prefix = Buffer.alloc(0);
      while (prefix.length < 4) {
        const next = await iterator.next();
        if (next.done) break;
        prefix = Buffer.concat([prefix, next.value]);
      }
      stats.downloadBytes = 0;
      const maxDownloadBytes = this.maxDownloadBytes;
      async function* bounded() {
        try {
          let chunk = prefix;
          while (true) {
            stats.downloadBytes += chunk.length;
            if (stats.downloadBytes > maxDownloadBytes)
              throw new AppError("Download excedeu o limite de tamanho.", 422);
            yield chunk;
            const next = await iterator.next();
            if (next.done) break;
            chunk = next.value;
          }
        } finally {
          await iterator.return?.();
        }
      }
      const options = {
        source: dataset.source,
        target: dataset.target,
        maxBytes: this.maxXmlBytes,
        stats,
      };
      let rows;
      if (prefix[0] === 0x50 && prefix[1] === 0x4b) {
        temp = await mkdtemp(join(tmpdir(), "lexica-opus-"));
        const path = join(temp, "dataset.zip");
        await pipeline(
          Readable.from(bounded()),
          createWriteStream(path, { flags: "wx" }),
        );
        rows = readTmxFile(path, options);
      } else {
        const raw = Readable.from(bounded());
        xml = raw;
        if (prefix[0] === 0x1f && prefix[1] === 0x8b) {
          xml = createGunzip();
          // Reader receives pipeline errors. Observe the producer promise as
          // well, including intentional abort when the sample limit is reached.
          pumping = pipeline(raw, xml).catch(() => {});
        }
        rows = parseTmx(xml, options);
      }
      let count = 0;
      stats.limited = false;
      for await (const pair of rows) {
        yield pair;
        if (++count >= maxPairs) {
          stats.limited = true;
          break;
        }
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "Download interrompido ou arquivo OPUS corrompido. Tente importar novamente.",
        502,
      );
    } finally {
      clearTimeout(timeout);
      controller.abort();
      xml?.destroy();
      input?.destroy();
      await pumping;
      if (temp) await rm(temp, { recursive: true, force: true });
    }
  }
}
