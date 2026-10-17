import type { ReactNode } from "react";
import { STAGE_OUTCOMES } from "../../../application/codeLabels";
import { formatDateTime, formatNumber, labelOfCode, shortIdentifier, type CodeLabels } from "../../../application/format";
import { useResource } from "../../../application/useResource";
import { collectAllPages } from "../../../lib/api";
import { pipelineApi, type IndexGeneration, type PreparationConfiguration } from "../../../lib/pipeline";
import { declareText, translatePlural } from "../../../translations/translate";
import { useTranslation } from "../../../translations/TranslationProvider";
import { EmptyState, Facts, ProblemState, Waiting } from "../../../ui/components";
import { Badge, Button, Table } from "../../../ui/primitives";
import { JOB_STATUSES } from "../../jobs/jobLabels";
import { JOURNAL, PANEL, PANEL_TITLE, TABLE_SURFACE } from "../documentPageClasses";

/**
 * How a processing step ended: a stage's script outcome, or why a source file's structure was refused and it fell
 * back to text chunking (`chunking/JavaStructureChunker`).
 */
const PROCESSING_OUTCOMES: CodeLabels = {
  ...STAGE_OUTCOMES,
  JAVA_PARSE_PROBLEMS: declareText("codes.processingOutcome.javaParseProblems", "Java parse problems"),
  JAVA_NO_TYPES: declareText("codes.processingOutcome.javaNoTypes", "No Java types"),
};

function describePreparation(preparation: PreparationConfiguration | null): string {
  if (preparation === null) {
    return "—";
  }
  const parts = [preparation.steps.join(" → ")];
  if (preparation.chunking !== null) {
    parts.push(`${preparation.chunking.chunkerIds.join(" → ")}, ${preparation.chunking.maximumCodePoints} / ${preparation.chunking.overlapCodePoints}`);
  }
  if (preparation.indexing !== null) {
    parts.push(`${preparation.indexing.backendId}, ${preparation.indexing.analyzer}`);
  }
  if (preparation.scriptGroupIds.length > 0) {
    parts.push(
      translatePlural("documents.journal.scriptGroups", preparation.scriptGroupIds.length, {
        one: "{count} script group",
        other: "{count} script groups",
      }),
    );
  }
  return parts.join(" · ");
}

/** What the processing run did, step by step, and which scripts it ran on the way. */
export function JournalTab({ workspaceId, documentId, generation }: { workspaceId: string; documentId: string; generation: IndexGeneration | null }) {
  const { t } = useTranslation();
  const journal = useResource(async () => {
    if (generation === null) {
      return null;
    }
    const [run, events] = await Promise.all([
      pipelineApi.processingRun(workspaceId, documentId, generation.versionId, generation.jobId),
      collectAllPages((page) => pipelineApi.processingEvents(workspaceId, generation.jobId, page)),
    ]);
    return { run, events };
  }, [workspaceId, documentId, generation?.jobId]);

  if (generation === null) {
    return <EmptyState
        title={t("documents.journal.noRun", "No run yet")}
        description={t(
          "documents.journal.noRunDescription",
          "The journal of a processing run appears here once the version is processed.",
        )}
      />;
  }
  if (journal.status === "loading") {
    return <Waiting label={t("documents.journal.loading", "Loading the journal")} lines={5} />;
  }
  if (journal.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={journal.problem}
        actions={
          <Button icon="refresh" onClick={journal.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }
  if (journal.data === null) {
    return null;
  }
  const { run, events } = journal.data;

  return (
    <div className={JOURNAL}>
      <section aria-labelledby="run-facts">
        <h3 id="run-facts" className={PANEL_TITLE}>
          {t("documents.journal.run", "Run")}
        </h3>
        <div className={PANEL}>
          <Facts
            rows={[
              [t("documents.journal.job", "Job"), <span className="numeric">{shortIdentifier(run.job.id)}</span>],
              [
                t("documents.journal.status", "Status"),
                <Badge tone={run.job.status === "SUCCEEDED" ? "good" : run.job.status === "FAILED" ? "error" : "active"}>
                  {labelOfCode(JOB_STATUSES, run.job.status)}
                </Badge>,
              ],
              [
                t("documents.journal.attempts", "Attempts"),
                t("documents.journal.attemptsOf", "{count} of {limit}", {
                  count: run.job.attemptCount,
                  limit: run.job.attemptLimit,
                }),
              ],
              [t("documents.journal.started", "Started"), formatDateTime(run.job.createdAt)],
              [t("documents.journal.finished", "Finished"), formatDateTime(run.job.updatedAt)],
              [t("documents.journal.parser", "Parser"), <span className="numeric">{run.parserId}</span>],
              [
                t("documents.journal.limits", "Limits"),
                t("documents.journal.limitsValue", "{characters} characters, {blocks} blocks, {chunks} chunks", {
                  characters: formatNumber(run.limits.maximumCharacters),
                  blocks: formatNumber(run.limits.maximumBlocks),
                  chunks: formatNumber(run.maximumChunks),
                }),
              ],
              [t("documents.journal.planned", "Planned"), describePreparation(run.preparation)],
              [
                t("documents.journal.ran", "Ran"),
                run.effectivePreparation === null
                  ? t("documents.journal.notPublished", "Not published")
                  : describePreparation(run.effectivePreparation),
              ],
              ...(run.job.failureCode === null ? [] : [[t("documents.journal.failure", "Failure"), <span className="numeric">{run.job.failureCode}</span>] as [string, ReactNode]]),
            ]}
          />
        </div>
      </section>
      <section aria-labelledby="run-events">
        <h3 id="run-events" className={PANEL_TITLE}>
          {t("documents.journal.events", "Events · {count}", { count: events.length })}
        </h3>
        {events.length === 0 ? (
          <p className="text-xs text-muted">{t("documents.journal.noEvents", "The run recorded no events.")}</p>
        ) : (
          <div className={TABLE_SURFACE}>
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t("documents.journal.event", "Event")}</th>
                  <th scope="col">{t("documents.journal.step", "Step")}</th>
                  <th scope="col" className="numeric">
                    {t("documents.journal.blocks", "Blocks")}
                  </th>
                  <th scope="col" className="numeric">
                    {t("documents.tab.chunks", "Chunks")}
                  </th>
                  <th scope="col">{t("documents.journal.outcome", "Outcome")}</th>
                  <th scope="col">{t("documents.journal.scripts", "Scripts")}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="numeric text-xs">{event.type}</td>
                    <td className="numeric text-xs">{event.stepId ?? "—"}</td>
                    <td className="numeric">{formatNumber(event.blockCount)}</td>
                    <td className="numeric">{formatNumber(event.chunkCount)}</td>
                    <td>
                      <Badge tone={event.outcome === "FAILED" || event.type === "FAILED" ? "error" : event.type === "STRUCTURE_FALLBACK" || event.type === "PARSE_OBSERVATION" ? "warn" : "neutral"}>
                        {labelOfCode(PROCESSING_OUTCOMES, event.outcome)}
                      </Badge>
                      {event.detail !== null && event.detail !== undefined && <div className="text-xs text-muted">{event.detail}</div>}
                    </td>
                    <td className="text-xs">
                      {event.executions.length === 0
                        ? "—"
                        : event.executions.map((execution) => (
                            <div key={execution.scriptVersionId} className="numeric">
                              {shortIdentifier(execution.scriptVersionId)} · {execution.outcome}
                            </div>
                          ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
