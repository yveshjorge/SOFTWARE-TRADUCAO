import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { gzipSync, crc32 } from "node:zlib";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseTmx, readTmxFile } from "../server/tmx.js";
import { OpusClient, safeOpusUrl } from "../server/opus-client.js";
import { TranslationMemory } from "../server/translation-memory.js";
import { Store } from "../server/store.js";
import { createApp } from "../server/app.js";

const unit = (source, target) =>
  `<tu><tuv xml:lang="pt"><seg>${target}</seg></tuv><tuv xml:lang="en"><seg>${source}</seg></tuv></tu>`;
const tmx = (body) =>
  `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE tmx SYSTEM "tmx14.dtd"><tmx version="1.4"><header srclang="en"/><body>${body}</body></tmx>`;
const fixture = tmx(
  unit("Good morning", "Bom dia") +
    unit("Health &amp; care", "Saúde &amp; cuidados"),
);
const collect = async (iter) => {
  const result = [];
  for await (const row of iter) result.push(row);
  return result;
};
const parse = (xml, options = {}) =>
  collect(
    parseTmx(Readable.from([Buffer.from(xml)]), {
      source: "en",
      target: "pt",
      ...options,
    }),
  );
const upstream = {
  corpus: "Europarl",
  version: "v8",
  source: "en",
  target: "pt",
  preprocessing: "tmx",
  alignment_pairs: 2,
  url: "https://object.pouta.csc.fi/OPUS-Europarl/v8/tmx/en-pt.tmx.gz",
};
function fakeClient(xml = fixture, options = {}) {
  return new OpusClient({
    fetchImpl: async (url) =>
      new URL(url).hostname === "opus.nlpl.eu"
        ? Response.json({ corpora: [upstream] })
        : new Response(gzipSync(Buffer.from(xml))),
    ...options,
  });
}
async function setup(t, client = fakeClient()) {
  const store = new Store(":memory:");
  const memory = new TranslationMemory(store, client);
  t.after(async () => {
    await memory.running;
    store.close();
  });
  const dataset = (
    await client.catalog({ source: "en", target: "pt", corpus: "Europarl" })
  )[0];
  const input = { ...dataset, datasetId: dataset.id, maxPairs: 100 };
  return { store, memory, input };
}

test("TMX chooses source/target by language, decodes entities and supports reversed direction", async () => {
  assert.deepEqual(await parse(fixture), [
    { original: "Good morning", translation: "Bom dia" },
    { original: "Health & care", translation: "Saúde & cuidados" },
  ]);
  assert.equal(
    (await parse(fixture, { source: "pt", target: "en" }))[0].translation,
    "Good morning",
  );
});
test("TMX handles byte boundaries, CDATA, inline code and UTF-16 BOM", async () => {
  const xml = tmx(
    unit(
      "A <bpt i='1'>&lt;b&gt;</bpt>good<ept i='1'>&lt;/b&gt;</ept> day",
      "<![CDATA[Olá 🌍]]>",
    ),
  );
  const bytes = Buffer.from(xml);
  const rows = await collect(
    parseTmx(Readable.from([...bytes].map((b) => Buffer.from([b]))), {
      source: "en",
      target: "pt",
    }),
  );
  assert.deepEqual(rows, [{ original: "A good day", translation: "Olá 🌍" }]);
  const utf16 = Buffer.concat([
    Buffer.from([255, 254]),
    Buffer.from(fixture.replace("UTF-8", "UTF-16"), "utf16le"),
  ]);
  assert.equal((await parse(utf16))[1].translation, "Saúde & cuidados");
});
test("TMX skips incomplete/ambiguous variants and prefers exact regional languages", async () => {
  const xml = tmx(
    `<tu><tuv xml:lang="en"><seg>One</seg></tuv></tu><tu><tuv xml:lang="en"><seg>Two</seg></tuv><tuv xml:lang="pt-BR"><seg>Dois</seg></tuv><tuv xml:lang="pt-PT"><seg>Duas</seg></tuv></tu>` +
      unit("Three", "Três"),
  );
  const stats = {};
  assert.equal((await parse(xml, { stats })).length, 1);
  assert.equal(stats.skipped, 2);
  assert.equal((await parse(xml, { target: "pt-br" }))[0].translation, "Dois");
});
test("TMX rejects malformed XML, unknown entities, wrong format, invalid encodings and limits", async () => {
  for (const xml of [
    fixture.slice(0, -5),
    "<html>error</html>",
    tmx(unit("&unknown;", "x")),
    `<!DOCTYPE tmx [<!ENTITY x SYSTEM "file:///secret">]><tmx><body/></tmx>`,
    "",
    Buffer.from([0xff, 0xff, 0xff, 0xff]),
  ])
    await assert.rejects(parse(xml));
  await assert.rejects(parse(fixture, { maxBytes: 10 }), /limite/);
  await assert.rejects(parse(fixture, { maxUnits: 1 }), /limite/);
  await assert.rejects(
    parse(fixture, { source: "en", target: "en" }),
    /diferentes/,
  );
});
// Minimal stored ZIP fixture, including correct CRC and central directory.
function zipFixture(text) {
  const data = Buffer.from(text),
    name = Buffer.from("nested/memory.tmx");
  const local = Buffer.alloc(30),
    central = Buffer.alloc(46),
    end = Buffer.alloc(22);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(20, 4);
  local.writeUInt32LE(crc32(data), 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  central.writeUInt32LE(0x02014b50);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(crc32(data), 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + name.length, 12);
  end.writeUInt32LE(local.length + name.length + data.length, 16);
  return Buffer.concat([local, name, data, central, name, end]);
}
test("file reader accepts TMX/GZIP/ZIP and rejects corrupt archives", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "lexica-opus-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const [name, bytes] of [
    ["raw", Buffer.from(fixture)],
    ["gzip", gzipSync(fixture)],
    ["zip", zipFixture(fixture)],
  ]) {
    const path = join(dir, name);
    await writeFile(path, bytes);
    assert.equal(
      (await collect(readTmxFile(path, { source: "en", target: "pt" }))).length,
      2,
    );
  }
  const path = join(dir, "bad.gz");
  await writeFile(path, gzipSync(fixture).subarray(0, -6));
  await assert.rejects(
    collect(readTmxFile(path, { source: "en", target: "pt" })),
  );
  const brokenZip = zipFixture(fixture);
  brokenZip[60] ^= 1;
  await writeFile(path, brokenZip);
  await assert.rejects(
    collect(readTmxFile(path, { source: "en", target: "pt" })),
  );
});
test("catalog uses TMX filters, handles reverse language order, empty datasets and upstream errors", async () => {
  let requested;
  const client = fakeClient(fixture, {
    fetchImpl: async (url) => {
      requested = new URL(url);
      return Response.json({ corpora: [upstream] });
    },
  });
  const items = await client.catalog({
    source: "pt",
    target: "en",
    corpus: "Europarl",
  });
  assert.equal(requested.searchParams.get("preprocessing"), "tmx");
  assert.equal(requested.searchParams.get("version"), "latest");
  assert.equal(items[0].source, "pt");
  assert.equal(
    (await client.catalog({ source: "en", target: "pt", corpus: "MultiUN" }))
      .length,
    0,
  );
  await assert.rejects(
    fakeClient(fixture, {
      fetchImpl: async () => new Response("", { status: 503 }),
    }).catalog({ source: "en", target: "pt" }),
    /503/,
  );
  await assert.rejects(
    fakeClient(fixture, {
      fetchImpl: async () => new Response("broken"),
    }).catalog({ source: "en", target: "pt" }),
    /catálogo/,
  );
  assert.throws(() => safeOpusUrl("https://localhost/secret"), /autorizado/);
  await assert.rejects(
    fakeClient(fixture, {
      fetchImpl: async () =>
        new Response(null, {
          status: 302,
          headers: { location: "http://127.0.0.1/" },
        }),
    }).catalog({ source: "en", target: "pt" }),
    /autorizado/,
  );
});
test("limited imports are searchable, attributed, offline and idempotent", async (t) => {
  const { store, memory, input } = await setup(t);
  const job = await memory.start({ ...input, maxPairs: 1 });
  await memory.running;
  const ready = memory.get(job.id);
  assert.equal(ready.status, "ready");
  assert.equal(ready.coverage, "sample");
  assert.equal(ready.importedPairs, 1);
  const match = memory.suggestions({
    source: "en",
    target: "pt",
    q: "good morning",
  })[0];
  assert.equal(match.translation, "Bom dia");
  assert.equal(match.match, "exact");
  assert.equal(match.corpus, "Europarl");
  assert.equal(
    memory.suggestions({ source: "en", target: "fr", q: "good morning" })
      .length,
    0,
  );
  assert.equal(
    memory.suggestions({ source: "en", target: "pt", q: "morning" })[0].match,
    "related",
  );
  assert.equal((await memory.start({ ...input, maxPairs: 1 })).id, job.id);
  assert.equal(store.db.prepare("SELECT count(*) n FROM tm_units").get().n, 1);
});
test("corruption after a committed batch removes every partial pair and permits retry", async (t) => {
  const xml = tmx(
    Array.from({ length: 501 }, (_, i) =>
      unit("Source " + i, "Destino " + i),
    ).join(""),
  );
  const { store, memory, input } = await setup(t, fakeClient(xml.slice(0, -5)));
  const job = await memory.start({ ...input, maxPairs: 1000 });
  await memory.running;
  assert.equal(memory.get(job.id).status, "failed");
  assert.equal(store.db.prepare("SELECT count(*) n FROM tm_units").get().n, 0);
  memory.client = fakeClient(xml);
  await memory.start({ ...input, maxPairs: 1000 });
  await memory.running;
  assert.equal(memory.get(job.id).importedPairs, 501);
  assert.equal(memory.get(job.id).coverage, "complete");
});
test("duplicate pairs are skipped; interrupted imports are cleaned on startup", async (t) => {
  const { store, memory, input } = await setup(
    t,
    fakeClient(tmx(unit("A", "B") + unit("A", "B"))),
  );
  const job = await memory.start(input);
  await memory.running;
  assert.equal(memory.get(job.id).importedPairs, 1);
  memory.save({ ...memory.get(job.id), status: "importing" });
  const recovered = new TranslationMemory(store, fakeClient());
  assert.equal(recovered.get(job.id).status, "failed");
  assert.equal(
    recovered.suggestions({ source: "en", target: "pt", q: "A" }).length,
    0,
  );
});
test("HTTP routes protect import, reject arbitrary URLs and expose catalog, jobs and suggestions", async (t) => {
  const { store, memory, input } = await setup(t);
  const app = createApp(store, {}, memory);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = "http://127.0.0.1:" + server.address().port;
  const token = (await (await fetch(base + "/api/meta")).json()).token;
  const headers = {
    "Content-Type": "application/json",
    "X-Lexica-Token": token,
  };
  assert.equal(
    (
      await fetch(base + "/api/opus/imports", {
        method: "POST",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(base + "/api/opus/imports", {
        method: "POST",
        headers,
        body: JSON.stringify({
          source: "en",
          target: "pt",
          url: "http://localhost",
        }),
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await (
        await fetch(base + "/api/opus/datasets?source=en&target=pt")
      ).json()
    ).items.length,
    1,
  );
  const response = await fetch(base + "/api/opus/imports", {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  assert.equal(response.status, 202);
  const job = await response.json();
  await memory.running;
  assert.equal(
    (await (await fetch(base + "/api/opus/imports/" + job.id)).json()).status,
    "ready",
  );
  assert.equal(
    (
      await (
        await fetch(
          base +
            "/api/translation-memory/suggestions?source=en&target=pt&q=Health",
        )
      ).json()
    ).items[0].translation,
    "Saúde & cuidados",
  );
});
