import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "./api";
import { Modal, Field, Select, Textarea, ErrorBox, CancelButton } from "./ui";
import {
  emptyTerm,
  termInput,
  languageName,
  type Term,
  type TermInput,
  type Glossary,
  type Meta,
} from "./types";
export function TermForm({
  term,
  initial,
  meta,
  glossaries,
  onClose,
  onSaved,
}: {
  term?: Term;
  initial?: Partial<TermInput>;
  meta: Meta;
  glossaries: Glossary[];
  onClose: () => void;
  onSaved: (t: Term) => void;
}) {
  const original = term ? termInput(term) : { ...emptyTerm, ...initial };
  const [v, setV] = useState<TermInput>(original);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const change = <K extends keyof TermInput>(key: K, value: TermInput[K]) => {
    setV((s) => ({ ...s, [key]: value }));
    setFields((s) => ({ ...s, [key]: "" }));
  };
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const f: Record<string, string> = {};
    for (const key of ["original", "translation"] as const)
      if (!v[key].trim()) f[key] = "Preencha este campo.";
    if (v.sourceLang === v.targetLang)
      f.targetLang = "Selecione idiomas diferentes.";
    if (v.official && !v.justification.trim())
      f.justification = "Informe a justificativa legal/doutrinária.";
    setFields(f);
    if (Object.keys(f).length) {
      setTimeout(() =>
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = { ...v, tags: v.tags.filter(Boolean) };
      const t = await api<Term>(
        term ? "/terms/" + term.id : "/terms",
        term ? { term: payload, version: term.version } : payload,
        term ? "PUT" : "POST",
      );
      onSaved(t);
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError) setFields(e.fields);
      setTimeout(() =>
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={term ? "Editar termo" : "Novo termo"}
      onClose={onClose}
      dirty={JSON.stringify(v) !== JSON.stringify(original)}
      busy={busy}
      wide
    >
      <form noValidate onSubmit={save}>
        <div className="modal-body">
          <p className="muted">
            Guarde a tradução e o contexto que tornam sua escolha única.
          </p>
          <ErrorBox message={error} />
          <div className="form-grid">
            <Field
              label="Termo original *"
              value={v.original}
              maxLength={500}
              error={fields.original}
              onChange={(e) => change("original", e.target.value)}
            />
            <Field
              label="Tradução *"
              value={v.translation}
              maxLength={2000}
              error={fields.translation}
              onChange={(e) => change("translation", e.target.value)}
            />
            <Select
              label="Idioma de origem"
              value={v.sourceLang}
              onChange={(e) => change("sourceLang", e.target.value)}
            >
              {meta.languages.map((l) => (
                <option key={l} value={l}>
                  {languageName[l]}
                </option>
              ))}
            </Select>
            <Select
              label="Idioma de destino"
              error={fields.targetLang}
              value={v.targetLang}
              onChange={(e) => change("targetLang", e.target.value)}
            >
              {meta.languages.map((l) => (
                <option key={l} value={l}>
                  {languageName[l]}
                </option>
              ))}
            </Select>
            <Select
              label="Área / categoria"
              value={v.category}
              onChange={(e) => change("category", e.target.value)}
            >
              {meta.categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <Select
              label="Glossário por cliente"
              error={fields.glossaryId}
              value={v.glossaryId || ""}
              onChange={(e) => {
                const g = glossaries.find((g) => g.id === e.target.value);
                setV((s) => ({
                  ...s,
                  glossaryId: g?.id || null,
                  sourceLang: g?.sourceLang || s.sourceLang,
                  targetLang: g?.targetLang || s.targetLang,
                }));
              }}
            >
              <option value="">Biblioteca geral</option>
              {glossaries.map((g) => (
                <option value={g.id} key={g.id}>
                  {g.client} · {g.name}
                </option>
              ))}
            </Select>
            <Field
              label="Projeto / jogo"
              value={v.project}
              maxLength={150}
              onChange={(e) => change("project", e.target.value)}
            />
            <Field
              label="Obra literária"
              value={v.work}
              maxLength={200}
              onChange={(e) => change("work", e.target.value)}
            />
          </div>
          <fieldset className="tone-picker">
            <legend>Tom e registro</legend>
            {meta.tones.map((t) => (
              <label key={t}>
                <input
                  type="checkbox"
                  checked={v.tones.includes(t)}
                  onChange={(e) =>
                    change(
                      "tones",
                      e.target.checked
                        ? [...v.tones, t]
                        : v.tones.filter((x) => x !== t),
                    )
                  }
                />
                {t}
              </label>
            ))}
          </fieldset>
          <div className="form-grid">
            <Field
              label="Tags adicionais (separe por vírgula)"
              value={v.tags.join(",")}
              onChange={(e) =>
                change(
                  "tags",
                  e.target.value.split(",").map((t) => t.trim()),
                )
              }
            />
            <Field
              label="Fonte / referência / DOI"
              value={v.source}
              error={fields.source}
              maxLength={2000}
              onChange={(e) => change("source", e.target.value)}
            />
            <Textarea
              className="resize-none"
              label="Intenção do autor / solução criativa"
              value={v.intention}
              maxLength={5000}
              onChange={(e) => change("intention", e.target.value)}
            />
            <label className="check wide">
              <input
                type="checkbox"
                checked={v.official}
                onChange={(e) => change("official", e.target.checked)}
              />
              Registro oficial com justificativa obrigatória
            </label>
            <Textarea
              className="resize-none"
              label="Justificativa legal/doutrinária"
              value={v.justification}
              error={fields.justification}
              maxLength={5000}
              onChange={(e) => change("justification", e.target.value)}
            />
          </div>
          <p className="hint">
            O selo identifica um registro interno com fundamentação. Não é uma
            certificação jurídica.
          </p>
          <section className="repeater">
            <div className="section-heading">
              <h3>Exemplos em contexto</h3>
              <button
                type="button"
                onClick={() =>
                  change("examples", [
                    ...v.examples,
                    { original: "", translation: "", category: v.category },
                  ])
                }
              >
                <Plus size={16} />
                Adicionar um Exemplo
              </button>
            </div>
            {v.examples.map((x, i) => (
              <div className="repeat-row" key={i}>
                <Field
                  label={`Exemplo ${i + 1}: original`}
                  value={x.original}
                  onChange={(e) =>
                    change(
                      "examples",
                      v.examples.map((a, j) =>
                        j === i ? { ...a, original: e.target.value } : a,
                      ),
                    )
                  }
                />
                <Field
                  label={`Exemplo ${i + 1}: tradução`}
                  value={x.translation}
                  onChange={(e) =>
                    change(
                      "examples",
                      v.examples.map((a, j) =>
                        j === i ? { ...a, translation: e.target.value } : a,
                      ),
                    )
                  }
                />
                <Select
                  label={`Exemplo ${i + 1}: área`}
                  value={x.category}
                  onChange={(e) =>
                    change(
                      "examples",
                      v.examples.map((a, j) =>
                        j === i ? { ...a, category: e.target.value } : a,
                      ),
                    )
                  }
                >
                  {meta.categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remover exemplo ${i + 1}`}
                  onClick={() =>
                    change(
                      "examples",
                      v.examples.filter((_, j) => j !== i),
                    )
                  }
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            <ErrorBox message={fields.examples || ""} />
          </section>
          <section className="repeater">
            <div className="section-heading">
              <h3>Variações de personagem / tom</h3>
              <button
                type="button"
                onClick={() =>
                  change("variations", [
                    ...v.variations,
                    { translation: "", character: "", tone: "Neutro" },
                  ])
                }
              >
                <Plus size={16} />
                Adicionar variação
              </button>
            </div>
            {v.variations.map((x, i) => (
              <div className="repeat-row" key={i}>
                <Field
                  label={`Variação ${i + 1}: tradução`}
                  value={x.translation}
                  onChange={(e) =>
                    change(
                      "variations",
                      v.variations.map((a, j) =>
                        j === i ? { ...a, translation: e.target.value } : a,
                      ),
                    )
                  }
                />
                <Field
                  label={`Variação ${i + 1}: personagem`}
                  value={x.character}
                  onChange={(e) =>
                    change(
                      "variations",
                      v.variations.map((a, j) =>
                        j === i ? { ...a, character: e.target.value } : a,
                      ),
                    )
                  }
                />
                <Select
                  label={`Variação ${i + 1}: tom`}
                  value={x.tone}
                  onChange={(e) =>
                    change(
                      "variations",
                      v.variations.map((a, j) =>
                        j === i ? { ...a, tone: e.target.value } : a,
                      ),
                    )
                  }
                >
                  {meta.tones.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remover variação ${i + 1}`}
                  onClick={() =>
                    change(
                      "variations",
                      v.variations.filter((_, j) => j !== i),
                    )
                  }
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            <ErrorBox message={fields.variations || ""} />
          </section>
        </div>
        <footer className="modal-footer">
          <span className="hint">
            {term
              ? "A versão anterior será preservada."
              : "* Campos obrigatórios"}
          </span>
          <CancelButton busy={busy} />
          <button className="primary" disabled={busy} type="submit">
            {busy
              ? "Salvando…"
              : v.work && v.intention
                ? "Salvar Solução Criativa"
                : v.official
                  ? "Salvar Registro Oficial"
                  : "Salvar Registro"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export function GlossaryForm({
  meta,
  onClose,
  onSaved,
}: {
  meta: Meta;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initial = {
    name: "",
    client: "",
    sourceLang: "en",
    targetLang: "pt-BR",
  };
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/glossaries", v);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError) setFields(e.fields);
      setTimeout(() =>
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Criar Glossário por Cliente"
      dirty={JSON.stringify(v) !== JSON.stringify(initial)}
      busy={busy}
      onClose={onClose}
    >
      <form noValidate onSubmit={submit}>
        <div className="modal-body">
          <ErrorBox message={error} />
          <div className="form-grid">
            <Field
              label="Nome do glossário *"
              value={v.name}
              error={fields.name}
              onChange={(e) => setV({ ...v, name: e.target.value })}
            />
            <Field
              label="Cliente *"
              value={v.client}
              error={fields.client}
              onChange={(e) => setV({ ...v, client: e.target.value })}
            />
            {(["sourceLang", "targetLang"] as const).map((k, i) => (
              <Select
                key={k}
                label={i ? "Idioma de destino" : "Idioma de origem"}
                value={v[k]}
                error={fields[k]}
                onChange={(e) => setV({ ...v, [k]: e.target.value })}
              >
                {meta.languages.map((l) => (
                  <option value={l} key={l}>
                    {languageName[l]}
                  </option>
                ))}
              </Select>
            ))}
          </div>
        </div>
        <footer className="modal-footer">
          <button type="submit" className="primary" disabled={busy}>
            {busy ? "Salvando…" : "Criar glossário"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
