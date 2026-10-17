import { useId, type ReactNode } from "react";
import { classNames } from "../../lib/classNames";
import { Badge } from "../primitives";

const SECTION = [
  "grid min-w-0 gap-3 [padding:var(--space-4)_var(--space-5)_var(--space-5)]",
  "not-first:border-t not-first:border-line",
  "max-[720px]:[padding:var(--space-3)_var(--space-4)_var(--space-4)]",
  "[&>p]:m-0",
].join(" ");

/* ⚠️ THE LABEL COLUMN IS ONE WIDTH FOR THE WHOLE PRODUCT, and it is a variable a page may narrow
   rather than a number repeated per screen — a parser, a chunker and a content step are read down
   one edge or they are not comparable at all. Below 720px the two tracks become one and the pair
   stacks, which is also why the row spacing moves from the grid gap onto the labels. */
const LIST = [
  "m-0 grid grid-cols-[var(--detail-label-width,12rem)_minmax(0,1fr)] items-baseline",
  "gap-x-6 gap-y-3 text-sm",
  "[&>div>dt]:text-secondary",
  "[&>div>dd]:m-0 [&>div>dd]:grid [&>div>dd]:min-w-0 [&>div>dd]:gap-1 [&>div>dd]:[overflow-wrap:anywhere]",
  "max-[720px]:grid-cols-[minmax(0,1fr)] max-[720px]:gap-0",
  "max-[720px]:[&>[data-detail-row]+[data-detail-row]>dt]:mt-3",
].join(" ");

/* Literal values are the product own neutral Badge — the one component for short labelled values —
   so they never drift into a look of their own. */
const TOKENS = "m-0 flex list-none flex-wrap gap-1 p-0";

/* A name is not a literal: it can be long enough to wrap, and it wraps inside its badge rather than
   pushing a narrow inspector column sideways. */
const NAMES = "[&_li>*]:max-w-full [&_li>*]:whitespace-normal";

// One template for an object's settings on a detail page: one bordered surface, sections separated by a 1px rule,
// each a heading over a definition list whose labels share one column width everywhere — so a parser, a chunker and a
// content step read the same way, and like a source's overview.

/** The bordered surface the sections sit on. */
export function DetailSurface({ children }: { children: ReactNode }) {
  return <div className="min-w-0 rounded-surface border border-line bg-surface">{children}</div>;
}

/** One section: a heading that outranks its values, an optional action beside it, then its content. */
export function DetailSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const headingId = useId();
  return (
    <section className={SECTION} aria-labelledby={headingId}>
      <div className="flex min-h-(--control) items-center justify-between gap-3">
        <h2 id={headingId} className="m-0 text-md font-[650]">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Labels and values, the labels in one column of one width; rows align on their first line. */
export function DetailList({ rows }: { rows: [label: string, value: ReactNode][] }) {
  return (
    <dl className={LIST}>
      {rows.map(([label, value]) => (
        <div key={label} className="contents" data-detail-row>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Short literal values — media types, extensions, listed words — as a wrapping run of code tokens.
 *
 * ⚠️ Neutral, not `active`. These are facts, not states: a table whose every row carries a run of blue
 * chips spends the colour that means something on decoration, and on a selected row — itself painted
 * with the accent — the chips disappear into it.
 */
export function DetailTokens({ values }: { values: string[] }) {
  return (
    <ul className={TOKENS}>
      {values.map((value) => (
        <li key={value}>
          <Badge>{value}</Badge>
        </li>
      ))}
    </ul>
  );
}

/**
 * Several named references — the parsers a chunker reads, the profiles that run a step — as the same wrapping run
 * of badges {@link DetailTokens} draws. Each names another object in the product, so it is a token rather than a
 * line of prose, and nothing in the column is left to read as unmarked grey text. Absence is not a token and stays
 * a sentence.
 */
export function StackedValues({ values, empty }: { values: ReactNode[]; empty: ReactNode }) {
  if (values.length === 0) {
    return <span className="text-muted">{empty}</span>;
  }
  return (
    <ul className={classNames(TOKENS, NAMES)}>
      {values.map((value, index) => (
        <li key={index}>
          <Badge tone="active">{value}</Badge>
        </li>
      ))}
    </ul>
  );
}
