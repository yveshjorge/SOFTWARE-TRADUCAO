import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Copy,
  Download,
  FileText,
  History,
  MessageSquare,
  Plus,
  SquarePen,
} from "lucide-react";
import { api, download } from "./api";
import { ErrorBox, Field, Select, Textarea, Tags, Loading, Modal } from "./ui";
import {
  date,
  languageName,
  type Term,
  type Version,
  type Note,
} from "./types";
function Highlight({ text, word }: { text: string; word: string }) {
  const parts = text.split(
    new RegExp("(" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"),
  );
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === word.toLowerCase() ? <mark key={i}>{p}</mark> : p,
      )}
    </>
  );
}
function Source({ value }: { value: string }) {
  const url = /^https?:\/\//i.test(value)
    ? value
    : /^10\.\d{4,9}\//.test(value)
      ? "https://doi.org/" + value
      : null;
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {value} ↗
    </a>
  ) : (
    <span>{value || "Sem fonte vinculada"}</span>
  );
}
export function Detail({
  id,
  onBack,
  onEdit,
  notify,
  refresh,
}: {
  id: string;
  onBack: () => void;
  onEdit: (t: Term) => void;
  notify: (s: string) => void;
  refresh: number;
}) {
  const [term, setTerm] = useState<Term>();
  const [versions, setVersions] = useState<Version[]>([]);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("context");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState<Note | null | undefined>(undefined);
  const [legacy, setLegacy] = useState<Version>();
  async function load() {
    setError("");
    try {
      const [t, h] = await Promise.all([
        api<Term>("/terms/" + id),
        api<Version[]>("/terms/" + id + "/history"),
      ]);
      setTerm(t);
      setVersions(h);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    setTerm(undefined);
    void load();
  }, [id, refresh]);
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify("Tradução copiada.");
    } catch {
      setError(
        "Não foi possível copiar. Selecione a tradução e copie pelo teclado.",
      );
    }
  }
  async function report(v?: number) {
    try {
      await download(
        "/terms/" + id + "/report" + (v ? "?version=" + v : ""),
        `ficha-v${v || term?.version}.html`,
      );
      notify("Ficha de justificativa exportada.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!term)
    return (
      <>
        <ErrorBox message={error} />
        {error ? <button onClick={load}>Tentar novamente</button> : <Loading />}
      </>
    );
  return (
    <section className="detail">
      <button className="text-button" onClick={onBack}>
        <ArrowLeft size={18} />
        Voltar à biblioteca
      </button>
      <ErrorBox message={error} />
      <div className="detail-title">
        <div>
          <span className="eyebrow">
            {languageName[term.sourceLang]} → {languageName[term.targetLang]}
          </span>
          <h1>{term.original}</h1>
          <p className="translation">{term.translation}</p>
        </div>
        <div className="actions">
          <button onClick={() => copy(term.translation)}>
            <Copy size={16} />
            Copiar tradução
          </button>
          <button className="primary" onClick={() => onEdit(term)}>
            <SquarePen size={16} />
            Editar termo
          </button>
        </div>
      </div>
      <div className="detail-meta">
        <Tags values={[term.category, ...term.tones, ...term.tags]} />
        <span>
          Versão {term.version} · {date(term.updatedAt)} (Brasília)
        </span>
      </div>
      <nav className="detail-tabs" aria-label="Seções do termo">
        {[
          ["context", "Contexto", FileText],
          ["notes", `Notas (${term.notes.length})`, MessageSquare],
          ["history", `Histórico (${versions.length})`, History],
        ].map(([key, label, Icon]) => {
          const C = Icon as typeof FileText;
          return (
            <button
              key={key as string}
              className={tab === key ? "selected" : ""}
              aria-pressed={tab === key}
              onClick={() => setTab(key as string)}
            >
              <C size={17} />
              {label as string}
            </button>
          );
        })}
      </nav>
      {tab === "context" && (
        <div className="detail-grid">
          <div>
            <section className="panel">
              <div className="section-heading">
                <h2>Exemplos em contexto</h2>
                <button className="text-button" onClick={() => onEdit(term)}>
                  <Plus size={16} />
                  Adicionar um Exemplo
                </button>
              </div>
              {term.examples.length > 0 && (
                <Select
                  label="Área dos exemplos"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">Todas as áreas</option>
                  {[...new Set(term.examples.map((e) => e.category))].map(
                    (c) => (
                      <option key={c}>{c}</option>
                    ),
                  )}
                </Select>
              )}
              {!term.examples.length ? (
                <p className="muted">
                  Nenhum exemplo de contexto cadastrado para este termo
                </p>
              ) : (
                term.examples
                  .filter((e) => !category || e.category === category)
                  .map((e, i) => (
                    <blockquote key={i}>
                      <span className="eyebrow">{e.category}</span>
                      <p>
                        <Highlight text={e.original} word={term.original} />
                      </p>
                      <p className="muted">{e.translation}</p>
                    </blockquote>
                  ))
              )}
            </section>
            <section className="panel">
              <h2>Soluções e variações</h2>
              {term.intention && <p className="prewrap">{term.intention}</p>}
              {term.variations.length ? (
                term.variations.map((v, i) => (
                  <div className="variation" key={i}>
                    <div>
                      <strong>{v.translation}</strong>
                      <p>
                        {v.character || "Sem personagem"} · {v.tone}
                      </p>
                    </div>
                    <button
                      className="icon-button"
                      aria-label={`Copiar ${v.translation}`}
                      onClick={() => copy(v.translation)}
                    >
                      <Copy size={17} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="muted">
                  Ainda não há variações para esta expressão.
                </p>
              )}
            </section>
          </div>
          <aside>
            <section className="panel">
              <h2>Referência</h2>
              <Source value={term.source} />
              {!term.source && (
                <button className="text-button" onClick={() => onEdit(term)}>
                  Adicionar referência
                </button>
              )}
              <dl>
                <dt>Projeto / jogo</dt>
                <dd>{term.project || "Não informado"}</dd>
                <dt>Obra</dt>
                <dd>{term.work || "Não informada"}</dd>
                <dt>Cadastrado em</dt>
                <dd>{date(term.createdAt)}</dd>
              </dl>
            </section>
            <section className="panel">
              <h2>Justificativa</h2>
              {term.official && (
                <span className="stamp">
                  Registro interno fundamentado · v{term.version}
                </span>
              )}
              <p className="prewrap">
                {term.justification || "Nenhuma justificativa registrada."}
              </p>
              <button onClick={() => report()}>
                <Download size={16} />
                Gerar Ficha de Justificativa
              </button>
              <p className="hint">
                Histórico de alterações preservado para fins de auditoria. O
                registro não substitui certificação jurídica.
              </p>
            </section>
          </aside>
        </div>
      )}
      {tab === "notes" && (
        <section className="panel">
          <div className="section-heading">
            <h2>Notas do tradutor</h2>
            <button className="primary" onClick={() => setNote(null)}>
              <Plus size={16} />
              Adicionar nota
            </button>
          </div>
          {!term.notes.length && (
            <p className="muted">
              Registre o raciocínio por trás da sua escolha de tradução.
            </p>
          )}
          {term.notes.map((n) => (
            <article className="note" key={n.id}>
              <div className="section-heading">
                <strong>{n.kind}</strong>
                <button className="text-button" onClick={() => setNote(n)}>
                  Editar nota
                </button>
              </div>
              <p className="prewrap">{n.text}</p>
              <small>
                {n.actor} · {date(n.updatedAt)} (Brasília)
              </small>
            </article>
          ))}
        </section>
      )}
      {tab === "history" && (
        <section className="panel">
          <h2>Histórico de alterações</h2>
          <p className="muted">
            Cada atualização preserva o conteúdo anterior, o responsável e a
            data.
          </p>
          <ol className="timeline">
            {versions.map((v, i) => {
              const previous = versions[i + 1]?.snapshot;
              const keys = previous
                ? Object.keys(v.snapshot).filter(
                    (k) =>
                      !["version", "updatedAt"].includes(k) &&
                      JSON.stringify(v.snapshot[k as keyof Term]) !==
                        JSON.stringify(previous[k as keyof Term]),
                  )
                : [];
              const labels: Record<string, string> = {
                original: "Original",
                translation: "Tradução",
                category: "Área",
                justification: "Justificativa",
                source: "Fonte",
                notes: "Notas",
                examples: "Exemplos",
                variations: "Variações",
                tones: "Tom",
                project: "Projeto",
                tags: "Tags",
                work: "Obra",
                intention: "Intenção",
                glossaryId: "Glossário",
              };
              return (
                <li key={v.version}>
                  <div className="section-heading">
                    <h3>
                      Versão {v.version} · {v.action}
                    </h3>
                    <button onClick={() => setLegacy(v)}>
                      Consultar versão {v.version}
                    </button>
                  </div>
                  <small>
                    {v.actor} · {date(v.at)} (Brasília)
                  </small>
                  {previous &&
                    keys.map((k) => (
                      <div className="diff" key={k}>
                        <strong>{labels[k] || k}</strong>
                        <del>{formatValue(previous[k as keyof Term])}</del>
                        <ins>{formatValue(v.snapshot[k as keyof Term])}</ins>
                      </div>
                    ))}
                </li>
              );
            })}
          </ol>
        </section>
      )}
      {note !== undefined && (
        <NoteForm
          term={term}
          note={note}
          onClose={() => setNote(undefined)}
          onSaved={() => {
            setNote(undefined);
            notify("Nota salva. A versão anterior foi preservada.");
            void load();
          }}
        />
      )}
      {legacy && (
        <Modal
          title={`Versão ${legacy.version} — ${date(legacy.at)}`}
          onClose={() => setLegacy(undefined)}
          wide
        >
          <div className="modal-body">
            <h3>
              {legacy.snapshot.original} → {legacy.snapshot.translation}
            </h3>
            <p>
              {legacy.actor} · {legacy.action}
            </p>
            <dl className="snapshot">
              {Object.entries(legacy.snapshot)
                .filter(([k]) => !["id"].includes(k))
                .map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{formatValue(v)}</dd>
                  </div>
                ))}
            </dl>
            <button onClick={() => report(legacy.version)}>
              <Download size={16} />
              Exportar registro histórico
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
function formatValue(v: unknown): string {
  if (Array.isArray(v))
    return (
      v
        .map((x) =>
          typeof x === "object" ? Object.values(x as object).join(" · ") : x,
        )
        .join("\n") || "—"
    );
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  return String(v ?? "") || "—";
}
function NoteForm({
  term,
  note,
  onClose,
  onSaved,
}: {
  term: Term;
  note: Note | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState(note?.text || "");
  const [kind, setKind] = useState(note?.kind || "Comentário");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!text.trim()) {
      setError("Escreva a nota antes de salvar.");
      return;
    }
    setBusy(true);
    try {
      await api(
        "/terms/" + term.id + "/notes" + (note ? "/" + note.id : ""),
        { note: { kind, text }, version: term.version },
        note ? "PUT" : "POST",
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={note ? "Editar nota" : "Adicionar nota"}
      onClose={onClose}
      dirty={
        text !== (note?.text || "") || kind !== (note?.kind || "Comentário")
      }
      busy={busy}
    >
      <form noValidate onSubmit={save}>
        <div className="modal-body">
          <ErrorBox message={error} />
          <Select
            label="Tipo de nota"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {[
              "Comentário",
              "Nota explicativa",
              "Justificativa técnica",
              "Solução criativa",
            ].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </Select>
          <Textarea
            className="resize-none"
            label="Texto da nota *"
            value={text}
            maxLength={5000}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <footer className="modal-footer">
          <button className="primary" disabled={busy}>
            {busy ? "Salvando…" : "Salvar nota"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
