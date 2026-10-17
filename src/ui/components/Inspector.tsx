import type { ReactNode } from "react";

/*
 * Clipped rather than hidden: a hidden overflow is a scroll container, and the inspector inside it
 * could never stick. The divider is PAINTED BY THE WORKBENCH as a one-pixel gradient layer, so it
 * runs the full height of a long list even though the inspector beside it is only as tall as its
 * content — a border on the inspector itself would stop where its content stops.
 *
 * ⚠️ The gradient is applied only above 1100px rather than painted and then repainted. Below that
 * the columns stack, there is no vertical edge to draw, and a second declaration of `background`
 * would depend on which of two variants Tailwind happens to emit last.
 *
 * ⚠️ `--head-band` is why the two columns start on one line: the list header bar and the inspector
 * head both open with a band of this height, so nothing under them is shifted against its neighbour.
 */
const WORKBENCH = [
  "[--head-band:calc(68px*var(--ui-scale))] grid min-w-0 grid-cols-[minmax(0,1fr)_var(--inspector)]",
  "items-start overflow-clip rounded-surface border border-line bg-surface",
  "min-[1101px]:has-[>[data-inspector]]:[background:linear-gradient(var(--line),var(--line))_no-repeat_calc(100%-var(--inspector))_0_/_1px_100%,var(--surface)]",
  "[&>:only-child]:col-span-full",
  "max-[1100px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

/* The selected row details stay in view while a long list scrolls past them — until the columns
   stack, where sticking would pin the inspector over the list it belongs beside. */
const INSPECTOR = [
  "sticky top-[calc(52px*var(--ui-scale)+var(--space-4))] min-w-0 overflow-auto bg-surface",
  "max-h-[calc(100dvh-52px*var(--ui-scale)-var(--space-6))]",
  "max-[1100px]:static max-[1100px]:max-h-none max-[1100px]:border-t max-[1100px]:border-t-line-strong",
].join(" ");

const SECTION_BAR = [
  "flex min-h-[var(--head-band,calc(48px*var(--ui-scale)))] flex-wrap items-center justify-between",
  "gap-3 border-b border-line px-4 py-2",
].join(" ");

/*
 * A fact whose value is a list is laid out AS a list: the label stands above it and the items start
 * at the column own left edge. Hung in the second track they were a narrow ragged column — every
 * entry long enough to wrap did, and the wrapped half sat under nothing.
 */
const FACTS = [
  "m-0 grid grid-cols-[var(--facts-label-width,auto)_minmax(0,1fr)] gap-x-4 gap-y-2 text-xs",
  "[&>div>dt]:text-muted [&>div>dd]:m-0 [&>div>dd]:[overflow-wrap:anywhere]",
].join(" ");

const FACT = "contents has-[>dd>ul]:col-span-full has-[>dd>ul]:grid has-[>dd>ul]:min-w-0 has-[>dd>ul]:gap-1";

interface InspectorProperties {
  /** Accessible name of the complementary region, e.g. "Selected source". */
  label: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
}

// The detail column beside a list: it shares an edge with the list rather than floating as a card,
// and stacks below the list on narrow screens.
export function Inspector({ label, eyebrow, title, children }: InspectorProperties) {
  return (
    <aside className={INSPECTOR} aria-label={label} data-inspector>
      <header className="grid min-h-[var(--head-band,auto)] content-center gap-1 px-4 py-3 border-b border-line">
        {eyebrow !== undefined && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="[overflow-wrap:anywhere]">{title}</h2>
      </header>
      {children}
    </aside>
  );
}

export function InspectorSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 border-b border-line p-4 last:border-b-0">
      {title !== undefined && (
        <h3 className="text-2xs font-semibold tracking-[0.06em] text-muted uppercase">{title}</h3>
      )}
      {children}
    </section>
  );
}

/**
 * The actions of an inspector, one under another at the column's full width: the column is narrow, so two
 * buttons side by side cut a label short, and a stack keeps the primary action first and every label whole.
 */
export function InspectorActions({ children }: { children: ReactNode }) {
  return <div className="grid gap-2 [&>*]:w-full [&>*]:justify-center">{children}</div>;
}

export function Facts({ rows }: { rows: [label: string, value: ReactNode][] }) {
  // A list with nothing in it would still keep its margins, leaving a gap with no meaning.
  if (rows.length === 0) {
    return null;
  }
  return (
    <dl className={FACTS}>
      {rows.map(([label, value]) => (
        <div key={label} className={FACT}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A list and its inspector sharing one bordered surface. */
export function Workbench({ children }: { children: ReactNode }) {
  return <div className={WORKBENCH}>{children}</div>;
}

export function SectionBar({ children }: { children: ReactNode }) {
  return <div className={SECTION_BAR}>{children}</div>;
}

interface ListHeadProperties {
  /** What the rows are, as a heading — the list is a list, and this names it. */
  title: ReactNode;
  /** How many rows, already worded by the caller's plural(). */
  count?: ReactNode;
  /** What can be done to the list as a whole — adding a row, or going where rows are made. */
  children?: ReactNode;
}

/**
 * The head of the list beside an inspector: its name, how many rows it holds and what can be done to
 * it. It stands on the band the inspector head stands on, so the two columns start on one line.
 */
export function ListHead({ title, count, children }: ListHeadProperties) {
  return (
    <div className={SECTION_BAR}>
      <h2 className="text-md font-semibold">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">
        {count !== undefined && <span className="text-xs text-muted">{count}</span>}
        {children}
      </div>
    </div>
  );
}
