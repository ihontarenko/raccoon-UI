import { useEffect, useState, type FormEvent } from "react";
import { describeProblem, type Problem } from "../../application/problems";
import { api } from "../../lib/api";
import type { SourceView } from "../../lib/contracts";
import { useTranslation } from "../../translations/TranslationProvider";
import { Notice } from "../../ui/components";
import { Button, Dialog, Field, Input } from "../../ui/primitives";

interface SourceFormDialogProperties {
  open: boolean;
  workspaceId: string;
  /** The source being renamed. A new source is added on its own page, not here. */
  source: SourceView | null;
  onClose: () => void;
  onSaved: (source: SourceView) => void;
}

const NAME_LIMIT = 160;

export function SourceFormDialog({ open, workspaceId, source, onClose, onSaved }: SourceFormDialogProperties) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  // Every opening starts from the record being edited, never from what was typed last time.
  useEffect(() => {
    if (open) {
      setName(source?.name ?? "");
      setNameError(undefined);
      setProblem(null);
      setSaving(false);
    }
  }, [open, source]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (source === null) {
      return;
    }
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      setNameError(t("sources.form.nameRequired", "Give the source a name."));
      return;
    }
    setNameError(undefined);
    setSaving(true);
    setProblem(null);
    try {
      onSaved(
        await api.changeSource(workspaceId, source.id, {
          name: trimmedName,
          enabled: source.enabled,
          revision: source.revision,
        }),
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
      title={t("sources.form.title", "Rename source")}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={saving}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="submit" form="source-form" variant="primary" disabled={saving}>
            {saving ? t("common.saving", "Saving…") : t("common.save", "Save")}
          </Button>
        </>
      }
    >
      <form id="source-form" className="grid gap-4" onSubmit={(event) => void handleSubmit(event)} noValidate>
        {problem !== null && (
          <Notice tone="error" title={problem.title}>
            {problem.detail ?? problem.description}
          </Notice>
        )}
        <Field label={t("sources.form.name", "Name")} required error={nameError}>
          <Input
            value={name}
            maxLength={NAME_LIMIT}
            onChange={(event) => {
              setName(event.target.value);
            }}
            fullWidth
            autoFocus
          />
        </Field>
      </form>
    </Dialog>
  );
}
