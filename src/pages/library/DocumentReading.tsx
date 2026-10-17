import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatBytes, formatDateTime, formatElapsed } from "../../application/format";
import { useOriginal } from "../../application/useOriginal";
import { useResource } from "../../application/useResource";
import { api } from "../../lib/api";
import { downloadFile, lookOf, type FileEntry } from "../../lib/files";
import { useTranslation } from "../../translations/TranslationProvider";
import { defaultReadingMode, type ReadingMode } from "../../ui/components/reader/Reader";
import { readingFormatOf, type LineRange } from "../../ui/components/reader/readingFormat";
import { Button } from "../../ui/primitives";
import { FileMark } from "../files/FileMarks";
import { FileStatus } from "../files/FileStatus";
import { FileStage } from "../files/FileViewer";
import {
  CONTEXT,
  CONTEXT_CLOSE,
  CONTEXT_HEADING,
  CONTEXT_TOGGLE,
  FACTS,
  OUTLINE,
  OUTLINE_ITEM,
  READING,
  READING_BODY,
  READING_HEAD,
  READING_TITLE,
  RELATED,
  RELATED_ITEM,
  STAGE,
} from "./libraryClasses";
import { outlineOf, type OutlineEntry } from "./outline";
import { relatedDocuments, subjectWords } from "./related";

interface DocumentReadingProperties {
  workspaceId: string;
  file: FileEntry;
  sourceName: string | null;
  onOpen: (versionId: string) => void;
  /** Reading mode for this document; absent where the page offers none. */
  onRead?: () => void;
}

/**
 * The document in front of the desk: what it is, the document itself read as what it is, and beside it the way
 * around it — its outline — and the way out of it — the documents that share its subject.
 */
export function DocumentReading({ workspaceId, file, sourceName, onOpen, onRead }: DocumentReadingProperties) {
  const { t, language } = useTranslation();
  const format = readingFormatOf(file.name, file.effectiveMediaType);
  const original = useOriginal({ workspaceId, versionId: file.versionId, format, mediaType: file.effectiveMediaType, sizeBytes: file.sizeBytes });
  const [chosenMode, setChosenMode] = useState<ReadingMode | null>(null);
  const [focus, setFocus] = useState<LineRange | null>(null);
  const mode = chosenMode ?? defaultReadingMode(format, null);
  const stage = useRef<HTMLDivElement>(null);
  // Below 1200px the outline and related documents slide over the reader instead of sitting beside it.
  const [contextOpen, setContextOpen] = useState(false);

  const outline = useMemo(
    () => (original.status === "ready" && original.content.form === "text" ? outlineOf(original.content.text, format) : []),
    [original, format],
  );
  const prose = format.kind === "markdown" && mode === "rendered";

  // The heading being read: the last one whose top has passed the top of the stage. Checked once a frame at most.
  const [currentHeading, setCurrentHeading] = useState<number | null>(null);
  const pendingFrame = useRef(0);
  const followReading = () => {
    if (pendingFrame.current !== 0) {
      return;
    }
    pendingFrame.current = requestAnimationFrame(() => {
      pendingFrame.current = 0;
      const container = stage.current;
      if (container === null) {
        return;
      }
      const line = container.getBoundingClientRect().top + 96;
      let reached: number | null = null;
      container.querySelectorAll("h1, h2, h3, h4").forEach((heading, index) => {
        if (heading.getBoundingClientRect().top <= line) {
          reached = index;
        }
      });
      setCurrentHeading(reached);
    });
  };
  useEffect(() => () => cancelAnimationFrame(pendingFrame.current), []);

  const jump = (entry: OutlineEntry) => {
    setContextOpen(false);
    if (prose && entry.headingIndex !== null) {
      // A rendered page has no lines; its headings come in the outline's order.
      const headings = stage.current?.querySelectorAll("h1, h2, h3, h4");
      headings?.[entry.headingIndex]?.scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }
    setFocus({ start: entry.line, end: entry.line });
  };

  return (
    <article className={READING} aria-label={file.name}>
      <header className={READING_HEAD}>
        <FileMark size="small" look={lookOf(file)} name={file.name} />
        <div className={READING_TITLE}>
          <h2 title={file.path}>{file.title.length > 0 ? file.title : file.name}</h2>
          <span className="numeric text-xs text-muted">
            {sourceName ?? "—"} / {file.path}
          </span>
        </div>
        <FileStatus file={file} />
        {onRead !== undefined && (
          <Button variant="quiet" icon="eye" onClick={onRead} title={t("library.reading.hint", "The document alone (R)")}>
            {t("library.reading.read", "Read")}
          </Button>
        )}
        <span className={CONTEXT_TOGGLE}>
          <Button variant="quiet" icon="layers" aria-expanded={contextOpen} aria-controls="library-context" onClick={() => setContextOpen(!contextOpen)}>
            {t("library.contextToggle", "Outline")}
          </Button>
        </span>
        <Button variant="quiet" iconOnly icon="download" aria-label={t("files.action.download", "Download")} title={t("files.action.download", "Download")} onClick={() => void downloadFile(workspaceId, file)} />
        <Link to="/documents/$documentId" params={{ documentId: file.documentId }} className="text-xs font-semibold text-accent-text hover:underline">
          {t("library.processing", "Processing")}
        </Link>
      </header>
      <div className={READING_BODY}>
        <div ref={stage} className={STAGE} data-prose={prose} onScrollCapture={prose ? followReading : undefined}>
          <FileStage
            file={file}
            format={format}
            original={original}
            mode={focus !== null && format.kind === "markdown" ? "source" : mode}
            focus={focus}
            onModeChange={(next) => {
              setChosenMode(next);
              setFocus(null);
            }}
            onDownload={() => void downloadFile(workspaceId, file)}
          />
        </div>
        <aside id="library-context" className={CONTEXT} data-open={contextOpen} aria-label={t("library.context", "About this document")}>
          <span className={CONTEXT_CLOSE}>
            <Button variant="quiet" iconOnly icon="close" aria-label={t("library.contextClose", "Close the outline")} onClick={() => setContextOpen(false)} />
          </span>
          <section className="grid gap-1.5" aria-labelledby="library-outline">
            <h3 id="library-outline" className={CONTEXT_HEADING}>
              {t("library.outline", "Outline")}
            </h3>
            {outline.length === 0 ? (
              <p className="m-0 text-xs text-muted">
                {format.kind === "book"
                  ? t("library.outline.book", "A book carries its own contents: choose a chapter at the top of the book.")
                  : format.kind === "markdown" || format.kind === "code"
                    ? t("library.outline.none", "No headings or declarations found.")
                    : t("library.outline.notText", "An outline is read from text; this original is not.")}
              </p>
            ) : (
              <ol className={OUTLINE}>
                {outline.map((entry) => (
                  <li key={`${entry.line}-${entry.label}`}>
                    <button
                      type="button"
                      className={OUTLINE_ITEM}
                      style={{ paddingLeft: `calc(${(entry.level - 1) * 14 + 10}px * var(--ui-scale))` }}
                      data-level={entry.level}
                      data-active={entry.headingIndex !== null && entry.headingIndex === currentHeading}
                      aria-current={entry.headingIndex !== null && entry.headingIndex === currentHeading ? "location" : undefined}
                      title={entry.label}
                      onClick={() => jump(entry)}
                    >
                      {entry.label}
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <Related workspaceId={workspaceId} file={file} sourceName={sourceName} onOpen={onOpen} />

          <section className="grid gap-1.5" aria-labelledby="library-facts">
            <h3 id="library-facts" className={CONTEXT_HEADING}>
              {t("library.facts", "Facts")}
            </h3>
            <dl className={FACTS}>
              <dt>{t("files.preview.type", "Type")}</dt>
              <dd>{format.description}</dd>
              <dt>{t("documents.fact.size", "Size")}</dt>
              <dd className="numeric">{formatBytes(file.sizeBytes)}</dd>
              <dt>{t("files.preview.added", "Added")}</dt>
              <dd title={formatDateTime(file.capturedAt)}>
                {formatElapsed(file.capturedAt, language)} · {t("files.preview.version", "version {number}", { number: file.versionNumber })}
              </dd>
            </dl>
            <Link
              to="/library"
              search={{ mode: "files", source: file.sourceId, folder: file.folder === "" ? undefined : file.folder, pick: file.versionId }}
              className="text-xs font-semibold text-accent-text hover:underline"
            >
              {t("library.showInFiles", "Show among its files →")}
            </Link>
          </section>
        </aside>
      </div>
    </article>
  );
}

function Related({ workspaceId, file, sourceName, onOpen }: DocumentReadingProperties) {
  const { t } = useTranslation();
  const words = subjectWords(file, sourceName);
  const related = useResource(async () => {
    if (words.length === 0) {
      return [];
    }
    const profiles = await api.availableSearchProfiles(workspaceId);
    const profile = profiles[0];
    return profile === undefined ? [] : relatedDocuments(workspaceId, profile.id, file, words);
  }, [workspaceId, file.versionId, words.join(" ")]);

  return (
    <section className="grid gap-1.5" aria-labelledby="library-related">
      <h3 id="library-related" className={CONTEXT_HEADING}>
        {t("library.related", "Related documents")}
      </h3>
      {words.length > 0 && (
        <p className="m-0 text-[11px] text-muted">
          {t("library.relatedBy", "Mentioning {words}", { words: words.join(" · ") })}
        </p>
      )}
      {related.status === "loading" && <p className="m-0 text-xs text-muted">{t("library.relatedLoading", "Looking…")}</p>}
      {related.status === "ready" &&
        (related.data.length === 0 ? (
          <p className="m-0 text-xs text-muted">{t("library.relatedNone", "No other document mentions them.")}</p>
        ) : (
          <ul className={RELATED}>
            {related.data.map((document) => (
              <li key={document.documentId}>
                <button type="button" className={RELATED_ITEM} onClick={() => onOpen(document.versionId)}>
                  <span className="overflow-hidden text-xs font-semibold text-ellipsis whitespace-nowrap text-ink">{document.title}</span>
                  <span className="text-[11px] text-muted">{document.shared.join(" · ")}</span>
                </button>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
