import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { X, LoaderCircle } from "lucide-react";
const ModalCloseContext = createContext<() => void>(() => {});
export function CancelButton({ busy = false }: { busy?: boolean }) {
  const close = useContext(ModalCloseContext);
  return (
    <button type="button" disabled={busy} onClick={close}>
      Cancelar
    </button>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} /> Carregando…
    </div>
  );
}
export function ErrorBox({ message }: { message: string }) {
  return message ? (
    <div className="error" role="alert">
      {message}
    </div>
  ) : null;
}
export function Field({
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        {...props}
        aria-invalid={!!error}
        aria-describedby={error ? id + "-error" : undefined}
      />
      {error && (
        <small id={id + "-error"} className="field-error">
          {error}
        </small>
      )}
    </label>
  );
}
export function Select({
  label,
  error,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
}) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <select
        id={id}
        {...props}
        aria-invalid={!!error}
        aria-describedby={error ? id + "-error" : undefined}
      >
        {children}
      </select>
      {error && (
        <small id={id + "-error"} className="field-error">
          {error}
        </small>
      )}
    </label>
  );
}
export function Textarea({
  label,
  error,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
}) {
  const id = useId();
  return (
    <label className="field wide" htmlFor={id}>
      <span>{label}</span>
      <textarea
        className="resize-none"
        id={id}
        rows={4}
        style={{ resize: "none" }}
        {...props}
        aria-invalid={!!error}
        aria-describedby={error ? id + "-error" : undefined}
      />
      {error && (
        <small id={id + "-error"} className="field-error">
          {error}
        </small>
      )}
    </label>
  );
}
export function Modal({
  title,
  children,
  onClose,
  dirty = false,
  busy = false,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  dirty?: boolean;
  busy?: boolean;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [confirm, setConfirm] = useState(false);
  const id = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    if (!dirty && !busy) return;
    const f = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [dirty, busy]);
  function close() {
    if (busy) return;
    if (dirty) setConfirm(true);
    else onClose();
  }
  return (
    <dialog
      ref={ref}
      className={wide ? "modal modal-wide" : "modal"}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <header className="modal-head">
        <h2 id={id}>{title}</h2>
        <button
          className="icon-button"
          aria-label="Fechar"
          onClick={close}
          disabled={busy}
        >
          <X size={20} />
        </button>
      </header>
      {confirm ? (
        <section className="modal-body">
          <h3>Descartar alterações?</h3>
          <p>As alterações que ainda não foram salvas serão descartadas.</p>
          <div className="actions">
            <button autoFocus onClick={() => setConfirm(false)}>
              Continuar editando
            </button>
            <button className="danger" onClick={onClose}>
              Descartar alterações
            </button>
          </div>
        </section>
      ) : (
        <ModalCloseContext.Provider value={close}>
          {children}
        </ModalCloseContext.Provider>
      )}
    </dialog>
  );
}
export function Tags({ values }: { values: string[] }) {
  return (
    <span className="tags">
      {[...new Set(values)].map((t) => (
        <span className="tag" key={t}>
          {t}
        </span>
      ))}
    </span>
  );
}
