/**
 * The looks the two documentation readers share — JavaDoc and jMS script documentation.
 *
 * ⚠️ IN ONE FILE BECAUSE THE TWO READ THE SAME WAY ON PURPOSE. A Java type and a jMS function are
 * both "a declaration, its signature, its comment and its tags", and the point of the reader is that
 * a person who has learned one can read the other. Two copies of these strings is how the two drift
 * into different line heights and different label weights.
 *
 * ⚠️ The reading column itself (`rc-prose`) and the editor chrome (`rc-code-surface`) are NOT here:
 * both style markup this product does not write — the Markdown renderer's output and CodeMirror's own
 * elements — so they live in `styles/components.css`. See the comments there.
 */

/** The stage a reader's own height comes from: the page sets `--reader-height`, or this is the clamp. */
export const READER_HEIGHT =
  "h-[var(--reader-height,clamp(calc(360px*var(--ui-scale)),calc(100dvh-17rem),calc(1400px*var(--ui-scale))))]";

export const DOCUMENTATION = "grid max-w-[100ch] gap-6";

/* One declaration and everything about it. Sections after the first are separated by a rule. */
export const TYPE_SECTION = "grid gap-3 not-first:border-t not-first:border-line not-first:pt-6";

export const TYPE_EYEBROW = "m-0 font-mono text-xs text-muted";

export const TYPE_TITLE = "m-0 font-mono text-lg leading-[1.35] [overflow-wrap:anywhere]";

export const SECTION_TITLE =
  "mt-2 mb-0 text-xs font-semibold tracking-[0.06em] text-secondary uppercase";

/*
 * The index of members: a kind in a fixed column, the name beside it. Below 800px the pair stacks,
 * because 11 characters of kind plus a Java signature in the rest is not a line that fits a phone.
 */
export const SUMMARY = "m-0 grid list-none rounded-control border border-line p-0";

export const SUMMARY_ITEM = [
  "grid grid-cols-[11ch_minmax(0,1fr)] items-baseline gap-3 px-3 py-1",
  "not-first:border-t not-first:border-line",
  "max-[800px]:grid-cols-[minmax(0,1fr)] max-[800px]:gap-0",
].join(" ");

export const SUMMARY_KIND = "text-xs text-muted";

export const SUMMARY_LINK = [
  "font-mono text-xs text-accent-text [overflow-wrap:anywhere]",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text",
].join(" ");

/* ⚠️ `scroll-margin-top` is what makes a citation land under the sticky topbar rather than behind it. */
export const MEMBER = "grid gap-2 border-t border-line py-3 scroll-mt-8 motion-reduce:scroll-mt-0";

export const MEMBER_HEAD = "flex flex-wrap items-baseline gap-x-3 gap-y-1";

export const MEMBER_NAME = "m-0 font-mono text-base";

export const SIGNATURE = [
  "m-0 overflow-x-auto border-l-[3px] border-l-line-strong bg-well px-3 py-2",
  "font-mono text-xs leading-[1.55] whitespace-pre-wrap [overflow-wrap:anywhere]",
].join(" ");

/* Tag name and tag body, the names in one column — until the column is narrower than the pair. */
export const TAGS = [
  "m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm",
  "[&>dt]:font-semibold [&>dt]:text-secondary",
  "[&>dd]:m-0 [&>dd]:min-w-0 [&>dd>div>p:last-child]:mb-0 [&>dd>p:last-child]:mb-0",
  "max-[800px]:grid-cols-[minmax(0,1fr)] max-[800px]:[&>dd]:mb-2",
].join(" ");

export const TAG_ARGUMENT = "mr-2 font-mono text-xs";

export const NO_COMMENT = "m-0 text-sm text-muted italic";
