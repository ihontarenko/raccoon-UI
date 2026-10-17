import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { usePermissions } from "../../../access/PermissionsProvider";
import { PERMISSIONS } from "../../../access/permissions";
import { describeProblem } from "../../../application/problems";
import { useResource } from "../../../application/useResource";
import type { SourceView } from "../../../lib/contracts";
import {
  ruleSetsApi,
  uniquePolicyName,
  type ListedRuleSet,
  type RuleSetPreset,
  type SourceRuleSetBinding,
} from "../../../lib/ruleSets";
import { useTranslation } from "../../../translations/TranslationProvider";
import {
  PresetPicker,
  ProblemState,
  Waiting,
  useToaster,
} from "../../../ui/components";
import { Button } from "../../../ui/primitives";
import { RuleSetBindingList } from "../../rules/RuleSetBindingList";
import { presetChoices, presetName, presetsForKind, ruleNamesOf, startingPreset } from "../../rules/presetCatalogue";
import { RulePreviewPanel, type PreviewState } from "./RulePreviewPanel";
import {
  EDITOR,
  EDITOR_INTRO,
  LAYOUT,
  PREVIEW_ELSEWHERE,
  SAVE_ACTIONS,
  SAVE_BAR,
} from "./rulesClasses";

interface SourcePoliciesProperties {
  workspaceId: string;
  source: SourceView;
  maximumDepth: number;
  /** Called after the binding is saved, so the page's counts follow. */
  onSaved?: () => void;
}

interface Loaded {
  binding: SourceRuleSetBinding;
  ruleSets: ListedRuleSet[];
  /** The ready rule sets written for this kind of source. */
  presets: RuleSetPreset[];
}

/**
 * What decides which files a source takes: the rule sets it binds, whose rules at the door judge every file it finds or
 * receives, in the order bound.
 *
 * ⚠️ NO RULE IS EDITED HERE ANY MORE. A source's rules used to be a private set edited on this tab while a profile's
 * content steps were edited somewhere else, in another form. Both are rules of a rule set now — one rule, one form, on the
 * rule set's own page — and this tab binds them, exactly as a processing profile does.
 */
export function SourceRuleSets({
  workspaceId,
  source,
  maximumDepth,
  onSaved,
}: SourcePoliciesProperties) {
  const { t } = useTranslation();
  const loaded = useResource<Loaded>(async () => {
    const [binding, ruleSets, vocabulary] = await Promise.all([
      ruleSetsApi.sourceBinding(workspaceId, source.id),
      ruleSetsApi.list(workspaceId),
      ruleSetsApi.vocabulary(workspaceId),
    ]);
    return { binding, ruleSets, presets: presetsForKind(vocabulary.presets, source.kind) };
  }, [workspaceId, source.id, source.kind]);

  if (loaded.status === "loading") {
    return <Waiting label={t("sourceRules.loading", "Loading the rules")} lines={5} />;
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
  return (
    <LoadedSourceRuleSets
      key={loaded.data.binding.revision}
      workspaceId={workspaceId}
      source={source}
      maximumDepth={maximumDepth}
      initial={loaded.data}
      onSaved={() => {
        loaded.reload();
        onSaved?.();
      }}
      onCreated={(ruleSets) => loaded.replace({ ...loaded.data, ruleSets })}
    />
  );
}

function LoadedSourceRuleSets({
  workspaceId,
  source,
  maximumDepth,
  initial,
  onSaved,
  onCreated,
}: Omit<SourcePoliciesProperties, "onSaved"> & {
  initial: Loaded;
  onSaved: () => void;
  onCreated: (ruleSets: ListedRuleSet[]) => void;
}) {
  const { t } = useTranslation();
  const { notify } = useToaster();
  const editable = usePermissions().may(PERMISSIONS.automationManage);
  const [boundIds, setBoundIds] = useState<string[]>(initial.binding.ruleSetIds);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showingPresets, setShowingPresets] = useState(false);
  const [preview, setPreview] = useState<PreviewState>({ status: "idle" });
  const offeredPresets = initial.presets;
  const [presetKey, setPresetKey] = useState(
    () => startingPreset(offeredPresets, ["documents", "web-articles", "empty"])?.key ?? "",
  );
  const dirty = JSON.stringify(boundIds) !== JSON.stringify(initial.binding.ruleSetIds);

  useEffect(() => {
    if (!dirty) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const change = (next: string[]) => {
    setBoundIds(next);
    setPreview((current) => (current.status === "done" ? { ...current, stale: true } : current));
  };

  /** A ready set of door rules becomes a rule set of its own, named for this source, and is added to what it binds. */
  const createFromPreset = async () => {
    const preset = offeredPresets.find((candidate) => candidate.key === presetKey);
    if (preset === undefined) {
      return;
    }
    setCreating(true);
    try {
      const name = uniquePolicyName(`${source.name} — ${presetName(preset)}`, initial.ruleSets);
      const created = await ruleSetsApi.createFromPreset(workspaceId, preset.key, { name, ruleNames: ruleNamesOf(preset) });
      onCreated(await ruleSetsApi.list(workspaceId));
      change([...boundIds, created.id]);
      notify({
        tone: "good",
        title: t("rules.created", "Created «{name}»", { name: created.name }),
        description: t("sourceRules.createdUnsaved", "It is bound below; save to start using it."),
      });
    } catch (error) {
      notify({ tone: "error", title: describeProblem(error).title });
    } finally {
      setCreating(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await ruleSetsApi.bindSource(workspaceId, { ...initial.binding, ruleSetIds: boundIds });
      notify({
        tone: "good",
        title: t("sourceRules.saved", "Rules saved"),
        description: t("sourceRules.savedDescription", "The next scan uses them."),
      });
      onSaved();
    } catch (error) {
      const problem = describeProblem(error);
      notify({
        tone: "error",
        title: t("sourceRules.notSaved", "The rules were not saved"),
        description: problem.detail ?? problem.description,
      });
    } finally {
      setSaving(false);
    }
  };

  const runPreview = async () => {
    setPreview({ status: "running" });
    try {
      const result = await ruleSetsApi.previewSource(workspaceId, source.id, {
        ruleSetIds: boundIds,
        maximumDepth,
      });
      setPreview({ status: "done", preview: result, stale: false });
    } catch (error) {
      setPreview({ status: "failed", problem: describeProblem(error) });
    }
  };

  return (
    <div className={LAYOUT}>
      <fieldset className={EDITOR} disabled={!editable}>
        <legend className="sr-only">
          {t("sourceRules.legend", "Rules of {name}", { name: source.name })}
        </legend>
        <div className={EDITOR_INTRO}>
          <p className="text-secondary">
            {t(
              "sourceRules.introRuleSets",
              "Every file this source finds or receives is judged by the rules at the door of the rule sets below, rule set by rule set, in this order. A file goes the way of the last rule that matched it, or stops at a rule that says so; a file no rule decides is taken. The rules themselves are edited on each rule set's page.",
            )}{" "}
            <Link to="/rules">
              {t("profiles.content.catalogue", "Every rule set in the workspace")}
            </Link>
          </p>
        </div>

        <RuleSetBindingList
          holder="SOURCE"
          ruleSets={initial.ruleSets}
          boundIds={boundIds}
          editable={editable}
          onChange={change}
        />

        {editable && (
          <div
            className={SAVE_BAR}
            data-dirty={dirty ? "true" : "false"}
            role="region"
            aria-label={t("sourceRules.saveBar", "Save the rules")}
          >
            <span className="text-xs" aria-live="polite">
              {dirty
                ? t("sourceRules.state.unsaved", "Unsaved changes")
                : t("sourceRules.state.saved", "Saved")}
            </span>
            <div className={SAVE_ACTIONS}>
              <Button
                variant="quiet"
                disabled={!dirty || saving}
                onClick={() => change(initial.binding.ruleSetIds)}
              >
                {t("sourceRules.discard", "Discard")}
              </Button>
              <Button variant="primary" disabled={!dirty || saving} onClick={() => void save()}>
                {saving
                  ? t("common.saving", "Saving…")
                  : t("sourceRules.saveBinding", "Save what it binds")}
              </Button>
            </div>
          </div>
        )}

        {/* ⚠️ CLOSED UNTIL ASKED FOR. What the source binds is what this tab is about; a dozen ready sets laid out
            open pushed the binding to the top edge and read as the page's main content. */}
        {editable && !showingPresets && (
          <div>
            <Button
              variant="quiet"
              icon="plus"
              aria-expanded={false}
              onClick={() => setShowingPresets(true)}
            >
              {t("sourceRules.showPresets", "Start a new rule set from ready rules…")}
            </Button>
          </div>
        )}
        {editable && showingPresets && (
          <PresetPicker
            label={t(
              "sourceRules.presetRuleSetLabel",
              "Start a rule set for this source from ready rules",
            )}
            hint={t(
              "sourceRules.presetRuleSetHint",
              "Ready rules for the door, written for this kind of source. The chosen set becomes a rule set of its own, bound here; edit its rules on its page afterwards.",
            )}
            choices={presetChoices(offeredPresets, t)}
            selectedKey={presetKey}
            onSelect={setPresetKey}
            action={
              <>
                <Button icon="plus" disabled={creating || presetKey === ""} onClick={() => void createFromPreset()}>
                  {t("sourceRules.createRuleSet", "Create and bind")}
                </Button>
                <Button variant="quiet" onClick={() => setShowingPresets(false)}>
                  {t("common.cancel", "Cancel")}
                </Button>
              </>
            }
          />
        )}
      </fieldset>

      {source.kind === "LOCAL_FOLDER" ? (
        <RulePreviewPanel state={preview} onRun={() => void runPreview()} />
      ) : (
        <aside
          className={PREVIEW_ELSEWHERE}
          aria-label={t("sourceRules.effectElsewhere", "Where the rules show their effect")}
        >
          <p className="text-xs text-secondary">
            {source.kind === "GIT" || source.kind === "WEB"
              ? t(
                  "sourceRules.effectInScans",
                  "A repository or web pages are fetched only by a scan, so there is no folder to preview against: the Scans tab shows what each scan took and why.",
                )
              : t(
                  "sourceRules.effectOnArrival",
                  "Every document arriving here is judged by these rules as it arrives — one that a rule skips is refused, with the rule named.",
                )}
          </p>
        </aside>
      )}
    </div>
  );
}
