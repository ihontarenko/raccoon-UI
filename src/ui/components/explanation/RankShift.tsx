import { useTranslation } from "../../../translations/TranslationProvider";
import type { HitExplanation } from "./explanation";

/* The rank cell: the final place, and under it the rerank shift as an arrow and a count. The ink of
   the shift is chosen here rather than by a second class, so only one colour is ever declared. */
const SHIFT_INK = { up: "text-allow", down: "text-secondary", kept: "text-muted" };

/** A hit's final place, and beneath it how far the rerank model moved it: an arrow and a count, both in words for a reader. */
export function RankShift({ explanation, reranked }: { explanation: HitExplanation; reranked: boolean }) {
  const { t } = useTranslation();
  const { before, after, movement } = explanation;
  const description =
    movement > 0
      ? t("explanation.movedUp", "Rerank moved it up from {before} to {after}", { before, after })
      : movement < 0
        ? t("explanation.movedDown", "Rerank moved it down from {before} to {after}", { before, after })
        : t("explanation.kept", "Rerank kept it at {after}", { after });
  return (
    <span className="grid content-start justify-items-start gap-[2px]">
      <span className="numeric text-xs text-secondary">{String(after).padStart(2, "0")}</span>
      {reranked && (
        <span
          className={`numeric text-2xs whitespace-nowrap ${movement > 0 ? SHIFT_INK.up : movement < 0 ? SHIFT_INK.down : SHIFT_INK.kept}`}
          title={description}
        >
          <span aria-hidden="true">{movement > 0 ? `▲${movement}` : movement < 0 ? `▼${-movement}` : "="}</span>
          <span className="sr-only">{description}</span>
        </span>
      )}
    </span>
  );
}
