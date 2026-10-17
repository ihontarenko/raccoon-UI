import { countOf, formatNumber } from "../../application/format";
import type { Problem } from "../../application/problems";
import { useTranslation } from "../../translations/TranslationProvider";
import { Button } from "../primitives";

interface ListFooterProperties {
  shown: number;
  /**
   * The count already worded in the viewer's language — `plural("files.count", shown, { one, other })`. A screen
   * that has not been translated yet passes the English `noun` (and `plural`) instead.
   */
  counted?: string;
  /** The singular English noun; the plural adds an "s" unless `plural` says otherwise. */
  noun?: string;
  plural?: string;
  /** What the rows are made of, when a row gathers several records — "from 50 events". */
  gathered?: string;
  /** How many match in all, for a route that counts them; the footer then says "of {total}". */
  total?: number | null;
  hasMore: boolean;
  loadingMore: boolean;
  moreProblem: Problem | null;
  onLoadMore: () => void;
}

// Under a paged list: how many rows are on screen, and the way to the next page. The count is
// "shown" — most list routes do not report a total, and a number that looks like one would be a lie the
// moment there is a second page. A route that does count passes `total`, and only then is it said.
export function ListFooter({
  shown,
  counted,
  noun = "row",
  plural,
  gathered,
  total = null,
  hasMore,
  loadingMore,
  moreProblem,
  onLoadMore,
}: ListFooterProperties) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs">
      <span className="text-muted" aria-live="polite">
        {t("listFooter.showing", "Showing {count}", { count: counted ?? countOf(shown, noun, plural) })}
        {gathered === undefined ? "" : ` ${gathered}`}
        {total !== null && hasMore ? t("listFooter.ofTotal", " of {total}", { total: formatNumber(total) }) : ""}
        {hasMore ? "" : t("listFooter.allOfThem", " — all of them")}
      </span>
      {moreProblem !== null && (
        <span className="flex-1 text-danger" role="alert">
          {moreProblem.title}. {moreProblem.detail ?? moreProblem.description}
        </span>
      )}
      {hasMore && (
        <Button onClick={onLoadMore} disabled={loadingMore}>
          {loadingMore
            ? t("common.loading", "Loading…")
            : moreProblem === null
              ? t("listFooter.loadMore", "Load more")
              : t("common.tryAgain", "Try again")}
        </Button>
      )}
    </div>
  );
}
