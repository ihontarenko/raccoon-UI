/**
 * Chunking: the same surfaces and fact grid as the Parsers page, so the two read as one pipeline.
 *
 * ⚠️ IN ONE FILE BECAUSE ONE CHUNKER'S PAGE AND ITS PREVIEW ARE ONE SCREEN'S WORTH — a chunker is
 * opened and then tried out on a document without the look changing.
 *
 * ⚠️ SEVEN CLASSES WERE DROPPED HERE, NOT LOST: the chunker card, its head, its name and the
 * identifier beside it were left over from before the catalogue was rebuilt on `DetailSurface` and
 * `Badge`, and nothing had referenced them for some time.
 */

const INSET_PANEL = [
  "rounded-surface border border-line bg-surface px-6 py-4",
  "max-[720px]:[padding:var(--space-3)_var(--space-4)_var(--space-4)]",
].join(" ");

export const PAGE = "grid min-w-0 gap-6";

export const PANEL = `grid min-w-0 gap-3 ${INSET_PANEL} [&_p]:m-0`;

export const SECTION_TITLE = "m-0 text-md";

export const STAGES = "m-0 grid gap-2 pl-6";

export const SUMMARY = "m-0 text-secondary";

export const FACTS = "m-0 grid gap-2";

export const FACT = [
  "grid grid-cols-[calc(190px*var(--ui-scale))_minmax(0,1fr)] items-baseline gap-3",
  "[&>dt]:text-xs [&>dt]:font-semibold [&>dt]:tracking-[0.04em] [&>dt]:text-muted [&>dt]:uppercase",
  "[&>dd]:m-0 [&>dd]:min-w-0",
  "max-[720px]:grid-cols-[minmax(0,1fr)] max-[720px]:gap-1",
].join(" ");

export const TOKENS = "flex flex-wrap gap-x-2 gap-y-1";

export const VECTOR_LIST = "m-0 grid list-none gap-[calc(2px*var(--ui-scale))] p-0";

/* ── The preview form ─────────────────────────────────────────────────────────────────────────
 *
 * What to cut (document, profile), then how (the chunk settings), then the action on the right.
 */

export const PREVIEW_FORM = "grid gap-4";

export const PREVIEW_TARGET = [
  "grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start gap-x-4 gap-y-3",
  "max-[960px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

/* ⚠️ `not-first:` IS THE OLD `.previewTarget + .previewSettings` RULE — the settings row grows a rule
   above it only when the target row is there to be divided from. */
export const PREVIEW_SETTINGS = [
  "flex flex-wrap items-start gap-x-4 gap-y-3",
  "not-first:border-t not-first:border-line not-first:pt-3",
].join(" ");

/* Three controls of declared proportions: the strategy takes the room, the number keeps a number's
   width, the unit gives way first. On a phone each takes a line of its own. */
export const PREVIEW_STRATEGY =
  "min-w-0 flex-[1_1_calc(240px*var(--ui-scale))] max-[720px]:basis-full";

export const PREVIEW_NUMBER =
  "flex-[0_0_calc(132px*var(--ui-scale))] max-[720px]:flex-[1_1_calc(120px*var(--ui-scale))]";

export const PREVIEW_UNIT =
  "min-w-0 flex-[0_1_calc(280px*var(--ui-scale))] max-[720px]:basis-full";

export const PREVIEW_CHOICE = "grid gap-[calc(6px*var(--ui-scale))]";

export const CHOICE_LABEL_LINE = "flex items-center gap-1";

export const CHOICE_LABEL = "text-xs font-[550] text-secondary";

/* A number with its unit inside the field, after it: the field keeps room for the word on its right,
   and the word takes no pointer events so a click still lands in the field. */
export const UNIT_INPUT = "relative block";

export const UNIT_INPUT_CONTROL = "pr-[calc(52px*var(--ui-scale))]";

export const UNIT_SUFFIX = [
  "pointer-events-none absolute top-1/2 right-[calc(9px*var(--ui-scale))] -translate-y-1/2",
  "text-xs text-muted",
].join(" ");

export const PREVIEW_ACTIONS_ROW = "flex flex-wrap items-center gap-x-4 gap-y-2";

export const PREVIEW_CHANGED = "flex flex-wrap items-center gap-x-3 gap-y-2";

export const PREVIEW_ACTIONS =
  "ml-auto flex flex-wrap items-center gap-x-3 gap-y-2 max-[720px]:ml-0";

export const PREVIEW_RESULT = "grid min-w-0 gap-3";

export const PREVIEW_CHUNKS = "m-0 grid list-none border-t border-line p-0";

export const PREVIEW_CHUNK = "grid min-w-0 gap-1 border-b border-line py-3";

export const PREVIEW_CHUNK_HEAD = "flex flex-wrap items-center gap-x-3 gap-y-1";

export const PREVIEW_SIGNATURE = "text-sm text-secondary [overflow-wrap:anywhere]";

export const PREVIEW_TEXT = [
  "m-0 max-h-[calc(180px*var(--ui-scale))] overflow-auto rounded-control border border-line bg-well",
  "px-3 py-2 text-xs whitespace-pre-wrap [overflow-wrap:anywhere]",
].join(" ");

export const HEADING_ROW = "flex flex-wrap items-center gap-2";

/* A column header and the explanation of the setting it names, on one line. */
export const HEADER_WITH_HELP = "inline-flex items-center gap-1";

/* The breadcrumb link reads as the eyebrow it sits in, as on a source's page. */
export const CRUMB_LINK = "text-inherit no-underline hover:text-accent-text hover:underline";

export const PARSER_LINKS = "flex flex-wrap gap-1.5";

export const PROFILE_SETTINGS = "grid min-w-0 gap-3 [&>p]:m-0";
