import { useNavigate, useSearch } from "@tanstack/react-router";
import { useWorkspaceActivity } from "../../application/WorkspaceActivityProvider";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePermissions } from "../../access/PermissionsProvider";
import { PERMISSIONS } from "../../access/permissions";
import { formatBytes, formatDateTime, shortIdentifier } from "../../application/format";
import { useReadySession } from "../../application/session";
import { usePageTitle } from "../../application/usePageTitle";
import { usePagedList } from "../../application/usePagedList";
import { useResource } from "../../application/useResource";
import { api, collectAllPages } from "../../lib/api";
import type { DocumentVersionView, DocumentView } from "../../lib/contracts";
import { CaptureOriginText } from "./captureOrigin";
import {
  STAGES_OF_GROUP,
  documentCatalogueApi,
  filterOf,
  queryRefusal,
  type CatalogueDocument,
  type CatalogueOrder,
  type CatalogueStage,
  type DocumentsSearch,
  type StageCounts,
  type StageGroup,
} from "../../lib/documentCatalogue";
import { filesApi } from "../../lib/files";
import type { DocumentStage } from "../../lib/indexOverview";
import { useTranslation } from "../../translations/TranslationProvider";
import { currentLocale } from "../../translations/translate";
import {
  CopyButton,
  DateRangeField,
  EmptyState,
  Facts,
  Inspector,
  InspectorActions,
  InspectorSection,
  ListFooter,
  PageHeader,
  PathText,
  ProblemState,
  RowName,
  Segmented,
  Waiting,
  Workbench,
  useToaster,
} from "../../ui/components";
import { Badge, Button, Icon, Input, Select, Table } from "../../ui/primitives";
import { STAGE } from "../indexing/documentStages";
import { CaptureDocumentDialog } from "../sources/documents/CaptureDocumentDialog";
import { useAddressChange } from "../../application/useAddressChange";
import { useMediaQuery } from "../../application/useMediaQuery";

/*
 * ── Toolbar ─────────────────────────────────────────────────────────────────────────────────────
 *
 * A band of controls under the header, not a card: one divider below it. Row one is the everyday
 * question — a name or a path, and how far it got; row two narrows further with even, labelled
 * controls and ends with the jMQ query and the reset.
 */
const TOOLBAR = "mb-3 grid gap-3 border-b border-line pb-3";

const PRIMARY_ROW = "flex flex-wrap items-center gap-3";

/* The magnifier sits inside the field rather than beside it, so the field keeps the whole width it
   is given; the input's own left padding is what makes room for it. */
const SEARCH = [
  "relative flex min-w-0 flex-[1_1_calc(260px*var(--ui-scale))] items-center text-muted",
  "[&>:first-child]:pointer-events-none [&>:first-child]:absolute [&>:first-child]:left-2",
  "[&_input]:pl-[calc(30px*var(--ui-scale))]",
].join(" ");

const SECONDARY_ROWS = "grid gap-3";

/* Five even controls and the actions: every label above its control, every control the same width —
   three across on a laptop, one on a phone, and the actions take the whole last line. */
const REFINEMENTS = [
  "grid grid-cols-[repeat(5,minmax(0,1fr))_auto] items-end gap-3",
  "max-[1280px]:grid-cols-3 max-[700px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

const CONTROL = "grid min-w-0 gap-1";

const CONTROL_LABEL = "text-xs text-secondary";

const TOOLBAR_ACTIONS = [
  "flex flex-wrap items-center justify-end gap-1",
  "max-[1280px]:col-span-full max-[700px]:justify-start",
].join(" ");

/* ── The jMQ query ──────────────────────────────────────────────────────────────────────────── */

const QUERY = "grid gap-1";

const QUERY_LINE = "flex items-center gap-2 [&_input]:min-w-0 [&_input]:flex-1";

const REFUSAL = "m-0 text-xs text-danger";

const ATTRIBUTES = [
  "text-xs",
  "[&_summary]:w-max [&_summary]:cursor-pointer [&_summary]:text-secondary",
  "[&_summary:hover]:text-ink",
].join(" ");

const CHIP_ROW = "mx-0 mt-2 mb-0 flex flex-wrap items-center gap-1";

/* A name to drop into the query: a chip that is a button, so it reads as something to use. */
const CHIP = [
  "rounded-[calc(3px*var(--ui-scale))] border border-line bg-well px-2 py-[calc(1px*var(--ui-scale))]",
  "text-left text-xs text-ink [overflow-wrap:anywhere]",
  "transition-[background-color,border-color] duration-120 motion-reduce:transition-none",
  "hover:border-accent-text hover:bg-accent-soft",
].join(" ");

/* ── Active filters ─────────────────────────────────────────────────────────────────────────── */

const ACTIVE_FILTERS = "mx-0 mt-0 mb-3 flex list-none flex-wrap gap-2 p-0";

const ACTIVE_FILTER = [
  "inline-flex max-w-full items-center rounded-[calc(3px*var(--ui-scale))]",
  "border border-accent-line bg-accent-soft text-xs text-ink",
].join(" ");

const ACTIVE_FILTER_TEXT = [
  "max-w-[calc(420px*var(--ui-scale))] overflow-hidden text-ellipsis whitespace-nowrap",
  "[padding:calc(2px*var(--ui-scale))_var(--space-1)_calc(2px*var(--ui-scale))_var(--space-2)]",
].join(" ");

const ACTIVE_FILTER_REMOVE = [
  "grid place-items-center self-stretch border-0 border-l border-l-accent-line bg-transparent px-1",
  "text-secondary hover:text-ink",
].join(" ");

/* ── The list ───────────────────────────────────────────────────────────────────────────────── */

/* One label column across every inspector section, so "Origin" and "Latest version" line up. */
const CATALOGUE = "[--facts-label-width:calc(92px*var(--ui-scale))]";

/* ⚠️ `w-full max-w-0` IS THE IDIOM FOR "TAKE WHAT IS LEFT AND LET IT BE CUT": the document column
   gives way so the stage and the versions always keep their place. */
const DOCUMENT_COLUMN = "w-full max-w-0";

/* About 56px a row: an instrument page, not a brochure. ⚠️ Marked important because `rc-table` sets
   the cell padding unlayered, which outranks any utility however specific. */
const DENSE_ROW =
  "[&>td]:pt-[calc(7px*var(--ui-scale))]! [&>td]:pb-[calc(7px*var(--ui-scale))]!";

/* A phone has no room to cut a name to one line; it wraps instead. */
const DOCUMENT_NAME = [
  "overflow-hidden text-ellipsis whitespace-nowrap",
  "max-[700px]:whitespace-normal max-[700px]:[overflow-wrap:anywhere]",
].join(" ");

/*
 * Source · path · type, on one line with fixed outer tracks, so the type never moves from row to row
 * and the path — cut in its middle — keeps the part that tells two "ringbuf.h" apart.
 *
 * ⚠️ The outer two give way one at a time as the screen narrows: first the type, then the source. On
 * a phone the path alone says where a document is, and its source is one tap away.
 */
const META_LINE = [
  "mt-[calc(2px*var(--ui-scale))] grid items-baseline gap-3 text-xs text-muted",
  "grid-cols-[calc(110px*var(--ui-scale))_minmax(0,1fr)_calc(110px*var(--ui-scale))]",
  "max-[900px]:grid-cols-[minmax(0,calc(120px*var(--ui-scale)))_minmax(0,1fr)]",
  "max-[700px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

const META_SOURCE = [
  "overflow-hidden text-ellipsis whitespace-nowrap text-secondary max-[700px]:hidden",
].join(" ");

const META_TYPE = [
  "overflow-hidden text-right text-ellipsis whitespace-nowrap max-[900px]:hidden",
].join(" ");

/* ── Inspector ─────────────────────────────────────────────────────────────────────────────── */

/* A badge keeps its own width; the sentence explaining it sits under it. */
const STAGE_LINE = "m-0 grid justify-items-start gap-1";

/* The copy button sits on the value's line without making the row taller than its neighbours. */
const COPYABLE =
  "inline-flex min-w-0 items-center gap-1 my-[calc(-6px*var(--ui-scale))]";

const VERSIONS = "m-0 grid list-none p-0";

const VERSION_ROW = [
  "grid grid-cols-[calc(40px*var(--ui-scale))_minmax(0,1fr)_auto] items-baseline gap-3",
  "border-b border-line py-2 last:border-b-0",
].join(" ");

/** The stage buttons: "all" is every document in the corpus; the rest are the server's groups. */
type StageButton = "ALL" | StageGroup;

/** How long typing in the name field waits before the address — and so the list — follows it. */
const TYPING_PAUSE_MILLISECONDS = 300;

/**
 * The catalogue of the workspace's documents: find one by name or path, narrow it by source, type, parser,
 * capture date or how far it got — or by a jMQ query — and inspect it. The server pages and filters; every
 * filter lives in the address, so a filtered view is a link that can be shared. How each document reaches
 * search is the Index page's question; this page is for finding and looking.
 */
export function DocumentsPage() {
  const { t, plural } = useTranslation();
  usePageTitle(t("documents.title", "Documents"));
  const { workspace } = useReadySession();
  const workspaceId = workspace?.id ?? null;
  const permissions = usePermissions();
  const { notify } = useToaster();
  const [writing, setWriting] = useState(false);
  const maySeeSources = permissions.may(PERMISSIONS.sourceRead);
  const maySeeStages = permissions.may(PERMISSIONS.automationRead);
  const search = useSearch({ strict: false }) as DocumentsSearch;
  const navigate = useNavigate();
  const changeAddress = useAddressChange();
  const go = (next: Partial<DocumentsSearch>, replace = false) => {
    void changeAddress({ to: "/documents", search: { ...search, ...next }, replace });
  };

  // On a narrow screen the inspector would sit below the whole list, far from the row that chose it, so a
  // row opens its document instead; wide screens keep the list and the inspector side by side.
  const wide = useMediaQuery("(min-width: 1101px)");
  // On a phone the filters fold behind one "Filters" button that counts what is active.
  const narrow = useMediaQuery("(max-width: 700px)");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const choose = (documentId: string) => {
    if (!wide) {
      void navigate({ to: "/documents/$documentId", params: { documentId } });
      return;
    }
    setChosenId(documentId);
  };

  // The name field follows the address, and the address follows the name field after a pause in typing.
  const [textDraft, setTextDraft] = useState(search.text ?? "");
  useEffect(() => {
    setTextDraft(search.text ?? "");
  }, [search.text]);
  useEffect(() => {
    const typed = textDraft.trim() === "" ? undefined : textDraft.trim();
    if (typed === search.text) {
      return undefined;
    }
    const timer = window.setTimeout(() => go({ text: typed }, true), TYPING_PAUSE_MILLISECONDS);
    return () => window.clearTimeout(timer);
    // `go` closes over the current address, which `search.text` already follows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textDraft, search.text]);

  const [queryOpen, setQueryOpen] = useState(search.query !== undefined);
  const [queryDraft, setQueryDraft] = useState(search.query ?? "");
  useEffect(() => {
    setQueryDraft(search.query ?? "");
    if (search.query !== undefined) {
      setQueryOpen(true);
    }
  }, [search.query]);
  // The server's sentence for a typed query it refused; shown at the field, while the list reads as empty.
  const [refusal, setRefusal] = useState<string | null>(null);
  const queryInput = useRef<HTMLInputElement>(null);

  const order: CatalogueOrder = search.order ?? "PATH";
  const filter = filterOf(search);
  const { stage: _chosenStage, ...filterWithoutStage } = filter;
  const filterKey = JSON.stringify(filter);
  const countsKey = JSON.stringify(filterWithoutStage);

  const documents = usePagedList<CatalogueDocument>(
    async (page) => {
      if (workspaceId === null) {
        return { items: [], total: 0 };
      }
      try {
        const answered = await documentCatalogueApi.page(workspaceId, filter, order, page);
        setRefusal(null);
        return answered;
      } catch (error) {
        const sentence = queryRefusal(error);
        if (sentence === null) {
          throw error;
        }
        setRefusal(sentence);
        return { items: [], total: 0 };
      }
    },
    [workspaceId, filterKey, order],
  );
  const counts = useResource<StageCounts | null>(
    () =>
      workspaceId === null
        ? Promise.resolve(null)
        : documentCatalogueApi.stages(workspaceId, filterWithoutStage).catch((error: unknown) => {
            if (queryRefusal(error) !== null) {
              return null;
            }
            throw error;
          }),
    [workspaceId, countsKey],
  );
  const facets = useResource(
    () => (workspaceId === null ? Promise.resolve({ mediaTypes: [], parsers: [] }) : documentCatalogueApi.facets(workspaceId)),
    [workspaceId],
  );
  const sources = useResource(
    () => (workspaceId === null || !maySeeSources ? Promise.resolve([]) : collectAllPages((page) => api.listSources(workspaceId, page))),
    [workspaceId, maySeeSources],
  );
  const sourceNames = useMemo(() => new Map(sources.status === "ready" ? sources.data.map((source) => [source.id, source.name]) : []), [sources]);
  /*
   * Adding a document by hand from the catalogue. A document arrives in the source kind that takes its way in —
   * typed text in a written-text source, a file in an uploaded-files one — so each way offers its own sources, the
   * one the list is filtered to first, since that is the one in mind. The action stands whether or not such a
   * source exists: hiding it is how it could not be found at all, and the dialog explains the empty case and
   * offers the way out of it.
   */
  const filledSources = sources.status === "ready" ? sources.data.filter((source) => source.enabled && source.removedAt === null) : [];
  const offeredFirst = (candidates: typeof filledSources) =>
    [...candidates].sort((first, second) => (first.id === search.source ? -1 : second.id === search.source ? 1 : 0));
  const textSources = offeredFirst(filledSources.filter((source) => source.kind === "CUSTOM_TEXT"));
  const fileSources = offeredFirst(filledSources.filter((source) => source.kind === "MANAGED_FOLDER"));
  const mayWrite = permissions.may(PERMISSIONS.documentWrite) && maySeeSources && sources.status === "ready" && workspaceId !== null;
  const sourceNameOf = (sourceId: string) =>
    sourceNames.get(sourceId) ?? t("documents.sourceFallback", "Source {identifier}", { identifier: shortIdentifier(sourceId) });

  const filtered =
    search.stage !== undefined || search.source !== undefined || search.type !== undefined || search.parser !== undefined ||
    search.text !== undefined || search.from !== undefined || search.until !== undefined || search.query !== undefined;
  const clearFilters = () => {
    setTextDraft("");
    setQueryDraft("");
    setRefusal(null);
    void changeAddress({ to: "/documents", search: search.order === undefined ? {} : { order: search.order } });
  };

  const header = (
    <PageHeader
      eyebrow={t("navigation.group.materials", "Materials")}
      title={t("documents.title", "Documents")}
      lead={t(
        "documents.lead",
        "Every original captured from a source, kept as numbered versions. Find one, see how far it got, and open it.",
      )}
      actions={
        mayWrite ? (
          <Button variant="primary" icon="plus" onClick={() => setWriting(true)}>
            {t("sources.documents.add", "Add a document")}
          </Button>
        ) : undefined
      }
    />
  );

  const writer = mayWrite ? (
    <CaptureDocumentDialog
      editing={writing ? { document: null } : null}
      workspaceId={workspaceId}
      textSources={textSources}
      fileSources={fileSources}
      knownDocuments={(sourceId: string) =>
        (documents.status === "ready" ? documents.items : []).filter((row) => row.sourceId === sourceId)
      }
      onClose={() => setWriting(false)}
      onUploaded={(outcomes) => {
        setWriting(false);
        const refused = outcomes.filter((outcome) => outcome.version === null);
        notify({
          tone: refused.length === 0 ? "good" : "error",
          title:
            refused.length === outcomes.length
              ? t("sources.documents.nothingUploaded", "Nothing uploaded")
              : plural("sources.documents.uploaded", outcomes.length - refused.length, {
                  one: "{count} file uploaded",
                  other: "{count} files uploaded",
                }),
          description: refused.length === 0 ? undefined : refused.map((outcome) => outcome.fileName + ": " + outcome.refusal).join(" · "),
        });
        documents.reload();
        counts.reload();
      }}
      onSaved={(title: string, unchanged: boolean) => {
        setWriting(false);
        notify(
          unchanged
            ? {
                tone: "neutral",
                title: t("sources.documents.nothingChanged", "Nothing changed"),
                description: t("sources.documents.identical", "The text is identical to the current version."),
              }
            : {
                tone: "good",
                title: t("sources.savedToast", "{name} saved", { name: title }),
                description: t("documents.writtenHere", "It is in the catalogue; preparation starts on its own."),
              },
        );
        documents.reload();
        counts.reload();
      }}
    />
  ) : null;

  if (workspaceId === null) {
    return (
      <>
        {header}
        <EmptyState
          title={t("documents.noWorkspace", "No workspace")}
          description={t("documents.noWorkspaceDescription", "Documents belong to a workspace, and you are not a member of any yet.")}
        />
      </>
    );
  }

  const stageCounts = counts.status === "ready" ? counts.data : null;
  const countOfButton = (button: StageButton): number | undefined => {
    if (stageCounts === null) {
      return undefined;
    }
    if (button === "ALL") {
      return stageCounts.current;
    }
    if (button === "REMOVED") {
      return stageCounts.removed;
    }
    const stages = stageCounts.stages;
    return stages === null ? undefined : STAGES_OF_GROUP[button].reduce((sum, stage) => sum + (stages[stage] ?? 0), 0);
  };
  // A reader who may not see how far documents got still sees which ones were removed.
  const stageButtons: StageButton[] = maySeeStages ? ["ALL", "SEARCHABLE", "WAITING", "NOT_PROCESSED", "REMOVED"] : ["ALL", "REMOVED"];
  const stageLabel: Record<StageButton, string> = {
    ALL: t("documents.stageFilter.all", "All"),
    SEARCHABLE: t("documents.stageFilter.searchable", "Searchable"),
    WAITING: t("documents.stageFilter.waiting", "Waiting"),
    NOT_PROCESSED: t("documents.stageFilter.notProcessed", "Not processed"),
    REMOVED: t("documents.stageFilter.removed", "Removed"),
  };

  const nothingCaptured = !filtered && documents.status === "ready" && documents.total === 0 && (stageCounts?.removed ?? 0) === 0;
  if (nothingCaptured) {
    return (
      <>
        {header}
        <EmptyState
          title={t("documents.empty", "No documents yet")}
          description={t("documents.emptyDescription", "Documents appear here once a source has been scanned or text has been captured into it.")}
          action={
            mayWrite ? (
              <Button variant="primary" icon="plus" onClick={() => setWriting(true)}>
                {t("sources.documents.add", "Add a document")}
              </Button>
            ) : maySeeSources ? (
              <Button href="/sources" icon="sources">
                {t("documents.goToSources", "Go to sources")}
              </Button>
            ) : undefined
          }
        />
        {writer}
      </>
    );
  }

  const rows = documents.status === "ready" ? documents.items : [];
  const selectedId = chosenId !== null && rows.some((document) => document.id === chosenId) ? chosenId : (rows[0]?.id ?? null);
  const selected = rows.find((document) => document.id === selectedId);

  const removeQuery = () => {
    setQueryDraft("");
    setRefusal(null);
    go({ query: undefined });
  };
  // What narrows the list now, each removable on its own: the chips under the toolbar, and the count on the
  // phone's "Filters" button.
  const activeFilters: { name: string; label: string; remove: () => void }[] = [];
  if (search.stage !== undefined) {
    activeFilters.push({ name: "stage", label: stageLabel[search.stage], remove: () => go({ stage: undefined }) });
  }
  if (search.source !== undefined) {
    activeFilters.push({ name: "source", label: `${t("documents.source", "Source")}: ${sourceNameOf(search.source)}`, remove: () => go({ source: undefined }) });
  }
  if (search.type !== undefined) {
    activeFilters.push({ name: "type", label: `${t("documents.filter.type", "Type")}: ${search.type}`, remove: () => go({ type: undefined }) });
  }
  if (search.parser !== undefined) {
    activeFilters.push({ name: "parser", label: `${t("documents.filter.parser", "Parser")}: ${search.parser}`, remove: () => go({ parser: undefined }) });
  }
  if (search.from !== undefined || search.until !== undefined) {
    activeFilters.push({
      name: "captured",
      label: `${t("documents.filter.captured", "Captured")}: ${periodText(search.from, search.until)}`,
      remove: () => go({ from: undefined, until: undefined }),
    });
  }
  if (search.query !== undefined) {
    activeFilters.push({ name: "query", label: `jMQ: ${search.query}`, remove: removeQuery });
  }

  /** Puts an attribute into the query where the caret is, with the spaces around it the language needs. */
  const insertAttribute = (attribute: string) => {
    const input = queryInput.current;
    const start = input?.selectionStart ?? queryDraft.length;
    const end = input?.selectionEnd ?? queryDraft.length;
    const before = queryDraft.slice(0, start);
    const spaced = before === "" || before.endsWith(" ") ? attribute : ` ${attribute}`;
    setQueryDraft(`${before}${spaced} ${queryDraft.slice(end)}`);
    window.requestAnimationFrame(() => {
      const caret = before.length + spaced.length + 1;
      input?.focus();
      input?.setSelectionRange(caret, caret);
    });
  };

  const stageControl = (
    <Segmented<StageButton>
      label={t("documents.howFar", "How far it got")}
      value={search.stage ?? "ALL"}
      onChange={(next) => go({ stage: next === "ALL" ? undefined : next })}
      options={stageButtons.map((button) => ({ value: button, label: stageLabel[button], count: countOfButton(button) }))}
    />
  );
  const refinements = (
    <div className={REFINEMENTS}>
      {maySeeSources && (
        <label className={CONTROL}>
          <span className={CONTROL_LABEL}>{t("documents.source", "Source")}</span>
          <Select fullWidth value={search.source ?? ""} onChange={(event) => go({ source: event.target.value === "" ? undefined : event.target.value })}>
            <option value="">{t("documents.allSources", "All sources")}</option>
            {(sources.status === "ready" ? sources.data : []).map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </Select>
        </label>
      )}
      <label className={CONTROL}>
        <span className={CONTROL_LABEL}>{t("documents.filter.type", "Type")}</span>
        <Select fullWidth value={search.type ?? ""} onChange={(event) => go({ type: event.target.value === "" ? undefined : event.target.value })}>
          <option value="">{t("documents.filter.allTypes", "All types")}</option>
          {(facets.status === "ready" ? facets.data.mediaTypes : []).map((facet) => (
            <option key={facet.value} value={facet.value}>
              {facet.value} · {facet.documents}
            </option>
          ))}
        </Select>
      </label>
      <label className={CONTROL}>
        <span className={CONTROL_LABEL}>{t("documents.filter.parser", "Parser")}</span>
        <Select fullWidth value={search.parser ?? ""} onChange={(event) => go({ parser: event.target.value === "" ? undefined : event.target.value })}>
          <option value="">{t("documents.filter.anyParser", "Any parser")}</option>
          {(facets.status === "ready" ? facets.data.parsers : []).map((facet) => (
            <option key={facet.value} value={facet.value}>
              {facet.value} · {facet.documents}
            </option>
          ))}
        </Select>
      </label>
      <DateRangeField
        label={t("documents.filter.captured", "Captured")}
        from={search.from}
        until={search.until}
        onChange={(range) => go({ from: range.from, until: range.until })}
      />
      <label className={CONTROL}>
        <span className={CONTROL_LABEL}>{t("documents.order", "Order")}</span>
        <Select fullWidth value={order} onChange={(event) => go({ order: event.target.value === "PATH" ? undefined : (event.target.value as CatalogueOrder) })}>
          <option value="PATH">{t("documents.order.path", "By path")}</option>
          <option value="TITLE">{t("documents.order.title", "By name")}</option>
          <option value="CHANGED">{t("documents.order.changed", "Recently changed")}</option>
          <option value="SIZE">{t("documents.order.size", "Largest first")}</option>
        </Select>
      </label>
      <div className={TOOLBAR_ACTIONS}>
        <Button variant="quiet" icon="code" aria-expanded={queryOpen} aria-controls="documents-query" onClick={() => setQueryOpen((open) => !open)}>
          {t("documents.query.toggle", "jMQ query")}
        </Button>
        {filtered && (
          <Button variant="quiet" icon="close" onClick={clearFilters}>
            {t("documents.resetFilters", "Reset filters")}
          </Button>
        )}
      </div>
    </div>
  );
  const queryForm = queryOpen && (
    <form
      id="documents-query"
      className={QUERY}
      onSubmit={(event) => {
        event.preventDefault();
        go({ query: queryDraft.trim() === "" ? undefined : queryDraft.trim() });
      }}
    >
      <label className={CONTROL_LABEL} htmlFor="documents-query-text">
        {t("documents.query.label", "jMQ query")}
      </label>
      <div className={QUERY_LINE}>
        <Input
          ref={queryInput}
          id="documents-query-text"
          className="numeric"
          fullWidth
          spellCheck={false}
          autoComplete="off"
          placeholder="document.title is contains('guide')"
          value={queryDraft}
          invalid={refusal !== null}
          aria-describedby={refusal === null ? undefined : "documents-query-refusal"}
          onChange={(event) => setQueryDraft(event.target.value)}
        />
        <Button type="submit" variant="primary">
          {t("documents.query.apply", "Apply")}
        </Button>
        {search.query !== undefined && (
          <Button
            variant="quiet"
            icon="close"
            iconOnly
            aria-label={t("documents.query.clear", "Remove the query")}
            title={t("documents.query.clear", "Remove the query")}
            onClick={removeQuery}
          />
        )}
      </div>
      {refusal !== null && (
        <p id="documents-query-refusal" className={REFUSAL}>
          {refusal}
        </p>
      )}
      <details className={ATTRIBUTES}>
        <summary>{t("documents.query.attributes", "Attributes")}</summary>
        <div className={CHIP_ROW}>
          {QUERY_ATTRIBUTES.map((attribute) => (
            <button key={attribute} type="button" className={`numeric ${CHIP}`} onClick={() => insertAttribute(attribute)}>
              {attribute}
            </button>
          ))}
        </div>
        <p className={`text-xs text-secondary ${CHIP_ROW}`}>
          <span>{t("documents.query.example", "For example:")}</span>
          <button type="button" className={`numeric ${CHIP}`} onClick={() => setQueryDraft(QUERY_EXAMPLE)}>
            {QUERY_EXAMPLE}
          </button>
        </p>
      </details>
    </form>
  );

  return (
    <>
      {header}
      <div className={TOOLBAR} role="search" aria-label={t("documents.find", "Find a document")}>
        <div className={PRIMARY_ROW}>
          <label className={SEARCH}>
            <Icon name="search" size="small" />
            <span className="sr-only">{t("documents.find", "Find a document")}</span>
            <Input type="search" fullWidth placeholder={t("documents.findPlaceholder", "A name or a path…")} value={textDraft} onChange={(event) => setTextDraft(event.target.value)} />
          </label>
          {narrow ? (
            <Button icon="layers" aria-expanded={filtersOpen} aria-controls="documents-filters" onClick={() => setFiltersOpen((open) => !open)}>
              {activeFilters.length === 0 ? t("documents.filters", "Filters") : t("documents.filtersCount", "Filters · {count}", { count: activeFilters.length })}
            </Button>
          ) : (
            stageControl
          )}
        </div>
        {(!narrow || filtersOpen) && (
          <div id="documents-filters" className={SECONDARY_ROWS}>
            {narrow && stageControl}
            {refinements}
            {queryForm}
          </div>
        )}
      </div>
      {activeFilters.length > 0 && (
        <ul className={ACTIVE_FILTERS} aria-label={t("documents.activeFilters", "Active filters")}>
          {activeFilters.map((active) => (
            <li key={active.name} className={ACTIVE_FILTER}>
              <span className={ACTIVE_FILTER_TEXT} title={active.label}>
                {active.label}
              </span>
              <button
                type="button"
                className={ACTIVE_FILTER_REMOVE}
                aria-label={t("documents.removeFilter", "Remove “{filter}”", { filter: active.label })}
                onClick={active.remove}
              >
                <Icon name="close" size="small" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {documents.status === "loading" ? (
        <Waiting label={t("documents.loading", "Loading documents")} lines={5} />
      ) : documents.status === "failed" ? (
        <ProblemState layout="section" problem={documents.problem} actions={<Button icon="refresh" onClick={documents.reload}>{t("common.tryAgain", "Try again")}</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={refusal === null ? t("documents.nothingMatches", "Nothing matches") : t("documents.queryRefused", "The query was not asked")}
          description={
            refusal === null
              ? t("documents.nothingMatchesDescription", "No document matches these filters together.")
              : t("documents.queryRefusedDescription", "Correct the jMQ query above, or remove it, to see documents again.")
          }
          action={<Button onClick={clearFilters}>{t("documents.resetFilters", "Reset filters")}</Button>}
        />
      ) : (
        <div className={CATALOGUE}>
          <Workbench>
            <section aria-label={t("documents.title", "Documents")}>
              <Table>
                <thead>
                  <tr>
                    <th scope="col" className={DOCUMENT_COLUMN}>
                      {t("documents.column.document", "Document")}
                    </th>
                    {maySeeStages && <th scope="col">{t("documents.howFar", "How far it got")}</th>}
                    <th scope="col" className="numeric">
                      {t("documents.column.versions", "Versions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((document) => (
                    <tr key={document.id} className={DENSE_ROW} data-selected={document.id === selectedId}>
                      <td className={DOCUMENT_COLUMN}>
                        <div className={DOCUMENT_NAME}>
                          <RowName selected={document.id === selectedId} onSelect={() => choose(document.id)}>
                            {document.title}
                          </RowName>
                        </div>
                        <div className={META_LINE}>
                          <span className={META_SOURCE} title={document.sourceName}>
                            {document.sourceName}
                          </span>
                          <PathText path={document.externalId} fit="middle" />
                          <span
                            className={`numeric ${META_TYPE}`}
                            title={document.parser === null ? document.mediaType : `${document.mediaType} · ${document.parser}`}
                          >
                            {document.mediaType}
                          </span>
                        </div>
                      </td>
                      {maySeeStages && (
                        <td>
                          <StageBadge stage={document.stage} documentId={document.id} />
                        </td>
                      )}
                      <td className="numeric">{document.revision}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <ListFooter
                shown={rows.length}
                total={documents.total}
                counted={plural("documents.count", rows.length, { one: "{count} document", other: "{count} documents" })}
                hasMore={documents.hasMore}
                loadingMore={documents.loadingMore}
                moreProblem={documents.moreProblem}
                onLoadMore={documents.loadMore}
              />
            </section>
            {selectedId !== null && wide && (
              <DocumentInspector
                key={selectedId}
                workspaceId={workspaceId}
                documentId={selectedId}
                stage={pipelineStageOf(selected?.stage ?? null)}
                sourceNameOf={sourceNameOf}
              />
            )}
          </Workbench>
        </div>
      )}
      {writer}
    </>
  );
}

/** What the query field's "Attributes" offer to insert — the names `jmq/sources.jmq` declares. */
const QUERY_ATTRIBUTES = [
  "document.title",
  "document.path",
  "document.source",
  "document.type",
  "document.parser",
  "document.stage",
  "document.versions",
  "document.size",
  "document.captured",
  "document.changed",
  "document.removed",
];

const QUERY_EXAMPLE = "document.type == 'text/markdown' and document.changed >= now() - days(7)";

/** A chosen capture period, its days written in the interface's own format. */
function periodText(from: string | undefined, until: string | undefined): string {
  const day = (isoDay: string | undefined) => (isoDay === undefined ? "…" : formatDay(isoDay));
  return `${day(from)} – ${day(until)}`;
}

/** An ISO day in the interface's locale — `05.10.2026` in Ukrainian. */
function formatDay(isoDay: string): string {
  const [year, month, day] = isoDay.split("-").map(Number);
  return new Intl.DateTimeFormat(currentLocale(), { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(year, month - 1, day));
}

/** The Index page's stages; a removed document has none of them. */
function pipelineStageOf(stage: CatalogueStage | null): DocumentStage | undefined {
  return stage === null || stage === "REMOVED" ? undefined : stage;
}

/** The catalogue's stage, and beside it the processing job under way, which the stage alone does not show. */
function StageBadge({ stage, documentId }: { stage: CatalogueStage | null; documentId: string }) {
  const { t } = useTranslation();
  const { activity } = useWorkspaceActivity();
  const pendingJob =
    activity === null
      ? null
      : ([...activity.running, ...activity.queued].find((job) => job.work === "PROCESSING" && job.documentId === documentId) ?? null);
  const pending =
    pendingJob === null ? null : pendingJob.status === "RUNNING" ? (
      <Badge tone="active">{t("documents.pending.running", "Processing")}</Badge>
    ) : activity?.workerAlive === false ? (
      <span title={t("documents.pending.stalledMeaning", "Queued, but the worker is not running, so nothing is parsed until it starts.")}>
        <Badge tone="warn">{t("documents.pending.stalled", "Waiting for the worker")}</Badge>
      </span>
    ) : (
      <Badge tone="neutral">{t("documents.pending.queued", "Queued")}</Badge>
    );
  if (pending !== null) {
    return <span className="inline-flex flex-wrap items-center gap-1">{stage !== null && stage !== "REMOVED" && <Badge tone={STAGE[stage].tone}>{STAGE[stage].label}</Badge>}{pending}</span>;
  }
  if (stage === null) {
    return <span className="text-xs text-muted">—</span>;
  }
  if (stage === "REMOVED") {
    return (
      <span title={t("documents.stage.removed.meaning", "Taken out of the corpus, by itself or with its source. It can be restored.")}>
        <Badge tone="deny">{t("documents.stage.removed", "Removed")}</Badge>
      </span>
    );
  }
  return (
    <span title={STAGE[stage].meaning}>
      <Badge tone={STAGE[stage].tone}>{STAGE[stage].label}</Badge>
    </span>
  );
}

interface DocumentInspectorProperties {
  workspaceId: string;
  documentId: string;
  stage: DocumentStage | undefined;
  sourceNameOf: (sourceId: string) => string;
}

// Loads the document itself rather than reading it from the list, so an address naming a document
// shared from a search result still opens it.
function DocumentInspector({ workspaceId, documentId, stage, sourceNameOf }: DocumentInspectorProperties) {
  const { t } = useTranslation();
  const detail = useResource(async () => {
    const [document, versions] = await Promise.all([
      api.getDocument(workspaceId, documentId),
      collectAllPages((page) => api.listDocumentVersions(workspaceId, documentId, page)),
    ]);
    // The file view knows the type an original is shown as — older captures were recorded as bytes.
    const file = await filesApi.file(workspaceId, document.latestVersionId).catch(() => null);
    return { document, versions, shownType: file?.effectiveMediaType ?? null };
  }, [workspaceId, documentId]);

  if (detail.status === "loading") {
    return (
      <Inspector label={t("documents.selected", "Selected document")} title={t("common.loading", "Loading…")}>
        <Waiting label={t("documents.loadingDocument", "Loading document")} />
      </Inspector>
    );
  }
  if (detail.status === "failed") {
    return (
      <Inspector label={t("documents.selected", "Selected document")} title={t("documents.column.document", "Document")}>
        <ProblemState layout="section" problem={detail.problem} actions={<Button icon="refresh" onClick={detail.reload}>{t("common.tryAgain", "Try again")}</Button>} />
      </Inspector>
    );
  }

  const { document, versions, shownType } = detail.data;
  const ordered = [...versions].sort((first, second) => second.versionNumber - first.versionNumber);
  const latest: DocumentVersionView | undefined = ordered.find((version) => version.id === document.latestVersionId) ?? ordered[0];

  return (
    <Inspector label={t("documents.selected", "Selected document")} eyebrow={sourceNameOf(document.sourceId)} title={document.title}>
      <InspectorSection title={t("documents.whereItStands", "Where it stands")}>
        {stage !== undefined && (
          <p className={STAGE_LINE}>
            <Badge tone={STAGE[stage].tone}>{STAGE[stage].label}</Badge>
            <span className="text-xs text-secondary">{STAGE[stage].meaning}</span>
          </p>
        )}
        {document.removedAt !== null && (
          <p className={STAGE_LINE}>
            <Badge tone="deny">{t("documents.stage.removed", "Removed")}</Badge>
            <span className="text-xs text-secondary">{t("documents.removedOn", "Removed {date}.", { date: formatDateTime(document.removedAt) })}</span>
          </p>
        )}
        <InspectorActions>
          <Button variant="primary" icon="arrow" href={`/documents/${document.id}`}>
            {t("documents.open", "Open document")}
          </Button>
          <Button variant="quiet" icon="folder" href={`/files?source=${document.sourceId}&file=${document.latestVersionId}${folderParameter(document)}`}>
            {t("documents.showFile", "Show the file")}
          </Button>
        </InspectorActions>
      </InspectorSection>
      <InspectorSection title={t("documents.origin", "Origin")}>
        <Facts
          rows={[
            [t("documents.fact.path", "Path"), <PathText path={document.externalId} />],
            [t("documents.source", "Source"), sourceNameOf(document.sourceId)],
            [t("documents.fact.version", "Version"), latest === undefined ? "—" : <span className="numeric">v{latest.versionNumber}</span>],
            [t("documents.fact.captured", "Captured"), latest === undefined ? "—" : <span className="numeric">{formatDateTime(latest.createdAt)}</span>],
            [t("documents.fact.addedVia", "Added via"), latest === undefined ? "—" : <CaptureOriginText origin={latest.origin} />],
            [
              t("documents.fact.identifier", "Identifier"),
              <span className={COPYABLE}>
                <span className="numeric" title={document.id}>
                  {shortIdentifier(document.id)}
                </span>
                <CopyButton value={document.id} label={t("documents.copyIdentifier", "Copy the identifier")} />
              </span>,
            ],
          ]}
        />
      </InspectorSection>
      {latest !== undefined && (
        <InspectorSection title={t("documents.latestVersion", "Latest version")}>
          <Facts
            rows={[
              [
                t("documents.fact.type", "Type"),
                <span className="numeric">
                  {shownType ?? latest.mediaType}
                  {shownType !== null && shownType !== latest.mediaType && <span className="text-xs text-muted"> · {t("documents.recordedAs", "recorded as {type}", { type: latest.mediaType })}</span>}
                </span>,
              ],
              [t("documents.fact.size", "Size"), <span className="numeric">{formatBytes(latest.sizeBytes)}</span>],
              [
                "SHA-256",
                <span className={COPYABLE}>
                  <span className="numeric" title={latest.sha256}>
                    {latest.sha256.slice(0, 16)}…
                  </span>
                  <CopyButton value={latest.sha256} label={t("documents.copyHash", "Copy the SHA-256")} />
                </span>,
              ],
            ]}
          />
        </InspectorSection>
      )}
      <InspectorSection title={t("documents.versionsCount", "Versions · {count}", { count: ordered.length })}>
        <ol className={VERSIONS}>
          {ordered.map((version) => (
            <li key={version.id} className={VERSION_ROW}>
              <span className="numeric">v{version.versionNumber}</span>
              <span className="text-xs text-secondary">{formatDateTime(version.createdAt)}</span>
              <span className="text-xs numeric">{formatBytes(version.sizeBytes)}</span>
              <span className="col-span-full text-xs text-muted">
                <CaptureOriginText origin={version.origin} />
              </span>
            </li>
          ))}
        </ol>
      </InspectorSection>
    </Inspector>
  );
}

/** The Files page opens on the document's own folder, so the file is shown among its neighbours. */
function folderParameter(document: DocumentView): string {
  const separator = document.externalId.lastIndexOf("/");
  return separator < 0 ? "" : `&folder=${encodeURIComponent(document.externalId.slice(0, separator))}`;
}
