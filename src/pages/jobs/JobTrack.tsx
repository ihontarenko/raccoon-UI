import type { WorkspaceJob } from "../../lib/workspaceJobs";
import { useTranslation } from "../../translations/TranslationProvider";

/** Counts measured work without implying that a refused job passed all pipeline stages. */
export function JobTrack({ job, workerAlive }: { job: WorkspaceJob; workerAlive: boolean }) {
  const { t } = useTranslation();
  const counted = job.done !== null && job.total !== null && job.total > 0;
  const label = counted
    ? t("jobs.progress.counted", "{done} of {total}", { done: job.done!, total: job.total! })
    : job.status === "QUEUED"
      ? workerAlive
        ? t("jobs.progress.waiting", "Waiting for a worker")
        : t("jobs.progress.noWorker", "Waiting · worker unavailable")
      : job.status === "RUNNING"
        ? t("jobs.progress.inProgress", "In progress")
        : job.status === "FAILED"
          ? t("jobs.progress.stopped", "Stopped before completion")
          : job.status === "CANCELLED"
            ? t("jobs.status.cancelled", "Cancelled")
            : t("jobs.status.succeeded", "Succeeded");
  return (
    <div className="grid min-w-0 gap-2 text-xs text-secondary">
      <span>
        {job.currentStep && job.status === "RUNNING" ? `${job.currentStep} · ${label}` : label}
      </span>
      {counted && (
        <progress
          className="h-1 w-full min-w-24 accent-accent data-[failed=true]:accent-danger"
          data-failed={job.status === "FAILED"}
          value={job.done!}
          max={job.total!}
          aria-label={label}
        />
      )}
    </div>
  );
}
