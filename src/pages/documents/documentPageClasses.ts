/**
 * A document's own page: where it is in the pipeline, and the tabs that read it.
 *
 * ⚠️ IN ONE FILE BECAUSE SEVEN COMPONENTS ARE ONE PAGE — the page, the pipeline strip, the process
 * dialog and the four tabs.
 */

/* The breadcrumb link reads as the eyebrow it sits in. */
export const CRUMB = "text-inherit no-underline hover:text-accent-text hover:underline";

/* ── The pipeline: four steps side by side, joined by the line their order makes ─────────────── */

/* ⚠️ `overflow-clip` is load-bearing: the steps' coloured top edges are square, and clipping them to
   the frame is what keeps its rounded corners. */
export const PIPELINE = [
  "mx-0 mt-0 mb-6 grid list-none grid-cols-4 overflow-clip rounded-surface border border-line",
  "bg-surface p-0",
  "max-[1200px]:grid-cols-2 max-[700px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

/*
 * ⚠️ WHEN THE STEPS WRAP, THE RULE BETWEEN ROWS IS AN INSET SHADOW RATHER THAN A BORDER. The top
 * border is already spent on the state colour, and a second border there would either replace it or
 * thicken the edge; `inset 0 1px 0` draws a hairline inside the step without touching it.
 *
 * `group` carries the state to the number and the body: a blocked step mutes its text, a finished
 * one greens its number.
 */
export const STEP = [
  "group relative grid min-w-0 grid-rows-[auto_1fr_auto] gap-3 border-t-[3px] border-t-transparent p-4",
  "not-first:border-l not-first:border-line",
  "data-[state=done]:border-t-good",
  "data-[state=active]:border-t-accent data-[state=active]:bg-accent-soft",
  "data-[state=active]:motion-safe:animate-step-pulse",
  "data-[state=attention]:border-t-warn",
  "max-[1200px]:[&:nth-child(3)]:border-l-0!",
  "max-[1200px]:[&:nth-child(n+3)]:shadow-[inset_0_1px_0_var(--line)]",
  "max-[700px]:not-first:border-l-0! max-[700px]:not-first:shadow-[inset_0_1px_0_var(--line)]",
].join(" ");

export const STEP_HEAD = "flex flex-wrap items-center gap-2";

export const STEP_NUMBER = [
  "grid size-[calc(22px*var(--ui-scale))] place-items-center rounded-[calc(3px*var(--ui-scale))]",
  "border border-line-strong text-xs text-secondary [font-variant-numeric:tabular-nums]",
  "group-data-[state=done]:border-good group-data-[state=done]:text-good",
].join(" ");

export const STEP_TITLE = "m-0 flex-1 text-base";

export const STEP_BODY = [
  "grid min-w-0 content-start gap-1 [&_p]:m-0 [&_p]:[overflow-wrap:anywhere]",
  "group-data-[state=blocked]:text-muted",
].join(" ");

export const STEP_ACTION = "flex";

/* ── Tab content ──────────────────────────────────────────────────────────────────────────── */

export const STACK = "grid min-w-0 gap-3";

export const TABLE_SURFACE = "overflow-x-auto rounded-surface border border-line bg-surface";

export const CHUNK_FILTER = "inline-flex items-center gap-2";

/* What a person wrote to be indexed in a chunk's place, above what the chunk itself would be. */
export const CHUNK_REPLACEMENT =
  "grid gap-[calc(2px*var(--ui-scale))] border-b border-line bg-warn-soft px-3 py-2";

export const CHUNK_REPLACEMENT_TEXT =
  "m-0 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]";

export const CHUNKS = "m-0 grid list-none gap-2 p-0";

export const CHUNK = "rounded-surface border border-line bg-surface";

/* The band naming a piece of the document — the same band the parsed text puts over a page, because
   the two tabs are two readings of one version and should introduce a piece the same way. */
export const CHUNK_HEAD = [
  "flex flex-wrap items-center gap-3 border-b border-line bg-well px-3 py-1",
  "rounded-t-surface",
].join(" ");

/* Two states and two actions on one line: the badges report, the buttons act, and they share a centre
   line rather than a common height. */
export const CHUNK_FACTS = "ml-auto flex flex-wrap items-center gap-x-2 gap-y-1";

export const CHUNK_TEXT = [
  "m-0 max-h-[calc(260px*var(--ui-scale))] overflow-auto p-3",
  "font-mono text-xs leading-[1.6] whitespace-pre-wrap [overflow-wrap:anywhere]",
].join(" ");

/* The declaration behind a source-code chunk: kind, signature as written, symbol id, enclosing type. */
export const CHUNK_SYMBOL =
  "flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line px-3 py-2";

export const CHUNK_SIGNATURE = "font-mono text-xs [overflow-wrap:anywhere]";

export const CHUNK_SYMBOL_ID = "font-mono [overflow-wrap:anywhere]";

/* ── Journal ──────────────────────────────────────────────────────────────────────────────── */

export const JOURNAL = [
  "grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] items-start gap-4",
  "max-[1200px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

export const PANEL = "rounded-surface border border-line bg-surface p-4";

export const PANEL_TITLE = "mx-0 mt-0 mb-3 text-base";

/* ── Dialog choices ───────────────────────────────────────────────────────────────────────── */

export const CHOICES = "grid gap-2";

/* The whole option is the control: the state is read off the radio inside it, and the radio draws
   neither the fill nor the ring. */
export const CHOICE = [
  "flex cursor-pointer items-start gap-3 rounded-control border border-line p-3",
  "has-[input:checked]:border-accent-text has-[input:checked]:bg-accent-soft",
  "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-1",
  "has-[input:focus-visible]:outline-accent-text",
  "[&_input]:mt-[calc(3px*var(--ui-scale))] [&_input]:accent-[var(--accent)]",
  "[&_input:focus-visible]:outline-none",
].join(" ");

export const CHOICE_TEXT = "grid gap-[calc(2px*var(--ui-scale))]";

/* A removal notice opens the page body: the same gap below it as below the tab strip. */
export const REMOVAL_NOTICE = "mb-6";

/* A captured path is one long word; on a phone it breaks rather than widening the page. */
export const EXTERNAL_IDENTIFIER = "[overflow-wrap:anywhere]";

/* An imported document's link back, tags and remote version, on one line under the header. */
export const ORIGIN =
  "mb-4 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2";

export const ORIGIN_LINK = "inline-flex items-center gap-1 text-sm text-accent-text";

export const ORIGIN_TAGS = "inline-flex flex-wrap gap-1";
