import type { EntryUnit, TableUnit, UnitMerging } from "../../lib/chunkers";
import { declareText, type DeclaredText } from "../../translations/translate";

// The chunk settings' codes in words, for the chunking pages: what a person reads instead of AS_PARSED or ROW_GROUP.

export const UNIT_MERGING: Record<UnitMerging, DeclaredText> = {
  AS_PARSED: declareText("chunking.unitMerging.asParsed", "As parsed"),
  MERGE_SMALL: declareText("chunking.unitMerging.mergeSmall", "Merge small"),
};

export const ENTRY_UNIT: Record<EntryUnit, DeclaredText> = {
  VALUE: declareText("chunking.entryUnit.value", "Value"),
  OBJECT: declareText("chunking.entryUnit.object", "Object"),
  GROUP: declareText("chunking.entryUnit.group", "Group"),
};

export const TABLE_UNIT: Record<TableUnit, DeclaredText> = {
  TABLE: declareText("chunking.tableUnit.table", "Table"),
  ROW_GROUP: declareText("chunking.tableUnit.rowGroup", "Row group"),
  ROW: declareText("chunking.tableUnit.row", "Row"),
  CELL: declareText("chunking.tableUnit.cell", "Cell"),
};
