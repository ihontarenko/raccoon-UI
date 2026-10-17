/**
 * The looks the administration panels share: accounts, members, workspaces, credentials, jobs and
 * the system parameters.
 *
 * ⚠️ IN ONE FILE BECAUSE SIX PANELS ARE ONE SCREEN. They are reached through the same section strip
 * and read one after another, so a toolbar that sits differently in one of them, or a list surface
 * with another border, reads as a different product rather than another page. The CSS Module these
 * replace was shared by exactly these six files.
 */

export const PANEL_TOOLBAR = "mb-4 flex flex-wrap items-center justify-between gap-3";

/** The bordered surface the list panels sit on. */
export const PANEL_SURFACE = "grid rounded-surface border border-line bg-surface";

export const PANEL_FORM = "grid gap-4";

export const PANEL_ACTIONS = "flex flex-wrap gap-2";

export const ACCOUNT_NAME = "font-[550]";

/** A name and the tags beside it, kept apart by a gap rather than a collapsible space. */
export const NAME_LINE = "flex flex-wrap items-center gap-2";

/** A configuration document, shown as it is written. */
export const CONFIGURATION = [
  "m-0 rounded-control border border-line bg-well p-3",
  "font-mono text-2xs leading-[1.7] whitespace-pre-wrap [overflow-wrap:anywhere]",
].join(" ");

/** The attempts a job has made, one under another, each ruled off but the last. */
export const ATTEMPTS = [
  "m-0 grid list-none gap-2 p-0",
  "[&>li]:grid [&>li]:gap-[calc(2px*var(--ui-scale))] [&>li]:border-b [&>li]:border-line [&>li]:pb-2",
  "[&>li:last-child]:border-b-0",
].join(" ");

/* ── A freshly issued token: shown once, so it is set apart and selectable whole ───────────────── */

export const TOKEN_ROW = "my-2 flex items-center gap-2";

export const TOKEN_VALUE = [
  "min-w-0 flex-1 rounded-control border border-line-strong bg-surface px-3 py-2 text-xs",
  "[overflow-wrap:anywhere] select-all",
].join(" ");

/* ⚠️ The button is pushed down by a label's height, so it lines up with the FIELD beside it rather
   than with that field's label. */
export const ISSUE_ROW = [
  "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3",
  "[&>button]:mt-[calc(22px*var(--ui-scale))]",
].join(" ");

/* ── The system parameters ────────────────────────────────────────────────────────────────────── */

export const PARAMETER_GROUP =
  "mb-6 overflow-hidden rounded-surface border border-line bg-surface";

export const PARAMETER_GROUP_TITLE = "border-b border-line px-4 py-3 text-sm";

export const PARAMETER_KEY =
  "font-mono text-xs font-semibold whitespace-nowrap max-[700px]:whitespace-normal max-[700px]:[overflow-wrap:anywhere]";

/** The key and its "About …" button on one line; the key may still wrap. */
export const PARAMETER_KEY_LINE = "flex min-w-0 items-center gap-1";

export const PARAMETER_DESCRIPTION = [
  "mt-[calc(2px*var(--ui-scale))] max-w-[70ch] text-xs whitespace-normal text-secondary",
].join(" ");

/*
 * ⚠️ ONE COLUMN GRID FOR EVERY GROUP'S TABLE, and it is fixed on purpose: Value, Allowed and Takes
 * effect must sit in the same place from the first group to the last rather than being sized by each
 * group's own contents. On a phone the grid keeps its width and the table scrolls, so Change stays
 * reachable instead of being squeezed out.
 */
export const PARAMETER_TABLE = "min-w-[calc(720px*var(--ui-scale))] table-fixed";

export const PARAMETER_VALUE_COLUMN = "w-[calc(180px*var(--ui-scale))]";
export const PARAMETER_ALLOWED_COLUMN = "w-[calc(150px*var(--ui-scale))]";
export const PARAMETER_EFFECT_COLUMN = "w-[calc(170px*var(--ui-scale))]";
export const PARAMETER_ACTION_COLUMN = "w-[calc(100px*var(--ui-scale))]";

export const VALUE_CELL = "whitespace-nowrap";

/* An address does not fit a number's column; it wraps anywhere instead of widening the table. */
export const TEXT_VALUE_CELL = "text-start whitespace-normal [overflow-wrap:anywhere]";
