/**
 * The index: what was embedded, what was keyed, and the dialogs that start either.
 *
 * ⚠️ IN ONE FILE BECAUSE NINE TABS AND DIALOGS ARE ONE SCREEN — the page, its seven tabs and the two
 * dialogs they open all read as the index.
 */

export const DIALOG_BODY = "grid gap-4";

/* ── The preflight report, shown before anything is spent ─────────────────────────────────────── */

export const PREFLIGHT = "grid gap-3 rounded-surface border border-line bg-well p-4";

export const PREFLIGHT_HEAD = "flex flex-wrap justify-between gap-3";

/* Four figures across; two by two on a phone, because a figure squeezed to one column is a figure
   nobody compares. */
export const PREFLIGHT_FACTS = [
  "m-0 grid grid-cols-4 gap-3",
  "[&>dt]:text-2xs [&>dt]:tracking-[0.06em] [&>dt]:text-muted [&>dt]:uppercase",
  "[&>dd]:mx-0 [&>dd]:mt-[calc(2px*var(--ui-scale))] [&>dd]:mb-0 [&>dd]:text-md [&>dd]:font-[650]",
  "max-[700px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
].join(" ");

export const BUDGETS = "m-0 flex flex-wrap gap-1";

export const POLICY = [
  "rounded-control border border-line",
  "[&>summary]:cursor-pointer [&>summary]:px-3 [&>summary]:py-2 [&>summary]:font-semibold",
].join(" ");

export const POLICY_GRID = [
  "grid grid-cols-2 gap-3 border-t border-line p-3",
  "max-[700px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
].join(" ");

/* ── The index page ───────────────────────────────────────────────────────────────────────────── */

/* ⚠️ ONE EXPLICIT COLUMN. An implicit one grows to the widest table and drags the whole page past
   the edge of the screen, which is how a page of tables ends up with a horizontal scrollbar on the
   page rather than on the table. */
export const PAGE = "grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6";

export const TABLE_SURFACE = "overflow-x-auto rounded-surface border border-line bg-surface";

export const TOOLBAR = "flex flex-wrap items-center justify-between gap-3";

export const TOOLBAR_ACTIONS = "flex flex-wrap items-center gap-2";

export const SECTION_TITLE = "text-base";

export const SPLIT = [
  "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-4",
  "max-[1100px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

export const DETAIL = "grid gap-4 rounded-surface border border-line bg-surface p-4";

export const DETAIL_HEAD = "flex flex-wrap items-start justify-between gap-3";

/* The numbers of one vector: bounded and scrolled, because the whole of it is thousands of them. */
export const VECTOR_VALUES = [
  "m-0 max-h-[calc(220px*var(--ui-scale))] overflow-auto rounded-control border border-line bg-well p-3",
  "font-mono text-2xs leading-[1.6] [overflow-wrap:anywhere]",
].join(" ");

export const ROW_LINK = "font-semibold text-ink no-underline hover:text-accent-text hover:underline";

/* Two lines and then an ellipsis: a cell of prose in a table of counts. */
export const CLAMP_TWO_LINES = "line-clamp-2";

export const WARNING = "text-warn";

export const AUDIT_LIST = "m-0 grid list-none gap-1 p-0";

/* One line under the tab strip saying what this tab holds — the tab name alone is not enough. */
export const TAB_LEAD_LINE = "mx-0 mt-0 mb-3 text-sm text-secondary";

export const STEP_LINK = "text-sm font-semibold whitespace-nowrap text-accent-text hover:underline";

/* The full counts, closed by default: the chain says what matters, these say everything. */
export const TOTALS = [
  "[&>summary]:mb-2 [&>summary]:w-fit [&>summary]:cursor-pointer",
  "[&>summary]:text-sm [&>summary]:text-secondary",
].join(" ");

/* Each stage said once, above the table, rather than repeated in every row. */
export const STAGE_LEGEND = [
  "m-0 grid grid-cols-[repeat(auto-fit,minmax(calc(260px*var(--ui-scale)),1fr))] gap-x-6 gap-y-2",
  "[&>div]:flex [&>div]:items-baseline [&>div]:gap-2",
  "[&_dt]:flex-none [&_dd]:m-0 [&_dd]:text-xs [&_dd]:text-secondary",
].join(" ");

/*
 * ⚠️ THE STAGE IS SHOWN TWICE AND EXACTLY ONE OF THEM IS VISIBLE. On a phone it is the fact that
 * matters, so it moves under the document's name instead of sitting in a column scrolled off the
 * screen — and the column it came from is hidden, or the same fact would be read twice.
 */
export const STAGE_INLINE = "mt-1 hidden max-[700px]:block";

export const STAGE_COLUMN = "max-[700px]:hidden";
