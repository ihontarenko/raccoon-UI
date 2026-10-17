import { useEffect, useState } from "react";
import { describeProblem, type Problem } from "../../application/problems";
import { api } from "../../lib/api";
import type { SourceRemoval, SourceView } from "../../lib/contracts";
import { translate, translatePlural } from "../../translations/translate";
import { useTranslation } from "../../translations/TranslationProvider";
import { Notice } from "../../ui/components";
import { Button, Dialog, Field, Input } from "../../ui/primitives";
import { DIALOG_BODY } from "./sourcePageClasses";

interface RemoveSourceDialogProperties {
  open: boolean;
  workspaceId: string;
  source: SourceView;
  onClose: () => void;
  onRemoved: (removal: SourceRemoval) => void;
}

/**
 * Removing a source cannot be undone, so it is the one action here that asks for the name typed back:
 * a click is not enough to take a whole source and every document in it out of the corpus.
 */
export function RemoveSourceDialog({
  open,
  workspaceId,
  source,
  onClose,
  onRemoved,
}: RemoveSourceDialogProperties) {
  const { t } = useTranslation();
  const [typedName, setTypedName] = useState("");
  const [removing, setRemoving] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  useEffect(() => {
    if (open) {
      setTypedName("");
      setProblem(null);
      setRemoving(false);
    }
  }, [open]);

  const confirmed = typedName.trim() === source.name;

  const remove = async () => {
    setRemoving(true);
    setProblem(null);
    try {
      onRemoved(await api.removeSource(workspaceId, source));
    } catch (error) {
      setProblem(describeProblem(error));
      setRemoving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("sources.removal.title", "Remove {name}", { name: source.name })}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={removing}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            variant="danger"
            icon="trash"
            disabled={!confirmed || removing}
            onClick={() => void remove()}
          >
            {removing ? t("sources.removal.removing", "Removing…") : t("sources.removal.confirm", "Remove source")}
          </Button>
        </>
      }
    >
      <div className={DIALOG_BODY}>
        {problem !== null && (
          <Notice tone="error" title={problem.title}>
            {problem.detail ?? problem.description}
          </Notice>
        )}
        <Notice tone="warn" title={t("sources.removal.irreversible", "This cannot be undone")}>
          {t(
            "sources.removal.effect",
            "Every document in it leaves the corpus with it: search, context and answers stop finding them, and every vector generation holding them is withdrawn. Nothing captured is erased — versions and history stay — but the source cannot be scanned again, and its documents cannot be restored on their own.",
          )}
        </Notice>
        <Field label={t("sources.removal.typeToConfirm", "Type {name} to confirm", { name: source.name })}>
          <Input
            value={typedName}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setTypedName(event.target.value)}
          />
        </Field>
      </div>
    </Dialog>
  );
}

/** What the toast says once a source is gone. */
export function describeSourceRemoval(removal: SourceRemoval): string {
  if (removal.removedDocuments === 0) {
    return translate("sources.removal.heldNothing", "It held no documents.");
  }
  return translatePlural("sources.removal.documentsLeft", removal.removedDocuments, {
    one: "{count} document left the corpus with it.",
    other: "{count} documents left the corpus with it.",
  });
}
