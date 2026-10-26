import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen,
  Library,
  Search,
  Plus,
  Upload,
  Download,
  ArrowUpRight,
  ArrowRight,
  MessageSquare,
  SlidersHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { api, setToken, download } from "./api";
import { Loading, ErrorBox, Tags, Select, Modal } from "./ui";
import { TermForm, GlossaryForm } from "./forms";
import { Detail } from "./Detail";
import { ImportForm } from "./Import";
import {
  languageName,
  type Meta,
  type Glossary,
  type Term,
  type TermInput,
} from "./types";
import "./styles.css";
const readRoute = () => new URLSearchParams(location.search);
function App() {
  const [route, setRoute] = useState(readRoute);
  const [meta, setMeta] = useState<Meta>();
  const [glossaries, setGlossaries] = useState<Glossary[]>([]);
  const [result, setResult] = useState<{
    items: Term[];
    total: number;
    page: number;
    pageSize: number;
  }>({ items: [], total: 0, page: 1, pageSize: 12 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [query, setQuery] = useState(route.get("q") || "");
  const [composing, setComposing] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<Term | "new">();
  const [glossaryForm, setGlossaryForm] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportFormat, setExportFormat] = useState("csv");
  const [showFilters, setShowFilters] = useState(false);
  const view = route.get("view") || "library";
  const id = route.get("term");
  const selectedGlossary = glossaries.find(
    (g) => g.id === route.get("glossaryId"),
  );
  function navigate(next: URLSearchParams, replace = false) {
    const url = next.size ? "?" + next.toString() : location.pathname;
    history[replace ? "replaceState" : "pushState"]({}, "", url);
    setRoute(new URLSearchParams(next));
    setQuery(next.get("q") || "");
  }
  function filter(key: string, value: string | string[]) {
    const next = new URLSearchParams(route);
    next.delete("page");
    next.delete(key);
    if (Array.isArray(value)) value.forEach((v) => next.append(key, v));
    else if (value) next.set(key, value);
    navigate(next);
  }
  function notify(s: string) {
    setNotice(s);
  }
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    const pop = () => {
      setRoute(readRoute());
      setQuery(readRoute().get("q") || "");
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    document.title = id
      ? "Termo · Léxica"
      : view === "glossaries"
        ? "Glossários · Léxica"
        : "Biblioteca · Léxica";
  }, [id, view]);
  useEffect(() => {
    let active = true;
    Promise.all([api<Meta>("/meta"), api<Glossary[]>("/glossaries")])
      .then(([m, g]) => {
        if (active) {
          setMeta(m);
          setToken(m.token);
          setGlossaries(g);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [refresh]);
  useEffect(() => {
    if (composing || query === (route.get("q") || "")) return;
    const t = setTimeout(() => filter("q", query), 300);
    return () => clearTimeout(t);
  }, [query, composing]);
  useEffect(() => {
    if (id || view !== "library") return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams(route);
    params.delete("view");
    api<typeof result>("/terms?" + params, undefined, "GET", controller.signal)
      .then(setResult)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [route.toString(), refresh]);
  const reset = () => {
    const next = new URLSearchParams();
    navigate(next);
  };
  const back = () => {
    const next = new URLSearchParams(route);
    next.delete("term");
    navigate(next);
  };
  function openTerm(t: Term) {
    const next = new URLSearchParams(route);
    next.set("term", t.id);
    navigate(next);
  }
  async function doExport() {
    if (exportBusy) return;
    setExportBusy(true);
    try {
      const p = new URLSearchParams(route);
      p.set("format", exportFormat);
      await download("/export?" + p, "lexica." + exportFormat);
      setExporting(false);
      notify("Arquivo exportado com os filtros selecionados.");
    } catch (e) {
      setError((e as Error).message);
      setExporting(false);
    } finally {
      setExportBusy(false);
    }
  }
  const activeFilters = [...route.entries()].filter(
    ([k]) => !["view", "term", "page", "q", "sort"].includes(k),
  );
  if (!meta)
    return (
      <div className="startup">
        <BookOpen size={44} />
        <h1>Léxica</h1>
        <ErrorBox message={error} />
        {error ? (
          <button onClick={() => setRefresh((x) => x + 1)}>
            Tentar novamente
          </button>
        ) : (
          <Loading />
        )}
      </div>
    );
  const initial: Partial<TermInput> = {
    glossaryId: selectedGlossary?.id || null,
    sourceLang: selectedGlossary?.sourceLang || "en",
    targetLang: selectedGlossary?.targetLang || "pt-BR",
    category: route.get("category") || "Geral",
    project: route.get("project") || "",
    original: route.get("q") || "",
  };
  return (
    <div className="app-shell">
      <a className="skip" href="#main">
        Ir para o conteúdo
      </a>
      <aside className="sidebar">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            reset();
          }}
        >
          <span className="brand-mark">
            <BookOpen size={27} />
          </span>
          <span>
            Léxica<small>MEMÓRIA DE TRADUÇÃO</small>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-avatar">L</span>
          <div>
            Meu espaço de tradução<small>Biblioteca pessoal</small>
          </div>
        </div>
        <nav aria-label="Navegação principal">
          <button
            className={view === "library" ? "nav-item active" : "nav-item"}
            onClick={reset}
          >
            <Library size={19} />
            Biblioteca por idioma<span>{meta.total}</span>
          </button>
          <button
            className={view === "glossaries" ? "nav-item active" : "nav-item"}
            onClick={() =>
              navigate(new URLSearchParams({ view: "glossaries" }))
            }
          >
            <BookOpen size={19} />
            Glossários por cliente
          </button>
          <button className="nav-item" onClick={() => setImporting(true)}>
            <Upload size={19} />
            Importar termos
          </button>
        </nav>
        <div className="sidebar-note">
          <span className="eyebrow">CADA PALAVRA TEM CONTEXTO</span>
          <p>
            Suas escolhas de hoje.
            <br />
            Sua memória de amanhã.
          </p>
          <div className="pair-glyph">
            <span>A</span>
            <ArrowRight size={20} />
            <span>あ</span>
          </div>
        </div>
        <div className="profile">
          <span className="avatar">TL</span>
          <div>
            {meta.actor}
            <small>Armazenamento local</small>
          </div>
          <span className="online" aria-hidden="true" />
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <span>
            <span className="muted">Meu espaço</span>
            <span className="slash">/</span>
            {view === "glossaries" ? "Glossários" : "Biblioteca por idioma"}
          </span>
          <span className="local-badge">Dados neste computador</span>
        </header>
        <main id="main" tabIndex={-1}>
          {id ? (
            <Detail
              key={id}
              id={id}
              onBack={back}
              onEdit={setForm}
              notify={notify}
              refresh={refresh}
            />
          ) : view === "glossaries" ? (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">CONSISTÊNCIA ENTRE PROJETOS</span>
                  <h1>Glossários por cliente</h1>
                  <p>Um vocabulário próprio para cada parceria.</p>
                </div>
                <button
                  className="primary"
                  onClick={() => setGlossaryForm(true)}
                >
                  <Plus size={18} />
                  Criar Glossário por Cliente
                </button>
              </div>
              <ErrorBox message={error} />
              <div className="glossary-grid">
                {glossaries.map((g) => (
                  <article className="glossary-card" key={g.id}>
                    <BookOpen size={25} />
                    <span className="eyebrow">{g.client}</span>
                    <h2>{g.name}</h2>
                    <p>
                      {languageName[g.sourceLang]} →{" "}
                      {languageName[g.targetLang]}
                    </p>
                    <div className="section-heading">
                      <span>{g.count} termos</span>
                      <button
                        onClick={() =>
                          navigate(new URLSearchParams({ glossaryId: g.id }))
                        }
                      >
                        Abrir glossário <ArrowUpRight size={16} />
                      </button>
                    </div>
                    <button
                      className="text-button"
                      disabled={!g.count}
                      onClick={async () => {
                        try {
                          await download(
                            "/export?glossaryId=" + g.id + "&format=csv",
                            "glossario.csv",
                          );
                          notify("Glossário exportado.");
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      <Download size={16} />
                      Exportar Glossário
                    </button>
                  </article>
                ))}
              </div>
              {!glossaries.length && (
                <div className="empty">
                  <BookOpen size={35} />
                  <h2>Seu primeiro glossário começa aqui</h2>
                  <p>
                    Crie um glossário para organizar a terminologia de um
                    cliente.
                  </p>
                  <button onClick={() => setGlossaryForm(true)}>
                    Criar glossário
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    SEU REPERTÓRIO, SEMPRE POR PERTO
                  </span>
                  <h1>
                    {selectedGlossary
                      ? selectedGlossary.name
                      : "As palavras certas."}
                  </h1>
                  <p>
                    {selectedGlossary
                      ? selectedGlossary.client +
                        " · Terminologia exclusiva deste cliente"
                      : "Encontre traduções, preserve nuances e registre o seu raciocínio."}
                  </p>
                </div>
                <div className="actions">
                  <button
                    onClick={() => setExporting(true)}
                    disabled={!result.total || loading}
                  >
                    <Download size={17} />
                    Exportar Memória
                  </button>
                  <button className="primary" onClick={() => setForm("new")}>
                    <Plus size={19} />
                    Novo termo
                  </button>
                </div>
              </div>
              <div className="searchbar">
                <Search size={21} />
                <input
                  ref={searchRef}
                  aria-label="Buscar termos"
                  placeholder="Busque um termo, uma tradução ou uma expressão…"
                  value={query}
                  onCompositionStart={() => setComposing(true)}
                  onCompositionEnd={() => setComposing(false)}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !composing) filter("q", query);
                  }}
                />
                {query && (
                  <button
                    aria-label="Limpar busca"
                    className="icon-button"
                    onClick={() => {
                      filter("q", "");
                      searchRef.current?.focus();
                    }}
                  >
                    <X size={18} />
                  </button>
                )}
                <button
                  className="filter-toggle"
                  aria-expanded={showFilters}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <SlidersHorizontal size={17} />
                  Filtros
                </button>
              </div>
              <div className="library-layout">
                <aside
                  className={"filters " + (showFilters ? "filters-open" : "")}
                  aria-label="Filtros da biblioteca"
                >
                  <div className="section-heading">
                    <h2>Refinar biblioteca</h2>
                    {activeFilters.length > 0 && (
                      <button className="text-button" onClick={reset}>
                        Limpar
                      </button>
                    )}
                  </div>
                  <Select
                    label="Idioma de origem"
                    value={route.get("sourceLang") || ""}
                    onChange={(e) => filter("sourceLang", e.target.value)}
                  >
                    <option value="">Todos os idiomas</option>
                    {meta.languages.map((l) => (
                      <option key={l} value={l}>
                        {languageName[l]}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label="Cliente / glossário"
                    value={route.get("glossaryId") || ""}
                    onChange={(e) => filter("glossaryId", e.target.value)}
                  >
                    <option value="">Todos os glossários</option>
                    {glossaries.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.client} · {g.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label="Projeto / jogo"
                    value={route.get("project") || ""}
                    onChange={(e) => filter("project", e.target.value)}
                  >
                    <option value="">Todos os projetos</option>
                    {meta.projects.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </Select>
                  <Select
                    label="Obra"
                    value={route.get("work") || ""}
                    onChange={(e) => filter("work", e.target.value)}
                  >
                    <option value="">Todas as obras</option>
                    {meta.works.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </Select>
                  {[
                    ["category", "Áreas do conhecimento", meta.categories],
                    ["tones", "Tom e registro", meta.tones],
                    ["tags", "Tags", meta.tags],
                  ].map(([key, label, values]) => (
                    <fieldset key={key as string}>
                      <legend>{label as string}</legend>
                      <div className="filter-options">
                        {(values as string[]).map((v) => (
                          <label key={v}>
                            <input
                              type="checkbox"
                              checked={route.getAll(key as string).includes(v)}
                              onChange={(e) =>
                                filter(
                                  key as string,
                                  e.target.checked
                                    ? [...route.getAll(key as string), v]
                                    : route
                                        .getAll(key as string)
                                        .filter((x) => x !== v),
                                )
                              }
                            />
                            <span>{v}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </aside>
                <section
                  className="results"
                  aria-label="Resultados da biblioteca"
                >
                  <div className="results-toolbar">
                    <p aria-live="polite">
                      <strong>{result.total}</strong>{" "}
                      {result.total === 1
                        ? "termo encontrado"
                        : "termos encontrados"}
                    </p>
                    <Select
                      label="Ordenar por"
                      value={route.get("sort") || "recent"}
                      onChange={(e) => filter("sort", e.target.value)}
                    >
                      <option value="recent">Mais recentes</option>
                      <option value="alpha">Ordem alfabética</option>
                    </Select>
                  </div>
                  {activeFilters.length > 0 && (
                    <div className="filter-chips">
                      {activeFilters.map(([k, v]) => (
                        <button
                          key={k + v}
                          aria-label={`Remover filtro ${v}`}
                          onClick={() =>
                            filter(
                              k,
                              route.getAll(k).filter((x) => x !== v),
                            )
                          }
                        >
                          {k === "glossaryId"
                            ? glossaries.find((g) => g.id === v)?.client
                            : languageName[v] || v}
                          <X size={13} />
                        </button>
                      ))}
                    </div>
                  )}
                  <ErrorBox message={error} />
                  {error && (
                    <button onClick={() => setRefresh((r) => r + 1)}>
                      Tentar novamente
                    </button>
                  )}
                  {loading ? (
                    <Loading />
                  ) : !result.items.length ? (
                    <div className="empty">
                      <Search size={34} />
                      <h2>Nenhum termo encontrado</h2>
                      <p>
                        {route.get("category")?.startsWith("Direito")
                          ? "Nenhum termo cadastrado nesta área jurídica"
                          : route.getAll("tones").includes("Gírias/Humor")
                            ? "Nenhum termo encontrado com a tag 'Gírias/Humor' neste projeto"
                            : query
                              ? `Nenhum termo correspondente encontrado para '${query}'${route.get("project") ? " neste jogo" : ""}`
                              : "A biblioteca está pronta para receber suas primeiras traduções."}
                      </p>
                      <div className="actions">
                        <button onClick={reset}>Limpar filtros</button>
                        <button
                          className="primary"
                          onClick={() => setForm("new")}
                        >
                          Cadastrar novo termo nesta área
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="term-list">
                      {result.items.map((t) => (
                        <article className="term-card" key={t.id}>
                          <div className="term-content">
                            <div className="card-overline">
                              <span>
                                {t.sourceLang.toUpperCase()}
                                <ArrowRight size={12} />
                                {t.targetLang.toUpperCase()}
                              </span>
                              <span>{t.category}</span>
                            </div>
                            <button
                              className="term-title"
                              onClick={() => openTerm(t)}
                            >
                              <strong>{t.original}</strong>
                              <ArrowRight size={18} />
                              <span>{t.translation}</span>
                            </button>
                            <Tags values={[...t.tones, ...t.tags]} />
                            <div className="card-foot">
                              <span>
                                {t.project || t.work || "Biblioteca geral"}
                              </span>
                              {t.notes.length > 0 && (
                                <span>
                                  <MessageSquare size={13} />
                                  {t.notes.length}{" "}
                                  {t.notes.length === 1 ? "nota" : "notas"}
                                </span>
                              )}
                              {t.source && <span>Fonte vinculada</span>}
                            </div>
                          </div>
                          <button
                            className="open-term"
                            aria-label={`Ver detalhes de ${t.original}`}
                            onClick={() => openTerm(t)}
                          >
                            <ArrowUpRight size={21} />
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                  <div className="pagination">
                    <span>
                      Página {result.page} de{" "}
                      {Math.max(1, Math.ceil(result.total / result.pageSize))}
                    </span>
                    <div className="actions">
                      <button
                        aria-label="Página anterior"
                        disabled={loading || result.page <= 1}
                        onClick={() => {
                          const p = new URLSearchParams(route);
                          p.set("page", String(result.page - 1));
                          navigate(p);
                        }}
                      >
                        <ChevronLeft size={17} />
                      </button>
                      <button
                        aria-label="Próxima página"
                        disabled={
                          loading ||
                          result.page * result.pageSize >= result.total
                        }
                        onClick={() => {
                          const p = new URLSearchParams(route);
                          p.set("page", String(result.page + 1));
                          navigate(p);
                        }}
                      >
                        <ChevronRight size={17} />
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </>
          )}
        </main>
        <footer className="app-footer">
          Léxica · Traduções com memória.
          <span>
            Dados de exemplo podem ser editados. Nenhum serviço de tradução
            automática é usado.
          </span>
        </footer>
      </div>
      <div
        role="status"
        aria-live="polite"
        className={notice ? "toast visible" : "toast"}
      >
        {notice && (
          <>
            <CheckCircle2 size={18} />
            {notice}
            <button aria-label="Fechar aviso" onClick={() => setNotice("")}>
              <X size={16} />
            </button>
          </>
        )}
      </div>
      {form && (
        <TermForm
          term={form === "new" ? undefined : form}
          initial={initial}
          meta={meta}
          glossaries={glossaries}
          onClose={() => setForm(undefined)}
          onSaved={(t) => {
            setForm(undefined);
            setRefresh((x) => x + 1);
            notify(
              form === "new"
                ? "Termo salvo na biblioteca."
                : "Termo atualizado. Histórico de alterações preservado para fins de auditoria.",
            );
            if (!id) {
              const next = new URLSearchParams(route);
              next.delete("q");
              next.delete("page");
              navigate(next);
            }
          }}
        />
      )}
      {glossaryForm && (
        <GlossaryForm
          meta={meta}
          onClose={() => setGlossaryForm(false)}
          onSaved={() => {
            setGlossaryForm(false);
            setRefresh((x) => x + 1);
            notify("Glossário criado com sucesso!");
          }}
        />
      )}
      {importing && (
        <ImportForm
          meta={meta}
          glossaries={glossaries}
          onClose={() => setImporting(false)}
          onSaved={(s) => {
            setImporting(false);
            setRefresh((x) => x + 1);
            notify(s);
          }}
        />
      )}
      {exporting && (
        <Modal
          title="Exportar Memória"
          onClose={() => setExporting(false)}
          busy={exportBusy}
        >
          <div className="modal-body">
            <p>
              A exportação incluirá os <strong>{result.total} termos</strong>{" "}
              que correspondem aos filtros atuais, em todas as páginas.
            </p>
            <Select
              label="Formato do arquivo"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
            >
              <option value="csv">CSV · planilhas e glossários</option>
              <option value="tmx">TMX · ferramentas de tradução</option>
            </Select>
            <p className="hint">
              CSV inclui notas e referências. TMX inclui pares de idiomas,
              termos e contexto de projeto.
            </p>
          </div>
          <footer className="modal-footer">
            <button
              className="primary"
              onClick={doExport}
              disabled={exportBusy}
            >
              {exportBusy ? "Exportando…" : "Confirmar Exportação"}
            </button>
          </footer>
        </Modal>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
