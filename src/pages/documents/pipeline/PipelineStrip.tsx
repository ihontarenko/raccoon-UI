import type { ReactNode } from "react";
import {
  formatBytes,
  formatDateTime,
  labelOfCode,
  shortIdentifier,
} from "../../../application/format";
import type { DocumentVersionView } from "../../../lib/contracts";
import type { IndexGeneration, ProcessingRun, VectorGeneration } from "../../../lib/pipeline";
import type { WorkspaceJob } from "../../../lib/workspaceJobs";
import { useTranslation } from "../../../translations/TranslationProvider";
import { Badge, Button, Icon, type BadgeTone, type IconName } from "../../../ui/primitives";
import { JOB_STATUSES } from "../../jobs/jobLabels";
import { LEXICAL_GENERATION_STATES } from "../generationLabels";
import {
  PIPELINE,
  STEP,
  STEP_ACTION,
  STEP_BODY,
  STEP_HEAD,
  STEP_NUMBER,
  STEP_TITLE,
} from "../documentPageClasses";

type StepState = "done" | "active" | "waiting" | "attention" | "blocked";

const STATE_TONE: Record<StepState, BadgeTone> = {
  done: "good",
  active: "active",
  waiting: "neutral",
  attention: "warn",
  blocked: "neutral",
};

interface StepProperties {
  number: number;
  icon: IconName;
  title: string;
  state: StepState;
  status: string;
  children: ReactNode;
  action?: ReactNode;
}

function Step({ number, icon, title, state, status, children, action }: StepProperties) {
  return (
    <li className={STEP} data-state={state}>
      <div className={STEP_HEAD}>
        <span className={STEP_NUMBER} aria-hidden="true">
          {state === "done" ? <Icon name="check" size="small" /> : number}
        </span>
        <Icon name={icon} size="small" />
        <h3 className={STEP_TITLE}>{title}</h3>
        <Badge tone={STATE_TONE[state]}>{status}</Badge>
      </div>
      <div className={STEP_BODY}>{children}</div>
      {action !== undefined && <div className={STEP_ACTION}>{action}</div>}
    </li>
  );
}

interface PipelineStripProperties {
  version: DocumentVersionView;
  isLatest: boolean;
  generation: IndexGeneration | null;
  /** A processing run started from this page and not finished yet. */
  runningProcess: ProcessingRun | null;
  preparedRun?: ProcessingRun | null;
  /** This document's processing job as the workspace's activity sees it, wherever it was started from. */
  pendingJob: WorkspaceJob | null;
  /** Whether a worker is there to take the queue; a queued job without one waits indefinitely. */
  workerAlive: boolean;
  /** The name of the processing profile that built the generation, when the viewer may read profiles. */
  profileName: string | null;
  /** Opens that profile's most-used settings in place; absent when the viewer may not read them. */
  onOpenProfile?: () => void;
  vectorGenerations: VectorGeneration[];
  mayProcess: boolean;
  mayManageIndex: boolean;
  mayVectorise: boolean;
  busy: boolean;
  onProcess: () => void;
  onPublish: (published: boolean) => void;
  onVectorise: () => void;
}

/**
 * The four things that happen to a version, in order, each with its state and the one action that
 * moves it forward. A step that cannot run yet says what it is waiting for instead of hiding.
 */
export function PipelineStrip({
  version,
  isLatest,
  generation,
  runningProcess,
  preparedRun,
  pendingJob,
  workerAlive,
  profileName,
  onOpenProfile,
  vectorGenerations,
  mayProcess,
  mayManageIndex,
  mayVectorise,
  busy,
  onProcess,
  onPublish,
  onVectorise,
}: PipelineStripProperties) {
  const { t, plural } = useTranslation();
  const jobStatus = runningProcess?.job.status ?? pendingJob?.status ?? null;
  const processing = jobStatus === "QUEUED" || jobStatus === "RUNNING";
  const waitsForWorker = jobStatus === "QUEUED" && !workerAlive;
  const published = generation?.state === "PUBLISHED";
  const liveVectors = vectorGenerations.filter((candidate) => candidate.state !== "PURGED");
  const publishedVectors = liveVectors.find((candidate) => candidate.state === "PUBLISHED") ?? null;
  const buildingVectors = liveVectors.find((candidate) => candidate.state === "BUILDING") ?? null;

  const processedState: StepState = waitsForWorker
    ? "attention"
    : processing
      ? "active"
      : generation === null && !preparedRun
        ? "waiting"
        : generation?.state === "PURGED"
          ? "attention"
          : "done";
  const publishedState: StepState =
    generation === null
      ? "blocked"
      : published
        ? "done"
        : generation.state === "PURGED"
          ? "blocked"
          : "attention";
  const vectorState: StepState =
    buildingVectors !== null
      ? "active"
      : publishedVectors !== null
        ? "done"
        : published
          ? "waiting"
          : "blocked";

  return (
    <ol
      className={PIPELINE}
      aria-label={t("documents.pipeline.label", "Where this version stands")}
    >
      <Step
        number={1}
        icon="documents"
        title={t("documents.pipeline.captured", "Captured")}
        state="done"
        status={t("documents.pipeline.version", "Version {number}", {
          number: version.versionNumber,
        })}
      >
        <p>
          {formatBytes(version.sizeBytes)} · <span className="numeric">{version.mediaType}</span>
        </p>
        <p className="text-xs text-muted">
          {formatDateTime(version.createdAt)} ·{" "}
          <span className="numeric">{version.sha256.slice(0, 12)}</span>
        </p>
      </Step>

      <Step
        number={2}
        icon="chunks"
        title={t("documents.pipeline.processed", "Processed")}
        state={processedState}
        status={
          waitsForWorker
            ? t("documents.pipeline.waitingForWorker", "Waiting for the worker")
            : processing && jobStatus !== null
              ? labelOfCode(JOB_STATUSES, jobStatus)
              : generation === null && preparedRun
                ? t("preparation.savedSteps", "Prepared: {steps}", {
                    steps: preparedRun.preparation.steps.join(" / "),
                  })
                : generation === null
                  ? t("documents.pipeline.notYet", "Not yet")
                  : plural("documents.pipeline.chunkCount", generation.entryCount, {
                      one: "{count} chunk",
                      other: "{count} chunks",
                    })
        }
        action={
          mayProcess && (
            <Button
              variant={generation === null ? "primary" : "quiet"}
              flush={generation !== null}
              icon="play"
              disabled={processing || busy}
              onClick={onProcess}
            >
              {processing
                ? t("documents.pipeline.processing", "Processing…")
                : generation === null
                  ? t("documents.pipeline.process", "Process")
                  : t("documents.pipeline.processAgain", "Process again")}
            </Button>
          )
        }
      >
        {waitsForWorker ? (
          <p className="text-xs text-warn">
            {t(
              "documents.pipeline.workerDown",
              "Queued, but the worker is not running, so nothing is parsed until it starts:",
            )}{" "}
            <code className="numeric">./jm.sh up raccoon:worker</code>
          </p>
        ) : jobStatus === "QUEUED" ? (
          <p className="text-xs text-secondary">
            {t(
              "documents.pipeline.queued",
              "Queued. The worker takes it in a moment; this page follows the job.",
            )}
          </p>
        ) : processing ? (
          <p className="text-xs text-secondary">
            {runningProcess !== null
              ? t(
                  "preparation.runningRevision",
                  "Running the selected steps with profile revision {revision}. This page follows the job.",
                  { revision: runningProcess.profileRevision },
                )
              : t(
                  "preparation.running",
                  "Running the selected preparation steps. This page follows the job.",
                )}
          </p>
        ) : generation === null ? (
          <p className="text-xs text-secondary">
            {t(
              "preparation.stageHelp",
              "Choose which outputs to prepare under Manage. Parsed text, chunks and relations are independent of publication in search.",
            )}
          </p>
        ) : (
          <>
            <p className="text-xs text-secondary">
              {t("documents.pipeline.generation", "Generation")}{" "}
              <span className="numeric">{shortIdentifier(generation.jobId)}</span> ·{" "}
              {t("documents.pipeline.profileRevision", "profile revision {revision}", {
                revision: generation.profileRevision,
              })}
            </p>
            {profileName !== null && (
              <p className="flex flex-wrap items-center gap-x-2 text-xs">
                <span className="text-muted">{t("documents.pipeline.profile", "Profile")}</span>
                <span className="font-semibold text-ink">{profileName}</span>
                {onOpenProfile !== undefined && (
                  <Button variant="quiet" flush icon="system" onClick={onOpenProfile}>
                    {t("documents.pipeline.settings", "Settings")}
                  </Button>
                )}
              </p>
            )}
          </>
        )}
      </Step>

      <Step
        number={3}
        icon="layers"
        title={t("documents.pipeline.searchable", "Searchable")}
        state={publishedState}
        status={
          generation === null
            ? t("documents.pipeline.waitsForProcessing", "Waits for processing")
            : labelOfCode(LEXICAL_GENERATION_STATES, generation.state)
        }
        action={
          mayManageIndex &&
          generation !== null &&
          generation.state !== "PURGED" &&
          (published ? (
            <Button variant="quiet" flush disabled={busy} onClick={() => onPublish(false)}>
              {t("documents.pipeline.withdraw", "Withdraw")}
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={busy || !isLatest}
              title={
                isLatest
                  ? undefined
                  : t("documents.pipeline.onlyCurrent", "Only the current version can be published")
              }
              onClick={() => onPublish(true)}
            >
              {t("documents.pipeline.publish", "Publish")}
            </Button>
          ))
        }
      >
        <p className="text-xs text-secondary">
          {generation === null
            ? t(
                "documents.pipeline.searchHintNone",
                "Search finds this version once a generation is published.",
              )
            : published
              ? t(
                  "documents.pipeline.searchHintPublished",
                  "Search finds this version through its keywords.",
                )
              : isLatest
                ? t(
                    "documents.pipeline.searchHintBuilt",
                    "Built but not searchable. Publish it to let search find it.",
                  )
                : t(
                    "documents.pipeline.searchHintOlder",
                    "An older version; search uses the current one.",
                  )}
        </p>
      </Step>

      <Step
        number={4}
        icon="vectors"
        title={t("documents.pipeline.vectorised", "Vectorised")}
        state={vectorState}
        status={
          buildingVectors !== null
            ? t("documents.pipeline.building", "Building")
            : publishedVectors !== null
              ? t("documents.pipeline.published", "Published")
              : liveVectors.length > 0
                ? t("documents.pipeline.withdrawn", "Withdrawn")
                : t("documents.pipeline.notYet", "Not yet")
        }
        action={
          mayVectorise && (
            <Button
              variant={publishedVectors === null && published ? "primary" : "quiet"}
              icon="vectors"
              disabled={!published || busy || buildingVectors !== null}
              onClick={onVectorise}
            >
              {publishedVectors === null
                ? t("documents.pipeline.vectorise", "Vectorise")
                : t("documents.pipeline.vectoriseAgain", "Vectorise again")}
            </Button>
          )
        }
      >
        {publishedVectors !== null ? (
          <p className="text-xs text-secondary">
            {publishedVectors.model.provider} ·{" "}
            <span className="numeric">{publishedVectors.model.model}</span> ·{" "}
            {plural("documents.pipeline.vectorCount", publishedVectors.storedRecords, {
              one: "{count} vector",
              other: "{count} vectors",
            })}
          </p>
        ) : (
          <p className="text-xs text-secondary">
            {published
              ? t(
                  "documents.pipeline.vectoriseHint",
                  "Embed the published chunks for semantic search. A preflight shows tokens and cost first.",
                )
              : t("documents.pipeline.needsPublished", "Needs a published index generation.")}
          </p>
        )}
      </Step>
    </ol>
  );
}
