import { useEffect, useState, type FormEvent } from "react";
import { describeProblem, type Problem } from "../../../application/problems";
import { formatBytes } from "../../../application/format";
import { api, collectAllPages } from "../../../lib/api";
import type { DocumentView, SourceView, UploadOutcome } from "../../../lib/contracts";
import { pipelineApi } from "../../../lib/pipeline";
import { translate } from "../../../translations/translate";
import { useTranslation } from "../../../translations/TranslationProvider";
import { EmptyState, Notice, Segmented, Waiting } from "../../../ui/components";
import { Button, Dialog, Field, Input, Select, TextArea } from "../../../ui/primitives";

const PATH_LIMIT = 1024;
const TITLE_LIMIT = 160;
const TEXT_LIMIT = 1048576;

/** The two ways a document is put into Raccoon by hand: typed here, or uploaded as a file. */
type CaptureWay = "text" | "file";

/** What the writer needs of a document already in a source: the path it holds and the revision to write over. */
export interface KnownDocument {
  externalId: string;
  revision: number;
}

interface CaptureDocumentDialogProperties {
  /** Open when given: a new document (`null`) or a new version of one. */
  editing: { document: DocumentView | null } | null;
  workspaceId: string;
  /** Sources that take typed text — the written-text kind. The first is the one offered. */
  textSources: SourceView[];
  /** Sources that take uploaded files — the uploaded-files kind. The first is the one offered. */
  fileSources: SourceView[];
  /**
   * The documents already known to be in a source, so a path that exists is saved as its next version. A path held
   * by a document on a page not loaded yet is refused by the server's revision check rather than overwritten.
   */
  knownDocuments: (sourceId: string) => KnownDocument[];
  onClose: () => void;
  /** A text document was captured; `unchanged` when the text was identical to the current version. */
  onSaved: (title: string, unchanged: boolean) => void;
  /** Files were sent; each outcome carries its version or the reason it was refused. */
  onUploaded: (outcomes: UploadOutcome[]) => void;
}

/** Reads a version's whole text through the first available read profile, one bounded slice at a time. */
async function readWholeText(workspaceId: string, document: DocumentView): Promise<string | null> {
  const [profile] = await collectAllPages((page) => pipelineApi.availableReadProfiles(workspaceId, page));
  if (profile === undefined) {
    return null;
  }
  let text = "";
  let offset: number | null = 0;
  while (offset !== null) {
    const slice: Awaited<ReturnType<typeof pipelineApi.readOriginal>> = await pipelineApi.readOriginal(workspaceId, document.id, document.latestVersionId, profile.id, offset);
    text += slice.text;
    offset = slice.nextOffset;
  }
  return text;
}

/**
 * Puts one document into a source by hand — the same dialog whichever way it arrives.
 *
 * The way it arrives is the first choice, because it decides everything after it: typed text lives in a written-text
 * source and is identified by a path inside it; a file is uploaded into an uploaded-files source and keeps its own
 * name. So the two are one action with two forms rather than two features, and each way offers only the sources that
 * can take it.
 *
 * Editing an existing document is always the typed form: its source and its path are already decided, and only its
 * text is written again, as that document's next version.
 */
export function CaptureDocumentDialog({
  editing,
  workspaceId,
  textSources,
  fileSources,
  knownDocuments,
  onClose,
  onSaved,
  onUploaded,
}: CaptureDocumentDialogProperties) {
  const { t, plural } = useTranslation();
  const [way, setWay] = useState<CaptureWay>("text");
  const [textSourceId, setTextSourceId] = useState("");
  const [fileSourceId, setFileSourceId] = useState("");
  const [path, setPath] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [folder, setFolder] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [saving, setSaving] = useState(false);
  const document = editing?.document ?? null;

  const offeredSources = way === "text" ? textSources : fileSources;
  const nowhereToPut = document === null && offeredSources.length === 0;

  useEffect(() => {
    if (editing === null) {
      return;
    }
    setProblem(null);
    setSaving(false);
    setWay(document !== null || textSources.length > 0 || fileSources.length === 0 ? "text" : "file");
    setTextSourceId(document?.sourceId ?? textSources[0]?.id ?? "");
    setFileSourceId(fileSources[0]?.id ?? "");
    setPath(document?.externalId ?? "");
    setTitle(document?.title ?? "");
    setText("");
    setFolder("");
    setFiles([]);
    if (document === null) {
      return;
    }
    let current = true;
    setLoading(true);
    readWholeText(workspaceId, document)
      .then((whole) => {
        if (current) {
          if (whole === null) {
            setProblem({
              kind: "invalid",
              title: translate("sources.documents.noReadProfile", "No read profile"),
              description: translate(
                "sources.documents.noReadProfileDescription",
                "Create a read profile to load the current text; you can still replace it with new text.",
              ),
              detail: null,
              status: null,
            });
          } else {
            setText(whole);
          }
        }
      })
      .catch((error: unknown) => {
        if (current) {
          setProblem(describeProblem(error));
        }
      })
      .finally(() => {
        if (current) {
          setLoading(false);
        }
      });
    return () => {
      current = false;
    };
    // The source lists are the choice on offer, not part of what is being written; a list that reloads must not
    // throw away what has been typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, document, workspaceId]);

  const refuse = (refusalTitle: string, description: string) => {
    setProblem({ kind: "invalid", title: refusalTitle, description, detail: null, status: null });
  };

  const saveText = async () => {
    if (path.trim().length === 0 || title.trim().length === 0 || text.trim().length === 0) {
      refuse(
        t("sources.documents.allNeeded", "Path, title and text are all needed"),
        t("sources.documents.allNeededDescription", "The path names the document inside the source."),
      );
      return;
    }
    setSaving(true);
    setProblem(null);
    const target =
      document !== null && document.externalId === path.trim()
        ? document
        : knownDocuments(textSourceId).find((candidate) => candidate.externalId === path.trim());
    const revision = target?.revision ?? 0;
    try {
      const version = await api.captureText(workspaceId, textSourceId, {
        externalId: path.trim(),
        title: title.trim(),
        text,
        revision,
      });
      onSaved(title.trim(), target !== undefined && version.versionNumber === revision);
    } catch (error) {
      setProblem(describeProblem(error));
      setSaving(false);
    }
  };

  const uploadFiles = async () => {
    if (files.length === 0) {
      refuse(
        t("sources.documents.filesNeeded", "No file chosen"),
        t("sources.documents.filesNeededDescription", "Choose at least one file to upload into the source."),
      );
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      onUploaded(await api.uploadToManagedFolder(workspaceId, fileSourceId, files, folder.trim()));
    } catch (error) {
      setProblem(describeProblem(error));
      setSaving(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (way === "text" ? saveText() : uploadFiles());
  };

  const sourceField = (value: string, onChange: (identifier: string) => void) => (
    <Field label={t("sources.documents.source", "Source")} required>
      <Select value={value} fullWidth onChange={(event) => onChange(event.target.value)}>
        {offeredSources.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.name}
          </option>
        ))}
      </Select>
    </Field>
  );

  return (
    <Dialog
      open={editing !== null}
      onClose={onClose}
      title={
        document === null
          ? t("sources.documents.add", "Add a document")
          : t("sources.documents.edit", "Edit {title}", { title: document.title })
      }
      size="wide"
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={saving}>
            {nowhereToPut ? t("common.close", "Close") : t("common.cancel", "Cancel")}
          </Button>
          {!nowhereToPut && (
            <Button type="submit" form="capture-document-form" variant="primary" disabled={saving || loading}>
              {saving
                ? t("common.saving", "Saving…")
                : way === "file"
                  ? t("sources.documents.upload", "Upload")
                  : document === null
                    ? t("sources.documents.save", "Save document")
                    : t("sources.documents.saveVersion", "Save new version")}
            </Button>
          )}
        </>
      }
    >
      <form id="capture-document-form" className="grid gap-4" onSubmit={submit} noValidate>
        {document === null && (
          <Segmented<CaptureWay>
            label={t("sources.documents.way", "How it arrives")}
            value={way}
            onChange={setWay}
            options={[
              {
                value: "text",
                label: t("sources.documents.wayText", "Write text"),
                disabled: textSources.length === 0 && fileSources.length > 0,
                title:
                  textSources.length === 0
                    ? t("sources.documents.noTextSource", "No written-text source in this workspace yet")
                    : undefined,
              },
              {
                value: "file",
                label: t("sources.documents.wayFile", "Upload a file"),
                disabled: fileSources.length === 0 && textSources.length > 0,
                title:
                  fileSources.length === 0
                    ? t("sources.documents.noFileSource", "No uploaded-files source in this workspace yet")
                    : undefined,
              },
            ]}
          />
        )}
        {problem !== null && (
          <Notice tone={problem.kind === "invalid" ? "warn" : "error"} title={problem.title}>
            {problem.detail ?? problem.description}
          </Notice>
        )}
        {nowhereToPut ? (
          <EmptyState
            title={
              way === "text"
                ? t("sources.documents.noTextSource", "No written-text source in this workspace yet")
                : t("sources.documents.noFileSource", "No uploaded-files source in this workspace yet")
            }
            description={
              way === "text"
                ? t(
                    "sources.documents.noTextSourceDescription",
                    "Text typed by hand lives in a source of the written-text kind. Make one, and this is where its notes are written.",
                  )
                : t(
                    "sources.documents.noFileSourceDescription",
                    "An uploaded file lives in a folder Raccoon keeps itself — a source of the uploaded-files kind. Make one, and files land in it.",
                  )
            }
            action={
              <Button variant="primary" icon="plus" href="/sources/new">
                {t("sources.documents.createSource", "Create a source")}
              </Button>
            }
          />
        ) : way === "file" ? (
          <>
            {sourceField(fileSourceId, setFileSourceId)}
            <Field
              label={t("sources.documents.folder", "Folder")}
              hint={t("sources.documents.folderHint", "Inside the source; empty puts the files at its root.")}
            >
              <Input className="numeric" value={folder} maxLength={PATH_LIMIT} fullWidth onChange={(event) => setFolder(event.target.value)} />
            </Field>
            <Field
              label={t("sources.documents.files", "Files")}
              required
              hint={t(
                "sources.documents.filesHint",
                "Text, Markdown, PDF, PNG, JPEG or TIFF. Anything else is refused before it is stored.",
              )}
            >
              <input type="file" multiple className="w-full max-w-full text-xs" onChange={(event) => setFiles([...(event.target.files ?? [])])} />
            </Field>
            {files.length > 0 && (
              <>
                <ul className="m-0 grid list-none gap-[calc(2px*var(--ui-scale))] p-0 text-xs">
                  {files.map((file) => (
                    <li key={file.name}>
                      <span className="numeric">{file.name}</span>{" "}
                      <span className="text-xs text-muted numeric">{formatBytes(file.size)}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-secondary">
                  {plural("sources.documents.chosenCount", files.length, {
                    one: "{count} file ready to upload",
                    other: "{count} files ready to upload",
                  })}
                </p>
              </>
            )}
          </>
        ) : (
          <>
            {document === null && offeredSources.length > 1 && sourceField(textSourceId, setTextSourceId)}
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 max-[700px]:grid-cols-[minmax(0,1fr)]">
              <Field
                label={t("sources.documents.path", "Path")}
                required
                hint={
                  document === null
                    ? t("sources.documents.pathHint", "Its identity in the source, for example {example}.", { example: "notes/onboarding.md" })
                    : t("sources.documents.pathFixed", "Fixed: a new path would be a new document.")
                }
              >
                <Input className="numeric" value={path} maxLength={PATH_LIMIT} disabled={document !== null} fullWidth onChange={(event) => setPath(event.target.value)} />
              </Field>
              <Field label={t("sources.documents.title", "Title")} required>
                <Input value={title} maxLength={TITLE_LIMIT} fullWidth onChange={(event) => setTitle(event.target.value)} />
              </Field>
            </div>
            {loading ? (
              <Waiting label={t("sources.documents.loadingText", "Loading the current text")} lines={6} />
            ) : (
              <Field label={t("sources.documents.text", "Text")} required hint={t("sources.documents.textHint", "Plain text or Markdown.")}>
                <TextArea rows={18} maxLength={TEXT_LIMIT} value={text} onChange={(event) => setText(event.target.value)} />
              </Field>
            )}
          </>
        )}
      </form>
    </Dialog>
  );
}
