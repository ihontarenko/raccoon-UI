/**
 * A source's own page: the overview, the scans, and how documents reach it.
 *
 * ⚠️ IN ONE FILE BECAUSE NINE COMPONENTS ARE ONE PAGE — the page, its tabs, the arrival sections and
 * the dialogs they open.
 */

/* The breadcrumb link reads as the eyebrow it sits in. */
export const CRUMB_LINK = "text-inherit no-underline hover:text-accent-text hover:underline";

/* One line, however long the path: the full path is in the title and on the Overview tab. */
export const LOCATION = [
  "flex min-w-0 items-center gap-2 text-secondary",
  "[&>span]:min-w-0 [&_svg]:flex-none [&_svg]:text-muted",
].join(" ");

export const SECTION_TITLE = "text-base";

/* ── Overview ───────────────────────────────────────────────────────────────────────────────── */

export const OVERVIEW = [
  "grid grid-cols-3 rounded-surface border border-line bg-surface",
  "max-[1100px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

/* ⚠️ The rule between blocks moves from the side to the top when they stack, and the removal is
   marked important: a media query adds no specificity over `not-first:border-l`. */
export const BLOCK = [
  "grid min-w-0 content-start gap-3 p-6",
  "not-first:border-l not-first:border-line",
  "max-[1100px]:not-first:border-l-0! max-[1100px]:not-first:border-t max-[1100px]:not-first:border-line",
].join(" ");

/* Every block head is as tall as a button, with or without one, so the three titles line up. */
export const BLOCK_HEAD = "flex min-h-(--control) items-center justify-between gap-2";

export const SCAN_LINE = "m-0 flex items-center gap-2";

export const COUNTERS = [
  "m-0 grid grid-cols-2 gap-x-4 gap-y-3",
  "[&>dt]:text-2xs [&>dt]:tracking-[0.06em] [&>dt]:text-muted [&>dt]:uppercase",
  "[&>dd]:m-0 [&>dd]:text-lg [&>dd]:font-semibold",
].join(" ");

export const RULE_SUMMARY = [
  "m-0 grid list-none gap-2 p-0",
  "[&>li]:flex [&>li]:min-w-0 [&>li]:items-center [&>li]:gap-2",
].join(" ");

/* Scanning settings, a strip under the overview. */
export const SCANNING_STRIP = [
  "mt-4 flex flex-wrap items-center justify-between gap-3",
  "rounded-surface border border-line bg-surface px-6 py-3",
].join(" ");

export const SCANNING_FACTS = "flex min-w-0 flex-wrap items-baseline gap-3";

export const SCANNING_ACTIONS = "flex items-center gap-4";

/* The scanning switch with its "About …" button. */
export const SCANNING_SWITCH = "inline-flex items-start gap-1";

export const DIALOG_BODY = "grid gap-4";

/* ── Scans ─────────────────────────────────────────────────────────────────────────────────── */

export const SCANS = "grid gap-6";

/* ⚠️ A table wider than the screen scrolls inside its frame, never the page. */
export const TABLE_SURFACE = "overflow-x-auto rounded-surface border border-line bg-surface";

export const SCAN_FILES = "grid gap-3";

export const SCAN_FILES_HEAD = "flex flex-wrap items-start justify-between gap-4";

/* The variables a scan script is given, marked as a reference rather than as prose. */
export const SCRIPT_VARIABLES = [
  "m-0 flex gap-4 border-l-2 border-l-accent bg-accent-soft px-3 py-2 text-xs",
  "[&_div]:flex [&_div]:gap-2 [&_dd]:m-0 [&_dd]:font-semibold",
].join(" ");

export const POSITION_CELL = "w-[1%] whitespace-nowrap";

export const PATH_CELL = "max-w-[calc(640px*var(--ui-scale))] overflow-hidden text-ellipsis";

/* A removal notice opens the page body: the same gap below it as below the tab strip. */
export const REMOVAL_NOTICE = "mb-6";

/* ── How documents reach the source ───────────────────────────────────────────────────────── */

export const ARRIVAL =
  "mt-4 grid gap-3 rounded-surface border border-line bg-surface p-4";

export const ARRIVAL_HEAD = "grid gap-1";

export const ARRIVAL_BODY = "grid min-w-0 gap-4";

export const ARRIVAL_FACTS = [
  "m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm",
  "[&>dt]:text-muted [&>dd]:m-0 [&>dd]:[overflow-wrap:anywhere]",
].join(" ");

export const ARRIVAL_FORM = "grid max-w-[calc(560px*var(--ui-scale))] gap-3";

export const REPOSITORY_ACCESS = "grid gap-3 border-t border-line pt-3";

export const ARRIVAL_ACTIONS = "flex flex-wrap items-center gap-3";

export const REFUSALS = "[&_ul]:mx-0 [&_ul]:mt-2 [&_ul]:mb-0 [&_ul]:pl-4";

export const CODE_BLOCK = [
  "m-0 rounded-control border border-line bg-well p-3",
  "font-mono text-2xs leading-[1.6] whitespace-pre-wrap [overflow-wrap:anywhere]",
].join(" ");

export const ARRIVAL_INLINE = "inline-flex flex-wrap items-center gap-2";

/* A source with no connection yet: the choice of one, under the connection facts. ⚠️ In this narrow
   column the picker's own two-column grid would cut every connection name, so it stacks — one
   connection per line. */
export const CONNECTION_CHOICE = [
  "grid gap-3 border-t border-line pt-2",
  "[&_[role=radiogroup]>div]:grid-cols-[minmax(0,1fr)]",
].join(" ");

/* The card's own actions: the thing to do, then the way to the full list. */
export const CARD_ACTIONS = "flex flex-wrap items-center gap-2";
