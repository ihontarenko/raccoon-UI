import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { formatBytes, formatDateTime } from "../../application/format";
import { useOriginal, type LoadedOriginal } from "../../application/useOriginal";
import { downloadFile, type FileEntry } from "../../lib/files";
import { useTranslation } from "../../translations/TranslationProvider";
import { defaultReadingMode, OriginalReader, type ReaderPresentation, type ReadingMode } from "../../ui/components/reader/Reader";
import { countLines, readingFormatOf, type LineRange, type ReadingFormat } from "../../ui/components/reader/readingFormat";
import { Badge, Button } from "../../ui/primitives";
import { FileMark } from "./FileMarks";
import { CANNOT_SHOW, DETAILS, DETAILS_LINK, HASH, STAGE_MESSAGE, VIEWER, VIEWER_ACTIONS, VIEWER_BODY, VIEWER_DETAILS, VIEWER_FOOT, VIEWER_HEAD, VIEWER_STAGE, VIEWER_TITLE, VIEWER_WITH_DETAILS } from "./filesClasses";

interface FileViewerProperties {
  workspaceId: string;
  files: FileEntry[];
  file: FileEntry;
  sourceName: string | null;
  onOpen: (file: FileEntry) => void;
  onClose: () => void;
}

/**
 * One file over the whole screen: its content as what it is — a picture, a page, text, sound or a
 * recording — and its details beside it. Arrow keys step through the folder, Escape closes, I shows the
 * details. The bytes are fetched with the session's token and shown from an object URL.
 */
export function FileViewer({ workspaceId, files, file, sourceName, onOpen, onClose }: FileViewerProperties) {
  // Beside the content on a wide screen; on a phone the content comes first and I opens them.
  const { t } = useTranslation();
  const [detailsOpen, setDetailsOpen] = useState(() => window.matchMedia("(min-width: 801px)").matches);
  const [downloading, setDownloading] = useState(false);
  const actions = useRef<HTMLDivElement>(null);
  const format = readingFormatOf(file.name, file.effectiveMediaType);
  const original = useOriginal({ workspaceId, versionId: file.versionId, format, mediaType: file.effectiveMediaType, sizeBytes: file.sizeBytes });
  // A mode chosen for one file does not carry to the next: each opens the way its kind reads best.
  const [chosenMode, setChosenMode] = useState<{ versionId: string; mode: ReadingMode } | null>(null);
  const mode = chosenMode !== null && chosenMode.versionId === file.versionId ? chosenMode.mode : defaultReadingMode(format, null);
  const position = files.findIndex((candidate) => candidate.versionId === file.versionId);
  const previous = position > 0 ? files[position - 1] : undefined;
  const next = position >= 0 && position < files.length - 1 ? files[position + 1] : undefined;

  // Focus enters the viewer and returns to whatever opened it; the page behind it stays still.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    actions.current?.querySelector<HTMLButtonElement>("[data-close]")?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Keys the reader already answered — a search panel closing, a caret moving in the code — stay there.
      if (event.defaultPrevented || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (event.target instanceof HTMLElement && event.target.closest(".cm-editor") !== null && event.key !== "Escape") {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowLeft" && previous !== undefined) {
        onOpen(previous);
      } else if (event.key === "ArrowRight" && next !== undefined) {
        onOpen(next);
      } else if (event.key.toLowerCase() === "i" && !event.ctrlKey && !event.metaKey) {
        setDetailsOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previous, next, onOpen, onClose]);

  const download = async () => {
    setDownloading(true);
    try {
      await downloadFile(workspaceId, file);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={VIEWER} role="dialog" aria-modal="true" aria-labelledby="file-viewer-title">
      <header className={VIEWER_HEAD}>
        <div className={VIEWER_TITLE}>
          <h2 id="file-viewer-title">{file.name}</h2>
          <span className="numeric text-xs text-muted">
            {file.effectiveMediaType} · {formatBytes(file.sizeBytes)}
          </span>
        </div>
        <div className={VIEWER_ACTIONS} ref={actions}>
          <Button variant="quiet" icon="download" disabled={downloading} onClick={() => void download()}>
            {downloading ? t("common.saving", "Saving…") : t("documents.read.download", "Download")}
          </Button>
          <Button variant="quiet" iconOnly icon="previous" aria-label={t("files.viewer.previousFile", "Previous file")} title={t("files.viewer.previous", "Previous (←)")} disabled={previous === undefined} onClick={() => previous !== undefined && onOpen(previous)} />
          <Button variant="quiet" iconOnly icon="chevron" aria-label={t("files.viewer.nextFile", "Next file")} title={t("files.viewer.next", "Next (→)")} disabled={next === undefined} onClick={() => next !== undefined && onOpen(next)} />
          <Button variant="quiet" iconOnly icon="information" aria-label={t("files.viewer.details", "Details")} aria-pressed={detailsOpen} title={t("files.viewer.detailsKey", "Details (I)")} onClick={() => setDetailsOpen((open) => !open)} />
          <Button data-close variant="quiet" iconOnly icon="close" aria-label={t("common.close", "Close")} title={t("files.viewer.closeKey", "Close (Esc)")} onClick={onClose} />
        </div>
      </header>
      <div className={`${VIEWER_BODY} ${detailsOpen ? VIEWER_WITH_DETAILS : ""}`}>
        <div className={VIEWER_STAGE}>
          <FileStage
            file={file}
            format={format}
            original={original}
            mode={mode}
            onModeChange={(next) => setChosenMode({ versionId: file.versionId, mode: next })}
            onDownload={() => void download()}
          />
        </div>
        {detailsOpen && (
          <aside className={VIEWER_DETAILS} aria-label={t("files.viewer.fileDetails", "File details")}>
            <dl className={DETAILS}>
              <dt>{t("files.column.name", "Name")}</dt>
              <dd>{file.title}</dd>
              <dt>{t("documents.fact.path", "Path")}</dt>
              <dd className="numeric">{file.path}</dd>
              {sourceName !== null && (
                <>
                  <dt>{t("documents.source", "Source")}</dt>
                  <dd>{sourceName}</dd>
                </>
              )}
              <dt>{t("documents.fact.type", "Type")}</dt>
              <dd className="numeric">
                {file.effectiveMediaType}
                {file.effectiveMediaType !== file.mediaType && <div className="text-xs text-muted">{t("documents.recordedAs", "recorded as {type}", { type: file.mediaType })}</div>}
              </dd>
              <dt>{t("documents.fact.size", "Size")}</dt>
              <dd className="numeric">{formatBytes(file.sizeBytes)}</dd>
              <dt>{t("documents.versionLabel", "Version")}</dt>
              <dd className="numeric">{file.versionNumber}</dd>
              <dt>{t("documents.versions.captured", "Captured")}</dt>
              <dd>{formatDateTime(file.capturedAt)}</dd>
              <dt>{t("files.column.search", "Search")}</dt>
              <dd>
                {file.removedAt !== null ? (
                  <Badge tone="deny">{t("documents.removed", "Removed")}</Badge>
                ) : (
                  <Badge tone={file.published ? "allow" : "neutral"}>
                    {file.published ? t("files.searchable", "Searchable") : t("documents.journal.notPublished", "Not published")}
                  </Badge>
                )}
              </dd>
              <dt>SHA-256</dt>
              <dd className={`numeric ${HASH}`}>{file.sha256}</dd>
            </dl>
            <Link to="/documents/$documentId" params={{ documentId: file.documentId }} className={DETAILS_LINK}>
              {t("files.action.openDocument", "Open its document")}
            </Link>
          </aside>
        )}
      </div>
      <footer className={VIEWER_FOOT}>
        <span className="text-xs text-muted numeric">{t("files.viewer.position", "{position} of {total}", {
            position: position >= 0 ? position + 1 : 1,
            total: position >= 0 ? files.length : 1,
          })}</span>
      </footer>
    </div>
  );
}

interface StageProperties {
  file: FileEntry;
  format: ReadingFormat;
  original: LoadedOriginal;
  mode: ReadingMode | null;
  onModeChange: (mode: ReadingMode) => void;
  onDownload: () => void;
  /** Lines to bring into view and mark — an outline entry chosen beside the reader. */
  focus?: LineRange | null;
  /** `open` where the page around the stage is already its frame. */
  presentation?: ReaderPresentation;
}

/** A file shown as what it is — reused by the full-screen viewer and the preview beside the list. */
export function FileStage({ file, format, original, mode, onModeChange, onDownload, focus = null, presentation = "framed" }: StageProperties) {
  const { t, plural } = useTranslation();
  if (original.status === "loading") {
    return <p className={`text-xs text-muted ${STAGE_MESSAGE}`}>{t("files.reading", "Reading…")}</p>;
  }
  if (original.status === "failed") {
    return (
      <div className={CANNOT_SHOW}>
        <p>{original.problem.title}</p>
        <p className="text-xs text-muted">{original.problem.detail ?? original.problem.description}</p>
      </div>
    );
  }
  if (original.status === "ready") {
    const isJava = format.kind === "code" && format.language === "java";
    return (
      <OriginalReader
        name={file.name}
        format={format}
        content={original.content}
        mode={mode}
        onModeChange={onModeChange}
        focus={focus}
        page={null}
        fill
        presentation={presentation}
        facts={
          <>
            <span>{format.description}</span>
            {original.content.form === "text" && (
              <span className="numeric">
                {plural("documents.read.lines", countLines(original.content.text), { one: "{count} line", other: "{count} lines" })}
              </span>
            )}
          </>
        }
        actions={
          isJava ? (
            <Link
              to="/documents/$documentId"
              params={{ documentId: file.documentId }}
              search={{ version: file.versionId, view: "documentation" }}
              className={DETAILS_LINK}
            >
              {t("files.viewer.readAsDocumentation", "Read as documentation")}
            </Link>
          ) : undefined
        }
      />
    );
  }
  return (
    <div className={CANNOT_SHOW}>
      <FileMark size="large" look="none" extension={file.name.includes(".") ? file.name.split(".").pop() : undefined} />
      <p>
        {original.reason === "too-large"
          ? t("files.viewer.tooLarge", "{name} is too large to read here.", { name: file.name })
          : t("files.viewer.cannotShow", "This kind of file cannot be shown here.")}
      </p>
      <Button icon="download" onClick={onDownload}>
        {t("files.viewer.downloadNamed", "Download {name}", { name: file.name })}
      </Button>
    </div>
  );
}
