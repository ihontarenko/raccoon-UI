import { TOKEN_QUALITIES } from "../../application/codeLabels";
import { formatDateTime, formatNumber, labelOfCode, shortIdentifier } from "../../application/format";
import { usePagedList } from "../../application/usePagedList";
import { pipelineApi, type Budget } from "../../lib/pipeline";
import { useTranslation } from "../../translations/TranslationProvider";
import { EmptyState, ListFooter, ProblemState, Waiting } from "../../ui/components";
import { Badge, Table, type BadgeTone } from "../../ui/primitives";
import { TABLE_SURFACE } from "./indexingClasses";

const BUDGET_TONE: Record<Budget, BadgeTone> = { WITHIN: "good", EXCEEDED: "error", UNKNOWN: "warn" };

/** Every preflight ever run: what it selected, what it forecast, and whether it fit the budget. */
export function PreflightsTab({ workspaceId }: { workspaceId: string }) {
  const { t, plural, locale } = useTranslation();
  const reports = usePagedList((page) => pipelineApi.preflights(workspaceId, page), [workspaceId]);
  if (reports.status === "loading") {
    return <Waiting label={t("index.preflights.loading", "Loading preflights")} lines={4} />;
  }
  if (reports.status === "failed") {
    return <ProblemState layout="section" problem={reports.problem} />;
  }
  if (reports.items.length === 0) {
    return (
      <EmptyState
        title={t("index.preflights.empty", "No preflight yet")}
        description={t(
          "index.preflights.emptyDescription",
          "A preflight runs before every vectorising and forecasts tokens and cost without calling the model.",
        )}
      />
    );
  }
  const tokenBudget: Record<Budget, string> = {
    WITHIN: t("index.preflights.tokensWithin", "Tokens within"),
    EXCEEDED: t("index.preflights.tokensExceeded", "Tokens exceeded"),
    UNKNOWN: t("index.preflights.tokensUnknown", "Tokens unknown"),
  };
  const costBudget: Record<Budget, string> = {
    WITHIN: t("index.preflights.costWithin", "Cost within"),
    EXCEEDED: t("index.preflights.costExceeded", "Cost exceeded"),
    UNKNOWN: t("index.preflights.costUnknown", "Cost unknown"),
  };
  const costFormat = new Intl.NumberFormat(locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return (
    <div className={TABLE_SURFACE}>
      <Table>
        <thead>
          <tr>
            <th scope="col">{t("index.column.when", "When")}</th>
            <th scope="col">{t("index.column.model", "Model")}</th>
            <th scope="col" className="numeric">
              {t("index.column.files", "Files")}
            </th>
            <th scope="col" className="numeric">
              {t("index.column.chunks", "Chunks")}
            </th>
            <th scope="col" className="numeric">
              {t("index.preflights.tokensToSend", "Tokens to send")}
            </th>
            <th scope="col" className="numeric">
              {t("index.column.cost", "Cost")}
            </th>
            <th scope="col">{t("index.preflights.budget", "Budget")}</th>
          </tr>
        </thead>
        <tbody>
          {reports.items.map((report) => (
            <tr key={report.preflightId}>
              <td>
                {formatDateTime(report.createdAt)}
                <div className="numeric text-xs text-muted">{shortIdentifier(report.preflightId)}</div>
              </td>
              <td>
                {report.model.provider} <span className="numeric text-xs">{report.model.model}</span>
                <div className="text-xs text-muted">
                  {t("index.profileRevision", "profile revision {revision}", { revision: report.profileRevision })}
                </div>
              </td>
              <td className="numeric">{formatNumber(report.preparedFiles)}</td>
              <td className="numeric">
                {formatNumber(report.chunks)}
                {report.reusableChunks > 0 && (
                  <div className="text-xs text-muted">
                    {t("index.preflights.cached", "{count} cached", { count: formatNumber(report.reusableChunks) })}
                  </div>
                )}
              </td>
              <td className="numeric">
                {report.pendingTokens === null ? t("index.unknown", "Unknown") : formatNumber(report.pendingTokens)}
                <div className="text-xs text-muted">{labelOfCode(TOKEN_QUALITIES, report.quality).toLowerCase()}</div>
              </td>
              <td className="numeric">
                {report.estimatedCost === null
                  ? t("index.unknown", "Unknown")
                  : `${costFormat.format(report.estimatedCost)} ${report.currency ?? ""}`}
              </td>
              <td>
                <Badge tone={BUDGET_TONE[report.tokenBudget]}>{tokenBudget[report.tokenBudget]}</Badge>{" "}
                <Badge tone={BUDGET_TONE[report.costBudget]}>{costBudget[report.costBudget]}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <ListFooter
        shown={reports.items.length}
        counted={plural("index.preflights.count", reports.items.length, { one: "{count} preflight", other: "{count} preflights" })}
        hasMore={reports.hasMore}
        loadingMore={reports.loadingMore}
        moreProblem={reports.moreProblem}
        onLoadMore={reports.loadMore}
      />
    </div>
  );
}
