import type { WorkspaceJob } from "../../lib/workspaceJobs";
import { declareText, type DeclaredText } from "../../translations/translate";
import { useTranslation } from "../../translations/TranslationProvider";

/*
 * Four stops a job passes, as dots on one line: Queued → Taken → Working → Done or Failed. A stop already passed is
 * filled green, the one the job is at wears the accent and breathes (still with reduced motion), a failure is red,
 * a stall — queued with no worker to take it — is amber, and a stop not reached is an empty ring. The words sit
 * under the dots, so colour is never the only signal.
 */
const TRACK = "grid grid-cols-4 items-start gap-0 min-w-[calc(220px*var(--ui-scale))]";
const STOP = "relative grid justify-items-center gap-1 text-center";
/* The connector runs from this dot to the next one; the last stop has none. */
const CONNECTOR = [
  "absolute top-[4px] left-1/2 h-px w-full bg-line",
  "data-[passed=true]:bg-good",
].join(" ");
const DOT = [
  "relative z-[1] size-[9px] rounded-full border border-line-strong bg-surface",
  "data-[state=passed]:border-good data-[state=passed]:bg-good",
  "data-[state=current]:border-accent data-[state=current]:bg-accent",
  "data-[state=current]:shadow-[0_0_0_3px_var(--accent-soft)] data-[state=current]:animate-pulse motion-reduce:animate-none",
  "data-[state=stalled]:border-warn data-[state=stalled]:bg-warn data-[state=stalled]:shadow-[0_0_0_3px_var(--warn-soft)]",
  "data-[state=failed]:border-danger data-[state=failed]:bg-danger",
  "data-[state=cancelled]:border-muted data-[state=cancelled]:bg-muted",
].join(" ");
const LABEL = [
  "text-[10px] leading-tight text-muted whitespace-nowrap",
  "data-[state=current]:font-semibold data-[state=current]:text-ink",
  "data-[state=stalled]:font-semibold data-[state=stalled]:text-warn",
  "data-[state=failed]:font-semibold data-[state=failed]:text-danger",
].join(" ");

type StopState = "passed" | "current" | "stalled" | "failed" | "cancelled" | "ahead";

interface Stop {
  label: string;
  state: StopState;
}

/** The step a processing run is on, as a word: parse, chunk, lexical — the plan's own step names. */
/** While a job works, its third stop says only which step it is on — the stop itself already says it is working. */
const STEP_WORDS: Record<string, DeclaredText> = {
  parse: declareText("jobs.track.step.parse", "Parsing"),
  chunk: declareText("jobs.track.step.chunk", "Chunking"),
  lexical: declareText("jobs.track.step.lexical", "Indexing"),
};

function hasProgress(job: WorkspaceJob): boolean {
  return (job.done !== null && job.done > 0) || job.currentStep !== null;
}

export function JobTrack({ job, workerAlive }: { job: WorkspaceJob; workerAlive: boolean }) {
  const { t, say } = useTranslation();
  const working =
    job.status === "RUNNING" && job.currentStep !== null
      ? STEP_WORDS[job.currentStep] !== undefined ? say(STEP_WORDS[job.currentStep]) : job.currentStep
      : job.status === "RUNNING" && job.done !== null && job.total !== null
        ? `${job.done}/${job.total}`
        : t("jobs.track.working", "Working");
  const stops = stopsOf(job, workerAlive, {
    queued: t("jobs.track.queued", "Queued"),
    taken: t("jobs.track.taken", "Taken"),
    working,
    done: t("jobs.track.done", "Done"),
    failed: t("jobs.track.failed", "Failed"),
    cancelled: t("jobs.track.cancelled", "Cancelled"),
  });
  const current = stops.find((stop) => stop.state !== "passed" && stop.state !== "ahead") ?? stops[stops.length - 1];
  return (
    <ol className={TRACK} aria-label={t("jobs.track.label", "Job progress: {stop}", { stop: current.label })} role="list">
      {stops.map((stop, index) => (
        <li key={index} className={STOP}>
          {index < stops.length - 1 && <span className={CONNECTOR} data-passed={stop.state === "passed"} aria-hidden="true" />}
          <span className={DOT} data-state={stop.state} aria-hidden="true" />
          <span className={LABEL} data-state={stop.state}>
            {stop.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

interface StopWords {
  queued: string;
  taken: string;
  working: string;
  done: string;
  failed: string;
  cancelled: string;
}

function stopsOf(job: WorkspaceJob, workerAlive: boolean, words: StopWords): Stop[] {
  const stop = (label: string, state: StopState): Stop => ({ label, state });
  switch (job.status) {
    case "QUEUED":
      return [
        stop(words.queued, workerAlive ? "current" : "stalled"),
        stop(words.taken, "ahead"),
        stop(words.working, "ahead"),
        stop(words.done, "ahead"),
      ];
    case "RUNNING":
      return hasProgress(job)
        ? [stop(words.queued, "passed"), stop(words.taken, "passed"), stop(words.working, "current"), stop(words.done, "ahead")]
        : [stop(words.queued, "passed"), stop(words.taken, "current"), stop(words.working, "ahead"), stop(words.done, "ahead")];
    case "SUCCEEDED":
      return [stop(words.queued, "passed"), stop(words.taken, "passed"), stop(words.working, "passed"), stop(words.done, "passed")];
    case "FAILED":
      return [stop(words.queued, "passed"), stop(words.taken, "passed"), stop(words.working, "passed"), stop(words.failed, "failed")];
    case "CANCELLED":
      return [stop(words.queued, "passed"), stop(words.taken, "ahead"), stop(words.working, "ahead"), stop(words.cancelled, "cancelled")];
  }
}
