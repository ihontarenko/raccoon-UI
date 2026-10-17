import { useEffect, useState, type FormEvent } from "react";
import { describeProblem, type Problem } from "../../application/problems";
import { pipelineApi, type IndexEntry, type ManualEntry } from "../../lib/pipeline";
import { useTranslation } from "../../translations/TranslationProvider";
import { Notice } from "../../ui/components";
import { Button, Dialog, Field, Input, Select, TextArea } from "../../ui/primitives";
import { DIALOG_BODY } from "./indexingClasses";

/**
 * What the dialog does to the index:
 * - `create` adds a manual entry nobody's document produced;
 * - `edit` changes a manual or override entry in place;
 * - `replace` hides a derived chunk behind an override the person wrote.
 */
export type EntryEditing =
  | { mode: "create" }
  | { mode: "edit"; entry: IndexEntry }
  | { mode: "replace"; entry: IndexEntry };

interface EntryDialogProperties {
  editing: EntryEditing | null;
  workspaceId: string;
  onClose: () => void;
  onSaved: (entry: IndexEntry) => void;
}

const TITLE_LIMIT = 160;

export function EntryDialog({ editing, workspaceId, onClose, onSaved }: EntryDialogProperties) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [analyzer, setAnalyzer] = useState<ManualEntry["analyzer"]>("simple");
  const [errors, setErrors] = useState<{ title?: string; text?: string }>({});
  const [problem, setProblem] = useState<Problem | null>(null);
  const [saving, setSaving] = useState(false);

  const titles: Record<EntryEditing["mode"], string> = {
    create: t("index.entryDialog.create", "New index entry"),
    edit: t("index.entryDialog.edit", "Edit index entry"),
    replace: t("index.entryDialog.replace", "Replace a derived chunk"),
  };

  useEffect(() => {
    if (editing === null) {
      return;
    }
    const source = editing.mode === "create" ? null : editing.entry;
    setTitle(source?.title ?? "");
    setText(source?.text ?? "");
    setAnalyzer(source?.analyzer === "english" ? "english" : "simple");
    setErrors({});
    setProblem(null);
    setSaving(false);
  }, [editing]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editing === null) {
      return;
    }
    const nextErrors: typeof errors = {};
    if (title.trim().length === 0) {
      nextErrors.title = t("index.entryDialog.titleError", "Give the entry a title.");
    }
    if (text.trim().length === 0) {
      nextErrors.text = t("index.entryDialog.textError", "An entry needs text to be found by.");
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      const body = (revision: number): ManualEntry => ({ title: title.trim(), text, analyzer, revision });
      const saved =
        editing.mode === "create"
          ? await pipelineApi.createEntry(workspaceId, body(0))
          : editing.mode === "edit"
            ? await pipelineApi.changeEntry(workspaceId, editing.entry.id, body(editing.entry.revision))
            : await pipelineApi.replaceEntry(workspaceId, editing.entry.id, body(editing.entry.revision));
      onSaved(saved);
    } catch (error) {
      setProblem(describeProblem(error));
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={editing !== null}
      onClose={onClose}
      title={editing === null ? "" : titles[editing.mode]}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={saving}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="submit" form="entry-form" variant="primary" disabled={saving}>
            {saving
              ? t("common.saving", "Saving…")
              : editing?.mode === "replace"
                ? t("index.entryDialog.replaceChunk", "Replace chunk")
                : t("index.entryDialog.save", "Save entry")}
          </Button>
        </>
      }
    >
      <form id="entry-form" className={DIALOG_BODY} onSubmit={(event) => void save(event)} noValidate>
        {editing?.mode === "replace" && (
          <Notice tone="information" title={t("index.entryDialog.hiddenTitle", "The derived chunk stays, hidden")}>
            {t(
              "index.entryDialog.hiddenDescription",
              "Search uses your text instead. Vectors built from this chunk are withdrawn until the document is vectorised again.",
            )}
          </Notice>
        )}
        {problem !== null && (
          <Notice tone="error" title={problem.title}>
            {problem.detail ?? problem.description}
          </Notice>
        )}
        <Field label={t("index.entryDialog.title", "Title")} required error={errors.title}>
          <Input
            value={title}
            maxLength={TITLE_LIMIT}
            fullWidth
            autoFocus
            onChange={(event) => {
              setTitle(event.target.value);
            }}
          />
        </Field>
        <Field label={t("index.entryDialog.text", "Text")} required error={errors.text}>
          <TextArea
            rows={10}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
            }}
          />
        </Field>
        <Field
          label={t("index.entryDialog.analyzer", "Analyzer")}
          hint={t(
            "index.entryDialog.analyzerHint",
            "How words are reduced before matching: simple keeps them as written, english stems them.",
          )}
        >
          <Select
            value={analyzer}
            onChange={(event) => {
              setAnalyzer(event.target.value as ManualEntry["analyzer"]);
            }}
          >
            <option value="simple">simple</option>
            <option value="english">english</option>
          </Select>
        </Field>
      </form>
    </Dialog>
  );
}
