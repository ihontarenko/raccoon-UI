import { useEffect, useMemo, useState, type FormEvent } from "react";
import { describeProblem, type Problem } from "../../../application/problems";
import { accessAdministrationApi, jmpLineOf, type AccessCatalogue, type PermissionDeclaration } from "../../../lib/accessAdministration";
import type { SubjectView, WorkspaceView } from "../../../lib/contracts";
import { useTranslation } from "../../../translations/TranslationProvider";
import { Notice, Segmented } from "../../../ui/components";
import { Button, Dialog, Field, Select, TextArea } from "../../../ui/primitives";

/*
 * A rule is four decisions, asked in the order a person thinks them: who, where, what, and allow or deny. The jMP line
 * it becomes is shown under them and changes as they change — so the form never hides what it writes.
 */
const STEPS = "grid gap-4";

const TWO = ["grid grid-cols-2 gap-3", "max-[700px]:grid-cols-[minmax(0,1fr)]"].join(" ");

const SHORTCUTS = "flex flex-wrap gap-2";

/* Permissions grouped by namespace, each a radio row with its sentence — chosen in the open, never from a blind list. */
const GROUPS = "grid max-h-[calc(320px*var(--ui-scale))] gap-3 overflow-auto border border-line p-3";

const GROUP_TITLE = "m-0 mb-1 text-2xs font-semibold tracking-[0.06em] text-muted uppercase";

const OPTION = [
  "grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 px-2 py-1",
  "hover:bg-well has-[input:checked]:bg-well has-[input:checked]:shadow-[inset_3px_0_0_var(--accent)]",
].join(" ");

const PREVIEW = "m-0 overflow-x-auto border border-line bg-well px-3 py-2 font-mono text-xs whitespace-pre";

/** What a namespace is, said once above its permissions. */
const NAMESPACE_ORDER = ["channel", "parser", "document", "source", "automation", "workspace", "job", "system", "identity"];

interface RuleDialogProperties {
  open: boolean;
  catalogue: AccessCatalogue;
  subjects: SubjectView[];
  workspaces: WorkspaceView[];
  /** The slice the screen is on, so the form starts where the person already is. */
  initialSubjectId: string;
  initialWorkspaceId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function RuleDialog({ open, catalogue, subjects, workspaces, initialSubjectId, initialWorkspaceId, onClose, onSaved }: RuleDialogProperties) {
  const { t } = useTranslation();
  const [subjectId, setSubjectId] = useState(initialSubjectId);
  const [workspaceId, setWorkspaceId] = useState(initialWorkspaceId);
  const [permission, setPermission] = useState("");
  const [effect, setEffect] = useState<"DENY" | "ALLOW">("DENY");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  useEffect(() => {
    if (open) {
      setSubjectId(initialSubjectId || subjects[0]?.id || "");
      setWorkspaceId(initialWorkspaceId);
      setPermission("");
      setEffect("DENY");
      setReason("");
      setProblem(null);
    }
  }, [open, initialSubjectId, initialWorkspaceId, subjects]);

  const grouped = useMemo(() => {
    const groups = new Map<string, PermissionDeclaration[]>();
    for (const declaration of catalogue.permissions) {
      groups.set(declaration.namespace, [...(groups.get(declaration.namespace) ?? []), declaration]);
    }
    return [...groups.entries()].sort(
      ([left], [right]) => rank(left) - rank(right) || left.localeCompare(right),
    );
  }, [catalogue]);

  const shortcuts: { label: string; permission: string }[] = [
    { label: t("access.shortcut.mcp", "Keep agents out (MCP)"), permission: "channel:mcp" },
    { label: t("access.shortcut.telegram", "Keep Telegram out"), permission: "channel:telegram" },
    { label: t("access.shortcut.pdf", "No PDF parsing"), permission: "parser:pdf_text" },
    { label: t("access.shortcut.write", "No new documents"), permission: "document:write" },
  ];

  const missingReason = effect === "DENY" && reason.trim() === "";
  const ready = subjectId !== "" && permission !== "" && !missingReason;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready) {
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      await accessAdministrationApi.write({
        subjectId,
        permission,
        workspaceId: workspaceId === "" ? null : workspaceId,
        kind: effect,
        reason: reason.trim() === "" ? null : reason.trim(),
      });
      onSaved();
    } catch (error) {
      setProblem(describeProblem(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="wide"
      title={t("access.dialog.title", "New access rule")}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button variant="primary" type="submit" form="access-rule" disabled={!ready || saving}>
            {saving ? t("common.saving", "Saving…") : effect === "DENY" ? t("access.dialog.deny", "Write the denial") : t("access.dialog.allow", "Write the allowance")}
          </Button>
        </>
      }
    >
      <form id="access-rule" className={STEPS} onSubmit={(event) => void submit(event)}>
        <div className={TWO}>
          <Field label={t("access.dialog.who", "Who")}>
            <Select value={subjectId} fullWidth onChange={(event) => setSubjectId(event.target.value)}>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.displayName}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={t("access.dialog.where", "Where")}
            hint={workspaceId === "" ? t("access.dialog.everywhereHint", "Every workspace, and the installation itself.") : undefined}
          >
            <Select value={workspaceId} fullWidth onChange={(event) => setWorkspaceId(event.target.value)}>
              <option value="">{t("access.everywhere", "Every workspace")}</option>
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-2">
          <span className="text-xs font-[550] text-secondary">{t("access.dialog.what", "What")}</span>
          <div className={SHORTCUTS} aria-label={t("access.dialog.shortcuts", "Common rules")}>
            {shortcuts.map((shortcut) => (
              <Button
                key={shortcut.permission}
                variant="quiet"
                onClick={() => {
                  setPermission(shortcut.permission);
                  setEffect("DENY");
                }}
              >
                {shortcut.label}
              </Button>
            ))}
          </div>
          <div className={GROUPS} role="radiogroup" aria-label={t("access.dialog.permission", "Permission")}>
            {grouped.map(([namespace, declarations]) => (
              <div key={namespace}>
                <h4 className={GROUP_TITLE}>{namespace}</h4>
                {declarations.map((declaration) => (
                  <label key={declaration.name} className={OPTION}>
                    <input
                      type="radio"
                      name="access-permission"
                      value={declaration.name}
                      checked={permission === declaration.name}
                      onChange={() => setPermission(declaration.name)}
                    />
                    <span className="grid">
                      <span className="font-mono text-xs">{declaration.name}</span>
                      {declaration.description !== null && <span className="text-xs text-secondary">{declaration.description}</span>}
                    </span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className={TWO}>
          <div className="grid content-start gap-1.5">
            <span className="text-xs font-[550] text-secondary">{t("access.dialog.effect", "Effect")}</span>
            <Segmented<"DENY" | "ALLOW">
              label={t("access.dialog.effect", "Effect")}
              value={effect}
              onChange={setEffect}
              options={[
                { value: "DENY", label: t("access.kind.deny", "Deny") },
                { value: "ALLOW", label: t("access.kind.allow", "Allow") },
              ]}
            />
            <span className="text-xs text-muted">
              {effect === "DENY"
                ? t("access.dialog.denyHint", "A denial wins over every role and allowance, everywhere it applies.")
                : t("access.dialog.allowHint", "An allowance adds one permission on top of the roles.")}
            </span>
          </div>
          <Field
            label={t("access.dialog.reason", "Why")}
            required={effect === "DENY"}
            error={missingReason && permission !== "" ? t("access.dialog.reasonRequired", "A denial needs a reason.") : undefined}
          >
            <TextArea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        </div>

        <div className="grid gap-1">
          <span className="text-xs font-[550] text-secondary">{t("access.dialog.preview", "As jMP")}</span>
          <pre className={PREVIEW}>
            {permission === ""
              ? t("access.dialog.previewEmpty", "Choose a permission to see the rule.")
              : jmpLineOf({ kind: effect, subjectId, name: permission, workspaceId: workspaceId === "" ? null : workspaceId })}
          </pre>
        </div>

        {problem !== null && (
          <Notice tone="error" title={problem.title}>
            {problem.detail ?? problem.description}
          </Notice>
        )}
      </form>
    </Dialog>
  );
}

function rank(namespace: string): number {
  const position = NAMESPACE_ORDER.indexOf(namespace);
  return position < 0 ? NAMESPACE_ORDER.length : position;
}
