/**
 * The file marks and the viewer that opens over everything — what is left of the Files screen now that browsing is
 * the Library's explorer (`@jmouse/explorer`).
 */

/* ── Marks ──────────────────────────────────────────────────────────────────────────────────── */

export const MARK = "flex-none";

/* The two sizes a mark is ever drawn at: beside a name on the tree, or over a tile. ⚠️ A record
   rather than two constants, because the caller is given the size as a word. */
export const MARK_SIZE: Record<"small" | "large", string> = {
  small: "size-[calc(16px*var(--ui-scale))]",
  large: "size-[calc(64px*var(--ui-scale))]",
};

export const FILE_PAGE = "fill-well stroke-line-strong [stroke-width:0.8]";

export const FILE_CORNER = "fill-line-strong opacity-70";

/* The extension stamped in the family band: white on the band's colour, in the code face so two of them line up. */
export const FILE_STAMP =
  "fill-white font-mono text-[4.4px] font-bold tracking-[0.04em]";

/* The family glyph above the band: a thin line drawing in the family's colour. */
export const FILE_GLYPH = "[stroke-width:1.1] [stroke-linecap:round] [stroke-linejoin:round]";

/* ── Viewer ─────────────────────────────────────────────────────────────────────────────────── */

export const VIEWER =
  "fixed inset-0 z-50 grid grid-rows-[auto_minmax(0,1fr)_auto] bg-bg";

export const VIEWER_HEAD = [
  "flex items-center justify-between gap-4 border-b border-line bg-surface px-4 py-2",
  "max-[800px]:flex-wrap",
].join(" ");

export const VIEWER_TITLE = [
  "grid min-w-0",
  "[&_h2]:overflow-hidden [&_h2]:text-base [&_h2]:text-ellipsis [&_h2]:whitespace-nowrap",
].join(" ");

export const VIEWER_ACTIONS = "flex flex-none gap-1";

export const VIEWER_BODY = "grid min-h-0 grid-cols-[minmax(0,1fr)]";

/* With the details open the stage shares the width — until there is none to share, where the details
   move under it and keep at most two fifths of the height. */
export const VIEWER_WITH_DETAILS = [
  "grid-cols-[minmax(0,1fr)_var(--inspector)]",
  "max-[800px]:grid-cols-[minmax(0,1fr)] max-[800px]:grid-rows-[minmax(0,1fr)_auto]",
].join(" ");

/* The reader fills the stage and scrolls inside its own frame; a message sits in the middle of it. */
export const VIEWER_STAGE = [
  "grid min-h-0 overflow-hidden px-4 py-3",
  "[grid-template:minmax(0,1fr)_/_minmax(0,1fr)]",
].join(" ");

export const STAGE_MESSAGE = "place-self-center";

export const CANNOT_SHOW = "grid justify-items-center gap-3 place-self-center text-center";

export const VIEWER_DETAILS = [
  "grid content-start gap-4 overflow-auto border-l border-line bg-surface p-4",
  "max-[800px]:max-h-[40dvh] max-[800px]:border-l-0 max-[800px]:border-t max-[800px]:border-line",
].join(" ");

export const DETAILS = [
  "m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs",
  "[&>dt]:text-muted [&>dd]:m-0 [&>dd]:[overflow-wrap:anywhere]",
].join(" ");

export const HASH = "text-2xs";

export const DETAILS_LINK = "text-sm text-accent-text";

export const VIEWER_FOOT = "border-t border-line bg-surface px-4 py-2 text-center";
