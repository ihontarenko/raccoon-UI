/**
 * A source's indexing: what is prepared, what is bound, and the deliberate run that does it.
 *
 * ⚠️ IN ONE FILE BECAUSE FOUR SECTIONS ARE ONE PANEL, read top to bottom on one screen.
 */

export const PANEL = "grid min-w-0 gap-6";

/* Two unequal columns — the settings beside the list they act on — until there is no room for two. */
export const SPLIT = [
  "grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] items-start gap-6",
  "max-[1200px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

export const BLOCK = [
  "grid min-w-0 gap-4 rounded-surface border border-line bg-surface",
  "[padding:var(--space-4)_var(--space-5)_var(--space-5)]",
  "max-[700px]:[padding:var(--space-3)_var(--space-4)_var(--space-4)]",
].join(" ");

export const BLOCK_HEAD = "flex items-start justify-between gap-3";

/* The state beside a block's title: never squeezed by a long description beside it. */
export const BLOCK_STATE = "inline-flex shrink-0 items-center gap-2 whitespace-nowrap";

export const BLOCK_TITLE = "mx-0 mt-0 mb-[calc(2px*var(--ui-scale))] text-base";

export const TABLE_SURFACE = "overflow-x-auto rounded-surface border border-line bg-surface";

export const DOCUMENT_LINK =
  "font-semibold text-ink no-underline hover:text-accent-text hover:underline";

/* The three deliberate steps, numbered in the order they must happen. */
export const RUN_FORM = "grid gap-3";

export const STEP = "grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-t border-line pt-3";

export const STEP_NUMBER = [
  "grid size-[calc(24px*var(--ui-scale))] place-items-center rounded-[calc(3px*var(--ui-scale))]",
  "border border-line-strong text-xs text-secondary [font-variant-numeric:tabular-nums]",
].join(" ");

export const STEP_BODY = "grid min-w-0 gap-2";

export const RUN_CONTROLS = "flex flex-wrap items-center gap-2";

export const PROGRESS = "grid max-w-[calc(520px*var(--ui-scale))] gap-1";

export const PROGRESS_BAR = [
  "h-[calc(6px*var(--ui-scale))] overflow-hidden rounded-[calc(3px*var(--ui-scale))] bg-well",
  "shadow-[inset_0_0_0_1px_var(--line)]",
  "[&>span]:block [&>span]:h-full [&>span]:bg-accent",
  "[&>span]:transition-[width] [&>span]:duration-120 motion-reduce:[&>span]:transition-none",
].join(" ");

export const FAILURES = "m-0 pl-4 text-xs text-danger";

export const BINDING_FORM = "m-0 grid min-w-0 gap-3 border-0 p-0";

export const BINDING_FOOTER = "flex flex-wrap items-start justify-between gap-3";

export const HISTORY = [
  "border-t border-line pt-3",
  "[&>summary]:cursor-pointer [&>summary]:text-xs [&>summary]:font-semibold [&>summary]:text-secondary",
  "[&[open]>summary]:mb-3",
].join(" ");

export const HISTORY_LIST = "m-0 grid gap-1 pl-4 text-xs";

export const TRAIL_CELL = "bg-well";

export const TRAIL = "m-0 grid list-none gap-1 p-0 text-xs";
