import type { EntryOrigin } from "../../lib/pipeline";
import { translate } from "../../translations/translate";
import type { BadgeTone } from "../../ui/primitives";

interface OriginDescription {
  readonly label: string;
  readonly tone: BadgeTone;
  readonly meaning: string;
}

/**
 * Where an index entry came from, in words: a chunk of a document, a person, or a person writing over a
 * chunk. The code names (DERIVED, MANUAL, OVERRIDE) never reach the screen. The words are getters, read in the
 * viewer's language when a screen draws them.
 */
export const ENTRY_ORIGIN: Record<EntryOrigin, OriginDescription> = {
  DERIVED: {
    get label() {
      return translate("index.origin.derived", "From a document");
    },
    tone: "neutral",
    get meaning() {
      return translate("index.origin.derived.meaning", "Made from one chunk when the document was processed.");
    },
  },
  MANUAL: {
    get label() {
      return translate("index.origin.manual", "Written by hand");
    },
    tone: "active",
    get meaning() {
      return translate("index.origin.manual.meaning", "Written directly into the index — not part of any document.");
    },
  },
  OVERRIDE: {
    get label() {
      return translate("index.origin.override", "Replaces a chunk");
    },
    tone: "warn",
    get meaning() {
      return translate(
        "index.origin.override.meaning",
        "Written over one chunk's entry; search finds this text instead.",
      );
    },
  },
};
