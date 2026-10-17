import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { usePermissions } from "../../access/PermissionsProvider";
import { PERMISSIONS } from "../../access/permissions";
import { formatDateTime, formatNumber, labelOfCode } from "../../application/format";
import { JOB_KINDS, JOB_STATUSES } from "../jobs/jobLabels";
import { useReadySession } from "../../application/session";
import { usePolling } from "../../application/usePolling";
import { useResource } from "../../application/useResource";
import { administrationApi, type InstallationOverview } from "../../lib/administration";
import { aiApi, type ProviderConfiguration } from "../../lib/ai";
import { api, collectAllPages } from "../../lib/api";
import { translate, translatePlural } from "../../translations/translate";
import { useTranslation } from "../../translations/TranslationProvider";
import { ProblemState, Waiting } from "../../ui/components";
import { Badge, Button, Icon, type BadgeTone, type IconName } from "../../ui/primitives";

/* Administration overview — the answer first (what needs attention), then four standing panels. */

const OVERVIEW = "grid min-w-0 gap-6";

/* ⚠️ THE LEADING EDGE IS THE ANSWER: red while something needs attention, blue once nothing does.
   It is the first thing read on the screen and the only place the verdict is stated as a colour —
   the list under it says the same in words. */
const ATTENTION = [
  "rounded-surface border border-line border-l-[3px] border-l-deny bg-surface",
  "data-[calm=true]:border-l-allow",
].join(" ");

const ATTENTION_HEAD = [
  "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-3",
  "[&_h2]:text-base [&>span]:inline-flex [&>span]:items-center [&>span]:gap-1",
].join(" ");

const CALM_LINE = "m-0 flex flex-wrap items-center gap-3 px-4 py-3 text-sm text-secondary";

const ATTENTION_LIST = "m-0 list-none p-0";

/* A refusing finding is tinted as well as marked, but only lightly — the panel is a list of things to
   do, not a wall of red. On a phone the three columns become one and everything starts on the left. */
const ATTENTION_ITEM = [
  "grid grid-cols-[calc(84px*var(--ui-scale))_minmax(0,1fr)_auto] items-center gap-3",
  "border-b border-line px-4 py-3 last:border-b-0",
  "data-[severity=deny]:bg-[color-mix(in_srgb,var(--deny-soft)_45%,var(--surface))]",
  "max-[600px]:grid-cols-[minmax(0,1fr)] max-[600px]:justify-items-start max-[600px]:gap-2",
].join(" ");

const ATTENTION_TEXT = "grid min-w-0 gap-[calc(2px*var(--ui-scale))] [&_strong]:text-sm";

/** The way to the screen that fixes it, or to the panel's own screen: a link that reads as a label. */
const QUIET_LINK = [
  "inline-flex items-center gap-1 text-sm font-[550] whitespace-nowrap text-accent-text",
  "no-underline hover:underline",
].join(" ");

const PANELS = "grid grid-cols-2 gap-4 max-[1100px]:grid-cols-[minmax(0,1fr)]";

const PANEL = "min-w-0 rounded-surface border border-line bg-surface";

const PANEL_HEAD = [
  "flex items-center justify-between gap-3 border-b border-line px-4 py-3",
  "[&_h2]:flex [&_h2]:items-center [&_h2]:gap-2 [&_h2]:text-sm",
].join(" ");

const ROWS = "m-0";

/* ⚠️ `[&>dd>:first-child]` IS THE BADGE A VALUE SITS IN, and it is told to wrap: a provider and its
   model together are long enough to widen the whole panel otherwise. */
const ROW = [
  "grid grid-cols-[calc(150px*var(--ui-scale))_minmax(0,1fr)] items-baseline gap-3",
  "border-b border-line px-4 py-2 last:border-b-0",
  "[&>dt]:text-xs [&>dt]:text-muted",
  "[&>dd]:m-0 [&>dd]:grid [&>dd]:min-w-0 [&>dd]:justify-items-start [&>dd]:gap-[calc(3px*var(--ui-scale))]",
  "[&>dd>:first-child]:max-w-full [&>dd>:first-child]:whitespace-normal",
  "[&>dd>:first-child]:[font-variant-numeric:tabular-nums]",
  "max-[600px]:grid-cols-[minmax(0,1fr)] max-[600px]:gap-1",
].join(" ");

const NOTE = "text-xs text-secondary";

/** The page reads itself again this often, so a worker dying or a job failing shows without a reload. */
const REFRESH_MILLISECONDS = 15000;

/** Queued work older than this is not moving: nothing is claiming it. */
const STALLED_QUEUE_MILLISECONDS = 10 * 60 * 1000;

interface Attention {
  key: string;
  severity: "deny" | "warn";
  title: string;
  detail: string;
  action: { label: string; to: string; search?: Record<string, string> };
}

/**
 * What an installation administrator opens the area for: is anything broken or waiting on me right
 * now, and is the installation healthy. The answer comes first — a ranked list of what needs
 * attention, each with the one place that resolves it — and the four standing panels after it.
 */
export function OverviewPanel() {
  const permissions = usePermissions();
  const { t } = useTranslation();
  const maySystem = permissions.may(PERMISSIONS.systemRead);

  if (!maySystem) {
    return (
      <p className="text-xs text-secondary">
        {t(
          "administration.overview.needsSystemRead",
          "The installation overview needs system read. The sections in the column beside this one are the ones you may open.",
        )}
      </p>
    );
  }
  return <InstallationOverviewPanel />;
}

function InstallationOverviewPanel() {
  const { workspace } = useReadySession();
  const { t } = useTranslation();
  const permissions = usePermissions();
  const mayMembers = permissions.may(PERMISSIONS.workspaceMembers);
  const overview = useResource(() => administrationApi.overview(), []);
  const providers = useResource(() => aiApi.configurations().then((stored) => stored.configurations), []);
  const members = useResource(
    () => (mayMembers && workspace !== null ? collectAllPages((page) => api.listMembers(workspace.id, page)).then((all) => all.length) : Promise.resolve(null)),
    [mayMembers, workspace?.id],
  );
  usePolling(overview.status === "ready", overview.reload, overview.status === "ready" ? overview.data.readAt : null, REFRESH_MILLISECONDS);

  if (overview.status === "loading") {
    return <Waiting label={t("administration.overview.loading", "Reading the installation")} lines={8} />;
  }
  if (overview.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={overview.problem}
        actions={
          <Button icon="refresh" onClick={overview.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }

  const data = overview.data;
  const configurations = providers.status === "ready" ? providers.data : null;
  const attention = attentionOf(data, configurations);
  const now = Date.parse(data.readAt);

  return (
    <div className={OVERVIEW}>
      <AttentionList items={attention} readAt={data.readAt} onRefresh={overview.reload} />

      <div className={PANELS}>
        <Panel
          title={t("administration.overview.processes", "Processes and background work")}
          icon="jobs"
          to="/administration/$section"
          section="jobs"
          linkLabel={t("navigation.section.jobs.label", "Jobs")}
        >
          <Rows>
            <Row
              label="API"
              value={t("administration.overview.answering", "Answering")}
              tone="allow"
              note={t("administration.overview.answeringNote", "This page was read from it.")}
            />
            {data.workers.length === 0 ? (
              <Row
                label={t("administration.overview.worker", "Worker")}
                value={t("administration.overview.neverSeen", "Never seen")}
                tone="deny"
                note={t(
                  "administration.overview.neverSeenNote",
                  "No worker has reported in; scans, processing and vectorising wait.",
                )}
              />
            ) : (
              data.workers.map((worker) => (
                <Row
                  key={worker.identifier}
                  label={t("administration.overview.workerNamed", "Worker {identifier}", { identifier: worker.identifier })}
                  value={worker.alive ? t("administration.overview.alive", "Alive") : t("administration.overview.silent", "Silent")}
                  tone={worker.alive ? "allow" : "deny"}
                  note={t("administration.overview.workerNote", "Last seen {age}, reports every {seconds} s.", {
                    age: ageOf(worker.lastSeenAt, now),
                    seconds: Math.round(data.heartbeatMilliseconds / 1000),
                  })}
                />
              ))
            )}
            <Row
              label={t("administration.overview.running", "Running")}
              value={formatNumber(data.jobs.running)}
              tone={data.jobs.running > 0 ? "active" : "neutral"}
            />
            <Row
              label={t("administration.overview.queued", "Queued")}
              value={formatNumber(data.jobs.queued)}
              tone={isStalled(data, now) ? "warn" : "neutral"}
              note={
                data.jobs.oldestQueuedAt === null
                  ? undefined
                  : t("administration.overview.oldestWaiting", "Oldest waiting since {age}.", {
                      age: ageOf(data.jobs.oldestQueuedAt, now),
                    })
              }
            />
            <Row
              label={t("administration.overview.lastDay", "Last day")}
              value={t("administration.overview.lastDayValue", "{done} done · {failed} failed", {
                done: formatNumber(data.jobs.succeededLastDay),
                failed: formatNumber(data.jobs.failedLastDay),
              })}
              tone={data.jobs.failedLastDay > 0 ? "deny" : "allow"}
              note={
                Object.keys(data.jobs.failedByKindLastDay).length === 0
                  ? undefined
                  : Object.entries(data.jobs.failedByKindLastDay)
                      .map(([kind, count]) => `${labelOfCode(JOB_KINDS, kind)} ${count}`)
                      .join(" · ")
              }
            />
            <Row
              label={t("administration.overview.storageCheck", "Storage check")}
              value={
                data.storageVerification === null
                  ? t("administration.overview.neverRun", "Never run")
                  : labelOfCode(JOB_STATUSES, data.storageVerification.status)
              }
              tone={storageTone(data)}
              note={
                data.storageVerification === null
                  ? t("administration.overview.storageCheckNote", "Re-reads every stored original against its recorded hash.")
                  : t("administration.overview.lastRun", "Last run {date}.", {
                      date: formatDateTime(data.storageVerification.startedAt),
                    })
              }
            />
          </Rows>
        </Panel>

        <Panel
          title={t("administration.overview.models", "Models and their cost")}
          icon="model"
          to="/administration/$section"
          section="providers"
          linkLabel={t("navigation.section.providers.label", "AI providers")}
        >
          <Rows>
            <Row {...providerRow(t("administration.overview.embeddings", "Embeddings"), "EMBEDDINGS", configurations)} />
            <Row {...providerRow(t("administration.overview.chat", "Chat"), "CHAT", configurations)} />
            <Row
              label={t("administration.overview.unsettledSearch", "Unsettled search calls")}
              value={formatNumber(data.unresolvedCalls.queryEmbedding)}
              tone={data.unresolvedCalls.queryEmbedding > 0 ? "deny" : "allow"}
              note={t(
                "administration.overview.unsettledSearchNote",
                "Query embeddings with unknown cost block the same query until acknowledged.",
              )}
            />
            <Row
              label={t("administration.overview.unsettledAnswer", "Unsettled answer calls")}
              value={formatNumber(data.unresolvedCalls.answer)}
              tone={data.unresolvedCalls.answer > 0 ? "deny" : "allow"}
            />
            <Row
              label={t("administration.overview.unsettledVector", "Unsettled vector calls")}
              value={formatNumber(data.unresolvedCalls.vector)}
              tone={data.unresolvedCalls.vector > 0 ? "deny" : "allow"}
              note={t(
                "administration.overview.unsettledVectorNote",
                "A vector generation with an unknown call refuses to retry automatically.",
              )}
            />
          </Rows>
        </Panel>

        <Panel
          title={t("administration.overview.corpus", "Corpus, every workspace")}
          icon="layers"
          to="/administration/$section"
          section="workspaces"
          linkLabel={t("navigation.section.workspaces.label", "Workspaces")}
        >
          <Rows>
            <Row label={t("navigation.section.workspaces.label", "Workspaces")} value={formatNumber(data.corpus.workspaces)} />
            <Row
              label={t("navigation.item.sources.label", "Sources")}
              value={formatNumber(data.corpus.sources)}
              tone={data.corpus.disabledSources > 0 ? "warn" : "neutral"}
              note={
                data.corpus.disabledSources > 0
                  ? translatePlural("administration.overview.disabledSources", data.corpus.disabledSources, {
                      one: "{count} source disabled — not scanned.",
                      other: "{count} sources disabled — not scanned.",
                    })
                  : undefined
              }
            />
            <Row
              label={t("navigation.item.documents.label", "Documents")}
              value={t("administration.overview.searchableOf", "{searchable} searchable of {total}", {
                searchable: formatNumber(data.corpus.searchableDocuments),
                total: formatNumber(data.corpus.documents),
              })}
              tone={data.corpus.documents > 0 && data.corpus.searchableDocuments === 0 ? "warn" : "allow"}
              note={
                data.corpus.removedDocuments > 0
                  ? translatePlural("administration.overview.removedDocuments", data.corpus.removedDocuments, {
                      one: "{count} document removed from the corpus.",
                      other: "{count} documents removed from the corpus.",
                    })
                  : undefined
              }
            />
            <Row
              label={t("administration.overview.builtNotPublished", "Built, not published")}
              value={formatNumber(data.corpus.readyGenerations)}
              tone={data.corpus.readyGenerations > 0 ? "warn" : "neutral"}
              note={t(
                "administration.overview.builtNotPublishedNote",
                "Index generations search cannot read until someone publishes them.",
              )}
            />
            <Row
              label={t("administration.overview.vectorGenerations", "Vector generations")}
              value={t("administration.overview.published", "{count} published", {
                count: formatNumber(data.corpus.publishedVectorGenerations),
              })}
              tone={data.corpus.publishedVectorGenerations > 0 ? "allow" : "neutral"}
              note={vectorNote(data)}
            />
          </Rows>
        </Panel>

        <Panel
          title={t("administration.overview.people", "People and access")}
          icon="people"
          to="/administration/$section"
          section="accounts"
          linkLabel={t("navigation.section.accounts.label", "Accounts")}
        >
          <Rows>
            <Row
              label={t("navigation.section.accounts.label", "Accounts")}
              value={t("administration.overview.enabledOf", "{enabled} enabled of {total}", {
                enabled: formatNumber(data.people.enabledAccounts),
                total: formatNumber(data.people.accounts),
              })}
            />
            <Row
              label={t("administration.overview.apiCredentials", "API credentials")}
              value={t("administration.overview.inForce", "{count} in force", { count: formatNumber(data.people.activeCredentials) })}
              note={t(
                "administration.overview.apiCredentialsNote",
                "Keys issued to clients and agents; sign-in sessions are counted below.",
              )}
            />
            <Row
              label={t("administration.overview.expiringThisWeek", "Expiring this week")}
              value={formatNumber(data.people.credentialsExpiringThisWeek)}
              tone={data.people.credentialsExpiringThisWeek > 0 ? "warn" : "neutral"}
              note={
                data.people.credentialsExpiringThisWeek > 0
                  ? t(
                      "administration.overview.expiringNote",
                      "Issue replacements before the clients holding them stop working.",
                    )
                  : undefined
              }
            />
            <Row
              label={t("administration.overview.sessions", "Sign-in sessions")}
              value={t("administration.overview.open", "{count} open", { count: formatNumber(data.people.activeSessions) })}
            />
            {members.status === "ready" && members.data !== null && (
              <Row
                label={t("administration.overview.membersHere", "Members here")}
                value={formatNumber(members.data)}
                note={t("administration.overview.inWorkspace", "In {workspace}.", {
                  workspace: workspace?.name ?? t("administration.overview.thisWorkspace", "this workspace"),
                })}
              />
            )}
          </Rows>
        </Panel>
      </div>
    </div>
  );
}

function AttentionList({ items, readAt, onRefresh }: { items: Attention[]; readAt: string; onRefresh: () => void }) {
  const { t } = useTranslation();
  const readAgain = t("administration.overview.readAgain", "Read again now");
  return (
    <section className={ATTENTION} aria-labelledby="attention-title" data-calm={items.length === 0}>
      <header className={ATTENTION_HEAD}>
        <h2 id="attention-title">
          {items.length === 0
            ? t("administration.overview.nothingNeedsYou", "Nothing needs you")
            : t("administration.overview.needsAttention", "Needs attention · {count}", { count: items.length })}
        </h2>
        <span className="text-xs text-muted">
          {t("administration.overview.readAt", "Read {date} · refreshes by itself", { date: formatDateTime(readAt) })}
          <Button variant="quiet" iconOnly icon="refresh" aria-label={readAgain} title={readAgain} onClick={onRefresh} />
        </span>
      </header>
      {items.length === 0 ? (
        <p className={CALM_LINE}>
          <Badge tone="allow">{t("administration.overview.healthy", "Healthy")}</Badge>{" "}
          {t(
            "administration.overview.healthyDescription",
            "Workers are alive, nothing failed in the last day, and every paid call is settled.",
          )}
        </p>
      ) : (
        <ol className={ATTENTION_LIST}>
          {items.map((item) => (
            <li key={item.key} className={ATTENTION_ITEM} data-severity={item.severity}>
              <Badge tone={item.severity === "deny" ? "deny" : "warn"}>
                {item.severity === "deny"
                  ? t("administration.overview.broken", "Broken")
                  : t("administration.overview.waiting", "Waiting")}
              </Badge>
              <div className={ATTENTION_TEXT}>
                <strong>{item.title}</strong>
                <span className="text-xs text-secondary">{item.detail}</span>
              </div>
              <Link to={item.action.to} search={item.action.search} className={QUIET_LINK}>
                {item.action.label}
                <Icon name="arrow" size="small" />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Panel({
  title,
  icon,
  to,
  section,
  linkLabel,
  children,
}: {
  title: string;
  icon: IconName;
  to: "/administration/$section";
  section: string;
  linkLabel: string;
  children: ReactNode;
}) {
  const headingId = `panel-${section}`;
  return (
    <section className={PANEL} aria-labelledby={headingId}>
      <header className={PANEL_HEAD}>
        <h2 id={headingId}>
          <Icon name={icon} size="small" />
          {title}
        </h2>
        <Link to={to} params={{ section }} className={QUIET_LINK}>
          {linkLabel}
          <Icon name="arrow" size="small" />
        </Link>
      </header>
      {children}
    </section>
  );
}

function Rows({ children }: { children: ReactNode }) {
  return <dl className={ROWS}>{children}</dl>;
}

interface RowProperties {
  label: string;
  value: string;
  tone?: BadgeTone;
  note?: string;
}

/** One measured fact: what it is, its value carried by a word and a tone, and a line saying what it means. */
function Row({ label, value, tone = "neutral", note }: RowProperties) {
  return (
    <div className={ROW}>
      <dt>{label}</dt>
      <dd>
        <Badge tone={tone}>{value}</Badge>
        {note !== undefined && <span className={NOTE}>{note}</span>}
      </dd>
    </div>
  );
}

function providerRow(label: string, capability: "EMBEDDINGS" | "CHAT", configurations: ProviderConfiguration[] | null): RowProperties {
  if (configurations === null) {
    return { label, value: translate("administration.overview.reading", "Reading…") };
  }
  const inForce = configurations.filter((configuration) => configuration.active && configuration.capabilities.includes(capability));
  if (inForce.length === 0) {
    const available = configurations.filter((configuration) => configuration.capabilities.includes(capability)).length;
    return {
      label,
      value: translate("administration.overview.noneInForce", "None in force"),
      tone: "warn",
      note:
        available === 0
          ? translate("administration.overview.noConfiguration", "No configuration offers it yet.")
          : translatePlural("administration.overview.couldBeInForce", available, {
              one: "{count} configuration could be put in force.",
              other: "{count} configurations could be put in force.",
            }),
    };
  }
  return {
    label,
    value: inForce.map((configuration) => `${configuration.provider} · ${configuration.model}`).join(", "),
    tone: "allow",
  };
}

function storageTone(data: InstallationOverview): BadgeTone {
  if (data.storageVerification === null) {
    return "warn";
  }
  if (data.storageVerification.status === "FAILED") {
    return "deny";
  }
  if (data.storageVerification.status === "SUCCEEDED") {
    return "allow";
  }
  return "active";
}

function vectorNote(data: InstallationOverview): string | undefined {
  const parts: string[] = [];
  if (data.corpus.buildingVectorGenerations > 0) {
    parts.push(
      translate("administration.overview.building", "{count} building", {
        count: formatNumber(data.corpus.buildingVectorGenerations),
      }),
    );
  }
  if (data.corpus.withdrawnVectorGenerations > 0) {
    parts.push(
      translate("administration.overview.withdrawn", "{count} withdrawn", {
        count: formatNumber(data.corpus.withdrawnVectorGenerations),
      }),
    );
  }
  return parts.length === 0 ? undefined : parts.join(" · ");
}

function isStalled(data: InstallationOverview, now: number): boolean {
  return data.jobs.oldestQueuedAt !== null && now - Date.parse(data.jobs.oldestQueuedAt) > STALLED_QUEUE_MILLISECONDS;
}

/**
 * The ranked list: what is broken first (nothing will fix itself), then what waits on a decision.
 * Each item names the one place where it is resolved.
 */
function attentionOf(data: InstallationOverview, configurations: ProviderConfiguration[] | null): Attention[] {
  const items: Attention[] = [];
  const now = Date.parse(data.readAt);
  const silentWorkers = data.workers.filter((worker) => !worker.alive);
  const jobs = translate("navigation.section.jobs.label", "Jobs");
  const vectorGenerations = translate("administration.overview.vectorGenerations", "Vector generations");
  if (data.workers.length === 0 || silentWorkers.length === data.workers.length) {
    items.push({
      key: "worker",
      severity: "deny",
      title:
        data.workers.length === 0
          ? translate("administration.overview.noWorkerEver", "No worker has ever reported in")
          : translate("administration.overview.workerSilent", "The worker is silent"),
      detail: translate(
        "administration.overview.workerSilentDetail",
        "Scans, processing and vectorising queue up and never start. Start it with {command}.",
        { command: "./jm.sh up raccoon:worker" },
      ),
      action: { label: jobs, to: "/administration/jobs" },
    });
  }
  if (data.jobs.failedLastDay > 0) {
    items.push({
      key: "failed-jobs",
      severity: "deny",
      title: translatePlural("administration.overview.failedJobs", data.jobs.failedLastDay, {
        one: "{count} job failed in the last day",
        other: "{count} jobs failed in the last day",
      }),
      detail: Object.entries(data.jobs.failedByKindLastDay)
        .map(([kind, count]) => `${labelOfCode(JOB_KINDS, kind)} ${count}`)
        .join(" · "),
      action: { label: jobs, to: "/administration/jobs" },
    });
  }
  if (data.unresolvedCalls.queryEmbedding > 0) {
    items.push({
      key: "query-calls",
      severity: "deny",
      title: translatePlural("administration.overview.unknownSearchCalls", data.unresolvedCalls.queryEmbedding, {
        one: "{count} search call with unknown cost",
        other: "{count} search calls with unknown cost",
      }),
      detail: translate("administration.overview.unknownSearchCallsDetail", "The same query text is refused until each is acknowledged."),
      action: {
        label: translate("administration.overview.retrievalDiagnostics", "Retrieval diagnostics"),
        to: "/quality",
        search: { tab: "retrieval" },
      },
    });
  }
  if (data.unresolvedCalls.answer > 0) {
    items.push({
      key: "answer-calls",
      severity: "deny",
      title: translatePlural("administration.overview.unknownAnswerCalls", data.unresolvedCalls.answer, {
        one: "{count} answer call with unknown cost",
        other: "{count} answer calls with unknown cost",
      }),
      detail: translate("administration.overview.unknownAnswerCallsDetail", "Acknowledge them once the provider's usage is known."),
      action: { label: translate("administration.overview.modelCalls", "Model calls"), to: "/activity", search: { tab: "calls" } },
    });
  }
  if (data.unresolvedCalls.vector > 0) {
    items.push({
      key: "vector-calls",
      severity: "deny",
      title: translatePlural("administration.overview.unknownVectorCalls", data.unresolvedCalls.vector, {
        one: "{count} vector call with unknown cost",
        other: "{count} vector calls with unknown cost",
      }),
      detail: translate("administration.overview.unknownVectorCallsDetail", "Their generations will not retry by themselves."),
      action: { label: vectorGenerations, to: "/index", search: { tab: "vectors" } },
    });
  }
  if (data.storageVerification?.status === "FAILED") {
    items.push({
      key: "storage",
      severity: "deny",
      title: translate("administration.overview.storageFailed", "The last storage check failed"),
      detail: translate("administration.overview.storageFailedDetail", "A stored original no longer matches its hash, or could not be read."),
      action: { label: jobs, to: "/administration/jobs" },
    });
  }
  if (isStalled(data, now)) {
    items.push({
      key: "stalled",
      severity: "warn",
      title: translatePlural("administration.overview.stalled", data.jobs.queued, {
        one: "{count} job queued and not moving",
        other: "{count} jobs queued and not moving",
      }),
      detail: translate("administration.overview.stalledDetail", "The oldest has waited since {age}.", {
        age: ageOf(data.jobs.oldestQueuedAt ?? data.readAt, now),
      }),
      action: { label: jobs, to: "/administration/jobs" },
    });
  }
  if (configurations !== null) {
    for (const capability of ["EMBEDDINGS", "CHAT"] as const) {
      if (!configurations.some((configuration) => configuration.active && configuration.capabilities.includes(capability))) {
        items.push({
          key: `provider-${capability}`,
          severity: "warn",
          title:
            capability === "EMBEDDINGS"
              ? translate("administration.overview.noEmbeddingsProvider", "No embeddings provider in force")
              : translate("administration.overview.noChatProvider", "No chat provider in force"),
          detail:
            capability === "EMBEDDINGS"
              ? translate("administration.overview.noEmbeddingsDetail", "Semantic search and vectorising cannot run.")
              : translate("administration.overview.noChatDetail", "Answers can only cite sources, never write."),
          action: { label: translate("navigation.section.providers.label", "AI providers"), to: "/administration/providers" },
        });
      }
    }
  }
  if (data.corpus.readyGenerations > 0) {
    items.push({
      key: "ready-generations",
      severity: "warn",
      title: translatePlural("administration.overview.readyGenerations", data.corpus.readyGenerations, {
        one: "{count} index generation built but not published",
        other: "{count} index generations built but not published",
      }),
      detail: translate("administration.overview.readyGenerationsDetail", "Search reads only published generations."),
      action: { label: translate("navigation.item.index.label", "Index"), to: "/index" },
    });
  }
  if (data.corpus.publishedVectorGenerations === 0 && data.corpus.withdrawnVectorGenerations > 0) {
    items.push({
      key: "vectors-withdrawn",
      severity: "warn",
      title: translate("administration.overview.noPublishedVectors", "Semantic search has no published vectors"),
      detail: translatePlural("administration.overview.withdrawnGenerations", data.corpus.withdrawnVectorGenerations, {
        one: "{count} generation withdrawn — usually by a new document version or a removal. Vectorise again.",
        other: "{count} generations withdrawn — usually by a new document version or a removal. Vectorise again.",
      }),
      action: { label: vectorGenerations, to: "/index", search: { tab: "vectors" } },
    });
  }
  if (data.storageVerification === null) {
    items.push({
      key: "storage-never",
      severity: "warn",
      title: translate("administration.overview.storageNever", "Stored originals have never been checked"),
      detail: translate(
        "administration.overview.storageNeverDetail",
        "Run a storage check once, so a damaged original is found before a reader finds it.",
      ),
      action: { label: jobs, to: "/administration/jobs" },
    });
  }
  if (data.people.credentialsExpiringThisWeek > 0) {
    items.push({
      key: "credentials",
      severity: "warn",
      title: translatePlural("administration.overview.credentialsExpiring", data.people.credentialsExpiringThisWeek, {
        one: "{count} credential expires this week",
        other: "{count} credentials expire this week",
      }),
      detail: translate("administration.overview.credentialsExpiringDetail", "Clients holding them stop working when they do."),
      action: { label: translate("navigation.section.accounts.label", "Accounts"), to: "/administration/accounts" },
    });
  }
  return items;
}

function ageOf(moment: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(moment)) / 1000));
  if (seconds < 60) {
    return translate("administration.overview.secondsAgo", "{count} s ago", { count: seconds });
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return translate("administration.overview.minutesAgo", "{count} min ago", { count: minutes });
  }
  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return translate("administration.overview.hoursAgo", "{count} h ago", { count: hours });
  }
  return translatePlural("administration.overview.daysAgo", Math.round(hours / 24), {
    one: "{count} day ago",
    other: "{count} days ago",
  });
}
