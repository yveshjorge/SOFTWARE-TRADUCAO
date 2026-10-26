import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../server/store.js";
import { extractTerms, exportTerms, auditReport } from "../server/files.js";
import { createApp } from "../server/app.js";
import { TemporaryStorage } from "../server/storage.js";
const base = {
  original: "Health Potion",
  translation: "Poção de Vida",
  sourceLang: "en",
  targetLang: "pt-BR",
  category: "Itens e Equipamentos",
  project: "RPG Fantasy",
};
function setup(t) {
  const s = new Store(":memory:", "Revisor de teste");
  t.after(() => s.close());
  return s;
}
test("CRUD preserves immutable snapshots, actor and timestamps", (t) => {
  const s = setup(t);
  const a = s.create(base);
  const b = s.update(a.id, { ...base, translation: "Poção vital" }, 1);
  assert.equal(b.version, 2);
  assert.equal(s.history(a.id)[1].snapshot.translation, "Poção de Vida");
  assert.equal(s.history(a.id)[0].actor, "Revisor de teste");
  assert.throws(
    () => s.db.prepare("UPDATE versions SET actor=?").run("Outro"),
    /imutável/,
  );
  assert.throws(() => s.db.exec("DELETE FROM versions"), /imutável/);
});
test("conflicting update never overwrites current version", (t) => {
  const s = setup(t);
  const a = s.create(base);
  s.update(a.id, { ...base, translation: "Poção vital" }, 1);
  assert.throws(
    () => s.update(a.id, { ...base, translation: "Perdida" }, 1),
    /outra aba/,
  );
  assert.equal(s.get(a.id).translation, "Poção vital");
  assert.equal(s.history(a.id).length, 2);
});
test("combined normalized partial keyword, project, category and tone filters", (t) => {
  const s = setup(t);
  s.create({ ...base, tones: ["Formal"] });
  s.create({
    ...base,
    original: "Mana Potion",
    translation: "Poção de Mana",
    tones: ["Informal"],
  });
  s.create({
    ...base,
    original: "Health Potion",
    translation: "Poção de Cura",
    project: "Outro jogo",
    tones: ["Formal"],
  });
  assert.equal(
    s.list({
      q: "pocao",
      project: "RPG Fantasy",
      category: ["Itens e Equipamentos"],
      tones: ["Formal"],
    }).total,
    1,
  );
  assert.equal(s.list({ q: "oção", project: "RPG Fantasy" }).total, 2);
  assert.equal(s.list({ q: "Po", project: "RPG Fantasy" }).total, 2);
  assert.equal(s.list({ q: "%" }).total, 0);
  assert.equal(s.list({ q: "' OR 1=1 --" }).total, 0);
});
test("glossary language validation and client isolation", (t) => {
  const s = setup(t);
  const a = s.createGlossary({
    name: "A",
    client: "Cliente A",
    sourceLang: "en",
    targetLang: "pt-BR",
  });
  const b = s.createGlossary({
    name: "B",
    client: "Cliente B",
    sourceLang: "en",
    targetLang: "pt-BR",
  });
  s.create({ ...base, glossaryId: a.id });
  s.create({ ...base, translation: "Poção diferente", glossaryId: b.id });
  assert.equal(
    s.list({ glossaryId: a.id }).items[0].translation,
    "Poção de Vida",
  );
  assert.throws(
    () => s.create({ ...base, sourceLang: "fr", glossaryId: a.id }),
    /idiomas/,
  );
});
test("official justification required, optional scientific source, unsafe schemes rejected", (t) => {
  const s = setup(t);
  assert.throws(() => s.create({ ...base, official: true }), /campos/);
  assert.throws(
    () => s.create({ ...base, source: "javascript:alert(1)" }),
    /campos/,
  );
  const term = s.create({
    ...base,
    official: true,
    justification: "Parecer interno",
  });
  assert.equal(term.source, "");
});
test("notes edit preserves text before and after plus timestamp", (t) => {
  const s = setup(t);
  const term = s.create(base);
  const v = s.note(
    term.id,
    { kind: "Comentário", text: "Primeira decisão" },
    1,
  );
  const changed = s.note(
    term.id,
    { kind: "Comentário", text: "Decisão revisada" },
    2,
    v.notes[0].id,
  );
  assert.equal(changed.notes[0].text, "Decisão revisada");
  assert.equal(
    s.history(term.id)[1].snapshot.notes[0].text,
    "Primeira decisão",
  );
  assert.ok(changed.notes[0].updatedAt);
});
test("same phrase can have stylistic variants and search matches them", (t) => {
  const s = setup(t);
  const v = s.create({
    ...base,
    variations: [
      { translation: "Elixir vital", character: "Mago", tone: "Formal" },
    ],
  });
  assert.equal(s.list({ q: "Elixir" }).items[0].id, v.id);
});
test("reclassification updates filters atomically", (t) => {
  const s = setup(t);
  const t1 = s.create({ ...base, category: "Biologia" });
  s.update(t1.id, { ...base, category: "Engenharia Genética" }, 1);
  assert.equal(s.list({ category: "Biologia" }).total, 0);
  assert.equal(s.list({ category: "Engenharia Genética" }).total, 1);
});
test("pagination limits and full export use whole filtered dataset", (t) => {
  const s = setup(t);
  for (let i = 0; i < 26; i++) s.create({ ...base, original: "Item " + i });
  assert.equal(s.list({ pageSize: 10, page: 2 }).items.length, 10);
  assert.equal(s.list({ pageSize: 100000 }).pageSize, 50);
  assert.equal(s.list({}, true).items.length, 26);
});
test("CSV contains notes and safely escapes formula injection", (t) => {
  const s = setup(t);
  let term = s.create({
    ...base,
    original: "=SUM(1,2)",
    translation: 'Texto "citado"',
  });
  term = s.note(term.id, { kind: "Nota explicativa", text: "Raciocínio" }, 1);
  const file = exportTerms([term], "csv");
  assert.match(file.body, /'=SUM/);
  assert.match(file.body, /""citado""/);
  assert.match(file.body, /Raciocínio/);
  assert.throws(() => exportTerms([], "csv"), /não possui/);
});
test("TMX escapes XML and includes language pairs", (t) => {
  const s = setup(t);
  const term = s.create({ ...base, original: "A & B <tag>" });
  const f = exportTerms([term], "tmx");
  assert.match(f.body, /A &amp; B &lt;tag&gt;/);
  assert.match(f.body, /xml:lang="pt-BR"/);
  assert.match(f.body, /<tmx version="1.4">/);
});
test("historic report exports old snapshot without overwriting present", (t) => {
  const s = setup(t);
  const a = s.create(base);
  s.update(a.id, { ...base, translation: "Nova" }, 1);
  const old = s.history(a.id)[1];
  const html = auditReport(old.snapshot, old);
  assert.match(html, /Poção de Vida/);
  assert.equal(s.get(a.id).translation, "Nova");
  assert.match(html, /Não constitui certificação/);
});
test("TXT and CSV extract paired terms with diacritics and quoted commas", async () => {
  assert.deepEqual(
    await extractTerms(
      "glossario.txt",
      Buffer.from("Health Potion → Poção de Vida\nMana Potion\tPoção de Mana"),
    ),
    [
      { original: "Health Potion", translation: "Poção de Vida" },
      { original: "Mana Potion", translation: "Poção de Mana" },
    ],
  );
  const r = await extractTerms(
    "terms.csv",
    Buffer.from('original,translation\n"Hello, world","Olá, mundo"'),
  );
  assert.equal(r[0].original, "Hello, world");
});
test("corrupt, binary, oversized, unsupported and unpaired imports rejected", async () => {
  for (const [name, data] of [
    ["bad.exe", "MZ..."],
    ["bad.pdf", "not pdf"],
    ["binary.txt", "\0\0"],
    ["empty.txt", ""],
    ["prose.txt", "Texto sem pares"],
    ["bad.csv", "source,target\none,two"],
    ["broken.pdf", "%PDF-1.7 broken"],
  ])
    await assert.rejects(extractTerms(name, Buffer.from(data)));
  await assert.rejects(
    extractTerms("huge.txt", Buffer.alloc(6 * 1024 * 1024)),
    /5 MB/,
  );
});
export function samplePdf() {
  const stream = "BT /F1 12 Tf 50 740 Td (Hello -> Ola) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let text = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(text));
    text += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(text);
  text += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(text);
}
test("valid PDF is parsed into preview pairs", async () => {
  const rows = await extractTerms("valid.pdf", samplePdf());
  assert.deepEqual(rows, [{ original: "Hello", translation: "Ola" }]);
});
test("preview requires explicit selection; commit is transactional and idempotent", (t) => {
  const s = setup(t);
  const { original, translation, ...context } = base;
  const p = s.preview(
    [
      { original: "A", translation: "B" },
      { original: "C", translation: "D" },
    ],
    context,
  );
  assert.equal(s.list().total, 0);
  const r = s.commitImport(p.id, [1]);
  assert.deepEqual(r, { created: 1, skipped: 0 });
  assert.equal(s.list().items[0].original, "C");
  assert.deepEqual(s.commitImport(p.id, [1]), r);
  assert.equal(s.list().total, 1);
});
test("invalid selection and expired preview cannot mutate data", (t) => {
  const s = setup(t);
  const { original, translation, ...context } = base;
  const p = s.preview([{ original: "A", translation: "B" }], context);
  assert.throws(() => s.commitImport(p.id, [99]), /válidos/);
  s.db.prepare("UPDATE imports SET expires=0 WHERE id=?").run(p.id);
  assert.throws(() => s.commitImport(p.id, [0]), /expirou/);
  assert.equal(s.list().total, 0);
});
test("duplicate import skips exact context match", (t) => {
  const s = setup(t);
  s.create(base);
  const { original, translation, ...context } = base;
  const p = s.preview([{ original, translation }], context);
  assert.deepEqual(s.commitImport(p.id, [0]), { created: 0, skipped: 1 });
});
test("backup restores data, immutable history and index", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "lexica-test-"));
  const s = setup(t);
  const term = s.create(base);
  const path = await s.backup(dir);
  const restored = new Store(path);
  assert.equal(restored.get(term.id).translation, base.translation);
  assert.equal(restored.history(term.id).length, 1);
  assert.equal(restored.list({ q: "pocao" }).total, 1);
  restored.close();
  await rm(dir, { recursive: true, force: true });
});
test("HTTP API enforces CSRF, validates body and returns usable exports", async (t) => {
  const s = setup(t);
  const dir = await mkdtemp(join(tmpdir(), "lexica-http-"));
  const app = createApp(s, new TemporaryStorage(dir));
  const server = await new Promise((r) => {
    const server = app.listen(0, "127.0.0.1", () => r(server));
  });
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await rm(dir, { recursive: true, force: true });
  });
  const url = "http://127.0.0.1:" + server.address().port;
  const meta = await (await fetch(url + "/api/meta")).json();
  const headers = {
    "Content-Type": "application/json",
    "X-Lexica-Token": meta.token,
  };
  assert.equal(
    (
      await fetch(url + "/api/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(base),
      })
    ).status,
    403,
  );
  const res = await fetch(url + "/api/terms", {
    method: "POST",
    headers,
    body: JSON.stringify(base),
  });
  assert.equal(res.status, 201);
  assert.equal(
    (await fetch(url + "/api/terms", { method: "POST", headers, body: "{}" }))
      .status,
    422,
  );
  const csv = await fetch(url + "/api/export?format=csv");
  assert.match(csv.headers.get("content-disposition"), /attachment/);
  assert.match(await csv.text(), /Poção de Vida/);
});
