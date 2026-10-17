import { useTranslation } from "../../../translations/TranslationProvider";
import { formatDecimal, type Closeness } from "./closeness";

/*
 * One row per hit: its rank, its title, and a bar for each way it is close — keywords as a share of the best
 * keyword hit, meaning as nearness on the response's distance scale. Bars read across a list where dots on one axis
 * only show the spread; this is the view for "which hits are nearly as good as the first".
 */
const LIST = "m-0 grid list-none gap-0 p-0";

const ROW = [
  "grid w-full cursor-pointer grid-cols-[calc(28px*var(--ui-scale))_minmax(0,0.9fr)_minmax(0,1.6fr)] items-center gap-x-3",
  "border-b border-line px-4 py-2 text-left last:border-b-0",
  "transition-[background-color] duration-120 hover:bg-well motion-reduce:transition-none",
  "data-[selected=true]:bg-well data-[selected=true]:shadow-[inset_3px_0_0_var(--accent)]",
  "max-[700px]:grid-cols-[calc(28px*var(--ui-scale))_minmax(0,1fr)] max-[700px]:[&>.bars]:col-span-full",
].join(" ");

const RANK = "font-mono text-xs font-semibold text-muted tabular-nums";

const TITLE = "truncate text-sm";

const BARS = "bars grid gap-1";

const BAR_LINE = "grid grid-cols-[calc(64px*var(--ui-scale))_minmax(0,1fr)_calc(48px*var(--ui-scale))] items-center gap-2";

const BAR_LABEL = "text-2xs font-semibold tracking-[0.06em] text-muted uppercase";

const TRACK = "h-[calc(6px*var(--ui-scale))] overflow-hidden bg-line";

const VALUE = "text-right font-mono text-xs tabular-nums";

interface ClosenessBarsProperties {
  closenesses: Closeness[];
  titles: string[];
  distanceScaleEnd: number;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

/** Nearness on the shared scale: 1 at distance 0, 0 at the scale's end. */
export function meaningNearness(closeness: Closeness, distanceScaleEnd: number): number | null {
  if (closeness.meaning === null || !Number.isFinite(closeness.meaning.distance) || distanceScaleEnd <= 0) {
    return null;
  }
  return Math.max(0, Math.min(1, 1 - closeness.meaning.distance / distanceScaleEnd));
}

export function ClosenessBars({ closenesses, titles, distanceScaleEnd, selectedIndex, onSelect }: ClosenessBarsProperties) {
  const { t } = useTranslation();
  return (
    <ol className={LIST} aria-label={t("closeness.bars.label", "How close each hit is")}>
      {closenesses.map((closeness, index) => {
        const nearness = meaningNearness(closeness, distanceScaleEnd);
        return (
          <li key={index}>
            <button type="button" className={ROW} data-selected={selectedIndex === index} onClick={() => onSelect(index)}>
              <span className={RANK}>{String(index + 1).padStart(2, "0")}</span>
              <span className={TITLE}>{titles[index]}</span>
              <span className={BARS}>
                {closeness.keywords !== null && (
                  <span className={BAR_LINE}>
                    <span className={BAR_LABEL}>{t("closeness.bars.words", "Words")}</span>
                    <span className={TRACK} aria-hidden="true">
                      <span className="block h-full bg-accent" style={{ width: `${closeness.keywords.relativeToBest * 100}%` }} />
                    </span>
                    <span className={VALUE}>{Math.round(closeness.keywords.relativeToBest * 100)}%</span>
                  </span>
                )}
                {nearness !== null && closeness.meaning !== null && (
                  <span className={BAR_LINE}>
                    <span className={BAR_LABEL}>{t("closeness.bars.meaning", "Meaning")}</span>
                    <span className={TRACK} aria-hidden="true">
                      <span
                        className={closeness.meaning.withinCutOff ? "block h-full bg-allow" : "block h-full bg-warn"}
                        style={{ width: `${nearness * 100}%` }}
                      />
                    </span>
                    <span className={VALUE}>
                      {closeness.meaning.similarity === null
                        ? formatDecimal(closeness.meaning.distance, 3)
                        : formatDecimal(closeness.meaning.similarity, 2)}
                    </span>
                  </span>
                )}
                {closeness.keywords === null && nearness === null && (
                  <span className="text-xs text-muted">{t("closeness.bars.editorial", "No measured closeness")}</span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
