import { STAGE_OUTCOMES } from "../../application/codeLabels";
import { formatNumber, labelOfCode, shortIdentifier } from "../../application/format";
import { usePagedList } from "../../application/usePagedList";
import { pipelineApi } from "../../lib/pipeline";
import { useTranslation } from "../../translations/TranslationProvider";
import { EmptyState, ListFooter, ProblemState, Waiting } from "../../ui/components";
import { Badge, Table } from "../../ui/primitives";
import { TABLE_SURFACE } from "./indexingClasses";

/** The embedding journal: every step a preflight and a vector job took, and the scripts that ran on it. */
export function EmbeddingJournalTab({ workspaceId }: { workspaceId: string }) {
  const { t, plural } = useTranslation();
  const events = usePagedList((page) => pipelineApi.embeddingEvents(workspaceId, null, page), [workspaceId]);
  if (events.status === "loading") {
    return <Waiting label={t("index.journal.loading", "Loading the journal")} lines={5} />;
  }
  if (events.status === "failed") {
    return <ProblemState layout="section" problem={events.problem} />;
  }
  if (events.items.length === 0) {
    return (
      <EmptyState
        title={t("index.journal.empty", "The journal is empty")}
        description={t("index.journal.emptyDescription", "Preflights and vector jobs record each step here as they run.")}
      />
    );
  }
  return (
    <div className={TABLE_SURFACE}>
      <Table>
        <thead>
          <tr>
            <th scope="col">{t("index.journal.event", "Event")}</th>
            <th scope="col">{t("index.journal.belongsTo", "Belongs to")}</th>
            <th scope="col" className="numeric">
              {t("index.column.chunks", "Chunks")}
            </th>
            <th scope="col" className="numeric">
              {t("index.journal.batch", "Batch")}
            </th>
            <th scope="col" className="numeric">
              {t("index.journal.characters", "Characters")}
            </th>
            <th scope="col">{t("index.column.outcome", "Outcome")}</th>
            <th scope="col">{t("index.journal.scripts", "Scripts")}</th>
          </tr>
        </thead>
        <tbody>
          {events.items.map((event) => (
            <tr key={event.id}>
              <td className="numeric text-xs">{event.type}</td>
              <td className="numeric text-xs">
                {event.jobId !== null
                  ? t("index.journal.job", "job {identifier}", { identifier: shortIdentifier(event.jobId) })
                  : event.preflightId !== null
                    ? t("index.journal.preflight", "preflight {identifier}", { identifier: shortIdentifier(event.preflightId) })
                    : "—"}
              </td>
              <td className="numeric">{formatNumber(event.chunkCount)}</td>
              <td className="numeric">{event.batchNumber > 0 ? event.batchNumber : "—"}</td>
              <td className="numeric">{formatNumber(event.inputCodePoints)}</td>
              <td>
                <Badge tone={/FAIL/.test(event.type) || /FAIL|REFUS/.test(event.outcome) ? "error" : "neutral"}>{labelOfCode(STAGE_OUTCOMES, event.outcome)}</Badge>
              </td>
              <td className="text-xs">{event.executions.length === 0 ? "—" : event.executions.map((execution) => execution.outcome).join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <ListFooter
        shown={events.items.length}
        counted={plural("index.journal.count", events.items.length, { one: "{count} event", other: "{count} events" })}
        hasMore={events.hasMore}
        loadingMore={events.loadingMore}
        moreProblem={events.moreProblem}
        onLoadMore={events.loadMore}
      />
    </div>
  );
}
