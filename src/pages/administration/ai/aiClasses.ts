/**
 * The AI administration: what is in force, the providers and their accounts, the prompts, the tools
 * and the agents.
 *
 * ⚠️ IN ONE FILE BECAUSE NINE PANELS ARE ONE SECTION, reached through the same strip and read one
 * after another — including the two connection panels, which live a directory away and share it.
 */

export const PANEL = "grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6";

/* A strip of facts across the top: what is in force decides everything else on the screen. */
/* ⚠️ A WRAPPING ROW, NOT A FIXED GRID: four facts and a button in fixed fractions squeezed every label onto two
   or three lines at an ordinary width. Each fact keeps a readable minimum, and the action is pushed to the end. */
export const STATUS_STRIP = [
  "flex flex-wrap items-center gap-x-6 gap-y-3 rounded-surface border border-line bg-surface p-4",
  "[&>*:not(:last-child)]:min-w-[calc(150px*var(--ui-scale))] [&>*:not(:last-child)]:flex-1",
  "[&>:last-child]:ml-auto",
].join(" ");

export const STATUS_CELL = "grid min-w-0 gap-1 [&_strong]:[overflow-wrap:anywhere]";

export const TABLE_SURFACE = "overflow-x-auto rounded-surface border border-line bg-surface";

export const CHIP_ROW = "mb-[calc(2px*var(--ui-scale))] flex flex-wrap gap-1";

/* ⚠️ Inside a table cell the actions WRAP onto a second line rather than push the table past its
   frame, which is why this is a flex row of its own rather than buttons laid straight into the cell. */
export const ROW_ACTIONS =
  "flex flex-wrap items-center justify-end gap-[calc(2px*var(--ui-scale))]";

export const SECTION_TITLE = "mb-3 text-base";

export const CATALOGUE = "min-w-0";

/* Two columns of entries; the vertical rule between them is drawn by the odd-numbered ones, and goes
   when there is only one column left to draw it against. */
export const CATALOGUE_LIST = [
  "m-0 grid list-none grid-cols-2 overflow-hidden rounded-surface border border-line bg-surface p-0",
  "[&>li]:grid [&>li]:grid-cols-[calc(100px*var(--ui-scale))_minmax(0,1fr)]",
  "[&>li]:gap-x-3 [&>li]:gap-y-1 [&>li]:border-b [&>li]:border-line [&>li]:px-4 [&>li]:py-3",
  "[&>li:nth-child(odd)]:border-r [&>li:nth-child(odd)]:border-r-line",
  "[&>li>:last-child]:col-start-2",
  "max-[700px]:grid-cols-[minmax(0,1fr)] max-[700px]:[&>li:nth-child(odd)]:border-r-0!",
].join(" ");

export const CATALOGUE_NAME = "font-mono font-semibold";

/* ── Forms ─────────────────────────────────────────────────────────────────────────────────── */

export const FORM = "grid gap-4";

export const FIELDSET = "m-0 grid gap-2 border-0 p-0";

export const LEGEND = "mb-1 p-0 text-xs font-semibold";

export const INLINE_ROW = "flex flex-wrap gap-x-6 gap-y-2";

export const ERROR = "m-0 text-xs text-danger";

export const TWO_COLUMNS = [
  "grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-3",
  "max-[700px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

/* ── Lists of settings, agents and calls ──────────────────────────────────────────────────── */

export const LIST = "m-0 grid list-none rounded-surface border border-line bg-surface p-0";

export const LIST_ITEM = "grid gap-3 p-4 not-first:border-t not-first:border-line";

export const LIST_HEAD = "flex flex-wrap items-start justify-between gap-3";

export const LIST_TITLE =
  "grid min-w-0 gap-[calc(2px*var(--ui-scale))] [&_strong]:text-base";

export const VALUES = "m-0 grid list-none gap-2 p-0";

/* The value in force is lifted onto the surface and marked on its edge; the others rest on the well. */
export const VALUE_CARD = [
  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 rounded-control border border-line bg-well p-3",
  "data-[in-force=true]:border-accent-text data-[in-force=true]:bg-surface",
  "data-[in-force=true]:shadow-[inset_2px_0_0_var(--accent)]",
].join(" ");

export const VALUE_TEXT = [
  "col-span-full m-0 max-h-[calc(160px*var(--ui-scale))] overflow-auto",
  "font-mono text-xs whitespace-pre-wrap [overflow-wrap:anywhere]",
].join(" ");

export const CONNECTIONS = "m-0 grid list-none gap-1 p-0";

export const CONNECTION = [
  "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-control border border-line",
  "px-3 py-2 text-xs",
  "data-[revoked=true]:bg-well data-[revoked=true]:text-muted",
].join(" ");

/* ── Call limits ───────────────────────────────────────────────────────────────────────────── */

export const USAGE = [
  "m-0 grid grid-cols-4 gap-4 rounded-surface border border-line bg-well px-4 py-3",
  "[&>dt]:text-2xs [&>dt]:tracking-[0.06em] [&>dt]:text-muted [&>dt]:uppercase",
  "[&>dd]:mx-0 [&>dd]:mt-[calc(2px*var(--ui-scale))] [&>dd]:mb-1 [&>dd]:font-[650]",
  "max-[700px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

export const METER = [
  "block h-[calc(4px*var(--ui-scale))] overflow-hidden rounded-[calc(2px*var(--ui-scale))] bg-line",
  "[&>span]:block [&>span]:h-full [&>span]:bg-accent",
].join(" ");

export const HISTORY = [
  "[&>summary]:mb-2 [&>summary]:cursor-pointer [&>summary]:text-xs",
  "[&>summary]:font-semibold [&>summary]:text-secondary",
].join(" ");

/* A tool's description is the column worth reading; it gets the width instead of wrapping to ten
   lines. */
export const DESCRIPTION_CELL = "min-w-[44ch]";

/* The change of a configuration's state sits under the state it changes — and takes no room when
   there is no change to report. */
export const STATE_CHANGE = "mt-1 empty:hidden";

/* The budget a provider account shares across capabilities, under the per-capability limits. */
export const SHARED_BUDGET =
  "grid gap-3 border-t border-line pt-4 [&>h3]:m-0 [&>h3]:text-base";

/* A checkbox with its "About …" button at the end of the line. */
export const CHECK_LINE = "flex items-start gap-1";
