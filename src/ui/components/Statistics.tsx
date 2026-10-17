import type { ReactNode } from "react";
import { classNames } from "../../lib/classNames";

export interface Statistic {
  label: string;
  value: ReactNode;
  /** A rule on the cell's edge for a count that needs attention, or one that is the good outcome. */
  tone?: "warn" | "good";
}

interface StatisticsProperties {
  items: Statistic[];
  label: string;
  /** While the numbers load, the strip keeps its cells so nothing below it moves. */
  loading?: boolean;
}

/* Cells grow to fill their row, so a strip never ends in an empty cell however many counts it holds;
   each cell is as wide as its value needs, so a value never wraps inside it. */
const STRIP = "m-0 flex flex-wrap overflow-hidden rounded-surface border border-line bg-surface";

/* Every cell draws its own right and bottom rule and pulls itself a pixel over its neighbour's, so
   the frame clips the outer ones and the grid stays whole however the strip wraps. */
const CELL = classNames(
  "flex flex-[1_0_auto] flex-col justify-between gap-[calc(2px*var(--ui-scale))]",
  "min-w-[calc(150px*var(--ui-scale))] [margin:0_-1px_-1px_0] border-r border-b border-line px-4 py-3",
);

const TONE_EDGE: Record<"none" | "warn" | "good", string> = {
  none: "shadow-[inset_3px_0_0_transparent]",
  warn: "shadow-[inset_3px_0_0_var(--warn)]",
  good: "shadow-[inset_3px_0_0_var(--good)]",
};

/* Labels wrap rather than widen the cell; the value sits on the cell's floor either way, so every
   value in a row shares one baseline. */
const LABEL = "max-w-[calc(180px*var(--ui-scale))] text-2xs tracking-[0.06em] text-muted uppercase";

const VALUE = "m-0 text-base font-[650] whitespace-nowrap";

/**
 * A strip of counts read left to right, like the dials of an instrument. Every cell draws its own
 * right and bottom rule and the frame clips the outer ones, so the grid stays whole however the strip
 * wraps — and an unfilled last row shows nothing, not a block of rule colour.
 */
export function Statistics({ items, label, loading = false }: StatisticsProperties) {
  return (
    <dl className={STRIP} aria-label={label} aria-busy={loading}>
      {items.map((item) => (
        <div key={item.label} className={classNames(CELL, TONE_EDGE[item.tone ?? "none"])}>
          <dt className={LABEL}>{item.label}</dt>
          <dd className={classNames(VALUE, "numeric")}>{loading ? "…" : item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
