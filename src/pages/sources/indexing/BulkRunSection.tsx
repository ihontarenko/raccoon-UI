import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { usePermissions } from "../../../access/PermissionsProvider";
import { PERMISSIONS } from "../../../access/permissions";
import { formatNumber } from "../../../application/format";
import { describeProblem } from "../../../application/problems";
import { pipelineApi, submissionKey, type ProcessingProfile, type VectorGeneration } from "../../../lib/pipeline";
import { useTranslation } from "../../../translations/TranslationProvider";
import { EmptyState, Segmented, Statistics, useToaster } from "../../../ui/components";
import { Badge, Button, Select, Table } from "../../../ui/primitives";
import { LEXICAL_LABEL, LEXICAL_TONE } from "../../indexing/KeywordGenerationsTab";
import { VectoriseDialog } from "../../indexing/VectoriseDialog";
import { VECTOR_BATCH, type DocumentStanding, type SourceStanding } from "./sourceIndexing";
import { BLOCK, BLOCK_HEAD, BLOCK_TITLE, DOCUMENT_LINK, FAILURES, HISTORY, PROGRESS, PROGRESS_BAR, RUN_CONTROLS, RUN_FORM, STEP, STEP_BODY, STEP_NUMBER, TABLE_SURFACE } from "./sourceIndexingClasses";

type Selection = "unprocessed" | "all";

interface Progress {
  total: number;
  submitted: number;
  failed: { title: string; reason: string }[];
  running: boolean;
}

interface BulkRunSectionProperties {
  workspaceId: string;
  sourceName: string;
  standing: SourceStanding;
  profiles: ProcessingProfile[];
  onChanged: () => void;
}

/**
 * Processes documents already in the source, in a batch somebody can watch and stop: each submission
 * is one queued job, counted as it goes. Publishing and vectorising what was built are separate,
 * deliberate steps below it.
 */
export function BulkRunSection({ workspaceId, sourceName, standing, profiles, onChanged }: BulkRunSectionProperties) {
  const { t, plural } = useTranslation();
  const { notify } = useToaster();
  const permissions = usePermissions();
  const mayProcess = permissions.may(PERMISSIONS.documentWrite);
  const mayManage = permissions.may(PERMISSIONS.automationManage);
  const enabledProfiles = profiles.filter((profile) => profile.configuration.enabled !== false);
  const [profileId, setProfileId] = useState(enabledProfiles[0]?.id ?? "");
  const [selection, setSelection] = useState<Selection>(standing.unprocessed > 0 ? "unprocessed" : "all");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [vectorising, setVectorising] = useState(false);
  const stopReference = useRef(false);

  const chosen: DocumentStanding[] = selection === "unprocessed" ? standing.documents.filter((entry) => entry.generation === null) : standing.documents;
  const publishable = standing.documents.filter((entry) => entry.generation !== null && (entry.generation.state === "READY" || entry.generation.state === "WITHDRAWN"));
  const vectorisable = standing.documents
    .filter((entry) => entry.generation?.state === "PUBLISHED")
    .map((entry) => entry.generation?.jobId)
    .filter((jobId): jobId is string => jobId !== undefined)
    .slice(0, VECTOR_BATCH);

  const run = async () => {
    stopReference.current = false;
    const targets = chosen;
    setProgress({ total: targets.length, submitted: 0, failed: [], running: true });
    for (const entry of targets) {
      if (stopReference.current) {
        break;
      }
      try {
        await pipelineApi.startProcessing(workspaceId, entry.document.id, entry.document.latestVersionId, profileId, submissionKey("bulk", entry.document.latestVersionId));
        setProgress((current) => (current === null ? current : { ...current, submitted: current.submitted + 1 }));
      } catch (error) {
        const problem = describeProblem(error);
        setProgress((current) =>
          current === null ? current : { ...current, failed: [...current.failed, { title: entry.document.title, reason: problem.detail ?? problem.title }] },
        );
      }
    }
    setProgress((current) => (current === null ? current : { ...current, running: false }));
    notify({
      tone: "good",
      title: stopReference.current ? t("sources.indexing.batchStopped", "Batch stopped") : t("sources.indexing.batchQueued", "Batch queued"),
      description: t("sources.indexing.batchDescription", "The worker processes the queued jobs in turn."),
    });
    onChanged();
  };

  const publishAll = async () => {
    setPublishing(true);
    let published = 0;
    for (const entry of publishable) {
      if (entry.generation === null) {
        continue;
      }
      try {
        await pipelineApi.publishGeneration(workspaceId, entry.generation, true);
        published += 1;
      } catch {
        // A generation that cannot be published (an older version, a conflict) is left as it is.
      }
    }
    setPublishing(false);
    notify({
      tone: "good",
      title: plural("sources.indexing.publishedToast", published, {
        one: "{count} document published",
        other: "{count} documents published",
      }),
      description: published < publishable.length ? t("sources.indexing.somePublishFailed", "Some could not be; their pages say why.") : undefined,
    });
    onChanged();
  };

  if (standing.documents.length === 0) {
    return (
      <section className={BLOCK}>
        <EmptyState
          title={t("sources.indexing.nothingCaptured", "Nothing captured yet")}
          description={t("sources.indexing.nothingCapturedDescription", "Scan the source first; its documents can then be processed here in one batch.")}
        />
      </section>
    );
  }

  const share = progress === null || progress.total === 0 ? 0 : (progress.submitted + progress.failed.length) / progress.total;

  return (
    <section className={BLOCK} aria-labelledby="bulk-run">
      <header className={BLOCK_HEAD}>
        <div>
          <h2 id="bulk-run" className={BLOCK_TITLE}>
            {t("sources.indexing.alreadyHere", "Documents already here")}
          </h2>
          <p className="text-xs text-secondary">
            {t("sources.indexing.alreadyHereLead", "Process, publish and vectorise what the source already holds — each step on purpose, each counted.")}
          </p>
        </div>
      </header>

      <Statistics
        label={t("sources.indexing.standing", "Where the documents stand")}
        items={[
          { label: t("sources.indexing.documents", "Documents"), value: formatNumber(standing.documents.length) },
          {
            label: t("sources.indexing.notProcessed", "Not processed"),
            value: formatNumber(standing.unprocessed),
            tone: standing.unprocessed > 0 ? "warn" : undefined,
          },
          {
            label: t("sources.indexing.builtNotSearchable", "Built, not searchable"),
            value: formatNumber(standing.unpublished),
            tone: standing.unpublished > 0 ? "warn" : undefined,
          },
          { label: t("sources.indexing.searchable", "Searchable"), value: formatNumber(standing.published), tone: "good" },
        ]}
      />

      {mayProcess && (
        <div className={RUN_FORM}>
          <div className={STEP}>
            <span className={STEP_NUMBER}>1</span>
            <div className={STEP_BODY}>
              <strong>{t("sources.indexing.process", "Process")}</strong>
              <div className={RUN_CONTROLS}>
                <Segmented<Selection>
                  label={t("sources.indexing.whichDocuments", "Which documents")}
                  value={selection}
                  onChange={setSelection}
                  options={[
                    { value: "unprocessed", label: t("sources.indexing.notProcessed", "Not processed"), count: standing.unprocessed },
                    { value: "all", label: t("sources.indexing.allAgain", "All, again"), count: standing.documents.length },
                  ]}
                />
                <Select
                  aria-label={t("sources.indexing.profile", "Processing profile")}
                  value={profileId}
                  onChange={(event) => {
                    setProfileId(event.target.value);
                  }}
                >
                  {enabledProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </Select>
                {progress?.running === true ? (
                  <Button
                    variant="danger"
                    icon="stop"
                    onClick={() => {
                      stopReference.current = true;
                    }}
                  >
                    {t("sources.indexing.stop", "Stop")}
                  </Button>
                ) : (
                  <Button variant="primary" icon="play" disabled={chosen.length === 0 || profileId === ""} onClick={() => void run()}>
                    {plural("sources.indexing.processCount", chosen.length, {
                      one: "Process {count} document",
                      other: "Process {count} documents",
                    })}
                  </Button>
                )}
              </div>
              {progress !== null && (
                <div className={PROGRESS} aria-live="polite">
                  <div className={PROGRESS_BAR} role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.submitted + progress.failed.length}>
                    <span style={{ width: `${Math.round(share * 100)}%` }} />
                  </div>
                  <span className="text-xs text-secondary numeric">
                    {progress.failed.length > 0
                      ? t("sources.indexing.progressRefused", "{queued} queued · {refused} refused of {total}", {
                          queued: formatNumber(progress.submitted),
                          refused: formatNumber(progress.failed.length),
                          total: formatNumber(progress.total),
                        })
                      : t("sources.indexing.progress", "{queued} queued of {total}", {
                          queued: formatNumber(progress.submitted),
                          total: formatNumber(progress.total),
                        })}
                    {progress.running ? "…" : ""}
                  </span>
                  {progress.failed.length > 0 && (
                    <ul className={FAILURES}>
                      {progress.failed.map((failure) => (
                        <li key={failure.title}>
                          <strong>{failure.title}</strong> — {failure.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          {mayManage && (
            <div className={STEP}>
              <span className={STEP_NUMBER}>2</span>
              <div className={STEP_BODY}>
                <strong>{t("sources.indexing.publish", "Publish")}</strong>
                <span className="text-xs text-secondary">
                  {t("sources.indexing.publishHint", "A profile that publishes by itself makes this step unnecessary.")}
                </span>
                <div className={RUN_CONTROLS}>
                  <Button disabled={publishable.length === 0 || publishing} onClick={() => void publishAll()}>
                    {publishing
                      ? t("sources.indexing.publishing", "Publishing…")
                      : plural("sources.indexing.publishCount", publishable.length, {
                          one: "Publish {count} document",
                          other: "Publish {count} documents",
                        })}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {mayManage && (
            <div className={STEP}>
              <span className={STEP_NUMBER}>3</span>
              <div className={STEP_BODY}>
                <strong>{t("sources.indexing.vectorise", "Vectorise")}</strong>
                <span className="text-xs text-secondary">
                  {t("sources.indexing.vectoriseHint", "A preflight forecasts tokens and cost before anything is sent.")}
                  {standing.published > VECTOR_BATCH
                    ? ` ${plural("sources.indexing.batchLimit", VECTOR_BATCH, {
                        one: "Up to {count} document a batch.",
                        other: "Up to {count} documents a batch.",
                      })}`
                    : ""}
                </span>
                <div className={RUN_CONTROLS}>
                  <Button
                    icon="vectors"
                    disabled={vectorisable.length === 0}
                    onClick={() => {
                      setVectorising(true);
                    }}
                  >
                    {plural("sources.indexing.vectoriseCount", vectorisable.length, {
                      one: "Vectorise {count} document",
                      other: "Vectorise {count} documents",
                    })}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <DocumentStandings standing={standing} />

      <VectoriseDialog
        open={vectorising}
        workspaceId={workspaceId}
        generationIds={vectorisable}
        subject={plural(
          "sources.indexing.vectoriseSubject",
          vectorisable.length,
          { one: "{count} document of {source}", other: "{count} documents of {source}" },
          { source: sourceName },
        )}
        onClose={() => {
          setVectorising(false);
        }}
        onSubmitted={(generation: VectorGeneration) => {
          setVectorising(false);
          notify({
            tone: "good",
            title: t("sources.indexing.vectorisingStarted", "Vectorising started"),
            description: plural("sources.indexing.vectorisingDescription", generation.expectedRecords, {
              one: "{count} chunk to embed. Follow it on the Index page.",
              other: "{count} chunks to embed. Follow it on the Index page.",
            }),
          });
          onChanged();
        }}
      />
    </section>
  );
}


function DocumentStandings({ standing }: { standing: SourceStanding }) {
  const { t } = useTranslation();
  return (
    <details className={HISTORY}>
      <summary>{t("sources.indexing.everyDocument", "Every document · {count}", { count: formatNumber(standing.documents.length) })}</summary>
      <div className={TABLE_SURFACE}>
        <Table>
          <thead>
            <tr>
              <th scope="col">{t("sources.indexing.document", "Document")}</th>
              <th scope="col">{t("sources.indexing.index", "Index")}</th>
              <th scope="col" className="numeric">
                {t("sources.indexing.chunks", "Chunks")}
              </th>
            </tr>
          </thead>
          <tbody>
            {standing.documents.map((entry) => (
              <tr key={entry.document.id}>
                <td>
                  <Link to="/documents/$documentId" params={{ documentId: entry.document.id }} className={DOCUMENT_LINK}>
                    {entry.document.title}
                  </Link>
                  <div className="numeric text-xs text-muted">{entry.document.externalId}</div>
                </td>
                <td>
                  {entry.generation === null ? (
                    <Badge tone="neutral">{t("sources.indexing.notProcessed", "Not processed")}</Badge>
                  ) : (
                    <Badge tone={LEXICAL_TONE[entry.generation.state]}>{LEXICAL_LABEL[entry.generation.state]}</Badge>
                  )}
                </td>
                <td className="numeric">{entry.generation === null ? "—" : formatNumber(entry.generation.entryCount)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </details>
  );
}
