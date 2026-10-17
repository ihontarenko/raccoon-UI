// Typed mirror of the backend's source-management contracts: scanners and their runs, rule scripts, and the
// preview of what a source's rule sets take at the door. The rules themselves are in `ruleSets.ts`. Field names follow the server's
// records exactly so responses map without translation.

import type { JobView } from "./contracts";

export type ScanOutcome = "INCLUDE" | "SKIP" | "REVIEW";

/** What a scan records for a file — a rule outcome, or why the file never reached the rules. */
export type ItemOutcome =
  | ScanOutcome
  | "ERROR"
  | "EXCLUDED_FOLDER"
  | "DEPTH_LIMIT"
  | "SYMLINK"
  | "SPECIAL_FILE"
  | "EMPTY_FILE"
  | "FILE_BYTE_LIMIT"
  | "TOTAL_BYTE_LIMIT"
  | "REMOVED_DOCUMENT"
  | "UNCHANGED"
  | "RESTORED"
  | "EMPTY_PAGE"
  | "PAGE_BYTE_LIMIT"
  | "REMOTE_NOT_FOUND"
  | "REMOTE_UNREADABLE";

export interface ScannerView {
  id: string;
  name: string;
  enabled: boolean;
  maximumDepth: number;
  revision: number;
}

export interface ScannerBindingView {
  id: string;
  scannerId: string;
  sourceId: string;
  enabled: boolean;
  revision: number;
  activeJobId: string | null;
  checkpointAt: string | null;
}

export interface ScannerRunView {
  job: JobView;
  bindingId: string;
  /** Null until discovery has finished. */
  discoveredCount: number | null;
  cursor: number;
  includedCount: number;
  skippedCount: number;
  totalBytes: number;
  /** What rule scripts remembered, by script version document, then by variable. */
  ruleVariables: Record<string, Record<string, unknown>>;
  /** For a git or web source: the commit checked out, or the moment its pages were fetched. */
  snapshotRevision: string | null;
  /** What the snapshot did: the branch and commit, or the pages fetched and refused with the reason. */
  snapshotDetail: Record<string, unknown>;
}

export interface ScannerRunItem {
  number: number;
  path: string;
  outcome: ItemOutcome;
  evaluationId: string | null;
  versionId: string | null;
}

export interface RulePreviewItem {
  path: string;
  outcome: ItemOutcome | "ERROR";
  /** The rule that decided, or null when the default action did. */
  decidedBy: string | null;
  reason: string | null;
}

export interface RulePreview {
  discovered: number;
  outcomes: Partial<Record<ItemOutcome, number>>;
  items: RulePreviewItem[];
  scriptVariables: Record<string, Record<string, unknown>>;
}

export interface ScriptView {
  id: string;
  title: string;
  stage: string;
  draftDocumentId: string;
  revision: number;
  activeVersionId: string | null;
  source: string;
  bindState: "BOUND" | "REFUSED" | string;
  bindProblem: string | null;
}

/** The kind of script a source rule runs — never an event stage. */
export const RULE_SCRIPT_STAGE = "scanRule";
/** The kind of a content rule script: run by a processing profile's content pipeline once per block or chunk, never an event. */
export const CONTENT_RULE_SCRIPT_STAGE = "contentRule";
