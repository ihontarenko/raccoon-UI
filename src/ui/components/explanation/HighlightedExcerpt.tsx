import type { HitTermSpan } from "../../../lib/contracts";
import { useTranslation } from "../../../translations/TranslationProvider";
import { piecesOf } from "./explanation";
import { TERM } from "./explanationClasses";

/**
 * An excerpt with the query terms its keyword index matched marked where they occur. A mark names the
 * analyzer term it matched, so a highlighted «Strategy» inside an identifier says it matched «strategy».
 */
export function HighlightedExcerpt({
  text,
  spans,
  truncated,
  className,
}: {
  text: string;
  spans: HitTermSpan[];
  truncated: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <p className={className}>
      {piecesOf(text, spans).map((piece, index) =>
        piece.term === null ? (
          <span key={index}>{piece.text}</span>
        ) : (
          <mark key={index} className={TERM} title={t("explanation.matchedTerm", "Matched the term «{term}»", { term: piece.term })}>
            {piece.text}
          </mark>
        ),
      )}
      {truncated ? "…" : ""}
    </p>
  );
}
