/**
 * Files — laid out as Kitsu lays out its cabinets: a band of tools, then the tree beside the place.
 *
 * ⚠️ IN ONE FILE BECAUSE FIVE COMPONENTS ARE ONE CABINET — the page, the tree, the area of tiles or
 * rows, the marks they are drawn with, and the viewer that opens over all of it.
 */

/* ── Band ───────────────────────────────────────────────────────────────────────────────────── */

/* On a phone the band is two lines: the search across, then the view, the order and the action side by side. */
export const BAND = [
  "mb-4 flex flex-wrap items-center gap-3 rounded-surface border border-line bg-surface px-3 py-2",
  "max-[800px]:gap-2 max-[800px]:px-2",
].join(" ");

/* A tree where there is room for one; below 800px the place is one choice instead (PlacePicker). */
export const TREE_WIDE = "min-w-0 max-[800px]:hidden";

export const PLACE_NARROW = "mb-3 hidden max-[800px]:block";

/* The word beside a band control, dropped on a phone where the control's own value says enough. */
export const BAND_WORD = "max-[800px]:sr-only";

/* The magnifier sits inside the field; the field's own left padding makes room for it. */
export const SEARCH = [
  "relative flex flex-[1_1_calc(220px*var(--ui-scale))] max-w-[calc(380px*var(--ui-scale))] items-center",
  "text-muted",
  "[&>:first-child]:pointer-events-none [&>:first-child]:absolute [&>:first-child]:left-2",
  "[&_input]:w-full [&_input]:pl-[calc(30px*var(--ui-scale))]",
  "max-[800px]:max-w-none max-[800px]:basis-full",
].join(" ");

export const BAND_END = "ml-auto flex gap-2";

/* A labelled control in the band: the word beside the field, quiet, so the band reads as one line of tools. */
export const BAND_FIELD = "inline-flex items-center gap-2 text-xs text-muted";

/* ── Crumbs ─────────────────────────────────────────────────────────────────────────────────── */

export const CRUMBS = "inline";

/* A crumb is a button that reads as the eyebrow it sits in — case, tracking and all. */
export const CRUMB = [
  "cursor-pointer border-0 bg-transparent p-0 font-[inherit] tracking-[inherit] text-inherit",
  "[text-transform:inherit] hover:text-accent-text",
].join(" ");

/* ── Layout ─────────────────────────────────────────────────────────────────────────────────── */

export const LAYOUT = [
  "grid grid-cols-[minmax(0,var(--rail))_minmax(0,1fr)] items-start gap-6",
  "max-[800px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

/* With a file chosen the page becomes a three-pane explorer: the tree, the place, the file beside it. Below 1200px
   the preview moves under the files; below 800px everything stacks, the tree first. */
export const LAYOUT_WITH_PREVIEW = [
  "grid grid-cols-[minmax(0,var(--rail))_minmax(0,1fr)_minmax(calc(340px*var(--ui-scale)),0.85fr)] items-start gap-6",
  "max-[1200px]:grid-cols-[minmax(0,var(--rail))_minmax(0,1fr)] max-[1200px]:[&>aside:last-child]:col-span-2",
  "max-[800px]:grid-cols-[minmax(0,1fr)] max-[800px]:[&>aside:last-child]:col-span-1",
].join(" ");

export const AREA = "grid min-w-0 gap-4";

/* ── Preview ────────────────────────────────────────────────────────────────────────────────── */

export const PREVIEW = [
  "sticky top-[calc(52px*var(--ui-scale)+var(--space-4))] grid min-w-0 content-start gap-3",
  "rounded-surface border border-line bg-surface p-3",
  "max-[1200px]:static",
].join(" ");

export const PREVIEW_HEAD = "flex items-start justify-between gap-2";

export const PREVIEW_TITLE = [
  "grid min-w-0 gap-0.5",
  "[&_h2]:m-0 [&_h2]:overflow-hidden [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-ellipsis [&_h2]:whitespace-nowrap",
].join(" ");

/* The reader gets a height of its own here, so it fills it and scrolls inside — the list beside it stays still. */
export const PREVIEW_STAGE = [
  "grid h-[min(58dvh,calc(560px*var(--ui-scale)))] min-h-0 overflow-hidden rounded-control border border-line bg-well p-2",
  "[grid-template:minmax(0,1fr)_/_minmax(0,1fr)]",
].join(" ");

export const PREVIEW_ACTIONS = "flex flex-wrap gap-2";

export const PREVIEW_FACTS = [
  "m-0 grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1.5 text-xs",
  "[&>dt]:text-muted [&>dd]:m-0 [&>dd]:[overflow-wrap:anywhere]",
].join(" ");

export const NOTE = "text-center text-muted";

/* ── Rail ───────────────────────────────────────────────────────────────────────────────────── */

/*
 * ⚠️ `--rail-line` IS ONE HEIGHT FOR EVERYTHING ON A TREE LINE: the row and the chevron that opens it
 * are hit side by side, so a number written twice is a number that drifts apart. A finger needs more
 * of a line than a cursor does, and both halves follow because both read this one value.
 *
 * ⚠️ BELOW 800px THE TREE BECOMES ONE STRIP of places above the files: the nesting stays in the
 * markup and the strip flattens it with `display: contents`, which is why the indentation — applied
 * inline per level — has to be overridden with a marker.
 */
export const RAIL = [
  "[--rail-line:calc(30px*var(--ui-scale))] pointer-coarse:[--rail-line:var(--control)]",
  "sticky top-[calc(52px*var(--ui-scale)+var(--space-4))] overflow-auto",
  "max-h-[calc(100dvh-52px*var(--ui-scale)-var(--space-6))]",
  "rounded-surface border border-line bg-surface",
  "max-[800px]:static max-[800px]:max-h-none max-[800px]:overflow-x-auto",
].join(" ");

export const RAIL_HEAD = [
  "flex h-[calc(40px*var(--ui-scale))] items-center justify-between border-b border-line px-3",
  "max-[800px]:hidden",
].join(" ");

export const RAIL_LIST = "m-0 list-none p-0";

/* The outermost list of the tree: padded as a panel, and flattened into a row on a narrow screen. */
export const RAIL_ROOT_LIST = [
  "m-0 list-none p-1",
  "max-[800px]:flex max-[800px]:gap-1",
  "max-[800px]:[&_ul]:contents max-[800px]:[&_li]:contents",
].join(" ");

export const RAIL_GROUP = "not-first:mt-1";

export const RAIL_LINE = "flex items-center max-[800px]:pl-0!";

/* The current place is marked by a fill and a stripe on its leading edge, never by colour alone. */
export const RAIL_ROW = [
  "relative flex h-(--rail-line) w-full min-w-0 flex-1 items-center gap-2 px-2",
  "rounded-[calc(4px*var(--ui-scale))] border-0 bg-transparent text-left text-sm font-[550]",
  "whitespace-nowrap text-secondary",
  "transition-[background-color,color] duration-120 motion-reduce:transition-none",
  "hover:bg-well hover:text-ink",
  "aria-[current=page]:bg-accent-soft aria-[current=page]:font-[650] aria-[current=page]:text-ink",
  'aria-[current=page]:before:absolute aria-[current=page]:before:inset-y-[4px]',
  "aria-[current=page]:before:left-0 aria-[current=page]:before:w-[2px]",
  "aria-[current=page]:before:bg-accent aria-[current=page]:before:content-['']",
  "max-[800px]:w-auto max-[800px]:flex-none",
].join(" ");

export const RAIL_NAME = "flex-1 overflow-hidden text-ellipsis";

export const RAIL_COUNT =
  "font-mono text-2xs text-muted [font-variant-numeric:tabular-nums]";

const RAIL_SQUARE = "grid size-(--rail-line) flex-none place-items-center";

export const CHEVRON = [
  RAIL_SQUARE,
  "rounded-[calc(3px*var(--ui-scale))] border-0 bg-transparent p-0 text-muted",
  "hover:bg-well hover:text-ink",
  "[&>span]:grid [&>span]:transition-transform [&>span]:duration-120",
  "motion-reduce:[&>span]:transition-none",
].join(" ");

/* Where a leaf has no chevron: the same square, so every name on the tree starts on one edge. */
export const CHEVRON_SPACE = RAIL_SQUARE;

export const CHEVRON_OPEN = "rotate-90";

/* ── Marks ──────────────────────────────────────────────────────────────────────────────────── */

export const MARK = "flex-none";

/* The two sizes a mark is ever drawn at: beside a name on the tree, or over a tile. ⚠️ A record
   rather than two constants, because the caller is given the size as a word. */
export const MARK_SIZE: Record<"small" | "large", string> = {
  small: "size-[calc(16px*var(--ui-scale))]",
  large: "size-[calc(64px*var(--ui-scale))]",
};

/* A folder is drawn as three overlaid shapes of one accent at three opacities, so it follows the
   palette without a second colour being invented for it. */
export const FOLDER_TAB = "fill-accent opacity-85";
export const FOLDER_BACK = "fill-accent opacity-55";
export const FOLDER_FRONT = "fill-accent";

export const EMPTY_MARK = "opacity-50";

export const FILE_PAGE = "fill-well stroke-line-strong [stroke-width:0.8]";

export const FILE_CORNER = "fill-line-strong opacity-70";

/* The extension stamped in the family band: white on the band's colour, in the code face so two of them line up. */
export const FILE_STAMP =
  "fill-white font-mono text-[4.4px] font-bold tracking-[0.04em]";

/* The family glyph above the band: a thin line drawing in the family's colour. */
export const FILE_GLYPH = "[stroke-width:1.1] [stroke-linecap:round] [stroke-linejoin:round]";

/* ── Tiles ──────────────────────────────────────────────────────────────────────────────────── */

/* ⚠️ A PHONE FITS TWO OF THE WIDE TRACKS, which leaves each 64px thumbnail floating in 175px of
   nothing. A shorter track gives three per line, which is what the folders are being scanned for. */
export const TILE_GRID = [
  "m-0 grid list-none gap-2 p-0",
  "grid-cols-[repeat(auto-fill,minmax(calc(132px*var(--ui-scale)),1fr))]",
  "max-[560px]:grid-cols-[repeat(auto-fill,minmax(calc(104px*var(--ui-scale)),1fr))]",
].join(" ");

export const TILE = [
  "flex h-full w-full flex-col items-center gap-2 px-2 py-3",
  "aria-pressed:border-accent aria-pressed:bg-accent-soft",
  "rounded-control border border-transparent bg-transparent text-center text-ink",
  "transition-[background-color,border-color] duration-120 motion-reduce:transition-none",
  "hover:border-line hover:bg-surface",
  "group-data-[removed=true]/cell:opacity-55",
].join(" ");

export const TILE_NAME = "line-clamp-2 text-xs [overflow-wrap:break-word]";

export const TILE_META = "text-2xs text-muted";

export const FILE_CELL = "group/cell relative";

/*
 * ⚠️ HOVER-REVEALED CONTROLS DO NOT EXIST ON A TOUCH SCREEN, so the menu is always shown there. It is
 * also shown whenever it holds the focus or is open, or a keyboard would open a menu it cannot see.
 */
export const TILE_MENU = [
  "absolute top-1 right-1 z-[1] opacity-0 transition-opacity duration-120 motion-reduce:transition-none",
  "group-hover/cell:opacity-100 focus-within:opacity-100 has-[[data-open=true]]:opacity-100",
  "pointer-coarse:opacity-100",
  /* On a phone a tap chooses the file and its preview carries every action; a menu over each tile only crowds it. */
  "max-[800px]:hidden",
].join(" ");

const THUMBNAIL_BOX = [
  "size-[calc(64px*var(--ui-scale))] rounded-[calc(3px*var(--ui-scale))] border border-line",
].join(" ");

export const THUMBNAIL = `${THUMBNAIL_BOX} object-cover`;

export const THUMBNAIL_WAITING = `${THUMBNAIL_BOX} bg-well`;

/* ── List ───────────────────────────────────────────────────────────────────────────────────── */

export const LIST_SURFACE = [
  "overflow-clip rounded-surface border border-line bg-surface",
  "[&_tr[data-removed=true]_td]:text-muted",
].join(" ");

/* The chosen row: a neutral tint and the accent stripe, the same mark a selected table row carries everywhere. */
export const ROW_SELECTED = "[&>td]:bg-well [&>td:first-child]:shadow-[inset_3px_0_0_var(--accent)]";

export const ROW_SUB = "block text-2xs text-muted numeric [overflow-wrap:anywhere]";

export const ROW_NAME = [
  "inline-flex items-center gap-2 border-0 bg-transparent p-0 text-left font-[inherit]",
  "font-[550] text-ink hover:text-accent-text",
].join(" ");

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
