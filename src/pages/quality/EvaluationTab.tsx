import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { usePermissions } from "../../access/PermissionsProvider";
import { PERMISSIONS } from "../../access/permissions";
import { RETRIEVAL_MODES, RUNTIME_EVENT_TYPES, STAGE_OUTCOMES } from "../../application/codeLabels";
import { formatDateTime, formatNumber, labelOfCode, type CodeLabels } from "../../application/format";
import { describeProblem } from "../../application/problems";
import { usePagedList } from "../../application/usePagedList";
import { useResource } from "../../application/useResource";
import { collectAllPages } from "../../lib/api";
import {
  evaluationApi,
  type EvaluationQuestion,
  type Run,
  type RunDocument,
  type RunResult,
  type RunState,
  type RunSummary,
  type Suite,
  type Thresholds,
} from "../../lib/evaluation";
import { profilesApi } from "../../lib/profiles";
import { currentLocale, declareText, type DeclaredText } from "../../translations/translate";
import { useTranslation } from "../../translations/TranslationProvider";
import {
  ConfirmDialog,
  Facts,
  Inspector,
  InspectorActions,
  InspectorSection,
  ListFooter,
  PathText,
  ProblemState,
  RowName,
  Waiting,
  Workbench,
  useToaster,
} from "../../ui/components";
import { Badge, Button, Table, type BadgeTone, type IconName } from "../../ui/primitives";
import { METRIC_LABELS } from "./metrics";
import { DOCUMENT_CELL, DOCUMENT_NAME, GUIDE, HISTORY, HISTORY_ROW, INSTEAD, INTRO, JOURNAL, METRIC, METRIC_FILL, METRIC_LABEL, METRIC_MARK, METRIC_TRACK, METRIC_VALUE, METRIC_WORD, OUTCOME, OUTCOME_FOUND, OUTCOME_MISSED, PROFILE_GRID, PROFILE_HEAD, PROFILE_NAME, PROFILE_SCORE, QUESTION_CELL, REPORT, REPORT_HEAD, REPORT_TITLE, ROW_LINK, SECTION_TITLE, STACK, STEP, STEPS, STEP_NUMBER, STEP_TITLE, SUMMARY_TOGGLE, TABLE_SURFACE, TOOLBAR_ACTIONS } from "./qualityClasses";

const STATE_TONE: Record<RunState, BadgeTone> = { RUNNING: "active", COMPLETED: "good", STOPPED: "warn", CANCELLED: "neutral", FAILED: "error" };
/** How many documents a missed question lists as what was found instead. */
const FOUND_INSTEAD = 3;

/** Where an evaluation run stands: `evaluation/EvaluationRuns.State`. */
const RUN_STATES: CodeLabels = {
  RUNNING: declareText("codes.evaluationRunState.running", "Running"),
  COMPLETED: declareText("codes.evaluationRunState.completed", "Completed"),
  STOPPED: declareText("codes.evaluationRunState.stopped", "Stopped"),
  CANCELLED: declareText("codes.evaluationRunState.cancelled", "Cancelled"),
  FAILED: declareText("codes.evaluationRunState.failed", "Failed"),
} satisfies Record<RunState, DeclaredText>;

/** Why a run, or one of its searches, ended where it did: `evaluation/EvaluationRuns.Reason`. */
const RUN_REASONS: CodeLabels = {
  COMPLETE: declareText("codes.evaluationReason.complete", "Complete"),
  SEARCH_LIMIT: declareText("codes.evaluationReason.searchLimit", "Search limit"),
  CALL_LIMIT: declareText("codes.evaluationReason.callLimit", "Call limit"),
  TOKEN_LIMIT: declareText("codes.evaluationReason.tokenLimit", "Token limit"),
  DEADLINE: declareText("codes.evaluationReason.deadline", "Deadline"),
  PROFILE_CHANGED: declareText("codes.evaluationReason.profileChanged", "Profile changed"),
  CORPUS_CHANGED: declareText("codes.evaluationReason.corpusChanged", "Corpus changed"),
  UNKNOWN_USAGE: declareText("codes.evaluationReason.unknownUsage", "Unknown usage"),
  SEARCH_FAILED: declareText("codes.evaluationReason.searchFailed", "Search failed"),
  POLICY_REFUSED: declareText("codes.evaluationReason.policyRefused", "Policy refused"),
  CANCELLED: declareText("codes.evaluationReason.cancelled", "Cancelled"),
  IN_PROGRESS: declareText("codes.evaluationReason.inProgress", "In progress"),
};

type RunAction = "cancel" | "settle" | "remove";

interface RunActionDescription {
  label: DeclaredText;
  title: DeclaredText;
  consequence: DeclaredText;
  done: DeclaredText;
  icon: IconName;
  perform: (workspaceId: string, run: Run) => Promise<unknown>;
}

/** What each run action is called, what it does to the run, and the call that does it. */
const RUN_ACTIONS: Record<RunAction, RunActionDescription> = {
  cancel: {
    label: declareText("quality.action.cancel", "Cancel"),
    title: declareText("quality.action.cancel.title", "Cancel the run"),
    consequence: declareText(
      "quality.action.cancel.consequence",
      "The run stops before its next search. Searches already made stay in the report, and their usage is still counted.",
    ),
    done: declareText("quality.action.cancel.done", "Run cancelled"),
    icon: "stop",
    perform: evaluationApi.cancelRun,
  },
  settle: {
    label: declareText("quality.action.settle", "Settle"),
    title: declareText("quality.action.settle.title", "Settle the abandoned run"),
    consequence: declareText(
      "quality.action.settle.consequence",
      "The run was cancelled but never finished. Its searches still in progress are closed with the usage their providers actually reported. Allowed only once the run's deadline and the call grace have passed.",
    ),
    done: declareText("quality.action.settle.done", "Run settled"),
    icon: "check",
    perform: evaluationApi.settleCancelledRun,
  },
  remove: {
    label: declareText("quality.action.remove", "Remove"),
    title: declareText("quality.action.remove.title", "Remove the report"),
    consequence: declareText("quality.action.remove.consequence", "The run and its scored results are deleted. The suite is not touched."),
    done: declareText("quality.action.remove.done", "Report removed"),
    icon: "trash",
    perform: evaluationApi.removeRun,
  },
};

/** A share as a whole percentage in the viewer's language; the server sends fractions. */
function percent(value: number | null): string {
  return value === null ? "—" : new Intl.NumberFormat(currentLocale(), { style: "percent", maximumFractionDigits: 0 }).format(value);
}

function runPassed(run: Run): boolean | null {
  return run.summaries.length === 0 ? null : run.summaries.every((summary) => summary.passed);
}

/** Suites of known questions: what each one checks, how it last went, and the report of the run chosen. */
export function EvaluationTab({ workspaceId }: { workspaceId: string }) {
  const { t, plural } = useTranslation();
  const { notify } = useToaster();
  const mayManage = usePermissions().may(PERMISSIONS.automationManage);
  const suites = useResource(() => collectAllPages((page) => evaluationApi.suites(workspaceId, page)), [workspaceId]);
  const profiles = useResource(() => collectAllPages((page) => profilesApi.list(workspaceId, "search", page)), [workspaceId]);
  // The newest runs of every suite, for each suite's last verdict in the list.
  const recent = useResource(() => evaluationApi.runs(workspaceId, { limit: 100, offset: 0 }), [workspaceId]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openedRunId, setOpenedRunId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);

  const profileName = (profileId: string) =>
    (profiles.status === "ready" ? profiles.data.find((profile) => profile.id === profileId)?.name : undefined) ?? profileId.slice(0, 8);

  const run = async (suite: Suite) => {
    setRunningId(suite.id);
    try {
      const finished = await evaluationApi.runSuite(workspaceId, suite.id);
      const passed = runPassed(finished) === true;
      notify({
        tone: passed ? "good" : "error",
        title: passed ? t("quality.run.allPassed", "Every profile passed") : t("quality.run.belowThresholds", "Below the thresholds"),
        description: t("quality.run.summary", "{state} · {searches}", {
          state: labelOfCode(RUN_STATES, finished.state),
          searches: plural("quality.searches.count", finished.results.length, { one: "{count} search", other: "{count} searches" }),
        }),
      });
      recent.reload();
      setHistoryVersion((version) => version + 1);
      setOpenedRunId(finished.id);
    } catch (error) {
      const problem = describeProblem(error);
      notify({ tone: "error", title: problem.title, description: problem.detail ?? problem.description });
    } finally {
      setRunningId(null);
    }
  };

  if (suites.status === "loading") {
    return <Waiting label={t("quality.evaluation.loading", "Loading evaluation")} lines={5} />;
  }
  if (suites.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={suites.problem}
        actions={
          <Button icon="refresh" onClick={suites.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }

  const intro = (
    <p className={INTRO}>
      {t(
        "quality.evaluation.intro",
        "Checks whether search finds the right documents for questions whose answer you already know, and scores each search profile on it.",
      )}
    </p>
  );

  if (suites.data.length === 0) {
    return (
      <div className={STACK}>
        {intro}
        <GuidedStart mayManage={mayManage} />
      </div>
    );
  }

  const selected = suites.data.find((suite) => suite.id === selectedId) ?? suites.data[0];
  const lastRunOf = (suiteId: string) => (recent.status === "ready" ? recent.data.find((candidate) => candidate.suiteId === suiteId) : undefined);

  return (
    <div className={STACK}>
      {intro}
      <Workbench>
        <section aria-label={t("quality.suites", "Suites")}>
          <Table>
            <thead>
              <tr>
                <th scope="col">{t("quality.column.suite", "Suite")}</th>
                <th scope="col">{t("quality.column.lastRun", "Last run")}</th>
              </tr>
            </thead>
            <tbody>
              {suites.data.map((suite) => {
                const last = lastRunOf(suite.id);
                const passed = last === undefined ? null : runPassed(last);
                return (
                  <tr key={suite.id} data-selected={suite.id === selected.id}>
                    <td>
                      <RowName
                        selected={suite.id === selected.id}
                        onSelect={() => {
                          setSelectedId(suite.id);
                          setOpenedRunId(null);
                        }}
                      >
                        {suite.name}
                      </RowName>
                      <div className="text-xs text-muted">
                        {t("quality.suite.shape", "{questions} · {profiles} · top {cutoff}", {
                          questions: plural("quality.questions.count", suite.configuration.questions.length, {
                            one: "{count} question",
                            other: "{count} questions",
                          }),
                          profiles: plural("quality.profiles.count", suite.configuration.selections.length, {
                            one: "{count} profile",
                            other: "{count} profiles",
                          }),
                          cutoff: suite.configuration.cutoff,
                        })}
                        {!suite.configuration.enabled && ` · ${t("quality.suite.disabled", "Disabled")}`}
                      </div>
                    </td>
                    <td>
                      {last === undefined ? (
                        <span className="text-xs text-muted">{t("quality.suite.neverRun", "Never run")}</span>
                      ) : (
                        <>
                          <Verdict passed={passed} state={last.state} />
                          <div className="text-xs text-muted">{formatDateTime(last.createdAt)}</div>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </section>
        <Inspector label={t("quality.selectedSuite", "Selected suite")} eyebrow={t("quality.suite.eyebrow", "Evaluation suite")} title={selected.name}>
          <InspectorSection title={t("quality.suite.checks", "What it checks")}>
            <Facts
              rows={[
                [t("quality.suite.questions", "Questions"), <span className="numeric">{selected.configuration.questions.length}</span>],
                [
                  t("quality.suite.compared", "Compared"),
                  selected.configuration.selections
                    .map((selection) => `${profileName(selection.profileId)} · ${labelOfCode(RETRIEVAL_MODES, selection.mode)}`)
                    .join(", "),
                ],
                [t("quality.suite.top", "Scored hits"), <span className="numeric">{selected.configuration.cutoff}</span>],
                [
                  t("quality.suite.passesAt", "Passes at"),
                  t("quality.suite.thresholdsShort", "hit rate ≥ {hitRate}, recall ≥ {recall}, rank ≥ {rank}", {
                    hitRate: percent(selected.configuration.thresholds.hitRate),
                    recall: percent(selected.configuration.thresholds.recall),
                    rank: percent(selected.configuration.thresholds.meanReciprocalRank),
                  }),
                ],
              ]}
            />
          </InspectorSection>
          <InspectorSection title={t("quality.suite.manage", "Manage")}>
            <InspectorActions>
              {mayManage && (
                <Button
                  variant="primary"
                  icon="play"
                  disabled={runningId !== null || !selected.configuration.enabled}
                  title={selected.configuration.enabled ? undefined : t("quality.suite.disabledHint", "A disabled suite cannot be run.")}
                  onClick={() => void run(selected)}
                >
                  {runningId === selected.id ? t("quality.suite.running", "Running…") : t("quality.suite.runNow", "Run now")}
                </Button>
              )}
              <Button icon={mayManage ? "edit" : "eye"} href={`/quality/suites/${selected.id}`}>
                {mayManage ? t("quality.suite.edit", "Edit") : t("quality.suite.open", "Open")}
              </Button>
            </InspectorActions>
          </InspectorSection>
          <InspectorSection title={t("quality.suite.history", "Runs of this suite")}>
            <SuiteHistory
              key={`${selected.id}:${historyVersion}`}
              workspaceId={workspaceId}
              suiteId={selected.id}
              openedRunId={openedRunId}
              onOpen={setOpenedRunId}
            />
          </InspectorSection>
        </Inspector>
      </Workbench>
      {openedRunId !== null && (
        <RunReport
          key={openedRunId}
          workspaceId={workspaceId}
          runId={openedRunId}
          suiteName={selected.name}
          profileName={profileName}
          onChanged={() => {
            recent.reload();
            setHistoryVersion((version) => version + 1);
          }}
          onRemoved={() => {
            setOpenedRunId(null);
            recent.reload();
            setHistoryVersion((version) => version + 1);
          }}
        />
      )}
    </div>
  );
}

function Verdict({ passed, state }: { passed: boolean | null; state: RunState }) {
  const { t } = useTranslation();
  if (passed === null) {
    return <Badge tone={STATE_TONE[state]}>{labelOfCode(RUN_STATES, state)}</Badge>;
  }
  return <Badge tone={passed ? "allow" : "deny"}>{passed ? t("quality.passed", "Passed") : t("quality.failed", "Failed")}</Badge>;
}

/** The three steps from nothing to a first score, each with the one action that takes it. */
function GuidedStart({ mayManage }: { mayManage: boolean }) {
  const { t } = useTranslation();
  const steps = [
    {
      title: t("quality.start.create.title", "Create a suite"),
      text: t(
        "quality.start.create.text",
        "Choose the search profiles to compare, how many top hits count, and the scores a profile must reach to pass.",
      ),
    },
    {
      title: t("quality.start.questions.title", "Add questions"),
      text: t(
        "quality.start.questions.text",
        "Write the questions people really ask and pick the documents each must find — or let the chat model draft them from a document.",
      ),
    },
    {
      title: t("quality.start.run.title", "Run it"),
      text: t(
        "quality.start.run.text",
        "Every question is searched with every profile; the report shows which passed and, for each missed question, what was found instead.",
      ),
    },
  ];
  return (
    <section className={GUIDE} aria-labelledby="quality-start">
      <h2 id="quality-start" className={SECTION_TITLE}>
        {t("quality.start.title", "No evaluation suite yet — three steps to a first score")}
      </h2>
      <ol className={STEPS}>
        {steps.map((step, index) => (
          <li key={step.title} className={STEP}>
            <span className={STEP_NUMBER} aria-hidden="true">
              {index + 1}
            </span>
            <div>
              <h3 className={STEP_TITLE}>{step.title}</h3>
              <p className="text-xs text-secondary">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
      {mayManage ? (
        <div>
          <Button variant="primary" icon="plus" href="/quality/suites/new">
            {t("quality.start.action", "Create the first suite")}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted">{t("quality.start.noPermission", "Creating a suite needs the permission to manage automation.")}</p>
      )}
    </section>
  );
}

/** The selected suite's runs, newest first; choosing one opens its report under the list. */
function SuiteHistory({
  workspaceId,
  suiteId,
  openedRunId,
  onOpen,
}: {
  workspaceId: string;
  suiteId: string;
  openedRunId: string | null;
  onOpen: (runId: string) => void;
}) {
  const { t, plural } = useTranslation();
  const runs = usePagedList((page) => evaluationApi.runs(workspaceId, page, suiteId), [workspaceId, suiteId]);
  if (runs.status === "loading") {
    return <Waiting label={t("quality.runs.loading", "Loading runs")} lines={2} />;
  }
  if (runs.status === "failed") {
    return <ProblemState layout="section" problem={runs.problem} />;
  }
  if (runs.items.length === 0) {
    return <p className="text-xs text-muted">{t("quality.runs.empty", "No run yet. Running a suite searches every question with every profile it compares.")}</p>;
  }
  return (
    <>
      <ul className={HISTORY}>
        {runs.items.map((item) => (
          <li key={item.id}>
            <button type="button" className={HISTORY_ROW} aria-pressed={item.id === openedRunId} onClick={() => onOpen(item.id)}>
              <span className="text-xs">{formatDateTime(item.createdAt)}</span>
              <Verdict passed={runPassed(item)} state={item.state} />
            </button>
          </li>
        ))}
      </ul>
      <ListFooter
        shown={runs.items.length}
        counted={plural("quality.runs.count", runs.items.length, { one: "{count} run", other: "{count} runs" })}
        hasMore={runs.hasMore}
        loadingMore={runs.loadingMore}
        moreProblem={runs.moreProblem}
        onLoadMore={runs.loadMore}
      />
    </>
  );
}

interface Report {
  run: Run;
  /** The marks the suite set when the run was frozen. */
  thresholds: Thresholds;
  questions: Map<string, EvaluationQuestion>;
  documents: Map<string, RunDocument>;
}

/** One run explained: each profile's numbers against its thresholds, then every question and what it found. */
function RunReport({
  workspaceId,
  runId,
  suiteName,
  profileName,
  onChanged,
  onRemoved,
}: {
  workspaceId: string;
  runId: string;
  suiteName: string;
  profileName: (profileId: string) => string;
  onChanged: () => void;
  onRemoved: () => void;
}) {
  const { t, say } = useTranslation();
  const { notify } = useToaster();
  const permissions = usePermissions();
  const mayManage = permissions.may(PERMISSIONS.automationManage);
  const maySettle = mayManage && permissions.may(PERMISSIONS.systemWrite);
  const [confirming, setConfirming] = useState<RunAction | null>(null);
  const report = useResource<Report>(async () => {
    const [run, plan, documents] = await Promise.all([
      evaluationApi.run(workspaceId, runId),
      evaluationApi.runPlan(workspaceId, runId),
      evaluationApi.runDocuments(workspaceId, runId),
    ]);
    return {
      run,
      thresholds: plan.suite.configuration.thresholds,
      questions: new Map(plan.suite.configuration.questions.map((question) => [question.id, question])),
      documents: new Map(documents.map((document) => [document.documentId, document])),
    };
  }, [workspaceId, runId]);

  if (report.status === "loading") {
    return <Waiting label={t("quality.report.loading", "Loading the report")} lines={6} />;
  }
  if (report.status === "failed") {
    return <ProblemState layout="section" problem={report.problem} />;
  }
  const { run } = report.data;

  /** A running run can be cancelled, an abandoned cancelled one settled, and a finished one removed. */
  const actions: RunAction[] = !mayManage
    ? []
    : run.state === "RUNNING"
      ? ["cancel"]
      : run.state === "CANCELLED" && run.completedAt === null
        ? maySettle
          ? ["settle"]
          : []
        : ["remove"];

  const perform = async (action: RunAction) => {
    try {
      await RUN_ACTIONS[action].perform(workspaceId, run);
      notify({ tone: "good", title: say(RUN_ACTIONS[action].done) });
      if (action === "remove") {
        onRemoved();
      } else {
        report.reload();
        onChanged();
      }
    } catch (error) {
      const problem = describeProblem(error);
      notify({ tone: "error", title: problem.title, description: problem.detail ?? problem.description });
    }
  };

  return (
    <section className={REPORT} aria-labelledby="run-report-title">
      <header className={REPORT_HEAD}>
        <div>
          <p className="eyebrow">{t("quality.report.eyebrow", "Run report")}</p>
          <h2 id="run-report-title" className={REPORT_TITLE}>
            {suiteName} · {formatDateTime(run.createdAt)}
          </h2>
          <p className="text-xs text-muted">
            {t("quality.report.facts", "revision {revision} · {state}", {
              revision: run.suiteRevision,
              state: labelOfCode(RUN_STATES, run.state),
            })}
            {run.reason !== null && run.reason !== "COMPLETE" && ` · ${labelOfCode(RUN_REASONS, run.reason)}`}
          </p>
        </div>
        <div className={TOOLBAR_ACTIONS}>
          {actions.map((action) => (
            <Button key={action} variant="quiet" icon={RUN_ACTIONS[action].icon} onClick={() => setConfirming(action)}>
              {say(RUN_ACTIONS[action].label)}
            </Button>
          ))}
        </div>
      </header>
      <div className={PROFILE_GRID}>
        {run.summaries.map((summary) => (
          <ProfileScore key={`${summary.selection.profileId}:${summary.selection.mode}`} summary={summary} thresholds={report.data.thresholds} profileName={profileName} />
        ))}
      </div>
      <QuestionTable report={report.data} profileName={profileName} />
      <details className={JOURNAL}>
        <summary className={SUMMARY_TOGGLE}>{t("quality.detail.eventJournal", "Event journal")}</summary>
        <RunEvents workspaceId={workspaceId} runId={run.id} />
      </details>
      <ConfirmDialog
        open={confirming !== null}
        title={confirming === null ? "" : say(RUN_ACTIONS[confirming].title)}
        confirmLabel={confirming === null ? "" : say(RUN_ACTIONS[confirming].label)}
        destructive={confirming === "remove"}
        onConfirm={() => {
          if (confirming !== null) {
            const action = confirming;
            setConfirming(null);
            void perform(action);
          }
        }}
        onCancel={() => setConfirming(null)}
      >
        <p>{confirming === null ? null : say(RUN_ACTIONS[confirming].consequence)}</p>
      </ConfirmDialog>
    </section>
  );
}

/** One compared profile: its verdict, then each number as a bar against the mark it had to reach. */
function ProfileScore({
  summary,
  thresholds,
  profileName,
}: {
  summary: RunSummary;
  thresholds: Thresholds;
  profileName: (profileId: string) => string;
}) {
  const { t, say } = useTranslation();
  return (
    <article className={PROFILE_SCORE} aria-label={profileName(summary.selection.profileId)}>
      <header className={PROFILE_HEAD}>
        <div>
          <h3 className={PROFILE_NAME}>{profileName(summary.selection.profileId)}</h3>
          <p className="text-xs text-muted">
            {labelOfCode(RETRIEVAL_MODES, summary.selection.mode)} ·{" "}
            {t("quality.report.cases", "{completed} of {planned} questions searched", {
              completed: summary.completedCases,
              planned: summary.plannedCases,
            })}
            {summary.failedCases > 0 && ` · ${t("quality.detail.failedCases", "{count} failed", { count: summary.failedCases })}`}
          </p>
        </div>
        <Badge tone={summary.passed ? "allow" : "deny"}>{summary.passed ? t("quality.passed", "Passed") : t("quality.failed", "Failed")}</Badge>
      </header>
      <MetricBar label={say(METRIC_LABELS.hitRate)} value={summary.hitRate} threshold={thresholds.hitRate} />
      <MetricBar label={say(METRIC_LABELS.recall)} value={summary.recall} threshold={thresholds.recall} />
      <MetricBar label={say(METRIC_LABELS.meanReciprocalRank)} value={summary.meanReciprocalRank} threshold={thresholds.meanReciprocalRank} />
      {summary.unexpectedResponseRate !== null && (
        <MetricBar
          label={say(METRIC_LABELS.unexpected)}
          value={summary.unexpectedResponseRate}
          threshold={thresholds.maximumUnexpectedResponseRate}
          ceiling
        />
      )}
    </article>
  );
}

/**
 * A value against the mark it must reach (or, for a ceiling, stay under): the bar and the tick are drawn, and
 * the words say the same, so the verdict never rests on colour alone.
 */
function MetricBar({ label, value, threshold, ceiling = false }: { label: string; value: number | null; threshold: number | null; ceiling?: boolean }) {
  const { t } = useTranslation();
  const meets = value === null || threshold === null ? null : ceiling ? value <= threshold : value >= threshold;
  const tone = meets === null ? "neutral" : meets ? "meets" : "misses";
  return (
    <div className={METRIC} data-tone={tone}>
      <span className={METRIC_LABEL}>{label}</span>
      <span className={METRIC_TRACK} aria-hidden="true">
        <span className={METRIC_FILL} style={{ width: `${Math.round((value ?? 0) * 100)}%` }} />
        {threshold !== null && <span className={METRIC_MARK} style={{ left: `${Math.round(threshold * 100)}%` }} />}
      </span>
      <span className={METRIC_VALUE}>
        <strong className="numeric">{percent(value)}</strong>
        {threshold !== null && (
          <span className="text-xs text-muted numeric">
            {" / "}
            {ceiling ? "≤" : "≥"}
            {percent(threshold)}
          </span>
        )}
        {meets !== null && (
          <span className={METRIC_WORD}>{meets ? t("quality.report.meets", "meets") : ceiling ? t("quality.report.above", "above") : t("quality.report.below", "below")}</span>
        )}
      </span>
    </div>
  );
}

/** Each question: what it expected, and per compared profile whether that was found and where — or what came instead. */
function QuestionTable({ report, profileName }: { report: Report; profileName: (profileId: string) => string }) {
  const { t } = useTranslation();
  const { run, questions, documents } = report;
  const selections = run.summaries.map((summary) => summary.selection);
  const keyOf = (selection: { profileId: string; mode: string }) => `${selection.profileId}:${selection.mode}`;
  const questionIds = [...new Set(run.results.map((result) => result.questionId))];
  const resultOf = (questionId: string, selectionKey: string) =>
    run.results.find((result) => result.questionId === questionId && keyOf(result.selection) === selectionKey);

  return (
    <section aria-labelledby="run-questions">
      <h3 id="run-questions" className={SECTION_TITLE}>
        {t("quality.report.questions", "Questions · {count}", { count: questionIds.length })}
      </h3>
      {questionIds.length === 0 ? (
        <p className="text-xs text-muted">{t("quality.report.noQuestions", "This run searched no question.")}</p>
      ) : (
        <div className={TABLE_SURFACE}>
          <Table>
            <thead>
              <tr>
                <th scope="col">{t("quality.detail.question", "Question")}</th>
                <th scope="col">{t("quality.report.expected", "Expected")}</th>
                {selections.map((selection) => (
                  <th key={keyOf(selection)} scope="col">
                    {profileName(selection.profileId)}
                    <span className="text-xs text-muted"> · {labelOfCode(RETRIEVAL_MODES, selection.mode)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {questionIds.map((questionId) => {
                const question = questions.get(questionId);
                return (
                  <tr key={questionId}>
                    <td className={QUESTION_CELL}>
                      {question !== undefined && <div>{question.text}</div>}
                      <span className="numeric text-xs text-muted">{questionId}</span>
                    </td>
                    <td className={DOCUMENT_CELL}>
                      {question === undefined ? (
                        "—"
                      ) : question.expectation === "EMPTY" ? (
                        <span className="text-xs text-secondary">{t("quality.report.expectsNothing", "Nothing")}</span>
                      ) : (
                        question.relevant.map((target) => <DocumentName key={target.documentId} documentId={target.documentId} documents={documents} />)
                      )}
                    </td>
                    {selections.map((selection) => (
                      <td key={keyOf(selection)} className={DOCUMENT_CELL}>
                        <Outcome result={resultOf(questionId, keyOf(selection))} question={question} documents={documents} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}
    </section>
  );
}

function DocumentName({ documentId, documents }: { documentId: string; documents: Map<string, RunDocument> }) {
  const document = documents.get(documentId);
  if (document === undefined) {
    return <span className="numeric text-xs">{documentId.slice(0, 8)}</span>;
  }
  return (
    <span className={DOCUMENT_NAME}>
      <Link to="/documents/$documentId" params={{ documentId }} className={ROW_LINK}>
        {document.title}
      </Link>
      <span className="text-xs text-muted">
        <PathText path={document.externalId} fit="middle" />
      </span>
    </span>
  );
}

/** What one search of one question did: found the expected document at a rank, or missed it and found others. */
function Outcome({ result, question, documents }: { result: RunResult | undefined; question: EvaluationQuestion | undefined; documents: Map<string, RunDocument> }) {
  const { t } = useTranslation();
  if (result === undefined) {
    return <span className="text-xs text-muted">—</span>;
  }
  if (result.failure !== null || result.assessment === null) {
    return <span className={OUTCOME_MISSED}>{labelOfCode(RUN_REASONS, result.failure ?? "SEARCH_FAILED")}</span>;
  }
  const assessment = result.assessment;
  const returned: string[] = [];
  for (const reference of assessment.references) {
    if (reference.citation !== null && !returned.includes(reference.citation.documentId)) {
      returned.push(reference.citation.documentId);
    }
  }
  if (question?.expectation === "EMPTY") {
    return assessment.unexpectedResponse === true ? (
      <span className={OUTCOME_MISSED}>{t("quality.report.answeredAnyway", "Found {count} documents anyway", { count: returned.length })}</span>
    ) : (
      <span className={OUTCOME_FOUND}>{t("quality.report.foundNothing", "Found nothing, as expected")}</span>
    );
  }
  const expected = new Set(question?.relevant.map((target) => target.documentId) ?? []);
  const rank = returned.findIndex((documentId) => expected.has(documentId));
  if (assessment.foundRelevantDocuments > 0 && rank >= 0) {
    return (
      <span className={OUTCOME_FOUND}>
        {t("quality.report.foundAt", "Found at rank {rank}", { rank: rank + 1 })}
        {assessment.relevantDocuments > 1 &&
          ` · ${t("quality.report.foundOf", "{found} of {expected}", { found: assessment.foundRelevantDocuments, expected: assessment.relevantDocuments })}`}
      </span>
    );
  }
  const instead = returned.filter((documentId) => !expected.has(documentId)).slice(0, FOUND_INSTEAD);
  return (
    <div className={OUTCOME}>
      <span className={OUTCOME_MISSED}>{t("quality.report.notFound", "Not found")}</span>
      {instead.length === 0 ? (
        <span className="text-xs text-muted">{t("quality.report.nothingReturned", "The search returned nothing.")}</span>
      ) : (
        <>
          <span className="text-xs text-secondary">{t("quality.report.foundInstead", "Found instead:")}</span>
          <ol className={INSTEAD}>
            {instead.map((documentId) => (
              <li key={documentId}>
                <DocumentName documentId={documentId} documents={documents} />
              </li>
            ))}
          </ol>
        </>
      )}
      <span className="text-xs text-muted">{t("quality.milliseconds", "{count} ms", { count: formatNumber(result.elapsedMilliseconds) })}</span>
    </div>
  );
}

/** Each lifecycle event of a run, the usage it saw, and its outcome — rendered only once the journal is opened. */
function RunEvents({ workspaceId, runId }: { workspaceId: string; runId: string }) {
  const { t, plural } = useTranslation();
  const events = usePagedList((page) => evaluationApi.events(workspaceId, runId, page), [workspaceId, runId]);
  if (events.status === "loading") {
    return <Waiting label={t("quality.events.loading", "Loading the event journal")} lines={2} />;
  }
  if (events.status === "failed") {
    return <ProblemState layout="section" problem={events.problem} />;
  }
  if (events.items.length === 0) {
    return <p className="text-xs text-muted">{t("quality.events.empty", "No event was journaled for this run.")}</p>;
  }
  return (
    <div className={TABLE_SURFACE}>
      <Table>
        <thead>
          <tr>
            <th scope="col">{t("quality.events.event", "Event")}</th>
            <th scope="col" className="numeric">
              {t("quality.events.searches", "Searches")}
            </th>
            <th scope="col" className="numeric">
              {t("quality.events.embeddingCalls", "Embedding calls")}
            </th>
            <th scope="col" className="numeric">
              {t("quality.events.knownTokens", "Known tokens")}
            </th>
            <th scope="col">{t("quality.column.outcome", "Outcome")}</th>
          </tr>
        </thead>
        <tbody>
          {events.items.map((event) => (
            <tr key={event.id}>
              <td className="text-xs">{labelOfCode(RUNTIME_EVENT_TYPES, event.type)}</td>
              <td className="numeric">{event.metadata.completedSearches}</td>
              <td className="numeric">{event.metadata.embeddingCalls}</td>
              <td className="numeric">
                {event.metadata.knownInputTokens}
                {event.metadata.unknownUsage && <div className="text-xs text-muted">{t("quality.events.unknownUsage", "plus unknown usage")}</div>}
              </td>
              <td>
                <Badge tone={event.outcome === "ERROR" ? "error" : "neutral"}>{labelOfCode(STAGE_OUTCOMES, event.outcome)}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <ListFooter
        shown={events.items.length}
        counted={plural("quality.events.count", events.items.length, { one: "{count} event", other: "{count} events" })}
        hasMore={events.hasMore}
        loadingMore={events.loadingMore}
        moreProblem={events.moreProblem}
        onLoadMore={events.loadMore}
      />
    </div>
  );
}
