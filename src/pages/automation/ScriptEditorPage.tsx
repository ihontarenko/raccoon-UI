import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { usePermissions } from "../../access/PermissionsProvider";
import { PERMISSIONS } from "../../access/permissions";
import { shortIdentifier } from "../../application/format";
import { describeProblem, type Problem } from "../../application/problems";
import { useReadySession } from "../../application/session";
import { usePageTitle } from "../../application/usePageTitle";
import { useResource } from "../../application/useResource";
import { collectAllPages } from "../../lib/api";
import { automationApi, type ScriptGroup, type StageView } from "../../lib/automation";
import { CONTENT_RULE_SCRIPT_STAGE, RULE_SCRIPT_STAGE, type ScriptView } from "../../lib/sourceContracts";
import { useTranslation } from "../../translations/TranslationProvider";
import { CodeEditor, Notice, PageHeader, ProblemState, Waiting, useToaster } from "../../ui/components";
import { scriptCatalogue } from "../../ui/components/code/scriptCatalogue";
import { Badge, Button, Field, Input, Select } from "../../ui/primitives";
import { ScriptDryRunPanel } from "./ScriptDryRunPanel";
import { CRUMB, EDITOR_LAYOUT, EDITOR_MAIN, EDITOR_SIDE, FACADES, LIFECYCLE, PANEL, SAVE_ACTIONS, SAVE_BAR, SIDE_PANEL, SIDE_TITLE, SOURCE_FIELD, SOURCE_HEAD, SOURCE_LABEL, TWO_COLUMNS, VARIABLES } from "./automationClasses";

const NEW_SCRIPT = "new";
const TITLE_LIMIT = 160;

/** What a rule script sees, since the stage catalogue lists only event stages' variables. */
const RULE_SCRIPT_VARIABLES = ["externalId", "title", "mediaType", "sizeBytes", "sourceKind", "sourceId", "position", "includedBefore"];

function skeleton(title: string, stage: string): string {
  const name = title.trim() === "" ? "my-script" : title.trim();
  return `script "${name}" {\n    on ${stage} do\n        @log.info('${name} ran')\n    end\n}\n`;
}

interface Loaded {
  script: ScriptView | null;
  stages: StageView[];
  groups: ScriptGroup[];
  starting: { stage: string; source: string } | null;
}

/** Writes and publishes one script at `/automation/scripts/$scriptId`, or a new one at `.../new`. */
export function ScriptEditorPage() {
  const { scriptId } = useParams({ strict: false }) as { scriptId: string };
  const search = useSearch({ strict: false }) as { example?: string; stage?: string };
  const { workspace } = useReadySession();
  const workspaceId = workspace?.id ?? "";
  const { t } = useTranslation();

  const loaded = useResource<Loaded>(async () => {
    const [script, stages, groups] = await Promise.all([
      scriptId === NEW_SCRIPT ? Promise.resolve(null) : automationApi.script(workspaceId, scriptId),
      automationApi.stages(workspaceId),
      collectAllPages((page) => automationApi.groups(workspaceId, page)),
    ]);
    let starting: Loaded["starting"] = null;
    if (script === null && search.example !== undefined) {
      const [example, shipped] = await Promise.all([automationApi.shippedSource(workspaceId, search.example), automationApi.shipped(workspaceId)]);
      starting = { stage: shipped.find((candidate) => candidate.name === example.name)?.stage ?? "materialFound", source: example.source };
    } else if (script === null && search.stage === undefined) {
      starting = await automationApi.template(workspaceId);
    }
    return { script, stages, groups, starting };
  }, [workspaceId, scriptId, search.example]);

  if (loaded.status === "loading") {
    return <Waiting label={t("automation.script.loading", "Loading the script")} lines={8} />;
  }
  if (loaded.status === "failed") {
    return (
      <ProblemState
        problem={loaded.problem}
        actions={
          <Button href="/automation" variant="quiet">
            {t("automation.script.allScripts", "All scripts")}
          </Button>
        }
      />
    );
  }
  return (
    <ScriptEditor
      key={`${scriptId}:${loaded.data.script?.revision ?? 0}`}
      workspaceId={workspaceId}
      loaded={loaded.data}
      requestedStage={search.stage}
      exampleName={search.example}
      onSaved={loaded.reload}
    />
  );
}

function ScriptEditor({
  workspaceId,
  loaded,
  requestedStage,
  exampleName,
  onSaved,
}: {
  workspaceId: string;
  loaded: Loaded;
  requestedStage: string | undefined;
  exampleName: string | undefined;
  onSaved: () => void;
}) {
  const { script, stages, groups, starting } = loaded;
  const navigate = useNavigate();
  const { notify } = useToaster();
  const { t } = useTranslation();
  const mayManage = usePermissions().may(PERMISSIONS.automationManage);
  const initialStage = script?.stage ?? requestedStage ?? starting?.stage ?? "materialFound";
  const [title, setTitle] = useState(script?.title ?? exampleName ?? "");
  const [stage, setStage] = useState(initialStage);
  const [source, setSource] = useState(script?.source ?? starting?.source ?? skeleton(exampleName ?? "", initialStage));
  const [titleError, setTitleError] = useState<string | undefined>(undefined);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [working, setWorking] = useState<"save" | "publish" | null>(null);
  usePageTitle(script === null ? t("automation.newScript", "New script") : script.title);

  const dirty = script === null || title !== script.title || source !== script.source;
  const stageView = stages.find((candidate) => candidate.name === stage) ?? null;
  const variables = stage === RULE_SCRIPT_STAGE ? RULE_SCRIPT_VARIABLES : (stageView?.variables ?? []);
  const usedBy = useMemo(
    () => (script?.activeVersionId === null || script === null ? [] : groups.filter((group) => group.configuration.bindings.some((binding) => binding.scriptVersionId === script.activeVersionId))),
    [groups, script],
  );

  useEffect(() => {
    if (!dirty || script === null) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, [dirty, script]);

  /** Writes the draft; a new script is created first. Returns the script as the server now holds it. */
  const writeDraft = async (): Promise<ScriptView | null> => {
    if (title.trim().length === 0) {
      setTitleError(
        stage === RULE_SCRIPT_STAGE
          ? t("automation.script.nameRequired", "Name the rule script; rules refer to it by this name.")
          : t("automation.script.titleRequired", "Give the script a title."),
      );
      return null;
    }
    setTitleError(undefined);
    if (script === null) {
      return automationApi.createScript(workspaceId, title.trim(), stage, source);
    }
    return dirty ? automationApi.rewriteScript(workspaceId, script, title.trim(), source) : script;
  };

  const run = async (publish: boolean) => {
    setWorking(publish ? "publish" : "save");
    setProblem(null);
    try {
      const written = await writeDraft();
      if (written === null) {
        setWorking(null);
        return;
      }
      const result = publish ? await automationApi.activateScript(workspaceId, written) : written;
      notify({
        tone: "good",
        title: publish
          ? t("automation.script.publishedNotice", "{title} published", { title: result.title })
          : t("automation.script.draftSavedNotice", "{title} saved as a draft", { title: result.title }),
        description: publish
          ? t("automation.script.publishedNoticeDescription", "Groups binding its earlier version keep it until they are changed.")
          : t("automation.script.draftSavedNoticeDescription", "The live version is unchanged until you publish."),
      });
      if (script === null) {
        void navigate({ to: "/automation/scripts/$scriptId", params: { scriptId: result.id }, replace: true });
      } else {
        onSaved();
      }
    } catch (error) {
      setProblem(describeProblem(error));
      setWorking(null);
      onSaved();
    }
  };

  const catalogue = useMemo(() => scriptCatalogue(stages, { [RULE_SCRIPT_STAGE]: RULE_SCRIPT_VARIABLES }), [stages]);
  const published = script !== null && script.activeVersionId !== null;
  const bound = stage === RULE_SCRIPT_STAGE ? published : usedBy.length > 0;

  const decision = stages.filter((candidate) => candidate.timing === "DECISION" && candidate.name !== RULE_SCRIPT_STAGE && candidate.name !== CONTENT_RULE_SCRIPT_STAGE);
  const observation = stages.filter((candidate) => candidate.timing === "OBSERVATION");

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Link to="/automation" className={CRUMB}>
              {t("automation.title", "Automation")}
            </Link>{" "}
            / {stage === RULE_SCRIPT_STAGE ? t("automation.script.ruleScript", "Rule script") : t("automation.script.eventScript", "Event script")}
          </>
        }
        title={script === null ? t("automation.newScript", "New script") : script.title}
        status={
          script === null ? undefined : (
            <>
              <Badge tone={script.bindState === "BOUND" ? "allow" : "deny"}>
                {script.bindState === "BOUND" ? t("automation.script.draftBinds", "Draft binds") : t("automation.script.draftRefused", "Draft refused")}
              </Badge>{" "}
              <Badge tone={published ? "good" : "neutral"}>
                {published ? t("automation.script.published", "Published") : t("automation.script.neverPublished", "Never published")}
              </Badge>
            </>
          )
        }
        lead={
          stageView?.description ??
          (stage === RULE_SCRIPT_STAGE ? t("automation.script.ruleScriptLead", "Judges one file during a scan; a source's script rule names it.") : undefined)
        }
      />
      <div className={EDITOR_LAYOUT}>
        <div className={EDITOR_MAIN}>
          {problem !== null && (
            <Notice tone="error" title={problem.title}>
              {problem.detail ?? problem.description}
            </Notice>
          )}
          {script?.bindProblem !== null && script?.bindProblem !== undefined && (
            <Notice tone="warn" title={t("automation.script.draftDoesNotBind", "The draft does not bind")}>
              {script.bindProblem}
            </Notice>
          )}
          <fieldset className={PANEL} disabled={!mayManage}>
            <div className={TWO_COLUMNS}>
              <Field
                label={stage === RULE_SCRIPT_STAGE ? t("automation.script.name", "Name") : t("automation.script.title", "Title")}
                required
                error={titleError}
              >
                <Input
                  value={title}
                  maxLength={TITLE_LIMIT}
                  fullWidth
                  onChange={(event) => {
                    setTitle(event.target.value);
                  }}
                />
              </Field>
              <Field
                label={t("automation.scripts.column.reactsTo", "Reacts to")}
                hint={script === null ? t("automation.script.stageFixed", "Fixed once the script is created.") : undefined}
              >
                <Select
                  value={stage}
                  fullWidth
                  disabled={script !== null}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (source === skeleton(title, stage)) {
                      setSource(skeleton(title, next));
                    }
                    setStage(next);
                  }}
                >
                  <optgroup label={t("automation.script.decidesGroup", "Decides — may refuse or narrow")}>
                    {decision.map((candidate) => (
                      <option key={candidate.name} value={candidate.name}>
                        {candidate.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={t("automation.script.observesGroup", "Observes — records only")}>
                    {observation.map((candidate) => (
                      <option key={candidate.name} value={candidate.name}>
                        {candidate.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={t("automation.script.scanRulesGroup", "Scan rules")}>
                    <option value={RULE_SCRIPT_STAGE}>{t("automation.scanRule", "scan rule")}</option>
                    <option value={CONTENT_RULE_SCRIPT_STAGE}>{t("automation.contentRule", "content rule")}</option>
                  </optgroup>
                </Select>
              </Field>
            </div>
            <div className={SOURCE_FIELD}>
              <div className={SOURCE_HEAD}>
                <span className={SOURCE_LABEL}>{t("automation.script.source", "Source")}</span>
                <span className="text-xs text-muted">
                  {t(
                    "automation.script.sourceHint",
                    "jMS · type {at} for what the script may call, {on} for a stage · binds when saved, runs once published",
                    { at: <code>@</code>, on: <code>on</code> },
                  )}
                </span>
              </div>
              <CodeEditor
                value={source}
                label={
                  title.trim() === ""
                    ? t("automation.script.sourceOfNew", "Source of the new script")
                    : t("automation.script.sourceOf", "Source of {title}", { title: title.trim() })
                }
                readOnly={!mayManage}
                catalogue={catalogue}
                onChange={(next) => {
                  setSource(next);
                }}
              />
            </div>
          </fieldset>
          {mayManage && (
            <div className={SAVE_BAR} data-dirty={dirty}>
              <span className="text-xs" aria-live="polite">
                {script === null
                  ? t("automation.script.notCreated", "Not created yet")
                  : dirty
                    ? t("automation.script.unsaved", "Unsaved changes")
                    : script.activeVersionId === null
                      ? t("automation.script.savedNotPublished", "Saved — not published yet")
                      : t("automation.script.saved", "Saved")}
              </span>
              <div className={SAVE_ACTIONS}>
                <Button variant="quiet" disabled={!dirty || working !== null} onClick={() => void run(false)}>
                  {working === "save" ? t("common.saving", "Saving…") : t("automation.script.saveDraft", "Save draft")}
                </Button>
                <Button variant="primary" icon="play" disabled={working !== null} onClick={() => void run(true)}>
                  {working === "publish"
                    ? t("automation.script.publishing", "Publishing…")
                    : dirty
                      ? t("automation.script.saveAndPublish", "Save and publish")
                      : t("automation.script.publish", "Publish")}
                </Button>
              </div>
            </div>
          )}
          {script !== null && (
            <ScriptDryRunPanel workspaceId={workspaceId} scriptId={script.id} stage={stage} source={source} variables={variables} />
          )}
        </div>
        <aside className={EDITOR_SIDE} aria-label={t("automation.script.sideLabel", "What the script can use")}>
          <section className={SIDE_PANEL} aria-labelledby="script-lifecycle">
            <h2 id="script-lifecycle" className={SIDE_TITLE}>
              {t("automation.script.lifecycle", "Its way to running")}
            </h2>
            <ol className={LIFECYCLE}>
              <li data-state={script === null ? "current" : "done"}>
                <strong>{t("automation.script.draft", "Draft")}</strong>
                <span className="text-xs text-muted">
                  {script === null
                    ? t("automation.script.draftFirstSave", "Saved the first time you save.")
                    : script.bindState === "BOUND"
                      ? t("automation.script.revisionBinds", "Revision {revision} binds.", { revision: script.revision })
                      : t("automation.script.revisionDoesNotBind", "Revision {revision} does not bind.", { revision: script.revision })}
                </span>
              </li>
              <li data-state={published ? "done" : script === null ? "waiting" : "current"}>
                <strong>{t("automation.script.published", "Published")}</strong>
                <span className="text-xs text-muted">
                  {published && script !== null && script.activeVersionId !== null
                    ? t("automation.script.liveVersion", "Live version {version}.", {
                        version: <span className="numeric">{shortIdentifier(script.activeVersionId)}</span>,
                      })
                    : t("automation.script.onlyPublishedRuns", "Only a published version ever runs.")}
                </span>
              </li>
              <li data-state={bound ? "done" : published ? "current" : "waiting"}>
                <strong>
                  {stage === RULE_SCRIPT_STAGE ? t("automation.script.namedByRule", "Named by a rule") : t("automation.script.boundByGroup", "Bound by a group")}
                </strong>
                <span className="text-xs text-muted">
                  {stage === RULE_SCRIPT_STAGE
                    ? title.trim() === ""
                      ? t("automation.script.ruleRunsIt", "A source rule naming it runs it.")
                      : t("automation.script.ruleNamingRunsIt", "A source rule naming “{title}” runs it.", { title: title.trim() })
                    : bound
                      ? t("automation.script.runsIn", "Runs in {groups}.", { groups: usedBy.map((group) => group.name).join(", ") })
                      : t("automation.script.bindOnGroups", "Bind it on the Groups tab to make it run.")}
                </span>
              </li>
            </ol>
          </section>
          <section className={SIDE_PANEL}>
            <h2 className={SIDE_TITLE}>{t("automation.script.variables", "Variables")}</h2>
            <p className="text-xs text-secondary">
              {t("automation.script.variablesAt", "What the script can read at {stage}.", {
                stage: <span className="numeric">{stage === RULE_SCRIPT_STAGE ? t("automation.script.aScanRule", "a scan rule") : stage}</span>,
              })}
            </p>
            <ul className={VARIABLES}>
              {variables.map((variable) => (
                <li key={variable}>
                  <code>{variable}</code>
                </li>
              ))}
            </ul>
            {stageView !== null && (
              <p className="text-xs text-muted">
                {stageView.timing === "DECISION"
                  ? t("automation.script.decisionStage", "A decision stage: a refusal here stops the work, unless the group binding ignores failures.")
                  : t(
                      "automation.script.observationStage",
                      "An observation stage: the work is already committed; a group must bind it with failures ignored.",
                    )}
              </p>
            )}
            {stage === RULE_SCRIPT_STAGE && (
              <p className="text-xs text-muted">
                {t("automation.script.decideWith", "Decide with {call}. Variables a rule script sets last for the whole scan.", {
                  call: <code>@decision.refuse('why')</code>,
                })}
              </p>
            )}
          </section>
          <section className={SIDE_PANEL} aria-labelledby="script-facades">
            <h2 id="script-facades" className={SIDE_TITLE}>
              {t("automation.script.mayCall", "May call")}
            </h2>
            <dl className={FACADES}>
              {(catalogue.facades ?? []).map((facade) => (
                <div key={facade.name}>
                  <dt>
                    <code>@{facade.name}</code>
                  </dt>
                  <dd className="text-xs text-muted">{facade.detail}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-muted">
              {t("automation.script.facadesNarrow", "A facade only narrows or records; it can never widen what the work was admitted with.")}
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
