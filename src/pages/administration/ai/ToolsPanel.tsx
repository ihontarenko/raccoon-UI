import { useMemo, useState } from "react";
import { formatDateTime, formatNumber } from "../../../application/format";
import { useResource } from "../../../application/useResource";
import { aiApi } from "../../../lib/ai";
import { useTranslation } from "../../../translations/TranslationProvider";
import { EmptyState, ProblemState, Segmented, Waiting } from "../../../ui/components";
import { Badge, Button, Table } from "../../../ui/primitives";
import { ConnectPanel } from "./ConnectPanel";
import { CHIP_ROW, DESCRIPTION_CELL, LIST_HEAD, PANEL, SECTION_TITLE, TABLE_SURFACE } from "./aiClasses";

type View = "tools" | "calls" | "usage" | "connect";

/** What an assistant may do here, what it has done, and how much — the trail of the protocol. */
export function ToolsPanel() {
  const { t, plural } = useTranslation();
  const [view, setView] = useState<View>("tools");
  const data = useResource(async () => {
    const [tools, calls, usage, overview] = await Promise.all([aiApi.tools(), aiApi.calls(), aiApi.usage(), aiApi.overview()]);
    return { tools, calls, usage, overview };
  }, []);

  const toolGroups = useMemo(() => {
    if (data.status !== "ready") {
      return [];
    }
    const groups = new Map<string, typeof data.data.tools>();
    for (const tool of data.data.tools) {
      const name = tool.qualifiedName.split(".")[0] ?? tool.qualifiedName;
      groups.set(name, [...(groups.get(name) ?? []), tool]);
    }
    return [...groups.entries()];
  }, [data]);

  if (data.status === "loading") {
    return <Waiting label={t("administration.ai.tools.loading", "Loading the tool catalogue")} lines={5} />;
  }
  if (data.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={data.problem}
        actions={
          <Button icon="refresh" onClick={data.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }

  const { tools, calls, usage, overview } = data.data;

  return (
    <div className={PANEL}>
      <div className={LIST_HEAD}>
        <Segmented<View>
          label={t("administration.ai.tools.show", "Show")}
          value={view}
          onChange={setView}
          options={[
            { value: "tools", label: t("administration.ai.tools.catalogue", "Catalogue"), count: tools.length },
            { value: "calls", label: t("administration.ai.tools.recentCalls", "Recent calls"), count: calls.length },
            { value: "usage", label: t("administration.ai.tools.usage", "Usage"), count: usage.length },
            { value: "connect", label: t("administration.ai.tools.connect", "Connect an assistant") },
          ]}
        />
        <Button variant="quiet" icon="refresh" onClick={data.reload}>
          {t("administration.ai.tools.refresh", "Refresh")}
        </Button>
      </div>

      {view === "connect" && <ConnectPanel />}

      {view === "tools" &&
        (tools.length === 0 ? (
          <EmptyState
            title={t("administration.ai.tools.empty", "No tools published")}
            description={t("administration.ai.tools.emptyDescription", "Nothing is exposed to assistants in this installation.")}
          />
        ) : (
          toolGroups.map(([group, groupTools]) => (
            <section key={group} aria-label={t("administration.ai.tools.toolNamed", "Tool {name}", { name: group })}>
              <h2 className={SECTION_TITLE}>
                <span className="numeric">{group}</span> <span className="text-xs text-muted">
                  {plural("administration.ai.tools.actionCount", groupTools.length, { one: "{count} action", other: "{count} actions" })}
                </span>
              </h2>
              <div className={TABLE_SURFACE}>
                <Table>
                  <thead>
                    <tr>
                      <th scope="col">{t("administration.ai.tools.action", "Action")}</th>
                      <th scope="col" className="w-[46%]">{t("administration.ai.tools.whatItDoes", "What it does")}</th>
                      <th scope="col">{t("administration.ai.tools.needs", "Needs")}</th>
                      <th scope="col">{t("administration.ai.tools.effect", "Effect")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupTools.map((tool) => (
                      <tr key={tool.publishedName}>
                        <td>
                          <strong>{tool.title}</strong>
                          <div className="numeric text-xs text-muted">{tool.qualifiedName}</div>
                        </td>
                        <td className={`text-xs text-secondary wraps ${DESCRIPTION_CELL}`}>{tool.description}</td>
                        <td className="numeric text-xs">{tool.requiredPermission ?? "—"}</td>
                        <td>
                          <div className={CHIP_ROW}>
                            {tool.readOnly ? (
                              <Badge tone="good">{t("administration.ai.tools.readOnly", "Read only")}</Badge>
                            ) : (
                              <Badge tone="warn">{t("administration.ai.tools.writes", "Writes")}</Badge>
                            )}
                            {tool.destructive && <Badge tone="error">{t("administration.ai.tools.destructive", "Destructive")}</Badge>}
                            {tool.scopeConfined && (
                              <Badge tone="neutral">{t("administration.ai.tools.workspaceScoped", "Workspace scoped")}</Badge>
                            )}
                            {tool.origin === "REMOTE" && <Badge tone="neutral">{t("administration.ai.tools.remote", "Remote")}</Badge>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </section>
          ))
        ))}

      {view === "calls" &&
        (calls.length === 0 ? (
          <EmptyState
            title={
              overview.trailRecorded
                ? t("administration.ai.tools.noCalls", "No calls yet")
                : t("administration.ai.tools.nothingCalled", "Nothing has called a tool yet")
            }
            description={t(
              "administration.ai.tools.noCallsDescription",
              "Every call an assistant makes is recorded here with who made it, where, and how it ended.",
            )}
          />
        ) : (
          <div className={TABLE_SURFACE}>
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t("administration.ai.tools.when", "When")}</th>
                  <th scope="col">{t("administration.ai.tools.action", "Action")}</th>
                  <th scope="col">{t("administration.ai.tools.caller", "Caller")}</th>
                  <th scope="col">{t("administration.ai.tools.where", "Where")}</th>
                  <th scope="col">{t("administration.ai.tools.outcome", "Outcome")}</th>
                  <th scope="col" className="numeric">
                    {t("administration.ai.tools.reached", "Reached")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => (
                  <tr key={call.operationId}>
                    <td className="text-xs text-secondary">{formatDateTime(call.at)}</td>
                    <td className="numeric text-xs">{call.qualifiedName}</td>
                    <td className="numeric text-xs">
                      {call.callerId}
                      {call.actingSubject !== call.callerId && <div className="text-muted">{t("administration.ai.tools.forSubject", "for {subject}", { subject: call.actingSubject })}</div>}
                    </td>
                    <td className="text-xs">{call.scopeLabel ?? call.scopeId ?? "—"}</td>
                    <td>
                      <Badge tone={/ALLOW|SUCCESS|OK|DONE/i.test(call.outcome) ? "good" : "warn"}>{call.outcome}</Badge>
                    </td>
                    <td className="numeric">{formatNumber(call.affectedCount)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ))}

      {view === "usage" &&
        (usage.length === 0 ? (
          <EmptyState
            title={t("administration.ai.tools.nothingCounted", "Nothing counted yet")}
            description={t(
              "administration.ai.tools.nothingCountedDescription",
              "Calls and the tokens they spent are totalled here per caller and action.",
            )}
          />
        ) : (
          <div className={TABLE_SURFACE}>
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t("administration.ai.tools.caller", "Caller")}</th>
                  <th scope="col">{t("administration.ai.tools.action", "Action")}</th>
                  <th scope="col">{t("administration.ai.tools.outcome", "Outcome")}</th>
                  <th scope="col" className="numeric">
                    {t("administration.ai.tools.calls", "Calls")}
                  </th>
                  <th scope="col" className="numeric">
                    {t("administration.ai.tools.tokens", "Tokens")}
                  </th>
                  <th scope="col">{t("administration.ai.tools.last", "Last")}</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((total) => (
                  <tr key={`${total.callerId}:${total.qualifiedName}:${total.outcome}`}>
                    <td className="numeric text-xs">{total.callerId}</td>
                    <td className="numeric text-xs">{total.qualifiedName}</td>
                    <td className="text-xs">{total.outcome}</td>
                    <td className="numeric">{formatNumber(total.calls)}</td>
                    <td className="numeric">{formatNumber(total.tokens)}</td>
                    <td className="text-xs text-secondary">{formatDateTime(total.lastCalledAt)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ))}
    </div>
  );
}
