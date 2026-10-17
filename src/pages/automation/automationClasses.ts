/**
 * Automation: the rule sets and scripts, the groups that bind them, and the log of what they did.
 *
 * ⚠️ IN ONE FILE BECAUSE EIGHT TABS AND THE SCRIPT EDITOR ARE ONE SCREEN.
 */

/* The breadcrumb link reads as the eyebrow it sits in. */
export const CRUMB = "text-inherit no-underline hover:text-accent-text hover:underline";

export const STACK = "grid min-w-0 gap-4";

export const TOOLBAR = "flex flex-wrap items-center justify-between gap-3";

export const TOOLBAR_ACTIONS = "flex flex-wrap items-center gap-3";

export const TABLE_SURFACE = "overflow-x-auto rounded-surface border border-line bg-surface";

export const PANEL = [
  "m-0 grid min-w-0 gap-3 rounded-surface border border-line bg-surface",
  "[padding:var(--space-4)_var(--space-5)_var(--space-5)]",
].join(" ");

export const SECTION_TITLE = "m-0 text-base";

export const ROW_LINK = "font-semibold text-ink no-underline hover:text-accent-text hover:underline";

export const PROBLEM = "text-danger";

export const ORDER_INPUT = "w-[calc(72px*var(--ui-scale))]";

export const DIALOG_BODY = "grid gap-4";

export const TWO_COLUMNS = [
  "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4",
  "max-[700px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

/* ── Cards: one group, one rule set, one example — each an independent object ────────────────── */

export const CARD_LIST = "m-0 grid list-none gap-3 p-0";

export const EXAMPLE_LIST = [
  "m-0 grid list-none gap-3 p-0",
  "grid-cols-[repeat(auto-fill,minmax(calc(300px*var(--ui-scale)),1fr))]",
].join(" ");

/* ⚠️ A COLUMN, NOT A GRID, so the actions row can take the leftover height and sit on the card's
   floor: cards in one grid row share a height, and their actions then share a line whatever each
   description's length. */
export const CARD = [
  "flex flex-col gap-3 rounded-surface border border-line bg-surface p-4 [&_p]:m-0",
].join(" ");

export const CARD_HEAD = "flex flex-wrap items-start justify-between gap-3";

export const CARD_ACTIONS = "mt-auto flex gap-1";

/* ⚠️ `justify-items-start` IS WHY A BADGE KEEPS ITS NATURAL WIDTH instead of filling its column like
   a bar. On a phone the four columns become one. */
export const BINDINGS = [
  "m-0 grid list-none border-t border-line p-0",
  "[&>li]:grid [&>li]:items-center [&>li]:justify-items-start [&>li]:gap-3",
  "[&>li]:grid-cols-[calc(28px*var(--ui-scale))_minmax(calc(130px*var(--ui-scale)),auto)_minmax(0,1fr)_auto]",
  "[&>li]:border-b [&>li]:border-line [&>li]:py-2",
  "[&>li[data-enabled=false]]:text-muted",
  "max-[700px]:[&>li]:grid-cols-[minmax(0,1fr)] max-[700px]:[&>li]:gap-1",
].join(" ");

/* ── The script editor ─────────────────────────────────────────────────────────────────────── */

export const EDITOR_LAYOUT = [
  "grid grid-cols-[minmax(0,1fr)_calc(300px*var(--ui-scale))] items-start gap-6",
  "max-[1200px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

export const EDITOR_MAIN = "grid min-w-0 gap-4";

export const EDITOR_SIDE = [
  "sticky top-[calc(52px*var(--ui-scale)+var(--space-4))] grid gap-4",
  "max-[1200px]:static",
].join(" ");

export const SIDE_PANEL =
  "grid gap-2 rounded-surface border border-line bg-surface p-4 [&_p]:m-0";

export const SIDE_TITLE = "m-0 text-base";

export const VARIABLES = [
  "m-0 flex list-none flex-wrap gap-1 p-0",
  "[&_code]:inline-block [&_code]:rounded-[calc(3px*var(--ui-scale))] [&_code]:bg-accent-soft",
  "[&_code]:px-2 [&_code]:py-[calc(1px*var(--ui-scale))] [&_code]:text-xs [&_code]:text-accent-text",
].join(" ");

/* ⚠️ On a phone the bar keeps its state on one line and its actions on the next, side by side and
   each taking half — a stack of full-width buttons at the foot of a page reads as a dialog. */
export const SAVE_BAR = [
  "sticky bottom-0 z-5 flex items-center justify-between gap-3",
  "rounded-surface border border-line bg-surface px-4 py-3 text-muted",
  "data-[dirty=true]:border-accent-text data-[dirty=true]:text-ink",
  "data-[dirty=true]:shadow-[inset_2px_0_0_var(--accent)]",
  "max-[640px]:flex-wrap",
  "max-[640px]:[&>span]:basis-full max-[640px]:[&>span]:overflow-hidden",
  "max-[640px]:[&>span]:text-ellipsis max-[640px]:[&>span]:whitespace-nowrap",
].join(" ");

export const SAVE_ACTIONS = [
  "flex gap-2",
  "max-[640px]:basis-full max-[640px]:[&>*]:flex-1",
].join(" ");

/* ── Decisions ─────────────────────────────────────────────────────────────────────────────── */

/* Four short facts on one row, the text under them at full width, the action on a row of its own. */
export const DRY_RUN = [
  "grid items-start gap-3 [&>.full]:col-span-full",
  "grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.7fr)]",
  "max-[1200px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
  "max-[700px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

export const DRY_RUN_RESULT =
  "grid gap-2 border-l-2 border-l-accent bg-accent-soft p-3";

export const TRACE_CELL = "bg-well";

export const TRACE = [
  "m-0 grid list-none gap-1 p-0",
  "[&>li]:flex [&>li]:flex-wrap [&>li]:items-baseline [&>li]:gap-2 [&>li]:whitespace-normal",
].join(" ");

export const EXECUTIONS = "mt-3 grid gap-[calc(2px*var(--ui-scale))]";

/* ── Log ───────────────────────────────────────────────────────────────────────────────────── */

export const LOG = [
  "m-0 grid list-none rounded-surface border border-line bg-surface p-0",
  "[&>li]:grid [&>li]:items-baseline [&>li]:gap-3 [&>li]:border-b [&>li]:border-line",
  "[&>li]:px-3 [&>li]:py-2",
  "[&>li]:grid-cols-[calc(150px*var(--ui-scale))_auto_minmax(calc(120px*var(--ui-scale)),auto)_minmax(calc(120px*var(--ui-scale)),auto)_minmax(0,1fr)]",
  "[&>li[data-level=WARN]]:shadow-[inset_2px_0_0_var(--warn)]",
  "max-[700px]:[&>li]:grid-cols-[minmax(0,1fr)] max-[700px]:[&>li]:gap-1",
].join(" ");

export const LOG_MESSAGE = "[overflow-wrap:anywhere]";

/* The source editor's own label row: a CodeMirror surface is not a form control a <label> can name. */
export const SOURCE_FIELD = "grid min-w-0 gap-2";

export const SOURCE_HEAD = [
  "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1",
  "[&_code]:rounded-[calc(3px*var(--ui-scale))] [&_code]:bg-well",
  "[&_code]:px-[calc(3px*var(--ui-scale))] [&_code]:text-2xs",
].join(" ");

export const SOURCE_LABEL = "text-sm font-semibold";

/*
 * Draft, published, bound: done steps are blue, the one to take next is outlined, later ones wait.
 *
 * ⚠️ THE NUMBERS ARE A CSS COUNTER, not text in the markup, which is why a finished step can swap its
 * number for a tick without the component knowing how many steps came before it.
 */
export const LIFECYCLE = [
  "m-0 grid list-none gap-2 p-0 [counter-reset:step]",
  "[&>li]:grid [&>li]:grid-cols-[calc(22px*var(--ui-scale))_minmax(0,1fr)] [&>li]:gap-x-2",
  "[&>li]:[counter-increment:step]",
  "[&>li]:before:row-span-2 [&>li]:before:grid [&>li]:before:size-[calc(22px*var(--ui-scale))]",
  "[&>li]:before:place-items-center [&>li]:before:rounded-full [&>li]:before:border",
  "[&>li]:before:border-line-strong [&>li]:before:text-2xs [&>li]:before:font-[650]",
  "[&>li]:before:text-muted [&>li]:before:content-[counter(step)]",
  "[&>li[data-state=done]]:before:border-allow [&>li[data-state=done]]:before:bg-allow-soft",
  "[&>li[data-state=done]]:before:text-allow [&>li[data-state=done]]:before:content-['✓']",
  "[&>li[data-state=current]]:before:border-accent-text [&>li[data-state=current]]:before:text-accent-text",
  "[&>li[data-state=waiting]_strong]:text-muted",
].join(" ");

export const FACADES = [
  "m-0 grid gap-1",
  "[&>div]:grid [&>div]:grid-cols-[auto_minmax(0,1fr)] [&>div]:items-baseline [&>div]:gap-2",
  "[&_dd]:m-0 [&_code]:text-xs [&_code]:text-accent-text",
].join(" ");
