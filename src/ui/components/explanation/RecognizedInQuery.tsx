import type { QueryRecognition } from "../../../lib/contracts";
import { useTranslation } from "../../../translations/TranslationProvider";
import {
  EXPLANATION_CAPTION,
  MARK_ROW,
  STAGE_SYMBOL,
  STAGE_WRAPPING,
} from "./explanationClasses";

/** Whether the server recognised anything in the query worth showing. */
export function hasRecognition(recognition: QueryRecognition | undefined): recognition is QueryRecognition {
  return recognition !== undefined && (recognition.parts.length > 0 || recognition.symbols.length > 0);
}

/**
 * What the query was recognised to name before retrieval: each part with the documents identified as it, and
 * each symbol. Hits from those documents, and chunks containing those symbols, were ranked first; when the
 * profile narrowed the search to one document, that is said in words.
 */
export function RecognizedInQuery({ recognition }: { recognition: QueryRecognition }) {
  const { t } = useTranslation();
  const scopedName =
    recognition.scopedDocumentId === null
      ? null
      : (recognition.parts.flatMap((part) => part.documents).find((document) => document.documentId === recognition.scopedDocumentId)
          ?.name ?? null);
  return (
    <div className="grid min-w-0 gap-1">
      <p className={EXPLANATION_CAPTION}>
        {t("explanation.recognizedCaption", "Recognised in the query")}
      </p>
      <div className={MARK_ROW}>
        {recognition.parts.map((part) => (
          <span
            key={part.name}
            className={`${STAGE_WRAPPING} ${STAGE_SYMBOL}`}
            title={
              part.documents.length === 0
                ? t("explanation.partNoDocumentTitle", "No document is identified as this part")
                : part.documents.map((document) => document.name).join("\n")
            }
          >
            {t("explanation.part", "Part")}
            <span className="numeric">{part.name}</span>
            <span className="text-muted">
              {part.documents.length === 0
                ? t("explanation.partNoDocument", "no document")
                : part.documents.length === 1
                  ? part.documents[0]?.name
                  : t("explanation.partDocuments", "{count} documents", { count: part.documents.length })}
            </span>
          </span>
        ))}
        {recognition.symbols.map((symbol) => (
          <span key={symbol} className={`${STAGE_WRAPPING} ${STAGE_SYMBOL}`}>
            {t("explanation.symbol", "Symbol")}
            <span className="numeric">{symbol}</span>
          </span>
        ))}
      </div>
      {scopedName !== null && (
        <p className="text-2xs text-secondary">
          {t("explanation.recognizedScope", "Searched within {document} only", { document: scopedName })}
        </p>
      )}
    </div>
  );
}
