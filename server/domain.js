import { z } from "zod";
export const languages = ["en", "pt-BR", "es", "fr", "de", "it", "ja"];
export const categories = [
  "Geral",
  "Marketing e Mídias Sociais",
  "Literatura",
  "Itens e Equipamentos",
  "Diálogos",
  "Direito Empresarial",
  "Direito dos Contratos",
  "Direito Marítimo",
  "Biotecnologia",
  "Medicina",
  "Física Quantitativa",
  "Biologia",
  "Engenharia Genética",
];
export const tones = [
  "Neutro",
  "Formal",
  "Informal",
  "Humorístico / Sarcástico",
  "Irônico",
  "Gíria de Época",
  "Gírias/Humor",
];
const text = (max = 500) => z.string().trim().max(max);
const required = (max = 500) => text(max).min(1, "Preencha este campo.");
export const exampleSchema = z
  .object({
    original: required(2000),
    translation: required(2000),
    category: required(100),
  })
  .strict();
export const variationSchema = z
  .object({
    translation: required(2000),
    character: text(100).default(""),
    tone: required(100),
  })
  .strict();
export const noteSchema = z
  .object({
    kind: z.enum([
      "Comentário",
      "Nota explicativa",
      "Justificativa técnica",
      "Solução criativa",
    ]),
    text: required(5000),
  })
  .strict();
export const glossarySchema = z
  .object({
    name: required(150),
    client: required(150),
    sourceLang: z.enum(languages),
    targetLang: z.enum(languages),
  })
  .strict()
  .refine((v) => v.sourceLang !== v.targetLang, {
    message: "Selecione idiomas diferentes.",
    path: ["targetLang"],
  });
export const termSchema = z
  .object({
    original: required(),
    translation: required(2000),
    sourceLang: z.enum(languages),
    targetLang: z.enum(languages),
    glossaryId: z.string().max(100).nullable().default(null),
    project: text(150).default(""),
    category: required(100),
    tones: z.array(z.enum(tones)).max(7).default([]),
    tags: z.array(required(100)).max(20).default([]),
    work: text(200).default(""),
    intention: text(5000).default(""),
    justification: text(5000).default(""),
    official: z.boolean().default(false),
    source: text(2000).default(""),
    examples: z.array(exampleSchema).max(100).default([]),
    variations: z.array(variationSchema).max(100).default([]),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.sourceLang === v.targetLang)
      c.addIssue({
        code: "custom",
        path: ["targetLang"],
        message: "Selecione idiomas diferentes.",
      });
    if (v.official && !v.justification)
      c.addIssue({
        code: "custom",
        path: ["justification"],
        message:
          "Informe a justificativa legal/doutrinária do registro oficial.",
      });
    if (
      /^[a-z][a-z0-9+.-]*:/i.test(v.source) &&
      !/^https?:\/\//i.test(v.source)
    )
      c.addIssue({
        code: "custom",
        path: ["source"],
        message: "Use uma referência bibliográfica, DOI ou URL HTTP/HTTPS.",
      });
  });
export const fold = (v) =>
  v
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");
export class AppError extends Error {
  constructor(message, status = 400, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}
export function parse(schema, value) {
  const r = schema.safeParse(value);
  if (r.success) return r.data;
  const fields = {};
  for (const i of r.error.issues) fields[i.path[0] || "form"] = i.message;
  throw new AppError("Revise os campos indicados.", 422, fields);
}
