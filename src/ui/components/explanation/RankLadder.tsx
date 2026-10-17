import { useTranslation } from "../../../translations/TranslationProvider";
import type { HitExplanation } from "./explanation";

const WIDTH = 168;
const ROW = 11;
const TOP = 18;
const LEFT = 30;
const RIGHT = WIDTH - 30;

const AXIS_LABEL = "fill-muted text-[9px] tracking-[0.06em] uppercase";
const AXIS_RULE = "stroke-line [stroke-width:1]";

const VALUE = "fill-secondary text-[9px] [font-variant-numeric:tabular-nums]";
const VALUE_SELECTED = "fill-ink font-semibold text-[9px] [font-variant-numeric:tabular-nums]";

/*
 * ⚠️ EVERY SVG CHILD CARRIES ITS OWN CLASS, computed here rather than inherited from a class on the
 * group. The CSS Module this replaced styled `line` and `circle` as descendants of `.ladderUp`,
 * `.ladderDown` and `.ladderSelected`; with utilities the state is resolved in TypeScript and each
 * element is told what it is. One declaration per property per element is also what keeps a selected
 * line from carrying both its direction stroke and the accent one — nothing here is merged.
 */
type Direction = "up" | "down" | "kept";

/** A line that rises moved up; a dashed one fell. The dash is why direction never rests on colour. */
const SLOPE: Record<Direction, string> = {
  up: "stroke-allow [stroke-width:1.5]",
  down: "stroke-line-strong [stroke-width:1.5] [stroke-dasharray:3_2]",
  kept: "stroke-line-strong [stroke-width:1.5]",
};

const SLOPE_SELECTED = "stroke-accent [stroke-width:2.5] [stroke-dasharray:none]";

const MARK: Record<Direction, string> = {
  up: "fill-allow stroke-surface [stroke-width:1]",
  down: "fill-line-strong stroke-surface [stroke-width:1]",
  kept: "fill-line-strong stroke-surface [stroke-width:1]",
};

const MARK_SELECTED = "fill-accent stroke-surface [stroke-width:1]";

/* Nine pixels of invisible stroke: a 1.5px line is not something a pointer can be expected to find. */
const HIT_AREA = "stroke-transparent [stroke-width:9] [stroke-dasharray:none]";

function directionOf(movement: number): Direction {
  if (movement > 0) {
    return "up";
  }
  if (movement < 0) {
    return "down";
  }
  return "kept";
}

/**
 * The rerank stage as a slope chart: each kept hit is a line from the place fusion gave it (left) to the
 * place the rerank model gave it (right). A line that rises moved up. Positions are written at both ends, so
 * direction never rests on colour; the hit list beside it is the keyboard and screen-reader path, and a
 * click on a line selects that hit there.
 */
export function RankLadder({
  explanations,
  selectedIndex,
  onSelect,
}: {
  explanations: HitExplanation[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}) {
  const { t } = useTranslation();
  if (explanations.length === 0) {
    return null;
  }
  const deepest = Math.max(...explanations.map((explanation) => Math.max(explanation.before, explanation.after)));
  const height = TOP + deepest * ROW + 4;
  const yOf = (position: number) => TOP + (position - 0.5) * ROW;
  const up = explanations.filter((explanation) => explanation.movement > 0).length;
  const down = explanations.filter((explanation) => explanation.movement < 0).length;
  const kept = explanations.length - up - down;
  const summary = t("explanation.ladderSummary", "Rerank: {up} moved up · {down} down · {kept} kept their place", { up, down, kept });
  return (
    <figure className="m-0 grid gap-1">
      <svg
        width={WIDTH}
        height={height}
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-label={summary}
        className="block max-w-full overflow-visible"
      >
        <text x={LEFT} y={10} textAnchor="middle" className={AXIS_LABEL}>
          {t("explanation.ladderFused", "fused")}
        </text>
        <text x={RIGHT} y={10} textAnchor="middle" className={AXIS_LABEL}>
          {t("explanation.ladderReranked", "reranked")}
        </text>
        <line x1={LEFT} y1={TOP - 4} x2={LEFT} y2={height - 2} className={AXIS_RULE} />
        <line x1={RIGHT} y1={TOP - 4} x2={RIGHT} y2={height - 2} className={AXIS_RULE} />
        {explanations.map((explanation, index) => {
          const selected = index === selectedIndex;
          const direction = directionOf(explanation.movement);
          const from = yOf(explanation.before);
          const to = yOf(explanation.after);
          const slope = selected ? SLOPE_SELECTED : SLOPE[direction];
          const mark = selected ? MARK_SELECTED : MARK[direction];
          const value = selected ? VALUE_SELECTED : VALUE;
          return (
            <g
              key={index}
              className="cursor-pointer"
              onClick={() => {
                onSelect(index);
              }}
            >
              <title>
                {t("explanation.ladderLineTitle", "{before} → {after}", { before: explanation.before, after: explanation.after })}
              </title>
              <line x1={LEFT} y1={from} x2={RIGHT} y2={to} className={HIT_AREA} />
              <line x1={LEFT} y1={from} x2={RIGHT} y2={to} className={slope} />
              <circle cx={LEFT} cy={from} r={2.5} className={mark} />
              <circle cx={RIGHT} cy={to} r={2.5} className={mark} />
              <text x={LEFT - 6} y={from + 3} textAnchor="end" className={value}>
                {explanation.before}
              </text>
              <text x={RIGHT + 6} y={to + 3} textAnchor="start" className={value}>
                {explanation.after}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="max-w-[24ch] text-2xs text-muted">{summary}</figcaption>
    </figure>
  );
}
