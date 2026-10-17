import { useTranslation } from "../../../translations/TranslationProvider";
import type { HitExplanation, Stage } from "./explanation";
import {
  MARK_ROW,
  MARK_ROW_LABEL,
  STAGE,
  STAGE_KEYWORD,
  STAGE_MEANING,
  STAGE_SYMBOL,
} from "./explanationClasses";

/**
 * Which retrieval stages returned a hit, each with the place it held there, the symbol boost when the query
 * named the chunk's declaration, and the query terms it contains — the missing ones struck through. Every
 * mark is a word, never a colour alone.
 */
export function FoundBy({ explanation, compact = false }: { explanation: HitExplanation; compact?: boolean }) {
  const { t } = useTranslation();
  const stageWord = (stage: Stage) =>
    stage === "keyword" ? t("explanation.stage.keyword", "Keyword") : t("explanation.stage.meaning", "Meaning");
  const termCount = explanation.matchedTerms.length + explanation.missingTerms.length;
  return (
    <div className={MARK_ROW}>
      <span className={MARK_ROW_LABEL}>{t("explanation.foundBy", "Found by")}</span>
      {explanation.stages.length === 0 && (
        <span className="italic">{t("explanation.stageUnknown", "not reported")}</span>
      )}
      {explanation.stages.map((contribution) => (
        <span
          key={contribution.stage}
          className={`${STAGE} ${contribution.stage === "keyword" ? STAGE_KEYWORD : STAGE_MEANING}`}
          title={
            contribution.rank === null
              ? t("explanation.stageTitle", "The {stage} branch returned it", { stage: stageWord(contribution.stage).toLowerCase() })
              : t("explanation.stageRankTitle", "The {stage} branch placed it {rank}", {
                  stage: stageWord(contribution.stage).toLowerCase(),
                  rank: `#${contribution.rank}`,
                })
          }
        >
          {stageWord(contribution.stage)}
          {contribution.rank !== null && <span className="numeric">#{contribution.rank}</span>}
        </span>
      ))}
      {explanation.symbol !== null && (
        <span
          className={`${STAGE} ${STAGE_SYMBOL}`}
          title={
            explanation.symbol === "exact"
              ? t("explanation.symbolExactTitle", "The query names this chunk's declaration exactly, so it is ranked before text matches")
              : t("explanation.symbolNameTitle", "The query is this chunk's declared name, so it is ranked before text matches")
          }
        >
          {explanation.symbol === "exact"
            ? t("explanation.symbolExact", "Symbol · exact")
            : t("explanation.symbolName", "Symbol · name")}
        </span>
      )}
      {explanation.recognizedPart !== null && (
        <span
          className={`${STAGE} ${STAGE_SYMBOL}`}
          title={t("explanation.partTitle", "The query names part {part}, and this document is identified as it, so it is ranked first", {
            part: explanation.recognizedPart,
          })}
        >
          {t("explanation.part", "Part")}
          <span className="numeric">{explanation.recognizedPart}</span>
        </span>
      )}
      {explanation.recognizedSymbols.map((symbol) => (
        <span
          key={symbol}
          className={`${STAGE} ${STAGE_SYMBOL}`}
          title={t("explanation.containsSymbolTitle", "The query names {symbol}, and this chunk contains it exactly", { symbol })}
        >
          {t("explanation.containsSymbol", "Contains")}
          <span className="numeric">{symbol}</span>
        </span>
      ))}
      {!compact && termCount > 0 && (
        <span className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="numeric text-secondary">
            {t("explanation.termCount", "{matched}/{total} terms", { matched: explanation.matchedTerms.length, total: termCount })}
          </span>
          {explanation.matchedTerms.map((term) => (
            <span key={term} className="numeric text-ink [overflow-wrap:anywhere]">
              {term}
              {explanation.termsBeyondExcerpt.includes(term) && (
                <span
                  className="font-sans text-muted"
                  title={t("explanation.beyondExcerptTitle", "In the chunk, past the excerpt shown")}
                >
                  {" "}
                  {t("explanation.beyondExcerpt", "below")}
                </span>
              )}
            </span>
          ))}
          {explanation.missingTerms.map((term) => (
            <s
              key={term}
              className="numeric text-muted [overflow-wrap:anywhere]"
              title={t("explanation.missingTermTitle", "Not in this chunk's keyword index")}
            >
              <span className="sr-only">{t("explanation.missing", "missing:")} </span>
              {term}
            </s>
          ))}
        </span>
      )}
    </div>
  );
}
