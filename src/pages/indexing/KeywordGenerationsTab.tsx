import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { usePermissions } from "../../access/PermissionsProvider";
import { PERMISSIONS } from "../../access/permissions";
import { formatNumber, shortIdentifier } from "../../application/format";
import { describeProblem } from "../../application/problems";
import { usePagedList } from "../../application/usePagedList";
import { pipelineApi, type IndexGeneration, type LexicalGenerationState } from "../../lib/pipeline";
import { translate } from "../../translations/translate";
import { useTranslation } from "../../translations/TranslationProvider";
import { ConfirmDialog, EmptyState, ListFooter, ProblemState, Segmented, Waiting, useToaster } from "../../ui/components";
import { Badge, Button, Table, type BadgeTone } from "../../ui/primitives";
import { PAGE, ROW_LINK, TABLE_SURFACE, TOOLBAR } from "./indexingClasses";

/** Blue is what search reads; amber is built and waiting; red was taken out of search. */
export const LEXICAL_TONE: Record<LexicalGenerationState, BadgeTone> = { PUBLISHED: "allow", READY: "warn", WITHDRAWN: "deny", PURGED: "neutral" };

/** A run's state in the words of what it means for search; getters, so each read is in the viewer's language. */
export const LEXICAL_LABEL: Record<LexicalGenerationState, string> = {
  get PUBLISHED() {
    return translate("index.lexical.published", "Searched");
  },
  get READY() {
    return translate("index.stage.processed", "Built, not published");
  },
  get WITHDRAWN() {
    return translate("index.lexical.withdrawn", "Withdrawn");
  },
  get PURGED() {
    return translate("index.lexical.purged", "Purged");
  },
};

type Filter = "ALL" | LexicalGenerationState;

/**
 * Every processing run's keyword entries (a keyword generation), newest first, with the publication and
 * purge each one allows. One run per document is published — that is the one search reads.
 */
export function KeywordGenerationsTab({ workspaceId, titles, onChanged }: { workspaceId: string; titles: Map<string, string>; onChanged: () => void }) {
  const { t, plural } = useTranslation();
  const { notify } = useToaster();
  const mayManage = usePermissions().may(PERMISSIONS.automationManage);
  const generations = usePagedList((page) => pipelineApi.indexGenerations(workspaceId, page), [workspaceId]);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [purging, setPurging] = useState<IndexGeneration | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (generations.status === "loading") {
    return <Waiting label={t("index.keywords.loading", "Loading keyword generations")} lines={5} />;
  }
  if (generations.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={generations.problem}
        actions={
          <Button icon="refresh" onClick={generations.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }
  if (generations.items.length === 0) {
    return (
      <EmptyState
        title={t("index.keywords.empty", "Nothing indexed yet")}
        description={t(
          "index.keywords.emptyDescription",
          "Process a document, or a whole source, to build its first keyword generation.",
        )}
      />
    );
  }

  const act = async (generation: IndexGeneration, action: () => Promise<IndexGeneration>, done: string) => {
    setBusyId(generation.jobId);
    try {
      const saved = await action();
      generations.replaceItem((candidate) => candidate.jobId === saved.jobId, saved);
      notify({ tone: "good", title: done });
      onChanged();
    } catch (error) {
      const problem = describeProblem(error);
      notify({ tone: "error", title: problem.title, description: problem.detail ?? problem.description });
      if (problem.kind === "conflict") {
        generations.reload();
      }
    } finally {
      setBusyId(null);
    }
  };

  const shown = filter === "ALL" ? generations.items : generations.items.filter((generation) => generation.state === filter);
  const countOfState = (state: LexicalGenerationState) => generations.items.filter((generation) => generation.state === state).length;

  return (
    <div className={PAGE}>
      <div className={TOOLBAR}>
        <Segmented<Filter>
          label={t("index.keywords.state", "State")}
          value={filter}
          onChange={setFilter}
          options={[
            { value: "ALL", label: t("index.filter.all", "All"), count: generations.items.length },
            { value: "PUBLISHED", label: LEXICAL_LABEL.PUBLISHED, count: countOfState("PUBLISHED") },
            { value: "READY", label: LEXICAL_LABEL.READY, count: countOfState("READY") },
            { value: "WITHDRAWN", label: LEXICAL_LABEL.WITHDRAWN, count: countOfState("WITHDRAWN") },
            { value: "PURGED", label: LEXICAL_LABEL.PURGED, count: countOfState("PURGED") },
          ]}
        />
        <span className="text-xs text-muted">
          {t(
            "index.keywords.latestOnly",
            "Only the latest version of a document can be published; publishing it sets the one before back to built.",
          )}
        </span>
      </div>
      <div className={TABLE_SURFACE}>
        <Table>
          <thead>
            <tr>
              <th scope="col">{t("index.column.document", "Document")}</th>
              <th scope="col">{t("index.keywords.run", "Processing run")}</th>
              <th scope="col">{t("index.keywords.forSearch", "For search")}</th>
              <th scope="col" className="numeric">
                {t("index.chain.entries", "Keyword entries")}
              </th>
              <th scope="col">
                <span className="sr-only">{t("common.actions", "Actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((generation) => {
              const busy = busyId === generation.jobId;
              return (
                <tr key={generation.jobId}>
                  <td>
                    <Link to="/documents/$documentId" params={{ documentId: generation.documentId }} search={{ version: generation.versionId }} className={ROW_LINK}>
                      {titles.get(generation.documentId) ?? shortIdentifier(generation.documentId)}
                    </Link>
                  </td>
                  <td>
                    <span className="numeric text-xs">{shortIdentifier(generation.jobId)}</span>
                    <div className="text-xs text-muted">
                      {t("index.keywords.profileRevision", "processing profile revision {revision}", {
                        revision: generation.profileRevision,
                      })}
                    </div>
                  </td>
                  <td>
                    <Badge tone={LEXICAL_TONE[generation.state]}>{LEXICAL_LABEL[generation.state]}</Badge>
                  </td>
                  <td className="numeric">{formatNumber(generation.entryCount)}</td>
                  <td className="actions">
                    {mayManage && generation.state !== "PURGED" && (
                      <>
                        {generation.state !== "PUBLISHED" && (
                          <Button
                            variant="quiet"
                            iconOnly
                            icon="trash"
                            aria-label={t("index.keywords.purgeGeneration", "Purge generation {identifier}", {
                              identifier: shortIdentifier(generation.jobId),
                            })}
                            title={t("index.purge", "Purge")}
                            disabled={busy}
                            onClick={() => {
                              setPurging(generation);
                            }}
                          />
                        )}
                        {generation.state === "PUBLISHED" ? (
                          <Button
                            variant="quiet"
                            disabled={busy}
                            onClick={() =>
                              void act(
                                generation,
                                () => pipelineApi.publishGeneration(workspaceId, generation, false),
                                t("index.withdrawnNotice", "Withdrawn from search"),
                              )
                            }
                          >
                            {t("index.withdraw", "Withdraw")}
                          </Button>
                        ) : (
                          <Button
                            variant="quiet"
                            disabled={busy}
                            onClick={() =>
                              void act(
                                generation,
                                () => pipelineApi.publishGeneration(workspaceId, generation, true),
                                t("index.publishedNotice", "Published"),
                              )
                            }
                          >
                            {t("index.publish", "Publish")}
                          </Button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <ListFooter
          shown={generations.items.length}
          counted={plural("index.generations.count", generations.items.length, {
            one: "{count} generation",
            other: "{count} generations",
          })}
          hasMore={generations.hasMore}
          loadingMore={generations.loadingMore}
          moreProblem={generations.moreProblem}
          onLoadMore={generations.loadMore}
        />
      </div>
      <ConfirmDialog
        open={purging !== null}
        title={t("index.keywords.purgeTitle", "Purge generation")}
        confirmLabel={t("index.purge", "Purge")}
        destructive
        onConfirm={() => {
          if (purging !== null) {
            const target = purging;
            setPurging(null);
            void act(target, () => pipelineApi.purgeGeneration(workspaceId, target), t("index.purgedNotice", "Generation purged"));
          }
        }}
        onCancel={() => {
          setPurging(null);
        }}
      >
        <p>
          {t(
            "index.keywords.purgeDescription",
            "Its chunks and entries are deleted for good; the generation stays as a purged record. It is refused while vectors still reference it — purge those first.",
          )}
        </p>
      </ConfirmDialog>
    </div>
  );
}
