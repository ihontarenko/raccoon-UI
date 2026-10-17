// The kinds of block a parser hands the chunk step, in words — shared by the Parsers and Chunking pages.

import { declareText, type DeclaredText } from "../translations/translate";
import type { BlockKind } from "./pipeline";

export const BLOCK_KIND: Record<BlockKind, DeclaredText> = {
  TEXT: declareText("chunking.blockKind.text", "lines of text"),
  HEADING: declareText("chunking.blockKind.heading", "headings"),
  CODE: declareText("chunking.blockKind.code", "fenced code"),
  DECLARATION: declareText("chunking.blockKind.declaration", "declarations"),
  ENTRY: declareText("chunking.blockKind.entry", "entries by path"),
  PARAGRAPH: declareText("chunking.blockKind.paragraph", "paragraphs"),
  LIST_ITEM: declareText("chunking.blockKind.listItem", "list items"),
  TABLE_ROW: declareText("chunking.blockKind.tableRow", "table rows with their header"),
  CAPTION: declareText("chunking.blockKind.caption", "captions"),
  PAGE_FURNITURE: declareText("chunking.blockKind.pageFurniture", "page headers and footers"),
  QUOTE: declareText("chunking.blockKind.quote", "quotes"),
  FIGURE: declareText("chunking.blockKind.figure", "figures with their labels"),
  TABLE_OF_CONTENTS: declareText("chunking.blockKind.tableOfContents", "table-of-contents lines"),
};
