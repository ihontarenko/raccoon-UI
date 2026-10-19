import { lazy, Suspense, useCallback, useState, type KeyboardEvent, type ReactNode } from "react";
import { formatNumber } from "../../../application/format";
import { translate } from "../../../translations/translate";
import { useTranslation } from "../../../translations/TranslationProvider";
import type { OriginalContent } from "../../../lib/files";
import { Button } from "../../primitives";
import { Notice } from "../Notice";
import { Segmented, type SegmentOption } from "../Segmented";
import type { CodeReaderProperties } from "./CodeReaderSurface";
import { isDocumentationEmpty, type DocumentationPage } from "./documentationViews";
import type { LineRange, ReadingFormat } from "./readingFormat";
import { READER_HEIGHT } from "./readerClasses";

/*
 * The reader: one original read as what it is. Code and text sit in a framed CodeMirror surface,
 * Markdown and documentation as a reading column, pictures and pages on a well.
 *
 * ⚠️ `data-reader-stage` IS THE WHOLE `fill` MECHANISM. When a page gives the reader a height of its
 * own — the file viewer stage does — every frame inside has to drop its clamp and take the room
 * instead. The frames are rendered by four different functions that know nothing of the container,
 * so the container reaches them by attribute. A utility class would not do: it is not a stable hook.
 */
const READER = "min-w-0 gap-3";

const FILL = [
  "flex h-full flex-col",
  "[&>:last-child]:min-h-0 [&>:last-child]:flex-[1_1_auto]",
  "[&_[data-reader-stage]]:h-auto",
].join(" ");

const TOOLBAR = "flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2";

/* A reader that is the page's own column: the toolbar stays, the frame goes — the page around it is the frame. */
const OPEN = "[&_[data-reader-stage]]:rounded-none [&_[data-reader-stage]]:border-0 [&_[data-reader-stage]]:bg-transparent";

/* Reading mode: no frame, no toolbar — the text alone, prose at a reading measure in the middle of the page. */
const BARE = [
  "[&_[data-reader-stage]]:rounded-none [&_[data-reader-stage]]:border-0 [&_[data-reader-stage]]:bg-transparent",
  "[&_[data-reader-stage]]:mx-auto [&_[data-reader-stage]]:w-full [&_[data-reader-stage]]:max-w-[150ch] [--prose-measure:none]",
  "[&_[data-reader-stage]]:[padding:var(--space-5)_var(--space-4)_var(--space-7)] [&_[data-reader-stage]]:[overflow-wrap:break-word]",
  /* A book's chapter bar stays opaque over the text scrolling under it, in the page's own ground. */
  "[&_[data-book-navigation]]:bg-bg",
].join(" ");

const FACTS = "flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-xs text-muted";

/* Pushed to the far end of the toolbar — until the toolbar wraps, where a pushed row reads as a gap. */
const TOOLBAR_END = "ml-auto flex flex-wrap gap-1 max-[800px]:ml-0";

const CODE_FRAME = `${READER_HEIGHT} min-h-0 overflow-hidden rounded-control border border-line bg-surface`;

const PROSE_FRAME = [
  "min-w-0 overflow-auto rounded-control border border-line bg-surface",
  "[padding:var(--space-5)_var(--space-6)] max-[800px]:p-4",
].join(" ");

const STAGE_FRAME = [
  `relative ${READER_HEIGHT} min-h-0 overflow-auto rounded-control border border-line bg-well`,
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text",
].join(" ");

/* Past 2× a photograph is being inspected rather than viewed, so the pixels stop being smoothed. */
const PIXELATED = "[&_img]:[image-rendering:pixelated]";

const MEDIA = "grid place-items-center p-6 [&>video]:max-h-full [&>video]:max-w-full";

// The surfaces that carry a library are loaded only when something is read with them.
const LazyCodeReader = lazy(() => import("./CodeReaderSurface"));
const LazyMarkdownReader = lazy(() => import("./MarkdownReaderSurface"));
const LazyJavaDocReader = lazy(() => import("./JavaDocReaderSurface"));
const LazyScriptDocReader = lazy(() => import("./ScriptDocReaderSurface"));
const LazyBookReader = lazy(() => import("./book/BookReaderSurface"));

/**
 * How an original is being read, where it can be read more than one way: as itself — Markdown rendered or as source,
 * code, a PDF as the original — or through a view built from its parse, which the page supplies.
 */
export type ReadingMode = "rendered" | "source" | "documentation" | "code" | "original" | "rebuilt" | "paths";

/** The documentation view of a source file — Java, TypeScript, JavaScript — which the page that holds the chunks loads. */
export type DocumentationState =
  | { status: "unavailable"; reason: string }
  | { status: "loading" }
  | { status: "failed"; title: string; detail: string }
  | { status: "ready"; documentation: DocumentationPage };

/** Rendered Markdown is cut here; the source view still holds everything that was read. */
const LARGEST_MARKDOWN_RENDERED = 400_000;

/**
 * The mode an original opens in when its own form can be read two ways: rendered Markdown, unless a citation names
 * lines — lines live in the source, so that is where it opens. Views built from the parse are the page's to choose.
 */
export function defaultReadingMode(format: ReadingFormat, focus: LineRange | null): ReadingMode | null {
  if (format.kind === "markdown") {
    return focus === null ? "rendered" : "source";
  }
  return null;
}

/** The ways a format's own form is read, in the order the switch shows them. */
function modesOf(format: ReadingFormat): SegmentOption<ReadingMode>[] {
  if (format.kind === "markdown") {
    return [
      { value: "rendered", label: translate("reader.mode.rendered", "Rendered") },
      { value: "source", label: translate("reader.mode.source", "Source") },
    ];
  }
  return [];
}

export function CodeReader(properties: CodeReaderProperties) {
  return (
    <div className={CODE_FRAME} data-reader-stage>
      <Suspense
        fallback={
          <pre
            className="m-0 h-full overflow-hidden px-4 py-2 font-mono text-xs leading-[1.6] whitespace-pre text-secondary"
            aria-busy="true"
          >
            {properties.text.slice(0, 20_000)}
          </pre>
        }
      >
        <LazyCodeReader {...properties} />
      </Suspense>
    </div>
  );
}

export function MarkdownReader({ markdown }: { markdown: string }) {
  const { t } = useTranslation();
  const cut = markdown.length > LARGEST_MARKDOWN_RENDERED;
  return (
    <div className={PROSE_FRAME} data-reader-stage>
      {cut && (
        <Notice tone="warn" title={t("reader.renderedInPart", "Rendered in part")}>
          {t("reader.renderedInPartDescription", "The first {count} characters are rendered. Switch to Source to read the rest.", {
            count: formatNumber(LARGEST_MARKDOWN_RENDERED),
          })}
        </Notice>
      )}
      <Suspense fallback={<p className="text-xs text-muted">{t("reader.rendering", "Rendering…")}</p>}>
        <LazyMarkdownReader markdown={cut ? markdown.slice(0, LARGEST_MARKDOWN_RENDERED) : markdown} />
      </Suspense>
    </div>
  );
}

/** A source file's documentation page, in whatever state the page loading it is in. */
export function DocumentationReader({ documentation, onShowLines }: { documentation: DocumentationState; onShowLines: (range: LineRange) => void }) {
  const { t } = useTranslation();
  if (documentation.status === "loading") {
    return <p className="text-xs text-muted">{t("reader.readingDeclarations", "Reading the declarations…")}</p>;
  }
  if (documentation.status === "unavailable") {
    return <Notice title={t("reader.noDocumentationView", "No documentation view")}>{documentation.reason}</Notice>;
  }
  if (documentation.status === "failed") {
    return (
      <Notice tone="error" title={documentation.title}>
        {documentation.detail}
      </Notice>
    );
  }
  const page = documentation.documentation;
  if (isDocumentationEmpty(page)) {
    return (
      <Notice title={t("reader.noDeclarations", "No declarations")}>
        {t("reader.noDeclarationsDescription", "Processing recorded no declaration in this file. The Code view shows it as written.")}
      </Notice>
    );
  }
  return (
    <div className={PROSE_FRAME} data-reader-stage>
      <Suspense fallback={<p className="text-xs text-muted">{t("reader.rendering", "Rendering…")}</p>}>
        {page.family === "java" ? (
          <LazyJavaDocReader page={page.page} onShowLines={onShowLines} />
        ) : (
          <LazyScriptDocReader page={page.page} codeLanguage={page.codeLanguage} onShowLines={onShowLines} />
        )}
      </Suspense>
    </div>
  );
}

const ZOOM_STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8];

/** A picture fitted to the frame, or at a chosen scale; + and − zoom, 0 fits, 1 shows it at its own size. */
export function ImageReader({ address, description, facts, actions, fill = false }: { address: string; description: string; facts?: ReactNode; actions?: ReactNode; fill?: boolean }) {
  const { t, locale } = useTranslation();
  const [scale, setScale] = useState<number | "fit">("fit");
  const [naturalWidth, setNaturalWidth] = useState<number | null>(null);
  const [fittedScale, setFittedScale] = useState<number | null>(null);
  const currentScale = scale === "fit" ? null : scale;
  const shownScale = currentScale ?? fittedScale;

  // What "fit" comes to depends on the frame, so it is measured whenever the picture is laid out again.
  const measure = useCallback((image: HTMLImageElement | null) => {
    if (image === null) {
      return undefined;
    }
    const observer = new ResizeObserver(() => {
      if (image.naturalWidth > 0) {
        setFittedScale(image.clientWidth / image.naturalWidth);
      }
    });
    observer.observe(image);
    return () => observer.disconnect();
  }, []);

  const step = (direction: 1 | -1) => {
    const from = currentScale ?? 1;
    const next = direction > 0 ? ZOOM_STEPS.find((candidate) => candidate > from + 0.001) : [...ZOOM_STEPS].reverse().find((candidate) => candidate < from - 0.001);
    if (next !== undefined) {
      setScale(next);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      step(1);
    } else if (event.key === "-") {
      event.preventDefault();
      step(-1);
    } else if (event.key === "0") {
      event.preventDefault();
      setScale("fit");
    } else if (event.key === "1") {
      event.preventDefault();
      setScale(1);
    }
  };

  return (
    <div className={`${READER} ${fill ? FILL : "grid"}`}>
      <div className={TOOLBAR}>
        <div className="flex items-center gap-1" role="toolbar" aria-label={t("reader.zoom", "Zoom")}>
          <Button variant="quiet" onClick={() => setScale("fit")} aria-pressed={scale === "fit"} title={t("reader.fitKey", "Fit (0)")}>
            {t("reader.fit", "Fit")}
          </Button>
          <Button variant="quiet" onClick={() => setScale(1)} aria-pressed={scale === 1} title={t("reader.actualSizeKey", "Actual size (1)")}>
            {t("reader.actualSize", "Actual size")}
          </Button>
          <Button variant="quiet" onClick={() => step(-1)} aria-label={t("reader.zoomOut", "Zoom out")} title={t("reader.zoomOutKey", "Zoom out (−)")}>
            −
          </Button>
          <span className="numeric min-w-[5ch] text-center text-xs text-secondary" aria-live="polite">
            {shownScale === null ? "" : new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(shownScale)}
          </span>
          <Button variant="quiet" onClick={() => step(1)} aria-label={t("reader.zoomIn", "Zoom in")} title={t("reader.zoomInKey", "Zoom in (+)")}>
            +
          </Button>
        </div>
        {facts !== undefined && <div className={FACTS}>{facts}</div>}
        {actions !== undefined && <div className={TOOLBAR_END}>{actions}</div>}
      </div>
      <div
        className={`${STAGE_FRAME} ${currentScale !== null && currentScale >= 2 ? PIXELATED : ""}`}
        data-reader-stage
        tabIndex={0}
        role="group"
        aria-label={t("reader.imageLabel", "{description} — use plus and minus to zoom", { description })}
        onKeyDown={onKeyDown}
      >
        <div className={currentScale === null ? "grid h-full w-full place-items-center p-3" : "p-3"}>
          <img
            ref={measure}
            className={
              currentScale === null
                ? "max-h-full max-w-full object-contain [image-rendering:auto]"
                : "block max-w-none"
            }
            src={address}
            alt={description}
            onLoad={(event) => setNaturalWidth(event.currentTarget.naturalWidth)}
            style={currentScale !== null && naturalWidth !== null ? { width: `${naturalWidth * currentScale}px` } : undefined}
          />
        </div>
      </div>
    </div>
  );
}

/** A PDF in the browser's own viewer, opened at a page when a citation names one. */
export function PdfReader({ address, title, page }: { address: string; title: string; page: number | null }) {
  const source = page === null ? address : `${address}#page=${page}`;
  return (
    <div className={STAGE_FRAME} data-reader-stage>
      {/* Keyed by the page: a blob address with a new fragment does not move an open viewer. */}
      <iframe
        key={source}
        className="block h-full w-full border-0 bg-surface"
        src={source}
        title={title}
      />
    </div>
  );
}

interface OriginalReaderProperties {
  /** The file's name, which the surfaces are labelled with. */
  name: string;
  format: ReadingFormat;
  content: OriginalContent;
  /** The effective mode — `defaultReadingMode` when nobody chose one. */
  mode: ReadingMode | null;
  onModeChange: (mode: ReadingMode) => void;
  focus: LineRange | null;
  page: number | null;
  /**
   * The switch between ways of reading, when the page offers a view built from the parse beside the original's own
   * form — [Original | Rebuilt], [Documentation | Code]. Absent, the format's own modes are offered.
   */
  views?: SegmentOption<ReadingMode>[];
  /** What a chosen view draws, in place of the original's own surface. */
  viewSurface?: ReactNode;
  /** Facts and actions beside the mode switch. */
  facts?: ReactNode;
  actions?: ReactNode;
  /** Fill the container's height instead of the window's, as a full-screen viewer does. */
  fill?: boolean;
  /**
   * How much of the reader's own chrome shows: `framed` draws its frame, `open` drops the frame where the page
   * around it already is one, and `bare` — reading mode — drops the toolbar too.
   */
  presentation?: ReaderPresentation;
}

export type ReaderPresentation = "framed" | "open" | "bare";

const PRESENTATION_CLASSES: Record<ReaderPresentation, string> = { framed: "", open: OPEN, bare: BARE };

/** One original read as what it is, with the switch between its ways of reading where it has several. */
export function OriginalReader({ name, format, content, mode, onModeChange, focus, page, views, viewSurface, facts, actions, fill = false, presentation = "framed" }: OriginalReaderProperties) {
  const { t } = useTranslation();
  const modes = views ?? modesOf(format);
  const text = content.form === "text" ? content.text : null;
  const address = content.form === "bytes" ? content.address : null;

  let surface: ReactNode;
  if (viewSurface !== undefined) {
    surface = viewSurface;
  } else if (text !== null && format.kind === "markdown" && mode === "rendered") {
    surface = <MarkdownReader markdown={text} />;
  } else if (text !== null) {
    surface = <CodeReader text={text} label={name} language={format.kind === "code" ? format.language : format.kind === "markdown" ? "markdown" : null} focus={focus} wrapLines={format.kind !== "code"} />;
  } else if (address !== null && format.kind === "image") {
    return <ImageReader address={address} description={name} facts={facts} actions={actions} fill={fill} />;
  } else if (address !== null && format.kind === "book") {
    surface = (
      <Suspense fallback={<p className="text-xs text-muted">{t("reader.book.opening", "Opening the book…")}</p>}>
        <LazyBookReader address={address} name={name} frameClassName={PROSE_FRAME} />
      </Suspense>
    );
  } else if (address !== null && format.kind === "pdf") {
    surface = <PdfReader address={address} title={name} page={page} />;
  } else if (address !== null && format.kind === "audio") {
    surface = (
      <div className={MEDIA}>
        <audio controls src={address} aria-label={name} />
      </div>
    );
  } else if (address !== null && format.kind === "video") {
    surface = (
      <div className={MEDIA}>
        <video controls src={address} aria-label={name} />
      </div>
    );
  } else {
    surface = <p className="text-xs text-muted">{t("reader.cannotShow", "This file cannot be shown here.")}</p>;
  }

  const showToolbar = presentation !== "bare" && (modes.length > 0 || facts !== undefined || actions !== undefined);
  return (
    <div className={`${READER} ${fill ? FILL : "grid"} ${PRESENTATION_CLASSES[presentation]}`}>
      {showToolbar && (
        <div className={TOOLBAR}>
          {modes.length > 0 && mode !== null && <Segmented label={t("reader.readAs", "Read as")} options={modes} value={mode} onChange={onModeChange} />}
          {facts !== undefined && <div className={FACTS}>{facts}</div>}
          {actions !== undefined && <div className={TOOLBAR_END}>{actions}</div>}
        </div>
      )}
      {content.form === "text" && content.cut && (
        <Notice tone="warn" title={t("reader.shownInPart", "Shown in part")}>
          {t(
            "reader.shownInPartDescription",
            "The first {shown} of {total} characters are shown. Download the file for all of it.",
            { shown: formatNumber(content.text.length), total: formatNumber(content.totalCharacters) },
          )}
        </Notice>
      )}
      {surface}
    </div>
  );
}
