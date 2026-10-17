import type { RerankReason, RerankState } from "../lib/contracts";
import { SOURCE_LANGUAGE, currentLanguage, declareText, translate, translateDeclared, type DeclaredText } from "../translations/translate";
import type { BadgeTone } from "../ui/primitives";

// How the rerank stage's outcome reads wherever it is shown — a search's results, the activity journal.
// Applied uses the allow tone, a fall-back the warn tone (the search still answered), skipped is neutral.
// The words are declared here and rendered in the viewer's language each time they are read.

/** A rerank reason in the words a person would act on. */
export const RERANK_REASON_TEXT: Record<RerankReason, DeclaredText> = {
  TOO_FEW_CANDIDATES: declareText("rerank.reason.tooFewCandidates", "fewer than two candidates — nothing to reorder"),
  POLICY_REFUSED: declareText("rerank.reason.policyRefused", "a search script refused it"),
  PROVIDER_MISSING: declareText("rerank.reason.providerMissing", "its provider configuration was removed"),
  CAPABILITY_MISSING: declareText("rerank.reason.capabilityMissing", "its provider configuration does not declare RERANK"),
  PROVIDER_NOT_IN_FORCE: declareText("rerank.reason.providerNotInForce", "its provider configuration is not in force"),
  KEY_MISSING: declareText("rerank.reason.keyMissing", "its provider configuration has no key"),
  ENDPOINT_UNKNOWN: declareText("rerank.reason.endpointUnknown", "its provider configuration names no rerank endpoint"),
  MODEL_UNAVAILABLE: declareText("rerank.reason.modelUnavailable", "the rerank protocol does not speak to this provider"),
  CANDIDATE_CHANGED: declareText("rerank.reason.candidateChanged", "a result changed while the search ran"),
  LIMIT: declareText("rerank.reason.limit", "the texts exceed a rerank ceiling"),
  RATE_LIMITED: declareText("rerank.reason.rateLimited", "the provider's admission limit is reached"),
  TIMEOUT: declareText("rerank.reason.timeout", "the reranker did not answer in time"),
  TRANSPORT: declareText("rerank.reason.transport", "the reranker could not be reached"),
  PROVIDER_REFUSED: declareText("rerank.reason.providerRefused", "the provider refused the request"),
  INVALID_RESPONSE: declareText("rerank.reason.invalidResponse", "the reranker's answer could not be used"),
  FAILED: declareText("rerank.reason.failed", "an unexpected failure"),
};

const RERANK_STATE_WORDS: Record<RerankState, { tone: BadgeTone; word: DeclaredText }> = {
  APPLIED: { tone: "allow", word: declareText("rerank.state.applied", "Reranked") },
  FELL_BACK: { tone: "warn", word: declareText("rerank.state.fellBack", "Rerank fell back") },
  SKIPPED: { tone: "neutral", word: declareText("rerank.state.skipped", "Rerank skipped") },
};

/** The tone and the word of a rerank state; `word` is read in the viewer's language at the moment it is used. */
export const RERANK_STATE: Record<RerankState, { tone: BadgeTone; readonly word: string }> = {
  APPLIED: stateOf("APPLIED"),
  FELL_BACK: stateOf("FELL_BACK"),
  SKIPPED: stateOf("SKIPPED"),
};

function stateOf(state: RerankState): { tone: BadgeTone; readonly word: string } {
  return {
    tone: RERANK_STATE_WORDS[state].tone,
    get word() {
      return translateDeclared(RERANK_STATE_WORDS[state].word);
    },
  };
}

export function rerankReasonText(reason: string | null | undefined): string | null {
  if (reason === null || reason === undefined) {
    return null;
  }
  return reason in RERANK_REASON_TEXT
    ? translateDeclared(RERANK_REASON_TEXT[reason as RerankReason])
    : reason.toLowerCase().replaceAll("_", " ");
}

/** "1st", "2nd", "3rd", "11th", "22nd" — for "was 7th". Another language words a position its own way. */
export function ordinal(position: number): string {
  if (currentLanguage() !== SOURCE_LANGUAGE) {
    return translate("rerank.ordinal", "#{position}", { position });
  }
  const lastTwo = position % 100;
  if (lastTwo >= 11 && lastTwo <= 13) {
    return `${position}th`;
  }
  switch (position % 10) {
    case 1:
      return `${position}st`;
    case 2:
      return `${position}nd`;
    case 3:
      return `${position}rd`;
    default:
      return `${position}th`;
  }
}
