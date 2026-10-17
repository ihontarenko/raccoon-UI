import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { usePagedList } from "../../application/usePagedList";
import { useResource } from "../../application/useResource";
import { collectAllPages } from "../../lib/api";
import { automationApi, type ListedScriptKind, type ScriptGroup } from "../../lib/automation";
import { CONTENT_RULE_SCRIPT_STAGE, RULE_SCRIPT_STAGE, type ScriptView } from "../../lib/sourceContracts";
import type { Translate } from "../../translations/TranslationProvider";
import { useTranslation } from "../../translations/TranslationProvider";
import { EmptyState, ListFooter, ProblemState, Segmented, Waiting } from "../../ui/components";
import { Badge, Button, Table } from "../../ui/primitives";
import { PROBLEM, ROW_LINK, STACK, TABLE_SURFACE, TOOLBAR } from "./automationClasses";

/** Whether a script actually runs, and why not when it does not — the one question the list is read for. */
function runningState(script: ScriptView, groups: readonly ScriptGroup[], t: Translate): { tone: "allow" | "warn" | "neutral" | "error"; word: string; detail: string | null } {
  if (script.bindState !== "BOUND") {
    return { tone: "error", word: t("automation.scripts.state.broken", "Has an error"), detail: script.bindProblem };
  }
  if (script.activeVersionId === null) {
    return { tone: "neutral", word: t("automation.scripts.state.draft", "Draft — does not run"), detail: t("automation.scripts.state.draftDetail", "Publish it to let it run.") };
  }
  if (script.stage === RULE_SCRIPT_STAGE || script.stage === CONTENT_RULE_SCRIPT_STAGE) {
    return {
      tone: "allow",
      word: t("automation.scripts.state.published", "Published"),
      detail: script.stage === RULE_SCRIPT_STAGE
        ? t("automation.scripts.state.ruleDetail", "Runs where a source's rule names it.")
        : t("automation.scripts.state.contentDetail", "Runs where a rule set's content rule names it."),
    };
  }
  const runningIn = groups.filter((group) =>
    group.configuration.bindings.some((binding) => binding.enabled && binding.scriptVersionId === script.activeVersionId),
  );
  if (runningIn.length === 0) {
    return { tone: "warn", word: t("automation.scripts.state.unbound", "Not bound — does not run"), detail: t("automation.scripts.state.unboundDetail", "Bind it to a stage on the Groups tab.") };
  }
  return {
    tone: "allow",
    word: t("automation.scripts.state.runs", "Runs"),
    detail: t("automation.scripts.state.runsIn", "In {groups}", { groups: runningIn.map((group) => group.name).join(", ") }),
  };
}

/**
 * Every script: what it reacts to, and whether it runs — the draft that binds, the version published and the group
 * that binds it are three steps a reader should not have to put together from three columns. The server
 * narrows the list by kind and serves it in pages, so the filter carries no counts: a count of the loaded rows
 * would read like a total.
 */
export function ScriptsTab({ workspaceId }: { workspaceId: string }) {
  const { t, plural } = useTranslation();
  const [filter, setFilter] = useState<ListedScriptKind>("ALL");
  const stages = useResource(
    async () =>
      new Map((await automationApi.stages(workspaceId)).map((stage) => [stage.name, stage.timing])),
    [workspaceId],
  );
  const groups = useResource(() => collectAllPages((page) => automationApi.groups(workspaceId, page)), [workspaceId]);
  const loaded = usePagedList(
    (page) => automationApi.scripts(workspaceId, page, filter),
    [workspaceId, filter],
  );

  if (stages.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={stages.problem}
        actions={
          <Button icon="refresh" onClick={stages.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }
  if (loaded.status === "loading" || stages.status === "loading") {
    return <Waiting label={t("automation.scripts.loading", "Loading scripts")} lines={5} />;
  }
  if (loaded.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={loaded.problem}
        actions={
          <Button icon="refresh" onClick={loaded.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }

  const shown = loaded.items;
  const allGroups = groups.status === "ready" ? groups.data : [];
  const timing = stages.data;

  if (shown.length === 0 && filter === "ALL") {
    return (
      <EmptyState
        title={t("automation.scripts.empty", "No scripts yet")}
        description={t(
          "automation.scripts.emptyDescription",
          "Start from an example on the Examples tab, or write one from scratch.",
        )}
      />
    );
  }

  return (
    <div className={STACK}>
      <div className={TOOLBAR}>
        <Segmented<ListedScriptKind>
          label={t("automation.scripts.kind", "Kind")}
          value={filter}
          onChange={setFilter}
          options={[
            { value: "ALL", label: t("automation.scripts.filter.all", "All") },
            { value: "EVENT", label: t("automation.scripts.filter.events", "Event scripts") },
            { value: "RULE", label: t("automation.scripts.filter.rules", "Rule scripts") },
          ]}
        />
        <span className="text-xs text-muted">
          {t(
            "automation.scripts.kindsExplained",
            "Event scripts run when a group binds them to a stage; rule scripts run when a source's rule names them.",
          )}
        </span>
      </div>
      {shown.length === 0 ? (
        <EmptyState
          title={t("automation.scripts.noneOfKind", "No scripts of this kind")}
          description={t(
            "automation.scripts.noneOfKindDescription",
            "Choose All to see every script.",
          )}
        />
      ) : (
        <div className={TABLE_SURFACE}>
          <Table>
            <thead>
              <tr>
                <th scope="col">{t("automation.scripts.column.script", "Script")}</th>
                <th scope="col">{t("automation.scripts.column.reactsTo", "Reacts to")}</th>
                <th scope="col">{t("automation.scripts.column.runs", "Runs?")}</th>
                <th scope="col" className="numeric">
                  {t("automation.scripts.column.revision", "Revision")}
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((script) => {
                const stageTiming =
                  script.stage === RULE_SCRIPT_STAGE ? null : timing.get(script.stage);
                return (
                  <tr key={script.id}>
                    <td>
                      <Link
                        to="/automation/scripts/$scriptId"
                        params={{ scriptId: script.id }}
                        className={ROW_LINK}
                      >
                        {script.title}
                      </Link>
                    </td>
                    <td>
                      <span className="numeric text-xs">
                        {script.stage === RULE_SCRIPT_STAGE
                          ? t("automation.scanRule", "scan rule")
                          : script.stage}
                      </span>
                      {stageTiming !== null && stageTiming !== undefined && (
                        <div className="text-xs text-muted">
                          {stageTiming === "DECISION"
                            ? t("automation.scripts.decides", "decides")
                            : t("automation.scripts.observes", "observes")}
                        </div>
                      )}
                    </td>
                    <td className="wraps">
                      {(() => {
                        const state = runningState(script, allGroups, t);
                        return (
                          <>
                            <Badge tone={state.tone}>{state.word}</Badge>
                            {state.detail !== null && (
                              <div className={`text-xs ${state.tone === "error" ? PROBLEM : "text-muted"}`}>{state.detail}</div>
                            )}
                          </>
                        );
                      })()}
                    </td>
                    <td className="numeric">{script.revision}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <ListFooter
            shown={shown.length}
            counted={plural("automation.scripts.count", shown.length, {
              one: "{count} script",
              other: "{count} scripts",
            })}
            hasMore={loaded.hasMore}
            loadingMore={loaded.loadingMore}
            moreProblem={loaded.moreProblem}
            onLoadMore={loaded.loadMore}
          />
        </div>
      )}
    </div>
  );
}
