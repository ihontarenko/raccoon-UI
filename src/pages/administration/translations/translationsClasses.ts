/**
 * The translation administration: the languages and their progress, then the entries of one of them.
 *
 * ⚠️ IN ONE FILE BECAUSE FIVE COMPONENTS ARE ONE PANEL — the languages table, the progress bar, the
 * entries table, the add-language dialog and the panel that holds them.
 */

export const PANEL = "grid min-w-0 gap-8";

/* ⚠️ `scroll-mt-8` is what keeps a section's heading clear of the sticky topbar when it is jumped to. */
export const SECTION = "grid min-w-0 gap-3 scroll-mt-8";

export const SECTION_HEADER = "flex flex-wrap items-center justify-between gap-3";

export const SECTION_TITLE = "text-md";

export const TABLE_FRAME = "min-w-0 rounded-surface border border-line bg-surface";

export const LANGUAGES_TABLE = "[&_td]:align-middle";

export const LANGUAGE_NAME = "grid min-w-0 gap-[2px]";

export const BADGES = "inline-flex flex-wrap gap-1";

export const PROGRESS = "flex min-w-0 items-center gap-2";

/* The bar narrows on a phone rather than pushing the figure beside it off the row. */
export const PROGRESS_TRACK = [
  "relative h-[6px] w-[calc(96px*var(--ui-scale))] flex-none overflow-hidden rounded-[2px]",
  "border border-line-strong bg-well",
  "max-[760px]:w-[calc(56px*var(--ui-scale))]",
].join(" ");

/* Complete is the good outcome rather than merely more accent: the colour is the verdict. */
export const PROGRESS_FILL = "absolute inset-y-0 left-0 bg-accent data-[complete=true]:bg-good";

export const FILTERS = [
  "grid grid-cols-[minmax(160px,220px)_minmax(200px,1fr)_auto] items-end gap-3",
  "max-[760px]:grid-cols-[1fr]",
].join(" ");

export const FILTER_CHECK = "pb-1";

/*
 * ⚠️ FIXED, AND THE LAST COLUMN IS NAMED TWICE: the action column is the one a narrow screen must
 * not let the text squeeze away, so it keeps a width of its own and gives up half of it on a phone.
 */
export const ENTRIES_TABLE = [
  "table-fixed [&_td]:align-top",
  "[&_col:last-child]:w-[calc(88px*var(--ui-scale))] [&_th:last-child]:w-[calc(88px*var(--ui-scale))]",
  "max-[760px]:[&_th:last-child]:w-[calc(48px*var(--ui-scale))]",
].join(" ");

export const ANYWHERE_CELL = "[overflow-wrap:anywhere]";

export const TRANSLATION_CELL = "[overflow-wrap:anywhere]";

export const ENTRY_KEY = "mb-1 block font-mono text-2xs text-secondary";

export const ENTRY_TEXT = "block whitespace-pre-wrap";

/* ⚠️ MARKED IMPORTANT, AND IT HAS TO BE. `rc-table` in `styles/components.css` is unlayered
   component CSS, so its own `tbody tr:hover td` fill outranks any utility however specific the
   selector; the row being edited has to win over both that and the selected-row fill. */
export const EDITING_ROW = "[&>td]:bg-accent-soft!";

export const EDITOR_ACTIONS = "mt-2 flex flex-wrap items-center gap-2";

/* On a phone the label is read but not drawn: the field it names is the only one in the row. */
export const EDIT_LABEL = "max-[760px]:sr-only";

export const WARNING = "mt-1 text-sm text-danger";

export const MORE_ROW = "flex justify-center";

export const FORM = "grid gap-4";

export const HIDDEN_INPUT = "hidden";
