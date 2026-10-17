import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { formatBytes, formatDateTime, formatElapsed } from "../../application/format";
import { useOriginal } from "../../application/useOriginal";
import type { FileEntry } from "../../lib/files";
import { useTranslation } from "../../translations/TranslationProvider";
import { defaultReadingMode, type ReadingMode } from "../../ui/components/reader/Reader";
import { readingFormatOf } from "../../ui/components/reader/readingFormat";
import { Menu, type MenuItem } from "../../ui/components";
import { Button } from "../../ui/primitives";
import { FileStatus } from "./FileStatus";
import { FileStage } from "./FileViewer";
import { PREVIEW, PREVIEW_ACTIONS, PREVIEW_FACTS, PREVIEW_HEAD, PREVIEW_STAGE, PREVIEW_TITLE } from "./filesClasses";

interface FilePreviewProperties {
  workspaceId: string;
  file: FileEntry;
  sourceName: string | null;
  onOpenFull: () => void;
  /** The document alone, in reading mode. */
  onRead: () => void;
  onDownload: () => void;
  /** Every action on the file — the same list a tile's menu holds, which a phone does not show. */
  actions: MenuItem[];
  onClose: () => void;
}

/**
 * The file chosen in the list, shown beside it as what it is — code as code, a page as a page, Markdown rendered —
 * with the few facts a reader wants and the way to everything else: the whole screen, the download, and the
 * document page where its processing lives. Nothing about the pipeline is here; this is for reading.
 */
export function FilePreview({ workspaceId, file, sourceName, onOpenFull, onRead, onDownload, actions, onClose }: FilePreviewProperties) {
  const { t, language } = useTranslation();
  const format = readingFormatOf(file.name, file.effectiveMediaType);
  const original = useOriginal({ workspaceId, versionId: file.versionId, format, mediaType: file.effectiveMediaType, sizeBytes: file.sizeBytes });
  const [chosenMode, setChosenMode] = useState<{ versionId: string; mode: ReadingMode } | null>(null);
  const mode = chosenMode !== null && chosenMode.versionId === file.versionId ? chosenMode.mode : defaultReadingMode(format, null);

  return (
    <aside className={PREVIEW} aria-label={t("files.preview.label", "Preview of {name}", { name: file.name })}>
      <header className={PREVIEW_HEAD}>
        <div className={PREVIEW_TITLE}>
          <h2 title={file.path}>{file.name}</h2>
          <span className="text-xs text-muted">
            {format.description} · <span className="numeric">{formatBytes(file.sizeBytes)}</span>
          </span>
        </div>
        <span className="flex flex-none items-center gap-1">
          <Menu label={t("files.actionsFor", "Actions for {name}", { name: file.name })} items={actions} alignEnd />
          <Button variant="quiet" iconOnly icon="close" aria-label={t("files.preview.close", "Close the preview")} onClick={onClose} />
        </span>
      </header>

      <div className={PREVIEW_STAGE}>
        <FileStage
          file={file}
          format={format}
          original={original}
          mode={mode}
          onModeChange={(next) => setChosenMode({ versionId: file.versionId, mode: next })}
          onDownload={onDownload}
        />
      </div>

      <div className={PREVIEW_ACTIONS}>
        <Button variant="primary" icon="eye" onClick={onRead}>
          {t("library.reading.read", "Read")}
        </Button>
        <Button variant="quiet" icon="expand" onClick={onOpenFull}>
          {t("files.preview.openFull", "Open full screen")}
        </Button>
        <Button variant="quiet" icon="download" onClick={onDownload}>
          {t("files.action.download", "Download")}
        </Button>
      </div>

      <dl className={PREVIEW_FACTS}>
        <dt>{t("files.preview.status", "Status")}</dt>
        <dd>
          <FileStatus file={file} />
        </dd>
        <dt>{t("files.preview.where", "Where")}</dt>
        <dd className="numeric">
          {sourceName ?? "—"} / {file.path}
        </dd>
        <dt>{t("files.preview.added", "Added")}</dt>
        <dd title={formatDateTime(file.capturedAt)}>
          {formatElapsed(file.capturedAt, language)} · {t("files.preview.version", "version {number}", { number: file.versionNumber })}
        </dd>
        <dt>{t("files.preview.type", "Type")}</dt>
        <dd className="numeric">{file.effectiveMediaType.split(";")[0]}</dd>
      </dl>

      <Link to="/documents/$documentId" params={{ documentId: file.documentId }} className="text-xs font-semibold text-accent-text hover:underline">
        {t("files.preview.processing", "Processing details →")}
      </Link>
    </aside>
  );
}
