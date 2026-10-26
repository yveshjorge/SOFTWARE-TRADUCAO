export type Example = {
  original: string;
  translation: string;
  category: string;
};
export type Variation = {
  translation: string;
  character: string;
  tone: string;
};
export type Note = {
  id: string;
  kind: string;
  text: string;
  actor: string;
  updatedAt: string;
};
export type TermInput = {
  original: string;
  translation: string;
  sourceLang: string;
  targetLang: string;
  glossaryId: string | null;
  project: string;
  category: string;
  tones: string[];
  tags: string[];
  work: string;
  intention: string;
  justification: string;
  official: boolean;
  source: string;
  examples: Example[];
  variations: Variation[];
};
export type Term = TermInput & {
  id: string;
  version: number;
  notes: Note[];
  createdAt: string;
  updatedAt: string;
};
export type Glossary = {
  id: string;
  name: string;
  client: string;
  sourceLang: string;
  targetLang: string;
  count: number;
};
export type Meta = {
  categories: string[];
  tones: string[];
  languages: string[];
  projects: string[];
  works: string[];
  tags: string[];
  total: number;
  actor: string;
  token: string;
};
export type Version = {
  version: number;
  actor: string;
  at: string;
  action: string;
  snapshot: Term;
};
export const languageName: Record<string, string> = {
  en: "Inglês",
  "pt-BR": "Português (Brasil)",
  es: "Espanhol",
  fr: "Francês",
  de: "Alemão",
  it: "Italiano",
  ja: "Japonês",
};
export const emptyTerm: TermInput = {
  original: "",
  translation: "",
  sourceLang: "en",
  targetLang: "pt-BR",
  glossaryId: null,
  project: "",
  category: "Geral",
  tones: [],
  tags: [],
  work: "",
  intention: "",
  justification: "",
  official: false,
  source: "",
  examples: [],
  variations: [],
};
export function termInput(t: Term): TermInput {
  const { id, version, notes, createdAt, updatedAt, ...input } = t;
  return input;
}
export const date = (v: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(v));
