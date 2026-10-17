import { useEffect, useRef, useState } from "react";
import { useOriginal } from "../../application/useOriginal";
import type { FileEntry } from "../../lib/files";
import { useTranslation } from "../../translations/TranslationProvider";
import { defaultReadingMode, OriginalReader, type ReadingMode as ReaderMode } from "../../ui/components/reader/Reader";
import { readingFormatOf } from "../../ui/components/reader/readingFormat";
import { Button } from "../../ui/primitives";
import { useReadingPreference } from "./readingPreference";
import { READING_BAR_WORD, READING_BAR, READING_BAR_TITLE, READING_MODE, READING_STAGE } from "./libraryClasses";

interface ReadingModeProperties {
  workspaceId: string;
  file: FileEntry;
  previous?: FileEntry;
  next?: FileEntry;
  onOpen: (file: FileEntry) => void;
  onExit: () => void;
}

/**
 * The document and nothing else. A slim bar names it and leaves — it slides away while reading down and returns on
 * the way up — and the text sits at a reading measure on the plain page: no rail, no panels, no frame. Escape leaves,
 * the arrow keys step to the neighbouring document. On a phone this is how a document opens.
 */
export function ReadingMode({ workspaceId, file, previous, next, onOpen, onExit }: ReadingModeProperties) {
  const { t } = useTranslation();
  const format = readingFormatOf(file.name, file.effectiveMediaType);
  const original = useOriginal({ workspaceId, versionId: file.versionId, format, mediaType: file.effectiveMediaType, sizeBytes: file.sizeBytes });
  const [chosen, setChosen] = useState<{ versionId: string; mode: ReaderMode } | null>(null);
  const mode = chosen !== null && chosen.versionId === file.versionId ? chosen.mode : defaultReadingMode(format, null);
  const [preferred, setPreferred] = useReadingPreference();
  const [barHidden, setBarHidden] = useState(false);
  const lastScroll = useRef(0);
  const root = useRef<HTMLDivElement>(null);

  // The page behind keeps still, and focus comes back to whatever opened the reading.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (event.key === "Escape") {
        onExit();
      } else if (event.key === "ArrowLeft" && previous !== undefined) {
        onOpen(previous);
      } else if (event.key === "ArrowRight" && next !== undefined) {
        onOpen(next);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit, onOpen, previous, next]);

  // The reader scrolls inside its own frame, so the direction is read from whichever element scrolled.
  const onScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const top = target.scrollTop;
    if (Math.abs(top - lastScroll.current) > 8) {
      setBarHidden(top > lastScroll.current && top > 48);
      lastScroll.current = top;
    }
  };

  const switchable = format.kind === "markdown";

  return (
    <div ref={root} className={READING_MODE} role="dialog" aria-modal="true" aria-label={file.name} tabIndex={-1} onScrollCapture={onScroll}>
      <div className={READING_BAR} data-hidden={barHidden}>
        <Button variant="quiet" iconOnly icon="close" aria-label={t("library.reading.exit", "Leave reading mode")} title={t("library.reading.exit", "Leave reading mode")} onClick={onExit} />
        <span className={READING_BAR_TITLE} title={file.path}>
          {file.title.length > 0 ? file.title : file.name}
        </span>
        {switchable && (
          <Button
            variant="quiet"
            icon="code"
            aria-label={mode === "rendered" ? t("library.reading.source", "Source") : t("library.reading.rendered", "Text")}
            onClick={() => setChosen({ versionId: file.versionId, mode: mode === "rendered" ? "source" : "rendered" })}
          >
            <span className={READING_BAR_WORD}>{mode === "rendered" ? t("library.reading.source", "Source") : t("library.reading.rendered", "Text")}</span>
          </Button>
        )}
        <Button
          variant="quiet"
          icon={preferred ? "check" : "eye"}
          aria-pressed={preferred}
          aria-label={t("library.reading.always", "Always read")}
          title={t("library.reading.alwaysHint", "Open every document like this; remembered in this browser")}
          onClick={() => setPreferred(!preferred)}
        >
          <span className={READING_BAR_WORD}>{t("library.reading.always", "Always read")}</span>
        </Button>
        <Button variant="quiet" iconOnly icon="previous" disabled={previous === undefined} aria-label={t("library.reading.previous", "Previous document")} onClick={() => previous !== undefined && onOpen(previous)} />
        <Button variant="quiet" iconOnly icon="chevron" disabled={next === undefined} aria-label={t("library.reading.next", "Next document")} onClick={() => next !== undefined && onOpen(next)} />
      </div>
      <div className={READING_STAGE}>
        {original.status === "loading" && <p className="place-self-center text-xs text-muted">{t("files.reading", "Reading…")}</p>}
        {original.status === "failed" && <p className="place-self-center text-sm">{original.problem.title}</p>}
        {original.status === "ready" && (
          <OriginalReader
            name={file.name}
            format={format}
            content={original.content}
            mode={mode}
            onModeChange={(next) => setChosen({ versionId: file.versionId, mode: next })}
            focus={null}
            page={null}
            fill
            bare
          />
        )}
        {original.status !== "loading" && original.status !== "failed" && original.status !== "ready" && (
          <p className="place-self-center text-sm text-muted">{t("files.viewer.cannotShow", "This kind of file cannot be shown here.")}</p>
        )}
      </div>
    </div>
  );
}
