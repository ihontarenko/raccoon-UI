import { useState } from "react";
import { Can } from "../../access/Can";
import { PERMISSIONS } from "../../access/permissions";
import { formatDateTime, formatElapsed, labelOfCode, shortIdentifier } from "../../application/format";
import { describeProblem } from "../../application/problems";
import { useReadySession } from "../../application/session";
import { usePagedList } from "../../application/usePagedList";
import { usePageTitle } from "../../application/usePageTitle";
import { usePolling } from "../../application/usePolling";
import type { JobStatus } from "../../lib/contracts";
import { workspaceJobsApi, type WorkspaceJob, type WorkspaceJobFilter } from "../../lib/workspaceJobs";
import { useTranslation } from "../../translations/TranslationProvider";
import { EmptyState, ListFooter, PageHeader, ProblemState, Segmented, Waiting, useToaster } from "../../ui/components";
import { Badge, Button, Table, type BadgeTone } from "../../ui/primitives";
import { JobSubjectLink } from "./JobSubjectLink";
import { JobTrack } from "./JobTrack";
import { WorkerHealth } from "./WorkerHealth";
import { useWorkspaceActivity } from "../../application/WorkspaceActivityProvider";
import { JOB_FAILURES, JOB_STATUSES, JOB_WORK } from "./jobLabels";

/* The bar a running job fills. ⚠️ The finished colours are attribute variants over a base fill, so
   each state declares the colour once — a succeeded job is green, a refused or cancelled one red,
   and anything still running wears the accent. */
const PROGRESS_FILL = [
  "block h-full bg-accent transition-[width] duration-120 motion-reduce:transition-none",
  "data-[status=SUCCEEDED]:bg-good data-[status=FAILED]:bg-deny data-[status=CANCELLED]:bg-deny",
].join(" ");


const STATUS_TONE: Record<JobStatus, BadgeTone> = {
  QUEUED: "neutral",
  RUNNING: "active",
  SUCCEEDED: "good",
  FAILED: "error",
  CANCELLED: "deny",
};


const UNFINISHED = new Set<JobStatus>(["QUEUED", "RUNNING"]);

/**
 * What this workspace has running in the background — scans, processing runs, vector generations — how far
 * each got, and the way to stop or repeat it. The installation-wide queue stays in Administration.
 */
export function WorkspaceJobsPage() {
  const { t, plural, language } = useTranslation();
  const { activity } = useWorkspaceActivity();
  usePageTitle(t("jobs.title", "Jobs"));
  const { workspace } = useReadySession();
  const workspaceId = workspace?.id ?? "";
  const { notify } = useToaster();
  const [filter, setFilter] = useState<WorkspaceJobFilter>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const jobs = usePagedList((page) => workspaceJobsApi.list(workspaceId, filter, page), [workspaceId, filter]);

  // While anything is still moving the list follows it; once everything has settled it stops asking.
  const moving = jobs.status === "ready" && jobs.items.some((job) => UNFINISHED.has(job.status));
  usePolling(moving, jobs.reload, jobs.status === "ready" ? jobs.items.map((job) => `${job.id}:${job.status}:${job.done}`).join() : null);

  const act = async (job: WorkspaceJob, action: "cancel" | "retry") => {
    setBusyId(job.id);
    try {
      await (action === "cancel" ? workspaceJobsApi.cancel(workspaceId, job.id) : workspaceJobsApi.retry(workspaceId, job.id));
      notify({
        tone: "good",
        title: action === "cancel" ? t("jobs.cancelledNotice", "Cancelled") : t("jobs.queuedAgainNotice", "Queued again"),
        description: `${labelOfCode(JOB_WORK, job.work)} · ${job.subject}`,
      });
      jobs.reload();
    } catch (error) {
      const problem = describeProblem(error);
      notify({ tone: "error", title: problem.title, description: problem.detail ?? problem.description });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={t("jobs.eyebrow", "Pipeline")}
        title={t("jobs.title", "Jobs")}
        lead={t(
          "jobs.lead",
          "What this workspace has running in the background: scans of its sources, processing of its documents, and vectorisation — how far each got, and the way to stop or repeat it.",
        )}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented<WorkspaceJobFilter>
          label={t("jobs.filter.label", "Show")}
          value={filter}
          onChange={setFilter}
          options={[
            { value: "ALL", label: t("jobs.filter.all", "Everything") },
            { value: "UNFINISHED", label: t("jobs.filter.unfinished", "Running or waiting") },
            { value: "FAILED", label: t("jobs.filter.failed", "Failed") },
          ]}
        />
        {moving && <span className="text-xs text-secondary">{t("jobs.following", "Following the running work…")}</span>}
      </div>

      {activity !== null && (
        <section className="mb-4 grid gap-2 rounded-surface border border-line bg-surface px-4 py-3" aria-labelledby="worker-health-heading">
          <h2 id="worker-health-heading" className="m-0 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
            {t("jobs.workers", "Workers")}
          </h2>
          <WorkerHealth activity={activity} />
        </section>
      )}

      {jobs.status === "loading" && <Waiting label={t("jobs.loading", "Loading the jobs")} lines={5} />}
      {jobs.status === "failed" && (
        <ProblemState
          layout="section"
          problem={jobs.problem}
          actions={
            <Button icon="refresh" onClick={jobs.reload}>
              {t("common.tryAgain", "Try again")}
            </Button>
          }
        />
      )}
      {jobs.status === "ready" &&
        (jobs.items.length === 0 ? (
          <EmptyState
            title={
              filter === "ALL"
                ? t("jobs.empty.all", "Nothing has run yet")
                : filter === "FAILED"
                  ? t("jobs.empty.failed", "Nothing failed")
                  : t("jobs.empty.unfinished", "Nothing is running")
            }
            description={t("jobs.empty.description", "A scan, a processing run or a vectorisation started anywhere in the workspace appears here.")}
          />
        ) : (
          <div className="overflow-clip rounded-surface border border-line bg-surface">
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t("jobs.column.work", "Work")}</th>
                  <th scope="col">{t("jobs.column.subject", "On")}</th>
                  <th scope="col">{t("jobs.column.state", "State")}</th>
                  <th scope="col">{t("jobs.column.progress", "Progress")}</th>
                  <th scope="col">{t("jobs.column.queued", "Queued")}</th>
                  <th scope="col">
                    <span className="sr-only">{t("common.actions", "Actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {jobs.items.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <strong>{labelOfCode(JOB_WORK, job.work)}</strong>
                      <div className="numeric text-xs text-muted">{shortIdentifier(job.id)}</div>
                    </td>
                    <td className="wraps">
                      <JobSubjectLink job={job} />
                    </td>
                    <td>
                      <Badge tone={STATUS_TONE[job.status]}>{labelOfCode(JOB_STATUSES, job.status)}</Badge>
                      {job.failureCode !== null && (
                        <div className="text-xs text-muted">{labelOfCode(JOB_FAILURES, job.failureCode)}</div>
                      )}
                      {job.failureDetail !== null && <div className="text-xs text-danger">{job.failureDetail}</div>}
                    </td>
                    <td>
                      <div className="grid gap-1.5">
                        <JobTrack job={job} workerAlive={activity?.workerAlive ?? true} />
                        <Progress job={job} />
                      </div>
                    </td>
                    <td className="text-xs text-secondary">
                      <div title={formatDateTime(job.createdAt)}>{formatElapsed(job.createdAt, language)}</div>
                      <div className="text-muted">
                        {t("jobs.attempts", "attempt {attempt} of {limit}", { attempt: job.attemptCount, limit: job.attemptLimit })}
                        {job.workerId !== null && ` · ${job.workerId}`}
                      </div>
                    </td>
                    <td className="actions">
                      <Can permission={PERMISSIONS.automationManage}>
                        {UNFINISHED.has(job.status) && (
                          <Button variant="quiet" icon="stop" disabled={busyId === job.id} onClick={() => void act(job, "cancel")}>
                            {t("common.cancel", "Cancel")}
                          </Button>
                        )}
                        {job.status === "FAILED" && (
                          <Button variant="quiet" icon="refresh" disabled={busyId === job.id} onClick={() => void act(job, "retry")}>
                            {t("jobs.retry", "Retry")}
                          </Button>
                        )}
                      </Can>
                    </td>
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
          </div>
        ))}
    </>
  );
}


/**
 * Files, vectors or processing steps done out of the total, where the work can count; a bar with the numbers beside
 * it. Nothing at all where it cannot — the track above already says where the job stands.
 */
function Progress({ job }: { job: WorkspaceJob }) {
  const { t, plural } = useTranslation();
  if (job.done === null || job.total === null || job.total === 0) {
    return null;
  }
  const share = Math.min(1, job.done / job.total);
  return (
    <div className="grid min-w-[calc(140px*var(--ui-scale))] gap-[calc(3px*var(--ui-scale))]">
      <span className="block h-[calc(4px*var(--ui-scale))] overflow-hidden rounded-[2px] bg-well" aria-hidden="true">
        <span className={PROGRESS_FILL} style={{ width: `${share * 100}%` }} data-status={job.status} />
      </span>
      <span className="text-xs numeric">{progressText(job.work, job.done, job.total, t, plural)}</span>
    </div>
  );
}

function progressText(
  work: WorkspaceJob["work"],
  done: number,
  total: number,
  t: ReturnType<typeof useTranslation>["t"],
  plural: ReturnType<typeof useTranslation>["plural"],
): string {
  if (work === "SCAN") {
    return plural("jobs.progress.files", total, { one: "{done} of {count} file", other: "{done} of {count} files" }, { done });
  }
  if (work === "VECTORS") {
    return plural("jobs.progress.vectors", total, { one: "{done} of {count} vector", other: "{done} of {count} vectors" }, { done });
  }
  if (work === "PROCESSING") {
    return plural("jobs.progress.steps", total, { one: "{done} of {count} step", other: "{done} of {count} steps" }, { done });
  }
  return t("jobs.progress.counted", "{done} of {total}", { done, total });
}
