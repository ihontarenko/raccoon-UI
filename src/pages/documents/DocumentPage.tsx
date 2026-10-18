import { Link, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { usePermissions } from "../../access/PermissionsProvider";
import { PERMISSIONS } from "../../access/permissions";
import type { DocumentSearch, DocumentTab } from "../../application/routeTabs";
import { labelOfCode } from "../../application/format";
import { JOB_STATUSES } from "../jobs/jobLabels";
import { describeProblem } from "../../application/problems";
import { useReadySession } from "../../application/session";
import { usePageTitle } from "../../application/usePageTitle";
import { usePolling } from "../../application/usePolling";
import { useResource } from "../../application/useResource";
import { useWorkspaceActivity } from "../../application/WorkspaceActivityProvider";
import { api } from "../../lib/api";
import {
  pipelineApi,
  submissionKey,
  type ProcessingProfile,
  type ProcessingRun,
  type ProcessingRequest,
  type VectorGeneration,
} from "../../lib/pipeline";
import { useTranslation } from "../../translations/TranslationProvider";
import { PageHeader, ProblemState, TabPanel, Tabs, Waiting, useToaster } from "../../ui/components";
import { Badge, Button, Select } from "../../ui/primitives";
import { VectoriseDialog } from "../indexing/VectoriseDialog";
import { RemoveDocumentButton, RemovedDocumentNotice } from "./DocumentRemoval";
import { DocumentOriginStrip } from "./DocumentOriginStrip";
import { generationOfVersion, loadDocumentPipeline } from "./documentPipeline";
import { PipelineStrip } from "./pipeline/PipelineStrip";
import { ManagementTab } from "./tabs/ManagementTab";
import { RelationsTab } from "./tabs/RelationsTab";
import { ProfileQuickSettings } from "../profiles/ProfileQuickSettings";
import { ChunksTab } from "./tabs/ChunksTab";
import { JournalTab } from "./tabs/JournalTab";
import { TraceTab } from "./tabs/TraceTab";
import { OriginTab } from "./tabs/OriginTab";
import { ParsedTextTab } from "./tabs/ParsedTextTab";
import { ReadTab, type ReadingAddress } from "./tabs/ReadTab";
import { VersionsTab } from "./tabs/VersionsTab";
import { CRUMB, EXTERNAL_IDENTIFIER, REMOVAL_NOTICE } from "./documentPageClasses";
import { useAddressChange } from "../../application/useAddressChange";

const TERMINAL = new Set(["SUCCEEDED", "FAILED", "CANCELLED"]);

/**
 * One document, its preparation runs and their independent outputs: parse, chunks, lexical entries,
 * selected relations and published graphs. Preparation does not require publication in search.
 */
export function DocumentPage() {
  const { workspace } = useReadySession();
  const workspaceId = workspace?.id ?? "";
  const { documentId } = useParams({ strict: false }) as { documentId: string };
  const search = useSearch({ strict: false }) as DocumentSearch;
  const changeAddress = useAddressChange();
  const permissions = usePermissions();
  const { notify } = useToaster();
  const { t, plural } = useTranslation();
  const mayReadAutomation = permissions.may(PERMISSIONS.automationRead);
  const mayReadSources = permissions.may(PERMISSIONS.sourceRead);
  const [refreshKey, setRefreshKey] = useState(0);
  const [processing, setProcessing] = useState<ProcessingRun | null>(null);
  const [vectorising, setVectorising] = useState<VectorGeneration | null>(null);
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false);
  const [vectoriseOpen, setVectoriseOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busy, setBusy] = useState(false);

  const pipeline = useResource(
    () => loadDocumentPipeline(workspaceId, documentId, mayReadAutomation),
    [workspaceId, documentId, mayReadAutomation, refreshKey],
  );
  const source = useResource(
    () =>
      pipeline.status === "ready" && mayReadSources
        ? api.getSource(workspaceId, pipeline.data.document.sourceId)
        : Promise.resolve(null),
    [
      workspaceId,
      pipeline.status === "ready" ? pipeline.data.document.sourceId : null,
      mayReadSources,
    ],
  );
  const selectedVersionId =
    pipeline.status === "ready"
      ? (pipeline.data.versions.find((item) => item.id === search.version)?.id ??
        pipeline.data.document.latestVersionId)
      : null;
  const runHistory = useResource(
    () =>
      selectedVersionId
        ? pipelineApi.processingHistory(workspaceId, documentId, selectedVersionId)
        : Promise.resolve([]),
    [workspaceId, documentId, selectedVersionId, refreshKey],
  );
  usePageTitle(
    pipeline.status === "ready"
      ? pipeline.data.document.title
      : t("documents.column.document", "Document"),
  );

  const refresh = () => {
    setRefreshKey((current) => current + 1);
  };

  // A run queued anywhere — this page, a source's automatic preparation, a bulk run — is seen through the shell's
  // activity, so the page can say "queued, waiting for the worker" instead of looking finished. When that job
  // leaves the list it has ended, and the page reads again what it produced.
  const { activity, refresh: refreshActivity } = useWorkspaceActivity();
  const pendingJob =
    activity === null
      ? null
      : ([...activity.running, ...activity.queued].find(
          (job) => job.work === "PROCESSING" && job.documentId === documentId,
        ) ?? null);
  const previousPendingJobId = useRef<string | null>(null);
  useEffect(() => {
    const pendingJobId = pendingJob?.id ?? null;
    if (previousPendingJobId.current !== null && pendingJobId === null && processing === null) {
      refresh();
    }
    previousPendingJobId.current = pendingJobId;
    // Only the job identity matters; `refresh` and `processing` are read at the moment it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingJob?.id]);

  // A run started here is followed until it ends; then the page reloads what it produced.
  const followProcessing = async () => {
    if (processing === null) {
      return;
    }
    try {
      const run = await pipelineApi.processingRun(
        workspaceId,
        processing.documentId,
        processing.versionId,
        processing.job.id,
      );
      if (TERMINAL.has(run.job.status)) {
        setProcessing(null);
        notify(
          run.job.status === "SUCCEEDED"
            ? {
                tone: "good",
                title: t("documents.processed", "Processed"),
                description: t(
                  "preparation.savedDescription",
                  "The selected preparation steps have finished. Their results are available in this document.",
                ),
              }
            : {
                tone: "error",
                title:
                  run.job.status === "CANCELLED"
                    ? t("documents.processingCancelled", "Processing cancelled")
                    : t("documents.processingFailed", "Processing failed"),
                description: run.job.failureCode ?? undefined,
              },
        );
        refresh();
      } else {
        setProcessing(run);
      }
    } catch (error) {
      setProcessing(null);
      const problem = describeProblem(error);
      notify({
        tone: "error",
        title: problem.title,
        description: problem.detail ?? problem.description,
      });
    }
  };
  usePolling(processing !== null, () => void followProcessing(), processing);

  const followVectors = async () => {
    if (vectorising === null) {
      return;
    }
    try {
      const generation = await pipelineApi.vectorGeneration(workspaceId, vectorising.jobId);
      if (generation.state !== "BUILDING" || TERMINAL.has(generation.job.status)) {
        setVectorising(null);
        notify(
          generation.state === "PUBLISHED"
            ? {
                tone: "good",
                title: t("documents.vectorised", "Vectorised"),
                description: plural("documents.vectorsPublished", generation.storedRecords, {
                  one: "{count} vector published.",
                  other: "{count} vectors published.",
                }),
              }
            : {
                tone: "error",
                title:
                  generation.job.status === "FAILED"
                    ? t("documents.vectorisingFailed", "Vectorising failed")
                    : generation.job.status === "CANCELLED"
                      ? t("documents.vectorisingCancelled", "Vectorising cancelled")
                      : t("documents.vectorisingEnded", "Vectorising ended: {status}", {
                          status: labelOfCode(JOB_STATUSES, generation.job.status).toLowerCase(),
                        }),
                description: generation.job.failureCode ?? undefined,
              },
        );
        refresh();
      } else {
        setVectorising(generation);
      }
    } catch (error) {
      setVectorising(null);
      const problem = describeProblem(error);
      notify({
        tone: "error",
        title: problem.title,
        description: problem.detail ?? problem.description,
      });
    }
  };
  usePolling(vectorising !== null, () => void followVectors(), vectorising, 3000);

  if (pipeline.status === "loading") {
    return <Waiting label={t("documents.loadingTheDocument", "Loading the document")} lines={8} />;
  }
  if (pipeline.status === "failed") {
    return (
      <ProblemState
        problem={pipeline.problem}
        actions={
          <>
            <Button icon="refresh" variant="primary" onClick={pipeline.reload}>
              {t("common.tryAgain", "Try again")}
            </Button>
            <Button href="/documents" variant="quiet">
              {t("documents.allDocuments", "All documents")}
            </Button>
          </>
        }
      />
    );
  }

  const { document, versions, generations, vectorGenerations, processingProfiles } = pipeline.data;
  const version =
    versions.find((candidate) => candidate.id === search.version) ??
    versions.find((candidate) => candidate.id === document.latestVersionId) ??
    versions[0];
  if (version === undefined) {
    return (
      <ProblemState
        problem={{
          kind: "not-found",
          status: null,
          title: t("documents.noVersions", "No versions"),
          description: t(
            "documents.noVersionsDescription",
            "This document has no captured version.",
          ),
          detail: null,
        }}
      />
    );
  }
  const isLatest = version.id === document.latestVersionId;
  const generation = generationOfVersion(generations, version.id);
  const runs = runHistory.status === "ready" ? runHistory.data : [];
  const completedRun = runs.find((run) => run.job.status === "SUCCEEDED") ?? null;
  const chunkRun =
    runs.find((run) => run.job.status === "SUCCEEDED" && run.preparation.steps.includes("chunk")) ??
    null;
  const parseReference =
    completedRun === null
      ? generation
      : {
          jobId: completedRun.job.id,
          versionId: completedRun.versionId,
          state: completedRun.job.status,
        };
  const chunkReference =
    chunkRun === null
      ? generation
      : {
          jobId: chunkRun.job.id,
          versionId: chunkRun.versionId,
          state:
            generations.find((item) => item.jobId === chunkRun.job.id)?.state ??
            chunkRun.job.status,
        };
  const tab: DocumentTab = search.tab ?? "read";
  const sourceName = source.status === "ready" && source.data !== null ? source.data.name : null;
  const removed = document.removedAt !== null;
  const mayWriteDocuments = permissions.may(PERMISSIONS.documentWrite);

  // Changing the version or the tab drops what the Read tab was looking at; reading keeps both.
  const go = (next: { version?: string; tab?: DocumentTab; reading?: ReadingAddress }) => {
    const nextTab = next.tab ?? tab;
    void changeAddress({
      to: "/documents/$documentId",
      params: { documentId },
      search: {
        version: next.version ?? (isLatest ? undefined : version.id),
        tab: nextTab === "read" ? undefined : nextTab,
        view: next.reading?.view,
        lines: next.reading?.lines,
        page: next.reading?.page,
      },
    });
  };

  const startProcessing = async (profile: ProcessingProfile, request?: ProcessingRequest) => {
    setSubmitting(true);
    try {
      const run = await pipelineApi.startProcessing(
        workspaceId,
        document.id,
        version.id,
        profile.id,
        submissionKey("process", version.id),
        request,
      );
      setProcessing(run);
      refreshActivity();
      const workerStopped = activity !== null && !activity.workerAlive;
      notify({
        tone: workerStopped ? "neutral" : "good",
        title: t("documents.processingQueued", "Queued for processing"),
        description: workerStopped
          ? t(
              "documents.processingQueuedStalled",
              "{profile} on version {version}. The worker is not running, so it waits until the worker starts.",
              {
                profile: profile.name,
                version: version.versionNumber,
              },
            )
          : t("documents.processingStartedDescription", "{profile} on version {version}", {
              profile: profile.name,
              version: version.versionNumber,
            }),
      });
    } catch (error) {
      const problem = describeProblem(error);
      notify({
        tone: "error",
        title: t("documents.processingNotStarted", "Processing did not start"),
        description: problem.detail ?? problem.description,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const setPublished = async (published: boolean) => {
    if (generation === null) {
      return;
    }
    setBusy(true);
    try {
      await pipelineApi.publishGeneration(workspaceId, generation, published);
      notify({
        tone: "good",
        title: published
          ? t("documents.published", "Published — search can find it")
          : t("documents.withdrawn", "Withdrawn from search"),
      });
      refresh();
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
    <>
      <PageHeader
        eyebrow={
          <>
            <Link to="/documents" className={CRUMB}>
              {t("documents.title", "Documents")}
            </Link>
            {sourceName !== null && (
              <>
                {" / "}
                <Link
                  to="/sources/$sourceId"
                  params={{ sourceId: document.sourceId }}
                  className={CRUMB}
                >
                  {sourceName}
                </Link>
              </>
            )}
          </>
        }
        title={document.title}
        status={
          removed ? (
            <Badge tone="deny">{t("documents.removed", "Removed")}</Badge>
          ) : (
            <Badge tone={isLatest ? "neutral" : "warn"}>
              {isLatest
                ? t("documents.version", "Version {number}", { number: version.versionNumber })
                : t("documents.versionOf", "Version {number} of {latest}", {
                    number: version.versionNumber,
                    latest: versions[0]?.versionNumber ?? "?",
                  })}
            </Badge>
          )
        }
        lead={
          <span className={`numeric ${EXTERNAL_IDENTIFIER}`}>
            {document.origin?.path ?? document.externalId}
          </span>
        }
        actions={
          <>
            {versions.length > 1 && (
              <Select
                aria-label={t("documents.versionLabel", "Version")}
                value={version.id}
                onChange={(event) => {
                  go({
                    version:
                      event.target.value === document.latestVersionId
                        ? undefined
                        : event.target.value,
                  });
                }}
              >
                {versions.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.id === document.latestVersionId
                      ? t("documents.versionCurrent", "Version {number} · current", {
                          number: candidate.versionNumber,
                        })
                      : t("documents.version", "Version {number}", {
                          number: candidate.versionNumber,
                        })}
                  </option>
                ))}
              </Select>
            )}
            {mayWriteDocuments && !removed && (
              <RemoveDocumentButton
                workspaceId={workspaceId}
                document={document}
                onChanged={refresh}
              />
            )}
          </>
        }
      />

      {document.origin !== undefined && document.origin !== null && (
        <DocumentOriginStrip origin={document.origin} externalId={document.externalId} />
      )}

      {removed && (
        <div className={REMOVAL_NOTICE}>
          <RemovedDocumentNotice
            workspaceId={workspaceId}
            document={document}
            mayRestore={mayWriteDocuments}
            onChanged={refresh}
          />
        </div>
      )}

      {mayReadAutomation && (
        <PipelineStrip
          version={version}
          isLatest={isLatest}
          generation={generation}
          preparedRun={completedRun}
          runningProcess={processing}
          pendingJob={pendingJob}
          workerAlive={activity?.workerAlive ?? true}
          profileName={
            generation === null
              ? null
              : (processingProfiles.find((candidate) => candidate.id === generation.profileId)
                  ?.name ?? null)
          }
          onOpenProfile={
            generation === null
              ? undefined
              : () => {
                  setProfileSettingsOpen(true);
                }
          }
          vectorGenerations={
            vectorising === null ? vectorGenerations : [vectorising, ...vectorGenerations]
          }
          mayProcess={mayWriteDocuments && !removed}
          mayManageIndex={permissions.may(PERMISSIONS.automationManage) && !removed}
          mayVectorise={permissions.may(PERMISSIONS.automationManage) && !removed}
          busy={busy}
          onProcess={() => {
            go({ tab: "manage" });
          }}
          onPublish={(published) => void setPublished(published)}
          onVectorise={() => {
            setVectoriseOpen(true);
          }}
        />
      )}

      <Tabs<DocumentTab>
        label={t("documents.column.document", "Document")}
        active={tab}
        onSelect={(next) => {
          go({ tab: next });
        }}
        items={[
          { key: "manage", label: t("preparation.manage", "Manage") },
          { key: "relations", label: t("preparation.relations", "Relations") },
          { key: "read", label: t("documents.tab.read", "Read") },
          { key: "text", label: t("documents.tab.text", "Parsed text") },
          {
            key: "chunks",
            label: t("documents.tab.chunks", "Chunks"),
            count: generation?.entryCount,
          },
          { key: "trace", label: t("documents.tab.trace", "Trace") },
          {
            key: "versions",
            label: t("documents.column.versions", "Versions"),
            count: versions.length,
          },
          { key: "origin", label: t("documents.tab.origin", "Origin") },
          { key: "journal", label: t("documents.tab.journal", "Journal") },
        ]}
      />
      <TabPanel tabKey={tab}>
        {tab === "manage" &&
          (runHistory.status === "loading" ? (
            <Waiting label={t("preparation.history", "Runs of this version")} lines={3} />
          ) : runHistory.status === "failed" ? (
            <ProblemState layout="section" problem={runHistory.problem} />
          ) : (
            <ManagementTab
              workspaceId={workspaceId}
              documentId={document.id}
              versionId={version.id}
              profiles={processingProfiles}
              runs={runs}
              submitting={submitting || pendingJob !== null}
              mayProcess={mayWriteDocuments && !removed && mayReadAutomation}
              onSubmit={(profile, request) => void startProcessing(profile, request)}
            />
          ))}
        {tab === "relations" && (
          <RelationsTab
            workspaceId={workspaceId}
            documentId={document.id}
            versionId={version.id}
            runs={runs}
            mayManage={mayWriteDocuments && !removed && mayReadAutomation}
            onPrepare={() => go({ tab: "manage" })}
          />
        )}

        {tab === "read" && (
          <ReadTab
            workspaceId={workspaceId}
            documentId={document.id}
            version={version}
            generation={parseReference}
            documentPath={document.origin?.path ?? document.externalId}
            address={{ view: search.view, lines: search.lines, page: search.page }}
            onAddressChange={(reading) => {
              go({ reading });
            }}
          />
        )}
        {tab === "text" && (
          <ParsedTextTab
            workspaceId={workspaceId}
            documentId={document.id}
            generation={parseReference}
          />
        )}
        {tab === "chunks" && (
          <ChunksTab
            workspaceId={workspaceId}
            generation={chunkReference}
            documentPath={document.origin?.path ?? document.externalId}
            onChanged={refresh}
          />
        )}
        {tab === "versions" && (
          <VersionsTab
            versions={versions}
            generations={generations}
            selectedId={version.id}
            latestId={document.latestVersionId}
            onSelect={(versionId) => {
              go({
                version: versionId === document.latestVersionId ? undefined : versionId,
                tab: "chunks",
              });
            }}
          />
        )}
        {tab === "trace" && <TraceTab workspaceId={workspaceId} generation={parseReference} />}
        {tab === "origin" && (
          <OriginTab
            document={document}
            versions={versions}
            source={source.status === "ready" ? source.data : null}
          />
        )}
        {tab === "journal" && (
          <JournalTab workspaceId={workspaceId} documentId={document.id} generation={generation} />
        )}
      </TabPanel>

      {generation !== null && (
        <ProfileQuickSettings
          open={profileSettingsOpen}
          kind="processing"
          profileId={generation.profileId}
          onClose={() => {
            setProfileSettingsOpen(false);
          }}
          onSaved={() => {
            refresh();
          }}
          effectNote={t(
            "documents.profileSettingsEffect",
            "How this document was parsed, chunked and indexed. A save applies to the next processing — use Process again to cut this document anew.",
          )}
        />
      )}
      {generation !== null && (
        <VectoriseDialog
          open={vectoriseOpen}
          workspaceId={workspaceId}
          generationIds={[generation.jobId]}
          subject={document.title}
          onClose={() => {
            setVectoriseOpen(false);
          }}
          onSubmitted={(submitted) => {
            setVectoriseOpen(false);
            setVectorising(submitted);
            notify({
              tone: "good",
              title: t("documents.vectorisingStarted", "Vectorising started"),
              description: plural("documents.chunksToEmbed", submitted.expectedRecords, {
                one: "{count} chunk to embed.",
                other: "{count} chunks to embed.",
              }),
            });
          }}
        />
      )}
    </>
  );
}
