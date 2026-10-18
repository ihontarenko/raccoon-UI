import { useMemo, useState } from "react";
import { formatBytes } from "../../../application/format";
import type { DocumentReadingView } from "../../../application/routeTabs";
import { useOriginal } from "../../../application/useOriginal";
import { useResource } from "../../../application/useResource";
import type { DocumentVersionView } from "../../../lib/contracts";
import { downloadFile, filesApi, type FileEntry } from "../../../lib/files";
import type { ProcessingReference } from "../../../lib/pipeline";
import { useTranslation } from "../../../translations/TranslationProvider";
import { EmptyState, ProblemState, Waiting } from "../../../ui/components";
import { defaultReadingMode, OriginalReader } from "../../../ui/components/reader/Reader";
import {
  countLines,
  parseLineRange,
  readingFormatOf,
  type LineRange,
} from "../../../ui/components/reader/readingFormat";
import { Button } from "../../../ui/primitives";
import { labelOf } from "../reading/readingViews";
import { readingViewOf } from "../reading/views";

export interface ReadingAddress {
  view?: DocumentReadingView;
  lines?: string;
  page?: number;
}

interface ReadTabProperties {
  workspaceId: string;
  documentId: string;
  version: DocumentVersionView;
  generation: ProcessingReference | null;
  /** The document's path in its source, which a module's documentation is titled with. */
  documentPath: string | null;
  address: ReadingAddress;
  onAddressChange: (address: ReadingAddress) => void;
}

/**
 * The original of one version, read as what it is: Markdown rendered or as source, code coloured with its
 * lines, a Java class or a TypeScript module as its documentation, a PDF in the browser's viewer, a picture with zoom. A citation
 * opens it at its lines or its page.
 */
export function ReadTab({
  workspaceId,
  documentId,
  version,
  generation,
  documentPath,
  address,
  onAddressChange,
}: ReadTabProperties) {
  const { t } = useTranslation();
  const file = useResource(() => filesApi.file(workspaceId, version.id), [workspaceId, version.id]);

  if (file.status === "loading") {
    return <Waiting label={t("documents.read.opening", "Opening the original")} lines={8} />;
  }
  if (file.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={file.problem}
        actions={
          <Button icon="refresh" onClick={file.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }
  return (
    <OriginalOfVersion
      workspaceId={workspaceId}
      documentId={documentId}
      file={file.data}
      generation={generation}
      documentPath={documentPath}
      address={address}
      onAddressChange={onAddressChange}
    />
  );
}

function OriginalOfVersion({
  workspaceId,
  documentId,
  file,
  generation,
  documentPath,
  address,
  onAddressChange,
}: Omit<ReadTabProperties, "version"> & { file: FileEntry }) {
  const { t, plural } = useTranslation();
  const format = useMemo(
    () => readingFormatOf(file.name, file.effectiveMediaType),
    [file.name, file.effectiveMediaType],
  );
  const original = useOriginal({
    workspaceId,
    versionId: file.versionId,
    format,
    mediaType: file.effectiveMediaType,
    sizeBytes: file.sizeBytes,
  });
  const [downloading, setDownloading] = useState(false);
  const focus = parseLineRange(address.lines);
  const page = address.page ?? null;

  // A view built from the parse, offered beside the original's own form: [Original | Rebuilt], [Documentation | Code].
  const view = readingViewOf(format);
  const viewUnavailable =
    view === null
      ? null
      : generation === null
        ? t(
            "documents.read.viewNeedsProcessing",
            "Process this version: this view is built from what processing understood of it.",
          )
        : generation.state === "PURGED"
          ? t(
              "documents.read.viewPurged",
              "This version's parse was purged; process it again to read it this way.",
            )
          : null;
  const opensView =
    view !== null && view.opensFirst && viewUnavailable === null && focus === null && page === null;
  const mode =
    address.view ??
    (view === null ? defaultReadingMode(format, focus) : opensView ? view.key : view.original.key);
  const sourceText =
    original.status === "ready" && original.content.form === "text" && !original.content.cut
      ? original.content.text
      : null;

  const download = async () => {
    setDownloading(true);
    try {
      await downloadFile(workspaceId, file);
    } finally {
      setDownloading(false);
    }
  };
  const downloadButton = (
    <Button variant="quiet" icon="download" disabled={downloading} onClick={() => void download()}>
      {downloading ? t("common.saving", "Saving…") : t("documents.read.download", "Download")}
    </Button>
  );

  if (original.status === "loading") {
    return <Waiting label={t("documents.read.reading", "Reading the original")} lines={8} />;
  }
  if (original.status === "failed") {
    return <ProblemState layout="section" problem={original.problem} />;
  }
  if (original.status === "skipped") {
    return (
      <EmptyState
        title={
          original.reason === "too-large"
            ? t("documents.read.tooLarge", "Too large to read here")
            : t("documents.read.cannotShow", "This kind of file cannot be shown here")
        }
        description={
          original.reason === "too-large"
            ? t("documents.read.tooLargeDescription", "{name} is {size}; download it to read it.", {
                name: file.name,
                size: formatBytes(file.sizeBytes),
              })
            : t(
                "documents.read.cannotShowDescription",
                "{name} is {type}. Download it to open it with an application that reads it.",
                { name: file.name, type: file.effectiveMediaType },
              )
        }
        action={downloadButton}
      />
    );
  }

  const lineCount = original.content.form === "text" ? countLines(original.content.text) : null;
  const facts = (
    <>
      <span>{format.description}</span>
      {lineCount !== null && (
        <span className="numeric">
          {plural("documents.read.lines", lineCount, {
            one: "{count} line",
            other: "{count} lines",
          })}
        </span>
      )}
      <span className="numeric">{formatBytes(file.sizeBytes)}</span>
      {focus !== null && (
        <span className="numeric">
          {t("documents.read.citedLines", "Cited lines {start}–{end}", {
            start: focus.start,
            end: focus.end,
          })}
        </span>
      )}
      {page !== null && format.kind === "pdf" && (
        <span className="numeric">
          {t("documents.read.citedPage", "Cited page {page}", { page })}
        </span>
      )}
    </>
  );

  const showLines = (range: LineRange) => {
    onAddressChange({ view: view?.original.key ?? "source", lines: `${range.start}-${range.end}` });
  };
  const showPage = (shownPage: number) => {
    onAddressChange({ view: view?.original.key, page: shownPage });
  };
  const viewSwitch =
    view === null
      ? undefined
      : (() => {
          const derived = {
            value: view.key,
            label: labelOf(view.label),
            disabled: viewUnavailable !== null,
            title: viewUnavailable ?? undefined,
          };
          const own = { value: view.original.key, label: labelOf(view.original.label) };
          return view.opensFirst ? [derived, own] : [own, derived];
        })();
  const viewSurface =
    view !== null && mode === view.key && viewUnavailable === null && generation !== null ? (
      <view.Surface
        workspaceId={workspaceId}
        documentId={documentId}
        versionId={file.versionId}
        format={format}
        generation={generation}
        sourceText={sourceText}
        documentPath={documentPath}
        onShowLines={showLines}
        onShowPage={showPage}
      />
    ) : undefined;

  return (
    <OriginalReader
      name={file.name}
      format={format}
      content={original.content}
      mode={mode}
      onModeChange={(next) =>
        onAddressChange({ view: next, lines: address.lines, page: address.page })
      }
      focus={focus}
      page={page}
      views={viewSwitch}
      viewSurface={viewSurface}
      facts={facts}
      actions={downloadButton}
    />
  );
}
