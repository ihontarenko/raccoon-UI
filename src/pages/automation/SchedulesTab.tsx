import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Can } from "../../access/Can";
import { useMayI } from "../../access/MayI";
import { PERMISSIONS } from "../../access/permissions";
import { formatDateTime, labelOfCode, shortIdentifier, type CodeLabels } from "../../application/format";
import { describeProblem, type Problem } from "../../application/problems";
import { usePagedList } from "../../application/usePagedList";
import { useResource } from "../../application/useResource";
import { api, collectAllPages } from "../../lib/api";
import type { JobStatus, SourceView } from "../../lib/contracts";
import { pipelineApi, type AvailableProfile } from "../../lib/pipeline";
import {
  PERIOD_UNITS,
  describeTiming,
  periodInUnits,
  schedulesApi,
  type OccurrenceOutcome,
  type SaveSchedule,
  type ScheduleHandler,
  type ScheduleOccurrence,
  type ScheduleView,
  type TimingKind,
} from "../../lib/schedules";
import { declareText, translate, translatePlural } from "../../translations/translate";
import { useTranslation } from "../../translations/TranslationProvider";
import { ConfirmDialog, EmptyState, ListFooter, Notice, ProblemState, Segmented, Waiting, useToaster } from "../../ui/components";
import { Badge, Button, Checkbox, Dialog, Field, Input, Select, Table, type BadgeTone } from "../../ui/primitives";
import { JOB_FAILURES } from "../jobs/jobLabels";
import { isScanned } from "../sources/sourceKinds";
import { ensureScannerBinding } from "../sources/sourceOperations";
import { DIALOG_BODY, ROW_LINK, STACK, TABLE_SURFACE, TOOLBAR, TWO_COLUMNS } from "./automationClasses";

/** What a schedule does, by its handler key (`ScheduleHandler`). */
const HANDLERS: CodeLabels = {
  "scan-source": declareText("automation.schedules.handler.scanSource", "Scan"),
  "vectorise-waiting": declareText("automation.schedules.handler.vectoriseWaiting", "Vectorise"),
};

/** What became of one occurrence (`OccurrenceOutcome`). */
const OUTCOMES: CodeLabels = {
  FIRED: declareText("automation.schedules.outcome.fired", "Fired"),
  SKIPPED: declareText("automation.schedules.outcome.skipped", "Skipped"),
  REFUSED: declareText("automation.schedules.outcome.refused", "Refused"),
  FAILED: declareText("automation.schedules.outcome.failed", "Failed"),
};

const OUTCOME_TONE: Record<OccurrenceOutcome, BadgeTone> = {
  FIRED: "good",
  SKIPPED: "neutral",
  REFUSED: "warn",
  FAILED: "error",
};

/** The job a fired occurrence queued, as the history's last column says it. */
const JOB_WORDS: CodeLabels = {
  QUEUED: declareText("automation.schedules.job.queued", "job waiting"),
  RUNNING: declareText("automation.schedules.job.running", "job running"),
  SUCCEEDED: declareText("automation.schedules.job.succeeded", "job done"),
  FAILED: declareText("automation.schedules.job.failed", "job failed"),
  CANCELLED: declareText("automation.schedules.job.cancelled", "job cancelled"),
} satisfies Record<JobStatus, unknown>;

/**
 * Scans and vectorisations that fire by themselves. A firing acts as the person who last saved or resumed
 * the schedule; a vectorisation is forecast first and refused, with the forecast's words, when its budget
 * is not within bounds.
 */
export function SchedulesTab({ workspaceId }: { workspaceId: string }) {
  const { t, plural } = useTranslation();
  const { notify } = useToaster();
  const [editing, setEditing] = useState<{ schedule: ScheduleView | null } | null>(null);
  const [historyOf, setHistoryOf] = useState<ScheduleView | null>(null);
  const [removing, setRemoving] = useState<ScheduleView | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const schedules = usePagedList((page) => schedulesApi.list(workspaceId, page), [workspaceId]);

  const report = (error: unknown) => {
    const problem = describeProblem(error);
    notify({ tone: "error", title: problem.title, description: problem.detail ?? problem.description });
  };

  const toggle = async (schedule: ScheduleView) => {
    setBusyId(schedule.id);
    try {
      await schedulesApi.changeEnabled(workspaceId, schedule, !schedule.enabled);
      notify({
        tone: "good",
        title: schedule.enabled ? t("automation.schedules.pausedNotice", "Schedule paused") : t("automation.schedules.resumedNotice", "Schedule resumed"),
        description: schedule.subject ?? undefined,
      });
      schedules.reload();
    } catch (error) {
      report(error);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (schedule: ScheduleView) => {
    setBusyId(schedule.id);
    try {
      await schedulesApi.remove(workspaceId, schedule);
      notify({ tone: "good", title: t("automation.schedules.removedNotice", "Schedule removed"), description: schedule.subject ?? undefined });
      setRemoving(null);
      schedules.reload();
    } catch (error) {
      report(error);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={STACK}>
      <div className={TOOLBAR}>
        <span className="text-xs text-muted">
          {t(
            "automation.schedules.missedRuns",
            "A missed scan fires once when the worker returns. A missed vectorisation is skipped — it never catches up.",
          )}
        </span>
        <Can permission={PERMISSIONS.automationManage}>
          <Button icon="plus" onClick={() => setEditing({ schedule: null })}>
            {t("automation.schedules.new", "New schedule")}
          </Button>
        </Can>
      </div>
      {schedules.status === "loading" && <Waiting label={t("automation.schedules.loading", "Loading schedules")} lines={4} />}
      {schedules.status === "failed" && (
        <ProblemState
          layout="section"
          problem={schedules.problem}
          actions={
            <Button icon="refresh" onClick={schedules.reload}>
              {t("common.tryAgain", "Try again")}
            </Button>
          }
        />
      )}
      {schedules.status === "ready" &&
        (schedules.items.length === 0 ? (
          <EmptyState
            title={t("automation.schedules.empty", "Nothing is scheduled")}
            description={t(
              "automation.schedules.emptyDescription",
              "Scan a source every few hours, or vectorise what is waiting each night in small, budgeted portions.",
            )}
          />
        ) : (
          <div className={TABLE_SURFACE}>
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t("automation.schedules.column.what", "What")}</th>
                  <th scope="col">{t("automation.schedules.column.when", "When")}</th>
                  <th scope="col">{t("automation.schedules.column.nextRun", "Next run")}</th>
                  <th scope="col">{t("automation.schedules.column.lastOutcome", "Last outcome")}</th>
                  <th scope="col">
                    <span className="sr-only">{t("common.actions", "Actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {schedules.items.map((schedule) => (
                  <tr key={schedule.id}>
                    <td className="wraps">
                      <strong>{labelOfCode(HANDLERS, schedule.handler)}</strong> <ScheduleSubject schedule={schedule} />
                      <div className="text-xs text-muted">
                        {t("automation.schedules.actsAs", "{parameters} · acts as {actor}", {
                          parameters: describeParameters(schedule),
                          actor: (
                            <span className="numeric" title={schedule.actorId}>
                              {shortIdentifier(schedule.actorId)}
                            </span>
                          ),
                        })}
                      </div>
                    </td>
                    <td>
                      <span>{describeTiming(schedule.timing)}</span>
                      {!schedule.enabled && (
                        <div>
                          <Badge tone="deny">{t("automation.schedules.paused", "Paused")}</Badge>
                        </div>
                      )}
                    </td>
                    <td className="text-xs text-secondary">{schedule.enabled ? formatDateTime(schedule.nextFireAt) : "—"}</td>
                    <td className="wraps">
                      <OccurrenceSummary occurrence={schedule.lastOccurrence} />
                    </td>
                    <td className="actions">
                      <Button variant="quiet" icon="jobs" onClick={() => setHistoryOf(schedule)}>
                        {t("automation.schedules.history", "History")}
                      </Button>
                      <Can permission={PERMISSIONS.automationManage}>
                        <Button variant="quiet" icon="edit" onClick={() => setEditing({ schedule })}>
                          {t("automation.schedules.edit", "Edit")}
                        </Button>
                        <Button
                          variant="quiet"
                          icon={schedule.enabled ? "pause" : "play"}
                          disabled={busyId === schedule.id}
                          onClick={() => void toggle(schedule)}
                        >
                          {schedule.enabled ? t("automation.schedules.pause", "Pause") : t("automation.schedules.resume", "Resume")}
                        </Button>
                        <Button
                          variant="quiet"
                          iconOnly
                          icon="trash"
                          aria-label={
                            schedule.subject === null
                              ? t("automation.schedules.removeUnnamed", "Remove the schedule of this subject")
                              : t("automation.schedules.removeNamed", "Remove the schedule of {subject}", { subject: schedule.subject })
                          }
                          onClick={() => setRemoving(schedule)}
                        />
                      </Can>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <ListFooter
              shown={schedules.items.length}
              counted={plural("automation.schedules.count", schedules.items.length, { one: "{count} schedule", other: "{count} schedules" })}
              hasMore={schedules.hasMore}
              loadingMore={schedules.loadingMore}
              moreProblem={schedules.moreProblem}
              onLoadMore={schedules.loadMore}
            />
          </div>
        ))}
      <ScheduleDialog
        editing={editing}
        workspaceId={workspaceId}
        onClose={() => setEditing(null)}
        onSaved={(saved, created) => {
          setEditing(null);
          notify({
            tone: "good",
            title: created ? t("automation.schedules.createdNotice", "Schedule created") : t("automation.schedules.savedNotice", "Schedule saved"),
            description: `${saved.subject ?? ""} · ${describeTiming(saved.timing)}`,
          });
          schedules.reload();
        }}
      />
      <HistoryDialog workspaceId={workspaceId} schedule={historyOf} onClose={() => setHistoryOf(null)} />
      <ConfirmDialog
        open={removing !== null}
        title={t("automation.schedules.removeTitle", "Remove schedule")}
        confirmLabel={t("automation.schedules.removeTitle", "Remove schedule")}
        destructive
        busy={removing !== null && busyId === removing.id}
        onConfirm={() => {
          if (removing !== null) {
            void remove(removing);
          }
        }}
        onCancel={() => setRemoving(null)}
      >
        <p>
          {t(
            "automation.schedules.removeExplained",
            "The schedule stops and its history goes with it. Scans and vector generations it already started are kept.",
          )}
        </p>
      </ConfirmDialog>
    </div>
  );
}

function ScheduleSubject({ schedule }: { schedule: ScheduleView }) {
  const { t } = useTranslation();
  if (schedule.sourceId !== null) {
    return (
      <Link to="/sources/$sourceId" params={{ sourceId: schedule.sourceId }} className={ROW_LINK}>
        {schedule.subject ?? shortIdentifier(schedule.sourceId)}
      </Link>
    );
  }
  return <span>{schedule.subject === null ? "" : t("automation.schedules.withSubject", "with {subject}", { subject: schedule.subject })}</span>;
}

/** What a schedule's parameters mean, in words; read at render time so it follows the viewer's language. */
function describeParameters(schedule: ScheduleView): string {
  if (schedule.handler === "vectorise-waiting") {
    const documents = Number(schedule.parameters.maximumDocuments ?? 0);
    const calls = Number(schedule.parameters.maximumCalls ?? 0);
    return translate("automation.schedules.vectoriseParameters", "up to {documents}, {calls}, budget checked first", {
      documents: translatePlural("automation.schedules.documentCount", documents, { one: "{count} document", other: "{count} documents" }),
      calls: translatePlural("automation.schedules.callCount", calls, { one: "{count} call", other: "{count} calls" }),
    });
  }
  return translate("automation.schedules.scanParameters", "the source's own scanner and rules");
}

function OccurrenceSummary({ occurrence }: { occurrence: ScheduleOccurrence | null }) {
  const { t } = useTranslation();
  if (occurrence === null) {
    return <span className="text-xs text-muted">{t("automation.schedules.notFired", "Not fired yet")}</span>;
  }
  return (
    <>
      <Badge tone={OUTCOME_TONE[occurrence.outcome]}>{labelOfCode(OUTCOMES, occurrence.outcome)}</Badge>{" "}
      <span className="text-xs text-secondary">{formatDateTime(occurrence.scheduledAt)}</span>
      {occurrence.reason !== null && <div className="text-xs text-secondary">{occurrence.reason}</div>}
    </>
  );
}

function HistoryDialog({ workspaceId, schedule, onClose }: { workspaceId: string; schedule: ScheduleView | null; onClose: () => void }) {
  const { t, plural } = useTranslation();
  const history = usePagedList<ScheduleOccurrence>(
    (page) => (schedule === null ? Promise.resolve([]) : schedulesApi.history(workspaceId, schedule.id, page)),
    [workspaceId, schedule?.id],
  );
  return (
    <Dialog
      open={schedule !== null}
      onClose={onClose}
      size="wide"
      title={
        schedule === null
          ? t("automation.schedules.history", "History")
          : t("automation.schedules.historyOf", "{what} {subject} — history", {
              what: labelOfCode(HANDLERS, schedule.handler),
              subject: schedule.subject ?? "",
            })
      }
      footer={
        <Button variant="quiet" onClick={onClose}>
          {t("common.close", "Close")}
        </Button>
      }
    >
      <div className={DIALOG_BODY}>
        <p className="text-xs text-muted">
          {t(
            "automation.schedules.historyLead",
            "Newest first. Fired means the work was queued; a refusal or a failure of that work is added in its own words.",
          )}
        </p>
        {history.status === "loading" && <Waiting label={t("automation.schedules.loadingHistory", "Loading the history")} lines={4} />}
        {history.status === "failed" && (
          <ProblemState
            layout="section"
            problem={history.problem}
            actions={
              <Button icon="refresh" onClick={history.reload}>
                {t("common.tryAgain", "Try again")}
              </Button>
            }
          />
        )}
        {history.status === "ready" &&
          (history.items.length === 0 ? (
            <EmptyState
              title={t("automation.schedules.notFired", "Not fired yet")}
              description={t("automation.schedules.historyEmptyDescription", "Each firing, skip and refusal is listed here.")}
            />
          ) : (
            <div className={TABLE_SURFACE}>
              <Table>
                <thead>
                  <tr>
                    <th scope="col">{t("automation.schedules.column.due", "Due")}</th>
                    <th scope="col">{t("automation.schedules.column.outcome", "Outcome")}</th>
                    <th scope="col">{t("automation.schedules.column.why", "Why")}</th>
                    <th scope="col">{t("automation.schedules.column.job", "Job")}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.items.map((occurrence, index) => (
                    <tr key={`${occurrence.scheduledAt}-${occurrence.outcome}-${index}`}>
                      <td className="text-xs text-secondary">
                        {formatDateTime(occurrence.scheduledAt)}
                        {occurrence.count > 1 && (
                          <div className="text-muted">
                            {plural("automation.schedules.occurrences", occurrence.count, { one: "{count} occurrence", other: "{count} occurrences" })}
                          </div>
                        )}
                      </td>
                      <td>
                        <Badge tone={OUTCOME_TONE[occurrence.outcome]}>{labelOfCode(OUTCOMES, occurrence.outcome)}</Badge>
                      </td>
                      <td className="wraps text-xs">{occurrence.reason ?? <span className="text-muted">—</span>}</td>
                      <td className="text-xs">
                        {occurrence.jobStatus === null ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <>
                            {labelOfCode(JOB_WORDS, occurrence.jobStatus)}
                            {occurrence.jobFailureCode !== null && <div className="text-muted">{labelOfCode(JOB_FAILURES, occurrence.jobFailureCode)}</div>}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <ListFooter
                shown={history.items.length}
                counted={plural("automation.schedules.historyCount", history.items.length, { one: "{count} line", other: "{count} lines" })}
                hasMore={history.hasMore}
                loadingMore={history.loadingMore}
                moreProblem={history.moreProblem}
                onLoadMore={history.loadMore}
              />
            </div>
          ))}
      </div>
    </Dialog>
  );
}

interface Choices {
  sources: SourceView[];
  profiles: AvailableProfile[];
}

interface Draft {
  handler: ScheduleHandler;
  sourceId: string;
  embeddingProfileId: string;
  maximumDocuments: string;
  maximumCalls: string;
  allowApproximateTokens: boolean;
  timingKind: TimingKind;
  periodAmount: string;
  periodUnitSeconds: number;
  expression: string;
  zone: string;
  enabled: boolean;
}

const BROWSER_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function draftOf(schedule: ScheduleView | null): Draft {
  const period = periodInUnits(schedule?.timing?.periodSeconds ?? 6 * 3600);
  const parameters = schedule?.parameters ?? {};
  return {
    handler: schedule?.handler ?? "scan-source",
    sourceId: schedule?.sourceId ?? "",
    embeddingProfileId: schedule?.embeddingProfileId ?? "",
    maximumDocuments: String(parameters.maximumDocuments ?? 5),
    maximumCalls: String(parameters.maximumCalls ?? 20),
    allowApproximateTokens: parameters.allowApproximateTokens !== false,
    timingKind: schedule?.timing?.kind ?? "INTERVAL",
    periodAmount: String(period.amount),
    periodUnitSeconds: period.unitSeconds,
    expression: schedule?.timing?.expression ?? "0 3 * * *",
    zone: schedule?.timing?.zone ?? BROWSER_ZONE,
    enabled: schedule?.enabled ?? true,
  };
}

function ScheduleDialog({
  editing,
  workspaceId,
  onClose,
  onSaved,
}: {
  editing: { schedule: ScheduleView | null } | null;
  workspaceId: string;
  onClose: () => void;
  onSaved: (schedule: ScheduleView, created: boolean) => void;
}) {
  const { t, say } = useTranslation();
  const schedule = editing?.schedule ?? null;
  const [draft, setDraft] = useState<Draft>(() => draftOf(null));
  const [problem, setProblem] = useState<Problem | null>(null);
  const [saving, setSaving] = useState(false);
  // Vectorising admits installation model calls, which the backend reserves for system administration.
  const mayVectorise = useMayI({ permission: PERMISSIONS.systemWrite }) === true;
  const choices = useResource<Choices>(async () => {
    if (editing === null) {
      return { sources: [], profiles: [] };
    }
    const [sources, profiles] = await Promise.all([
      collectAllPages((page) => api.listSources(workspaceId, page)),
      collectAllPages((page) => pipelineApi.availableEmbeddingProfiles(workspaceId, page)),
    ]);
    return { sources: sources.filter((source) => isScanned(source.kind) && source.removedAt === null), profiles };
  }, [workspaceId, editing]);

  useEffect(() => {
    if (editing !== null) {
      setDraft(draftOf(editing.schedule));
      setProblem(null);
      setSaving(false);
    }
  }, [editing]);

  // Keyed on the loaded data, not on the resource wrapper, which is a new object on every render.
  const loadedChoices = choices.status === "ready" ? choices.data : null;
  useEffect(() => {
    if (loadedChoices === null) {
      return;
    }
    setDraft((current) => {
      if (current.sourceId !== "" && current.embeddingProfileId !== "") {
        return current;
      }
      return {
        ...current,
        sourceId: current.sourceId === "" ? (loadedChoices.sources[0]?.id ?? "") : current.sourceId,
        embeddingProfileId: current.embeddingProfileId === "" ? (loadedChoices.profiles[0]?.id ?? "") : current.embeddingProfileId,
      };
    });
  }, [loadedChoices]);

  const change = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  const save = async () => {
    setSaving(true);
    setProblem(null);
    try {
      const request: SaveSchedule = {
        handler: draft.handler,
        enabled: draft.enabled,
        timing:
          draft.timingKind === "INTERVAL"
            ? { kind: "INTERVAL", periodSeconds: Math.trunc(Number(draft.periodAmount)) * draft.periodUnitSeconds, expression: null, zone: null }
            : { kind: "CRON", expression: draft.expression.trim(), zone: draft.zone.trim(), periodSeconds: null },
        parameters:
          draft.handler === "scan-source"
            ? { sourceId: draft.sourceId }
            : {
                ...(schedule?.parameters ?? {}),
                embeddingProfileId: draft.embeddingProfileId,
                maximumDocuments: Math.trunc(Number(draft.maximumDocuments)),
                maximumCalls: Math.trunc(Number(draft.maximumCalls)),
                allowApproximateTokens: draft.allowApproximateTokens,
              },
      };
      if (draft.handler === "scan-source") {
        // A scan runs through the source's scanner binding, made here the way the Scan button makes it.
        await ensureScannerBinding(workspaceId, draft.sourceId);
      }
      const saved = schedule === null ? await schedulesApi.create(workspaceId, request) : await schedulesApi.change(workspaceId, schedule, request);
      onSaved(saved, schedule === null);
    } catch (error) {
      setProblem(describeProblem(error));
      setSaving(false);
    }
  };

  const ready = choices.status === "ready";
  const subjectMissing =
    ready && (draft.handler === "scan-source" ? choices.data.sources.length === 0 : choices.data.profiles.length === 0);

  return (
    <Dialog
      open={editing !== null}
      onClose={onClose}
      title={
        schedule === null
          ? t("automation.schedules.newTitle", "New schedule")
          : schedule.subject === null
            ? t("automation.schedules.editUnnamedTitle", "Edit the schedule of this subject")
            : t("automation.schedules.editTitle", "Edit the schedule of {subject}", { subject: schedule.subject })
      }
      size="wide"
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={saving}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button variant="primary" disabled={saving || !ready || subjectMissing} onClick={() => void save()}>
            {saving ? t("common.saving", "Saving…") : t("automation.schedules.save", "Save schedule")}
          </Button>
        </>
      }
    >
      <div className={DIALOG_BODY}>
        {problem !== null && (
          <Notice tone="error" title={problem.title}>
            {problem.detail ?? problem.description}
          </Notice>
        )}
        {choices.status === "loading" && <Waiting label={t("automation.schedules.loadingChoices", "Loading sources and profiles")} lines={3} />}
        {choices.status === "failed" && (
          <ProblemState
            layout="section"
            problem={choices.problem}
            actions={
              <Button icon="refresh" onClick={choices.reload}>
                {t("common.tryAgain", "Try again")}
              </Button>
            }
          />
        )}
        {ready && (
          <>
            <Field
              label={t("automation.schedules.column.what", "What")}
              hint={schedule === null ? undefined : t("automation.schedules.handlerFixed", "A schedule keeps what it does; create another to do something else.")}
            >
              <Select value={draft.handler} disabled={schedule !== null} fullWidth onChange={(event) => change({ handler: event.target.value as ScheduleHandler })}>
                <option value="scan-source">{t("automation.schedules.handlerOption.scanSource", "Scan a source")}</option>
                <option value="vectorise-waiting" disabled={!mayVectorise}>
                  {mayVectorise
                    ? t("automation.schedules.handlerOption.vectoriseWaiting", "Vectorise waiting documents")
                    : t("automation.schedules.handlerOption.vectoriseWaitingRefused", "Vectorise waiting documents — needs system administration")}
                </option>
              </Select>
            </Field>
            {draft.handler === "scan-source" ? (
              <Field
                label={t("automation.schedules.source", "Source")}
                hint={t("automation.schedules.sourceHint", "The same scan the Scan now button starts: the source's scanner, its rules, its preparation.")}
              >
                <Select value={draft.sourceId} fullWidth onChange={(event) => change({ sourceId: event.target.value })}>
                  {choices.data.sources.length === 0 && <option value="">{t("automation.schedules.noScannedSource", "No scanned source in this workspace")}</option>}
                  {choices.data.sources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <>
                <Notice tone="information" title={t("automation.schedules.spendsTitle", "Spends money with nobody watching")}>
                  {t(
                    "automation.schedules.spends",
                    "Each run first forecasts the portion it would take. When the token or the cost budget is not within the profile's bounds, the run is refused and the forecast's words are recorded in the history. A run missed while the worker was down is skipped, never caught up.",
                  )}
                </Notice>
                <Field label={t("automation.schedules.embeddingProfile", "Embedding profile")}>
                  <Select value={draft.embeddingProfileId} fullWidth onChange={(event) => change({ embeddingProfileId: event.target.value })}>
                    {choices.data.profiles.length === 0 && <option value="">{t("automation.schedules.noProfile", "No enabled embedding profile")}</option>}
                    {choices.data.profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className={TWO_COLUMNS}>
                  <Field
                    label={t("automation.schedules.documentsPerRun", "Documents per run")}
                    hint={t("automation.schedules.documentsPerRunHint", "The oldest published documents with no vectors yet; 1–100.")}
                  >
                    <Input type="number" className="numeric" min={1} max={100} value={draft.maximumDocuments} onChange={(event) => change({ maximumDocuments: event.target.value })} />
                  </Field>
                  <Field
                    label={t("automation.schedules.maximumCalls", "Model calls at most")}
                    hint={t("automation.schedules.maximumCallsHint", "Across every attempt of one run's vector generation.")}
                  >
                    <Input type="number" className="numeric" min={1} max={10000} value={draft.maximumCalls} onChange={(event) => change({ maximumCalls: event.target.value })} />
                  </Field>
                </div>
                <Checkbox
                  label={t("automation.schedules.approximateTokens", "Accept an approximate token count (a tokenizer that estimates by characters)")}
                  checked={draft.allowApproximateTokens}
                  onChange={(event) => change({ allowApproximateTokens: event.target.checked })}
                />
              </>
            )}
            <Segmented<TimingKind>
              label={t("automation.schedules.column.when", "When")}
              value={draft.timingKind}
              onChange={(timingKind) => change({ timingKind })}
              options={[
                { value: "INTERVAL", label: t("automation.schedules.timingKind.interval", "Every…") },
                { value: "CRON", label: t("automation.schedules.cronExpression", "Cron expression") },
              ]}
            />
            {draft.timingKind === "INTERVAL" ? (
              <div className={TWO_COLUMNS}>
                <Field
                  label={t("automation.schedules.every", "Every")}
                  hint={t("automation.schedules.everyHint", "Counted from midnight UTC, so every hour fires on the hour. At least one minute.")}
                >
                  <Input type="number" className="numeric" min={1} value={draft.periodAmount} onChange={(event) => change({ periodAmount: event.target.value })} />
                </Field>
                <Field label={t("automation.schedules.unitLabel", "Unit")}>
                  <Select value={String(draft.periodUnitSeconds)} onChange={(event) => change({ periodUnitSeconds: Number(event.target.value) })}>
                    {[...PERIOD_UNITS].reverse().map((unit) => (
                      <option key={unit.seconds} value={unit.seconds}>
                        {say(unit.label)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            ) : (
              <div className={TWO_COLUMNS}>
                <Field
                  label={t("automation.schedules.cronExpression", "Cron expression")}
                  hint={t("automation.schedules.cronHint", "minute hour day-of-month month day-of-week, or @daily, @hourly…")}
                >
                  <Input className="numeric" value={draft.expression} maxLength={200} onChange={(event) => change({ expression: event.target.value })} />
                </Field>
                <Field label={t("automation.schedules.zone", "Time zone")} hint={t("automation.schedules.zoneHint", "The wall clock the expression is read on.")}>
                  <Input value={draft.zone} maxLength={64} onChange={(event) => change({ zone: event.target.value })} />
                </Field>
              </div>
            )}
            <Checkbox label={t("automation.schedules.enabled", "Enabled")} checked={draft.enabled} onChange={(event) => change({ enabled: event.target.checked })} />
            <p className="text-xs text-muted">{t("automation.schedules.actsAsYou", "Each firing acts as you: it can do only what you can do by hand, re-checked every time.")}</p>
          </>
        )}
      </div>
    </Dialog>
  );
}
