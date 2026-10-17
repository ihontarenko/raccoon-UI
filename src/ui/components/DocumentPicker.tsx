import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { documentCatalogueApi, type CatalogueDocument, type StageGroup } from "../../lib/documentCatalogue";
import { useTranslation } from "../../translations/TranslationProvider";
import { Icon, Select } from "../primitives";
import { PathText } from "./PathText";

/* With a source filter beside it the search keeps a second track; without one it takes the whole
   width, and on a phone the two stack whatever the filter is doing. */
const CONTROLS = [
  "relative grid grid-cols-[minmax(0,1fr)] gap-2",
  "data-[with-source=true]:grid-cols-[minmax(calc(120px*var(--ui-scale)),calc(200px*var(--ui-scale)))_minmax(0,1fr)]",
  "max-[700px]:data-[with-source=true]:grid-cols-[minmax(0,1fr)]",
].join(" ");

/* The frame around the search holds the icon, the field and every state the field is in: the bare
   input inside draws no border and no ring of its own, so the two never ring separately. ⚠️ The
   hover rule is written as one selector rather than two variants — a field whose value the server
   refused keeps its red edge under the cursor. */
const SEARCH = [
  "flex min-h-(--control) min-w-0 items-center gap-2 px-[calc(9px*var(--ui-scale))]",
  "rounded-control border border-line-strong bg-surface text-muted",
  "[&:hover:not(:has(input:disabled))]:border-accent-text",
  "focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent-line",
  "[&:has(input[aria-invalid=true])]:border-danger [&:has(input:disabled)]:opacity-55",
].join(" ");

const SEARCH_INPUT = [
  "min-w-0 flex-auto border-0 bg-transparent px-0 py-[calc(5px*var(--ui-scale))] font-[inherit] text-ink",
  "placeholder:text-muted focus:outline-none",
].join(" ");

/* Below the field, over what follows; it never pushes the form down. */
const POPUP = "absolute top-[calc(100%+2px)] right-0 left-0 z-20 rounded-control border border-line-strong bg-surface";

const OPTION = [
  "group grid min-w-0 cursor-pointer gap-[calc(2px*var(--ui-scale))] border-b border-line px-3 py-2",
  "data-[active=true]:bg-accent-soft data-[active=true]:shadow-[inset_2px_0_0_var(--accent)]",
  "aria-disabled:cursor-default aria-disabled:text-muted",
].join(" ");

const OPTION_TITLE = "font-[550] text-ink [overflow-wrap:anywhere] group-aria-disabled:text-muted";

const WHERE = "flex min-w-0 text-xs text-muted";

const SOURCE = "max-w-[40%] flex-none overflow-hidden text-ellipsis whitespace-nowrap";

const CHOSEN_ITEM = [
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2",
  "[padding:var(--space-1)_var(--space-1)_var(--space-1)_var(--space-3)]",
  "rounded-control border border-line border-l-2 border-l-good bg-surface",
].join(" ");

const REMOVE = [
  "inline-grid size-(--control) cursor-pointer place-items-center rounded-control border-0 bg-transparent text-secondary",
  "not-disabled:hover:bg-well not-disabled:hover:text-danger",
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-line",
].join(" ");

/** How many matches one search offers; more than this asks the person to narrow the search. */
const SHOWN_MATCHES = 20;
const SEARCH_DELAY_MILLISECONDS = 250;

/** A chosen document as the picker shows it: enough to name it and pin the version a judgment is made against. */
export interface PickedDocument {
  id: string;
  title: string;
  externalId: string;
  sourceName: string;
  latestVersionId: string;
}

export function pickedOf(document: CatalogueDocument): PickedDocument {
  return {
    id: document.id,
    title: document.title,
    externalId: document.externalId,
    sourceName: document.sourceName,
    latestVersionId: document.latestVersionId,
  };
}

interface DocumentPickerProperties {
  workspaceId: string;
  label: ReactNode;
  /** The documents already chosen, listed under the field with a remove button each. */
  chosen: PickedDocument[];
  onPick: (document: PickedDocument) => void;
  onRemove: (documentId: string) => void;
  /** At most this many may be chosen; at the limit the search field is disabled and says so. */
  maximum?: number;
  /** When given, a source filter sits beside the search field. */
  sources?: { id: string; name: string }[];
  /** Narrows the offered documents to one stage group, such as only searchable ones. */
  stage?: StageGroup;
  hint?: ReactNode;
  error?: ReactNode;
  disabled?: boolean;
}

type SearchState =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "ready"; matches: CatalogueDocument[]; total: number }
  | { status: "failed" };

/**
 * Finds documents by part of their title or path, searching on the server so a corpus of thousands stays
 * usable: a combobox whose popup lists at most twenty matches, each as its title over its source and path.
 * Arrow keys move through the matches, Enter chooses one, Escape closes the list.
 */
export function DocumentPicker({
  workspaceId,
  label,
  chosen,
  onPick,
  onRemove,
  maximum,
  sources,
  stage,
  hint,
  error,
  disabled = false,
}: DocumentPickerProperties) {
  const { t, plural } = useTranslation();
  const identifier = useId();
  const inputId = `${identifier}-input`;
  const listId = `${identifier}-list`;
  const hintId = `${identifier}-hint`;
  const errorId = `${identifier}-error`;
  const [text, setText] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  const container = useRef<HTMLDivElement>(null);
  const full = maximum !== undefined && maximum > 1 && chosen.length >= maximum;
  const blocked = disabled || full;

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setSearch({ status: "searching" });
    const timer = window.setTimeout(() => {
      documentCatalogueApi
        .page(
          workspaceId,
          { text: text.trim() === "" ? undefined : text.trim(), sourceId: sourceId === "" ? undefined : sourceId, stage },
          "TITLE",
          { limit: SHOWN_MATCHES, offset: 0 },
        )
        .then((page) => {
          if (!cancelled) {
            setSearch({ status: "ready", matches: page.items.filter((document) => document.removedAt === null), total: page.total });
            setActive(-1);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSearch({ status: "failed" });
          }
        });
    }, SEARCH_DELAY_MILLISECONDS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [workspaceId, text, sourceId, stage, open]);

  // A press outside the picker closes the list, as Escape does.
  useEffect(() => {
    if (!open) {
      return;
    }
    const closeOutside = (event: PointerEvent) => {
      if (container.current !== null && !container.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  const matches = search.status === "ready" ? search.matches : [];
  const chosenIds = new Set(chosen.map((document) => document.id));

  const choose = (document: CatalogueDocument) => {
    if (chosenIds.has(document.id)) {
      return;
    }
    onPick(pickedOf(document));
    setText("");
    setOpen(false);
  };

  const navigate = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((current) => (matches.length === 0 ? -1 : (current + 1) % matches.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActive((current) => (matches.length === 0 ? -1 : current <= 0 ? matches.length - 1 : current - 1));
    } else if (event.key === "Enter") {
      if (open && active >= 0 && active < matches.length) {
        event.preventDefault();
        choose(matches[active]);
      }
    } else if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
    }
  };

  const describedBy = [hint !== undefined ? hintId : null, error !== undefined ? errorId : null].filter(Boolean).join(" ");
  const activeId = open && active >= 0 && active < matches.length ? `${listId}-${active}` : undefined;
  const more = search.status === "ready" && search.total > search.matches.length;

  return (
    <div className="relative grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-1.5" ref={container}>
      <label className="text-xs font-[550] text-secondary" htmlFor={inputId}>
        {label}
      </label>
      <div className={CONTROLS} data-with-source={sources !== undefined && sources.length > 1}>
        {sources !== undefined && sources.length > 1 && (
          <Select
            aria-label={t("components.documentPicker.source", "Source")}
            value={sourceId}
            disabled={blocked}
            onChange={(event) => setSourceId(event.target.value)}
          >
            <option value="">{t("components.documentPicker.everySource", "Every source")}</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </Select>
        )}
        <div className={SEARCH}>
          <Icon name="search" />
          <input
            id={inputId}
            className={SEARCH_INPUT}
            type="text"
            role="combobox"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listId}
            aria-activedescendant={activeId}
            aria-describedby={describedBy === "" ? undefined : describedBy}
            aria-invalid={error !== undefined ? true : undefined}
            placeholder={
              full
                ? t("components.documentPicker.full", "{count} chosen — the most allowed", { count: maximum ?? 0 })
                : t("components.documentPicker.placeholder", "Part of the title or path")
            }
            value={text}
            disabled={blocked}
            onChange={(event) => {
              setText(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={navigate}
          />
        </div>
        <div className={POPUP} hidden={!open}>
          <ul
            id={listId}
            role="listbox"
            className="m-0 max-h-[calc(320px*var(--ui-scale))] list-none overflow-y-auto p-0"
            aria-label={t("components.documentPicker.matches", "Matching documents")}>
            {matches.map((document, index) => {
              const taken = chosenIds.has(document.id);
              return (
                <li
                  key={document.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  aria-disabled={taken || undefined}
                  className={OPTION}
                  data-active={index === active}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => choose(document)}
                  onPointerEnter={() => setActive(index)}
                >
                  <span className={OPTION_TITLE}>
                    {document.title}
                    {taken && (
                      <span className="text-xs font-normal">
                        {" "}
                        · {t("components.documentPicker.chosen", "chosen")}
                      </span>
                    )}
                  </span>
                  <span className={WHERE}>
                    <span className={SOURCE}>{document.sourceName}</span>
                    <span className="flex-none px-1" aria-hidden="true">·</span>
                    <PathText path={document.externalId} fit="middle" />
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="m-0 px-3 py-2 text-xs text-muted empty:hidden" role="status" aria-live="polite">
            {search.status === "searching" && t("components.documentPicker.searching", "Searching…")}
            {search.status === "failed" && t("components.documentPicker.failed", "The search failed. Try again.")}
            {search.status === "ready" && matches.length === 0 && t("components.documentPicker.none", "No document matches.")}
            {more &&
              t("components.documentPicker.more", "{shown} of {total} — refine the search", {
                shown: matches.length,
                total: search.total,
              })}
          </p>
        </div>
      </div>
      {hint !== undefined && (
        <div id={hintId} className="text-xs text-muted">
          {hint}
        </div>
      )}
      {error !== undefined && (
        <p id={errorId} className="m-0 text-xs text-danger">
          {error}
        </p>
      )}
      {chosen.length > 0 && (
        <ul className="m-0 grid list-none gap-1 p-0" aria-label={plural("components.documentPicker.chosenCount", chosen.length, { one: "{count} chosen document", other: "{count} chosen documents" })}>
          {chosen.map((document) => (
            <li key={document.id} className={CHOSEN_ITEM}>
              <span className="grid min-w-0">
                <span className="font-[550] text-ink [overflow-wrap:anywhere]">{document.title}</span>
                {document.externalId !== "" && (
                  <span className={WHERE}>
                    {document.sourceName !== "" && (
                      <>
                        <span className={SOURCE}>{document.sourceName}</span>
                        <span className="flex-none px-1" aria-hidden="true">·</span>
                      </>
                    )}
                    <PathText path={document.externalId} fit="middle" />
                  </span>
                )}
              </span>
              <button
                type="button"
                className={REMOVE}
                disabled={disabled}
                aria-label={t("components.documentPicker.remove", "Remove {title}", { title: document.title })}
                onClick={() => onRemove(document.id)}
              >
                <Icon name="close" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
