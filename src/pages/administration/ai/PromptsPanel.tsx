import { useState, type FormEvent } from "react";
import { usePermissions } from "../../../access/PermissionsProvider";
import { PERMISSIONS } from "../../../access/permissions";
import { formatDateTime } from "../../../application/format";
import { describeProblem, type Problem } from "../../../application/problems";
import { useResource } from "../../../application/useResource";
import { aiApi, type PreferenceSetting, type PreferenceValue } from "../../../lib/ai";
import { useTranslation } from "../../../translations/TranslationProvider";
import { ConfirmDialog, EmptyState, Notice, ProblemState, Waiting, useToaster } from "../../../ui/components";
import { Badge, Button, Dialog, Field, Input, TextArea } from "../../../ui/primitives";
import { FORM, LIST, LIST_HEAD, LIST_ITEM, LIST_TITLE, PANEL, ROW_ACTIONS, VALUES, VALUE_CARD, VALUE_TEXT } from "./aiClasses";

type Editing =
  | { open: false }
  | { open: true; setting: PreferenceSetting; value: PreferenceValue | null };

/**
 * The texts the AI layer is steered by — instructions, refusals, framing. Each setting keeps every
 * variant somebody wrote; exactly one is in force, and a shipped text can always be restored.
 */
export function PromptsPanel() {
  const { notify } = useToaster();
  const { t } = useTranslation();
  const mayWrite = usePermissions().may(PERMISSIONS.systemWrite);
  const settings = useResource(() => aiApi.preferences(), []);
  const [editing, setEditing] = useState<Editing>({ open: false });
  const [discarding, setDiscarding] = useState<PreferenceValue | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (settings.status === "loading") {
    return <Waiting label={t("administration.ai.prompts.loading", "Loading prompts")} lines={4} />;
  }
  if (settings.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={settings.problem}
        actions={
          <Button icon="refresh" onClick={settings.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }
  if (settings.data.length === 0) {
    return (
      <EmptyState
        title={t("administration.ai.prompts.empty", "No prompts declared")}
        description={t(
          "administration.ai.prompts.emptyDescription",
          "Nothing in this installation declares an editable text yet. Settings appear here as the answer and assistant features declare them.",
        )}
      />
    );
  }

  const act = async (value: PreferenceValue, action: () => Promise<unknown>, done: string) => {
    setBusyId(value.id);
    try {
      await action();
      notify({ tone: "good", title: done });
      settings.reload();
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
        {settings.data.map((setting) => (
          <li key={setting.name} className={LIST_ITEM}>
            <div className={LIST_HEAD}>
              <div className={LIST_TITLE}>
                <strong>{setting.title}</strong>
                <span className="text-xs text-secondary">{setting.description}</span>
                <span className="numeric text-xs text-muted">{setting.name}</span>
              </div>
              {mayWrite && (
                <Button
                  variant="quiet"
                  icon="plus"
                  onClick={() => {
                    setEditing({ open: true, setting, value: null });
                  }}
                >
                  {t("administration.ai.prompts.newVariant", "New variant")}
                </Button>
              )}
            </div>
            <ul className={VALUES}>
              {setting.values.map((value) => (
                <li key={value.id} className={VALUE_CARD} data-in-force={value.inForce}>
                  <div className={LIST_TITLE}>
                    <span>
                      <strong>{value.label}</strong>{" "}
                      {value.inForce && <Badge tone="good">{t("administration.ai.prompts.inForce", "In force")}</Badge>}{" "}
                      {value.shippedKey !== null && (
                        <Badge tone="neutral">
                          {value.asShipped
                            ? t("administration.ai.prompts.asShipped", "As shipped")
                            : t("administration.ai.prompts.editedFromShipped", "Edited from shipped")}
                        </Badge>
                      )}
                    </span>
                    <span className="text-xs text-muted">
                      {t("administration.ai.prompts.changedAt", "Changed {date}", { date: formatDateTime(value.changedAt) })}
                    </span>
                  </div>
                  {mayWrite && (
                    <div className={ROW_ACTIONS}>
                      {!value.inForce && (
                        <Button
                          variant="quiet"
                          icon="play"
                          disabled={busyId === value.id}
                          onClick={() =>
                            void act(
                              value,
                              () => aiApi.putPreferenceInForce(value.id),
                              t("administration.ai.prompts.inForceNotice", "{label} is in force", { label: value.label }),
                            )
                          }
                        >
                          {t("administration.ai.prompts.putInForce", "Put in force")}
                        </Button>
                      )}
                      {value.shippedKey !== null && !value.asShipped && (
                        <Button
                          variant="quiet"
                          icon="refresh"
                          disabled={busyId === value.id}
                          onClick={() =>
                            void act(
                              value,
                              () => aiApi.restoreShippedPreference(value.id),
                              t("administration.ai.prompts.restoredNotice", "{label} restored", { label: value.label }),
                            )
                          }
                        >
                          {t("administration.ai.prompts.restoreShipped", "Restore shipped")}
                        </Button>
                      )}
                      <Button
                        variant="quiet"
                        iconOnly
                        icon="edit"
                        aria-label={t("administration.ai.prompts.editNamed", "Edit {label}", { label: value.label })}
                        title={t("administration.ai.prompts.edit", "Edit")}
                        onClick={() => {
                          setEditing({ open: true, setting, value });
                        }}
                      />
                      {!value.inForce && (
                        <Button
                          variant="quiet"
                          iconOnly
                          icon="trash"
                          aria-label={t("administration.ai.prompts.discardNamed", "Discard {label}", { label: value.label })}
                          title={t("administration.ai.prompts.discard", "Discard")}
                          onClick={() => {
                            setDiscarding(value);
                          }}
                        />
                      )}
                    </div>
                  )}
                  <pre className={VALUE_TEXT}>{value.value}</pre>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <PromptValueDialog
        editing={editing}
        onClose={() => {
          setEditing({ open: false });
        }}
        onSaved={(saved) => {
          setEditing({ open: false });
          notify({ tone: "good", title: t("administration.ai.prompts.savedNotice", "{label} saved", { label: saved.label }) });
          settings.reload();
        }}
      />
      <ConfirmDialog
        open={discarding !== null}
        title={t("administration.ai.prompts.discardVariant", "Discard variant")}
        confirmLabel={t("administration.ai.prompts.discard", "Discard")}
        destructive
        onConfirm={() => {
          if (discarding !== null) {
            const target = discarding;
            setDiscarding(null);
            void act(
              target,
              () => aiApi.discardPreferenceValue(target.id),
              t("administration.ai.prompts.discardedNotice", "{label} discarded", { label: target.label }),
            );
          }
        }}
        onCancel={() => {
          setDiscarding(null);
        }}
      >
        <p>
          {t(
            "administration.ai.prompts.discardDescription",
            "The variant {label} is deleted. The one in force is not affected.",
            { label: <strong>{discarding?.label}</strong> },
          )}
        </p>
      </ConfirmDialog>
    </div>
  );
}

const LABEL_LIMIT = 120;

function PromptValueDialog({
  editing,
  onClose,
  onSaved,
}: {
  editing: Editing;
  onClose: () => void;
  onSaved: (saved: PreferenceValue) => void;
}) {
  const { t } = useTranslation();
  const open = editing.open;
  const value = editing.open ? editing.value : null;
  const setting = editing.open ? editing.setting : null;
  const [label, setLabel] = useState("");
  const [text, setText] = useState("");
  const [labelError, setLabelError] = useState<string | undefined>(undefined);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [saving, setSaving] = useState(false);
  const [openedFor, setOpenedFor] = useState<string | null>(null);

  // Every opening starts from the variant being edited — or, for a new one, from the text in force.
  const openingKey = open ? `${setting?.name ?? ""}:${value?.id ?? "new"}` : null;
  if (openingKey !== openedFor) {
    setOpenedFor(openingKey);
    if (open && setting !== null) {
      const basis = value ?? setting.values.find((candidate) => candidate.inForce) ?? null;
      setLabel(value?.label ?? "");
      setText(basis?.value ?? "");
      setLabelError(undefined);
      setProblem(null);
      setSaving(false);
    }
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (setting === null) {
      return;
    }
    if (label.trim().length === 0) {
      setLabelError(t("administration.ai.prompts.labelRequired", "Name the variant so it can be told apart."));
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      onSaved(
        value === null
          ? await aiApi.addPreferenceValue(setting.name, label.trim(), text)
          : await aiApi.changePreferenceValue(value.id, label.trim(), text),
      );
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
        value === null
          ? t("administration.ai.prompts.newVariantOf", "New variant of {title}", {
              title: setting?.title ?? t("administration.ai.prompts.thePrompt", "the prompt"),
            })
          : t("administration.ai.prompts.editNamed", "Edit {label}", { label: value.label })
      }
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={saving}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="submit" form="prompt-form" variant="primary" disabled={saving}>
            {saving ? t("common.saving", "Saving…") : t("common.save", "Save")}
          </Button>
        </>
      }
    >
      <form id="prompt-form" className={FORM} onSubmit={(event) => void save(event)} noValidate>
        {problem !== null && (
          <Notice tone="error" title={problem.title}>
            {problem.detail ?? problem.description}
          </Notice>
        )}
        <Field label={t("administration.ai.prompts.label", "Label")} required error={labelError}>
          <Input
            value={label}
            maxLength={LABEL_LIMIT}
            fullWidth
            autoFocus
            onChange={(event) => {
              setLabel(event.target.value);
            }}
          />
        </Field>
        <Field
          label={t("administration.ai.prompts.text", "Text")}
          hint={
            value === null
              ? t(
                  "administration.ai.prompts.textHint",
                  "Starts from the text in force. A new variant stays idle until it is put in force.",
                )
              : undefined
          }
        >
          <TextArea
            rows={setting?.multiline === false ? 3 : 14}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
            }}
          />
        </Field>
      </form>
    </Dialog>
  );
}
