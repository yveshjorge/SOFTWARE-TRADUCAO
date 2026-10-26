import { parse as parseCsv } from "csv-parse/sync";
import { PDFParse } from "pdf-parse";
import { AppError } from "./domain.js";
const xml = (v) =>
  String(v).replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
const cell = (v) =>
  '"' +
  String(v ?? "")
    .replace(/^[=+@\-\t\r]/, "'$&")
    .replaceAll('"', '""') +
  '"';
export function exportTerms(items, format) {
  if (!items.length)
    throw new AppError(
      "Esta memória não possui termos cadastrados para exportação.",
      422,
    );
  if (format === "tmx")
    return {
      type: "application/xml",
      body: `<?xml version="1.0" encoding="UTF-8"?><tmx version="1.4"><header creationtool="Lexica" creationtoolversion="1.0" segtype="phrase" o-tmf="Lexica" adminlang="pt-BR" srclang="*all*" datatype="PlainText"/><body>${items.map((t) => `<tu tuid="${xml(t.id)}"><prop type="project">${xml(t.project)}</prop><prop type="category">${xml(t.category)}</prop><tuv xml:lang="${xml(t.sourceLang)}"><seg>${xml(t.original)}</seg></tuv><tuv xml:lang="${xml(t.targetLang)}"><seg>${xml(t.translation)}</seg></tuv></tu>`).join("")}</body></tmx>`,
    };
  if (format !== "csv") throw new AppError("Formato de exportação inválido.");
  const cols = [
    "original",
    "translation",
    "sourceLang",
    "targetLang",
    "project",
    "category",
    "tones",
    "tags",
    "work",
    "intention",
    "source",
    "justification",
    "notes",
  ];
  return {
    type: "text/csv; charset=utf-8",
    body:
      "\uFEFF" +
      cols.map(cell).join(",") +
      "\r\n" +
      items
        .map((t) =>
          cols
            .map((k) =>
              cell(
                k === "notes"
                  ? t.notes.map((n) => n.text).join(" | ")
                  : Array.isArray(t[k])
                    ? t[k].join(" | ")
                    : t[k],
              ),
            )
            .join(","),
        )
        .join("\r\n"),
  };
}
export async function extractTerms(filename, bytes) {
  if (!bytes.length || bytes.length > 5 * 1024 * 1024)
    throw new AppError("Envie um arquivo de até 5 MB.", 422);
  let text;
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "pdf") {
    if (bytes.subarray(0, 5).toString() !== "%PDF-")
      throw new AppError(
        "Formato de arquivo inválido. Por favor, envie um arquivo PDF ou TXT válido",
        422,
      );
    let parser;
    try {
      parser = new PDFParse({ data: new Uint8Array(bytes) });
      const result = await parser.getText();
      text = result.text;
    } catch {
      throw new AppError(
        "PDF corrompido, protegido ou sem texto legível. Envie um PDF com texto ou TXT.",
        422,
      );
    } finally {
      if (parser) await parser.destroy();
    }
  } else if (ext === "txt" || ext === "csv") {
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new AppError(
        "Arquivo inválido. Salve o texto em UTF-8 e tente novamente.",
        422,
      );
    }
    if (/[\x00-\x08\x0e-\x1f]/.test(text))
      throw new AppError(
        "O arquivo contém dados binários. Envie PDF ou TXT válido.",
        422,
      );
  } else
    throw new AppError(
      "Formato de arquivo inválido. Por favor, envie um arquivo PDF ou TXT válido",
      422,
    );
  let rows = [];
  if (ext === "csv") {
    try {
      const records = parseCsv(text, {
        columns: true,
        bom: true,
        skip_empty_lines: true,
      });
      if (
        records.some(
          (r) =>
            !Object.hasOwn(r, "original") || !Object.hasOwn(r, "translation"),
        )
      )
        throw Error();
      rows = records.map((r) => ({
        original: r.original,
        translation: r.translation,
      }));
    } catch {
      throw new AppError(
        "CSV inválido. Use as colunas original e translation, separadas por vírgula.",
        422,
      );
    }
  } else
    rows = text
      .split(/\r?\n/)
      .map((line) => {
        const match = line.match(
          /^\s*(.+?)\s*(?:→|->|=>|\t|\s=\s|\s;\s)\s*(.+?)\s*$/,
        );
        return match ? { original: match[1], translation: match[2] } : null;
      })
      .filter(Boolean);
  rows = rows.map((r) => ({
    original: r.original.trim(),
    translation: r.translation.trim(),
  }));
  if (!rows.length)
    throw new AppError(
      "Nenhum par de termos encontrado. Use uma linha por par: termo original → tradução. PDFs digitalizados precisam de OCR prévio.",
      422,
    );
  if (
    rows.length > 2000 ||
    rows.some(
      (r) =>
        !r.original ||
        !r.translation ||
        r.original.length > 500 ||
        r.translation.length > 2000,
    )
  )
    throw new AppError(
      "Arquivo excede 2.000 pares ou contém termos inválidos (original até 500 e tradução até 2.000 caracteres).",
      422,
    );
  return rows;
}
export function auditReport(t, v) {
  return `<!doctype html><html lang="pt-BR"><meta charset="UTF-8"><title>Ficha de justificativa</title><style>body{font:16px system-ui;max-width:800px;margin:50px auto;padding:20px}dt{font-weight:bold;margin-top:24px}dd{margin:8px 0;white-space:pre-wrap}.stamp{border:2px solid #17655c;padding:16px}</style><h1>Ficha de justificativa</h1><p class="stamp">REGISTRO INTERNO · versão ${t.version} · ${xml(t.id)}</p><dl>${[
    ["Original", t.original],
    ["Tradução", t.translation],
    ["Justificativa", t.justification || "Não informada"],
    ["Referência", t.source || "Sem fonte vinculada"],
    ["Cadastro", t.createdAt],
    ["Versão registrada em", v.at],
    ["Responsável", v.actor],
  ]
    .map(([k, val]) => `<dt>${k}</dt><dd>${xml(val)}</dd>`)
    .join(
      "",
    )}</dl><p>Registro de rastreabilidade do software. Não constitui certificação jurídica ou assinatura digital.</p></html>`;
}
