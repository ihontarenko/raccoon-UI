import { useEffect, useState } from "react";
import { useParams, useSearch } from "@tanstack/react-router";
import { Can } from "../../access/Can";
import { PERMISSIONS } from "../../access/permissions";
import { formatDateTime, labelOfCode, shortIdentifier } from "../../application/format";
import { describeProblem } from "../../application/problems";
import { useReadySession } from "../../application/session";
import { usePageTitle } from "../../application/usePageTitle";
import { usePolling } from "../../application/usePolling";
import { useResource } from "../../application/useResource";
import { workspaceJobsApi } from "../../lib/workspaceJobs";
import { useTranslation } from "../../translations/TranslationProvider";
import { EmptyState, PageHeader, ProblemState, Waiting, useToaster } from "../../ui/components";
import { Badge, Button } from "../../ui/primitives";
import { JobSubjectLink } from "./JobSubjectLink";
import { JobTrack } from "./JobTrack";
import { JOB_ATTEMPT_OUTCOMES, JOB_FAILURES, JOB_WORK } from "./jobLabels";
import { JobState } from "./jobPresentation";
import { useWorkspaceActivity } from "../../application/WorkspaceActivityProvider";

const PANEL = "min-w-0 rounded-surface border border-line bg-surface p-5";

export function WorkspaceJobPage() {
  const { jobId } = useParams({ from: "/shell/jobs/$jobId" });
  const search = useSearch({ from: "/shell/jobs/$jobId" });
  const { workspace, workspaces, selectWorkspace } = useReadySession();
  const workspaceId = search.workspace ?? workspace?.id ?? "";
  useEffect(() => {
    if (
      search.workspace &&
      workspace?.id !== search.workspace &&
      workspaces.some((item) => item.id === search.workspace)
    ) {
      selectWorkspace(search.workspace);
    }
  }, [search.workspace, workspace?.id, workspaces, selectWorkspace]);
  const { t } = useTranslation();
  const { notify } = useToaster();
  const { activity } = useWorkspaceActivity();
  const [busy, setBusy] = useState(false);
  const state = useResource(
    () => workspaceJobsApi.detail(workspaceId, jobId),
    [workspaceId, jobId],
  );
  usePageTitle(t("jobs.detail.title", "Job details"));
  const running = state.status === "ready" && ["RUNNING", "QUEUED"].includes(state.data.job.status);
  usePolling(running, state.reload, state.status === "ready" ? state.data.job.updatedAt : null);
  const act = async (action: "retry" | "cancel") => {
    setBusy(true);
    try {
      await workspaceJobsApi[action](workspaceId, jobId);
      state.reload();
      notify({
        tone: "good",
        title:
          action === "retry"
            ? t("jobs.queuedAgainNotice", "Queued again")
            : t("jobs.cancelledNotice", "Cancelled"),
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
    }
  };
  if (state.status === "loading") {
    return <Waiting label={t("jobs.detail.loading", "Loading job details")} />;
  }
  if (state.status === "failed") {
    return (
      <ProblemState
        problem={state.problem}
        actions={<Button onClick={state.reload}>{t("common.tryAgain", "Try again")}</Button>}
      />
    );
  }
  const { job, attempts, events, configuration, scanItems } = state.data;
  return (
    <>
      <div className="mb-4">
        <Button href="/jobs" variant="quiet" flush>
          {t("jobs.detail.back", "All jobs")}
        </Button>
      </div>
      <PageHeader
        eyebrow={`${labelOfCode(JOB_WORK, job.work)} · ${shortIdentifier(job.id)}`}
        title={job.subject}
        status={<JobState status={job.status} />}
        actions={
          <>
            <Button icon="refresh" onClick={state.reload}>
              {t("common.refresh", "Refresh")}
            </Button>
            <Can permission={PERMISSIONS.automationManage}>
              {job.status === "FAILED" && (
                <Button variant="primary" disabled={busy} onClick={() => void act("retry")}>
                  {t("jobs.retry", "Retry")}
                </Button>
              )}
              {running && (
                <Button disabled={busy} onClick={() => void act("cancel")}>
                  {t("common.cancel", "Cancel")}
                </Button>
              )}
            </Can>
          </>
        }
      />
      {job.status === "FAILED" && (
        <section
          className="mb-6 rounded-surface border border-danger bg-danger-soft p-5"
          aria-labelledby="failure-title"
        >
          <h2 id="failure-title" className="mb-2 text-base font-semibold">
            {t("jobs.detail.failure", "Why this job stopped")}
          </h2>
          <p className="max-w-prose text-sm leading-relaxed [overflow-wrap:anywhere]">
            {job.failureDetail ??
              t(
                "jobs.detail.noFailureDetail",
                "This older failure has no saved explanation. Use the job ID to locate its worker logs; the available attempts and journal are below.",
              )}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-secondary">
            <code>{job.failureCode}</code>
            <span>{job.failureCode && labelOfCode(JOB_FAILURES, job.failureCode)}</span>
          </div>
          {job.failureDetail?.includes("scanner.maximum-") && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Can permission={PERMISSIONS.systemRead}>
                <Button href="/administration/settings">
                  {t("jobs.detail.settings", "System settings")}
                </Button>
              </Can>
              {job.sourceId && (
                <Button href={`/sources/${job.sourceId}?tab=scans`}>
                  {t("jobs.detail.source", "Source and scan rules")}
                </Button>
              )}
            </div>
          )}
        </section>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(240px,300px)] items-start gap-5 max-[900px]:grid-cols-1">
        <div className="grid min-w-0 gap-5">
          <section className={PANEL} aria-labelledby="attempts-title">
            <h2 id="attempts-title" className="mb-4 text-base font-semibold">
              {t("jobs.detail.attempts", "Execution history")}
            </h2>
            <ol className="m-0 grid list-none gap-0 p-0">
              <li className="border-l-2 border-line pb-4 pl-4">
                <p className="text-sm font-medium">{t("jobs.detail.queued", "Job queued")}</p>
                <p className="mt-1 text-xs text-muted">{formatDateTime(job.createdAt)}</p>
              </li>
              {attempts.map((attempt) => (
                <li
                  key={attempt.attemptNumber}
                  className="border-l-2 border-line pb-5 pl-4 last:pb-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm">
                      {t("jobs.detail.attempt", "Attempt {number}", {
                        number: attempt.attemptNumber,
                      })}
                    </strong>
                    <Badge
                      tone={
                        attempt.outcome === "FAILED"
                          ? "error"
                          : attempt.outcome === "SUCCEEDED"
                            ? "good"
                            : "neutral"
                      }
                    >
                      {attempt.outcome
                        ? labelOfCode(JOB_ATTEMPT_OUTCOMES, attempt.outcome)
                        : t("jobs.status.running", "Running")}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-secondary">
                    {formatDateTime(attempt.startedAt)}
                    {attempt.finishedAt && ` → ${formatDateTime(attempt.finishedAt)}`} ·{" "}
                    {attempt.workerId}
                  </p>
                  {attempt.failureDetail && (
                    <p className="mt-2 text-sm [overflow-wrap:anywhere]">{attempt.failureDetail}</p>
                  )}
                  {attempt.failureCode && (
                    <code className="mt-1 block text-xs text-muted">{attempt.failureCode}</code>
                  )}
                </li>
              ))}
            </ol>
          </section>
          <section className={PANEL} aria-labelledby="journal-title">
            <h2 id="journal-title" className="mb-1 text-base font-semibold">
              {t("jobs.detail.journal", "Pipeline journal")}
            </h2>
            <p className="mb-5 text-xs text-muted">
              {t(
                "jobs.detail.journalHelp",
                "Saved pipeline events and scan results. Worker stack traces remain in server logs, identified by this job ID.",
              )}
            </p>
            {state.data.earlierEventsOmitted && (
              <p className="mb-3 text-xs text-muted">
                {t("jobs.detail.latestEvents", "Showing the latest 200 events.")}
              </p>
            )}
            {events.length === 0 && scanItems.length === 0 && (
              <EmptyState
                title={t("jobs.detail.noEvents", "No pipeline events recorded")}
                description={t(
                  "jobs.detail.noEventsHelp",
                  "The job may have stopped before processing began, or this operation records its outcome in the execution history above.",
                )}
              />
            )}
            <ol className="m-0 grid list-none gap-3 p-0">
              {events.map((event, index) => (
                <li key={index} className="rounded-control bg-well p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <strong>{event.stepId || event.type}</strong>
                    <time className="text-muted">{formatDateTime(event.createdAt)}</time>
                  </div>
                  <p className="mt-1 text-xs text-secondary">
                    {event.type} · {event.outcome} ·{" "}
                    {t("jobs.detail.counts", "{blocks} blocks · {chunks} chunks", {
                      blocks: event.blockCount,
                      chunks: event.chunkCount,
                    })}
                  </p>
                  {event.detail && (
                    <p className="mt-2 text-sm [overflow-wrap:anywhere]">{event.detail}</p>
                  )}
                </li>
              ))}
            </ol>
            {state.data.earlierScanItemsOmitted && (
              <p className="mb-3 text-xs text-muted">
                {t("jobs.detail.latestFiles", "Showing the latest 200 file results.")}
              </p>
            )}
            {scanItems.length > 0 && (
              <ul className="m-0 list-none divide-y divide-line p-0">
                {scanItems.map((item) => (
                  <li
                    key={item.number}
                    className="flex items-start justify-between gap-3 py-2 text-xs"
                  >
                    <span className="min-w-0 [overflow-wrap:anywhere]">{item.path}</span>
                    <code className="text-muted">{item.outcome}</code>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <aside className="grid min-w-0 gap-5">
          <section className={PANEL}>
            <h2 className="mb-4 text-sm font-semibold">{t("jobs.detail.overview", "Overview")}</h2>
            <JobTrack job={job} workerAlive={activity?.workerAlive ?? true} />
            <dl className="mt-5 grid gap-4 text-xs">
              <div>
                <dt className="mb-1 text-muted">{t("jobs.column.subject", "On")}</dt>
                <dd>
                  <JobSubjectLink job={job} />
                </dd>
              </div>
              <div>
                <dt className="mb-1 text-muted">{t("jobs.detail.updated", "Last updated")}</dt>
                <dd>{formatDateTime(job.updatedAt)}</dd>
              </div>
              <div>
                <dt className="mb-1 text-muted">{t("jobs.detail.identifier", "Job ID")}</dt>
                <dd className="select-all break-all font-mono">{job.id}</dd>
              </div>
            </dl>
          </section>
          <details className={PANEL}>
            <summary className="cursor-pointer text-sm font-semibold">
              {t("jobs.detail.configuration", "Execution limits")}
            </summary>
            <dl className="mt-4 grid gap-3 text-xs">
              {[
                [
                  t("jobs.detail.maximumAttempts", "Attempts per submission"),
                  configuration.maximumAttempts,
                ],
                [t("jobs.detail.lease", "Worker lease (seconds)"), configuration.leaseSeconds],
                [
                  t("jobs.detail.retryDelay", "Retry delay (seconds)"),
                  configuration.retryDelaySeconds,
                ],
                [
                  t("jobs.detail.blobLimit", "Maximum stored file (bytes)"),
                  configuration.maximumBlobBytes,
                ],
              ].map(([key, value]) => (
                <div key={key}>
                  <dt className="text-muted">{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </details>
        </aside>
      </div>
    </>
  );
}
