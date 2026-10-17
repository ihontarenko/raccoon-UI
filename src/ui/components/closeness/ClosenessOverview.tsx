import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../../translations/TranslationProvider";
import type { Closeness } from "./closeness";
import { formatDecimal } from "./closeness";

const FIGURE = "m-0 grid gap-3 border-b border-line px-4 py-3";

const ROW = [
  "grid grid-cols-[calc(96px*var(--ui-scale))_minmax(0,1fr)] items-end gap-x-3",
  "max-[700px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

const LABEL = "pb-[calc(2px*var(--ui-scale))] text-2xs font-semibold tracking-[0.06em] text-muted uppercase";

/* Three lanes of dots, with room above them for the cut-off label so a stack never covers it. */
const TRACK = "relative mx-[calc(10px*var(--ui-scale))] h-[calc(92px*var(--ui-scale))]";

const AXIS = "absolute inset-x-0 bottom-0 h-[2px] bg-linear-to-r from-allow to-line-strong opacity-60";

const REFERENCE = "absolute top-[calc(18px*var(--ui-scale))] bottom-0 w-0 border-l-2 border-l-ink border-dashed";

const REFERENCE_LABEL = [
  "absolute top-[calc(-18px*var(--ui-scale))] left-0 -translate-x-1/2 rounded-[calc(3px*var(--ui-scale))]",
  "bg-surface px-1 text-2xs whitespace-nowrap text-ink",
].join(" ");

const ENDS = [
  "col-start-2 flex justify-between text-2xs text-muted",
  "[margin:var(--space-1)_calc(10px*var(--ui-scale))_0]",
  "max-[700px]:col-start-1",
].join(" ");

/* Each dot is the hit rank and selects it; hovered or selected, it gains a ring of ink. */
const DOT = [
  "absolute grid size-[calc(20px*var(--ui-scale))] -translate-x-1/2 place-items-center rounded-full",
  "border-2 border-surface p-0 font-mono text-[calc(10px*var(--ui-scale))] font-bold text-surface",
  "transition-[box-shadow,background-color] duration-120 hover:shadow-[0_0_0_2px_var(--ink)]",
  "motion-reduce:transition-none",
].join(" ");

interface ClosenessOverviewProperties {
  closenesses: Closeness[];
  distanceScaleEnd: number;
  /** The selected hit's position in the list, highlighted on every row. */
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

interface Placed {
  index: number;
  left: number;
  lane: number;
  beyond: boolean;
}

/** Wider than this, in pixels, two dots on the same row stack instead of covering each other. */
const DOT_SPACE = 22;
const LANES = 3;

/**
 * Every hit of one query on shared axes: where each falls between "the same as the question" and the
 * profile's cut-off by meaning, and how its keywords compare with the best keyword match. A hybrid
 * search shows both rows, so which branch found a hit — and how well — is visible at once. Each dot is
 * the hit's rank and selects it.
 */
export function ClosenessOverview({ closenesses, distanceScaleEnd, selectedIndex, onSelect }: ClosenessOverviewProperties) {
  const { t } = useTranslation();
  const frame = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    // ⚠️ An attribute rather than a class: the track is named by utilities now, and a utility class
    // is not a stable hook — the first measurement would be of whatever else happened to carry it.
    const track = frame.current?.querySelector<HTMLElement>("[data-closeness-track]") ?? null;
    if (track === null) {
      return;
    }
    const measure = () => setWidth(track.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  const meaningShare = closenesses.map((closeness) => (closeness.meaning === null ? null : closeness.meaning.distance / distanceScaleEnd));
  const keywordShare = closenesses.map((closeness) => (closeness.keywords === null ? null : 1 - closeness.keywords.relativeToBest));
  const cutOff = closenesses.find((closeness) => closeness.meaning?.cutOff != null)?.meaning?.cutOff ?? null;
  const hasMeaning = meaningShare.some((share) => share !== null);
  const hasKeywords = keywordShare.some((share) => share !== null);

  const place = (shares: (number | null)[], beyondOf: (index: number) => boolean): Placed[] => {
    const lanesEnd: number[] = Array.from({ length: LANES }, () => Number.NEGATIVE_INFINITY);
    return shares
      .map((share, index) => ({ share, index }))
      .filter((entry): entry is { share: number; index: number } => entry.share !== null)
      .sort((first, second) => first.share - second.share)
      .map(({ share, index }) => {
        const pixels = Math.max(0, Math.min(1, share)) * width;
        let lane = lanesEnd.findIndex((end) => pixels - end >= DOT_SPACE);
        if (lane < 0) {
          lane = lanesEnd.indexOf(Math.min(...lanesEnd));
        }
        lanesEnd[lane] = pixels;
        return { index, left: Math.max(0, Math.min(1, share)) * 100, lane, beyond: beyondOf(index) };
      });
  };

  const rows = [
    hasMeaning
      ? {
          key: "meaning",
          label: t("closeness.byMeaning", "By meaning"),
          start: t("closeness.sameMeaning", "same meaning"),
          end: t("closeness.distanceValue", "distance {distance}", { distance: formatDecimal(distanceScaleEnd, 1) }),
          dots: place(meaningShare, (index) => closenesses[index]?.meaning?.withinCutOff === false),
          reference: cutOff === null ? null : { left: (cutOff / distanceScaleEnd) * 100, label: t("closeness.cutOffValue", "cut-off {cutOff}", { cutOff: formatDecimal(cutOff, 2) }) },
        }
      : null,
    hasKeywords
      ? {
          key: "keywords",
          label: t("closeness.byKeywords", "By keywords"),
          start: t("closeness.bestMatch", "the best match"),
          end: t("closeness.noMatch", "no match"),
          dots: place(keywordShare, () => false),
          reference: null,
        }
      : null,
  ].filter((row): row is NonNullable<typeof row> => row !== null);

  return (
    <figure ref={frame} className={FIGURE} aria-label={t("closeness.overviewLabel", "How close each hit is to the question")}>
      {rows.map((row) => (
        <div key={row.key} className={ROW}>
          <span className={LABEL}>{row.label}</span>
          <div className={TRACK} data-closeness-track>
            <div className={AXIS} />
            {row.reference !== null && (
              <span className={REFERENCE} style={{ left: `${row.reference.left}%` }}>
                <span className={REFERENCE_LABEL}>{row.reference.label}</span>
              </span>
            )}
            {row.dots.map((dot) => (
              <button
                key={dot.index}
                type="button"
                className={`${DOT} ${dot.beyond ? "bg-deny" : "bg-allow"} ${selectedIndex === dot.index ? "shadow-[0_0_0_2px_var(--ink)]" : ""}`}
                style={{ left: `${dot.left}%`, bottom: `calc(${dot.lane * 20}px * var(--ui-scale) + 6px)` }}
                aria-label={t("closeness.dotLabel", "Hit {number}, {row}", { number: dot.index + 1, row: row.label.toLowerCase() })}
                aria-pressed={selectedIndex === dot.index}
                onClick={() => onSelect(dot.index)}
              >
                {dot.index + 1}
              </button>
            ))}
          </div>
          <div className={ENDS} aria-hidden="true">
            <span>{row.start}</span>
            <span>{row.end}</span>
          </div>
        </div>
      ))}
      <figcaption className="text-2xs text-muted">
        {hasMeaning && hasKeywords
          ? t(
              "closeness.captionBoth",
              "Left is closer to the question. Meaning is the distance between the question's vector and the result's; keywords are compared with the best keyword match of this search, not with a fixed scale.",
            )
          : hasMeaning
            ? t(
                "closeness.captionMeaning",
                "Left is closer to the question. Meaning is the distance between the question's vector and the result's.",
              )
            : t(
                "closeness.captionKeywords",
                "Left is closer to the question. Keywords are compared with the best keyword match of this search, not with a fixed scale.",
              )}
      </figcaption>
    </figure>
  );
}
