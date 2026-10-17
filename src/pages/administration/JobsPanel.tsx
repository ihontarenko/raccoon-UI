import { useState } from "react";
import { Can } from "../../access/Can";
import { PERMISSIONS } from "../../access/permissions";
import {
  formatBytes,
  formatDateTime,
  labelOfCode,
  shortIdentifier,
} from "../../application/format";
import { describeProblem } from "../../application/problems";
import { usePagedList } from "../../application/usePagedList";
import { usePolling } from "../../application/usePolling";
import { useResource } from "../../application/useResource";
import { api } from "../../lib/api";
import type { JobStatus, JobView } from "../../lib/contracts";
import { useTranslation } from "../../translations/TranslationProvider";
import {
  ConfirmDialog,
  EmptyState,
  Facts,
  Inspector,
  InspectorSection,
  ListFooter,
  ProblemState,
  RowName,
  SectionBar,
  Waiting,
  Workbench,
  useToaster,
} from "../../ui/components";
import { Badge, Button, Table, type BadgeTone } from "../../ui/primitives";
import { JOB_ATTEMPT_OUTCOMES, JOB_KINDS, JOB_STATUSES } from "../jobs/jobLabels";
import { ATTEMPTS, CONFIGURATION, PANEL_ACTIONS } from "./administrationClasses";

const STATUS_TONE: Record<JobStatus, BadgeTone> = {
  QUEUED: "neutral",
  RUNNING: "active",
  SUCCEEDED: "good",
  FAILED: "error",
  CANCELLED: "warn",
};

function mayCancel(job: JobView): boolean {
  return job.status === "QUEUED" || job.status === "RUNNING";
}

/** The server re-queues only a failed job; a cancelled one stays cancelled. */
function mayRetry(job: JobView): boolean {
  return job.status === "FAILED";
}

export function JobsPanel() {
  const { notify } = useToaster();
  const { t, plural } = useTranslation();
  const jobs = usePagedList((page) => api.listJobs(page), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<JobView | null>(null);
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const running = jobs.status === "ready" && jobs.items.some((job) => mayCancel(job));
  usePolling(running, jobs.reload, jobs.status === "ready" ? jobs.items : null, 3000);

  if (jobs.status === "loading") {
    return <Waiting label={t("jobs.administration.loading", "Loading jobs")} lines={5} />;
  }
  if (jobs.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={jobs.problem}
        actions={
          <Button icon="refresh" onClick={jobs.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }
  if (jobs.items.length === 0) {
    return (
      <EmptyState
        title={t("jobs.administration.empty", "No jobs yet")}
        description={t(
          "jobs.administration.emptyDescription",
          "Jobs appear when documents are parsed, indexes are built or storage is verified.",
        )}
      />
    );
  }

  const selected = jobs.items.find((job) => job.id === selectedId) ?? jobs.items[0];

  const act = async (job: JobView, action: "cancel" | "retry") => {
    setBusy(true);
    try {
      const updated =
        action === "cancel" ? await api.cancelJob(job.id) : await api.retryJob(job.id);
      jobs.replaceItem((candidate) => candidate.id === job.id, updated);
      notify({
        tone: "good",
        title:
          action === "cancel"
            ? t("jobs.administration.cancellationRequested", "Cancellation requested")
            : t("jobs.administration.queuedAgain", "Job queued again"),
        description: `${labelOfCode(JOB_KINDS, job.kind)} · ${shortIdentifier(job.id)}`,
      });
    } catch (error) {
      const problem = describeProblem(error);
      notify({
        tone: "error",
        title: problem.title,
        description: problem.detail ?? problem.description,
      });
    } finally {
      setBusy(false);
      setCancelling(null);
    }
  };

  const verifyStorage = async () => {
    setVerifying(true);
    try {
      const job = await api.startStorageVerification(`verify-storage-${Date.now()}`);
      notify({
        tone: "good",
        title: t("jobs.administration.verificationQueued", "Storage verification queued"),
        description: t("jobs.administration.verificationQueuedDescription", "Every stored original is re-read and checked against its hash."),
      });
      jobs.reload();
      setSelectedId(job.id);
    } catch (error) {
      const problem = describeProblem(error);
      notify({ tone: "error", title: problem.title, description: problem.detail ?? problem.description });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <>
      <Workbench>
        <section aria-label={t("jobs.title", "Jobs")}>
          <SectionBar>
            <span className="text-xs text-secondary">
              {running
                ? t("jobs.administration.newestFirstFollowing", "Newest first · following running jobs")
                : t("jobs.administration.newestFirst", "Newest first")}
            </span>
            <div className={PANEL_ACTIONS}>
              <Can permission={PERMISSIONS.jobWrite}>
                <Button variant="quiet" icon="shield" disabled={verifying} onClick={() => void verifyStorage()}>
                  {verifying ? t("jobs.administration.starting", "Starting…") : t("jobs.administration.verifyStorage", "Verify storage")}
                </Button>
              </Can>
              <Button variant="quiet" icon="refresh" onClick={jobs.reload}>
                {t("jobs.administration.refresh", "Refresh")}
              </Button>
            </div>
          </SectionBar>
          <Table>
            <thead>
              <tr>
                <th scope="col">{t("jobs.administration.column.job", "Job")}</th>
                <th scope="col">{t("jobs.administration.column.status", "Status")}</th>
                <th scope="col" className="numeric">
                  {t("jobs.administration.column.attempts", "Attempts")}
                </th>
                <th scope="col">{t("jobs.administration.column.updated", "Updated")}</th>
              </tr>
            </thead>
            <tbody>
              {jobs.items.map((job) => (
                <tr key={job.id} data-selected={job.id === selected.id}>
                  <td>
                    <RowName
                      selected={job.id === selected.id}
                      onSelect={() => {
                        setSelectedId(job.id);
                      }}
                    >
                      {labelOfCode(JOB_KINDS, job.kind)}
                    </RowName>
                    <div className="numeric text-muted">{shortIdentifier(job.id)}</div>
                  </td>
                  <td>
                    <Badge tone={STATUS_TONE[job.status]}>{labelOfCode(JOB_STATUSES, job.status)}</Badge>
                  </td>
                  <td className="numeric">
                    {job.attemptCount} / {job.attemptLimit}
                  </td>
                  <td className="text-xs text-secondary">{formatDateTime(job.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <ListFooter
            shown={jobs.items.length}
            counted={plural("jobs.count", jobs.items.length, { one: "{count} job", other: "{count} jobs" })}
            hasMore={jobs.hasMore}
            loadingMore={jobs.loadingMore}
            moreProblem={jobs.moreProblem}
            onLoadMore={jobs.loadMore}
          />
        </section>
        <Inspector
          label={t("jobs.administration.selected", "Selected job")}
          eyebrow={<span className="numeric">{shortIdentifier(selected.id)}</span>}
          title={labelOfCode(JOB_KINDS, selected.kind)}
        >
          <InspectorSection title={t("jobs.administration.state", "State")}>
            <Facts
              rows={[
                [
                  t("jobs.administration.column.status", "Status"),
                  <Badge tone={STATUS_TONE[selected.status]}>
                    {labelOfCode(JOB_STATUSES, selected.status)}
                  </Badge>,
                ],
                [
                  t("jobs.administration.column.attempts", "Attempts"),
                  <span className="numeric">
                    {t("jobs.administration.attemptsOf", "{count} of {limit}", {
                      count: selected.attemptCount,
                      limit: selected.attemptLimit,
                    })}
                  </span>,
                ],
                [
                  t("jobs.administration.failure", "Failure"),
                  selected.failureCode === null ? (
                    "—"
                  ) : (
                    <span className="numeric">{selected.failureCode}</span>
                  ),
                ],
                [
                  t("jobs.administration.result", "Result"),
                  <span className="numeric">{formatBytes(selected.resultSizeBytes)}</span>,
                ],
              ]}
            />
          </InspectorSection>
          <InspectorSection title={t("jobs.administration.timeline", "Timeline")}>
            <Facts
              rows={[
                [t("jobs.administration.created", "Created"), formatDateTime(selected.createdAt)],
                [t("jobs.administration.available", "Available"), formatDateTime(selected.availableAt)],
                [t("jobs.administration.column.updated", "Updated"), formatDateTime(selected.updatedAt)],
              ]}
            />
          </InspectorSection>
          <JobHistory key={selected.id} jobId={selected.id} />
          <InspectorSection title={t("jobs.administration.configuration", "Configuration")}>
            <pre className={CONFIGURATION}>
              {JSON.stringify(selected.configuration, null, 2)}
            </pre>
          </InspectorSection>
          {(mayCancel(selected) || mayRetry(selected)) && (
            <Can permission={PERMISSIONS.jobWrite}>
              <InspectorSection>
                {mayCancel(selected) && (
                  <Button
                    variant="danger"
                    disabled={busy}
                    onClick={() => {
                      setCancelling(selected);
                    }}
                  >
                    {t("jobs.administration.requestCancellation", "Request cancellation")}
                  </Button>
                )}
                {mayRetry(selected) && (
                  <Button
                    icon="refresh"
                    disabled={busy}
                    onClick={() => void act(selected, "retry")}
                  >
                    {t("jobs.retry", "Retry")}
                  </Button>
                )}
              </InspectorSection>
            </Can>
          )}
        </Inspector>
      </Workbench>
      <ConfirmDialog
        open={cancelling !== null}
        title={t("jobs.administration.requestCancellation", "Request cancellation")}
        confirmLabel={t("jobs.administration.requestCancellation", "Request cancellation")}
        destructive
        busy={busy}
        onConfirm={() => {
          if (cancelling !== null) {
            void act(cancelling, "cancel");
          }
        }}
        onCancel={() => {
          setCancelling(null);
        }}
      >
        <p>
          {t(
            "jobs.administration.cancellationExplained",
            "The worker stops this job at its next safe point. Work already published stays published.",
          )}
        </p>
      </ConfirmDialog>
    </>
  );
}

/** Every attempt the worker made at one job, and the stored originals it touched. */
function JobHistory({ jobId }: { jobId: string }) {
  const { t } = useTranslation();
  const history = useResource(() => Promise.all([api.jobAttempts(jobId), api.jobFiles(jobId)]), [jobId]);
  if (history.status === "loading") {
    return (
      <InspectorSection title={t("jobs.administration.column.attempts", "Attempts")}>
        <Waiting label={t("jobs.administration.loadingAttempts", "Loading attempts")} lines={2} />
      </InspectorSection>
    );
  }
  if (history.status === "failed") {
    return null;
  }
  const [attempts, files] = history.data;
  return (
    <>
      <InspectorSection title={t("jobs.administration.attemptsCounted", "Attempts · {count}", { count: attempts.length })}>
        {attempts.length === 0 ? (
          <p className="text-xs text-muted">{t("jobs.administration.notPickedUp", "Not picked up by a worker yet.")}</p>
        ) : (
          <ol className={ATTEMPTS}>
            {attempts.map((attempt) => (
              <li key={attempt.attemptNumber}>
                <span className="numeric">#{attempt.attemptNumber}</span>
                <span className="text-xs text-secondary">
                  {formatDateTime(attempt.startedAt)} →{" "}
                  {attempt.finishedAt === null ? t("jobs.administration.attemptRunning", "running") : formatDateTime(attempt.finishedAt)}
                </span>
                <span className="text-xs">
                  {attempt.outcome === null ? "—" : labelOfCode(JOB_ATTEMPT_OUTCOMES, attempt.outcome)}
                  {attempt.failureCode !== null && <span className="numeric"> · {attempt.failureCode}</span>}
                </span>
                <span className="numeric text-xs text-muted">{attempt.workerId}</span>
              </li>
            ))}
          </ol>
        )}
      </InspectorSection>
      {files.length > 0 && (
        <InspectorSection title={t("jobs.administration.filesCounted", "Files · {count}", { count: files.length })}>
          <ul className={ATTEMPTS}>
            {files.map((file) => (
              <li key={file.id}>
                <span>{file.displayName}</span>
                <span className="text-xs text-secondary numeric">{formatBytes(file.sizeBytes)}</span>
                <span className="numeric text-xs text-muted" title={file.sha256}>
                  {file.backend} · {file.sha256.slice(0, 12)}
                </span>
              </li>
            ))}
          </ul>
        </InspectorSection>
      )}
    </>
  );
}
