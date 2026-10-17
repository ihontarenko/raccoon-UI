import { useTranslation } from "../../../translations/TranslationProvider";
import type { Closeness } from "./closeness";
import { describeCloseness, formatDecimal } from "./closeness";
import { PhaseWave } from "./PhaseWave";

/* In a result row: the wave, or a bar, beside the score — and the number in words beneath it. */
const CELL = "grid justify-items-end gap-[calc(2px*var(--ui-scale))]";

const BAR = [
  "relative h-[calc(6px*var(--ui-scale))] w-[calc(72px*var(--ui-scale))]",
  "rounded-[calc(3px*var(--ui-scale))] bg-well shadow-[inset_0_0_0_1px_var(--line)]",
].join(" ");

const BAR_FILL = "absolute inset-y-0 left-0 rounded-[inherit] bg-allow";

const CAPTION = "numeric text-2xs whitespace-nowrap text-muted";

/**
 * A result row's closeness at a glance: the wave pair when the meaning was measured by angle, otherwise
 * a bar — the distance against the shared axis, or the keyword score against the best match — and the
 * number in words beneath it.
 */
export function HitCloseness({ closeness, distanceScaleEnd }: { closeness: Closeness; distanceScaleEnd: number }) {
  const { t } = useTranslation();
  const description = describeCloseness(closeness);
  const { meaning, keywords } = closeness;
  if (meaning !== null && meaning.similarity !== null && meaning.angleDegrees !== null) {
    return (
      <span className={CELL} title={description}>
        <PhaseWave angleDegrees={meaning.angleDegrees} beyondCutOff={!meaning.withinCutOff} description={description} />
        <span className={CAPTION}>
          {t("closeness.similarity", "similarity {similarity}", { similarity: formatDecimal(meaning.similarity, 2) })}
        </span>
      </span>
    );
  }
  if (meaning !== null) {
    return (
      <span className={CELL} title={description} role="img" aria-label={description}>
        <span className={BAR} aria-hidden="true">
          <span className={BAR_FILL} style={{ width: `${Math.max(4, (1 - Math.min(1, meaning.distance / distanceScaleEnd)) * 100)}%` }} />
        </span>
        <span className={CAPTION}>
          {t("closeness.distanceValue", "distance {distance}", { distance: formatDecimal(meaning.distance, 2) })}
        </span>
      </span>
    );
  }
  if (keywords !== null) {
    return (
      <span className={CELL} title={description} role="img" aria-label={description}>
        <span className={BAR} aria-hidden="true">
          <span className={BAR_FILL} style={{ width: `${Math.max(4, keywords.relativeToBest * 100)}%` }} />
        </span>
        <span className={CAPTION}>
          {t("closeness.ofTheBest", "{percent}% of the best", { percent: Math.round(keywords.relativeToBest * 100) })}
        </span>
      </span>
    );
  }
  return (
    <span className={CAPTION} title={description}>
      {t("closeness.score", "score {score}", { score: formatDecimal(closeness.rankingScore, 3) })}
    </span>
  );
}
