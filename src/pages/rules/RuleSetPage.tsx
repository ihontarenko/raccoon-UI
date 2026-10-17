import { stageOf } from "./RuleEditor";
import { newRule, type RuleStage } from "../../lib/ruleSets";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearch } from "@tanstack/react-router";
import { PERMISSIONS } from "../../access/permissions";
import { usePermissions } from "../../access/PermissionsProvider";
import { formatDateTime } from "../../application/format";
import { describeProblem } from "../../application/problems";
import type { RuleSetTab } from "../../application/routeTabs";
import { useAddressChange } from "../../application/useAddressChange";
import { useReadySession } from "../../application/session";
import { usePageTitle } from "../../application/usePageTitle";
import { useResource } from "../../application/useResource";
import { collectAllPages } from "../../lib/api";
import { automationApi } from "../../lib/automation";
import {
  holderAddress,
  ruleSetsApi,
  type RuleSet,
  type RuleDrop,
  type RuleSetRevision,
  type Rule,
  type RuleVocabulary,
} from "../../lib/ruleSets";
import { RULE_SCRIPT_STAGE, type ScriptView } from "../../lib/sourceContracts";
import { useTranslation } from "../../translations/TranslationProvider";
import {
  EmptyState,
  PageHeader,
  ProblemState,
  RowLink,
  TabPanel,
  Tabs,
  Waiting,
  Workbench,
  useToaster,
} from "../../ui/components";
import { Badge, Button, Field, Input, Table } from "../../ui/primitives";
import { RuleSetRules } from "./RuleSetRules";
import { RuleScriptDialog } from "./RuleScriptDialog";
import {
  BADGES,
  CRUMB_LINK,
  EDITOR_FRAME,
  EXCERPT,
  NAME_FIELD,
  PAGE,
  REASON,
  SAVE_ACTIONS,
  SAVE_BAR,
} from "./ruleSetsClasses";
import { describeRule, holderTone, placeTone, stageName, stagePlace } from "./ruleWords";

type TabKey = "rules" | RuleSetTab;

interface Loaded {
  ruleSet: RuleSet;
  vocabulary: RuleVocabulary;
  scripts: ScriptView[];
}

/**
 * One rule set: its rules at every stage in one editor, what binds it, how it changed, and what it dropped recently.
 *
 * This is the only place a rule is edited — a rule at a source's door and a rule over a profile's parsed blocks alike.
 * A source and a profile bind rule sets; they do not hold rules of their own, so a change here reaches every one of them
 * the next time it scans or prepares a document.
 */
export function RuleSetPage() {
  // ⚠️ `strict: false`, the way every other page here reads its parameters: a `from` is matched against the route id the
  // tree actually built, and the literal path throws «could not find an active match» at render.
  const { ruleSetId } = useParams({ strict: false }) as { ruleSetId: string };
  const search = useSearch({ strict: false }) as { tab?: RuleSetTab; addStage?: RuleStage };
  const changeAddress = useAddressChange();
  const tab: TabKey = search.tab ?? "rules";
  const { t } = useTranslation();
  const { workspace } = useReadySession();
  const workspaceId = workspace?.id ?? "";

  const loaded = useResource<Loaded>(async () => {
    const [ruleSet, vocabulary, scripts] = await Promise.all([
      ruleSetsApi.get(workspaceId, ruleSetId),
      ruleSetsApi.vocabulary(workspaceId),
      collectAllPages((page) => automationApi.scripts(workspaceId, page, "RULE")),
    ]);
    return { ruleSet, vocabulary, scripts };
  }, [workspaceId, ruleSetId]);

  usePageTitle(
    loaded.status === "ready" ? loaded.data.ruleSet.name : t("rules.ruleSet", "Rule set"),
  );

  const selectTab = (next: TabKey) => {
    void changeAddress({
      to: "/rules/$ruleSetId",
      params: { ruleSetId },
      search: next === "rules" ? {} : { tab: next },
    });
  };

  if (loaded.status === "loading") {
    return <Waiting label={t("rules.loadingRuleSet", "Loading the rule set")} lines={6} />;
  }
  if (loaded.status === "failed") {
    return (
      <ProblemState
        problem={loaded.problem}
        actions={
          <>
            <Button icon="refresh" variant="primary" onClick={loaded.reload}>
              {t("common.tryAgain", "Try again")}
            </Button>
            <Button href="/rules" variant="quiet">
              {t("rules.all", "All rule sets")}
            </Button>
          </>
        }
      />
    );
  }

  const { ruleSet } = loaded.data;
  const stages = [...new Set(ruleSet.configuration.rules.map((rule) => rule.stage))];
  return (
    <div className={PAGE}>
      <PageHeader
        eyebrow={
          <>
            <Link to="/rules" className={CRUMB_LINK}>
              {t("rules.title", "Rule sets")}
            </Link>{" "}
            / {ruleSet.name}
          </>
        }
        title={ruleSet.name}
        status={
          stages.length > 0 ? (
            <span className={BADGES}>
              {stages.map((stage) => (
                <Badge key={stage} tone={placeTone(stage)}>
                  {stagePlace(stage, t)} · {stageName(stage, t)}
                </Badge>
              ))}
            </span>
          ) : undefined
        }
        lead={t(
          "rules.ruleSetLead",
          "Every rule of this rule set, at the door and in the pipeline, edited in one place. A source binds it for its rules at the door; a processing profile binds it for its rules in the pipeline.",
        )}
      />
      <Tabs<TabKey>
        label={t("rules.ruleSet", "Rule set")}
        active={tab}
        onSelect={selectTab}
        items={[
          {
            key: "rules",
            label: t("rules.tab.rules", "Rules"),
            count: ruleSet.configuration.rules.length,
          },
          {
            key: "bindings",
            label: t("rules.tab.bindings", "Bound to"),
            count: ruleSet.usedBy.length,
          },
          { key: "history", label: t("contentSteps.tab.history", "History") },
          { key: "dropped", label: t("contentSteps.tab.dropped", "Dropped recently") },
        ]}
      />
      {tab === "rules" && (
        <TabPanel tabKey="rules">
          <RulesEditor
            key={ruleSet.revision}
            workspaceId={workspaceId}
            loaded={loaded.data}
            addStage={search.addStage}
            onAddStageTaken={() => void changeAddress({ to: "/rules/$ruleSetId", params: { ruleSetId }, search: { tab: search.tab } })}
            onSaved={(saved) => loaded.replace({ ...loaded.data, ruleSet: saved })}
            onScriptSaved={(script) =>
              loaded.replace({
                ...loaded.data,
                scripts: [
                  ...loaded.data.scripts.filter((candidate) => candidate.id !== script.id),
                  script,
                ],
              })
            }
          />
        </TabPanel>
      )}
      {tab === "bindings" && (
        <TabPanel tabKey="bindings">
          <Bindings ruleSet={ruleSet} />
        </TabPanel>
      )}
      {tab === "history" && (
        <TabPanel tabKey="history">
          <History workspaceId={workspaceId} ruleSetId={ruleSetId} />
        </TabPanel>
      )}
      {tab === "dropped" && (
        <TabPanel tabKey="dropped">
          <Dropped workspaceId={workspaceId} ruleSetId={ruleSetId} />
        </TabPanel>
      )}
    </div>
  );
}

function RulesEditor({
  workspaceId,
  loaded,
  addStage,
  onAddStageTaken,
  onSaved,
  onScriptSaved,
}: {
  workspaceId: string;
  loaded: Loaded;
  /** Arrived from the flow of every rule set with «+ Rule here»: a new rule at this stage is waiting in the draft. */
  addStage?: RuleStage;
  onAddStageTaken: () => void;
  onSaved: (ruleSet: RuleSet) => void;
  onScriptSaved: (script: ScriptView) => void;
}) {
  const { t } = useTranslation();
  const { notify } = useToaster();
  const permissions = usePermissions();
  const editable = permissions.may(PERMISSIONS.automationManage);
  const { ruleSet, vocabulary, scripts } = loaded;
  const [name, setName] = useState(ruleSet.name);
  const [rules, setRules] = useState<Rule[]>(() =>
    addStage === undefined || !editable
      ? ruleSet.configuration.rules
      : [...ruleSet.configuration.rules, newRule(stageOf(vocabulary, addStage), (ruleSet.configuration.rules.length + 1) * 10)],
  );
  // The address asked for one new rule; once it is in the draft, the address stops asking, so a reload does not add another.
  useEffect(() => {
    if (addStage !== undefined) {
      onAddStageTaken();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [saving, setSaving] = useState(false);
  const [scriptDialog, setScriptDialog] = useState<{
    open: boolean;
    kind: string;
    script: ScriptView | null;
    name: string;
  }>({
    open: false,
    kind: RULE_SCRIPT_STAGE,
    script: null,
    name: "",
  });
  const saved = useMemo(
    () => JSON.stringify({ name: ruleSet.name, rules: ruleSet.configuration.rules }),
    [ruleSet],
  );
  const dirty = JSON.stringify({ name, rules }) !== saved;
  const unnamed = rules.some((rule) => rule.name.trim() === "");

  // Closing the tab with unsaved rules asks first; the browser words the question itself.
  useEffect(() => {
    if (!dirty) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = async () => {
    setSaving(true);
    try {
      const result = await ruleSetsApi.change(
        workspaceId,
        ruleSet.id,
        name.trim(),
        ruleSet.revision,
        { rules },
      );
      notify({
        tone: "good",
        title: t("rules.saved", "Rule set saved"),
        description: t("rules.savedDescription", "Its next scan or document run uses it."),
      });
      onSaved(result);
    } catch (error) {
      const problem = describeProblem(error);
      notify({
        tone: "error",
        title: t("rules.notSaved", "The rule set was not saved"),
        description: problem.detail ?? problem.description,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <fieldset className={EDITOR_FRAME} disabled={!editable}>
        <legend className="sr-only">
          {t("rules.legend", "The rule set «{name}»", { name: ruleSet.name })}
        </legend>
        <div className={NAME_FIELD}>
          <Field label={t("rules.name", "Name")}>
            <Input
              value={name}
              maxLength={160}
              fullWidth
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
        </div>
        <RuleSetRules
          rules={rules}
          vocabulary={vocabulary}
          scripts={scripts}
          usedBy={ruleSet.usedBy}
          editable={editable}
          onChange={setRules}
          onEditScript={(kind, script, suggestedName) =>
            setScriptDialog({ open: true, kind, script, name: suggestedName })
          }
        />
      </fieldset>
      {editable && (
        <div
          className={SAVE_BAR}
          data-dirty={dirty}
          role="region"
          aria-label={t("rules.saveBar", "Save the rule set")}
        >
          <span className="text-xs" aria-live="polite">
            {unnamed
              ? t(
                  "rules.unnamedRules",
                  "Every rule needs a name before the rule set can be saved.",
                )
              : dirty
                ? t("rules.unsaved", "Unsaved changes.")
                : t("rules.savedRevision", "Saved — revision {revision}.", {
                    revision: ruleSet.revision,
                  })}
          </span>
          <div className={SAVE_ACTIONS}>
            <Button
              variant="quiet"
              disabled={!dirty || saving}
              onClick={() => {
                setName(ruleSet.name);
                setRules(ruleSet.configuration.rules);
              }}
            >
              {t("common.discard", "Discard")}
            </Button>
            <Button
              variant="primary"
              icon="check"
              disabled={!dirty || saving || unnamed || name.trim() === ""}
              onClick={() => void save()}
            >
              {saving ? t("common.saving", "Saving…") : t("rules.save", "Save the rule set")}
            </Button>
          </div>
        </div>
      )}
      <RuleScriptDialog
        open={scriptDialog.open}
        kind={scriptDialog.kind}
        workspaceId={workspaceId}
        script={scriptDialog.script}
        suggestedName={scriptDialog.name}
        onClose={() => setScriptDialog((current) => ({ ...current, open: false }))}
        onSaved={(script) => {
          onScriptSaved(script);
          setScriptDialog((current) => ({ ...current, open: false }));
          notify({
            tone: "good",
            title: t("sourceRules.scriptActivated", "{title} activated", { title: script.title }),
          });
        }}
      />
    </>
  );
}

/** Everything that binds the rule set — sources at the door, processing profiles in the pipeline — each a way to it. */
function Bindings({ ruleSet }: { ruleSet: RuleSet }) {
  const { t } = useTranslation();
  if (ruleSet.usedBy.length === 0) {
    return (
      <EmptyState
        title={t("rules.boundToNothingTitle", "Nothing binds this rule set")}
        description={t(
          "rules.boundToNothingText",
          "Its rules run nowhere until a source binds it on its Rules tab, or a processing profile binds it in its content section.",
        )}
      />
    );
  }
  return (
    <Workbench>
      <Table>
        <thead>
          <tr>
            <th scope="col">{t("rules.column.holder", "Bound by")}</th>
            <th scope="col">{t("rules.column.runs", "Runs its rules")}</th>
            <th scope="col">
              <span className="sr-only">{t("contentSteps.column.actions", "Actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {ruleSet.usedBy.map((binding) => (
            <tr key={`${binding.holder}-${binding.id}`}>
              <td>
                <RowLink href={holderAddress(binding)}>{binding.name}</RowLink>
                <div>
                  <Badge tone={holderTone(binding.holder)}>
                    {binding.holder === "SOURCE"
                      ? t("rules.holder.source", "Source")
                      : t("rules.holder.profile", "Processing profile")}
                  </Badge>
                </div>
              </td>
              <td className="text-xs text-secondary">
                {binding.holder === "SOURCE"
                  ? t("rules.runs.door", "At the door")
                  : t(
                      "rules.runs.pipeline",
                      "In the pipeline: blocks, chunks, keyword and embedding text, queries",
                    )}
              </td>
              <td className="actions">
                <Button href={holderAddress(binding)} variant="quiet" icon="arrow">
                  {t("rules.openHolder", "Open")}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Workbench>
  );
}

function History({ workspaceId, ruleSetId }: { workspaceId: string; ruleSetId: string }) {
  const { t, plural } = useTranslation();
  const history = useResource<RuleSetRevision[]>(
    () => ruleSetsApi.history(workspaceId, ruleSetId),
    [workspaceId, ruleSetId],
  );
  if (history.status === "loading") {
    return <Waiting label={t("rules.loadingHistory", "Loading the history")} lines={4} />;
  }
  if (history.status === "failed") {
    return <ProblemState problem={history.problem} layout="section" />;
  }
  return (
    <Workbench>
      <Table>
        <thead>
          <tr>
            <th scope="col" className="numeric">
              {t("rules.column.revision", "Revision")}
            </th>
            <th scope="col">{t("rules.column.saved", "Saved")}</th>
            <th scope="col">{t("rules.column.rules", "Rules")}</th>
          </tr>
        </thead>
        <tbody>
          {history.data.map((revision) => (
            <tr key={revision.revision}>
              <td className="numeric">{revision.revision}</td>
              <td className="text-xs text-secondary">{formatDateTime(revision.createdAt)}</td>
              <td className={EXCERPT}>
                {revision.configuration.rules.length === 0
                  ? "—"
                  : plural("rules.ruleCount", revision.configuration.rules.length, {
                      one: "{count} rule",
                      other: "{count} rules",
                    })}
                <ul className="m-0 mt-1 grid list-none gap-0.5 p-0">
                  {revision.configuration.rules.map((rule) => (
                    <li key={rule.name}>
                      <span className="font-semibold text-ink">{rule.name}</span> ·{" "}
                      {stageName(rule.stage, t)} · {describeRule(rule, t)}
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Workbench>
  );
}

function Dropped({ workspaceId, ruleSetId }: { workspaceId: string; ruleSetId: string }) {
  const { t } = useTranslation();
  const dropped = useResource<RuleDrop[]>(
    () => ruleSetsApi.dropped(workspaceId, ruleSetId),
    [workspaceId, ruleSetId],
  );
  if (dropped.status === "loading") {
    return <Waiting label={t("rules.loadingDropped", "Loading what it dropped")} lines={4} />;
  }
  if (dropped.status === "failed") {
    return <ProblemState problem={dropped.problem} layout="section" />;
  }
  if (dropped.data.length === 0) {
    return (
      <EmptyState
        title={t("contentSteps.noDrops", "Nothing dropped yet")}
        description={t(
          "rules.noDropsText",
          "Blocks and chunks its pipeline rules drop appear here, newest first, and greyed on each document's «Parsed text» tab. What its door rules skip is on each source's Scans tab.",
        )}
      />
    );
  }
  return (
    <Workbench>
      <Table>
        <thead>
          <tr>
            <th scope="col">{t("contentSteps.column.document", "Document")}</th>
            <th scope="col">{t("rules.column.rule", "Rule")}</th>
            <th scope="col">{t("contentSteps.column.excerpt", "Text")}</th>
            <th scope="col">{t("contentSteps.column.reason", "Why")}</th>
          </tr>
        </thead>
        <tbody>
          {dropped.data.map((drop, index) => (
            <tr key={`${drop.versionId}-${index}`}>
              <td>
                <RowLink href={`/documents/${drop.documentId}?tab=text`}>{drop.title}</RowLink>
                <div className="text-xs text-muted">
                  {drop.what === "BLOCK"
                    ? t("contentSteps.block", "Block")
                    : t("contentSteps.chunk", "Chunk")}
                  {drop.startLine !== null && (
                    <span className="numeric">
                      {" "}
                      · {t("contentSteps.line", "line {line}", { line: drop.startLine })}
                    </span>
                  )}
                  {" · "}
                  {formatDateTime(drop.parsedAt)}
                </div>
              </td>
              <td className="text-xs">{drop.step}</td>
              <td className={EXCERPT}>{drop.excerpt ?? "—"}</td>
              <td className={`text-xs text-secondary ${REASON}`}>{drop.reason}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Workbench>
  );
}
