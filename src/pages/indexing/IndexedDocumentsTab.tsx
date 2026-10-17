import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { usePermissions } from "../../access/PermissionsProvider";
import { PERMISSIONS } from "../../access/permissions";
import { formatNumber } from "../../application/format";
import { describeProblem } from "../../application/problems";
import { usePagedList } from "../../application/usePagedList";
import { indexOverviewApi, type DocumentStage, type DocumentStanding } from "../../lib/indexOverview";
import { useTranslation } from "../../translations/TranslationProvider";
import { EmptyState, ListFooter, ProblemState, Segmented, Waiting, useToaster } from "../../ui/components";
import { Badge, Button, Table } from "../../ui/primitives";
import { STAGE } from "./documentStages";
import { PAGE, ROW_LINK, STAGE_COLUMN, STAGE_INLINE, STAGE_LEGEND, STEP_LINK, TABLE_SURFACE, TOOLBAR } from "./indexingClasses";

type Filter = "ALL" | DocumentStage;

/**
 * Every document and how far it got along the chain, with the one step that moves it on. A document is
 * the unit people think in; its chunks, entries and vectors are on its own page.
 */
export function IndexedDocumentsTab({ workspaceId, onChanged }: { workspaceId: string; onChanged: () => void }) {
  const { t, plural } = useTranslation();
  const { notify } = useToaster();
  const mayManage = usePermissions().may(PERMISSIONS.automationManage);
  const documents = usePagedList((page) => indexOverviewApi.documents(workspaceId, page), [workspaceId]);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);

  if (documents.status === "loading") {
    return <Waiting label={t("index.documents.loading", "Loading documents")} lines={6} />;
  }
  if (documents.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={documents.problem}
        actions={
          <Button icon="refresh" onClick={documents.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }
  if (documents.items.length === 0) {
    return (
      <EmptyState
        title={t("index.documents.empty", "No documents yet")}
        description={t(
          "index.documents.emptyDescription",
          "Add a source and scan it; each file it captures appears here with how far it got.",
        )}
      />
    );
  }

  const publish = async (standing: DocumentStanding) => {
    if (standing.generation === null) {
      return;
    }
    setBusyId(standing.documentId);
    try {
      await indexOverviewApi.publish(workspaceId, standing.generation);
      notify({ tone: "good", title: t("index.documents.published", "{title} is searchable", { title: standing.title }) });
      documents.reload();
      onChanged();
    } catch (error) {
      const problem = describeProblem(error);
      notify({ tone: "error", title: problem.title, description: problem.detail ?? problem.description });
    } finally {
      setBusyId(null);
    }
  };

  const countOf = (stage: DocumentStage) => documents.items.filter((standing) => standing.stage === stage).length;
  const shown = filter === "ALL" ? documents.items : documents.items.filter((standing) => standing.stage === filter);
  const options = (["CAPTURED", "PROCESSED", "OUTDATED", "SEARCHABLE", "VECTORISED"] as DocumentStage[])
    .filter((stage) => countOf(stage) > 0)
    .map((stage) => ({ value: stage as Filter, label: STAGE[stage].label, count: countOf(stage) }));

  return (
    <div className={PAGE}>
      <div className={TOOLBAR}>
        <Segmented<Filter>
          label={t("index.documents.stage", "Stage")}
          value={filter}
          onChange={setFilter}
          options={[{ value: "ALL", label: t("index.filter.all", "All"), count: documents.items.length }, ...options]}
        />
      </div>
      <dl className={STAGE_LEGEND} aria-label={t("index.documents.legend", "What each stage means")}>
        {options.map((option) => {
          const stage = option.value as DocumentStage;
          return (
            <div key={stage}>
              <dt>
                <Badge tone={STAGE[stage].tone}>{STAGE[stage].label}</Badge>
              </dt>
              <dd>{STAGE[stage].meaning}</dd>
            </div>
          );
        })}
      </dl>
      <div className={TABLE_SURFACE}>
        <Table>
          <thead>
            <tr>
              <th scope="col">{t("index.column.document", "Document")}</th>
              <th scope="col" className={STAGE_COLUMN}>
                {t("index.documents.whereItStands", "Where it stands")}
              </th>
              <th scope="col" className="numeric">
                {t("index.documents.searchableEntries", "Searchable entries")}
              </th>
              <th scope="col" className="numeric">
                {t("index.documents.vectors", "Vectors")}
              </th>
              <th scope="col">
                <span className="sr-only">{t("index.documents.nextStep", "Next step")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((standing) => (
              <tr key={standing.documentId}>
                <td>
                  <Link to="/documents/$documentId" params={{ documentId: standing.documentId }} className={ROW_LINK}>
                    {standing.title}
                  </Link>
                  <div className="text-xs text-muted">
                    {t("index.documents.sourceVersion", "{source} · version {version}", {
                      source: standing.sourceName,
                      version: standing.versionNumber,
                    })}
                  </div>
                  <div className={STAGE_INLINE}>
                    <Badge tone={STAGE[standing.stage].tone}>{STAGE[standing.stage].label}</Badge>
                  </div>
                </td>
                <td className={STAGE_COLUMN} title={STAGE[standing.stage].meaning}>
                  <Badge tone={STAGE[standing.stage].tone}>{STAGE[standing.stage].label}</Badge>
                </td>
                <td className="numeric">
                  {standing.publishedGenerationId === null ? (
                    <span className="text-muted">
                      {standing.generation === null
                        ? "—"
                        : t("index.documents.noneOf", "0 of {total}", { total: formatNumber(standing.generation.entryCount) })}
                    </span>
                  ) : (
                    formatNumber(standing.searchableEntries)
                  )}
                </td>
                <td className="numeric">{standing.searchableVectors === 0 ? <span className="text-muted">—</span> : formatNumber(standing.searchableVectors)}</td>
                <td className="actions">
                  <NextStep standing={standing} mayManage={mayManage} busy={busyId === standing.documentId} onPublish={() => void publish(standing)} />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        <ListFooter
          shown={documents.items.length}
          counted={plural("index.documents.count", documents.items.length, {
            one: "{count} document",
            other: "{count} documents",
          })}
          hasMore={documents.hasMore}
          loadingMore={documents.loadingMore}
          moreProblem={documents.moreProblem}
          onLoadMore={documents.loadMore}
        />
      </div>
    </div>
  );
}

/** The one action that moves a document to the next stage; processing and vectorising happen on its page. */
function NextStep({ standing, mayManage, busy, onPublish }: { standing: DocumentStanding; mayManage: boolean; busy: boolean; onPublish: () => void }) {
  const { t } = useTranslation();
  if (standing.stage === "PROCESSED" && mayManage) {
    return (
      <Button variant="quiet" disabled={busy} onClick={onPublish}>
        {busy ? t("index.publishing", "Publishing…") : t("index.publish", "Publish")}
      </Button>
    );
  }
  const label: Record<DocumentStage, string | null> = {
    CAPTURED: t("index.next.process", "Process"),
    PROCESSED: t("index.next.open", "Open"),
    OUTDATED: t("index.next.processLatest", "Process latest"),
    SEARCHABLE: t("index.next.vectorise", "Vectorise"),
    VECTORISED: null,
  };
  const text = label[standing.stage];
  return (
    <Link to="/documents/$documentId" params={{ documentId: standing.documentId }} className={STEP_LINK}>
      {text ?? t("index.next.open", "Open")}
    </Link>
  );
}
