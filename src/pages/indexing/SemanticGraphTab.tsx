import { useEffect, useState } from "react";
import { usePermissions } from "../../access/PermissionsProvider";
import { PERMISSIONS } from "../../access/permissions";
import { shortIdentifier } from "../../application/format";
import { describeProblem } from "../../application/problems";
import { usePagedList } from "../../application/usePagedList";
import { useResource } from "../../application/useResource";
import { graphApi, type GraphDefinition, type GraphGeneration } from "../../lib/graph";
import { useTranslation } from "../../translations/TranslationProvider";
import { EmptyState, ListFooter, ProblemState, Waiting, useToaster } from "../../ui/components";
import { Badge, Button, Checkbox, Field, Input, Select, Table } from "../../ui/primitives";
import { GraphBuildSection } from "./GraphBuildSection";
import { GraphOriginalLink } from "./GraphOriginalLink";
import { GraphEvidenceTable } from "./GraphEvidenceTable";
import { PAGE, TABLE_SURFACE, TOOLBAR, TOOLBAR_ACTIONS } from "./indexingClasses";

export function SemanticGraphTab({
  workspaceId,
  titles,
}: {
  workspaceId: string;
  titles: Map<string, string>;
}) {
  const { t } = useTranslation();
  const permissions = usePermissions();
  const mayBuild =
    permissions.may(PERMISSIONS.documentWrite) && permissions.may(PERMISSIONS.automationRead);
  const generations = usePagedList(
    (page) => graphApi.generations(workspaceId, page),
    [workspaceId],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { notify } = useToaster();
  const selected =
    generations.status === "ready"
      ? (generations.items.find((generation) => generation.id === selectedId) ??
        generations.items.find((generation) => generation.state === "PUBLISHED") ??
        null)
      : null;
  const running =
    generations.status === "ready" &&
    generations.items.some((generation) => ["RUNNING", "QUEUED"].includes(generation.job.status));
  useEffect(() => {
    if (!running) {
      return;
    }
    const timer = window.setInterval(generations.reload, 3000);
    return () => {
      window.clearInterval(timer);
    };
  }, [running, generations.reload]);

  const change = async (generation: GraphGeneration, action: "cancel" | "retry" | "withdraw") => {
    setBusy(true);
    try {
      await graphApi.change(workspaceId, generation, action);
      generations.reload();
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
    <div className={PAGE}>
      {mayBuild && (
        <GraphBuildSection
          workspaceId={workspaceId}
          onSubmitted={(generation) => {
            setSelectedId(generation.id);
            generations.reload();
          }}
        />
      )}
      {generations.status === "loading" && (
        <Waiting label={t("graph.loading", "Loading semantic graph generations")} lines={4} />
      )}
      {generations.status === "failed" && (
        <ProblemState layout="section" problem={generations.problem} />
      )}
      {generations.status === "ready" && (
        <>
          <div className={TOOLBAR}>
            <Field label={t("graph.generation", "Graph generation")}>
              <Select
                value={selected?.id ?? ""}
                onChange={(event) => {
                  setSelectedId(event.target.value);
                }}
              >
                <option value="" disabled>
                  {t("graph.choose", "Choose a generation")}
                </option>
                {generations.items.map((generation) => (
                  <option key={generation.id} value={generation.id}>
                    {shortIdentifier(generation.id)} · {generation.state} · {generation.job.status}
                  </option>
                ))}
              </Select>
            </Field>
            <div className={TOOLBAR_ACTIONS}>
              <Button variant="quiet" icon="refresh" onClick={generations.reload}>
                {t("common.refresh", "Refresh")}
              </Button>
              {mayBuild && selected?.state === "PUBLISHED" && (
                <Button
                  variant="quiet"
                  disabled={busy}
                  onClick={() => {
                    void change(selected, "withdraw");
                  }}
                >
                  {t("graph.withdraw", "Withdraw")}
                </Button>
              )}
              {mayBuild &&
                selected !== null &&
                ["QUEUED", "RUNNING"].includes(selected.job.status) && (
                  <Button
                    variant="quiet"
                    disabled={busy}
                    onClick={() => {
                      void change(selected, "cancel");
                    }}
                  >
                    {t("common.cancel", "Cancel")}
                  </Button>
                )}
              {mayBuild && selected?.job.status === "FAILED" && (
                <Button
                  variant="quiet"
                  disabled={busy}
                  onClick={() => {
                    void change(selected, "retry");
                  }}
                >
                  {t("common.tryAgain", "Try again")}
                </Button>
              )}
            </div>
          </div>
          <ListFooter
            shown={generations.items.length}
            counted={t("graph.generationCount", "{count} generations", {
              count: generations.items.length,
            })}
            hasMore={generations.hasMore}
            loadingMore={generations.loadingMore}
            moreProblem={generations.moreProblem}
            onLoadMore={generations.loadMore}
          />
          {selected === null && (
            <EmptyState
              title={t("graph.empty", "No published semantic graph")}
              description={t(
                "graph.emptyHelp",
                "Process documents with the relations step, then select their resolution contexts and build a generation.",
              )}
            />
          )}
          {selected?.state === "PUBLISHED" && (
            <GraphEntityBrowser
              key={`${selected.id}:${selected.revision}`}
              workspaceId={workspaceId}
              generationId={selected.id}
              titles={titles}
            />
          )}
          {selected !== null && selected.state !== "PUBLISHED" && (
            <p role="status">
              {t(
                "graph.notPublished",
                "This generation is not available for reading. Its job state is {state}.",
                { state: selected.job.status },
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function GraphEntityBrowser({
  workspaceId,
  generationId,
  titles,
}: {
  workspaceId: string;
  generationId: string;
  titles: Map<string, string>;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [enteredQuery, setEnteredQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<GraphDefinition | null>(null);
  const result = useResource(
    () => graphApi.entities(workspaceId, generationId, query, { limit: 50, offset }),
    [workspaceId, generationId, query, offset],
  );
  return (
    <section className={PAGE} aria-label={t("graph.entities", "Entity definitions")}>
      <form
        className={TOOLBAR}
        onSubmit={(event) => {
          event.preventDefault();
          setSelected(null);
          setOffset(0);
          setQuery(enteredQuery);
        }}
      >
        <Field label={t("graph.find", "Find an entity")}>
          <Input
            value={enteredQuery}
            maxLength={200}
            onChange={(event) => {
              setEnteredQuery(event.target.value);
            }}
          />
        </Field>
        <Button type="submit">{t("common.search", "Search")}</Button>
      </form>
      {result.status === "loading" && (
        <Waiting label={t("graph.entitiesLoading", "Loading entities")} lines={4} />
      )}
      {result.status === "failed" && <ProblemState layout="section" problem={result.problem} />}
      {result.status === "ready" && (
        <>
          <p className="text-sm text-secondary" role="status">
            {t(
              "graph.coverage",
              "{files} documents / {relations} with relation extraction / {partial} partial",
              {
                files: result.data.coverage.visibleFiles,
                relations: result.data.coverage.relationFiles,
                partial: result.data.coverage.partialFiles,
              },
            )}
            {result.data.coverage.stale &&
              ` · ${t("graph.stale", "Newer document versions exist")}`}
          </p>
          <div className={TABLE_SURFACE} aria-busy={result.reloading}>
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t("graph.declaration", "Entity")}</th>
                  <th scope="col">{t("graph.group", "Source context")}</th>
                  <th scope="col">{t("graph.evidence.original", "Original")}</th>
                </tr>
              </thead>
              <tbody>
                {result.data.items.map((definition) => (
                  <tr key={definition.id}>
                    <td>
                      <Button
                        variant="quiet"
                        disabled={result.reloading}
                        onClick={() => {
                          setSelected(definition);
                        }}
                      >
                        {definition.key || definition.qualifiedName}
                      </Button>
                      <div className="text-xs text-muted">{definition.kind}</div>
                    </td>
                    <td>{definition.group}</td>
                    <td>
                      <GraphOriginalLink
                        evidence={definition.evidence}
                        title={titles.get(definition.evidence.documentId)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          {result.data.items.length === 0 && (
            <p>{t("graph.noEntities", "No entities match within this generation's coverage.")}</p>
          )}
          <div className={TOOLBAR_ACTIONS}>
            <Button
              variant="quiet"
              disabled={offset === 0 || result.reloading}
              onClick={() => {
                setSelected(null);
                setOffset(Math.max(0, offset - 50));
              }}
            >
              {t("common.previous", "Previous")}
            </Button>
            <Button
              variant="quiet"
              disabled={!result.data.hasMore || result.reloading || result.data.items.length === 0}
              onClick={() => {
                setSelected(null);
                setOffset(offset + result.data.items.length);
              }}
            >
              {t("common.next", "Next")}
            </Button>
          </div>
        </>
      )}
      {selected !== null && (
        <GraphEntityEvidence
          key={selected.id}
          workspaceId={workspaceId}
          generationId={generationId}
          definition={selected}
          titles={titles}
        />
      )}
    </section>
  );
}

function GraphEntityEvidence({
  workspaceId,
  generationId,
  definition,
  titles,
}: {
  workspaceId: string;
  generationId: string;
  definition: GraphDefinition;
  titles: Map<string, string>;
}) {
  const { t } = useTranslation();
  const [direction, setDirection] = useState<"references" | "dependencies">("references");
  const [includeUncertain, setIncludeUncertain] = useState(false);
  const [offset, setOffset] = useState(0);
  const result = useResource(
    () =>
      graphApi.edges(workspaceId, generationId, definition.id, direction, includeUncertain, {
        limit: 50,
        offset,
      }),
    [workspaceId, generationId, definition.id, direction, includeUncertain, offset],
  );
  return (
    <section className={PAGE} aria-label={t("graph.entityEvidence", "Entity evidence")}>
      <h3 className="text-base break-all">{definition.key || definition.qualifiedName}</h3>
      <code className="text-sm break-all">{definition.description}</code>
      <div className={TOOLBAR}>
        <Field label={t("graph.direction", "Evidence")}>
          <Select
            value={direction}
            onChange={(event) => {
              setOffset(0);
              setDirection(event.target.value as "references" | "dependencies");
            }}
          >
            <option value="references">{t("graph.usages", "Usages / dependents")}</option>
            <option value="dependencies">{t("graph.dependencies", "Dependencies")}</option>
          </Select>
        </Field>
        <Checkbox
          checked={includeUncertain}
          onChange={(event) => {
            setOffset(0);
            setIncludeUncertain(event.target.checked);
          }}
          label={t("graph.uncertain", "Include uncertain evidence")}
          hint={t(
            "graph.uncertainHelp",
            "Ambiguous candidates and unresolved outgoing facts are separate from definite usages.",
          )}
        />
      </div>
      {result.status === "loading" && (
        <Waiting label={t("graph.evidenceLoading", "Loading evidence")} lines={3} />
      )}
      {result.status === "failed" && <ProblemState layout="section" problem={result.problem} />}
      {result.status === "ready" && (
        <div aria-busy={result.reloading}>
          {result.data.items.length > 0 ? (
            <GraphEvidenceTable edges={result.data.items} titles={titles} />
          ) : (
            <p>
              {t(
                "graph.noEvidence",
                "No matching evidence within this generation's coverage. Missing analysis does not prove zero usages.",
              )}
            </p>
          )}
          {result.data.hasMore && (
            <Badge tone="warn">{t("graph.truncated", "More evidence is available")}</Badge>
          )}
          <div className={TOOLBAR_ACTIONS}>
            <Button
              variant="quiet"
              disabled={offset === 0 || result.reloading}
              onClick={() => {
                setOffset(Math.max(0, offset - 50));
              }}
            >
              {t("common.previous", "Previous")}
            </Button>
            <Button
              variant="quiet"
              disabled={!result.data.hasMore || result.reloading || result.data.items.length === 0}
              onClick={() => {
                setOffset(offset + result.data.items.length);
              }}
            >
              {t("common.next", "Next")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
