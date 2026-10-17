import type { CodeLabels } from "../../application/format";
import type { JobStatus } from "../../lib/contracts";
import type { ItemOutcome } from "../../lib/sourceContracts";
import { declareText, translateDeclared, type DeclaredText } from "../../translations/translate";
import type { BadgeTone } from "../../ui/primitives";

// How a scan's verdict on a file is named and coloured everywhere it appears — the scan history, the
// item list and the rule preview read the same words.

interface OutcomeDescription {
  readonly label: string;
  readonly tone: BadgeTone;
  /** What it means, for a tooltip or a legend. */
  readonly meaning: string;
}

/**
 * An outcome whose words are read in the viewer's language each time they are asked for: the table is built when
 * the module loads, and a plain string would freeze whatever language was held then.
 */
function describedOutcome(tone: BadgeTone, label: DeclaredText, meaning: DeclaredText): OutcomeDescription {
  return {
    tone,
    get label() {
      return translateDeclared(label);
    },
    get meaning() {
      return translateDeclared(meaning);
    },
  };
}

export const OUTCOMES: Record<ItemOutcome, OutcomeDescription> = {
  INCLUDE: describedOutcome(
    "allow",
    declareText("sources.outcome.include", "Taken"),
    declareText("sources.outcome.include.meaning", "Captured as a document version."),
  ),
  SKIP: describedOutcome(
    "deny",
    declareText("sources.outcome.skip", "Skipped"),
    declareText("sources.outcome.skip.meaning", "A rule, or the default action, left it out."),
  ),
  REVIEW: describedOutcome(
    "warn",
    declareText("sources.outcome.review", "For review"),
    declareText("sources.outcome.review.meaning", "A rule asked for a person to decide."),
  ),
  ERROR: describedOutcome(
    "error",
    declareText("sources.outcome.error", "Error"),
    declareText("sources.outcome.error.meaning", "Judging it failed."),
  ),
  EXCLUDED_FOLDER: describedOutcome(
    "deny",
    declareText("sources.outcome.excludedFolder", "Folder left out"),
    declareText("sources.outcome.excludedFolder.meaning", "A rule excluded the whole folder; it was not opened."),
  ),
  DEPTH_LIMIT: describedOutcome(
    "warn",
    declareText("sources.outcome.depthLimit", "Too deep"),
    declareText("sources.outcome.depthLimit.meaning", "Below the scanner's depth limit."),
  ),
  SYMLINK: describedOutcome(
    "neutral",
    declareText("sources.outcome.symlink", "Link"),
    declareText("sources.outcome.symlink.meaning", "Links are never followed."),
  ),
  SPECIAL_FILE: describedOutcome(
    "neutral",
    declareText("sources.outcome.specialFile", "Not a file"),
    declareText("sources.outcome.specialFile.meaning", "A device or other special entry."),
  ),
  EMPTY_FILE: describedOutcome(
    "neutral",
    declareText("sources.outcome.emptyFile", "Empty"),
    declareText("sources.outcome.emptyFile.meaning", "Zero bytes."),
  ),
  FILE_BYTE_LIMIT: describedOutcome(
    "warn",
    declareText("sources.outcome.fileByteLimit", "Too large"),
    declareText("sources.outcome.fileByteLimit.meaning", "Larger than one original may be."),
  ),
  TOTAL_BYTE_LIMIT: describedOutcome(
    "warn",
    declareText("sources.outcome.totalByteLimit", "Over the scan budget"),
    declareText("sources.outcome.totalByteLimit.meaning", "The scan had captured all it may."),
  ),
  REMOVED_DOCUMENT: describedOutcome(
    "deny",
    declareText("sources.outcome.removedDocument", "Removed"),
    declareText(
      "sources.outcome.removedDocument.meaning",
      "Its document was removed from the corpus; restore it to capture this file again.",
    ),
  ),
  UNCHANGED: describedOutcome(
    "neutral",
    declareText("sources.outcome.unchanged", "Unchanged"),
    declareText(
      "sources.outcome.unchanged.meaning",
      "The page's version is the one already captured, so it was not fetched again.",
    ),
  ),
  RESTORED: describedOutcome(
    "allow",
    declareText("sources.outcome.restored", "Back"),
    declareText(
      "sources.outcome.restored.meaning",
      "Its page was gone and is listed again, so its document is back in the corpus; process it to search it again.",
    ),
  ),
  EMPTY_PAGE: describedOutcome(
    "neutral",
    declareText("sources.outcome.emptyPage", "Empty"),
    declareText("sources.outcome.emptyPage.meaning", "The page has no text."),
  ),
  PAGE_BYTE_LIMIT: describedOutcome(
    "warn",
    declareText("sources.outcome.pageByteLimit", "Too large"),
    declareText(
      "sources.outcome.pageByteLimit.meaning",
      "The knowledge base's answer is larger than connector.maximum-response-bytes.",
    ),
  ),
  REMOTE_NOT_FOUND: describedOutcome(
    "warn",
    declareText("sources.outcome.remoteNotFound", "Gone"),
    declareText(
      "sources.outcome.remoteNotFound.meaning",
      "Listed, but no longer served to this connection when it was fetched.",
    ),
  ),
  REMOTE_UNREADABLE: describedOutcome(
    "error",
    declareText("sources.outcome.remoteUnreadable", "Unreadable"),
    declareText(
      "sources.outcome.remoteUnreadable.meaning",
      "The knowledge base answered with something that is not a page.",
    ),
  ),
};

export function outcomeOf(outcome: string): OutcomeDescription {
  return OUTCOMES[outcome as ItemOutcome] ?? { label: outcome, tone: "neutral", meaning: outcome };
}

/** Where a scan's job stands. */
export const SCAN_STATES: CodeLabels = {
  QUEUED: declareText("sources.scanState.queued", "Queued"),
  RUNNING: declareText("sources.scanState.running", "Running"),
  SUCCEEDED: declareText("sources.scanState.succeeded", "Succeeded"),
  FAILED: declareText("sources.scanState.failed", "Failed"),
  CANCELLED: declareText("sources.scanState.cancelled", "Cancelled"),
} satisfies Record<JobStatus, DeclaredText>;
