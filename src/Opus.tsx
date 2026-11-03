import { useEffect, useState } from "react";
import { api } from "./api";
import { Field, ErrorBox, Loading, Textarea } from "./ui";

type Dataset = {
  id: string;
  corpus: string;
  version: string;
  source: string;
  target: string;
  estimatedPairs: number;
  downloadUrl: string;
};
type Job = Dataset & {
  status: "importing" | "ready" | "failed";
  importedPairs: number;
  maxPairs: number;
  coverage?: string;
  sampleMethod?: string | null;
  error?: string;
};
type Suggestion = {
  original: string;
  translation: string;
  corpus: string;
  version: string;
  match: string;
  sourceUrl: string;
  datasetId: string;
  coverage?: string;
  sampleMethod?: string;
};
type SegmentResult = { segment: string; suggestions: Suggestion[] };
export function Opus() {
  const [source, setSource] = useState("en"),
    [target, setTarget] = useState("pt");
  const [corpus, setCorpus] = useState("Europarl"),
    [maxPairs, setMaxPairs] = useState("10000");
  const [datasets, setDatasets] = useState<Dataset[]>([]),
    [jobs, setJobs] = useState<Job[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]),
    [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [draftResults, setDraftResults] = useState<SegmentResult[]>([]);
  const [draftError, setDraftError] = useState(""),
    [draftNotice, setDraftNotice] = useState("");
  const [catalogError, setCatalogError] = useState(""),
    [searchError, setSearchError] = useState(""),
    [importError, setImportError] = useState(""),
    [jobError, setJobError] = useState("");
  const [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [searched, setSearched] = useState(false);
  const [tick, setTick] = useState(0);
  const importing = jobs.some((j) => j.status === "importing");
  useEffect(() => {
    const abort = new AbortController();
    api<{ items: Job[] }>("/opus/imports", undefined, "GET", abort.signal)
      .then((r) => {
        setJobs(r.items);
        setJobError("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") setJobError(e.message);
      });
    return () => abort.abort();
  }, [tick]);
  useEffect(() => {
    if (!importing) return;
    const timer = setInterval(() => setTick((n) => n + 1), 1500);
    return () => clearInterval(timer);
  }, [importing]);
  function change(setter: (v: string) => void, value: string) {
    setter(value);
    setDatasets([]);
    setLoaded(false);
    setSuggestions([]);
    setSearched(false);
  }
  async function catalog() {
    setBusy(true);
    setCatalogError("");
    setLoaded(false);
    setDatasets([]);
    try {
      const r = await api<{ items: Dataset[] }>(
        "/opus/datasets?" + new URLSearchParams({ source, target, corpus }),
      );
      setDatasets(r.items);
      setLoaded(true);
    } catch (e) {
      setCatalogError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function start(dataset: Dataset) {
    setBusy(true);
    setImportError("");
    try {
      const job = await api<Job>("/opus/imports", {
        ...dataset,
        datasetId: dataset.id,
        maxPairs: Number(maxPairs),
      });
      setJobs((old) => [job, ...old.filter((x) => x.id !== job.id)]);
      setTick((n) => n + 1);
    } catch (e) {
      setImportError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function search() {
    setBusy(true);
    setSearchError("");
    setSearched(false);
    setSuggestions([]);
    try {
      const r = await api<{ items: Suggestion[] }>(
        "/translation-memory/suggestions?" +
          new URLSearchParams({ source, target, corpus, q }),
      );
      setSuggestions(r.items);
      setSearched(true);
    } catch (e) {
      setSearchError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function reviewText() {
    setDraftError("");
    setDraftNotice("");
    setDraftResults([]);
    const lines = draft
      .split(/\n+/u)
      .map((line) => line.trim())
      .filter(Boolean);
    let segments: string[];
    try {
      segments = lines.flatMap((line) =>
        Array.from(
          new Intl.Segmenter(source, { granularity: "sentence" }).segment(line),
          (part) => part.segment.trim(),
        ).filter(Boolean),
      );
    } catch {
      // Fall back to one paragraph per line in browsers with no Segmenter locale.
      segments = lines;
    }
    if (!segments.length) {
      setDraftError("Cole pelo menos uma frase para revisar.");
      return;
    }
    if (segments.length > 30) {
      setDraftError(
        `O texto gerou ${segments.length} trechos. Revise até 30 por vez.`,
      );
      return;
    }
    if (segments.some((part) => part.length > 2000)) {
      setDraftError(
        "Uma frase ultrapassa 2.000 caracteres. Divida-a antes da busca.",
      );
      return;
    }
    setBusy(true);
    try {
      const response = await api<{ items: SegmentResult[] }>(
        "/translation-memory/suggestions/batch",
        { source, target, corpus, segments },
      );
      setDraftResults(response.items);
    } catch (e) {
      setDraftError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function copyTranslation(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setDraftError("");
      setDraftNotice("Sugestão copiada para a área de transferência.");
    } catch {
      setDraftError(
        "Não foi possível copiar automaticamente. Selecione e copie a sugestão.",
      );
    }
  }
  return (
    <div className="opus-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">REFERÊNCIAS PARA SUAS ESCOLHAS</span>
          <h1>Memórias do OPUS</h1>
          <p>
            Explore coleções bilíngues e consulte uma amostra neste computador.
          </p>
        </div>
      </div>
      <section className="opus-section" aria-labelledby="opus-online">
        <h2 id="opus-online">Consultar online</h2>
        <p>
          Pesquise no site do OPUS sem importar uma base. Os links abrem uma
          nova aba; seu texto não é enviado automaticamente.
        </p>
        <div className="actions">
          <a
            href="https://opus.nlpl.eu/bin/opuscqp.pl"
            target="_blank"
            rel="noreferrer"
          >
            Abrir consulta OPUS ↗
          </a>
          <a
            href="https://opus.nlpl.eu/explore/"
            target="_blank"
            rel="noreferrer"
          >
            Explorar coleções ↗
          </a>
        </div>
      </section>
      <section className="opus-section" aria-labelledby="opus-catalog">
        <h2 id="opus-catalog">Preparar uma amostra local</h2>
        <p>
          Por padrão, até 10.000 pares do início do arquivo. A amostra funciona
          sem internet após a importação. A disponibilidade e a licença variam
          por coleção; confira as condições da coleção antes de usar.
        </p>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!e.currentTarget.reportValidity()) return;
            void catalog();
          }}
        >
          <div className="opus-fields">
            <Field
              label="Idioma de origem"
              value={source}
              disabled={busy}
              required
              pattern="[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*"
              onChange={(e) => change(setSource, e.target.value)}
            />
            <Field
              label="Idioma de destino"
              value={target}
              disabled={busy}
              required
              pattern="[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*"
              onChange={(e) => change(setTarget, e.target.value)}
            />
            <Field
              label="Coleção (vazio = todas)"
              value={corpus}
              list="opus-corpora"
              disabled={busy}
              onChange={(e) => change(setCorpus, e.target.value)}
            />
            <datalist id="opus-corpora">
              <option value="Europarl" />
              <option value="MultiUN" />
              <option value="DGT" />
            </datalist>
            <Field
              label="Limite de pares"
              type="number"
              min={1}
              max={100000}
              step={1}
              required
              value={maxPairs}
              disabled={busy}
              onChange={(e) => setMaxPairs(e.target.value)}
            />
          </div>
          <button className="primary" disabled={busy}>
            Buscar coleções disponíveis
          </button>
          <ErrorBox message={catalogError} />
        </form>
        {loaded && !datasets.length && (
          <p role="status">
            Nenhum TMX disponível para essa coleção e par de idiomas. Tente
            outra coleção.
          </p>
        )}
        <ErrorBox message={importError} />
        <div className="opus-list">
          {datasets.map((d) => (
            <article key={d.id} className="opus-row">
              <div>
                <h3>
                  {d.corpus} · {d.version}
                </h3>
                <p>
                  {d.source} → {d.target} ·{" "}
                  {d.estimatedPairs.toLocaleString("pt-BR")} pares na base
                  completa
                </p>
                <a href={d.downloadUrl} target="_blank" rel="noreferrer">
                  Arquivo de origem ↗
                </a>
              </div>
              <button
                disabled={
                  busy ||
                  importing ||
                  !Number.isInteger(Number(maxPairs)) ||
                  Number(maxPairs) < 1 ||
                  Number(maxPairs) > 100000
                }
                onClick={() => void start(d)}
              >
                Importar até {Number(maxPairs).toLocaleString("pt-BR")} pares
              </button>
            </article>
          ))}
        </div>
      </section>
      <section className="opus-section" aria-labelledby="opus-saved">
        <div className="section-heading">
          <h2 id="opus-saved">Memórias neste computador</h2>
          <button onClick={() => setTick((n) => n + 1)}>Atualizar</button>
        </div>
        <ErrorBox message={jobError} />
        {!jobs.length && !jobError && <p>Nenhuma memória importada ainda.</p>}
        <div className="opus-list" aria-live="polite">
          {jobs.map((j) => (
            <article key={j.id} className="opus-row">
              <div>
                <h3>
                  {j.corpus} · {j.source} → {j.target}
                </h3>
                <p>
                  {j.status === "importing"
                    ? `Importando: ${j.importedPairs.toLocaleString("pt-BR")} pares salvos…`
                    : j.status === "failed"
                      ? j.error
                      : `${j.importedPairs.toLocaleString("pt-BR")} pares disponíveis · ${j.sampleMethod === "beginning" ? "Amostra do início do arquivo" : j.coverage === "sample" ? "Amostra limitada" : "Arquivo completo"}`}
                </p>
                {j.status === "failed" && (
                  <small>
                    Busque a coleção novamente e repita a importação.
                  </small>
                )}
              </div>
              <span className="tag">
                {j.status === "ready"
                  ? "Disponível offline"
                  : j.status === "failed"
                    ? "Falhou"
                    : "Em andamento"}
              </span>
            </article>
          ))}
        </div>
      </section>
      <section className="opus-section" aria-labelledby="opus-workbench">
        <h2 id="opus-workbench">Revisar um texto com as memórias locais</h2>
        <p>
          Cole o texto para procurar correspondências por frase. A busca fica
          neste computador; cada resultado mostra a coleção e a origem para
          conferência. Você decide se quer copiar uma sugestão.
        </p>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!e.currentTarget.reportValidity()) return;
            void reviewText();
          }}
        >
          <Textarea
            className="resize-none"
            label="Texto para revisar"
            rows={8}
            value={draft}
            maxLength={20000}
            required
            disabled={busy}
            onChange={(e) => {
              setDraft(e.target.value);
              setDraftResults([]);
              setDraftError("");
              setDraftNotice("");
            }}
          />
          <small className="hint">
            Até 20 mil caracteres e 30 frases por busca. A análise separa as
            frases para compará-las com a amostra escolhida.
          </small>
          <button className="primary" disabled={busy || !draft.trim()}>
            Revisar com sugestões locais
          </button>
        </form>
        <ErrorBox message={draftError} />
        {draftNotice && (
          <p className="hint" role="status">
            {draftNotice}
          </p>
        )}
        <div className="opus-list" aria-live="polite">
          {draftResults.map(({ segment, suggestions: matches }, index) => (
            <article className="opus-suggestion" key={index}>
              <span className="eyebrow">Trecho {index + 1}</span>
              <p>{segment}</p>
              {matches.length ? (
                matches.map((match, matchIndex) => (
                  <div
                    className="opus-match"
                    key={match.datasetId + matchIndex}
                  >
                    <span className="eyebrow">
                      {match.corpus} · {match.version} ·{" "}
                      {match.match === "exact"
                        ? "Correspondência exata"
                        : "Trecho relacionado"}
                      {match.sampleMethod === "beginning"
                        ? " · amostra do início"
                        : ""}
                    </span>
                    <p>{match.original}</p>
                    <p>
                      <strong>{match.translation}</strong>
                    </p>
                    <div className="actions">
                      <button
                        type="button"
                        onClick={() => void copyTranslation(match.translation)}
                      >
                        Copiar sugestão
                      </button>
                      <a
                        href={match.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver fonte TMX ↗
                      </a>
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">
                  Sem correspondência na amostra escolhida.
                </p>
              )}
            </article>
          ))}
        </div>
      </section>
      <section className="opus-section" aria-labelledby="opus-suggestions">
        <h2 id="opus-suggestions">Consultar sugestões</h2>
        <p>
          Busca nas memórias importadas, usando os idiomas e a coleção acima.
          Resultados relacionados são referências; revise o contexto antes de
          usar.
        </p>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!e.currentTarget.reportValidity()) return;
            void search();
          }}
        >
          <Textarea
            className="resize-none"
            label="Trecho de origem"
            value={q}
            maxLength={2000}
            required
            disabled={busy}
            onChange={(e) => {
              setQ(e.target.value);
              setSuggestions([]);
              setSearched(false);
            }}
          />
          <button className="primary" disabled={busy || !q.trim()}>
            Buscar sugestões locais
          </button>
        </form>
        <ErrorBox message={searchError} />
        {searched && !suggestions.length && (
          <p role="status">
            Nenhuma sugestão na amostra local. Você pode consultar o OPUS online
            ou importar outra coleção.
          </p>
        )}
        <div className="opus-list">
          {suggestions.map((s, i) => (
            <article className="opus-suggestion" key={i}>
              <span className="eyebrow">
                {s.corpus} · {s.version} ·{" "}
                {s.match === "exact"
                  ? "Correspondência exata"
                  : "Trecho relacionado"}
                {s.sampleMethod === "beginning" ? " · amostra do início" : ""}
              </span>
              <p>{s.original}</p>
              <p>
                <strong>{s.translation}</strong>
              </p>
              <a href={s.sourceUrl} target="_blank" rel="noreferrer">
                Fonte do par ↗
              </a>
            </article>
          ))}
        </div>
      </section>
      {busy && <Loading />}
    </div>
  );
}
