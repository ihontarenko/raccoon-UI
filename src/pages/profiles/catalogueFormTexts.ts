import type { CodeLabels } from "../../application/format";
import { declareText, type DeclaredText } from "../../translations/translate";

// The words the catalogue form says about what the server declares. The server describes its parameters with
// paths, codes and English unit words; each table below turns one of those into a text in the viewer's language.
// Anything a table does not list yet stays readable, humanised from the server's own word.

/** A configuration section's title, by its path; "" is the profile's top-level settings. */
export const SECTION_TITLES: CodeLabels = {
  "": declareText("profiles.form.section.general", "General"),
  callLimits: declareText("profiles.form.section.callLimits", "Call limits"),
  tokenizer: declareText("profiles.form.section.tokenizer", "Tokenizer"),
  lexicalQuery: declareText("profiles.form.section.lexicalQuery", "Keyword query"),
  recognition: declareText("profiles.form.section.recognition", "Recognition"),
  retrieval: declareText("profiles.form.section.retrieval", "Retrieval"),
  "retrieval.semantic": declareText("profiles.form.section.retrievalSemantic", "Retrieval · meaning search"),
  "retrieval.fusion": declareText("profiles.form.section.retrievalFusion", "Retrieval · fusion"),
  "retrieval.rerank": declareText("profiles.form.section.retrievalRerank", "Retrieval · rerank"),
  preparation: declareText("profiles.form.section.preparation", "Preparation"),
  "preparation.chunking": declareText("profiles.form.section.preparationChunking", "Preparation · chunking"),
  "preparation.indexing": declareText("profiles.form.section.preparationIndexing", "Preparation · indexing"),
};

/**
 * A parameter the explanation catalogue has no entry for yet: its label and the short help under it. A parameter
 * with an entry takes its label from that entry, and its "About …" button carries the explanation.
 */
export const UNWRITTEN_PARAMETERS: Readonly<Record<string, { title: DeclaredText; hint: DeclaredText }>> = {
  "recognition.parts": {
    title: declareText("profiles.form.parameter.recognitionParts.title", "Part numbers"),
    hint: declareText(
      "profiles.form.parameter.recognitionParts.hint",
      "Part numbers recognised in the query (ILI9341, LM317): BOOST ranks chunks of documents identified as the part first; SCOPE_WHEN_UNAMBIGUOUS also narrows the search to that document when it is the only one; OFF ignores them.",
    ),
  },
  "recognition.symbols": {
    title: declareText("profiles.form.parameter.recognitionSymbols.title", "Symbols"),
    hint: declareText(
      "profiles.form.parameter.recognitionSymbols.hint",
      "Rank first the chunks that contain a symbol recognised in the query (VCI, BeanFactory#getBean) exactly, as a whole token with its case.",
    ),
  },
};

/**
 * The unit beside a parameter's bounds, by the server's word in lower case. Processing profiles send codes
 * ("UNICODE_CODE_POINTS; MUST_BE_LESS_THAN_SIZE"), the others words ("Unicode code points"); both are reduced to
 * lower-case words split on ";" before they are looked up here.
 */
export const PARAMETER_UNITS: CodeLabels = {
  "unicode code points": declareText("profiles.form.unit.unicodeCodePoints", "Unicode code points"),
  "excerpt unicode code points": declareText("profiles.form.unit.excerptUnicodeCodePoints", "excerpt Unicode code points"),
  "utf-16 characters": declareText("profiles.form.unit.utf16Characters", "UTF-16 characters"),
  utf16: declareText("profiles.form.unit.utf16Characters", "UTF-16 characters"),
  bytes: declareText("profiles.form.unit.bytes", "bytes"),
  blocks: declareText("profiles.form.unit.blocks", "blocks"),
  rows: declareText("profiles.form.unit.rows", "rows"),
  tokens: declareText("profiles.form.unit.tokens", "tokens"),
  milliseconds: declareText("profiles.form.unit.milliseconds", "milliseconds"),
  "milliseconds per remote operation": declareText("profiles.form.unit.millisecondsPerRemoteOperation", "milliseconds per remote operation"),
  seconds: declareText("profiles.form.unit.seconds", "seconds"),
  results: declareText("profiles.form.unit.results", "results"),
  candidates: declareText("profiles.form.unit.candidates", "candidates"),
  "fused candidates": declareText("profiles.form.unit.fusedCandidates", "fused candidates"),
  "eligible records": declareText("profiles.form.unit.eligibleRecords", "eligible records"),
  "workspace calls": declareText("profiles.form.unit.workspaceCalls", "workspace calls"),
  "analyzer lexemes": declareText("profiles.form.unit.analyzerLexemes", "analyzer lexemes"),
  "distinct lexemes": declareText("profiles.form.unit.distinctLexemes", "distinct lexemes"),
  fraction: declareText("profiles.form.unit.fraction", "fraction"),
  "positive weight": declareText("profiles.form.unit.positiveWeight", "positive weight"),
  "rank offset": declareText("profiles.form.unit.rankOffset", "rank offset"),
  "native score": declareText("profiles.form.unit.nativeScore", "native score"),
  "native vector distance": declareText("profiles.form.unit.nativeVectorDistance", "native vector distance"),
  "profile pricing currency": declareText("profiles.form.unit.profilePricingCurrency", "profile pricing currency"),
  references: declareText("profiles.form.unit.references", "references"),
  "group references": declareText("profiles.form.unit.groupReferences", "group references"),
  "workspace groups": declareText("profiles.form.unit.workspaceGroups", "workspace groups"),
  identifier: declareText("profiles.form.unit.identifier", "identifier"),
  identifiers: declareText("profiles.form.unit.identifiers", "identifiers"),
  unique: declareText("profiles.form.unit.unique", "unique"),
  "must be less than size": declareText("profiles.form.unit.lessThanSize", "less than the chunk size"),
  "prerequisites required": declareText("profiles.form.unit.prerequisitesRequired", "prerequisites required"),
  switch: declareText("profiles.form.unit.switch", "switch"),
  policy: declareText("profiles.form.unit.policy", "policy"),
  "admission policy": declareText("profiles.form.unit.admissionPolicy", "admission policy"),
  "usage policy": declareText("profiles.form.unit.usagePolicy", "usage policy"),
  "access strategy": declareText("profiles.form.unit.accessStrategy", "access strategy"),
  strategy: declareText("profiles.form.unit.strategy", "strategy"),
  strategies: declareText("profiles.form.unit.strategies", "strategies"),
  metric: declareText("profiles.form.unit.metric", "metric"),
  syntax: declareText("profiles.form.unit.syntax", "syntax"),
  protocol: declareText("profiles.form.unit.protocol", "protocol"),
  "input role": declareText("profiles.form.unit.inputRole", "input role"),
  "model name": declareText("profiles.form.unit.modelName", "model name"),
  "approved embedding profile": declareText("profiles.form.unit.approvedEmbeddingProfile", "approved embedding profile"),
  "provider configuration": declareText("profiles.form.unit.providerConfiguration", "provider configuration"),
};

/** A parameter's type, for the facts at the bottom of its explanation: `ParameterType`. */
export const PARAMETER_TYPES: CodeLabels = {
  BOOLEAN: declareText("profiles.form.type.boolean", "Switch"),
  INTEGER: declareText("profiles.form.type.integer", "Whole number"),
  DECIMAL: declareText("profiles.form.type.decimal", "Decimal number"),
  TEXT: declareText("profiles.form.type.text", "Text"),
  TEXT_LIST: declareText("profiles.form.type.textList", "List of texts"),
  UUID: declareText("profiles.form.type.uuid", "Reference"),
  UUID_LIST: declareText("profiles.form.type.uuidList", "List of references"),
  CHOICE: declareText("profiles.form.type.choice", "One choice"),
  CHOICE_LIST: declareText("profiles.form.type.choiceList", "Several choices"),
  URI: declareText("profiles.form.type.uri", "Address"),
  OBJECT: declareText("profiles.form.type.object", "JSON object"),
};
