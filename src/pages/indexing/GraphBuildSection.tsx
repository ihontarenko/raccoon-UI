import { useState } from "react";
import { formatBytes, shortIdentifier } from "../../application/format";
import { describeProblem } from "../../application/problems";
import { usePagedList } from "../../application/usePagedList";
import {
  graphApi,
  type GraphForecast,
  type GraphPreview,
  type GraphGeneration,
  type GraphRequest,
} from "../../lib/graph";
import { useTranslation } from "../../translations/TranslationProvider";
import { ListFooter, ProblemState, Waiting, useToaster } from "../../ui/components";
import { Button, Checkbox, Input, Table } from "../../ui/primitives";
import { GraphPreviewView } from "../documents/pipeline/PreparationPreview";
import { PAGE, TABLE_SURFACE, TOOLBAR_ACTIONS } from "./indexingClasses";

/** A graph starts from explicit relation runs and explicit source contexts, after a bounded forecast. */
export function GraphBuildSection({
  workspaceId,
  onSubmitted,
  initialSelection,
}: {
  workspaceId: string;
  initialSelection?: Record<string, string>;
  onSubmitted: (generation: GraphGeneration) => void;
}) {
  const { t } = useTranslation();
  const { notify } = useToaster();
  const candidates = usePagedList((page) => graphApi.candidates(workspaceId, page), [workspaceId]);
  const [selection, setSelection] = useState<Record<string, string>>(initialSelection ?? {});
  const [forecast, setForecast] = useState<GraphForecast | null>(null);
  const [preview, setPreview] = useState<GraphPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const groups = new Map<string, string[]>();
  for (const [jobId, group] of Object.entries(selection)) {
    groups.set(group, [...(groups.get(group) ?? []), jobId]);
  }
  const request: GraphRequest = {
    groups: [...groups].map(([name, relationJobIds]) => ({ name, relationJobIds })),
  };

  const act = async (action: "submit" | "forecast" | "preview") => {
    setBusy(true);
    try {
      if (action === "submit") {
        const generation = await graphApi.submit(
          workspaceId,
          request,
          `semantic-graph:${crypto.randomUUID()}`,
        );
        onSubmitted(generation);
      } else if (action === "preview") {
        setPreview(await graphApi.preview(workspaceId, request));
      } else {
        setForecast(await graphApi.forecast(workspaceId, request));
      }
    } catch (error) {
      const problem = describeProblem(error);
      notify({
        tone: "error",
        title: problem.title,
        description: problem.detail ?? problem.description,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <details
      open={initialSelection !== undefined ? true : undefined}
      className="border-b border-line pb-4"
    >
      <summary className="cursor-pointer font-semibold">
        {t("graph.buildTitle", "Build a semantic graph")}
      </summary>
      <div className={`${PAGE} pt-4`}>
        <p className="text-sm text-secondary">
          {t(
            "graph.buildHelp",
            "Select one relation run per document. References resolve within the same context. Providers determine which facts are available. No model is called.",
          )}
        </p>
        {candidates.status === "loading" && (
          <Waiting label={t("graph.candidatesLoading", "Loading relation runs")} lines={3} />
        )}
        {candidates.status === "failed" && (
          <ProblemState layout="section" problem={candidates.problem} />
        )}
        {candidates.status === "ready" && (
          <>
            {candidates.items.length === 0 ? (
              <p>
                {t(
                  "graph.noCandidates",
                  "No relation runs are ready. Enable the relations step in a processing profile, then process the documents.",
                )}
              </p>
            ) : (
              <div className={TABLE_SURFACE}>
                <Table>
                  <thead>
                    <tr>
                      <th scope="col">
                        {t("graph.declarationDocument", "Document / relation run")}
                      </th>
                      <th scope="col">{t("graph.group", "Source context")}</th>
                      <th scope="col">{t("graph.facts", "Facts")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.items.map((candidate) => (
                      <tr key={candidate.jobId}>
                        <td>
                          <Checkbox
                            label={candidate.title}
                            checked={candidate.jobId in selection}
                            disabled={busy}
                            onChange={(event) => {
                              const next = { ...selection };
                              if (event.target.checked) {
                                for (const previous of candidates.items) {
                                  if (previous.documentId === candidate.documentId) {
                                    delete next[previous.jobId];
                                  }
                                }
                                next[candidate.jobId] = `source-${candidate.sourceId.slice(0, 8)}`;
                              } else {
                                delete next[candidate.jobId];
                              }
                              setSelection(next);
                              setForecast(null);
                              setPreview(null);
                            }}
                          />
                          <div className="text-xs text-muted">
                            {shortIdentifier(candidate.jobId)} · {candidate.providers.join(", ")}
                          </div>
                        </td>
                        <td>
                          <Input
                            aria-label={t("graph.contextFor", "Source context for {title}", {
                              title: candidate.title,
                            })}
                            value={
                              selection[candidate.jobId] ??
                              `source-${candidate.sourceId.slice(0, 8)}`
                            }
                            disabled={busy || !(candidate.jobId in selection)}
                            maxLength={80}
                            pattern="[A-Za-z0-9._:-]{1,80}"
                            onChange={(event) => {
                              setSelection({ ...selection, [candidate.jobId]: event.target.value });
                              setForecast(null);
                            }}
                          />
                        </td>
                        <td className="numeric">
                          {candidate.declarations} / {candidate.references}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
            <ListFooter
              shown={candidates.items.length}
              counted={t("graph.candidateCount", "{count} relation runs", {
                count: candidates.items.length,
              })}
              hasMore={candidates.hasMore}
              loadingMore={candidates.loadingMore}
              moreProblem={candidates.moreProblem}
              onLoadMore={candidates.loadMore}
            />
          </>
        )}
        {forecast !== null && (
          <p role="status" className="text-sm">
            {t(
              "graph.forecast",
              "{files} documents / {bytes} original bytes / {references} references",
              {
                files: forecast.files,
                bytes: formatBytes(forecast.originalBytes),
                references: forecast.references,
              },
            )}
          </p>
        )}
        {preview !== null && (
          <section className="grid min-w-0 gap-3 border-t border-line pt-4">
            <h3 className="font-semibold">
              {t("preparation.graphPreview", "Graph preview ? not saved")}
            </h3>
            <GraphPreviewView result={preview} />
          </section>
        )}
        <div className={TOOLBAR_ACTIONS}>
          <Button
            variant="quiet"
            disabled={busy || Object.keys(selection).length === 0}
            onClick={() => void act("preview")}
          >
            {t("preparation.preview", "Preview before saving")}
          </Button>
          <Button
            variant="quiet"
            disabled={busy || Object.keys(selection).length === 0}
            onClick={() => {
              void act("forecast");
            }}
          >
            {t("graph.forecastAction", "Check scope")}
          </Button>
          <Button
            disabled={busy || forecast === null}
            onClick={() => {
              void act("submit");
            }}
          >
            {t("graph.buildAction", "Build graph")}
          </Button>
          <Button variant="quiet" disabled={busy} onClick={candidates.reload}>
            {t("common.refresh", "Refresh")}
          </Button>
        </div>
      </div>
    </details>
  );
}
