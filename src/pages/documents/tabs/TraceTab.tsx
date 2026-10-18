import { Link } from "@tanstack/react-router";
import { useResource } from "../../../application/useResource";
import { collectAllPages } from "../../../lib/api";
import { pipelineApi, type ProcessingReference, type ProcessingEvent } from "../../../lib/pipeline";
import { PREPARATION_LAYERS } from "../../../lib/preparationLayers";
import { useTranslation } from "../../../translations/TranslationProvider";
import { EmptyState, ProblemState, Waiting } from "../../../ui/components";
import { Badge, type BadgeTone } from "../../../ui/primitives";

const STRIP = "m-0 grid list-none gap-0 p-0";
const LAYER = [
  "grid grid-cols-[calc(34px*var(--ui-scale))_minmax(0,1fr)] gap-3 border-b border-line py-3 last:border-b-0",
  "data-[outcome=OFF]:opacity-60 data-[outcome=NOT_APPLICABLE]:opacity-75",
].join(" ");
const PLACE = [
  "grid size-[calc(26px*var(--ui-scale))] place-items-center rounded-full border text-xs font-semibold numeric",
  "border-good text-good data-[outcome=OFF]:border-line-strong data-[outcome=OFF]:text-muted",
  "data-[outcome=NOT_APPLICABLE]:border-line-strong data-[outcome=NOT_APPLICABLE]:text-muted",
  "data-[outcome=MISSING]:border-dashed data-[outcome=MISSING]:border-line-strong data-[outcome=MISSING]:text-muted",
].join(" ");

const OUTCOME_TONE: Record<string, BadgeTone> = {
  RAN: "good",
  OFF: "neutral",
  NOT_APPLICABLE: "neutral",
  MISSING: "warn",
};

/**
 * What every layer did to this version in the run that built its index generation: ran (and how much), was switched off
 * by the profile, or had nothing to work on — in the order the document passed them. Read from the run's own LAYER
 * events, so it is what happened, not what the profile says now.
 */
export function TraceTab({
  workspaceId,
  generation,
}: {
  workspaceId: string;
  generation: ProcessingReference | null;
}) {
  const { t, say } = useTranslation();
  const events = useResource<ProcessingEvent[] | null>(
    () =>
      generation === null
        ? Promise.resolve(null)
        : collectAllPages((page) =>
            pipelineApi.processingEvents(workspaceId, generation.jobId, page),
          ),
    [workspaceId, generation?.jobId],
  );

  if (generation === null) {
    return (
      <EmptyState
        title={t("documents.trace.noRun", "No run yet")}
        description={t(
          "documents.trace.noRunText",
          "The trace of every layer appears once this version is processed.",
        )}
      />
    );
  }
  if (events.status === "loading") {
    return <Waiting label={t("documents.trace.loading", "Reading the run")} lines={5} />;
  }
  if (events.status === "failed") {
    return <ProblemState layout="section" problem={events.problem} />;
  }
  const byLayer = new Map(
    (events.data ?? [])
      .filter((event) => event.type === "LAYER")
      .map((event) => [event.stepId ?? "", event]),
  );
  const outcomeWord = (outcome: string) =>
    outcome === "RAN"
      ? t("documents.trace.ran", "Ran")
      : outcome === "OFF"
        ? t("documents.trace.off", "Off — passed on unchanged")
        : outcome === "NOT_APPLICABLE"
          ? t("documents.trace.notApplicable", "Nothing to do")
          : t("documents.trace.missing", "Not recorded");

  return (
    <div className="grid gap-4">
      {byLayer.size === 0 && (
        <p className="m-0 text-xs text-warn">
          {t(
            "documents.trace.beforeLayers",
            "This run predates layer tracing. Process the version again to see what each layer did.",
          )}
        </p>
      )}
      <ol className={STRIP} aria-label={t("documents.trace.label", "Layers this version passed")}>
        {PREPARATION_LAYERS.map((layer, index) => {
          const event = byLayer.get(layer.identifier);
          const outcome = event?.outcome ?? "MISSING";
          return (
            <li key={layer.identifier} className={LAYER} data-outcome={outcome}>
              <span className={PLACE} data-outcome={outcome} aria-hidden="true">
                {index + 1}
              </span>
              <div className="grid min-w-0 gap-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <strong className="text-sm text-ink">{say(layer.name)}</strong>
                  <Badge tone={OUTCOME_TONE[outcome] ?? "neutral"}>{outcomeWord(outcome)}</Badge>
                  <Link
                    to={layer.page}
                    className="ml-auto text-xs font-semibold text-accent-text hover:underline"
                  >
                    {t("pipeline.mechanism", "How it works")}
                  </Link>
                </div>
                {event?.detail !== null && event?.detail !== undefined && (
                  <p className="m-0 numeric text-xs text-secondary">{event.detail}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="m-0 text-xs text-secondary">
        {t("documents.trace.runResult", "Processing run {generation} / {state}", {
          generation: generation.jobId.slice(0, 8),
          state: generation.state.toLowerCase(),
        })}
      </p>
    </div>
  );
}
