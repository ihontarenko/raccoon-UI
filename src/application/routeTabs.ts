// The tabs each page keeps in its address. They live here, apart from the pages, so the router can
// validate a `?tab=` without importing the page itself — which would pull every page into the first
// download instead of loading each when it is opened.

/** A document's tabs in the order processing runs: the original, how it was parsed, the chunks it was cut into. */
export type DocumentTab = "read" | "text" | "chunks" | "trace" | "versions" | "origin" | "journal";
export const DOCUMENT_TABS: DocumentTab[] = ["read", "text", "chunks", "trace", "versions", "origin", "journal"];

/** Reads a document tab from the address; the retired «Index entries» tab lives in «Chunks» now, and old links open it. */
export function documentTabOf(value: unknown): DocumentTab | undefined {
  return value === "entries" ? "chunks" : tabOf(DOCUMENT_TABS, value);
}

/** How the Read tab shows the original, where it can be read more than one way. */
export type DocumentReadingView =
  "rendered" | "source" | "documentation" | "code" | "original" | "rebuilt" | "paths";
export const DOCUMENT_READING_VIEWS: DocumentReadingView[] = [
  "rendered",
  "source",
  "documentation",
  "code",
  "original",
  "rebuilt",
  "paths",
];

/** A document's address: the version, the tab, and for the Read tab what to read and where to look. */
export interface DocumentSearch {
  version?: string;
  tab?: DocumentTab;
  view?: DocumentReadingView;
  /** Cited lines, `12-30` or `12`. */
  lines?: string;
  /** A cited page of a PDF, from 1. */
  page?: number;
}

/** Reads a positive whole number from the address, or nothing. */
export function pageOf(value: unknown): number | undefined {
  const number =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

export type IndexTab = "documents" | "entries" | "history" | "vectors" | "preflights" | "journal";
export const INDEX_TABS: IndexTab[] = [
  "documents",
  "entries",
  "history",
  "vectors",
  "preflights",
  "journal",
];

export type AutomationTab = "scripts" | "groups" | "schedules" | "evaluations" | "log" | "examples";
export const AUTOMATION_TABS: AutomationTab[] = [
  "scripts",
  "groups",
  "schedules",
  "evaluations",
  "log",
  "examples",
];

export type QualityTab = "evaluation" | "retrieval";
export const QUALITY_TABS: QualityTab[] = ["evaluation", "retrieval"];

export type ActivityTab = "searches" | "context" | "answers" | "reads" | "calls" | "reranks";
export const ACTIVITY_TABS: ActivityTab[] = [
  "searches",
  "context",
  "answers",
  "reads",
  "calls",
  "reranks",
];

export type SourceTab = "documents" | "rules" | "scans" | "indexing";
export const SOURCE_TABS: SourceTab[] = ["documents", "rules", "scans", "indexing"];

/** Reads a tab from the address, or nothing when it names no tab of the page. */
export function tabOf<Tab extends string>(tabs: readonly Tab[], value: unknown): Tab | undefined {
  return tabs.find((tab) => tab === value);
}

export type ParserTab = "profiles";
export const PARSER_TABS: ParserTab[] = ["profiles"];

export type ChunkerTab = "profiles" | "preview";
export const CHUNKER_TABS: ChunkerTab[] = ["profiles", "preview"];

/** A rule set's tabs after «Rules», which is the page itself. */
export type RuleSetTab = "bindings" | "history" | "dropped";
export const RULE_SET_TABS: RuleSetTab[] = ["bindings", "history", "dropped"];
