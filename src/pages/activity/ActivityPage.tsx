import { useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { usePermissions } from "../../access/PermissionsProvider";
import { PERMISSIONS } from "../../access/permissions";
import type { ActivityTab } from "../../application/routeTabs";
import { MODEL_CALL_STATES, RUNTIME_EVENT_TYPES, STAGE_OUTCOMES } from "../../application/codeLabels";
import { formatDateTime, formatNumber, labelOfCode, shortIdentifier } from "../../application/format";
import { describeProblem } from "../../application/problems";
import { useReadySession } from "../../application/session";
import { usePagedList } from "../../application/usePagedList";
import { usePageTitle } from "../../application/usePageTitle";
import { useResource } from "../../application/useResource";
import { Can } from "../../access/Can";
import { RERANK_STATE, rerankReasonText } from "../../application/rerank";
import { answersApi, type AnswerCall, type JournalEvent, type JournalKind } from "../../lib/answers";
import type { RerankState } from "../../lib/contracts";
import { collectAllPages } from "../../lib/api";
import { profilesApi, type ProfileKind } from "../../lib/profiles";
import { declareText, type DeclaredText } from "../../translations/translate";
import { useTranslation, type Translation } from "../../translations/TranslationProvider";
import { EmptyState, ListFooter, PageHeader, ProblemState, RowName, TabPanel, Tabs, Waiting, useToaster } from "../../ui/components";
import { Badge, Button, Table } from "../../ui/primitives";
import { CALL_TONE } from "./callTones";
import { useAddressChange } from "../../application/useAddressChange";

/* The surface a journal table sits on. A failed run is marked on its first cell, so a row that went
   wrong is found down the left edge rather than by reading every status column. */
const SURFACE = [
  "overflow-x-auto rounded-surface border border-line bg-surface",
  "[&_tr[data-failed=true]_td:first-child]:shadow-[inset_2px_0_0_var(--danger)]",
].join(" ");

/* The steps of one run, in the order they happened, hung off a single rule. */
const RUN_STEPS = [
  "m-0 grid list-none gap-[calc(2px*var(--ui-scale))] border-l border-l-line-strong pl-4",
  "[&>li]:flex [&>li]:flex-wrap [&>li]:items-baseline [&>li]:gap-3 [&>li]:whitespace-normal",
  "[&>li[data-failed=true]]:text-danger",
].join(" ");

type JournalTab = Exclude<ActivityTab, "calls" | "reranks">;

interface JournalDescription {
  tab: JournalTab;
  kind: JournalKind;
  profileKind: ProfileKind;
  identity: string;
  counts: [string, DeclaredText][];
}

const CHARACTERS = declareText("activity.count.characters", "Characters");

const JOURNAL_OF: Record<JournalTab, JournalDescription> = {
  searches: {
    tab: "searches",
    kind: "search-events",
    profileKind: "search",
    identity: "queryId",
    counts: [
      ["queryCharacters", CHARACTERS],
      ["resultCount", declareText("activity.count.results", "Results")],
    ],
  },
  context: {
    tab: "context",
    kind: "context-events",
    profileKind: "context",
    identity: "contextId",
    counts: [
      ["requestedCount", declareText("activity.count.asked", "Asked")],
      ["candidateCount", declareText("activity.count.candidates", "Candidates")],
      ["fragmentCount", declareText("activity.count.fragments", "Fragments")],
      ["returnedCodePoints", CHARACTERS],
    ],
  },
  answers: {
    tab: "answers",
    kind: "answer-events",
    profileKind: "answer",
    identity: "answerId",
    counts: [
      ["sourceCount", declareText("activity.count.sources", "Sources")],
      ["callCount", declareText("activity.count.calls", "Model calls")],
    ],
  },
  reads: {
    tab: "reads",
    kind: "original-read-events",
    profileKind: "read",
    identity: "readId",
    counts: [
      ["startOffset", declareText("activity.count.from", "From")],
      ["returnedCodePoints", CHARACTERS],
    ],
  },
};

/** "from 12 search events" — how many events a page of runs was gathered from, worded per journal. */
function gatheredFrom(tab: JournalTab, count: number, { plural }: Translation): string {
  switch (tab) {
    case "searches":
      return plural("activity.gathered.searches", count, { one: "from {count} search event", other: "from {count} search events" });
    case "context":
      return plural("activity.gathered.context", count, { one: "from {count} context event", other: "from {count} context events" });
    case "answers":
      return plural("activity.gathered.answers", count, { one: "from {count} answer event", other: "from {count} answer events" });
    case "reads":
      return plural("activity.gathered.reads", count, { one: "from {count} read event", other: "from {count} read events" });
  }
}

/**
 * Everything the runtime did, step by step: every search, every context assembled, every answer and
 * every original read — with who asked, which profile revision answered, and the scripts that ran.
 */
export function ActivityPage() {
  const { t } = useTranslation();
  usePageTitle(t("activity.title", "Activity"));
  const { workspace } = useReadySession();
  const workspaceId = workspace?.id ?? "";
  const search = useSearch({ strict: false }) as { tab?: ActivityTab };
  const changeAddress = useAddressChange();
  const tab: ActivityTab = search.tab ?? "searches";
  // Rerank calls are read from the retrieval diagnostics, which need automation read access.
  const permissions = usePermissions();
  const mayReadRerankCalls = !permissions.loading && permissions.may(PERMISSIONS.automationRead);

  return (
    <>
      <PageHeader
        eyebrow={t("activity.eyebrow", "Pipeline")}
        title={t("activity.title", "Activity")}
        lead={t("activity.lead", "The journals: each step of every search, context, answer and read, as it happened.")}
      />
      <Tabs<ActivityTab>
        label={t("activity.journal", "Journal")}
        active={tab}
        onSelect={(next) => {
          void changeAddress({ to: "/activity", search: { tab: next === "searches" ? undefined : next } });
        }}
        items={[
          { key: "searches", label: t("activity.tab.searches", "Searches") },
          { key: "context", label: t("activity.tab.context", "Context") },
          { key: "answers", label: t("activity.tab.answers", "Answers") },
          { key: "reads", label: t("activity.tab.reads", "Original reads") },
          { key: "calls", label: t("activity.count.calls", "Model calls") },
          ...(mayReadRerankCalls ? [{ key: "reranks" as const, label: t("activity.tab.reranks", "Rerank calls") }] : []),
        ]}
      />
      <TabPanel tabKey={tab}>
        {tab === "calls" ? (
          <AnswerCallsJournal workspaceId={workspaceId} />
        ) : tab === "reranks" ? (
          <Can permission={PERMISSIONS.automationRead}>
            <RerankCallsJournal workspaceId={workspaceId} />
          </Can>
        ) : (
          <Journal key={tab} workspaceId={workspaceId} description={JOURNAL_OF[tab]} />
        )}
      </TabPanel>
    </>
  );
}

/** The rerank stage's outcome in one run of search steps: applied, skipped or fell back, with why. */
function rerankOutcomeOf(events: JournalEvent[]): { state: RerankState; reason: string | null } | null {
  for (const event of events) {
    const detail = typeof event.detail === "string" ? event.detail : null;
    if (event.type === "AFTER_RERANK") {
      return { state: "APPLIED", reason: null };
    }
    if (event.type === "RERANK_FALLBACK") {
      return { state: "FELL_BACK", reason: detail };
    }
    if (event.type === "RERANK_SKIPPED") {
      return { state: "SKIPPED", reason: detail };
    }
  }
  return null;
}

/** Every rerank model request a search made: model, candidates, latency and outcome — never the texts sent. */
function RerankCallsJournal({ workspaceId }: { workspaceId: string }) {
  const { t, plural } = useTranslation();
  const calls = usePagedList((page) => answersApi.rerankCalls(workspaceId, page), [workspaceId]);
  if (calls.status === "loading") {
    return <Waiting label={t("activity.reranks.loading", "Loading rerank calls")} lines={4} />;
  }
  if (calls.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={calls.problem}
        actions={
          <Button icon="refresh" onClick={calls.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }
  if (calls.items.length === 0) {
    return (
      <EmptyState
        title={t("activity.reranks.empty", "No rerank call yet")}
        description={t(
          "activity.reranks.emptyDescription",
          "A search profile with a rerank stage records each request here before it is sent.",
        )}
      />
    );
  }
  return (
    <div className={SURFACE}>
      <Table>
        <thead>
          <tr>
            <th scope="col">{t("activity.column.when", "When")}</th>
            <th scope="col">{t("activity.column.model", "Model")}</th>
            <th scope="col">{t("activity.column.outcome", "Outcome")}</th>
            <th scope="col" className="numeric">
              {t("activity.reranks.candidatesKept", "Candidates → kept")}
            </th>
            <th scope="col" className="numeric">
              {t("activity.reranks.latency", "Latency")}
            </th>
            <th scope="col" className="numeric">
              {t("activity.column.tokens", "Tokens")}
            </th>
          </tr>
        </thead>
        <tbody>
          {calls.items.map((call) => (
            <tr key={call.id}>
              <td className="text-xs text-secondary">
                {formatDateTime(call.createdAt)}
                <div className="numeric text-muted">
                  {t("activity.reranks.query", "query {identifier}", { identifier: shortIdentifier(call.queryId) })}
                </div>
              </td>
              <td>
                <span className="numeric text-xs">{call.model}</span>
                <div className="text-xs text-muted">{call.protocol}</div>
              </td>
              <td className="wraps">
                <Badge tone={CALL_TONE[call.state]}>{labelOfCode(MODEL_CALL_STATES, call.state)}</Badge>
                {call.failureCode !== null && (
                  <div className="text-xs text-secondary">
                    {rerankReasonText(call.failureCode)}
                    {call.providerStatus === null ? "" : ` · HTTP ${call.providerStatus}`}
                  </div>
                )}
              </td>
              <td className="numeric">
                {formatNumber(call.candidates)} → {call.kept === null ? "—" : formatNumber(call.kept)}
              </td>
              <td className="numeric">
                {call.latencyMilliseconds === null
                  ? "—"
                  : t("activity.milliseconds", "{count} ms", { count: formatNumber(call.latencyMilliseconds) })}
              </td>
              <td
                className="numeric"
                title={t(
                  "activity.reranks.tokensTitle",
                  "Reported by the provider; the prediction is an upper estimate of one token per code point",
                )}
              >
                {call.reportedTokens === null ? "—" : formatNumber(call.reportedTokens)}
                <div className="text-xs text-muted">
                  {t("activity.reranks.predicted", "of {count} predicted", { count: formatNumber(call.predictedTokens) })}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <ListFooter
        shown={calls.items.length}
        counted={plural("activity.calls.count", calls.items.length, { one: "{count} call", other: "{count} calls" })}
        hasMore={calls.hasMore}
        loadingMore={calls.loadingMore}
        moreProblem={calls.moreProblem}
        onLoadMore={calls.loadMore}
      />
    </div>
  );
}

interface JournalRun {
  identifier: string;
  events: JournalEvent[];
}

/**
 * Events of one search, read or answer belong together. The journal already arrives newest run first, with
 * each run's events in the order they happened, so grouping keeps that order.
 */
function groupByRun(events: JournalEvent[], identity: string): JournalRun[] {
  const runs = new Map<string, JournalEvent[]>();
  for (const event of events) {
    const identifier = typeof event[identity] === "string" ? (event[identity] as string) : event.id;
    runs.set(identifier, [...(runs.get(identifier) ?? []), event]);
  }
  return [...runs.entries()].map(([identifier, runEvents]) => ({ identifier, events: runEvents }));
}

function Journal({ workspaceId, description }: { workspaceId: string; description: JournalDescription }) {
  const translation = useTranslation();
  const { t, plural, say } = translation;
  const events = usePagedList((page) => answersApi.journal(workspaceId, description.kind, page), [workspaceId, description.kind]);
  // Profile names when the reader may see profiles; otherwise the row falls back to the revision alone.
  const profiles = useResource(
    () => collectAllPages((page) => profilesApi.list(workspaceId, description.profileKind, page)).catch(() => []),
    [workspaceId, description.profileKind],
  );
  const profileNameOf = (profileId: unknown): string | null =>
    profiles.status === "ready" ? (profiles.data.find((profile) => profile.id === profileId)?.name ?? null) : null;
  const [openedId, setOpenedId] = useState<string | null>(null);
  if (events.status === "loading") {
    return <Waiting label={t("activity.journal.loading", "Loading the journal")} lines={5} />;
  }
  if (events.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={events.problem}
        actions={
          <Button icon="refresh" onClick={events.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }
  if (events.items.length === 0) {
    return (
      <EmptyState
        title={t("activity.journal.empty", "Nothing recorded yet")}
        description={t("activity.journal.emptyDescription", "Each step is recorded here as it runs.")}
      />
    );
  }
  const runs = groupByRun(events.items, description.identity);
  return (
    <div className={SURFACE}>
      <Table>
        <thead>
          <tr>
            <th scope="col">{t("activity.column.run", "Run")}</th>
            <th scope="col">{t("activity.column.steps", "Steps")}</th>
            <th scope="col">{t("activity.column.actor", "Actor")}</th>
            {description.counts.map(([field, label]) => (
              <th key={field} scope="col" className="numeric">
                {say(label)}
              </th>
            ))}
            <th scope="col">{t("activity.column.ended", "Ended")}</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <RunRow
              key={run.identifier}
              run={run}
              profileName={profileNameOf(run.events[run.events.length - 1]?.profileId)}
              counts={description.counts}
              opened={openedId === run.identifier}
              onToggle={() => setOpenedId(openedId === run.identifier ? null : run.identifier)}
            />
          ))}
        </tbody>
      </Table>
      <ListFooter
        shown={runs.length}
        counted={plural("activity.runs.count", runs.length, { one: "{count} run", other: "{count} runs" })}
        gathered={gatheredFrom(description.tab, events.items.length, translation)}
        hasMore={events.hasMore}
        loadingMore={events.loadingMore}
        moreProblem={events.moreProblem}
        onLoadMore={events.loadMore}
      />
    </div>
  );
}

function RunRow({
  run,
  profileName,
  counts,
  opened,
  onToggle,
}: {
  run: JournalRun;
  profileName: string | null;
  counts: [string, DeclaredText][];
  opened: boolean;
  onToggle: () => void;
}) {
  const { t, plural, say } = useTranslation();
  const viewerId = useReadySession().viewer.subjectId;
  const last = run.events[run.events.length - 1];
  if (last === undefined) {
    return null;
  }
  const failed = run.events.some((event) => event.type === "FAILED" || event.outcome === "ERROR");
  const scripts = run.events.reduce((total, event) => total + event.executions.length, 0);
  const rerank = rerankOutcomeOf(run.events);
  const rerankReason = rerankReasonText(rerank?.reason);
  const steps = plural("activity.run.steps", run.events.length, { one: "{count} step", other: "{count} steps" });
  return (
    <>
      <tr data-failed={failed}>
        <td>
          <RowName selected={opened} onSelect={onToggle}>
            {profileName ?? t("activity.run.aProfile", "A profile")}{" "}
            <span className="text-xs text-muted">
              {t("activity.run.revision", "revision {revision}", { revision: last.profileRevision })}
            </span>
          </RowName>
          <div className="numeric text-xs text-muted" title={run.identifier}>
            {shortIdentifier(run.identifier)}
          </div>
        </td>
        <td className="text-xs text-secondary">
          {scripts > 0
            ? t("activity.run.stepsAndScripts", "{steps} · {scripts}", {
                steps,
                scripts: plural("activity.run.scripts", scripts, { one: "{count} script", other: "{count} scripts" }),
              })
            : steps}
          {rerank !== null && (
            <div title={rerankReason ?? undefined}>
              <Badge tone={RERANK_STATE[rerank.state].tone}>{RERANK_STATE[rerank.state].word}</Badge>
              {rerankReason !== null && <span className="text-xs text-secondary"> {rerankReason}</span>}
            </div>
          )}
        </td>
        <td className="text-xs text-secondary">
          {last.actorId === viewerId ? t("activity.run.you", "you") : <span className="numeric">{shortIdentifier(last.actorId)}</span>}
        </td>
        {counts.map(([field]) => {
          const value = last[field];
          return (
            <td key={field} className="numeric">
              {typeof value === "number" ? formatNumber(value) : "—"}
            </td>
          );
        })}
        <td>
          {failed ? (
            <Badge tone="error">{t("activity.run.failed", "Failed")}</Badge>
          ) : last.type === "COMPLETED" ? (
            <Badge tone="good">{t("activity.run.completed", "Completed")}</Badge>
          ) : (
            <span
              title={t(
                "activity.run.notFinishedTitle",
                "The last step loaded is {step}; its other steps are older than this page, or it is still running.",
                { step: labelOfCode(RUNTIME_EVENT_TYPES, last.type).toLowerCase() },
              )}
            >
              <Badge tone="neutral">{t("activity.run.notFinished", "Not finished here")}</Badge>
            </span>
          )}
        </td>
      </tr>
      {opened && (
        <tr>
          <td colSpan={4 + counts.length} className="bg-well">
            <ol className={RUN_STEPS}>
              {run.events.map((event) => (
                <li key={event.id} data-failed={event.type === "FAILED" || event.outcome === "ERROR"}>
                  <span className="numeric text-xs">{event.type}</span>
                  {typeof event.detail === "string" && <span className="text-xs text-secondary">{rerankReasonText(event.detail)}</span>}
                  {counts.map(([field, label]) => {
                    const value = event[field];
                    return typeof value === "number" && value > 0 ? (
                      <span key={field} className="text-xs text-muted">
                        {say(label).toLowerCase()} {formatNumber(value)}
                      </span>
                    ) : null;
                  })}
                  {event.executions.map((execution) => (
                    <span key={execution.scriptVersionId} className="text-xs">
                      {t("activity.run.script", "script {identifier} {outcome}", {
                        identifier: shortIdentifier(execution.scriptVersionId),
                        outcome: labelOfCode(STAGE_OUTCOMES, execution.outcome).toLowerCase(),
                      })}
                    </span>
                  ))}
                </li>
              ))}
            </ol>
          </td>
        </tr>
      )}
    </>
  );
}

function needsAcknowledgement(call: AnswerCall): boolean {
  return call.state === "UNKNOWN" || (call.state === "RESERVED" && new Date(call.expiresAt).getTime() < Date.now());
}

/** Every model call an answer reserved before it was made — and the uncertain ones someone must settle. */
function AnswerCallsJournal({ workspaceId }: { workspaceId: string }) {
  const { t, plural } = useTranslation();
  const { notify } = useToaster();
  const permissions = usePermissions();
  const mayAcknowledge = permissions.may(PERMISSIONS.automationManage) && permissions.may(PERMISSIONS.systemWrite);
  const calls = usePagedList((page) => answersApi.answerCalls(workspaceId, page), [workspaceId]);
  if (calls.status === "loading") {
    return <Waiting label={t("activity.calls.loading", "Loading model calls")} lines={4} />;
  }
  if (calls.status === "failed") {
    return <ProblemState layout="section" problem={calls.problem} />;
  }
  if (calls.items.length === 0) {
    return (
      <EmptyState
        title={t("activity.calls.empty", "No model call yet")}
        description={t(
          "activity.calls.emptyDescription",
          "An answer profile with a model reserves each call here before making it, so none goes uncounted.",
        )}
      />
    );
  }
  const acknowledge = async (call: AnswerCall) => {
    try {
      await answersApi.acknowledgeAnswerCall(workspaceId, call.id);
      notify({ tone: "good", title: t("activity.calls.acknowledged", "Call acknowledged") });
      calls.reload();
    } catch (error) {
      const problem = describeProblem(error);
      notify({ tone: "error", title: problem.title, description: problem.detail ?? problem.description });
    }
  };
  return (
    <div className={SURFACE}>
      <Table>
        <thead>
          <tr>
            <th scope="col">{t("activity.column.when", "When")}</th>
            <th scope="col">{t("activity.column.model", "Model")}</th>
            <th scope="col">{t("activity.column.state", "State")}</th>
            <th scope="col" className="numeric">
              {t("activity.calls.predictedIn", "Predicted in")}
            </th>
            <th scope="col" className="numeric">
              {t("activity.calls.inOut", "In / out")}
            </th>
            <th scope="col">
              <span className="sr-only">{t("common.actions", "Actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {calls.items.map((call) => (
            <tr key={call.id}>
              <td className="text-xs text-secondary">
                {formatDateTime(call.createdAt)}
                <div className="numeric text-muted">
                  {t("activity.calls.answer", "answer {identifier}", { identifier: shortIdentifier(call.answerId) })}
                </div>
              </td>
              <td className="numeric text-xs">{call.model}</td>
              <td>
                <Badge tone={CALL_TONE[call.state]}>{labelOfCode(MODEL_CALL_STATES, call.state)}</Badge>
              </td>
              <td className="numeric">{formatNumber(call.predictedInputTokens)}</td>
              <td className="numeric">
                {call.inputTokens === null ? "—" : formatNumber(call.inputTokens)} / {call.outputTokens === null ? "—" : formatNumber(call.outputTokens)}
              </td>
              <td className="actions">
                {mayAcknowledge && needsAcknowledgement(call) && (
                  <Button variant="quiet" onClick={() => void acknowledge(call)}>
                    {t("activity.calls.acknowledge", "Acknowledge")}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <ListFooter
        shown={calls.items.length}
        counted={plural("activity.calls.count", calls.items.length, { one: "{count} call", other: "{count} calls" })}
        hasMore={calls.hasMore}
        loadingMore={calls.loadingMore}
        moreProblem={calls.moreProblem}
        onLoadMore={calls.loadMore}
      />
    </div>
  );
}
