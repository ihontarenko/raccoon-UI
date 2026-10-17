import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { usePermissions } from "../../access/PermissionsProvider";
import { PERMISSIONS } from "../../access/permissions";
import { MODEL_CALL_STATES } from "../../application/codeLabels";
import { formatDateTime, formatNumber, labelOfCode, shortIdentifier, type CodeLabels } from "../../application/format";
import { describeProblem } from "../../application/problems";
import { usePagedList } from "../../application/usePagedList";
import { usePolling } from "../../application/usePolling";
import { useResource } from "../../application/useResource";
import { pipelineApi, type VectorGeneration, type VectorGenerationState, type VectorRecord } from "../../lib/pipeline";
import { declareText, type DeclaredText } from "../../translations/translate";
import { useTranslation } from "../../translations/TranslationProvider";
import { ConfirmDialog, EmptyState, Facts, ListFooter, ProblemState, RowName, Segmented, Waiting, useToaster } from "../../ui/components";
import { Badge, Button, Table, type BadgeTone } from "../../ui/primitives";
import { JOB_STATUSES } from "../jobs/jobLabels";
import { AUDIT_LIST, DETAIL, DETAIL_HEAD, PAGE, ROW_LINK, SECTION_TITLE, SPLIT, TABLE_SURFACE, TOOLBAR_ACTIONS, VECTOR_VALUES, WARNING } from "./indexingClasses";

/** Blue is what search reads; red was taken out of search. */
export const VECTOR_TONE: Record<VectorGenerationState, BadgeTone> = { BUILDING: "active", PUBLISHED: "allow", WITHDRAWN: "deny", PURGED: "neutral" };

/** A vector generation's state in words. */
const VECTOR_GENERATION_STATES: CodeLabels = {
  BUILDING: declareText("index.vectors.state.building", "Building"),
  PUBLISHED: declareText("index.vectors.state.published", "Published"),
  WITHDRAWN: declareText("index.lexical.withdrawn", "Withdrawn"),
  PURGED: declareText("index.lexical.purged", "Purged"),
} satisfies Record<VectorGenerationState, DeclaredText>;

/** What happened to a vector generation or one of its records: the vector index audit's actions. */
const VECTOR_AUDIT_ACTIONS: CodeLabels = {
  SUBMITTED: declareText("codes.vectorAuditAction.submitted", "Submitted"),
  PUBLISHED: declareText("codes.vectorAuditAction.published", "Published"),
  WITHDRAWN: declareText("codes.vectorAuditAction.withdrawn", "Withdrawn"),
  SUPERSEDED: declareText("codes.vectorAuditAction.superseded", "Superseded"),
  RECORD_SAVED: declareText("codes.vectorAuditAction.recordSaved", "Record saved"),
  RECORD_REMOVED: declareText("codes.vectorAuditAction.recordRemoved", "Record removed"),
  PURGED: declareText("codes.vectorAuditAction.purged", "Purged"),
  SOURCE_INVALIDATED: declareText("codes.vectorAuditAction.sourceInvalidated", "Source invalidated"),
};

interface VectorGenerationsTabProperties {
  workspaceId: string;
  titles: Map<string, string>;
  selectedId: string | null;
  onSelect: (jobId: string | null) => void;
  onChanged: () => void;
}

/** Every vector generation, and for the chosen one its records, calls and audit, with every action it allows. */
export function VectorGenerationsTab({ workspaceId, titles, selectedId, onSelect, onChanged }: VectorGenerationsTabProperties) {
  const { t, plural } = useTranslation();
  const generations = usePagedList((page) => pipelineApi.vectorGenerations(workspaceId, page), [workspaceId]);
  const building = generations.status === "ready" && generations.items.some((generation) => generation.state === "BUILDING");
  usePolling(building, generations.reload, generations.status === "ready" ? generations.items : null, 3000);

  if (generations.status === "loading") {
    return <Waiting label={t("index.vectors.loading", "Loading vector generations")} lines={5} />;
  }
  if (generations.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={generations.problem}
        actions={
          <Button icon="refresh" onClick={generations.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }
  if (generations.items.length === 0) {
    return (
      <EmptyState
        title={t("index.vectors.empty", "Nothing vectorised yet")}
        description={t(
          "index.vectors.emptyDescription",
          "Vectorise a published document from its page, or a whole source from its Indexing tab. A preflight shows the cost first.",
        )}
      />
    );
  }

  const selected = generations.items.find((generation) => generation.jobId === selectedId) ?? generations.items[0];

  return (
    <div className={PAGE}>
      <div className={TABLE_SURFACE}>
        <Table>
          <thead>
            <tr>
              <th scope="col">{t("index.vectors.generation", "Generation")}</th>
              <th scope="col">{t("index.column.model", "Model")}</th>
              <th scope="col">{t("index.keywords.state", "State")}</th>
              <th scope="col" className="numeric">
                {t("index.documents.vectors", "Vectors")}
              </th>
              <th scope="col" className="numeric">
                {t("index.vectors.calls", "Calls")}
              </th>
              <th scope="col" className="numeric">
                {t("index.vectors.tokens", "Tokens")}
              </th>
            </tr>
          </thead>
          <tbody>
            {generations.items.map((generation) => (
              <tr key={generation.jobId} data-selected={generation.jobId === selected.jobId}>
                <td>
                  <RowName
                    selected={generation.jobId === selected.jobId}
                    onSelect={() => {
                      onSelect(generation.jobId);
                    }}
                  >
                    {formatDateTime(generation.createdAt)}
                  </RowName>
                  <div className="numeric text-xs text-muted">{shortIdentifier(generation.jobId)}</div>
                </td>
                <td>
                  {generation.model.provider} <span className="numeric text-xs">{generation.model.model}</span>
                  <div className="text-xs text-muted">
                    {t("index.vectors.dimensions", "{count} dimensions", { count: formatNumber(generation.model.dimensions) })}
                  </div>
                </td>
                <td>
                  <Badge tone={VECTOR_TONE[generation.state]}>{labelOfCode(VECTOR_GENERATION_STATES, generation.state)}</Badge>
                  {generation.job.status !== "SUCCEEDED" && (
                    <div className="text-xs text-muted">
                      {t("index.vectors.jobStatus", "job {status}", { status: labelOfCode(JOB_STATUSES, generation.job.status).toLowerCase() })}
                    </div>
                  )}
                </td>
                <td className="numeric">
                  {formatNumber(generation.storedRecords)} / {formatNumber(generation.expectedRecords)}
                  {generation.reusedRecords > 0 && (
                    <div className="text-xs text-muted">
                      {t("index.vectors.reused", "{count} reused", { count: formatNumber(generation.reusedRecords) })}
                    </div>
                  )}
                </td>
                <td className="numeric">
                  {formatNumber(generation.calls)}
                  {generation.unresolvedCalls > 0 && (
                    <div className={`text-xs ${WARNING}`}>
                      {t("index.vectors.unresolved", "{count} unresolved", { count: formatNumber(generation.unresolvedCalls) })}
                    </div>
                  )}
                </td>
                <td className="numeric">{generation.actualTokens === null ? `≈ ${formatNumber(generation.reservedTokens)}` : formatNumber(generation.actualTokens)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <ListFooter
          shown={generations.items.length}
          counted={plural("index.generations.count", generations.items.length, {
            one: "{count} generation",
            other: "{count} generations",
          })}
          hasMore={generations.hasMore}
          loadingMore={generations.loadingMore}
          moreProblem={generations.moreProblem}
          onLoadMore={generations.loadMore}
        />
      </div>
      <VectorGenerationDetail
        key={selected.jobId}
        workspaceId={workspaceId}
        generation={selected}
        titles={titles}
        onChanged={(saved) => {
          if (saved !== null) {
            generations.replaceItem((candidate) => candidate.jobId === saved.jobId, saved);
          } else {
            generations.reload();
          }
          onChanged();
        }}
      />
    </div>
  );
}

type DetailView = "records" | "calls" | "audit";
type Pending = "withdraw" | "purge" | "cancel" | null;

function VectorGenerationDetail({
  workspaceId,
  generation,
  titles,
  onChanged,
}: {
  workspaceId: string;
  generation: VectorGeneration;
  titles: Map<string, string>;
  onChanged: (saved: VectorGeneration | null) => void;
}) {
  const { t } = useTranslation();
  const { notify } = useToaster();
  const permissions = usePermissions();
  const mayManage = permissions.may(PERMISSIONS.automationManage);
  const [view, setView] = useState<DetailView>("records");
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const running = generation.job.status === "QUEUED" || generation.job.status === "RUNNING";

  const act = async (action: () => Promise<VectorGeneration>, done: string) => {
    setBusy(true);
    try {
      onChanged(await action());
      notify({ tone: "good", title: done });
    } catch (error) {
      const problem = describeProblem(error);
      notify({ tone: "error", title: problem.title, description: problem.detail ?? problem.description });
      onChanged(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={DETAIL} aria-label={t("index.vectors.selected", "Selected vector generation")}>
      <div className={DETAIL_HEAD}>
        <div>
          <h2 className={SECTION_TITLE}>
            {generation.model.provider} · <span className="numeric">{generation.model.model}</span>
          </h2>
          <span className="text-xs text-muted">
            {t("index.vectors.generationRevision", "Generation {identifier} · revision {revision}", {
              identifier: <span className="numeric">{shortIdentifier(generation.jobId)}</span>,
              revision: generation.revision,
            })}
          </span>
        </div>
        {mayManage && (
          <div className={TOOLBAR_ACTIONS}>
            {running && (
              <Button variant="quiet" disabled={busy} onClick={() => setPending("cancel")}>
                {t("index.vectors.cancelJob", "Cancel job")}
              </Button>
            )}
            {generation.state === "BUILDING" && generation.job.status === "FAILED" && generation.unresolvedCalls === 0 && (
              <Button
                variant="quiet"
                icon="refresh"
                disabled={busy}
                onClick={() =>
                  void act(() => pipelineApi.retryVectors(workspaceId, generation.jobId), t("index.vectors.queuedAgain", "Queued again"))
                }
              >
                {t("index.vectors.retry", "Retry")}
              </Button>
            )}
            {generation.state === "PUBLISHED" && !running && (
              <Button variant="quiet" disabled={busy} onClick={() => setPending("withdraw")}>
                {t("index.withdraw", "Withdraw")}
              </Button>
            )}
            {generation.state === "WITHDRAWN" && (
              <Button
                variant="primary"
                disabled={busy}
                onClick={() =>
                  void act(() => pipelineApi.publishVectors(workspaceId, generation), t("index.vectors.publishedNotice", "Vectors published"))
                }
              >
                {t("index.publish", "Publish")}
              </Button>
            )}
            {generation.state !== "PUBLISHED" && generation.state !== "PURGED" && !running && (
              <Button variant="danger" disabled={busy} onClick={() => setPending("purge")}>
                {t("index.purge", "Purge")}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className={SPLIT}>
        <Facts
          rows={[
            [
              t("index.keywords.state", "State"),
              <Badge tone={VECTOR_TONE[generation.state]}>{labelOfCode(VECTOR_GENERATION_STATES, generation.state)}</Badge>,
            ],
            [
              t("index.vectors.job", "Job"),
              t("index.vectors.jobAttempt", "{status} · attempt {attempt} of {limit}", {
                status: labelOfCode(JOB_STATUSES, generation.job.status),
                attempt: generation.job.attemptCount,
                limit: generation.job.attemptLimit,
              }),
            ],
            [
              t("index.documents.vectors", "Vectors"),
              t("index.vectors.storedOf", "{stored} stored of {expected} · {removed} removed", {
                stored: formatNumber(generation.storedRecords),
                expected: formatNumber(generation.expectedRecords),
                removed: formatNumber(generation.removedRecords),
              }),
            ],
            [
              t("index.vectors.tokens", "Tokens"),
              generation.actualTokens === null
                ? t("index.vectors.tokensReserved", "{count} reserved", { count: formatNumber(generation.reservedTokens) })
                : t("index.vectors.tokensUsed", "{count} used", { count: formatNumber(generation.actualTokens) }),
            ],
            [t("index.vectors.started", "Started"), formatDateTime(generation.createdAt)],
          ]}
        />
        <Facts
          rows={[
            [t("index.vectors.dimensionsLabel", "Dimensions"), formatNumber(generation.model.dimensions)],
            [t("index.vectors.protocol", "Protocol"), generation.model.protocol],
            [t("index.vectors.tokenizer", "Tokenizer"), `${generation.model.tokenizer} ${generation.model.tokenizerRevision}`],
            [
              t("index.vectors.limits", "Limits"),
              t("index.vectors.limitsValue", "{calls} calls, {concurrent} at once, {attempts} attempts", {
                calls: generation.policy.maximumCalls,
                concurrent: generation.policy.maximumConcurrentCalls,
                attempts: generation.policy.maximumAttempts,
              }),
            ],
            [t("index.vectors.preflight", "Preflight"), <span className="numeric">{shortIdentifier(generation.preflightId)}</span>],
          ]}
        />
      </div>

      <Segmented<DetailView>
        label={t("index.vectors.show", "Show")}
        value={view}
        onChange={setView}
        options={[
          { value: "records", label: t("index.documents.vectors", "Vectors") },
          { value: "calls", label: t("index.totals.calls", "Model calls"), count: generation.calls },
          { value: "audit", label: t("index.vectors.audit", "Audit") },
        ]}
      />
      {view === "records" && <RecordsView workspaceId={workspaceId} generation={generation} titles={titles} mayManage={mayManage} onChanged={onChanged} />}
      {view === "calls" && <CallsView workspaceId={workspaceId} jobId={generation.jobId} />}
      {view === "audit" && <AuditView workspaceId={workspaceId} jobId={generation.jobId} />}

      <ConfirmDialog
        open={pending !== null}
        title={
          pending === "purge"
            ? t("index.vectors.purgeTitle", "Purge the vectors")
            : pending === "cancel"
              ? t("index.vectors.cancelTitle", "Cancel the job")
              : t("index.vectors.withdrawTitle", "Withdraw the vectors")
        }
        confirmLabel={
          pending === "purge"
            ? t("index.purge", "Purge")
            : pending === "cancel"
              ? t("index.vectors.cancelJob", "Cancel job")
              : t("index.withdraw", "Withdraw")
        }
        destructive={pending !== "withdraw"}
        onConfirm={() => {
          const action = pending;
          setPending(null);
          if (action === "purge") {
            void act(() => pipelineApi.purgeVectors(workspaceId, generation), t("index.vectors.purgedNotice", "Vectors purged"));
          } else if (action === "cancel") {
            void act(() => pipelineApi.cancelVectors(workspaceId, generation.jobId), t("index.vectors.cancelledNotice", "Job cancelled"));
          } else if (action === "withdraw") {
            void act(
              () => pipelineApi.withdrawVectors(workspaceId, generation),
              t("index.vectors.withdrawnNotice", "Vectors withdrawn from search"),
            );
          }
        }}
        onCancel={() => {
          setPending(null);
        }}
      >
        <p>
          {pending === "purge"
            ? t(
                "index.vectors.purgeDescription",
                "Every record is deleted, and embeddings nothing else uses are dropped. Embedding again costs tokens.",
              )
            : pending === "cancel"
              ? t("index.vectors.cancelDescription", "The job stops; calls already made stay counted.")
              : t(
                  "index.vectors.withdrawDescription",
                  "Semantic search stops using these vectors. They are kept and can be published again.",
                )}
        </p>
      </ConfirmDialog>
    </section>
  );
}

function RecordsView({
  workspaceId,
  generation,
  titles,
  mayManage,
  onChanged,
}: {
  workspaceId: string;
  generation: VectorGeneration;
  titles: Map<string, string>;
  mayManage: boolean;
  onChanged: (saved: VectorGeneration | null) => void;
}) {
  const { t, plural } = useTranslation();
  const { notify } = useToaster();
  const records = usePagedList((page) => pipelineApi.vectorRecords(workspaceId, generation.jobId, page), [workspaceId, generation.jobId, generation.revision]);
  const [openedId, setOpenedId] = useState<string | null>(null);

  if (records.status === "loading") {
    return <Waiting label={t("index.vectors.loadingRecords", "Loading vectors")} lines={3} />;
  }
  if (records.status === "failed") {
    return <ProblemState layout="section" problem={records.problem} />;
  }
  if (records.items.length === 0) {
    return <p className="text-xs text-muted">{t("index.vectors.noRecords", "No vectors stored yet.")}</p>;
  }

  const remove = async (record: VectorRecord) => {
    try {
      onChanged(await pipelineApi.removeVectorRecord(workspaceId, generation.jobId, record));
      notify({
        tone: "good",
        title: t("index.vectors.recordRemoved", "Vector removed"),
        description: t("index.vectors.recordRemovedDescription", "The generation is withdrawn until it is published again."),
      });
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
            <th scope="col">{t("index.column.document", "Document")}</th>
            <th scope="col" className="numeric">
              {t("index.vectors.chunk", "Chunk")}
            </th>
            <th scope="col">{t("index.entries.origin", "Origin")}</th>
            <th scope="col">
              <span className="sr-only">{t("common.actions", "Actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {records.items.map((record) => (
            <RecordRow
              key={record.id}
              workspaceId={workspaceId}
              jobId={generation.jobId}
              record={record}
              title={titles.get(record.documentId) ?? shortIdentifier(record.documentId)}
              opened={openedId === record.id}
              onToggle={() => {
                setOpenedId(openedId === record.id ? null : record.id);
              }}
              onRemove={mayManage && !record.removed ? () => void remove(record) : null}
            />
          ))}
        </tbody>
      </Table>
      <ListFooter
        shown={records.items.length}
        counted={plural("index.vectors.count", records.items.length, { one: "{count} vector", other: "{count} vectors" })}
        hasMore={records.hasMore}
        loadingMore={records.loadingMore}
        moreProblem={records.moreProblem}
        onLoadMore={records.loadMore}
      />
    </div>
  );
}

function RecordRow({
  workspaceId,
  jobId,
  record,
  title,
  opened,
  onToggle,
  onRemove,
}: {
  workspaceId: string;
  jobId: string;
  record: VectorRecord;
  title: string;
  opened: boolean;
  onToggle: () => void;
  onRemove: (() => void) | null;
}) {
  const { t } = useTranslation();
  return (
    <>
      <tr>
        <td>
          <Link to="/documents/$documentId" params={{ documentId: record.documentId }} className={ROW_LINK}>
            {title}
          </Link>
        </td>
        <td className="numeric">{record.chunkNumber}</td>
        <td>
          <Badge tone={record.origin === "MANUAL" ? "active" : "neutral"}>{record.origin.toLowerCase()}</Badge>{" "}
          {record.reused && <Badge tone="good">{t("index.vectors.reusedBadge", "Reused")}</Badge>}{" "}
          {record.removed && <Badge tone="error">{t("index.vectors.removedBadge", "Removed")}</Badge>}
        </td>
        <td className="actions">
          <Button variant="quiet" icon="eye" aria-expanded={opened} onClick={onToggle}>
            {opened ? t("index.vectors.hide", "Hide") : t("index.vectors.values", "Values")}
          </Button>
          {onRemove !== null && (
            <Button
              variant="quiet"
              iconOnly
              icon="trash"
              aria-label={t("index.vectors.removeThis", "Remove this vector")}
              title={t("index.entries.remove", "Remove")}
              onClick={onRemove}
            />
          )}
        </td>
      </tr>
      {opened && (
        <tr>
          <td colSpan={4}>
            <VectorValues workspaceId={workspaceId} jobId={jobId} recordId={record.id} />
          </td>
        </tr>
      )}
    </>
  );
}

function VectorValues({ workspaceId, jobId, recordId }: { workspaceId: string; jobId: string; recordId: string }) {
  const { t } = useTranslation();
  const vector = useResource(() => pipelineApi.vectorValues(workspaceId, jobId, recordId), [workspaceId, jobId, recordId]);
  if (vector.status === "loading") {
    return <Waiting label={t("index.vectors.loadingValues", "Loading values")} lines={2} />;
  }
  if (vector.status === "failed") {
    return <ProblemState layout="section" problem={vector.problem} />;
  }
  const values = vector.data.values;
  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  return (
    <div className={DETAIL}>
      <span className="text-xs text-secondary numeric">
        {t("index.vectors.valuesSummary", "{count} values · length {length} · entry revision {revision}", {
          count: formatNumber(values.length),
          length: norm.toFixed(4),
          revision: vector.data.record.entryRevision,
        })}
      </span>
      <pre className={VECTOR_VALUES}>[{values.map((value) => value.toFixed(5)).join(", ")}]</pre>
    </div>
  );
}

function CallsView({ workspaceId, jobId }: { workspaceId: string; jobId: string }) {
  const { t, plural } = useTranslation();
  const calls = usePagedList((page) => pipelineApi.vectorCalls(workspaceId, jobId, page), [workspaceId, jobId]);
  if (calls.status === "loading") {
    return <Waiting label={t("index.vectors.loadingCalls", "Loading calls")} lines={3} />;
  }
  if (calls.status === "failed") {
    return <ProblemState layout="section" problem={calls.problem} />;
  }
  if (calls.items.length === 0) {
    return (
      <p className="text-xs text-muted">
        {t("index.vectors.noCalls", "No model call was needed — every vector was reused from earlier embeddings.")}
      </p>
    );
  }
  return (
    <div className={TABLE_SURFACE}>
      <Table>
        <thead>
          <tr>
            <th scope="col" className="numeric">
              {t("index.journal.batch", "Batch")}
            </th>
            <th scope="col">{t("index.keywords.state", "State")}</th>
            <th scope="col" className="numeric">
              {t("index.vectors.inputs", "Inputs")}
            </th>
            <th scope="col" className="numeric">
              {t("index.vectors.predicted", "Predicted")}
            </th>
            <th scope="col" className="numeric">
              {t("index.vectors.used", "Used")}
            </th>
            <th scope="col">{t("index.vectors.sent", "Sent")}</th>
            <th scope="col">{t("index.vectors.answered", "Answered")}</th>
          </tr>
        </thead>
        <tbody>
          {calls.items.map((call) => (
            <tr key={call.id}>
              <td className="numeric">{call.batchNumber}</td>
              <td>
                <Badge tone={call.state === "COMPLETED" ? "good" : call.state === "UNKNOWN" ? "error" : "active"}>{labelOfCode(MODEL_CALL_STATES, call.state)}</Badge>
              </td>
              <td className="numeric">{formatNumber(call.inputCount)}</td>
              <td className="numeric">{formatNumber(call.predictedTokens)}</td>
              <td className="numeric">{call.actualTokens === null ? "—" : formatNumber(call.actualTokens)}</td>
              <td className="text-xs text-secondary">{formatDateTime(call.createdAt)}</td>
              <td className="text-xs text-secondary">{formatDateTime(call.completedAt)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <ListFooter
        shown={calls.items.length}
        counted={plural("index.calls.count", calls.items.length, { one: "{count} call", other: "{count} calls" })}
        hasMore={calls.hasMore}
        loadingMore={calls.loadingMore}
        moreProblem={calls.moreProblem}
        onLoadMore={calls.loadMore}
      />
    </div>
  );
}

function AuditView({ workspaceId, jobId }: { workspaceId: string; jobId: string }) {
  const { t } = useTranslation();
  const audit = usePagedList((page) => pipelineApi.vectorAudit(workspaceId, jobId, page), [workspaceId, jobId]);
  if (audit.status === "loading") {
    return <Waiting label={t("index.vectors.loadingAudit", "Loading the audit")} lines={3} />;
  }
  if (audit.status === "failed") {
    return <ProblemState layout="section" problem={audit.problem} />;
  }
  return (
    <ol className={AUDIT_LIST}>
      {audit.items.map((event) => (
        <li key={`${event.resourceId}-${event.revision}-${event.action}`}>
          <span className="text-xs text-muted">{formatDateTime(event.createdAt)}</span> <strong>{labelOfCode(VECTOR_AUDIT_ACTIONS, event.action)}</strong>{" "}
          <span className="text-xs text-secondary">
            {t("index.vectors.byActor", "by {actor} · revision {revision}", {
              actor: <span className="numeric">{event.actorId}</span>,
              revision: event.revision,
            })}
          </span>
        </li>
      ))}
    </ol>
  );
}
