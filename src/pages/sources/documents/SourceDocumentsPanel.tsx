import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { usePermissions } from "../../../access/PermissionsProvider";
import { PERMISSIONS } from "../../../access/permissions";
import { usePagedList } from "../../../application/usePagedList";
import { api } from "../../../lib/api";
import type { DocumentView, SourceView } from "../../../lib/contracts";
import { useTranslation } from "../../../translations/TranslationProvider";
import { EmptyState, ListFooter, ProblemState, Waiting, useToaster } from "../../../ui/components";
import { Button, Table } from "../../../ui/primitives";
import { CaptureDocumentDialog } from "./CaptureDocumentDialog";

/**
 * The documents one source holds. A source whose documents arrive through Raccoon — written text, uploaded files —
 * is filled here by hand: each save is a new version, prepared and indexed exactly like a file a scan captured.
 */
export function SourceDocumentsPanel({
  workspaceId,
  source,
  writeRequests = 0,
}: {
  workspaceId: string;
  source: SourceView;
  /** Counts the times the page outside this panel asked for the writer; each new count opens it. */
  writeRequests?: number;
}) {
  const { t, plural } = useTranslation();
  const { notify } = useToaster();
  // Which way a document may arrive here is the source's kind: one of the two is offered, never both.
  const takesText = source.kind === "CUSTOM_TEXT";
  const takesFiles = source.kind === "MANAGED_FOLDER";
  const mayWrite = usePermissions().may(PERMISSIONS.documentWrite) && (takesText || takesFiles) && source.enabled;
  const documents = usePagedList((page) => api.listDocumentsOfSource(workspaceId, source.id, page), [workspaceId, source.id]);
  const [editing, setEditing] = useState<{ document: DocumentView | null } | null>(null);

  useEffect(() => {
    if (writeRequests > 0 && mayWrite) {
      setEditing({ document: null });
    }
  }, [writeRequests, mayWrite]);

  if (documents.status === "loading") {
    return <Waiting label={t("sources.documents.loading", "Loading documents")} lines={4} />;
  }
  if (documents.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={documents.problem}
        actions={
          <Button icon="refresh" onClick={documents.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-secondary">
          {source.kind === "CUSTOM_TEXT"
            ? t("sources.documents.writtenLead", "Text written here becomes a document like any other: versioned, prepared, searchable.")
            : t("sources.documents.capturedLead", "Documents this source captured. Open one to see its chunks, index and vectors.")}
        </span>
        {mayWrite && (
          <Button variant="primary" icon="plus" onClick={() => setEditing({ document: null })}>
            {t("sources.documents.add", "Add a document")}
          </Button>
        )}
      </div>
      {documents.items.length === 0 ? (
        <EmptyState
          title={t("sources.documents.empty", "No documents yet")}
          description={
            source.kind === "CUSTOM_TEXT"
              ? t("sources.documents.emptyWritten", "Write the first one — a note, a definition, an answer worth keeping.")
              : t("sources.documents.emptyScanned", "Scan the source to capture its documents.")
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-surface border border-line bg-surface">
          <Table>
            <thead>
              <tr>
                <th scope="col">{t("sources.documents.document", "Document")}</th>
                <th scope="col" className="numeric">
                  {t("sources.documents.versions", "Versions")}
                </th>
                <th scope="col">
                  <span className="sr-only">{t("common.actions", "Actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {documents.items.map((document) => (
                <tr key={document.id}>
                  <td>
                    <Link to="/documents/$documentId" params={{ documentId: document.id }} className="font-semibold text-ink no-underline hover:text-accent-text hover:underline">
                      {document.title}
                    </Link>
                    <div className="numeric text-xs text-muted">{document.externalId}</div>
                  </td>
                  <td className="numeric">{document.revision}</td>
                  <td className="actions">
                    {mayWrite && (
                      <Button variant="quiet" icon="edit" onClick={() => setEditing({ document })}>
                        {t("sources.documents.editText", "Edit text")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <ListFooter
            shown={documents.items.length}
            counted={plural("sources.documents.count", documents.items.length, { one: "{count} document", other: "{count} documents" })}
            hasMore={documents.hasMore}
            loadingMore={documents.loadingMore}
            moreProblem={documents.moreProblem}
            onLoadMore={documents.loadMore}
          />
        </div>
      )}
      <CaptureDocumentDialog
        editing={editing}
        workspaceId={workspaceId}
        textSources={takesText ? [source] : []}
        fileSources={takesFiles ? [source] : []}
        knownDocuments={() => documents.items}
        onClose={() => setEditing(null)}
        onUploaded={(outcomes) => {
          setEditing(null);
          const refused = outcomes.filter((outcome) => outcome.version === null);
          notify({
            tone: refused.length === 0 ? "good" : "error",
            title:
              refused.length === outcomes.length
                ? t("sources.documents.nothingUploaded", "Nothing uploaded")
                : plural("sources.documents.uploaded", outcomes.length - refused.length, {
                    one: "{count} file uploaded",
                    other: "{count} files uploaded",
                  }),
            description: refused.length === 0 ? undefined : refused.map((outcome) => outcome.fileName + ": " + outcome.refusal).join(" · "),
          });
          documents.reload();
        }}
        onSaved={(title, unchanged) => {
          setEditing(null);
          notify(
            unchanged
              ? {
                  tone: "neutral",
                  title: t("sources.documents.nothingChanged", "Nothing changed"),
                  description: t("sources.documents.identical", "The text is identical to the current version."),
                }
              : {
                  tone: "good",
                  title: t("sources.savedToast", "{name} saved", { name: title }),
                  description: t("sources.documents.newVersion", "A new version was captured."),
                },
          );
          documents.reload();
        }}
      />
    </div>
  );
}
