/**
 * The looks the six explanation components share.
 *
 * ⚠️ IN ONE FILE BECAUSE THE MARKS ARE ONE VOCABULARY. A stage mark in a hit's "found by" line and a
 * stage mark in "recognised in the query" say the same kind of thing and must be the same object on
 * the page; the CSS Module these replace achieved that by being one file, and so does this.
 *
 * Everything used by exactly one of them stays in that component, next to its markup.
 */

/** A matched term: a highlighter stroke, legible in both themes; the term it matched is in its title. */
export const TERM = "bg-warn-soft px-[1px] text-ink shadow-[inset_0_-1px_0_var(--warn)]";

/** The row of marks saying how a hit was found, or what a query was recognised to name. */
export const MARK_ROW = "flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-muted";

export const MARK_ROW_LABEL = "tracking-[0.06em] uppercase";

/*
 * A stage is a word with a rule on its leading edge; the rule only repeats what the word says, which
 * is why none of this depends on colour being seen.
 *
 * ⚠️ TWO VARIANTS RATHER THAN ONE PLUS AN OVERRIDE. A mark in a hit's line stays on one line; a mark
 * in the recognition row holds a part number or a symbol that can be long enough to wrap. Both
 * declare `white-space` once, because two declarations of it on one element would be decided by the
 * order of a generated stylesheet rather than by this file.
 */
const STAGE_FRAME =
  "inline-flex items-center gap-[0.35em] border border-line border-l-[3px] bg-surface px-2 leading-[1.7] text-ink";

export const STAGE = `${STAGE_FRAME} whitespace-nowrap`;

export const STAGE_WRAPPING = `${STAGE_FRAME} whitespace-normal [overflow-wrap:anywhere]`;

export const STAGE_KEYWORD = "border-l-ink";
export const STAGE_MEANING = "border-l-accent";
export const STAGE_SYMBOL = "border-l-warn";

/** The caption over a block of explanation — the term table, the recognition row. */
export const EXPLANATION_CAPTION = "pb-1 text-left text-2xs tracking-[0.06em] text-muted uppercase";
