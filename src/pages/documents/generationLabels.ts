import type { CodeLabels } from "../../application/format";
import { declareText } from "../../translations/translate";

/** A lexical index generation's state, as the index generations table allows it — one vocabulary for every screen. */
export const LEXICAL_GENERATION_STATES: CodeLabels = {
  READY: declareText("codes.lexicalGenerationState.ready", "Ready"),
  PUBLISHED: declareText("codes.lexicalGenerationState.published", "Published"),
  WITHDRAWN: declareText("codes.lexicalGenerationState.withdrawn", "Withdrawn"),
  PURGED: declareText("codes.lexicalGenerationState.purged", "Purged"),
};
