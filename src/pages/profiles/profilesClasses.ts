/**
 * Processing profiles: the catalogue, one profile's editor, its history, and how the profiles connect.
 *
 * ⚠️ IN ONE FILE BECAUSE SIX COMPONENTS ARE ONE PRODUCT AREA, and a field in the editor must look
 * the same whichever stage's tab it is met in.
 */

/* The breadcrumb link reads as the eyebrow it sits in. */
export const CRUMB = "text-inherit no-underline hover:text-accent-text hover:underline";

export const DECIDES = "mx-0 mt-0 mb-4 text-secondary";

export const TABLE_SURFACE = "overflow-x-auto rounded-surface border border-line bg-surface";

export const PROFILE_LINK =
  "font-semibold text-ink no-underline hover:text-accent-text hover:underline";

/* ── Editor: what concerns the whole profile above the tabs, one stage per tab ───────────────── */

export const EDITOR_TOP = "mb-6 grid min-w-0 gap-4";

export const EDITOR_MAIN = "grid min-w-0 gap-4";

/* Pulled up against the line above it: it belongs to that line rather than starting a new block. */
export const USED_LINE = "mx-0 mt-[calc(var(--space-3)*-1)] mb-0 text-secondary";

export const SAVE_STATE = [
  "self-center text-xs text-muted",
  "data-[changed=true]:font-semibold data-[changed=true]:text-ink",
].join(" ");

/* History: the saved revisions beside what a save would write now. */
export const HISTORY_LAYOUT = [
  "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-4",
  "max-[1000px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

export const USED_BY_PANEL = "grid min-w-0 gap-4";

export const FORM = "grid gap-4";

export const SECTION = [
  "m-0 grid min-w-0 gap-3 rounded-surface border border-line bg-surface",
  "[padding:var(--space-4)_var(--space-5)_var(--space-5)]",
  "max-[700px]:[padding:var(--space-3)_var(--space-4)_var(--space-4)]",
].join(" ");

/* ⚠️ FLOATED, AND THE NEXT LINE CLEARS IT: `float` takes a `<legend>` out of the fieldset's border so
   the heading sits inside the panel rather than cutting through its top edge. */
export const SECTION_TITLE = [
  "float-left flex w-full flex-wrap items-baseline gap-2 p-0 text-base font-[650]",
  "[&+*]:clear-both",
].join(" ");

export const SECTION_NOTE = "text-xs font-normal text-accent-text";

export const EFFECT = "m-0 text-xs text-secondary";

export const ABSENT_ROW = [
  "flex items-center justify-between gap-3 rounded-control border border-dashed border-line-strong",
  "px-3 py-2",
].join(" ");

export const FIELDS = [
  "grid grid-cols-2 gap-x-6 gap-y-4",
  "max-[700px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

export const FIELD = [
  "grid min-w-0 content-start gap-1",
  "data-[wide=true]:col-span-full",
].join(" ");

/* A field's label (or checkbox) with its "About …" button at the end of the same line. */
export const FIELD_HEAD = [
  "flex min-w-0 items-start gap-1",
  "[&>:first-child]:min-w-0 [&>:first-child]:flex-[1_1_auto]",
].join(" ");

/* The label keeps its line; when the bounds do not fit beside it they move under it, rather than the
   two squeezing each other into "Overlap code / points". */
export const FIELD_LABEL = [
  "flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0 text-xs font-semibold",
].join(" ");

export const FIELD_BOUNDS =
  "font-normal whitespace-nowrap text-muted [font-variant-numeric:tabular-nums]";

export const FIELD_HINT = "text-xs leading-[1.45] text-muted";

/* A setting another choice makes irrelevant: the reason, marked off from an ordinary hint by its rule. */
export const FIELD_OVERRIDDEN = [
  "border-l-2 border-l-warn px-2 py-1 text-xs leading-[1.45] text-ink",
  "bg-[color-mix(in_srgb,var(--warn-soft)_55%,transparent)]",
].join(" ");

export const FIELD_ERROR = "text-xs text-danger";

/* A row of checkboxes keeps a control's height, so it lines up with the fields beside it. */
export const CHECKS = "flex min-h-(--control) flex-wrap items-center gap-x-4 gap-y-2";

export const SIDE_PANEL =
  "grid min-w-0 gap-2 rounded-surface border border-line bg-surface p-4";

export const SIDE_TITLE = "m-0 text-base";

export const REVISIONS = "m-0 grid list-none p-0";

export const REVISION = "not-first:border-t not-first:border-line";

export const REVISION_BUTTON =
  "w-full border-0 bg-transparent py-2 text-left font-semibold hover:text-accent-text";

export const REVISION_DETAIL = "grid gap-2 pb-3";

/*
 * ⚠️ THE FOUR GRADIENTS ARE A SCROLL SHADE, NOT DECORATION. Two of them are `local` covers that
 * scroll with the content and two are `scroll` shades fixed to the box: together they put a shade on
 * whichever edge still has document behind it, so a cut-off revision never looks like the whole of
 * it. Removing any one of the four turns the pair into a permanent smudge.
 */
export const JSON_BLOCK = [
  "m-0 max-h-[calc(420px*var(--ui-scale))] overflow-auto rounded-control border border-line p-3",
  "font-mono text-2xs leading-[1.6]",
  "bg-[linear-gradient(var(--well)_30%,transparent)_top_/_100%_24px_no-repeat_local,linear-gradient(transparent,var(--well)_70%)_bottom_/_100%_24px_no-repeat_local,radial-gradient(farthest-side_at_50%_0,color-mix(in_srgb,var(--ink)_18%,transparent),transparent)_top_/_100%_10px_no-repeat_scroll,radial-gradient(farthest-side_at_50%_100%,color-mix(in_srgb,var(--ink)_18%,transparent),transparent)_bottom_/_100%_10px_no-repeat_scroll,var(--well)]",
].join(" ");

/* ── How the profiles connect ───────────────────────────────────────────────────────────────── */

export const CONNECTIONS = "grid gap-6";

export const STAGE_STRIP = [
  "m-0 grid list-none grid-cols-5 rounded-surface border border-line bg-surface p-0",
  "max-[1100px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

export const STAGE = [
  "relative flex min-w-0",
  "not-first:border-l not-first:border-line",
  "max-[1100px]:not-first:border-l-0! max-[1100px]:not-first:border-t max-[1100px]:not-first:border-line",
].join(" ");

export const STAGE_LINK = [
  "grid flex-1 content-start gap-[calc(2px*var(--ui-scale))] text-ink no-underline",
  "[padding:var(--space-3)_var(--space-5)_var(--space-3)_var(--space-4)]",
  "transition-[background-color] duration-120 hover:bg-well motion-reduce:transition-none",
].join(" ");

export const STAGE_NAME = "font-[650]";

export const STAGE_ROLE = "text-xs text-secondary";

/* ⚠️ The arrow sits ON the divider between two stages, so the strip reads as one flow — and it goes
   when the stages stack, where there is no divider to sit on. */
export const STAGE_ARROW = [
  "absolute top-1/2 right-[calc(-10px*var(--ui-scale))] z-1 grid -translate-y-1/2",
  "size-[calc(20px*var(--ui-scale))] place-items-center rounded-control border border-line",
  "bg-surface text-muted",
  "max-[1100px]:hidden",
].join(" ");

export const CONNECTIONS_BODY = [
  "grid grid-cols-[minmax(0,1fr)_minmax(0,calc(330px*var(--ui-scale)))] items-start gap-6",
  "max-[1100px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

export const CONNECTIONS_MAIN = "grid min-w-0 gap-3";

export const SECTION_HEADING = "text-md";

export const SUB_HEADING = "mt-3 text-sm";

export const PLAIN_LIST = "m-0 grid list-none gap-1 p-0";

export const CELL_STACK = "grid justify-items-start gap-[calc(3px*var(--ui-scale))]";

export const PROBLEM = "mt-[calc(3px*var(--ui-scale))] text-xs text-deny";

export const PROBLEM_LIST = "m-0 pl-4";

/* The guide beside the stages: marked on its edge as the thing that explains rather than reports. */
export const GUIDE = [
  "grid gap-3 rounded-surface border border-line border-l-2 border-l-allow bg-surface p-4",
].join(" ");

export const GUIDE_STEPS = [
  "m-0 grid gap-3 pl-6",
  "[&_li]:grid [&_li]:gap-[calc(2px*var(--ui-scale))] [&_li]:text-sm",
  "[&_li_span]:text-xs [&_li_span]:text-secondary",
].join(" ");

export const GUIDE_LINK = "justify-self-start text-xs font-semibold text-accent-text";

/* Under a reference field: whether the chosen profile or provider works, and what it brings with it. */
export const CHOICE_LINE = "flex flex-wrap items-center gap-2 text-xs text-secondary";

/* What a request will do — the chooser above the full flow. */
export const FLOW_EXPLORER = "grid gap-3";

export const FLOW_EXPLORER_HEAD =
  "flex flex-wrap items-end justify-between gap-3";
