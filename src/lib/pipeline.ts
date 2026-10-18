// The document pipeline: a captured version is processed (parsed, chunked, written to a lexical index
// generation), the generation is published, and a published generation can be vectorised after a
// preflight that forecasts its tokens and cost. Shapes mirror the backend records field for field;
// see `.scratch/ui-contracts-pipeline.md` for where each comes from.

import { api, pageQuery, workspacePath, type PageRequest } from "./api";
import type { JobView } from "./contracts";
import type { RuleStage } from "./ruleSets";

export interface ScriptExecution {
  scriptVersionId: string;
  groupId: string | null;
  groupRevision: number | null;
  outcome: string;
}

/* Processing profiles */

export interface ChunkingConfiguration {
  chunkerIds: string[];
  maximumCodePoints: number;
  overlapCodePoints: number;
}

export interface LexicalIndexConfiguration {
  backendId: string;
  analyzer: string;
  includeTitle: boolean;
  publishAutomatically: boolean;
}

export interface PreparationConfiguration {
  steps: string[];
  chunking: ChunkingConfiguration | null;
  indexing: LexicalIndexConfiguration | null;
  scriptGroupIds: string[];
  ruleSetIds?: string[];
  layersOff?: string[];
  relations?: {
    roles: string[];
    origins: string[];
    includeUnreliable: boolean;
    includeReadingOnly: boolean;
  } | null;
}

export interface ProcessingProfileConfiguration {
  automaticParserIds?: string[];
  parserOptions?: Record<string, Record<string, unknown>>;
  parserId: string;
  maximumCharacters: number;
  maximumBlocks: number;
  maximumChunks: number;
  preparation: PreparationConfiguration | null;
  enabled: boolean | null;
}

export interface ProcessingProfile {
  id: string;
  name: string;
  revision: number;
  configuration: ProcessingProfileConfiguration;
}

export type ProcessingEventType =
  | "STARTED"
  | "BEFORE_STEP"
  | "AFTER_STEP"
  | "BEFORE_ORIGINAL_READ"
  | "AFTER_ORIGINAL_READ"
  | "BEFORE_PUBLICATION"
  | "INDEX_GENERATION_STORED"
  | "COMPLETED"
  | "FAILED"
  | "STRUCTURE_FALLBACK"
  | "PARSE_OBSERVATION"
  | "LAYER";

/* Processing runs */

export interface ParseLimits {
  maximumCharacters: number;
  maximumBlocks: number;
}

export interface ProcessingRun {
  job: JobView;
  documentId: string;
  versionId: string;
  profileId: string;
  profileRevision: number;
  parserId: string;
  limits: ParseLimits;
  preparation: PreparationConfiguration;
  effectivePreparation: PreparationConfiguration | null;
  maximumChunks: number;
  parserOptions: Record<string, unknown>;
  reusedParseJobId: string | null;
}

export interface ProcessingReference {
  jobId: string;
  versionId: string;
  state: string;
}

export interface ProcessingRequest {
  profileId: string;
  profileRevision?: number;
  reusedParseJobId?: string | null;
  preparation?: PreparationConfiguration;
}

export interface PreviewSample<T> {
  total: number;
  items: T[];
  truncated: boolean;
}

export interface DocumentRelations {
  providers: {
    id: string;
    entities: PreviewSample<{ id: string; name: string; qualifiedName: string; kind: string }>;
    relations: PreviewSample<{ id: string; writtenTarget: string; role: string; origin: string }>;
  }[];
  generationIds: string[];
}

export interface ProcessingPreview {
  profileRevision: number;
  parserId: string;
  reusedParseJobId: string | null;
  preparation: PreparationConfiguration;
  characters: number;
  blocks: number;
  text: string;
  textTruncated: boolean;
  chunks: PreviewSample<Chunk>;
  lexical: PreviewSample<{ chunkNumber: number; indexedText: string; searchVector: string }>;
  graph: import("./graph").GraphPreview | null;
  notices: string[];
  persisted: false;
}

export type BlockKind =
  | "TEXT"
  | "HEADING"
  | "CODE"
  | "DECLARATION"
  | "ENTRY"
  | "PARAGRAPH"
  | "LIST_ITEM"
  | "TABLE_ROW"
  | "CAPTION"
  | "PAGE_FURNITURE"
  | "QUOTE"
  | "FIGURE"
  | "TABLE_OF_CONTENTS";

/** One cell of a table row; a cell merged across rows is filled down, its own text sitting in another row. */
export interface TableCell {
  header: string | null;
  value: string;
  startOffset: number | null;
  endOffset: number | null;
  filledDown: boolean;
  /** A table drawn inside the cell; its text is then the cell's value. */
  inner?: InnerTable;
}

/** A table nested in a cell of another: its header and rows, values only. */
export interface InnerTable {
  header: string[];
  rows: string[][];
}

/** A rectangle on a page, in PDF points from its top-left corner. */
export interface PageBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A drawing on a page — a block diagram, a timing chart — with the labels drawn on it and, when rendered, an image. */
export interface Figure {
  number: number;
  caption: string | null;
  labels: string[];
  page: number;
  bounds: PageBounds;
  image: boolean;
}

/** What a structured-data entry or a declaration declares: its symbol, the path or signature it is found by. */
export interface BlockStructure {
  symbol: ChunkSymbol;
  mergeKey: string | null;
}

/** A table row standing on its own: its table's title and header, and every cell. */
export interface TableRow {
  tableNumber: number;
  title: string | null;
  header: string[];
  headerRow: boolean;
  rowNumber: number;
  group: number;
  cells: TableCell[];
  page: number;
  bounds?: PageBounds | null;
}

export interface StructuredBlock {
  kind: BlockKind;
  startOffset: number;
  endOffset: number;
  startLine: number;
  endLine: number;
  headingLevel: number;
  /** What the block stands for when it is not its slice — a paragraph joined, a row with merged cells filled down. */
  content?: string;
  table?: TableRow;
  figure?: Figure;
  structure?: BlockStructure;
  /** A list item's place in its list; its content carries `context › text`, its slice the text alone. */
  list?: ListEntry;
}

/** Where a list item stands: its level, its marker, and the texts of the items it is nested under. */
export interface ListEntry {
  level: number;
  marker: "BULLET" | "NUMBERED";
  label?: string;
  context?: string;
}

/** What a laid-out original says it is — every part optional. */
export interface DocumentIdentity {
  part: string | null;
  manufacturer: string | null;
  description: string | null;
  revision: string | null;
}

export interface StructuredDocument {
  sourceText: string;
  blocks: StructuredBlock[];
  pages?: { number: number; startOffset: number; endOffset: number; reading: string }[];
  identity?: DocumentIdentity;
  /** Why a parser that reads structure read this original as text instead. */
  structureFallback?: { reason: string; detail: string | null } | null;
}

/** What a profile's rule sets dropped from one parse, by which rule of which rule set, and why. */
export interface ContentOutcome {
  droppedBlocks: {
    blockIndex: number;
    startOffset: number;
    ruleSetId: string;
    step: string;
    reason: string;
  }[];
  droppedChunks: {
    startOffset: number;
    endOffset: number;
    startLine: number;
    ruleSetId: string | null;
    step: string | null;
    reason: string;
  }[];
  steps: {
    ruleSetId: string;
    step: string;
    stage: RuleStage;
    dropped: number;
    rewritten: number;
  }[];
}

export interface ProcessingEvent {
  id: string;
  type: ProcessingEventType;
  stepId: string | null;
  blockCount: number;
  chunkCount: number;
  outcome: string;
  executions: ScriptExecution[];
  /** A journal-only observation's explanation — why a source file fell back to text chunking, with its position. */
  detail: string | null;
}

/* Source preparation */

export type PreparationRequestState = "PENDING" | "SUBMITTED" | "SKIPPED" | "FAILED" | "CANCELLED";

export type PreparationRequestReason =
  | "BINDING_DISABLED"
  | "PROFILE_DISABLED"
  | "MEDIA_TYPE_EXCLUDED"
  | "ACCESS_DENIED"
  | "ORIGINAL_TOO_LARGE"
  | "INVALID_CONFIGURATION"
  | "SUBMISSION_FAILED"
  | "NO_PARSER"
  | "PARSER_UNAVAILABLE";

export interface SourcePreparationConfiguration {
  profileId: string;
  enabled: boolean;
  mediaTypes: string[];
}

export interface PreparationBinding {
  sourceId: string;
  revision: number;
  configuration: SourcePreparationConfiguration;
}

/** A live source with a preparation binding, as the workspace-wide list reports it. */
export interface BoundSource {
  sourceId: string;
  sourceName: string;
  revision: number;
  configuration: SourcePreparationConfiguration;
}

export interface PreparationRequest {
  id: string;
  sourceId: string;
  documentId: string;
  versionId: string;
  bindingRevision: number;
  profileId: string;
  profileRevision: number;
  actorId: string;
  state: PreparationRequestState;
  reason: PreparationRequestReason | null;
  jobId: string | null;
  revision: number;
  createdAt: string;
}

export interface PreparationAuditEvent {
  id: string;
  revision: number;
  action:
    "BINDING_SAVED" | "REQUESTED" | "SUBMITTED" | "SKIPPED" | "FAILED" | "RETRIED" | "CANCELLED";
  actorId: string;
  createdAt: string;
}

/* Lexical index */

export type LexicalGenerationState = "READY" | "PUBLISHED" | "WITHDRAWN" | "PURGED";

export interface IndexGeneration {
  jobId: string;
  documentId: string;
  versionId: string;
  profileId: string;
  profileRevision: number;
  state: LexicalGenerationState;
  revision: number;
  entryCount: number;
}

/** Which chunks of a run a list holds: all, those a written entry stands in for, or those taken out of search. */
export type ChunkStanding = "ALL" | "EDITED" | "REMOVED";

export interface Chunk {
  number: number;
  text: string;
  startOffset: number;
  endOffset: number;
  startLine: number;
  endLine: number;
  headingOffsets: number[];
  /** What a source-code chunk declares; null for prose. */
  symbol: ChunkSymbol | null;
  /** What of the chunk is indexed; null means all of it, with no context — as every chunk was before parsers had options. */
  indexing: ChunkIndexing | null;
  /** What keyword entries and vectors are built from: the context line, then the structured form or the slice minus its reading-only parts. */
  indexedText: string;
  /** For a paged original (PDF, a scan), the pages the chunk spans; null otherwise. */
  startPage: number | null;
  endPage: number | null;
}

/** Why a part of a chunk is kept for reading only. */
export type ReadingOnlyReason = "BODY" | "COMMENT" | "DOCUMENTATION" | "CODE_BLOCK" | "VALUE";

export interface ReadingOnlySpan {
  /** Absolute offsets in the parsed text, like the chunk's own. */
  startOffset: number;
  endOffset: number;
  reason: ReadingOnlyReason | string;
}

/** The parts of a chunk left out of keyword entries and vectors, and the context indexed before it. */
export interface ChunkIndexing {
  readingOnly: ReadingOnlySpan[];
  context: string | null;
  /** What is indexed in place of the slice when blocks stand for more than their text; null means the slice. */
  composedText?: string | null;
  composedKeywordText?: string | null;
  /** For a chunk cut from table rows, its table's title and the row it holds. */
  table?: { title: string | null; row: string } | null;
}

export type ChunkSymbolKind =
  "FILE" | "TYPE" | "MEMBER" | "MEMBERS" | "DECLARATION" | "DECLARATIONS" | "ENTRY" | "ENTRIES";

export interface ChunkSymbolMember {
  kind: string;
  name: string;
  signature: string;
  symbolId: string;
}

/** The declaration behind a chunk of a source file — what keyword search matches besides the chunk's text. */
export interface ChunkSymbol {
  language: string;
  kind: ChunkSymbolKind;
  packageName: string;
  typeName: string | null;
  memberName: string | null;
  signature: string | null;
  symbolId: string | null;
  enclosingSignature: string | null;
  members: ChunkSymbolMember[];
  part: number;
  parts: number;
  /** What a script declaration is beyond its kind; absent for every other language. */
  traits?: ChunkSymbolTraits;
}

/** What a script declaration is — a component, a hook, exported or internal — as its source says without being compiled. */
export interface ChunkSymbolTraits {
  /** COMPONENT, HOOK, FUNCTION, CLASS, INTERFACE, TYPE, ENUM, CONSTANT, VARIABLE, NAMESPACE, METHOD, PROPERTY, CONSTRUCTOR… */
  role: string;
  exported: boolean;
  /** For a component, the type of its properties as written. */
  propsType?: string;
  deprecated: boolean;
  /** The first sentence of its documentation comment. */
  summary?: string;
}

export type EntryOrigin = "DERIVED" | "MANUAL" | "OVERRIDE";

export interface IndexEntry {
  id: string;
  generationId: string | null;
  chunkNumber: number | null;
  origin: EntryOrigin;
  linkedEntryId: string | null;
  title: string;
  text: string;
  analyzer: string;
  removed: boolean;
  revision: number;
}

export interface IndexStatistics {
  generations: number;
  publishedGenerations: number;
  chunks: number;
  entries: number;
  manualEntries: number;
  removedEntries: number;
  textCharacters: number;
}

export interface ManualEntry {
  title: string;
  text: string;
  analyzer: "simple" | "english";
  revision: number;
}

/* Embeddings */

export type TokenizerStrategy = "TEI" | "CODE_POINT_ESTIMATE" | "UNKNOWN";

export type Budget = "WITHIN" | "EXCEEDED" | "UNKNOWN";
export type TokenQuality = "EXACT" | "APPROXIMATE" | "UNKNOWN";

export interface ModelSnapshot {
  configurationId: string;
  configurationRevision: number;
  provider: string;
  model: string;
  modelRevision: string;
  dimensions: number;
  protocol: string;
  tokenizer: string;
  tokenizerRevision: string;
  tokenizerStrategy: TokenizerStrategy;
  inputPrefixSha256: string;
}

export interface EffectiveLimits {
  maximumChunks: number;
  maximumTotalCodePoints: number;
  maximumTokens: number;
  statementMilliseconds: number;
}

export interface PreflightReport {
  preflightId: string;
  profileId: string;
  profileRevision: number;
  createdAt: string;
  model: ModelSnapshot;
  preparedFiles: number;
  chunks: number;
  reusableChunks: number;
  totalTokens: number | null;
  reusableTokens: number | null;
  pendingTokens: number | null;
  quality: TokenQuality;
  currency: string | null;
  estimatedCost: number | null;
  tokenBudget: Budget;
  costBudget: Budget;
  effective: EffectiveLimits;
  inputsSha256: string;
}

export interface EmbeddingEvent {
  id: string;
  preflightId: string | null;
  type: string;
  chunkCount: number;
  batchNumber: number;
  inputCodePoints: number;
  effective: EffectiveLimits | null;
  outcome: string;
  executions: ScriptExecution[];
  jobId: string | null;
}

/* Vectors */

export type VectorGenerationState = "BUILDING" | "PUBLISHED" | "WITHDRAWN" | "PURGED";

export interface VectorPolicy {
  maximumAttempts: number;
  retryDelaySeconds: number;
  maximumConcurrentCalls: number;
  maximumCalls: number;
  maximumDurationMilliseconds: number;
  maximumPreflightAgeSeconds: number;
  allowApproximateTokens: boolean;
  allowUnknownUsage: boolean;
}

export interface VectorGeneration {
  jobId: string;
  preflightId: string;
  state: VectorGenerationState;
  revision: number;
  expectedRecords: number;
  storedRecords: number;
  removedRecords: number;
  reusedRecords: number;
  calls: number;
  unresolvedCalls: number;
  actualTokens: number | null;
  reservedTokens: number;
  model: ModelSnapshot;
  policy: VectorPolicy;
  job: JobView;
  createdAt: string;
}

export interface VectorRecord {
  id: string;
  entryId: string;
  entryRevision: number;
  sourceGenerationId: string;
  documentId: string;
  versionId: string;
  chunkNumber: number;
  embeddingId: string | null;
  reused: boolean;
  removed: boolean;
  revision: number;
  dimensions: number;
  origin: "MODEL" | "MANUAL";
}

export interface VectorCall {
  id: string;
  batchNumber: number;
  state: "RESERVED" | "COMPLETED" | "UNKNOWN";
  inputCount: number;
  predictedTokens: number;
  actualTokens: number | null;
  createdAt: string;
  completedAt: string | null;
}

export interface VectorAudit {
  resourceId: string;
  action:
    | "SUBMITTED"
    | "PUBLISHED"
    | "WITHDRAWN"
    | "SUPERSEDED"
    | "RECORD_SAVED"
    | "RECORD_REMOVED"
    | "PURGED"
    | "SOURCE_INVALIDATED";
  actorId: string;
  revision: number;
  createdAt: string;
}

export interface VectorStatistics {
  generations: number;
  publishedGenerations: number;
  storedEmbeddings: number;
  records: number;
  manualRecords: number;
  removedRecords: number;
  calls: number;
  unresolvedCalls: number;
  cachedVectorBytes: number;
  manualVectorBytes: number;
}

export interface VectorCatalogue {
  maximumDimensions: number;
  states: VectorGenerationState[];
  executionPolicy: {
    name: keyof VectorPolicy;
    type: "INTEGER" | "BOOLEAN";
    minimum: number | null;
    maximum: number | null;
    description: string;
  }[];
}

/* Original reads */

export interface AvailableProfile {
  id: string;
  name: string;
}

export interface OriginalRead {
  readId: string;
  profileId: string;
  profileRevision: number;
  sourceId: string;
  externalId: string;
  documentId: string;
  versionId: string;
  versionNumber: number;
  title: string;
  sha256: string;
  sizeBytes: number;
  mediaType: string;
  startOffset: number;
  endOffset: number;
  totalCharacters: number;
  returnedCodePoints: number;
  nextOffset: number | null;
  text: string;
}

/** An idempotency key for one deliberate submission; a retry of the same click reuses it. */
export function submissionKey(purpose: string, target: string): string {
  return `${purpose}-${target}-${Date.now()}`.slice(0, 120);
}

function idempotent(key: string): Record<string, string> {
  return { "Idempotency-Key": key };
}

const documentPath = (workspaceId: string, documentId: string, versionId: string) =>
  workspacePath(workspaceId, `/documents/${documentId}/versions/${versionId}`);

export const pipelineApi = {
  /* processing profiles — read here for choosing one; editing goes through profilesApi */
  processingProfiles: (workspaceId: string, page: PageRequest) =>
    api.send<ProcessingProfile[]>(
      "GET",
      workspacePath(workspaceId, `/processing-profiles?${pageQuery(page)}`),
    ),

  /* processing runs */
  startProcessing: (
    workspaceId: string,
    documentId: string,
    versionId: string,
    profileId: string,
    key: string,
    request?: ProcessingRequest,
  ) =>
    api.send<ProcessingRun>(
      "POST",
      `${documentPath(workspaceId, documentId, versionId)}/processing-runs`,
      request ?? { profileId },
      idempotent(key),
    ),
  documentRelations: (workspaceId: string, documentId: string, versionId: string, jobId: string) =>
    api.send<DocumentRelations>(
      "GET",
      `${documentPath(workspaceId, documentId, versionId)}/processing-runs/${jobId}/relations`,
    ),
  processingHistory: (workspaceId: string, documentId: string, versionId: string) =>
    api.send<ProcessingRun[]>(
      "GET",
      `${documentPath(workspaceId, documentId, versionId)}/processing-runs`,
    ),
  processingPreview: (
    workspaceId: string,
    documentId: string,
    versionId: string,
    processing: ProcessingRequest,
    context?: import("./graph").GraphRequest,
  ) =>
    api.send<ProcessingPreview>(
      "POST",
      `${documentPath(workspaceId, documentId, versionId)}/processing-runs/preview`,
      { processing, context },
    ),
  processingRun: (workspaceId: string, documentId: string, versionId: string, jobId: string) =>
    api.send<ProcessingRun>(
      "GET",
      `${documentPath(workspaceId, documentId, versionId)}/processing-runs/${jobId}`,
    ),
  processingResult: (workspaceId: string, documentId: string, versionId: string, jobId: string) =>
    api.send<StructuredDocument>(
      "GET",
      `${documentPath(workspaceId, documentId, versionId)}/processing-runs/${jobId}/result`,
    ),
  contentOutcome: (workspaceId: string, documentId: string, versionId: string, jobId: string) =>
    api.send<ContentOutcome>(
      "GET",
      `${documentPath(workspaceId, documentId, versionId)}/processing-runs/${jobId}/content-outcome`,
    ),
  /** The image a parser drew of one figure, PNG. Fetched with the reader's credentials — an <img> cannot send them. */
  figureImage: (
    workspaceId: string,
    documentId: string,
    versionId: string,
    jobId: string,
    figureNumber: number,
  ) =>
    api.fetchBytes(
      `${documentPath(workspaceId, documentId, versionId)}/processing-runs/${jobId}/figures/${figureNumber}`,
    ),
  processingEvents: (workspaceId: string, jobId: string, page: PageRequest) =>
    api.send<ProcessingEvent[]>(
      "GET",
      workspacePath(workspaceId, `/indexes/processing-events?jobId=${jobId}&${pageQuery(page)}`),
    ),

  /* source preparation */
  boundSources: (workspaceId: string, profileId: string, page: PageRequest) =>
    api.send<BoundSource[]>(
      "GET",
      workspacePath(workspaceId, `/preparation-bindings?profileId=${profileId}&${pageQuery(page)}`),
    ),
  preparationBinding: (workspaceId: string, sourceId: string) =>
    api.send<PreparationBinding>(
      "GET",
      workspacePath(workspaceId, `/sources/${sourceId}/preparation-binding`),
    ),
  savePreparationBinding: (
    workspaceId: string,
    sourceId: string,
    configuration: SourcePreparationConfiguration,
    revision: number,
  ) =>
    api.send<PreparationBinding>(
      "PUT",
      workspacePath(workspaceId, `/sources/${sourceId}/preparation-binding`),
      { configuration, revision },
    ),
  preparationBindingVersions: (workspaceId: string, sourceId: string, page: PageRequest) =>
    api.send<PreparationBinding[]>(
      "GET",
      workspacePath(
        workspaceId,
        `/sources/${sourceId}/preparation-binding/versions?${pageQuery(page)}`,
      ),
    ),
  preparationRequests: (workspaceId: string, sourceId: string, page: PageRequest) =>
    api.send<PreparationRequest[]>(
      "GET",
      workspacePath(workspaceId, `/sources/${sourceId}/preparation-requests?${pageQuery(page)}`),
    ),
  retryPreparationRequest: (workspaceId: string, request: PreparationRequest) =>
    api.send<PreparationRequest>(
      "POST",
      workspacePath(workspaceId, `/preparation-requests/${request.id}/retry`),
      { revision: request.revision },
    ),
  cancelPreparationRequest: (workspaceId: string, request: PreparationRequest) =>
    api.send<PreparationRequest>(
      "POST",
      workspacePath(workspaceId, `/preparation-requests/${request.id}/cancel`),
      { revision: request.revision },
    ),
  preparationRequestEvents: (workspaceId: string, requestId: string, page: PageRequest) =>
    api.send<PreparationAuditEvent[]>(
      "GET",
      workspacePath(workspaceId, `/preparation-requests/${requestId}/events?${pageQuery(page)}`),
    ),

  /* lexical index */
  indexStatistics: (workspaceId: string) =>
    api.send<IndexStatistics>("GET", workspacePath(workspaceId, "/indexes/statistics")),
  indexGenerations: (workspaceId: string, page: PageRequest) =>
    api.send<IndexGeneration[]>(
      "GET",
      workspacePath(workspaceId, `/indexes/generations?${pageQuery(page)}`),
    ),
  generationChunks: (
    workspaceId: string,
    jobId: string,
    page: PageRequest,
    standing: ChunkStanding = "ALL",
  ) =>
    api.send<Chunk[]>(
      "GET",
      workspacePath(
        workspaceId,
        `/indexes/generations/${jobId}/chunks?standing=${standing}&${pageQuery(page)}`,
      ),
    ),
  publishGeneration: (workspaceId: string, generation: IndexGeneration, published: boolean) =>
    api.send<IndexGeneration>(
      "PUT",
      workspacePath(workspaceId, `/indexes/generations/${generation.jobId}/publication`),
      {
        published,
        revision: generation.revision,
      },
    ),
  purgeGeneration: (workspaceId: string, generation: IndexGeneration) =>
    api.send<IndexGeneration>(
      "DELETE",
      workspacePath(
        workspaceId,
        `/indexes/generations/${generation.jobId}?revision=${generation.revision}`,
      ),
    ),
  indexEntries: (
    workspaceId: string,
    generationId: string | null,
    includeRemoved: boolean,
    page: PageRequest,
  ) =>
    api.send<IndexEntry[]>(
      "GET",
      workspacePath(
        workspaceId,
        `/indexes/entries?${generationId === null ? "" : `generationId=${generationId}&`}includeRemoved=${includeRemoved}&${pageQuery(page)}`,
      ),
    ),
  createEntry: (workspaceId: string, entry: ManualEntry) =>
    api.send<IndexEntry>("POST", workspacePath(workspaceId, "/indexes/entries"), entry),
  changeEntry: (workspaceId: string, entryId: string, entry: ManualEntry) =>
    api.send<IndexEntry>("PUT", workspacePath(workspaceId, `/indexes/entries/${entryId}`), entry),
  replaceEntry: (workspaceId: string, entryId: string, entry: ManualEntry) =>
    api.send<IndexEntry>(
      "POST",
      workspacePath(workspaceId, `/indexes/entries/${entryId}/replacement`),
      entry,
    ),
  removeEntry: (workspaceId: string, entry: IndexEntry) =>
    api.send<IndexEntry>(
      "DELETE",
      workspacePath(workspaceId, `/indexes/entries/${entry.id}?revision=${entry.revision}`),
    ),
  purgeEntry: (workspaceId: string, entry: IndexEntry) =>
    api.send<void>(
      "DELETE",
      workspacePath(workspaceId, `/indexes/entries/${entry.id}/purge?revision=${entry.revision}`),
    ),
  clearManualEntries: (workspaceId: string) =>
    api.send<{ removedCount: number }>(
      "DELETE",
      workspacePath(workspaceId, "/indexes/manual-entries"),
    ),

  /* embeddings */
  availableEmbeddingProfiles: (workspaceId: string, page: PageRequest) =>
    api.send<AvailableProfile[]>(
      "GET",
      workspacePath(workspaceId, `/embedding-profiles/available?${pageQuery(page)}`),
    ),
  preflight: (workspaceId: string, profileId: string, generationIds: string[]) =>
    api.send<PreflightReport>("POST", workspacePath(workspaceId, "/embedding-preflight"), {
      profileId,
      generationIds,
    }),
  preflights: (workspaceId: string, page: PageRequest) =>
    api.send<PreflightReport[]>(
      "GET",
      workspacePath(workspaceId, `/embedding-preflight?${pageQuery(page)}`),
    ),
  embeddingEvents: (workspaceId: string, preflightId: string | null, page: PageRequest) =>
    api.send<EmbeddingEvent[]>(
      "GET",
      workspacePath(
        workspaceId,
        `/embedding-events?${preflightId === null ? "" : `preflightId=${preflightId}&`}${pageQuery(page)}`,
      ),
    ),

  /* vectors */
  vectorCatalogue: (workspaceId: string) =>
    api.send<VectorCatalogue>("GET", workspacePath(workspaceId, "/vector-indexes/catalogue")),
  vectorStatistics: (workspaceId: string) =>
    api.send<VectorStatistics>("GET", workspacePath(workspaceId, "/vector-indexes/statistics")),
  vectorGenerations: (workspaceId: string, page: PageRequest) =>
    api.send<VectorGeneration[]>(
      "GET",
      workspacePath(workspaceId, `/vector-indexes?${pageQuery(page)}`),
    ),
  vectorGeneration: (workspaceId: string, jobId: string) =>
    api.send<VectorGeneration>("GET", workspacePath(workspaceId, `/vector-indexes/${jobId}`)),
  submitVectors: (
    workspaceId: string,
    preflightId: string,
    generationIds: string[],
    policy: VectorPolicy,
    key: string,
  ) =>
    api.send<VectorGeneration>(
      "POST",
      workspacePath(workspaceId, "/vector-indexes"),
      { preflightId, generationIds, policy },
      idempotent(key),
    ),
  vectorRecords: (workspaceId: string, jobId: string, page: PageRequest) =>
    api.send<VectorRecord[]>(
      "GET",
      workspacePath(workspaceId, `/vector-indexes/${jobId}/records?${pageQuery(page)}`),
    ),
  vectorValues: (workspaceId: string, jobId: string, recordId: string) =>
    api.send<{ record: VectorRecord; values: number[] }>(
      "GET",
      workspacePath(workspaceId, `/vector-indexes/${jobId}/records/${recordId}`),
    ),
  vectorCalls: (workspaceId: string, jobId: string, page: PageRequest) =>
    api.send<VectorCall[]>(
      "GET",
      workspacePath(workspaceId, `/vector-indexes/${jobId}/calls?${pageQuery(page)}`),
    ),
  vectorAudit: (workspaceId: string, jobId: string, page: PageRequest) =>
    api.send<VectorAudit[]>(
      "GET",
      workspacePath(workspaceId, `/vector-indexes/${jobId}/audit?${pageQuery(page)}`),
    ),
  cancelVectors: (workspaceId: string, jobId: string) =>
    api.send<VectorGeneration>(
      "POST",
      workspacePath(workspaceId, `/vector-indexes/${jobId}/cancel`),
    ),
  retryVectors: (workspaceId: string, jobId: string) =>
    api.send<VectorGeneration>(
      "POST",
      workspacePath(workspaceId, `/vector-indexes/${jobId}/retry`),
    ),
  withdrawVectors: (workspaceId: string, generation: VectorGeneration) =>
    api.send<VectorGeneration>(
      "DELETE",
      workspacePath(
        workspaceId,
        `/vector-indexes/${generation.jobId}/publication?revision=${generation.revision}`,
      ),
    ),
  publishVectors: (workspaceId: string, generation: VectorGeneration) =>
    api.send<VectorGeneration>(
      "PUT",
      workspacePath(workspaceId, `/vector-indexes/${generation.jobId}/publication`),
      { revision: generation.revision },
    ),
  removeVectorRecord: (workspaceId: string, jobId: string, record: VectorRecord) =>
    api.send<VectorGeneration>(
      "DELETE",
      workspacePath(
        workspaceId,
        `/vector-indexes/${jobId}/records/${record.id}?revision=${record.revision}`,
      ),
    ),
  purgeVectors: (workspaceId: string, generation: VectorGeneration) =>
    api.send<VectorGeneration>(
      "DELETE",
      workspacePath(
        workspaceId,
        `/vector-indexes/${generation.jobId}?revision=${generation.revision}`,
      ),
    ),

  /* original reads */
  availableReadProfiles: (workspaceId: string, page: PageRequest) =>
    api.send<AvailableProfile[]>(
      "GET",
      workspacePath(workspaceId, `/read-profiles/available?${pageQuery(page)}`),
    ),
  readOriginal: (
    workspaceId: string,
    documentId: string,
    versionId: string,
    profileId: string,
    startOffset: number,
  ) =>
    api.send<OriginalRead>("POST", `${documentPath(workspaceId, documentId, versionId)}/read`, {
      profileId,
      startOffset,
      maximumCodePoints: null,
    }),
};
