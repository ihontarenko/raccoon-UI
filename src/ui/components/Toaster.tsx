import { translate } from "../../translations/translate";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { classNames } from "../../lib/classNames";
import { Icon } from "../primitives";

/* The region is fixed in the corner and lets pointer events through, so a stack of toasts never
   blocks the page under it; each toast takes them back for itself. */
const REGION = [
  "pointer-events-none fixed right-6 bottom-6 z-40",
  "w-[min(calc(380px*var(--ui-scale)),calc(100vw-var(--space-6)))]",
  "max-[700px]:inset-x-4 max-[700px]:bottom-4 max-[700px]:w-auto",
].join(" ");

const TOAST = [
  "pointer-events-auto relative flex items-start gap-3 overflow-hidden",
  "[padding:var(--space-3)_var(--space-3)_var(--space-3)_calc(var(--space-4)+2px)]",
  "animate-arrive rounded-surface bg-ink text-on-ink shadow-toast motion-reduce:animate-none",
  "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-(--leading-colour) before:content-['']",
].join(" ");

const DISMISS = [
  "grid size-[calc(24px*var(--ui-scale))] flex-none place-items-center rounded-control",
  "border-0 bg-transparent text-inherit opacity-70 hover:opacity-100 focus-visible:outline-on-ink",
].join(" ");

// Transient feedback for the outcome of an action — "Source saved", "Job cancelled", a refused
// save. Problems that stop a page from rendering are not toasts; they are problem pages.

export type ToastTone = "neutral" | "good" | "error";

interface ToastInput {
  tone?: ToastTone;
  title: string;
  description?: string;
  action?: { label: string; href: string };
}

interface Toast extends Required<Omit<ToastInput, "description" | "action">> {
  id: number;
  description: string | null;
  action?: ToastInput["action"];
}

interface ToasterValue {
  notify: (toast: ToastInput) => void;
}

const DISPLAY_MILLISECONDS: Record<ToastTone, number> = {
  neutral: 5000,
  good: 5000,
  error: 9000,
};

const ToasterContext = createContext<ToasterValue | null>(null);

const TONE_CLASS: Record<ToastTone, string> = {
  neutral: "[--leading-colour:var(--accent)]",
  good: "[--leading-colour:var(--good)]",
  error: "[--leading-colour:var(--danger)]",
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const remainingReference = useRef(DISPLAY_MILLISECONDS[toast.tone]);

  useEffect(() => {
    if (paused) {
      return;
    }
    const startedAt = Date.now();
    const timer = window.setTimeout(() => {
      onDismiss(toast.id);
    }, remainingReference.current);
    return () => {
      window.clearTimeout(timer);
      remainingReference.current -= Date.now() - startedAt;
    };
  }, [paused, toast.id, onDismiss]);

  return (
    <li
      className={classNames(TOAST, TONE_CLASS[toast.tone])}
      role={toast.tone === "error" ? "alert" : "status"}
      onMouseEnter={() => {
        setPaused(true);
      }}
      onMouseLeave={() => {
        setPaused(false);
      }}
      onFocus={() => {
        setPaused(true);
      }}
      onBlur={() => {
        setPaused(false);
      }}
    >
      <div className="grid min-w-0 flex-1 gap-[calc(2px*var(--ui-scale))]">
        <p className="font-semibold [overflow-wrap:anywhere]">{toast.title}</p>
        {toast.description !== null && (
          <p className="text-xs opacity-80 [overflow-wrap:anywhere]">{toast.description}</p>
        )}
        {toast.action && (
          <a
            href={toast.action.href}
            className="mt-2 text-xs font-semibold text-on-ink underline underline-offset-4"
            onClick={() => onDismiss(toast.id)}
          >
            {toast.action.label}
          </a>
        )}
      </div>
      <button
        type="button"
        className={DISMISS}
        aria-label={translate("toaster.dismiss", "Dismiss notification")}
        onClick={() => {
          onDismiss(toast.id);
        }}
      >
        <Icon name="close" size="small" />
      </button>
    </li>
  );
}

export function ToasterProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextIdentifier = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const value = useMemo<ToasterValue>(
    () => ({
      notify: ({ tone = "neutral", title, description, action }) => {
        const id = nextIdentifier.current;
        nextIdentifier.current += 1;
        // At most four on screen: the oldest gives way so the stack never covers the page.
        setToasts((current) => [
          ...current.slice(-3),
          { id, tone, title, description: description ?? null, action },
        ]);
      },
    }),
    [],
  );

  return (
    <ToasterContext.Provider value={value}>
      {children}
      <section className={REGION} aria-label={translate("toaster.notifications", "Notifications")}>
        <ol className="m-0 grid list-none gap-2 p-0">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </ol>
      </section>
    </ToasterContext.Provider>
  );
}

export function useToaster(): ToasterValue {
  const value = useContext(ToasterContext);
  if (value === null) {
    throw new Error("useToaster must be used inside ToasterProvider.");
  }
  return value;
}
