import { useState, type FormEvent } from "react";
import { Upload, Check } from "lucide-react";
import { api, upload } from "./api";
import { Modal, Select, Field, ErrorBox } from "./ui";
import { emptyTerm, languageName, type Meta, type Glossary } from "./types";
type Preview = {
  id: string;
  rows: { index: number; original: string; translation: string }[];
};
export function ImportForm({
  meta,
  glossaries,
  onClose,
  onSaved,
}: {
  meta: Meta;
  glossaries: Glossary[];
  onClose: () => void;
  onSaved: (s: string) => void;
}) {
  const [file, setFile] = useState<File>();
  const [context, setContext] = useState({ ...emptyTerm });
  const [preview, setPreview] = useState<Preview>();
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (!file) {
      setError("Selecione um arquivo PDF, TXT ou CSV.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("O tamanho máximo é 5 MB.");
      return;
    }
    if (!/\.(pdf|txt|csv)$/i.test(file.name)) {
      setError(
        "Formato de arquivo inválido. Por favor, envie um arquivo PDF ou TXT válido",
      );
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      const buffer = await file.arrayBuffer();
      let binary = "";
      for (const byte of new Uint8Array(buffer))
        binary += String.fromCharCode(byte);
      const p = await upload<Preview>(
        { filename: file.name, content: btoa(binary), context },
        setProgress,
      );
      setPreview(p);
      setSelected(p.rows.map((r) => r.index));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    if (busy || !preview) return;
    setBusy(true);
    setError("");
    try {
      const r = await api<{ created: number; skipped: number }>(
        "/import/" + preview.id + "/commit",
        { selected },
      );
      onSaved(
        `${r.created} termos importados com sucesso para o banco do projeto!${r.skipped ? " " + r.skipped + " duplicados ignorados." : ""}`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Importar termos"
      wide
      onClose={onClose}
      dirty={!!preview}
      busy={busy}
    >
      <div className="modal-body">
        <ol className="steps">
          <li className={!preview ? "active" : ""}>1. Arquivo e contexto</li>
          <li className={preview ? "active" : ""}>2. Revisar e salvar</li>
        </ol>
        <ErrorBox message={error} />
        {!preview ? (
          <form noValidate onSubmit={submit}>
            <div className="upload-zone">
              <Upload size={30} />
              <h3>Traga suas referências para a biblioteca</h3>
              <p>PDF com texto, TXT em UTF-8 ou CSV · até 5 MB e 2.000 pares</p>
              <label className="file-picker">
                Selecionar arquivo
                <input
                  type="file"
                  accept=".pdf,.txt,.csv"
                  disabled={busy}
                  onChange={(e) => setFile(e.target.files?.[0])}
                />
              </label>
              {file && (
                <p>
                  {file.name} · {(file.size / 1024).toFixed(1)} KB
                </p>
              )}
            </div>
            <p className="hint">
              PDF/TXT: um par por linha, no formato{" "}
              <strong>original → tradução</strong>. CSV: cabeçalhos{" "}
              <strong>original,translation</strong>. Imagens digitalizadas
              precisam de OCR prévio.
            </p>
            <div className="form-grid">
              <Select
                label="Glossário de destino"
                value={context.glossaryId || ""}
                onChange={(e) => {
                  const g = glossaries.find((g) => g.id === e.target.value);
                  setContext({
                    ...context,
                    glossaryId: g?.id || null,
                    sourceLang: g?.sourceLang || context.sourceLang,
                    targetLang: g?.targetLang || context.targetLang,
                  });
                }}
              >
                <option value="">Biblioteca geral</option>
                {glossaries.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.client} · {g.name}
                  </option>
                ))}
              </Select>
              <Field
                label="Projeto / jogo"
                value={context.project}
                onChange={(e) =>
                  setContext({ ...context, project: e.target.value })
                }
              />
              {(["sourceLang", "targetLang"] as const).map((k, i) => (
                <Select
                  key={k}
                  label={i ? "Idioma de destino" : "Idioma de origem"}
                  value={context[k]}
                  onChange={(e) =>
                    setContext({ ...context, [k]: e.target.value })
                  }
                >
                  {meta.languages.map((l) => (
                    <option key={l} value={l}>
                      {languageName[l]}
                    </option>
                  ))}
                </Select>
              ))}
              <Select
                label="Área / categoria"
                value={context.category}
                onChange={(e) =>
                  setContext({ ...context, category: e.target.value })
                }
              >
                {meta.categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </div>
            {busy && (
              <div role="status">
                <progress value={progress} max={100} />
                <p>
                  {progress === 100
                    ? "Arquivo enviado. Extraindo os pares…"
                    : `Enviando arquivo: ${progress}%`}
                </p>
              </div>
            )}
            <div className="actions end">
              <button className="primary" disabled={busy}>
                {busy ? "Processando…" : "Pré-visualizar termos"}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="section-heading">
              <p>
                <strong>{selected.length}</strong> de {preview.rows.length}{" "}
                termos selecionados
              </p>
              <button
                onClick={() => {
                  setPreview(undefined);
                  setError("");
                }}
                disabled={busy}
              >
                Escolher outro arquivo
              </button>
            </div>
            <p className="hint">
              Revise os pares e desmarque os que não deseja salvar. Entradas já
              existentes no mesmo contexto serão ignoradas.
            </p>
            <div className="import-table">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        aria-label="Selecionar todos os termos"
                        checked={selected.length === preview.rows.length}
                        ref={(el) => {
                          if (el)
                            el.indeterminate =
                              selected.length > 0 &&
                              selected.length < preview.rows.length;
                        }}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? preview.rows.map((r) => r.index)
                              : [],
                          )
                        }
                      />
                    </th>
                    <th>Original</th>
                    <th>Tradução</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr key={r.index}>
                      <td>
                        <input
                          aria-label={`Selecionar ${r.original}`}
                          type="checkbox"
                          checked={selected.includes(r.index)}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? [...selected, r.index]
                                : selected.filter((i) => i !== r.index),
                            )
                          }
                        />
                      </td>
                      <td>{r.original}</td>
                      <td>{r.translation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="actions end">
              <button
                className="primary"
                disabled={busy || !selected.length}
                onClick={commit}
              >
                <Check size={17} />
                {busy ? "Salvando…" : "Confirmar e Salvar"}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
