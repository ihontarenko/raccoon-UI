import { useDeferredValue, useId, useMemo, useState } from "react";
import { formatNumber } from "../../../application/format";
import { useTranslation } from "../../../translations/TranslationProvider";
import { Notice, ProblemState, Waiting } from "../../../ui/components";
import { Button, Input, Table } from "../../../ui/primitives";
import { droppedBlockIndexes, useParsedOriginal } from "./parsedOriginal";
import type { ReadingViewProperties } from "./readingViews";

/*
 * Paths: one row per value under its full path, dense and monospaced; the values one entry carries
 * sit together — no rule between them and a tighter step, the rule only where the entry ends.
 *
 * ⚠️ THE THREE OVERRIDES ARE MARKED IMPORTANT, AND THEY HAVE TO BE. `rc-table` in
 * `styles/components.css` is unlayered component CSS, which outranks every Tailwind utility whatever
 * the selector weight; padding and the bottom rule are exactly what it sets on a cell. `align-top`
 * needs no marker, because nothing sets vertical-align on an ordinary cell.
 */
const ENTRY_TABLE = [
  "[&_td]:align-top",
  "[&_tbody_tr[data-entry-continues=true]_td]:border-b-transparent!",
  "[&_tbody_tr[data-entry-continues=true]_td]:pb-[calc(3px*var(--ui-scale))]!",
  "[&_tbody_tr[data-opens-entry=false]_td]:pt-[calc(3px*var(--ui-scale))]!",
].join(" ");

const MONO_TEXT = "font-mono text-xs whitespace-normal [overflow-wrap:anywhere]";

const PATH_CELL = [
  "w-[50%] min-w-[calc(180px*var(--ui-scale))]",
  "[&_code]:font-mono [&_code]:text-xs [&_code]:whitespace-normal [&_code]:text-ink",
  "[&_code]:[overflow-wrap:anywhere]",
].join(" ");

const LINE_LINK = [
  "cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-xs text-accent-text underline",
  "[text-decoration-color:var(--line-strong)] [text-underline-offset:2px]",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text",
].join(" ");

/** Rows drawn at once; a large data file is drawn on as the reader asks. */
const ROWS_SHOWN = 300;

/** What separates a value's full path from the value in an entry's indexed text: `$.compilerOptions.module = ESNext`. */
const VALUE_SEPARATOR = " = ";

/**
 * One value: its full path, the value, and the entry that carries it — the entry's path, its comment and its lines in the
 * source are shared by every value it holds.
 */
interface PathValue {
  key: string;
  entryIndex: number;
  entryPath: string;
  path: string;
  value: string;
  comment: string | null;
  startLine: number;
  endLine: number;
}

/**
 * Structured data as the parser labelled it: one row per value under its full path, in document order — exactly what
 * keyword search and vectors read — filterable by path or value. Values one entry carries sit together without a rule
 * between them, so the grouping is visible but never shortens a path. A row opens the source at its entry's lines.
 */
export function PathsView({ workspaceId, documentId, generation, onShowLines }: ReadingViewProperties) {
  const { t, plural } = useTranslation();
  const filterId = useId();
  const parsed = useParsedOriginal(workspaceId, documentId, generation);
  const [filter, setFilter] = useState("");
  const [shown, setShown] = useState(ROWS_SHOWN);
  const deferredFilter = useDeferredValue(filter);

  const values = useMemo<PathValue[]>(() => {
    if (parsed.status !== "ready") {
      return [];
    }
    const dropped = droppedBlockIndexes(parsed.data.outcome);
    const result: PathValue[] = [];
    parsed.data.document.blocks.forEach((block, index) => {
      const entryPath = block.structure?.symbol.symbolId ?? null;
      if (block.kind !== "ENTRY" || entryPath === null || dropped.has(index)) {
        return;
      }
      const { leaves, comment } = readEntry(entryPath, block.content ?? "");
      leaves.forEach((leaf, position) => {
        result.push({
          key: `${index}:${position}`,
          entryIndex: index,
          entryPath,
          path: leaf.path,
          value: leaf.value,
          comment,
          startLine: block.startLine,
          endLine: block.endLine,
        });
      });
    });
    return result;
  }, [parsed]);

  const visible = useMemo(() => {
    const needle = deferredFilter.trim().toLocaleLowerCase();
    if (needle === "") {
      return values;
    }
    return values.filter((value) => value.path.toLocaleLowerCase().includes(needle) || value.value.toLocaleLowerCase().includes(needle));
  }, [values, deferredFilter]);

  if (parsed.status === "loading") {
    return <Waiting label={t("documents.paths.loading", "Reading the entries")} lines={8} />;
  }
  if (parsed.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={parsed.problem}
        actions={
          <Button icon="refresh" onClick={parsed.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }
  if (values.length === 0) {
    return (
      <Notice title={t("documents.paths.none", "No entries")}>
        {parsed.data.document.structureFallback !== undefined && parsed.data.document.structureFallback !== null
          ? t("documents.paths.fallback", "The parser read this original as plain text: {detail}", {
              detail: parsed.data.document.structureFallback.detail ?? parsed.data.document.structureFallback.reason,
            })
          : t("documents.paths.noneDescription", "This parse holds no structured entries. Process it with the XML or JSON parser.")}
      </Notice>
    );
  }

  const rows = visible.slice(0, shown);
  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label htmlFor={filterId} className="text-sm text-secondary">
          {t("documents.paths.filter", "Filter")}
        </label>
        <Input
          id={filterId}
          type="search"
          className="min-w-0 flex-[0_1_calc(320px*var(--ui-scale))]"
          value={filter}
          placeholder={t("documents.paths.filterPlaceholder", "Path or value")}
          onChange={(event) => {
            setFilter(event.target.value);
            setShown(ROWS_SHOWN);
          }}
        />
        <span className="numeric ml-auto text-xs text-muted" aria-live="polite">
          {visible.length === values.length
            ? plural("documents.paths.values", values.length, { one: "{count} value", other: "{count} values" })
            : t("documents.paths.valuesOf", "{shown} of {total} values", { shown: formatNumber(visible.length), total: formatNumber(values.length) })}
        </span>
      </div>
      <Table className={ENTRY_TABLE}>
        <thead>
          <tr>
            <th scope="col">{t("documents.paths.path", "Path")}</th>
            <th scope="col">{t("documents.paths.value", "Value")}</th>
            <th scope="col" className="numeric">
              {t("documents.paths.lines", "Lines")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, position) => {
            const opensEntry = position === 0 || rows[position - 1].entryIndex !== row.entryIndex;
            const entryContinues = position + 1 < rows.length && rows[position + 1].entryIndex === row.entryIndex;
            return (
              <tr key={row.key} data-opens-entry={opensEntry} data-entry-continues={entryContinues}>
                <td className={PATH_CELL}>
                  <PathText path={row.path} entryPath={row.entryPath} />
                </td>
                <td className="text-sm whitespace-normal [overflow-wrap:anywhere]">
                  <span className={MONO_TEXT}>{row.value}</span>
                  {opensEntry && row.comment !== null && <span className="mt-1 block text-xs text-muted italic">{row.comment}</span>}
                </td>
                <td className="numeric">
                  {opensEntry && (
                    <button type="button" className={LINE_LINK} onClick={() => onShowLines({ start: row.startLine, end: row.endLine })}>
                      {row.startLine === row.endLine ? row.startLine : `${row.startLine}–${row.endLine}`}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {visible.length > shown && (
        <div className="flex justify-center">
          <Button onClick={() => setShown((current) => current + ROWS_SHOWN)}>
            {t("documents.paths.showMore", "Show {count} more", { count: formatNumber(Math.min(ROWS_SHOWN, visible.length - shown)) })}
          </Button>
        </div>
      )}
    </div>
  );
}

/** A full path, the entry's own path set back so the step that names the value stands out — the whole path still there. */
function PathText({ path, entryPath }: { path: string; entryPath: string }) {
  if (path === entryPath || !path.startsWith(entryPath) || entryPath === "/" || entryPath === "$") {
    return <code>{path}</code>;
  }
  return (
    <code>
      <span className="text-secondary">{entryPath}</span>
      {path.slice(entryPath.length)}
    </code>
  );
}

/**
 * An entry's indexed text read back into its values: each line `full.path = value` (or the path alone when only keys are
 * indexed) is a value, every other line is the comment before the entry. A parse made before full paths — first line
 * `path : value` — is one value as it was written.
 */
function readEntry(entryPath: string, content: string): { leaves: { path: string; value: string }[]; comment: string | null } {
  const lines = content.split("\n");
  const legacyPrefix = `${entryPath} : `;
  if (lines[0]?.startsWith(legacyPrefix)) {
    const rest = lines.slice(1).join(" ").trim();
    return { leaves: [{ path: entryPath, value: lines[0].slice(legacyPrefix.length) }], comment: rest === "" ? null : rest };
  }
  const pathRoot = entryPath === "/" ? "" : entryPath;
  const leaves: { path: string; value: string }[] = [];
  const commentLines: string[] = [];
  for (const line of lines) {
    if (!line.startsWith(pathRoot) || line.trim() === "") {
      commentLines.push(line);
      continue;
    }
    const separator = line.indexOf(VALUE_SEPARATOR, pathRoot.length);
    if (separator >= 0) {
      leaves.push({ path: line.slice(0, separator), value: line.slice(separator + VALUE_SEPARATOR.length) });
    } else if (!/\s/.test(line)) {
      leaves.push({ path: line, value: "" });
    } else {
      commentLines.push(line);
    }
  }
  if (leaves.length === 0) {
    leaves.push({ path: entryPath, value: "" });
  }
  const comment = commentLines.join(" ").trim();
  return { leaves, comment: comment === "" ? null : comment };
}
