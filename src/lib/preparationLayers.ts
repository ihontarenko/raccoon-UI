// The layers a document passes through between its parser and its index — the interface's copy of the server's
// `processing/PreparationLayer`, in the same order. A layer is on and works, or off and passes its input on unchanged;
// a mandatory one is always on. A profile stores only the layers it switched off, in `preparation.layersOff`.

import { declareText, type DeclaredText } from "../translations/translate";
import type { RuleStage } from "./ruleSets";

export interface PreparationLayer {
  identifier: string;
  mandatory: boolean;
  /** The rule stage a rule layer runs, or null for a layer that is not made of rules. */
  ruleStage: RuleStage | null;
  name: DeclaredText;
  /** What the layer does, in one sentence. */
  does: DeclaredText;
  /** What it does when switched off; empty for a mandatory layer. */
  whenOff: DeclaredText | null;
  /** Where the layer's mechanism is explained and its own settings live. */
  page: string;
}

export const PREPARATION_LAYERS: PreparationLayer[] = [
  {
    identifier: "read",
    mandatory: true,
    ruleStage: null,
    name: declareText("layers.read.name", "Read"),
    does: declareText("layers.read.does", "A parser reads the original into blocks: lines and headings, or logical units — paragraphs, list items, table rows, declarations, entries."),
    whenOff: null,
    page: "/parsers",
  },
  {
    identifier: "block-rules",
    mandatory: false,
    ruleStage: "BLOCKS",
    name: declareText("layers.blockRules.name", "Rules for blocks"),
    does: declareText("layers.blockRules.does", "Each block — paragraph, list item, table row, heading, declaration, page furniture — is kept, dropped or rewritten by the bound rule sets, before anything is cut."),
    whenOff: declareText("layers.blockRules.whenOff", "Every block goes on as the parser read it."),
    page: "/rules",
  },
  {
    identifier: "cut",
    mandatory: true,
    ruleStage: null,
    name: declareText("layers.cut.name", "Cut into chunks"),
    does: declareText("layers.cut.does", "The profile's chain of chunkers cuts the document: the first that accepts it cuts it — logical units for a document whose parser emitted them, a window chunker for anything — and the ones before it pass it on."),
    whenOff: null,
    page: "/chunking",
  },
  {
    identifier: "index-text",
    mandatory: false,
    ruleStage: null,
    name: declareText("layers.indexText.name", "Compose index text"),
    does: declareText("layers.indexText.does", "The text indexed for a chunk gains its heading path, the table's title and header, its page and the document's identity."),
    whenOff: declareText("layers.indexText.whenOff", "A chunk is indexed as its own slice — a title word no longer matches every chunk of a document."),
    page: "/chunking",
  },
  {
    identifier: "chunk-rules",
    mandatory: false,
    ruleStage: "CHUNKS",
    name: declareText("layers.chunkRules.name", "Rules for chunks"),
    does: declareText("layers.chunkRules.does", "Each chunk is kept, dropped or rewritten by the bound rule sets."),
    whenOff: declareText("layers.chunkRules.whenOff", "Every chunk goes on as cut."),
    page: "/rules",
  },
  {
    identifier: "embedding-text-rules",
    mandatory: false,
    ruleStage: "EMBEDDING_TEXT",
    name: declareText("layers.embeddingTextRules.name", "Rules for vector text"),
    does: declareText("layers.embeddingTextRules.does", "The text vectors are made of is rewritten — normalised, replaced by pattern."),
    whenOff: declareText("layers.embeddingTextRules.whenOff", "Vectors are made of the chunk text as it is."),
    page: "/rules",
  },
  {
    identifier: "keyword-text-rules",
    mandatory: false,
    ruleStage: "KEYWORD_TEXT",
    name: declareText("layers.keywordTextRules.name", "Rules for keyword text"),
    does: declareText("layers.keywordTextRules.does", "The text keyword entries are built from is rewritten — normalised, replaced, listed words removed."),
    whenOff: declareText("layers.keywordTextRules.whenOff", "Keyword entries are built from the chunk text as it is."),
    page: "/rules",
  },
];

/** The layers a profile switched off, as its configuration stores them. */
export function layersOffOf(configuration: Record<string, unknown>): string[] {
  const preparation = configuration.preparation as { layersOff?: unknown } | undefined;
  return Array.isArray(preparation?.layersOff) ? (preparation.layersOff as string[]) : [];
}

/** The configuration with one layer switched on or off. */
export function withLayer(configuration: Record<string, unknown>, identifier: string, on: boolean): Record<string, unknown> {
  const preparation = (configuration.preparation ?? {}) as Record<string, unknown>;
  const off = new Set(layersOffOf(configuration));
  if (on) {
    off.delete(identifier);
  } else {
    off.add(identifier);
  }
  const ordered = PREPARATION_LAYERS.map((layer) => layer.identifier).filter((layer) => off.has(layer));
  return { ...configuration, preparation: { ...preparation, layersOff: ordered } };
}
