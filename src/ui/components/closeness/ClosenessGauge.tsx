import { useTranslation } from "../../../translations/TranslationProvider";
import type { Closeness } from "./closeness";
import { describeCloseness, formatDecimal } from "./closeness";
import { PhaseWave } from "./PhaseWave";

const ROW = "grid gap-2";

const HEAD = "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1";

const LABEL = "text-2xs font-semibold tracking-[0.06em] text-muted uppercase";

const VALUE = "numeric text-xs text-ink";

const TRACK = [
  "relative h-[calc(8px*var(--ui-scale))] rounded-[calc(4px*var(--ui-scale))] bg-well",
  "shadow-[inset_0_0_0_1px_var(--line)]",
].join(" ");

/* The fill is translucent so the marker and the cut-off line stay readable over it. */
const FILL = "absolute inset-y-0 left-0 rounded-[inherit] opacity-35";

const MARKER = [
  "absolute top-1/2 size-[calc(12px*var(--ui-scale))] -translate-x-1/2 -translate-y-1/2",
  "rounded-full border-2 border-surface",
].join(" ");

/* The profile cut-off: a dashed rule in the ink colour, so it is not one of the two verdict colours. */
const REFERENCE = [
  "absolute top-[calc(-4px*var(--ui-scale))] bottom-[calc(-4px*var(--ui-scale))] w-0",
  "border-l-2 border-l-ink border-dashed",
].join(" ");

interface ClosenessGaugeProperties {
  closeness: Closeness;
  /** The end of the shared distance axis, so every hit's gauge reads on the same scale. */
  distanceScaleEnd: number;
}

/**
 * One result against its question, as numbers on labelled scales: how far its meaning is — with the
 * profile's cut-off drawn as a line — and how its keywords compare with the best keyword match. Left
 * is always closer.
 */
export function ClosenessGauge({ closeness, distanceScaleEnd }: ClosenessGaugeProperties) {
  const { t } = useTranslation();
  const { meaning, keywords } = closeness;
  return (
    <div className="grid gap-4">
      {meaning !== null && (
        <div className={ROW}>
          <div className={HEAD}>
            <span className={LABEL}>{t("closeness.byMeaning", "By meaning")}</span>
            <span className={VALUE}>
              {meaning.similarity !== null && meaning.angleDegrees !== null
                ? t("closeness.similarityApart", "similarity {similarity} · {angle}° apart", {
                    similarity: formatDecimal(meaning.similarity, 2),
                    angle: Math.round(meaning.angleDegrees),
                  })
                : t("closeness.distanceValue", "distance {distance}", { distance: formatDecimal(meaning.distance, 3) })}
            </span>
          </div>
          {meaning.angleDegrees !== null && (
            <PhaseWave
              size="large"
              angleDegrees={meaning.angleDegrees}
              beyondCutOff={!meaning.withinCutOff}
              description={t("closeness.waveDescription", "The question's wave and the result's wave, {angle}° apart", {
                angle: Math.round(meaning.angleDegrees),
              })}
            />
          )}
          <Scale
            value={meaning.distance}
            end={distanceScaleEnd}
            reference={meaning.cutOff}
            referenceLabel={t("closeness.cutOff", "cut-off")}
            beyond={!meaning.withinCutOff}
            startLabel={t("closeness.sameMeaning", "same meaning")}
            endLabel={t("closeness.distanceValue", "distance {distance}", { distance: formatDecimal(distanceScaleEnd, 1) })}
          />
        </div>
      )}
      {keywords !== null && (
        <div className={ROW}>
          <div className={HEAD}>
            <span className={LABEL}>{t("closeness.byKeywords", "By keywords")}</span>
            <span className={VALUE}>
              {t("closeness.ofTheBestWithScore", "{percent}% of the best · score {score}", {
                percent: Math.round(keywords.relativeToBest * 100),
                score: formatDecimal(keywords.score, 3),
              })}
            </span>
          </div>
          <Scale
            value={1 - keywords.relativeToBest}
            end={1}
            reference={null}
            beyond={false}
            startLabel={t("closeness.bestMatch", "the best match")}
            endLabel={t("closeness.noKeywordMatch", "no keyword match")}
          />
        </div>
      )}
      <p className="sr-only">{describeCloseness(closeness)}</p>
    </div>
  );
}

function Scale({
  value,
  end,
  reference,
  referenceLabel,
  beyond,
  startLabel,
  endLabel,
}: {
  value: number;
  end: number;
  reference: number | null;
  referenceLabel?: string;
  beyond: boolean;
  startLabel: string;
  endLabel: string;
}) {
  const position = (amount: number) => `${Math.max(0, Math.min(100, (amount / end) * 100))}%`;
  return (
    <div className="grid gap-1" aria-hidden="true">
      <div className={TRACK}>
        <span
          className={`${FILL} ${beyond ? "bg-deny" : "bg-allow"}`}
          style={{ width: position(value) }}
        />
        {reference !== null && (
          <span className={REFERENCE} style={{ left: position(reference) }} title={`${referenceLabel} ${formatDecimal(reference, 2)}`} />
        )}
        <span
          className={`${MARKER} ${beyond ? "bg-deny" : "bg-allow"}`}
          style={{ left: position(value) }}
        />
      </div>
      <div className="relative flex justify-between text-2xs text-muted">
        <span>{startLabel}</span>
        {reference !== null && (
          <span
            className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-ink"
            style={{ left: position(reference) }}
          >{`${referenceLabel} ${formatDecimal(reference, 2)}`}</span>
        )}
        <span>{endLabel}</span>
      </div>
    </div>
  );
}
