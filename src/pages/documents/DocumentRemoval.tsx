import { useState } from "react";
import { formatDateTime } from "../../application/format";
import { describeProblem } from "../../application/problems";
import { api } from "../../lib/api";
import type { DocumentView } from "../../lib/contracts";
import { useTranslation } from "../../translations/TranslationProvider";
import { ConfirmDialog, Notice, useToaster } from "../../ui/components";
import { Button } from "../../ui/primitives";

interface DocumentRemovalProperties {
  workspaceId: string;
  document: DocumentView;
  onChanged: () => void;
}

/**
 * Takes the document out of the corpus. What it costs is said before it happens: search, context and
 * answers stop finding it at once, every vector generation holding it is withdrawn, and scans skip its
 * file — while its versions and history stay, so it can be restored.
 */
export function RemoveDocumentButton({
  workspaceId,
  document,
  onChanged,
}: DocumentRemovalProperties) {
  const { notify } = useToaster();
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);

  const remove = async () => {
    setRemoving(true);
    try {
      await api.removeDocument(workspaceId, document);
      notify({
        tone: "good",
        title: t("documents.removal.removedNotice", "Document removed"),
        description: t("documents.removal.removedDescription", "Search no longer finds it. It can be restored from this page."),
      });
      onChanged();
    } catch (error) {
      const problem = describeProblem(error);
      notify({
        tone: "error",
        title: problem.title,
        description: problem.detail ?? problem.description,
      });
    } finally {
      setRemoving(false);
      setConfirming(false);
    }
  };

  return (
    <>
      <Button variant="danger" icon="trash" disabled={removing} onClick={() => setConfirming(true)}>
        {t("documents.removal.remove", "Remove")}
      </Button>
      <ConfirmDialog
        open={confirming}
        title={t("documents.removal.confirmTitle", "Remove “{title}”", { title: document.title })}
        confirmLabel={
          removing ? t("documents.removal.removing", "Removing…") : t("documents.removal.confirm", "Remove document")
        }
        destructive
        onConfirm={() => void remove()}
        onCancel={() => setConfirming(false)}
      >
        <p>
          {t(
            "documents.removal.effectSearch",
            "Search, context and answers stop finding it immediately, and it leaves every list.",
          )}
        </p>
        <p>
          {t(
            "documents.removal.effectVectors",
            "Every vector generation that holds it is withdrawn; vectorise the rest again afterwards.",
          )}
        </p>
        <p>
          {t(
            "documents.removal.effectScans",
            "Scans skip its file from now on. Its versions and history are kept, so it can be restored here.",
          )}
        </p>
      </ConfirmDialog>
    </>
  );
}

/** Shown in place of the pipeline's actions on a removed document: when, and the one way back. */
export function RemovedDocumentNotice({
  workspaceId,
  document,
  mayRestore,
  onChanged,
}: DocumentRemovalProperties & { mayRestore: boolean }) {
  const { notify } = useToaster();
  const { t } = useTranslation();
  const [restoring, setRestoring] = useState(false);

  const restore = async () => {
    setRestoring(true);
    try {
      await api.restoreDocument(workspaceId, document.id);
      notify({
        tone: "good",
        title: t("documents.removal.restoredNotice", "Document restored"),
        description: t("documents.removal.restoredDescription", "Process or publish it again to make it searchable."),
      });
      onChanged();
    } catch (error) {
      const problem = describeProblem(error);
      notify({
        tone: "error",
        title: problem.title,
        description: problem.detail ?? problem.description,
      });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Notice
      tone="warn"
      title={t("documents.removal.removedAt", "Removed {time}", {
        time: document.removedAt === null ? "" : formatDateTime(document.removedAt),
      })}
      action={
        mayRestore ? (
          <Button icon="refresh" disabled={restoring} onClick={() => void restore()}>
            {restoring ? t("documents.removal.restoring", "Restoring…") : t("documents.removal.restore", "Restore")}
          </Button>
        ) : undefined
      }
    >
      {t(
        "documents.removal.outOfCorpus",
        "This document is out of the corpus: nothing searches it and nothing can process, publish or vectorise it. Restoring brings it back as it was, unpublished.",
      )}
    </Notice>
  );
}
