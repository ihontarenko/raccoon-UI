/**
 * The UI Kit's own scaffolding — the page that shows every component of the interface.
 *
 * ⚠️ NOTHING HERE IS PART OF THE DESIGN SYSTEM. These are the specimen frames the kit page itself is
 * built from: a section, a row of samples, the two-column stage a search sample is shown on. A
 * component being demonstrated never reads them, which is the whole point — a kit that styled its
 * specimens would be showing its own frames rather than the product's components.
 */

export const SECTION = "grid gap-4 border-t border-line py-8";

export const SECTION_HEAD = "grid gap-1";

export const ROW = "flex flex-wrap items-center gap-3";

export const STACK = "grid max-w-[80ch] gap-3";

export const FORM_GRID = "grid grid-cols-2 gap-4 max-[700px]:grid-cols-[minmax(0,1fr)]";

export const STATES = "grid grid-cols-3 gap-4 max-[1100px]:grid-cols-[minmax(0,1fr)]";

export const STATE_SAMPLE =
  "grid min-w-0 content-start gap-2 rounded-surface border border-line bg-surface p-3";

/** A surface a specimen sits on, the same one a list or an inspector uses. */
export const SAMPLE_SURFACE = "rounded-surface border border-line bg-surface";

/** A search sample: the hit rows on the left, the instruments reading them on the right. */
export const SAMPLE_STAGE = [
  "grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start gap-4",
  "max-[900px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

export const SAMPLE_ROWS = "m-0 grid list-none px-4 py-2";

/** A hit row in the closeness sample: the text on one side, its measurement on the other. */
export const CLOSENESS_ROW =
  "flex items-center justify-between gap-3 border-b border-line py-2 text-sm last:border-b-0";

/** A hit row in the explanation sample: its rank in a fixed column, everything else beside it. */
export const EXPLANATION_ROW = [
  "grid grid-cols-[calc(30px*var(--ui-scale))_minmax(0,1fr)] gap-3 border-b border-line py-3 text-sm",
  "last:border-b-0",
].join(" ");

export const EXPLANATION_BODY = "grid min-w-0 gap-2 [overflow-wrap:anywhere] [&_p]:text-secondary";

export const INSTRUMENT_PANEL = "grid gap-4 p-4";
