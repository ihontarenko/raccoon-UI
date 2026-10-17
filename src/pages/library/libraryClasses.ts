/**
 * The Library's explorer: a shelf, a reading desk with tabs, and the context of the document in front.
 *
 * ⚠️ THE DESK HAS A HEIGHT OF ITS OWN, so the reader and the outline scroll inside it while the shelf and the tabs
 * stay where they are — reading a long document never scrolls the tab you came from out of sight.
 */

/* ── Layout ─────────────────────────────────────────────────────────────────────────────────── */

export const EXPLORER = [
  "grid grid-cols-[minmax(0,calc(260px*var(--ui-scale)))_minmax(0,1fr)] items-start gap-4",
  "max-[900px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

export const DESK_HEIGHT = "h-[max(calc(520px*var(--ui-scale)),calc(100dvh-52px*var(--ui-scale)-200px))]";

/* ── Shelf ──────────────────────────────────────────────────────────────────────────────────── */

export const SHELF = [
  "sticky top-[calc(52px*var(--ui-scale)+var(--space-4))] grid min-w-0 grid-rows-[auto_auto_auto_minmax(0,1fr)] gap-2",
  "rounded-surface border border-line bg-surface p-2",
  DESK_HEIGHT,
  "max-[900px]:static max-[900px]:h-auto max-[900px]:max-h-[60dvh] max-[900px]:data-[open=false]:hidden",
].join(" ");

/* The shelf's drawer handle exists only where the shelf is a drawer. */
export const SHELF_TOGGLE = "mb-2 hidden max-[900px]:block";

export const SHELF_FILTER = [
  "relative flex items-center text-muted",
  "[&>:first-child]:pointer-events-none [&>:first-child]:absolute [&>:first-child]:left-2",
  "[&_input]:w-full [&_input]:pl-[calc(28px*var(--ui-scale))]",
].join(" ");

/* ⚠️ A grid item is as wide as its longest name unless told otherwise; min-w-0 lets the names truncate instead. */
export const SHELF_DOCUMENTS = "m-0 grid min-h-0 list-none content-start gap-px overflow-y-auto overflow-x-hidden p-0 [&>li]:min-w-0";

export const SHELF_HEADING = "px-1 pt-2 pb-1 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase";

/* One document on the shelf: its mark, its name; the one in front carries the accent stripe, open ones a dot. */
export const SHELF_ITEM = [
  "relative flex w-full min-w-0 items-center gap-2 rounded-[calc(3px*var(--ui-scale))] border-0 bg-transparent px-2 py-1",
  "text-left text-xs text-secondary hover:bg-well hover:text-ink",
  "aria-[current=true]:bg-accent-soft aria-[current=true]:font-semibold aria-[current=true]:text-ink",
  "aria-[current=true]:before:absolute aria-[current=true]:before:inset-y-1 aria-[current=true]:before:left-0",
  "aria-[current=true]:before:w-[2px] aria-[current=true]:before:bg-accent aria-[current=true]:before:content-['']",
].join(" ");

export const SHELF_NAME = "min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap";

export const OPEN_DOT = "size-1.5 flex-none rounded-full bg-accent";

/* ── Desk ───────────────────────────────────────────────────────────────────────────────────── */

export const DESK = [
  /* ⚠️ Rows alone leave the column implicit, and an implicit column is auto — as wide as the longest line inside. */
  "grid min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-surface border border-line bg-surface",
  DESK_HEIGHT,
  "max-[900px]:h-[calc(100dvh-52px*var(--ui-scale)-120px)] max-[900px]:min-h-[calc(420px*var(--ui-scale))]",
].join(" ");

/* Tabs read as a strip of documents: the one in front joins the page below it, the rest sit on the well. */
export const TABS = "flex min-w-0 items-end gap-px overflow-x-auto border-b border-line bg-well px-1 pt-1";

export const TAB = [
  "group/tab flex max-w-[calc(220px*var(--ui-scale))] flex-none items-center gap-1.5 border border-b-0 border-transparent",
  "rounded-t-[calc(3px*var(--ui-scale))] px-2 py-1.5 text-xs text-secondary",
  "hover:bg-surface hover:text-ink",
  "data-[active=true]:-mb-px data-[active=true]:border-line data-[active=true]:bg-surface data-[active=true]:font-semibold data-[active=true]:text-ink",
].join(" ");

export const TAB_LABEL = "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap border-0 bg-transparent p-0 text-left font-[inherit] text-inherit";

export const TAB_CLOSE = [
  "grid size-[calc(18px*var(--ui-scale))] flex-none place-items-center rounded-[2px] border-0 bg-transparent p-0 text-muted",
  "opacity-0 group-hover/tab:opacity-100 group-data-[active=true]/tab:opacity-100 focus-visible:opacity-100",
  "hover:bg-well hover:text-ink pointer-coarse:opacity-100",
].join(" ");

/* The document in front: its head, then the reader beside its context. */
export const READING = "grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)]";

export const READING_HEAD = "flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-2.5 max-[600px]:px-3";

export const READING_TITLE = [
  "grid min-w-0 flex-1 gap-0.5",
  "[&_h2]:m-0 [&_h2]:overflow-hidden [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ellipsis [&_h2]:whitespace-nowrap",
  "[&>span]:overflow-hidden [&>span]:text-ellipsis [&>span]:whitespace-nowrap",
  /* On a phone the name takes the first line whole; the status and the actions wrap below it. */
  "max-[600px]:basis-[calc(100%-2.5rem)]",
].join(" ");

export const READING_BODY = [
  "relative grid min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,calc(280px*var(--ui-scale)))]",
  "max-[1200px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

/* Prose is read at a generous measure — the face is monospaced and the reader is at a desk; code and pages take the width they need. */
export const STAGE = [
  "grid min-h-0 overflow-hidden p-3",
  "[grid-template:minmax(0,1fr)_/_minmax(0,1fr)]",
  "data-[prose=true]:[&_[data-reader-stage]]:mx-auto data-[prose=true]:[&_[data-reader-stage]]:w-full data-[prose=true]:[&_[data-reader-stage]]:max-w-[150ch] [--prose-measure:none]",
].join(" ");

/* ── Context ────────────────────────────────────────────────────────────────────────────────── */

/* Beside the reader on a wide screen; below 1200px a panel that slides over its right edge when asked for. */
export const CONTEXT = [
  "grid min-h-0 grid-cols-[minmax(0,1fr)] content-start gap-5 overflow-y-auto overflow-x-hidden border-l border-line bg-surface px-3 py-3",
  /* ⚠️ Each section is a grid too; without a column of its own a long heading widens the whole panel. */
  "[&>section]:min-w-0 [&>section]:grid-cols-[minmax(0,1fr)]",
  "max-[1200px]:absolute max-[1200px]:inset-y-0 max-[1200px]:right-0 max-[1200px]:z-10",
  "max-[1200px]:w-[min(calc(320px*var(--ui-scale)),88%)] max-[1200px]:shadow-[-8px_0_24px_rgb(0_0_0/0.12)]",
  "max-[1200px]:data-[open=false]:hidden",
].join(" ");

export const CONTEXT_TOGGLE = "hidden max-[1200px]:inline-flex";

export const CONTEXT_CLOSE = "hidden justify-self-end max-[1200px]:block";

export const CONTEXT_HEADING = "m-0 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase";

/* A table of contents hung on a rule: the depth is the indent, the part being read is marked on the rule itself. */
export const OUTLINE = "m-0 grid list-none grid-cols-[minmax(0,1fr)] border-l border-line p-0";

export const OUTLINE_ITEM = [
  "-ml-px block w-full overflow-hidden text-ellipsis whitespace-nowrap border-0 border-l-2 border-solid border-transparent bg-transparent py-1 pr-2 text-left",
  "text-xs leading-snug text-secondary transition-[color,border-color] duration-120 hover:border-line-strong hover:text-ink",
  "data-[level=1]:font-semibold data-[level=1]:text-ink data-[level=3]:text-muted data-[level=4]:text-muted",
  "data-[active=true]:border-accent data-[active=true]:bg-accent-soft data-[active=true]:text-accent-text",
].join(" ");

export const RELATED = "m-0 grid list-none gap-1.5 p-0";

export const RELATED_ITEM = [
  "grid w-full gap-0.5 rounded-control border border-line bg-surface px-2 py-1.5 text-left",
  "hover:border-accent",
].join(" ");

export const FACTS = [
  "m-0 grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1 text-xs",
  "[&>dt]:text-muted [&>dd]:m-0 [&>dd]:[overflow-wrap:anywhere]",
].join(" ");

/* ── Welcome ────────────────────────────────────────────────────────────────────────────────── */

export const WELCOME = "grid min-h-0 content-start gap-5 overflow-auto p-6 max-[600px]:p-4";

export const KEY = "rounded-[2px] border border-line-strong bg-well px-1.5 py-0.5 font-mono text-[11px] text-ink";

/* ── Quick open ─────────────────────────────────────────────────────────────────────────────── */

export const QUICK_LIST = "m-0 grid max-h-[50dvh] list-none gap-px overflow-auto p-0";

export const QUICK_ITEM = [
  "flex w-full min-w-0 items-center gap-2 rounded-[3px] border-0 bg-transparent px-2 py-1.5 text-left text-sm",
  "hover:bg-well aria-selected:bg-accent-soft",
].join(" ");

/* ── Reading mode ───────────────────────────────────────────────────────────────────────────── */

/* Over everything, the shell included: the page is the document. */
export const READING_MODE = "fixed inset-0 z-50 grid grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] bg-bg outline-none";

/* A bar control keeps its icon and drops its word where the title needs the room. */
export const READING_BAR_WORD = "max-[600px]:sr-only";

/* A slim bar that slides up out of the way while reading down, and comes back on the way up. */
export const READING_BAR = [
  "flex min-w-0 items-center gap-1 border-b border-line bg-surface px-2 py-1",
  "transition-[margin] duration-120 motion-reduce:transition-none",
  "data-[hidden=true]:-mt-[calc(44px*var(--ui-scale))]",
].join(" ");

export const READING_BAR_TITLE = "min-w-0 flex-1 overflow-hidden px-1 text-sm font-semibold text-ellipsis whitespace-nowrap";

export const READING_STAGE = "grid min-h-0 overflow-hidden [grid-template:minmax(0,1fr)_/_minmax(0,1fr)]";
