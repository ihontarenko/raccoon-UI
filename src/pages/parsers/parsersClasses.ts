/**
 * The looks the two parser screens share — the list, and one parser's own page.
 *
 * ⚠️ TWENTY-TWO CLASSES WERE DROPPED HERE, NOT LOST. `Parsers.module.css` still carried the card,
 * the fact rows, the token chips and the option list from before those screens were rebuilt on
 * `DetailSurface` / `DetailSection` / `Badge`; nothing had referenced them for some time, and a
 * stylesheet nobody reads is the kind of thing a migration is for. If a parser card ever needs its
 * own look again, it belongs in `ui/components` with the rest of the surfaces rather than here.
 */

export const PAGE = "grid min-w-0 gap-6";

/** The preferred order of parsers, read as a sentence with the list of names in it. */
export const ORDER_ROW = "flex flex-wrap items-baseline gap-x-3 gap-y-2";

export const ORDER_LIST = "flex flex-wrap gap-2";

/** A parser's detail tab: a notice when it cannot run, then its settings surface. */
export const DETAIL = "grid min-w-0 gap-4";

export const OPTION_VALUES =
  "m-0 flex list-none flex-wrap gap-x-3 gap-y-[calc(2px*var(--ui-scale))] p-0";

/** The breadcrumb link reads as the eyebrow it sits in, as on a source's page. */
export const CRUMB_LINK = "text-inherit no-underline hover:text-accent-text hover:underline";
