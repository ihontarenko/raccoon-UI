import { useState } from "react";
import { shortIdentifier } from "../../../application/format";
import { useResource } from "../../../application/useResource";
import { usePolling } from "../../../application/usePolling";
import { usePagedList } from "../../../application/usePagedList";
import { pipelineApi, type ProcessingRun } from "../../../lib/pipeline";
import { graphApi, type GraphGeneration } from "../../../lib/graph";
import { useTranslation } from "../../../translations/TranslationProvider";
import { EmptyState, ListFooter, ProblemState, Waiting, useToaster } from "../../../ui/components";
import { Button, Field, Select, Table } from "../../../ui/primitives";
import { GraphBuildSection } from "../../indexing/GraphBuildSection";
import { GraphEvidenceTable } from "../../indexing/GraphEvidenceTable";
import { SampleNotice } from "../pipeline/PreparationPreview";

export function RelationsTab({
  workspaceId,
  documentId,
  versionId,
  runs,
  mayManage,
  onPrepare,
}: {
  workspaceId: string;
  documentId: string;
  versionId: string;
  runs: ProcessingRun[];
  mayManage: boolean;
  onPrepare: () => void;
}) {
  const { t } = useTranslation();
  const usable = runs.filter(
    (run) => run.job.status === "SUCCEEDED" && run.preparation.steps.includes("relations"),
  );
  const [selectedId, setSelectedId] = useState("");
  const run = usable.find((item) => item.job.id === selectedId) ?? usable[0];
  const result = useResource(
    () =>
      run
        ? pipelineApi.documentRelations(workspaceId, documentId, versionId, run.job.id)
        : Promise.resolve(null),
    [workspaceId, documentId, versionId, run?.job.id],
  );
  const [building, setBuilding] = useState<GraphGeneration | null>(null);
  const { notify } = useToaster();
  usePolling(
    building !== null,
    () => {
      if (building === null) return;
      void graphApi
        .generation(workspaceId, building.id)
        .then((next) => {
          if (["SUCCEEDED", "FAILED", "CANCELLED"].includes(next.job.status)) {
            setBuilding(null);
            result.reload();
            notify({
              tone: next.job.status === "SUCCEEDED" ? "good" : "error",
              title:
                next.job.status === "SUCCEEDED"
                  ? t("preparation.graphReady", "Graph is ready")
                  : t("preparation.graphFailed", "Graph did not finish"),
            });
          } else setBuilding(next);
        })
        .catch(() => {
          setBuilding(null);
          result.reload();
        });
    },
    building,
    3000,
  );
  if (!run)
    return (
      <EmptyState
        title={t("preparation.noRelations", "No relations prepared for this version")}
        description={t(
          "preparation.prepareRelationsHelp",
          "Choose Relations under Manage. You can parse the original or use a saved parse. Lexical indexing is optional.",
        )}
        action={<Button onClick={onPrepare}>{t("preparation.manage", "Manage")}</Button>}
      />
    );
  return (
    <div className="grid min-w-0 gap-5">
      <Field label={t("preparation.relationRun", "Saved relation run")}>
        <Select value={run.job.id} onChange={(event) => setSelectedId(event.target.value)}>
          {usable.map((item) => (
            <option key={item.job.id} value={item.job.id}>
              {shortIdentifier(item.job.id)} · {item.parserId}
            </option>
          ))}
        </Select>
      </Field>
      {result.status === "loading" && (
        <Waiting
          label={t("preparation.loadingRelations", "Loading saved relation facts")}
          lines={3}
        />
      )}
      {result.status === "failed" && <ProblemState layout="section" problem={result.problem} />}
      {result.status === "ready" && result.data !== null && (
        <>
          <p className="text-sm text-secondary">
            {t(
              "preparation.factsHelp",
              "These are saved entities and relation assertions selected by the preparation rules. A graph resolves their targets inside the selected document context.",
            )}
          </p>
          {result.data.providers.map((provider) => (
            <details key={provider.id} className="border-b border-line pb-3">
              <summary className="cursor-pointer font-semibold">
                {provider.id} · {provider.entities.total} / {provider.relations.total}
              </summary>
              <SampleNotice sample={provider.entities} />
              <div className="overflow-x-auto">
                <Table>
                  <thead>
                    <tr>
                      <th scope="col">{t("graph.entity", "Entity")}</th>
                      <th scope="col">{t("graph.kind", "Kind")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {provider.entities.items.map((entity) => (
                      <tr key={entity.id}>
                        <td className="break-all">{entity.qualifiedName || entity.name}</td>
                        <td>{entity.kind}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              <SampleNotice sample={provider.relations} />
              <div className="overflow-x-auto">
                <Table>
                  <thead>
                    <tr>
                      <th scope="col">{t("preparation.target", "Target")}</th>
                      <th scope="col">{t("preparation.relations", "Relations")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {provider.relations.items.map((relation) => (
                      <tr key={relation.id}>
                        <td className="break-all">{relation.writtenTarget}</td>
                        <td>
                          {relation.role} · {relation.origin}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </details>
          ))}
          {result.data.generationIds.length === 0 ? (
            <p className="text-sm text-secondary">
              {t(
                "preparation.noGraphYet",
                "These facts have not been published in a graph yet. Build a graph below to resolve them with other documents.",
              )}
            </p>
          ) : (
            <PublishedRelations
              key={run.job.id}
              workspaceId={workspaceId}
              documentId={documentId}
              generationIds={result.data.generationIds}
            />
          )}
        </>
      )}
      {building !== null && (
        <p role="status">
          {t(
            "preparation.graphBuilding",
            "Graph queued or building. Results will appear here when it finishes.",
          )}
        </p>
      )}
      {mayManage && building === null && (
        <GraphBuildSection
          key={run.job.id}
          workspaceId={workspaceId}
          initialSelection={{ [run.job.id]: "document-context" }}
          onSubmitted={setBuilding}
        />
      )}
    </div>
  );
}

function PublishedRelations({
  workspaceId,
  documentId,
  generationIds,
}: {
  workspaceId: string;
  documentId: string;
  generationIds: string[];
}) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState(generationIds[0]);
  const generationId = generationIds.includes(selectedId) ? selectedId : generationIds[0];
  const relations = usePagedList(
    async (page) =>
      (await graphApi.documentRelations(workspaceId, generationId, documentId, page)).items,
    [workspaceId, generationId, documentId],
  );
  return (
    <section className="grid min-w-0 gap-4 border-t border-line pt-4">
      <Field label={t("preparation.publishedGraph", "Published graph")}>
        <Select value={generationId} onChange={(event) => setSelectedId(event.target.value)}>
          {generationIds.map((id) => (
            <option key={id} value={id}>
              {shortIdentifier(id)}
            </option>
          ))}
        </Select>
      </Field>
      <p className="text-xs text-secondary">
        {t(
          "preparation.incomingOutgoing",
          "Incoming and outgoing relations of this document in the selected graph.",
        )}
      </p>
      {relations.status === "loading" ? (
        <Waiting
          label={t("preparation.loadingRelations", "Loading saved relation facts")}
          lines={3}
        />
      ) : relations.status === "failed" ? (
        <ProblemState layout="section" problem={relations.problem} />
      ) : (
        <>
          <GraphEvidenceTable edges={relations.items} titles={new Map()} />
          <ListFooter
            shown={relations.items.length}
            counted={t("preparation.relationCount", "{count} relations", {
              count: relations.items.length,
            })}
            hasMore={relations.hasMore}
            loadingMore={relations.loadingMore}
            moreProblem={relations.moreProblem}
            onLoadMore={relations.loadMore}
          />
        </>
      )}
    </section>
  );
}
