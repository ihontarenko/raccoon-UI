import { useTranslation } from "../../../translations/TranslationProvider";
import type { TermPresence as Presence } from "./explanation";
import { EXPLANATION_CAPTION } from "./explanationClasses";

const CELL = "[padding:2px_var(--space-2)_2px_0] border-b border-line text-left align-middle font-normal";

/* A count column is as narrow as its figures and right-aligned against them. */
const COUNT = "w-[1%] text-right whitespace-nowrap text-secondary";

/**
 * The query as the keyword analyzer reads it — each term and how many of the returned hits contain it. A
 * term no hit contains is the first thing to check when a search finds the wrong thing: those words reached
 * the result only by meaning, or not at all.
 */
export function TermPresence({ presence, hitCount }: { presence: Presence[]; hitCount: number }) {
  const { t } = useTranslation();
  if (presence.length === 0) {
    return null;
  }
  return (
    <table className="w-full border-collapse text-2xs">
      <caption className={EXPLANATION_CAPTION}>{t("explanation.presenceCaption", "Query terms, as the keyword index reads them")}</caption>
      <thead>
        <tr>
          <th scope="col" className={`${CELL} text-muted`}>
            {t("explanation.presenceTerm", "Term")}
          </th>
          <th scope="col" className={`${CELL} ${COUNT} text-muted`}>
            {t("explanation.presenceHits", "In hits")}
          </th>
          <th scope="col" className={`${CELL} text-muted`}>
            <span className="sr-only">{t("explanation.presenceShare", "Share of hits")}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {presence.map((row) => (
          <tr key={row.term}>
            {/* A term no hit contains is struck through as well as muted: the absence is the point. */}
            <th
              scope="row"
              className={`${CELL} numeric [overflow-wrap:anywhere] ${row.hits === 0 ? "text-muted line-through" : "text-ink"}`}
            >
              {row.term}
            </th>
            <td className={`${CELL} ${COUNT} numeric`}>
              {row.hits}/{hitCount}
            </td>
            <td className={`${CELL} w-[40%] whitespace-nowrap`}>
              {row.hits === 0 ? (
                <span className="text-warn">{t("explanation.presenceNone", "no hit")}</span>
              ) : (
                <span
                  className="inline-block h-[4px] w-full max-w-[96px] bg-well align-middle"
                  aria-hidden="true"
                >
                  <span
                    className="block h-full bg-ink"
                    style={{ width: `${hitCount === 0 ? 0 : (row.hits / hitCount) * 100}%` }}
                  />
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
