import type { Chunk, ReadingOnlyReason } from "../../../lib/pipeline";
import { useTranslation } from "../../../translations/TranslationProvider";
import { IndexedLineView, indexedLineOf } from "./IndexedLine";

/* A chunk card's body: what is indexed leads, the exact source slice is one disclosure away. */

/* The line the chunk is indexed under — its heading path, table title, document and page. */
const CONTEXT_LINE =
  "m-0 [padding:var(--space-2)_var(--space-3)_0] text-xs text-secondary [overflow-wrap:anywhere]";

/* ⚠️ NO FONT SIZE HERE. The indexed body is prose at `text-sm` and code at `text-xs`, and the two
   are named at the call site: a size declared here as well would leave two on one element, settled
   by the order of a generated stylesheet rather than by this file. */
const INDEXED = [
  "m-0 max-h-[calc(320px*var(--ui-scale))] overflow-auto leading-[1.55]",
  "[padding:var(--space-2)_var(--space-3)_var(--space-3)]",
].join(" ");

/* The exact slice, for reading and citation. Open, its summary grows a rule under it. */
const SOURCE_DISCLOSURE = "border-t border-line [&[open]>summary]:border-b [&[open]>summary]:border-line";

const SOURCE_SUMMARY = [
  "flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-xs text-secondary",
  "transition-[color] duration-120 hover:text-ink motion-reduce:transition-none",
].join(" ");

/* Reading-only text stays fully legible: a tint and a rule mark it, the ink is not dimmed. */
const KEPT_FOR_READING = "bg-deny-soft shadow-[inset_2px_0_0_var(--deny)]";

/** Why a part is left out of the index, in words. */
const REASON: Record<ReadingOnlyReason, string> = {
  BODY: "body",
  COMMENT: "comment",
  DOCUMENTATION: "documentation comment",
  CODE_BLOCK: "fenced code",
  VALUE: "value",
};

function reasonWord(reason: string): string {
  return reason in REASON ? REASON[reason as ReadingOnlyReason] : reason.toLowerCase().replace(/_/g, " ");
}

interface Segment {
  text: string;
  indexed: boolean;
  reason: string | null;
}

/** The chunk's exact text cut at its reading-only parts, in order. */
function segmentsOf(chunk: Chunk): Segment[] {
  const parts = chunk.indexing?.readingOnly ?? [];
  const segments: Segment[] = [];
  let cursor = 0;
  for (const part of parts) {
    const start = Math.max(0, part.startOffset - chunk.startOffset);
    const end = Math.min(chunk.text.length, part.endOffset - chunk.startOffset);
    if (start > cursor) {
      segments.push({ text: chunk.text.slice(cursor, start), indexed: true, reason: null });
    }
    if (end > start) {
      segments.push({ text: chunk.text.slice(start, end), indexed: false, reason: part.reason });
    }
    cursor = Math.max(cursor, end);
  }
  if (cursor < chunk.text.length) {
    segments.push({ text: chunk.text.slice(cursor), indexed: true, reason: null });
  }
  return segments;
}

/** The indexed text after the context line, which the card shows on its own. */
function indexedBodyOf(chunk: Chunk): string {
  const indexed = chunk.indexedText ?? chunk.text;
  const context = chunk.indexing?.context ?? null;
  if (context !== null && indexed.startsWith(context)) {
    return indexed.slice(context.length).replace(/^\n/, "");
  }
  return indexed;
}

/** Whether the chunk is source code, whose indexed form is code and reads as it is written. */
function isSourceCode(chunk: Chunk): boolean {
  return chunk.symbol !== null && chunk.symbol.kind !== "ENTRY" && chunk.symbol.kind !== "ENTRIES";
}

/**
 * A chunk as it is indexed — what keyword entries and vectors are built from — with its exact source slice one
 * disclosure away. The indexed form leads: a path with its value, a table row as «Header: value» pairs, a list item
 * under its parents, a section's heading path above its paragraphs, a declaration's JavaDoc and signature. The slice
 * shows what was kept for reading only, shaded; every character of it is still there.
 */
export function ChunkIndexingView({ chunk, textClassName }: { chunk: Chunk; textClassName: string }) {
  const { t } = useTranslation();
  const indexing = chunk.indexing;
  const context = indexing?.context ?? null;
  const body = indexedBodyOf(chunk);
  const segments = segmentsOf(chunk);
  const keptCharacters = segments.filter((segment) => !segment.indexed).reduce((sum, segment) => sum + segment.text.length, 0);
  const reasons = [...new Set((indexing?.readingOnly ?? []).map((part) => reasonWord(part.reason)))];
  const nothingIndexed = body.trim() === "" && context === null;
  const lines = body.split("\n").filter((line) => line.trim() !== "");

  return (
    <>
      {context !== null && (
        <p className={CONTEXT_LINE}>
          <span className="mr-1 text-2xs font-semibold tracking-[0.04em] text-muted uppercase">{t("documents.chunks.context", "Under")}</span> {context}
        </p>
      )}
      {nothingIndexed ? (
        <p className="m-0 px-3 py-2 text-xs font-semibold text-deny">
          {t("documents.chunks.nothingIndexed", "Nothing in this chunk is indexed — search and vectors pass it by.")}
        </p>
      ) : isSourceCode(chunk) ? (
        <pre className={`${INDEXED} font-mono text-xs whitespace-pre-wrap [overflow-wrap:anywhere]`}>
          {body}
        </pre>
      ) : (
        <div className={`${INDEXED} text-sm`}>
          {lines.map((line, index) => (
            <IndexedLineView key={index} line={indexedLineOf(line)} />
          ))}
        </div>
      )}
      <details className={SOURCE_DISCLOSURE}>
        <summary className={SOURCE_SUMMARY}>
          <span>
            {t("documents.chunks.source", "Source text (lines {start}–{end})", { start: chunk.startLine, end: chunk.endLine })}
          </span>
          {keptCharacters > 0 && (
            <span className="text-muted">
              {t("documents.chunks.keptForReading", "kept for reading only: {reasons} · {share}% of the slice", {
                reasons: reasons.join(", "),
                share: Math.round((keptCharacters / chunk.text.length) * 100),
              })}
            </span>
          )}
        </summary>
        <pre className={textClassName}>
          {segments.map((segment, index) =>
            segment.indexed ? (
              <span key={index}>{segment.text}</span>
            ) : (
              <span key={index} className={KEPT_FOR_READING} title={`Kept for reading only: ${reasonWord(segment.reason ?? "")}`}>
                <span className="sr-only">[kept for reading only: {reasonWord(segment.reason ?? "")}] </span>
                {segment.text}
                <span className="sr-only"> [end]</span>
              </span>
            ),
          )}
        </pre>
      </details>
    </>
  );
}
