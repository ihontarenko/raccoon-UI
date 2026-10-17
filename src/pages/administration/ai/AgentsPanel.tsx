import { useEffect, useState } from "react";
import { usePermissions } from "../../../access/PermissionsProvider";
import { PERMISSIONS } from "../../../access/permissions";
import { formatDateTime, shortIdentifier } from "../../../application/format";
import { describeProblem } from "../../../application/problems";
import { useResource } from "../../../application/useResource";
import { aiApi, type AgentAuthority, type AgentConnection, type AgentView } from "../../../lib/ai";
import { api } from "../../../lib/api";
import { declareText, type DeclaredText } from "../../../translations/translate";
import { useTranslation } from "../../../translations/TranslationProvider";
import { ConfirmDialog, EmptyState, ProblemState, Waiting, useToaster } from "../../../ui/components";
import { Badge, Button, Field, Select } from "../../../ui/primitives";
import { CONNECTION, CONNECTIONS, HISTORY, LIST, LIST_HEAD, LIST_ITEM, LIST_TITLE, PANEL, ROW_ACTIONS } from "./aiClasses";

const AGENT_NAME = "flex flex-wrap items-center gap-2";

/* Authority on the left, the clients it holds on the right; one column on a narrow screen. */
const AGENT_BODY = [
  "grid grid-cols-[minmax(0,calc(260px*var(--ui-scale)))_minmax(0,1fr)] items-start gap-6",
  "max-[800px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

const AGENT_AUTHORITY = "grid min-w-0 gap-1";

const AGENT_CLIENTS = "grid min-w-0 gap-2";

const CLIENTS_TITLE = "m-0 flex items-center gap-2 text-xs font-[550] text-secondary";

/**
 * Owner names for the agents listed. The agent carries only its owner's subject id, and an owner whose
 * account cannot be read here keeps the short id rather than failing the list.
 */
function useOwnerNames(ownerReferences: readonly string[]): ReadonlyMap<string, string> {
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());
  const key = [...new Set(ownerReferences)].sort().join(",");
  useEffect(() => {
    let current = true;
    const references = key === "" ? [] : key.split(",");
    void Promise.allSettled(references.map((reference) => api.getSubject(reference))).then((results) => {
      if (!current) {
        return;
      }
      const resolved = new Map<string, string>();
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          resolved.set(result.value.id, result.value.displayName);
        }
      });
      setNames(resolved);
    });
    return () => {
      current = false;
    };
  }, [key]);
  return names;
}

const AUTHORITY_TEXT: Record<AgentAuthority, DeclaredText> = {
  INHERITED: declareText("administration.ai.agents.inherited", "Acts with everything its owner holds"),
  RESTRICTED: declareText("administration.ai.agents.restricted", "Holds only its own grants, capped by its owner"),
};

/**
 * The programs people connected to act for them over the Model Context Protocol. An agent is its own
 * identity: it can be renamed, switched off, narrowed, and have every client it handed a token to cut.
 */
export function AgentsPanel() {
  const { notify } = useToaster();
  const { t, say } = useTranslation();
  const mayWrite = usePermissions().may(PERMISSIONS.systemWrite);
  const agents = useResource(() => aiApi.agents(), []);
  const [revokingAll, setRevokingAll] = useState<AgentView | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const owners = useOwnerNames(agents.status === "ready" ? agents.data.map((agent) => agent.ownerReference) : []);

  if (agents.status === "loading") {
    return <Waiting label={t("administration.ai.agents.loading", "Loading agents")} lines={4} />;
  }
  if (agents.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={agents.problem}
        actions={
          <Button icon="refresh" onClick={agents.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }
  if (agents.data.length === 0) {
    return (
      <EmptyState
        title={t("administration.ai.agents.empty", "No agents connected")}
        description={t(
          "administration.ai.agents.emptyDescription",
          "An agent appears here the first time somebody connects an assistant to raccoon's protocol endpoint and signs it in.",
        )}
      />
    );
  }

  const change = async (agent: AgentView, action: () => Promise<AgentView>, done: string) => {
    setBusyId(agent.id);
    try {
      const saved = await action();
      agents.replace(agents.data.map((candidate) => (candidate.id === saved.id ? saved : candidate)));
      notify({ tone: "good", title: done });
    } catch (error) {
      const problem = describeProblem(error);
      notify({ tone: "error", title: problem.title, description: problem.detail ?? problem.description });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={PANEL}>
      <ul className={LIST}>
        {agents.data.map((agent) => {
          const busy = busyId === agent.id;
          const active = agent.connections.filter((connection) => connection.revokedAt === null);
          const revoked = agent.connections.filter((connection) => connection.revokedAt !== null);
          const renderConnection = (connection: AgentConnection) => (
            <li key={connection.id} className={CONNECTION} data-revoked={connection.revokedAt !== null}>
              <span>
                {t("administration.ai.agents.connectionIssued", "{client} · issued {date}", {
                  client: <strong>{connection.clientName}</strong>,
                  date: formatDateTime(connection.issuedAt),
                })}
                {connection.lastUsedAt !== null &&
                  t("administration.ai.agents.connectionUsed", " · used {date}", { date: formatDateTime(connection.lastUsedAt) })}
              </span>
              {connection.revokedAt === null ? (
                <Badge tone="good">{t("administration.credentials.active", "Active")}</Badge>
              ) : (
                <span className="text-muted">
                  {t("administration.ai.agents.revokedAt", "Revoked {date}", { date: formatDateTime(connection.revokedAt) })}
                </span>
              )}
              {mayWrite && connection.revokedAt === null ? (
                <Button
                  variant="quiet"
                  disabled={busy}
                  onClick={() =>
                    void change(
                      agent,
                      () => aiApi.revokeAgentConnection(agent.id, connection.id),
                      t("administration.credentials.revokedNotice", "{label} revoked", { label: connection.clientName }),
                    )
                  }
                >
                  {t("administration.credentials.revoke", "Revoke")}
                </Button>
              ) : (
                <span />
              )}
            </li>
          );
          return (
            <li key={agent.id} className={LIST_ITEM}>
              <div className={LIST_HEAD}>
                <div className={LIST_TITLE}>
                  <span className={AGENT_NAME}>
                    <strong>{agent.name}</strong>
                    <Badge tone={agent.enabled ? "good" : "warn"}>
                      {agent.enabled ? t("administration.accounts.enabled", "Enabled") : t("administration.accounts.disabled", "Disabled")}
                    </Badge>
                  </span>
                  <span className="text-xs text-secondary">
                    {t("administration.ai.agents.facts", "Owner {owner} · created {created} · last active {active}", {
                      owner: <strong className="text-ink">{owners.get(agent.ownerReference) ?? shortIdentifier(agent.ownerReference)}</strong>,
                      created: formatDateTime(agent.createdAt),
                      active:
                        agent.lastActiveAt === null
                          ? t("administration.ai.agents.never", "never")
                          : formatDateTime(agent.lastActiveAt),
                    })}
                  </span>
                </div>
                {mayWrite && (
                  <div className={ROW_ACTIONS}>
                    <Button
                      variant="quiet"
                      disabled={busy}
                      onClick={() =>
                        void change(
                          agent,
                          () => aiApi.setAgentEnabled(agent.id, !agent.enabled),
                          agent.enabled
                            ? t("administration.accounts.disabledNotice", "{name} disabled", { name: agent.name })
                            : t("administration.accounts.enabledNotice", "{name} enabled", { name: agent.name }),
                        )
                      }
                    >
                      {agent.enabled ? t("administration.accounts.disable", "Disable") : t("administration.accounts.enable", "Enable")}
                    </Button>
                    {agent.connectionCount > 0 && (
                      <Button
                        variant="danger"
                        disabled={busy}
                        onClick={() => {
                          setRevokingAll(agent);
                        }}
                      >
                        {t("administration.ai.agents.revokeAll", "Revoke all")}
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className={AGENT_BODY}>
                <div className={AGENT_AUTHORITY}>
                  {mayWrite ? (
                    <Field label={t("administration.ai.agents.authority", "Authority")} hint={`${say(AUTHORITY_TEXT[agent.authority])}.`}>
                      <Select
                        value={agent.authority}
                        disabled={busy}
                        onChange={(event) => {
                          const authority = event.target.value as AgentAuthority;
                          void change(
                            agent,
                            () => aiApi.setAgentAuthority(agent.id, authority),
                            t("administration.ai.agents.authorityChanged", "{name}: {authority}", {
                              name: agent.name,
                              authority: say(AUTHORITY_TEXT[authority]).toLowerCase(),
                            }),
                          );
                        }}
                      >
                        <option value="INHERITED">{t("administration.ai.agents.inheritsOwner", "Inherits its owner")}</option>
                        <option value="RESTRICTED">{t("administration.ai.agents.restrictedOption", "Restricted")}</option>
                      </Select>
                    </Field>
                  ) : (
                    <p className="text-xs text-secondary">{say(AUTHORITY_TEXT[agent.authority])}.</p>
                  )}
                </div>
                <section className={AGENT_CLIENTS} aria-label={t("administration.ai.agents.clientsOf", "Clients connected to {name}", { name: agent.name })}>
                  <h3 className={CLIENTS_TITLE}>
                    {t("administration.ai.agents.activeClients", "Active clients")}
                    <span className="numeric text-muted">{active.length}</span>
                  </h3>
                  {active.length === 0 ? (
                    <p className="m-0 text-xs text-muted">
                      {t("administration.ai.agents.noActiveClients", "None — every token it handed out has been revoked.")}
                    </p>
                  ) : (
                    <ul className={CONNECTIONS}>{active.map(renderConnection)}</ul>
                  )}
                  {revoked.length > 0 && (
                    <details className={HISTORY}>
                      <summary>{t("administration.ai.agents.revokedClients", "Revoked earlier ({count})", { count: revoked.length })}</summary>
                      <ul className={CONNECTIONS}>{revoked.map(renderConnection)}</ul>
                    </details>
                  )}
                </section>
              </div>
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={revokingAll !== null}
        title={t("administration.ai.agents.revokeEveryClient", "Revoke every client")}
        confirmLabel={t("administration.ai.agents.revokeAll", "Revoke all")}
        destructive
        onConfirm={() => {
          if (revokingAll !== null) {
            const target = revokingAll;
            setRevokingAll(null);
            void change(
              target,
              () => aiApi.revokeAgentConnections(target.id),
              t("administration.ai.agents.everyClientRevoked", "Every client of {name} revoked", { name: target.name }),
            );
          }
        }}
        onCancel={() => {
          setRevokingAll(null);
        }}
      >
        <p>
          {t(
            "administration.ai.agents.revokeAllDescription",
            "Every client connected to {name} loses its token at once and has to be signed in again.",
            { name: <strong>{revokingAll?.name}</strong> },
          )}
        </p>
      </ConfirmDialog>
    </div>
  );
}
