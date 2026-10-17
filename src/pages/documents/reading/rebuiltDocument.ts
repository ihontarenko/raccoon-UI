// A laid-out original rebuilt from its parse as plain document structure: what the parser understood and the content
// pipeline kept, in reading order, nothing else. Built from the block model only — never from HTML — so the view that
// draws it creates every element itself and nothing from the original is ever injected as markup.

import type { Figure, ListEntry, StructuredDocument, TableCell, TableRow } from "../../../lib/pipeline";
import { pageAtOffset, textOfBlock } from "./parsedOriginal";

/** One piece of the rebuilt document; `index` is the first block's position among the parser's, its address. */
export type RebuiltNode =
  | { kind: "page"; page: number }
  | { kind: "heading"; index: number; level: number; text: string }
  | { kind: "paragraph"; index: number; text: string }
  | { kind: "caption"; index: number; text: string }
  | { kind: "quote"; index: number; text: string }
  | { kind: "code"; index: number; text: string }
  | { kind: "list"; index: number; ordered: boolean; items: RebuiltItem[] }
  | { kind: "contents"; index: number; items: RebuiltItem[] }
  | { kind: "table"; index: number; table: RebuiltTable }
  | { kind: "figure"; index: number; figure: Figure };

export interface RebuiltItem {
  index: number;
  text: string;
  /** The lists nested under this item, deeper levels of a laid-out list. */
  children?: RebuiltList[];
}

export type RebuiltList = Extract<RebuiltNode, { kind: "list" }>;

/** A table: its title, its columns, and each row's cells laid under them. */
export interface RebuiltTable {
  title: string | null;
  page: number;
  columns: string[];
  rows: RebuiltRow[];
}

export interface RebuiltRow {
  index: number;
  cells: RebuiltCell[];
}

/** A cell under a column, or across all of them; `filled` when its value was filled down from a merged cell above. */
export interface RebuiltCell {
  values: TableCell[];
  span: number;
}

const LIST_MARKER = /^(?:[•●▪◦■□∙·\-–—*-]|\(?\d{1,2}[.)]|\(?[a-z][.)]|\(?[ivx]{1,4}\))\s+/u;
const ORDERED_MARKER = /^\(?(?:\d{1,2}|[a-z]|[ivx]{1,4})[.)]\s+/u;
const DOT_LEADER = /(?:\.\s?){3,}\s*\d*\s*$/u;

/**
 * The document rebuilt: pages marked where they change, consecutive list items as one list, a table's rows as one table.
 * Page furniture never appears — the document's identity names it once — and neither does anything the pipeline dropped.
 */
export function rebuildDocument(document: StructuredDocument, dropped: ReadonlySet<number>): RebuiltNode[] {
  const nodes: RebuiltNode[] = [];
  const source = document.sourceText;
  let currentPage: number | null = null;
  // The list being read, outermost first: one entry per level a laid-out list's items have reached.
  let openLists: RebuiltList[] = [];
  let openContents: Extract<RebuiltNode, { kind: "contents" }> | null = null;
  let openTable: { number: number; node: Extract<RebuiltNode, { kind: "table" }> } | null = null;

  const close = () => {
    openLists = [];
    openContents = null;
    openTable = null;
  };

  document.blocks.forEach((block, index) => {
    if (dropped.has(index) || block.kind === "PAGE_FURNITURE") {
      return;
    }
    const page = pageAtOffset(document, block.startOffset);
    if (page !== null && page !== currentPage) {
      currentPage = page;
      close();
      nodes.push({ kind: "page", page });
    }
    const text = textOfBlock(block, source).trim();
    switch (block.kind) {
      case "HEADING":
        close();
        nodes.push({ kind: "heading", index, level: Math.min(6, Math.max(1, block.headingLevel)), text });
        return;
      case "LIST_ITEM": {
        const entry = block.list;
        const level = Math.max(1, entry?.level ?? 1);
        const ordered = entry === undefined ? ORDERED_MARKER.test(text) : entry.marker === "NUMBERED";
        const root = openLists[0];
        if (root === undefined || (level === 1 && root.ordered !== ordered)) {
          close();
          const opened: RebuiltList = { kind: "list", index, ordered, items: [] };
          nodes.push(opened);
          openLists = [opened];
        }
        while (openLists.length > level) {
          openLists.pop();
        }
        // A deeper item opens a list under the last item of the level above; with no item there it stays at that level.
        while (openLists.length < level) {
          const parent = openLists[openLists.length - 1]?.items.at(-1);
          if (parent === undefined) {
            break;
          }
          const nested: RebuiltList = { kind: "list", index, ordered, items: [] };
          (parent.children ??= []).push(nested);
          openLists.push(nested);
        }
        openLists[openLists.length - 1]?.items.push({ index, text: itemText(text, entry) });
        return;
      }
      case "TABLE_OF_CONTENTS": {
        if (openContents === null) {
          close();
          openContents = { kind: "contents", index, items: [] };
          nodes.push(openContents);
        }
        openContents.items.push({ index, text: text.replace(DOT_LEADER, "").trim() });
        return;
      }
      case "TABLE_ROW": {
        const row = block.table;
        if (row === undefined) {
          return;
        }
        if (openTable === null || openTable.number !== row.tableNumber) {
          close();
          openTable = { number: row.tableNumber, node: { kind: "table", index, table: { title: row.title, page: row.page, columns: row.header, rows: [] } } };
          nodes.push(openTable.node);
        }
        if (!row.headerRow) {
          openTable.node.table.rows.push({ index, cells: cellsUnder(row, openTable.node.table.columns) });
        }
        return;
      }
      case "FIGURE":
        close();
        if (block.figure !== undefined) {
          nodes.push({ kind: "figure", index, figure: block.figure });
        }
        return;
      case "CAPTION":
        close();
        nodes.push({ kind: "caption", index, text });
        return;
      case "QUOTE":
        close();
        nodes.push({ kind: "quote", index, text });
        return;
      case "CODE":
        close();
        nodes.push({ kind: "code", index, text: source.slice(block.startOffset, block.endOffset) });
        return;
      default:
        close();
        if (text.length > 0) {
          nodes.push({ kind: "paragraph", index, text });
        }
    }
  });
  return nodes;
}

/**
 * A list item's own text: a laid-out item's content carries the items it is nested under, «Output › 720 source outputs»,
 * which its place in the nested list already shows; an item of any other parser carries its marker in its text.
 */
function itemText(text: string, entry: ListEntry | undefined): string {
  if (entry === undefined) {
    return text.replace(LIST_MARKER, "");
  }
  if (entry.context === undefined) {
    return text;
  }
  const prefix = `${entry.context} › `;
  return text.startsWith(prefix) ? text.slice(prefix.length) : text;
}

/**
 * A row's cells laid under its table's columns: each cell under the column its header names, cells sharing a column
 * kept together; a row whose cells name no column — a note across the table — spans all of them.
 */
function cellsUnder(row: TableRow, columns: string[]): RebuiltCell[] {
  if (columns.length === 0) {
    return row.cells.map((cell) => ({ values: [cell], span: 1 }));
  }
  const placed = columns.map<TableCell[]>(() => []);
  const loose: TableCell[] = [];
  for (const cell of row.cells) {
    const column = cell.header === null ? -1 : columns.indexOf(cell.header);
    if (column < 0) {
      loose.push(cell);
    } else {
      placed[column]?.push(cell);
    }
  }
  if (placed.every((values) => values.length === 0)) {
    return [{ values: loose, span: columns.length }];
  }
  // A cell under no column — the row's own label, «Register Availability» — stands in the first empty column.
  for (const cell of loose) {
    const empty = placed.findIndex((values) => values.length === 0);
    (placed[empty < 0 ? 0 : empty] ?? []).push(cell);
  }
  return placed.map((values) => ({ values, span: 1 }));
}
