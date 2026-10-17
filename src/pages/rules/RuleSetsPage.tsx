import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Can } from "../../access/Can";
import { usePermissions } from "../../access/PermissionsProvider";
import { useStoredChoice } from "../../application/useStoredChoice";
import { RuleFlow } from "./RuleFlow";
import { PERMISSIONS } from "../../access/permissions";
import { describeProblem } from "../../application/problems";
import { useReadySession } from "../../application/session";
import { usePageTitle } from "../../application/usePageTitle";
import { useResource } from "../../application/useResource";
import {
  holderAddress,
  ruleSetsApi,
  uniquePolicyName,
  type ListedRuleSet,
  type RuleVocabulary,
} from "../../lib/ruleSets";
import { useTranslation } from "../../translations/TranslationProvider";
import {
  EmptyState,
  PageHeader,
  PresetPicker,
  ProblemState,
  Segmented,
  Waiting,
  useToaster,
} from "../../ui/components";
import { Badge, Button, Table } from "../../ui/primitives";
import { BADGES, BOUND_LIST, PAGE, SECTION, TABLE_SURFACE } from "./ruleSetsClasses";
import { holderTone, placeTone, stageName, stagePlace } from "./ruleWords";
import { pipelinePresets, presetChoices, presetName } from "./presetCatalogue";

/** Which rule sets the list shows: all of them, or those with rules at the door, or in the pipeline. */
type Shown = "all" | "door" | "pipeline";
type View = "flow" | "list";

/**
 * Every rule set of the workspace in one list — the one place a rule is found, whatever stage it runs at.
 *
 * A rule set is a named list of rules bound to what it decides for: a source runs its rules at the door, a processing
 * profile runs its rules in the pipeline. Each row says where its rules run and what binds it, and opens the one editor.
 */
export function RuleSetsPage() {
  const { t } = useTranslation();
  usePageTitle(t("rules.title", "Rule sets"));
  const { workspace } = useReadySession();
  const workspaceId = workspace?.id ?? "";
  const navigate = useNavigate();
  const { notify } = useToaster();
  const [shown, setShown] = useState<Shown>("all");
  const [view, setView] = useStoredChoice<View>("raccoon.rules.view", "flow", ["flow", "list"]);
  const mayManage = usePermissions().may(PERMISSIONS.automationManage);
  const [presetKey, setPresetKey] = useState("");
  const [creating, setCreating] = useState(false);
  const ruleSets = useResource<ListedRuleSet[]>(() => ruleSetsApi.list(workspaceId), [workspaceId]);
  const vocabulary = useResource<RuleVocabulary>(
    () => ruleSetsApi.vocabulary(workspaceId),
    [workspaceId],
  );

  const open = (ruleSetId: string) =>
    void navigate({ to: "/rules/$ruleSetId", params: { ruleSetId } });

  /** A pipeline preset carries no rule this interface names, so only the rule set's name is the viewer's. */
  const createFromCatalogue = (key: string) => {
    const preset = vocabulary.status === "ready" ? vocabulary.data.presets.find((candidate) => candidate.key === key) : undefined;
    return ruleSetsApi.createFromPreset(workspaceId, key, preset === undefined ? {} : { name: presetName(preset) });
  };

  const create = async (preset: string | null) => {
    setCreating(true);
    try {
      const created =
        preset === null
          ? await ruleSetsApi.create(
              workspaceId,
              uniquePolicyName(
                t("rules.newName", "New rule set"),
                ruleSets.status === "ready" ? ruleSets.data : [],
              ),
              { rules: [] },
            )
          : await createFromCatalogue(preset);
      notify({
        tone: "good",
        title: t("rules.created", "Created «{name}»", { name: created.name }),
      });
      open(created.id);
    } catch (error) {
      notify({ tone: "error", title: describeProblem(error).title });
      setCreating(false);
    }
  };

  const header = (
    <PageHeader
      eyebrow={t("rules.eyebrow", "Pipeline")}
      title={t("rules.title", "Rule sets")}
      lead={t(
        "rules.lead",
        "A rule set is a named list of rules. Each rule looks at a fragment — a file at the door, a parsed block, a chunk, a piece of text — and keeps it, drops it or rewrites it. A source binds rule sets for their rules at the door; a processing profile binds them for their rules in the pipeline.",
      )}
      actions={
        <Can permission={PERMISSIONS.automationManage}>
          <Button
            variant="primary"
            icon="plus"
            disabled={creating || ruleSets.status !== "ready"}
            onClick={() => void create(null)}
          >
            {t("rules.new", "New rule set")}
          </Button>
        </Can>
      }
    />
  );

  if (ruleSets.status === "loading") {
    return (
      <div className={PAGE}>
        {header}
        <Waiting label={t("rules.loading", "Loading the rule sets")} lines={4} />
      </div>
    );
  }
  if (ruleSets.status === "failed") {
    return (
      <div className={PAGE}>
        {header}
        <ProblemState problem={ruleSets.problem} layout="section" />
      </div>
    );
  }

  const atDoor = (ruleSet: ListedRuleSet) => ruleSet.stages.includes("MATERIAL");
  const inPipeline = (ruleSet: ListedRuleSet) => ruleSet.stages.some((stage) => stage !== "MATERIAL");
  const listed = ruleSets.data.filter(
    (ruleSet) => shown === "all" || (shown === "door" ? atDoor(ruleSet) : inPipeline(ruleSet)),
  );

  return (
    <div className={PAGE}>
      {header}

      <Segmented<View>
        label={t("rules.view.label", "Show rules")}
        value={view}
        onChange={setView}
        options={[
          { value: "flow", label: t("rules.view.flow", "As a flow"), title: t("rules.view.flowTitle", "Every rule on the path a document takes, stage by stage") },
          { value: "list", label: t("rules.view.list", "As a list of rule sets") },
        ]}
      />

      {view === "flow" ? (
        <RuleFlow ruleSets={ruleSets.data} editable={mayManage} />
      ) : (
      <>
      <Segmented
        label={t("rules.filterLabel", "Which rule sets")}
        value={shown}
        onChange={setShown}
        options={[
          { value: "all", label: t("rules.filter.all", "All"), count: ruleSets.data.length },
          {
            value: "door",
            label: t("rules.filter.door", "At the door"),
            count: ruleSets.data.filter(atDoor).length,
          },
          {
            value: "pipeline",
            label: t("rules.filter.pipeline", "In the pipeline"),
            count: ruleSets.data.filter(inPipeline).length,
          },
        ]}
      />

      {listed.length === 0 ? (
        <EmptyState
          title={t("rules.noneTitle", "No rule sets here.")}
          description={t(
            "rules.noneText",
            "A source that binds no rule set takes everything it finds, and a profile that binds none indexes everything its parser read. Start one below, or from a source's Rules tab.",
          )}
        />
      ) : (
        <div className={TABLE_SURFACE}>
          <Table>
            <thead>
              <tr>
                <th scope="col">{t("rules.column.name", "Rule set")}</th>
                <th scope="col">{t("rules.column.stages", "Runs at")}</th>
                <th scope="col" className="numeric">
                  {t("rules.column.rules", "Rules")}
                </th>
                <th scope="col" className="wraps">
                  {t("rules.column.usedBy", "Bound to")}
                </th>
                <th scope="col">
                  <span className="sr-only">{t("contentSteps.column.actions", "Actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {listed.map((ruleSet) => (
                <tr key={ruleSet.id}>
                  <td>
                    <Link
                      to="/rules/$ruleSetId"
                      params={{ ruleSetId: ruleSet.id }}
                      className="font-[550] text-ink no-underline hover:text-accent-text hover:underline"
                    >
                      {ruleSet.name}
                    </Link>
                    <div className="numeric text-xs text-muted">
                      {t("rules.revision", "Revision {revision}", { revision: ruleSet.revision })}
                    </div>
                  </td>
                  <td>
                    {ruleSet.stages.length === 0 ? (
                      <span className="text-xs text-muted">
                        {t("rules.noRules", "No rules yet")}
                      </span>
                    ) : (
                      // A place, coloured as one: violet at the door, teal in the pipeline — never the accent, which means state.
                      <span className={BADGES}>
                        {ruleSet.stages.map((stage) => (
                          <Badge key={stage} tone={placeTone(stage)}>
                            {stagePlace(stage, t)} · {stageName(stage, t)}
                          </Badge>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="numeric">{ruleSet.rules}</td>
                  <td className="wraps">
                    {ruleSet.usedBy.length === 0 ? (
                      <span className="text-xs text-warn">
                        {t("rules.boundToNothing", "Nothing — it runs nowhere")}
                      </span>
                    ) : (
                      <ul className={BOUND_LIST}>
                        {ruleSet.usedBy.map((binding) => (
                          <li key={`${binding.holder}-${binding.id}`}>
                            <Badge tone={holderTone(binding.holder)}>
                              {binding.holder === "SOURCE"
                                ? t("rules.holder.source", "Source")
                                : t("rules.holder.profile", "Processing profile")}
                            </Badge>{" "}
                            <Link to={holderAddress(binding)}>{binding.name}</Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="actions">
                    <Button href={`/rules/${ruleSet.id}`} variant="quiet" icon="edit">
                      {t("common.edit", "Edit")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
      </>
      )}

      <Can permission={PERMISSIONS.automationManage}>
        {vocabulary.status === "ready" && (
          <section className={SECTION}>
            <PresetPicker
              label={t("rules.presetLabel", "Start from a ready rule set")}
              hint={t(
                "rules.presetHint",
                "A whole rule set, not a single rule: «the usual cleanup» and «scanned paper» are two things to maintain, and a profile may bind both. What it creates is an ordinary rule set afterwards and is edited like any other. Ready rules for a source's door are offered on the source itself, by the kind of source it is.",
              )}
              choices={presetChoices(pipelinePresets(vocabulary.data.presets), t)}
              selectedKey={presetKey}
              onSelect={setPresetKey}
              action={
                <Button
                  icon="plus"
                  disabled={presetKey === "" || creating}
                  onClick={() => void create(presetKey)}
                >
                  {t("rules.createFromPreset", "Create this rule set")}
                </Button>
              }
            />
          </section>
        )}
      </Can>
    </div>
  );
}
