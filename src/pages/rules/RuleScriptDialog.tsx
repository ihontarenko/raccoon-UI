import { useEffect, useState, type FormEvent } from "react";
import { describeProblem, type Problem } from "../../application/problems";
import { automationApi } from "../../lib/automation";
import { CONTENT_RULE_SCRIPT_STAGE, type ScriptView } from "../../lib/sourceContracts";
import { Notice } from "../../ui/components";
import { Button, Dialog, Field, Input, TextArea } from "../../ui/primitives";
import { useTranslation } from "../../translations/TranslationProvider";
import { declareText, type DeclaredText } from "../../translations/translate";
import { SCRIPT_FORM, SCRIPT_VARIABLES } from "./ruleSetsClasses";

/** What a scan rule script sees about the file it judges. */
const MATERIAL_VARIABLES: [name: string, meaning: DeclaredText][] = [
  [
    "externalId",
    declareText("sourceRules.scriptDialog.variable.externalId", "the path inside the source"),
  ],
  ["title", declareText("sourceRules.scriptDialog.variable.title", "the file name")],
  ["mediaType", declareText("sourceRules.scriptDialog.variable.mediaType", "the media type")],
  ["sizeBytes", declareText("sourceRules.scriptDialog.variable.sizeBytes", "the size in bytes")],
  [
    "position",
    declareText("sourceRules.scriptDialog.variable.position", "its place in the scan, by path"),
  ],
  [
    "includedBefore",
    declareText("sourceRules.scriptDialog.variable.includedBefore", "files taken before it"),
  ],
];

/** What a content rule script sees about the block or chunk it judges. */
const CONTENT_VARIABLES: [name: string, meaning: DeclaredText][] = [
  ["stage", declareText("rules.scriptDialog.variable.stage", "BLOCKS or CHUNKS")],
  ["kind", declareText("rules.scriptDialog.variable.kind", "the block kind, or CHUNK")],
  [
    "text",
    declareText("rules.scriptDialog.variable.text", "its text, as the rules before it left it"),
  ],
  ["characters", declareText("rules.scriptDialog.variable.characters", "its length")],
  ["page", declareText("rules.scriptDialog.variable.page", "its page, or 0")],
  [
    "headingLevel",
    declareText("rules.scriptDialog.variable.headingLevel", "a heading's level, or 0"),
  ],
  ["position", declareText("rules.scriptDialog.variable.position", "its place in the document")],
];

function templateFor(name: string, kind: string): string {
  const documentName =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "rule";
  if (kind === CONTENT_RULE_SCRIPT_STAGE) {
    return `script "${documentName}" {
    on contentRule when characters < 3 do
        @decision.refuse('Too short to index')
    end
}
`;
  }
  return `script "${documentName}" {
    on scanRule do
        taken++
        if taken > 3 then
            @decision.refuse('Only the first three files are taken')
        end
    end
}
`;
}

interface RuleScriptDialogProperties {
  open: boolean;
  /** The kind of rule script — `scanRule` at the door, `contentRule` over blocks and chunks; the stage decides it. */
  kind: string;
  workspaceId: string;
  /** The script being edited; null writes a new one. */
  script: ScriptView | null;
  suggestedName: string;
  onClose: () => void;
  onSaved: (script: ScriptView) => void;
}

export function RuleScriptDialog({
  open,
  kind,
  workspaceId,
  script,
  suggestedName,
  onClose,
  onSaved,
}: RuleScriptDialogProperties) {
  const { t, say } = useTranslation();
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  useEffect(() => {
    if (open) {
      setName(script?.title ?? suggestedName);
      setSource(script?.source ?? templateFor(suggestedName, kind));
      setProblem(null);
      setSaving(false);
    }
  }, [open, script, suggestedName, kind]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setProblem(null);
    try {
      // A rule only ever runs an activated version, so saving and activating are one step here.
      const written =
        script === null
          ? await automationApi.createScript(workspaceId, name.trim(), kind, source)
          : await automationApi.rewriteScript(workspaceId, script, name.trim(), source);
      onSaved(await automationApi.activateScript(workspaceId, written));
    } catch (error) {
      setProblem(describeProblem(error));
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        script === null
          ? t("sourceRules.script.new", "New rule script")
          : t("sourceRules.scriptDialog.title", "Rule script — {title}", { title: script.title })
      }
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={saving}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            type="submit"
            form="rule-script-form"
            variant="primary"
            disabled={saving || name.trim().length === 0}
          >
            {saving
              ? t("sourceRules.scriptDialog.activating", "Activating…")
              : t("sourceRules.scriptDialog.saveAndActivate", "Save and activate")}
          </Button>
        </>
      }
    >
      <form
        id="rule-script-form"
        className={SCRIPT_FORM}
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
      >
        {problem !== null && (
          <Notice
            tone="error"
            title={
              problem.kind === "invalid"
                ? t("sourceRules.scriptDialog.doesNotLoad", "The script does not load")
                : problem.title
            }
          >
            <span className="numeric">{problem.detail ?? problem.description}</span>
          </Notice>
        )}
        <Field
          label={t("sourceRules.scriptDialog.name", "Name")}
          required
          hint={t("sourceRules.scriptDialog.nameHint", "Rules find a rule script by this name.")}
        >
          <Input
            value={name}
            maxLength={160}
            onChange={(event) => {
              setName(event.target.value);
            }}
            fullWidth
          />
        </Field>
        <Field label="jMS">
          <TextArea
            code
            rows={12}
            value={source}
            onChange={(event) => {
              setSource(event.target.value);
            }}
          />
        </Field>
        <dl className={SCRIPT_VARIABLES}>
          {(kind === CONTENT_RULE_SCRIPT_STAGE ? CONTENT_VARIABLES : MATERIAL_VARIABLES).map(
            ([variable, meaning]) => (
              <div key={variable}>
                <dt className="numeric">{variable}</dt>
                <dd>{say(meaning)}</dd>
              </div>
            ),
          )}
        </dl>
        <p className="text-xs text-muted">
          {kind === CONTENT_RULE_SCRIPT_STAGE
            ? t(
                "rules.scriptDialog.contentHelp",
                "Refuse a block or a chunk with {refuse}: the rule then holds, and its action applies.",
                { refuse: <code>@decision.refuse(&apos;why&apos;)</code> },
              )
            : t(
                "sourceRules.scriptDialog.help",
                "Refuse a file with {refuse}. Anything assigned outside {local} — {example} — is remembered for the whole scan, in path order.",
                {
                  refuse: <code>@decision.refuse(&apos;why&apos;)</code>,
                  local: <code>local</code>,
                  example: <code>taken++</code>,
                },
              )}
        </p>
      </form>
    </Dialog>
  );
}
