import { useEffect, useId, useRef, useState } from "react";
import { formatElapsed, labelOfCode } from "../../application/format";
import { useWorkspaceActivity } from "../../application/WorkspaceActivityProvider";
import type { WorkspaceActivity, WorkspaceJob } from "../../lib/workspaceJobs";
import { useTranslation } from "../../translations/TranslationProvider";
import { Badge, Button, Icon, type BadgeTone } from "../../ui/primitives";
import { JobSubjectLink } from "./JobSubjectLink";
import { JobTrack } from "./JobTrack";
import { WorkerHealth } from "./WorkerHealth";
import { JOB_FAILURES, JOB_WORK } from "./jobLabels";

/* The trigger is a quiet topbar button whose count and dot carry the state, so it can be read without opening it. The
   dot sits in the row before the count, never over a corner, where it would cover the figure it qualifies.
   The dot is never the only signal: the count says how much, and the accessible name says what. */
const TRIGGER = [
  "relative inline-flex h-(--control) items-center gap-1.5 rounded-control border border-transparent bg-surface px-2",
  "text-xs text-secondary hover:border-line hover:text-ink",
  "aria-expanded:border-line aria-expanded:text-ink pointer-coarse:min-h-[40px]",
].join(" ");

const DOT = [
  "inline-block size-2 flex-none rounded-full",
  "data-[state=failed]:bg-danger data-[state=stalled]:bg-warn data-[state=moving]:bg-accent",
].join(" ");

/* Below 700px the panel spans the screen under the topbar instead of hanging off a button near the edge. */
const PANEL = [
  "absolute top-[calc(100%+6px)] right-0 z-30 grid w-[calc(400px*var(--ui-scale))] max-h-[min(70vh,640px)]",
  "overflow-y-auto rounded-control border border-line-strong bg-surface",
  "max-[700px]:fixed max-[700px]:top-[calc(52px*var(--ui-scale))] max-[700px]:right-4 max-[700px]:left-4 max-[700px]:w-auto",
].join(" ");

const PANEL_HEAD = "grid gap-1.5 border-b border-line px-4 py-3";
const SECTION = "grid gap-0 border-b border-line last:border-b-0";
const SECTION_HEAD = "flex items-baseline justify-between px-4 pt-3 pb-1 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase";
const ROW = "grid gap-1.5 px-4 py-2 text-xs";
const ROW_LINE = "flex min-w-0 items-center gap-2";
const ROW_SUBJECT = "min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap";
const ROW_META = "text-[11px] text-muted numeric";
const FOOT = "flex items-center justify-between gap-2 border-t border-line px-4 py-2";

type IndicatorState = "failed" | "stalled" | "moving" | "idle";

function indicatorState(activity: WorkspaceActivity): IndicatorState {
  const waiting = activity.totals.queued + activity.totals.awaitingSubmission;
  if (!activity.workerAlive && waiting > 0) {
    return "stalled";
  }
  if (activity.totals.failedLastDay > 0) {
    return "failed";
  }
  if (activity.totals.running + waiting > 0) {
    return "moving";
  }
  return "idle";
}

/**
 * The workspace's background work, from any page: a topbar button whose count and dot say whether anything is
 * running, waiting or broken, and a panel listing what runs, what waits and what failed in the last day — with the
 * one fact that changes what "queued" means: whether a worker is there to take it.
 */
export function ActivityIndicator() {
  const { activity } = useWorkspaceActivity();
  const { t, plural, language } = useTranslation();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    const closeOutside = (event: PointerEvent) => {
      if (container.current !== null && !container.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  if (activity === null) {
    return null;
  }

  const state = indicatorState(activity);
  const { running, queued, failedLastDay, awaitingSubmission } = activity.totals;
  const active = running + queued + awaitingSubmission;
  const elapsed = (value: string | null) => formatElapsed(value, language);
  const summary = [
    plural("backgroundWork.summary.running", running, { one: "{count} running", other: "{count} running" }),
    plural("backgroundWork.summary.waiting", queued + awaitingSubmission, { one: "{count} waiting", other: "{count} waiting" }),
    plural("backgroundWork.summary.failed", failedLastDay, { one: "{count} failed today", other: "{count} failed today" }),
  ].join(", ");
  const triggerLabel = activity.workerAlive
    ? t("backgroundWork.triggerLabel", "Background work: {summary}", { summary })
    : t("backgroundWork.triggerLabelStalled", "Background work: {summary}. The worker is not running.", { summary });

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  return (
    <div
      ref={container}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={button}
        type="button"
        className={TRIGGER}
        aria-label={triggerLabel}
        title={triggerLabel}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <Icon name="jobs" size="small" />
        {state !== "idle" && <span className={DOT} data-state={state} aria-hidden="true" />}
        {active > 0 && <span className="numeric font-semibold text-ink">{active}</span>}
      </button>

      {open && (
        <section id={panelId} role="dialog" aria-label={t("backgroundWork.title", "Background work")} className={PANEL}>
          <div className={PANEL_HEAD}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="m-0 text-sm font-semibold">{t("backgroundWork.title", "Background work")}</h2>
              <WorkerBadge activity={activity} />
            </div>
            <WorkerHealth activity={activity} />
            {awaitingSubmission > 0 && (
              <p className="m-0 text-xs text-secondary">
                {plural(
                  "backgroundWork.awaitingSubmission",
                  awaitingSubmission,
                  {
                    one: "{count} document is waiting to be queued by its source's automatic preparation.",
                    other: "{count} documents are waiting to be queued by their source's automatic preparation.",
                  },
                )}
              </p>
            )}
          </div>

          <JobSection
            title={t("backgroundWork.running", "Running")}
            total={running}
            jobs={activity.running}
            empty={t("backgroundWork.nothingRunning", "Nothing running.")}
            meta={(job) => t("backgroundWork.startedAgo", "on {worker} · attempt {attempt} of {limit} · started {elapsed}", {
              worker: job.workerId ?? "—",
              attempt: job.attemptCount,
              limit: job.attemptLimit,
              elapsed: elapsed(job.updatedAt),
            })}
            tone="active"
            workerAlive={activity.workerAlive}
          />
          <JobSection
            title={t("backgroundWork.queued", "Queued")}
            total={queued}
            jobs={activity.queued}
            empty={t("backgroundWork.nothingQueued", "Nothing waiting.")}
            meta={(job) =>
              activity.workerAlive
                ? t("backgroundWork.queuedAgo", "queued {elapsed}", { elapsed: elapsed(job.createdAt) })
                : t("backgroundWork.queuedAgoStalled", "queued {elapsed} · waits for the worker", { elapsed: elapsed(job.createdAt) })
            }
            tone={activity.workerAlive ? "neutral" : "warn"}
            workerAlive={activity.workerAlive}
          />
          <JobSection
            title={t("backgroundWork.failed", "Failed in the last day")}
            total={failedLastDay}
            jobs={activity.failed}
            empty={t("backgroundWork.nothingFailed", "Nothing failed.")}
            meta={(job) => job.failureDetail ?? (job.failureCode === null ? elapsed(job.updatedAt) : labelOfCode(JOB_FAILURES, job.failureCode))}
            tone="error"
            workerAlive={activity.workerAlive}
          />

          <div className={FOOT}>
            <span className="text-[11px] text-muted">
              {t("backgroundWork.footnote", "Each list shows at most ten.")}
            </span>
            <Button variant="quiet" href="/jobs" icon="arrow" onClick={() => setOpen(false)}>
              {t("backgroundWork.allJobs", "All jobs")}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function WorkerBadge({ activity }: { activity: WorkspaceActivity }) {
  const { t } = useTranslation();
  return activity.workerAlive ? (
    <Badge tone="good">{t("backgroundWork.workerRunning", "Worker running")}</Badge>
  ) : (
    <Badge tone="warn">{t("backgroundWork.workerStopped", "Worker not running")}</Badge>
  );
}

interface JobSectionProperties {
  title: string;
  total: number;
  jobs: WorkspaceJob[];
  empty: string;
  meta: (job: WorkspaceJob) => string;
  tone: BadgeTone;
  workerAlive: boolean;
}

function JobSection({ title, total, jobs, empty, meta, tone, workerAlive }: JobSectionProperties) {
  const { t } = useTranslation();
  return (
    <section className={SECTION} aria-label={title}>
      <h3 className={SECTION_HEAD}>
        <span>{title}</span>
        <span className="numeric">{total}</span>
      </h3>
      {jobs.length === 0 ? (
        <p className="m-0 px-4 pb-3 text-xs text-muted">{empty}</p>
      ) : (
        <ul className="m-0 list-none p-0 pb-1">
          {jobs.map((job) => (
            <li key={job.id} className={ROW}>
              <span className={ROW_LINE}>
                <Badge tone={tone}>{labelOfCode(JOB_WORK, job.work)}</Badge>
                <span className={ROW_SUBJECT}>
                  <JobSubjectLink job={job} />
                </span>
              </span>
              <JobTrack job={job} workerAlive={workerAlive} />
              <span className={ROW_META}>{meta(job)}</span>
            </li>
          ))}
          {total > jobs.length && (
            <li className="px-4 pb-2 text-[11px] text-muted">
              {t("backgroundWork.more", "and {count} more", { count: total - jobs.length })}
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
