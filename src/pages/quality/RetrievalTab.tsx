import { useState } from "react";
import { usePermissions } from "../../access/PermissionsProvider";
import { PERMISSIONS } from "../../access/permissions";
import { MODEL_CALL_STATES, RETRIEVAL_MODES, RETRIEVAL_REASONS } from "../../application/codeLabels";
import { formatBytes, formatDateTime, formatNumber, labelOfCode, shortIdentifier } from "../../application/format";
import { describeProblem } from "../../application/problems";
import { usePagedList } from "../../application/usePagedList";
import { useResource } from "../../application/useResource";
import { answersApi, type QueryEmbeddingCall } from "../../lib/answers";
import { useTranslation } from "../../translations/TranslationProvider";
import { ConfirmDialog, EmptyState, ListFooter, ProblemState, Segmented, Statistics, Waiting, useToaster } from "../../ui/components";
import { Badge, Button, Table } from "../../ui/primitives";
import { CALL_TONE } from "../activity/callTones";
import { INTRO, STACK, TABLE_SURFACE, TOOLBAR, TOOLBAR_ACTIONS } from "./qualityClasses";

type View = "reports" | "calls" | "cache";

/** Every real query: which way it was routed and why, the model calls it made, and the vectors cached for it. */
export function RetrievalTab({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const statistics = useResource(() => answersApi.retrievalStatistics(workspaceId), [workspaceId]);
  const [view, setView] = useState<View>("reports");

  return (
    <div className={STACK}>
      <p className={INTRO}>
        {t(
          "quality.retrieval.intro",
          "Every real search and answer, as it ran: which retrieval mode was used and why, how many model calls it made, and the tokens they cost.",
        )}
      </p>
      <Statistics
        label={t("quality.retrieval.glance", "Retrieval at a glance")}
        loading={statistics.status !== "ready"}
        items={[
          {
            label: t("quality.retrieval.reports", "Queries reported"),
            value: statistics.status === "ready" ? formatNumber(statistics.data.reports) : "",
          },
          {
            label: t("quality.retrieval.calls", "Model calls"),
            value: statistics.status === "ready" ? formatNumber(statistics.data.calls) : "",
          },
          {
            label: t("quality.retrieval.unresolvedCalls", "Unresolved calls"),
            value: statistics.status === "ready" ? formatNumber(statistics.data.unresolvedCalls) : "",
            tone: statistics.status === "ready" && statistics.data.unresolvedCalls > 0 ? "warn" : undefined,
          },
          {
            label: t("quality.retrieval.inputTokens", "Input tokens"),
            value: statistics.status === "ready" ? formatNumber(statistics.data.reportedInputTokens) : "",
          },
          {
            label: t("quality.retrieval.cachedVectors", "Cached query vectors"),
            value:
              statistics.status === "ready"
                ? `${formatNumber(statistics.data.cachedVectors)} · ${formatBytes(statistics.data.cachedVectorBytes)}`
                : "",
          },
        ]}
      />
      <Segmented<View>
        label={t("quality.retrieval.show", "Show")}
        value={view}
        onChange={setView}
        options={[
          { value: "reports", label: t("quality.retrieval.queries", "Queries") },
          { value: "calls", label: t("quality.retrieval.calls", "Model calls") },
          { value: "cache", label: t("quality.retrieval.cache", "Query cache") },
        ]}
      />
      {view === "reports" && <ReportsView workspaceId={workspaceId} />}
      {view === "calls" && <CallsView workspaceId={workspaceId} onChanged={statistics.reload} />}
      {view === "cache" && <CacheView workspaceId={workspaceId} onChanged={statistics.reload} />}
    </div>
  );
}

function ReportsView({ workspaceId }: { workspaceId: string }) {
  const { t, plural } = useTranslation();
  const reports = usePagedList((page) => answersApi.retrievalReports(workspaceId, page), [workspaceId]);
  if (reports.status === "loading") {
    return <Waiting label={t("quality.retrieval.loadingQueries", "Loading queries")} lines={4} />;
  }
  if (reports.status === "failed") {
    return <ProblemState layout="section" problem={reports.problem} />;
  }
  if (reports.items.length === 0) {
    return (
      <EmptyState
        title={t("quality.retrieval.noQueries", "No queries yet")}
        description={t(
          "quality.retrieval.noQueriesDescription",
          "Every search records how it was routed — by keywords, vectors or both — and why.",
        )}
      />
    );
  }
  return (
    <div className={TABLE_SURFACE}>
      <Table>
        <thead>
          <tr>
            <th scope="col">{t("quality.column.when", "When")}</th>
            <th scope="col">{t("quality.retrieval.askedFor", "Asked for")}</th>
            <th scope="col">{t("quality.retrieval.ranAs", "Ran as")}</th>
            <th scope="col">{t("quality.retrieval.why", "Why")}</th>
            <th scope="col" className="numeric">
              {t("quality.retrieval.candidates", "Candidates")}
            </th>
            <th scope="col" className="numeric">
              {t("quality.column.tokens", "Tokens")}
            </th>
          </tr>
        </thead>
        <tbody>
          {reports.items.map((report) => (
            <tr key={report.queryId}>
              <td className="text-xs text-secondary">
                {formatDateTime(report.createdAt)}
                <div className="numeric text-muted">{report.actorId.slice(0, 12)}</div>
              </td>
              <td className="text-xs">{labelOfCode(RETRIEVAL_MODES, report.retrieval.requestedMode)}</td>
              <td>
                <Badge tone={report.retrieval.requestedMode === report.retrieval.effectiveMode || report.retrieval.requestedMode === "AUTO" ? "neutral" : "warn"}>
                  {labelOfCode(RETRIEVAL_MODES, report.retrieval.effectiveMode)}
                </Badge>
              </td>
              <td className="text-xs text-secondary">{labelOfCode(RETRIEVAL_REASONS, report.retrieval.reason)}</td>
              <td className="numeric">
                {formatNumber(report.retrieval.lexicalCandidates)} / {formatNumber(report.retrieval.semanticCandidates)}
                <div className="text-xs text-muted">{t("quality.retrieval.keywordVector", "keyword / vector")}</div>
              </td>
              <td className="numeric">
                {report.retrieval.queryCacheHit ? (
                  <span className="text-xs text-muted">{t("quality.retrieval.cached", "cached")}</span>
                ) : (
                  formatNumber(report.retrieval.reportedInputTokens ?? 0)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <ListFooter
        shown={reports.items.length}
        counted={plural("quality.queries.count", reports.items.length, { one: "{count} query", other: "{count} queries" })}
        hasMore={reports.hasMore}
        loadingMore={reports.loadingMore}
        moreProblem={reports.moreProblem}
        onLoadMore={reports.loadMore}
      />
    </div>
  );
}

function needsAcknowledgement(call: QueryEmbeddingCall): boolean {
  return call.state === "UNKNOWN" || (call.state === "RESERVED" && new Date(call.expiresAt).getTime() < Date.now());
}

function CallsView({ workspaceId, onChanged }: { workspaceId: string; onChanged: () => void }) {
  const { t, plural } = useTranslation();
  const { notify } = useToaster();
  const permissions = usePermissions();
  const mayAcknowledge = permissions.may(PERMISSIONS.automationManage) && permissions.may(PERMISSIONS.systemWrite);
  const calls = usePagedList((page) => answersApi.queryCalls(workspaceId, page), [workspaceId]);
  if (calls.status === "loading") {
    return <Waiting label={t("quality.retrieval.loadingCalls", "Loading model calls")} lines={4} />;
  }
  if (calls.status === "failed") {
    return <ProblemState layout="section" problem={calls.problem} />;
  }
  if (calls.items.length === 0) {
    return (
      <EmptyState
        title={t("quality.retrieval.noCalls", "No model call yet")}
        description={t(
          "quality.retrieval.noCallsDescription",
          "A query that searches by vectors embeds the question first; each such call is recorded here before it is made.",
        )}
      />
    );
  }
  const acknowledge = async (call: QueryEmbeddingCall) => {
    try {
      await answersApi.acknowledgeQueryCall(workspaceId, call.id);
      notify({
        tone: "good",
        title: t("quality.retrieval.acknowledged", "Call acknowledged"),
        description: t("quality.retrieval.acknowledgedDescription", "Its tokens are no longer held as uncertain."),
      });
      calls.reload();
      onChanged();
    } catch (error) {
      const problem = describeProblem(error);
      notify({ tone: "error", title: problem.title, description: problem.detail ?? problem.description });
    }
  };
  return (
    <div className={TABLE_SURFACE}>
      <Table>
        <thead>
          <tr>
            <th scope="col">{t("quality.column.when", "When")}</th>
            <th scope="col">{t("quality.column.model", "Model")}</th>
            <th scope="col">{t("quality.column.state", "State")}</th>
            <th scope="col" className="numeric">
              {t("quality.retrieval.predicted", "Predicted")}
            </th>
            <th scope="col" className="numeric">
              {t("quality.retrieval.used", "Used")}
            </th>
            <th scope="col">
              <span className="sr-only">{t("common.actions", "Actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {calls.items.map((call) => (
            <tr key={call.id}>
              <td className="text-xs text-secondary">
                {formatDateTime(call.createdAt)}
                <div className="numeric text-muted">
                  {t("quality.retrieval.query", "query {identifier}", { identifier: shortIdentifier(call.queryId) })}
                </div>
              </td>
              <td className="numeric text-xs">{call.modelSpace}</td>
              <td>
                <Badge tone={CALL_TONE[call.state]}>{labelOfCode(MODEL_CALL_STATES, call.state)}</Badge>
                {call.acknowledgedBy !== null && (
                  <div className="text-xs text-muted">{t("quality.retrieval.by", "by {actor}", { actor: call.acknowledgedBy })}</div>
                )}
              </td>
              <td className="numeric">{formatNumber(call.predictedTokens)}</td>
              <td className="numeric">{call.actualTokens === null ? "—" : formatNumber(call.actualTokens)}</td>
              <td className="actions">
                {mayAcknowledge && needsAcknowledgement(call) && (
                  <Button variant="quiet" onClick={() => void acknowledge(call)}>
                    {t("quality.retrieval.acknowledge", "Acknowledge")}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <ListFooter
        shown={calls.items.length}
        counted={plural("quality.calls.count", calls.items.length, { one: "{count} call", other: "{count} calls" })}
        hasMore={calls.hasMore}
        loadingMore={calls.loadingMore}
        moreProblem={calls.moreProblem}
        onLoadMore={calls.loadMore}
      />
    </div>
  );
}

function CacheView({ workspaceId, onChanged }: { workspaceId: string; onChanged: () => void }) {
  const { t, plural } = useTranslation();
  const { notify } = useToaster();
  const mayManage = usePermissions().may(PERMISSIONS.automationManage);
  const cache = usePagedList((page) => answersApi.queryCache(workspaceId, page), [workspaceId]);
  const [clearing, setClearing] = useState<"expired" | "all" | null>(null);

  const clear = async (expiredOnly: boolean) => {
    try {
      const removed = await answersApi.clearQueryCache(workspaceId, expiredOnly);
      notify({
        tone: "good",
        title: plural("quality.cache.removed", removed, {
          one: "{count} cached vector removed",
          other: "{count} cached vectors removed",
        }),
      });
      cache.reload();
      onChanged();
    } catch (error) {
      const problem = describeProblem(error);
      notify({ tone: "error", title: problem.title, description: problem.detail ?? problem.description });
    }
  };

  return (
    <div className={STACK}>
      {mayManage && (
        <div className={TOOLBAR}>
          <span className="text-xs text-muted">
            {t("quality.cache.explains", "A cached query vector spares a model call when the same question is asked again.")}
          </span>
          <div className={TOOLBAR_ACTIONS}>
            <Button variant="quiet" onClick={() => setClearing("expired")}>
              {t("quality.cache.clearExpired", "Clear expired")}
            </Button>
            <Button variant="danger" onClick={() => setClearing("all")}>
              {t("quality.cache.clearAll", "Clear everything")}
            </Button>
          </div>
        </div>
      )}
      {cache.status === "loading" && <Waiting label={t("quality.cache.loading", "Loading the cache")} lines={3} />}
      {cache.status === "failed" && <ProblemState layout="section" problem={cache.problem} />}
      {cache.status === "ready" &&
        (cache.items.length === 0 ? (
          <EmptyState
            title={t("quality.cache.empty", "The cache is empty")}
            description={t("quality.cache.emptyDescription", "Query vectors are cached here as semantic searches run.")}
          />
        ) : (
          <div className={TABLE_SURFACE}>
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t("quality.column.model", "Model")}</th>
                  <th scope="col">{t("quality.cache.input", "Input")}</th>
                  <th scope="col" className="numeric">
                    {t("quality.cache.dimensions", "Dimensions")}
                  </th>
                  <th scope="col">{t("quality.cache.cachedAt", "Cached")}</th>
                  <th scope="col">{t("quality.cache.expires", "Expires")}</th>
                </tr>
              </thead>
              <tbody>
                {cache.items.map((entry) => (
                  <tr key={entry.id}>
                    <td className="numeric text-xs">{entry.modelSpace}</td>
                    <td className="numeric text-xs text-muted">{entry.inputIdentity.slice(0, 16)}…</td>
                    <td className="numeric">{formatNumber(entry.dimensions)}</td>
                    <td className="text-xs text-secondary">{formatDateTime(entry.createdAt)}</td>
                    <td className="text-xs text-secondary">{formatDateTime(entry.expiresAt)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <ListFooter
              shown={cache.items.length}
              counted={plural("quality.cache.count", cache.items.length, { one: "{count} entry", other: "{count} entries" })}
              hasMore={cache.hasMore}
              loadingMore={cache.loadingMore}
              moreProblem={cache.moreProblem}
              onLoadMore={cache.loadMore}
            />
          </div>
        ))}
      <ConfirmDialog
        open={clearing !== null}
        title={
          clearing === "all"
            ? t("quality.cache.clearAllTitle", "Clear the whole cache")
            : t("quality.cache.clearExpiredTitle", "Clear expired entries")
        }
        confirmLabel={t("quality.cache.clear", "Clear")}
        destructive={clearing === "all"}
        onConfirm={() => {
          const expiredOnly = clearing !== "all";
          setClearing(null);
          void clear(expiredOnly);
        }}
        onCancel={() => setClearing(null)}
      >
        <p>
          {clearing === "all"
            ? t(
                "quality.cache.clearAllDescription",
                "Every cached query vector is deleted; the next semantic searches embed their questions again, which costs tokens.",
              )
            : t(
                "quality.cache.clearExpiredDescription",
                "Only entries past their lifetime are deleted; they are no longer used anyway.",
              )}
        </p>
      </ConfirmDialog>
    </div>
  );
}
