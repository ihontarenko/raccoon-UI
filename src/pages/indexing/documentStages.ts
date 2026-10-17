import type { DocumentStage } from "../../lib/indexOverview";
import { translate } from "../../translations/translate";
import type { BadgeTone } from "../../ui/primitives";

interface StageDescription {
  readonly label: string;
  readonly tone: BadgeTone;
  readonly meaning: string;
}

/**
 * Each stage as a word and a colour: blue is what search can use, amber what is waiting on a step. The words are
 * getters, so they are read in the viewer's language at the moment a screen draws them.
 */
export const STAGE: Record<DocumentStage, StageDescription> = {
  CAPTURED: {
    get label() {
      return translate("index.stage.captured", "Not processed");
    },
    tone: "neutral",
    get meaning() {
      return translate("index.stage.captured.meaning", "Captured, not cut into chunks yet — search cannot find it.");
    },
  },
  PROCESSED: {
    get label() {
      return translate("index.stage.processed", "Built, not published");
    },
    tone: "warn",
    get meaning() {
      return translate(
        "index.stage.processed.meaning",
        "Its entries exist but search does not read them until they are published.",
      );
    },
  },
  SEARCHABLE: {
    get label() {
      return translate("index.stage.searchable", "Searchable");
    },
    tone: "allow",
    get meaning() {
      return translate(
        "index.stage.searchable.meaning",
        "Keyword search finds it; it has no vectors, so meaning search does not.",
      );
    },
  },
  VECTORISED: {
    get label() {
      return translate("index.stage.vectorised", "Searchable · vectors");
    },
    tone: "allow",
    get meaning() {
      return translate("index.stage.vectorised.meaning", "Found by keywords and by meaning.");
    },
  },
  OUTDATED: {
    get label() {
      return translate("index.stage.outdated", "Older version searched");
    },
    tone: "warn",
    get meaning() {
      return translate(
        "index.stage.outdated.meaning",
        "Search still reads an older version; the latest one is not published.",
      );
    },
  },
};
