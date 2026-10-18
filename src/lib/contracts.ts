// Typed mirror of the Raccoon backend read contracts the interface consumes.
// Field names follow the server DTOs exactly so responses map without translation.

export interface IssuedCredential {
  id: string;
  subjectId: string;
  label: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

export interface LoginResponse {
  credential: IssuedCredential;
  token: string;
}

export interface WorkspaceView {
  id: string;
  name: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  /** A PIN must be given before the workspace opens in the interface. */
  locked: boolean;
}

/** Where a PIN-locked workspace stands for this browser. */
export interface WorkspaceLockState {
  locked: boolean;
  /** Until when this browser has it open; null while it is shut to it. */
  openUntil: string | null;
}

export type RetrievalMode = "LEXICAL" | "SEMANTIC" | "HYBRID" | "AUTO";

export type HitOrigin = "DERIVED" | "MANUAL" | "OVERRIDE";

export interface SearchQuery {
  profileId: string;
  text: string;
  limit?: number;
  sourceId?: string;
  documentId?: string;
  mode?: RetrievalMode;
  maximumEmbeddingTokens?: number;
}

export interface DocumentCitation {
  sourceId: string;
  externalId: string;
  documentId: string;
  versionId: string;
  versionNumber: number;
  sha256: string;
  generationId: string;
  processingProfileId: string;
  processingProfileRevision: number;
  parserId: string;
  chunkNumber: number;
  startOffset: number;
  endOffset: number;
  startLine: number;
  endLine: number;
  headingOffsets: number[];
  /** For a paged original (PDF, a scan), the pages the cited chunk spans; null otherwise. */
  startPage?: number | null;
  endPage?: number | null;
}

export interface HitEvidence {
  lexicalScore: number | null;
  semanticScore: number | null;
  vectorGenerationId: string | null;
  vectorRecordId: string | null;
  vectorOrigin: string | null;
  vectorRecordRevision: number | null;
}

export interface SearchHit {
  entryId: string;
  entryRevision: number;
  origin: HitOrigin;
  linkedEntryId: string | null;
  title: string;
  score: number;
  excerpt: string;
  excerptTruncated: boolean;
  citation: DocumentCitation | null;
  evidence: HitEvidence | null;
  /** Present only when the rerank stage reordered the results: where fusion put the hit, and the model's relevance. */
  reranked?: HitReranked | null;
  /** Present only for a hit from a document imported from another system: its path, link and tags there. */
  remote?: HitRemote | null;
  /** Why the hit was found. Absent from responses of servers older than this field. */
  match?: HitMatch | null;
  /** Its place when the profile groups results by document; absent when every entry is a result of its own. */
  group?: HitGroup | null;
}

/**
 * A hit's place in a result grouped by document: `rank` is its document's place, `position` its place within the
 * document's returned hits (1 is the best, shown first), `shown` how many of them came back, and `matches` how many of
 * the document's entries the query matched in all — null when only meaning found it.
 */
export interface HitGroup {
  rank: number;
  position: number;
  shown: number;
  matches: number | null;
}

/** Where a matched query term occurs in the excerpt: UTF-16 offsets (JavaScript string indexes), end exclusive. */
export interface HitTermSpan {
  start: number;
  end: number;
  term: string;
}

/**
 * Why a hit was found: the query terms its keyword index contains (perhaps beyond the excerpt), where they
 * fall in the excerpt, the one-based place each branch gave it (null when that branch did not return it),
 * and the symbol match — 2 the exact declaration, 1 its bare name, 0 none.
 */
export interface HitMatch {
  matchedTerms: string[];
  spans: HitTermSpan[];
  lexicalRank: number | null;
  semanticRank: number | null;
  symbolMatch: number;
  /** The part recognised in the query that identifies this hit's document; absent or null otherwise. */
  recognizedPart?: string | null;
  /** Recognised query symbols this hit's text contains as whole tokens; absent from older servers. */
  recognizedSymbols?: string[];
}

export interface IdentifiedDocument {
  documentId: string;
  sourceId: string;
  /** The document identity's name, or its version title when it records none. */
  name: string;
}

export interface RecognizedPart {
  name: string;
  /** The current published documents identified as this part; empty when none is. */
  documents: IdentifiedDocument[];
}

/** What the query was recognised to name, as the profile let it act. */
export interface QueryRecognition {
  parts: RecognizedPart[];
  symbols: string[];
  /** Set when the profile narrowed the search to the one document the part identifies. */
  scopedDocumentId: string | null;
}

export interface HitRemote {
  path: string;
  address: string | null;
  tags: string[];
}

export interface HitReranked {
  /** One-based. */
  fusedPosition: number;
  relevance: number;
}

export type RerankState = "APPLIED" | "SKIPPED" | "FELL_BACK";

export type RerankReason =
  | "TOO_FEW_CANDIDATES"
  | "POLICY_REFUSED"
  | "PROVIDER_MISSING"
  | "CAPABILITY_MISSING"
  | "PROVIDER_NOT_IN_FORCE"
  | "KEY_MISSING"
  | "ENDPOINT_UNKNOWN"
  | "MODEL_UNAVAILABLE"
  | "CANDIDATE_CHANGED"
  | "LIMIT"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "TRANSPORT"
  | "PROVIDER_REFUSED"
  | "INVALID_RESPONSE"
  | "FAILED";

/** What the rerank stage did. Absent from a report when the profile has no rerank stage. */
export interface RerankReport {
  state: RerankState;
  reason: RerankReason | null;
  providerConfigurationId: string | null;
  providerRevision: number | null;
  protocol: string | null;
  model: string | null;
  candidates: number;
  kept: number;
  callId: string | null;
  latencyMilliseconds: number | null;
  reportedInputTokens: number | null;
  providerStatus: number | null;
}

export interface RetrievalReport {
  requestedMode: RetrievalMode;
  effectiveMode: RetrievalMode;
  reason: string;
  lexicalCandidates: number;
  semanticCandidates: number;
  embeddingProfileId: string | null;
  /** The vector distance the semantic branch measured with; null when no vectors were read. */
  metric?: "COSINE" | "EUCLIDEAN" | null;
  model?: string | null;
  dimensions?: number;
  embeddingCalls: number;
  queryCacheHit: boolean;
  reportedInputTokens: number;
  usageUncertain: boolean;
  /** Null or absent when the profile has no rerank stage. */
  rerank?: RerankReport | null;
  /** How many searchable documents in scope the meaning branch could see; absent for keyword-only searches. */
  vectorCoverage?: VectorCoverage | null;
}

export interface VectorCoverage {
  /** Current, published documents in the searched scope. */
  documents: number;
  /** Of those, the ones with published vectors in the profile's model space. */
  vectorisedDocuments: number;
}

export interface SearchResponse {
  queryId: string;
  profileId: string;
  profileRevision: number;
  backendId: string;
  backendRevision: string;
  effective: Record<string, unknown>;
  hits: SearchHit[];
  hasMore: boolean;
  retrieval: RetrievalReport;
  /** The query as the profile's keyword analyzers reduce it to terms; absent from older servers. */
  queryTerms?: string[];
  /** Parts and symbols recognised in the query; absent from older servers. */
  recognition?: QueryRecognition;
}

export interface AvailableSearchProfile {
  id: string;
  name: string;
}

export interface AccessQuestion {
  permission: string;
  /** Omitted asks about the installation. */
  workspaceId?: string | null;
}

export interface AccessAnswer {
  permission: string;
  workspaceId: string | null;
  allowed: boolean;
}

export type WorkspaceRole = "OWNER" | "EDITOR" | "VIEWER";

export interface MemberView {
  subjectId: string;
  role: WorkspaceRole;
  revision: number;
}

export interface CredentialView {
  id: string;
  subjectId: string;
  label: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

export interface IssuedCredential {
  credential: CredentialView;
  /** Shown once; only its hash is stored. */
  token: string;
}

export interface SubjectView {
  id: string;
  displayName: string;
  enabled: boolean;
  revision: number;
  createdAt: string;
}

/** A notice for the signed-in account — shown once per browser by the toaster. */
export interface NoticeView {
  id: string;
  at: string;
  level: "info" | "warn" | "alarm";
  title: string | null;
  body: string;
  /** Who is speaking, composed by the server. */
  from: string;
}

export type SourceKind =
  "LOCAL_FOLDER" | "MANAGED_FOLDER" | "GIT" | "WEB" | "CUSTOM_TEXT" | "PUSH" | "CONNECTED";

export interface SourceView {
  id: string;
  workspaceId: string;
  kind: SourceKind;
  name: string;
  location: string | null;
  enabled: boolean;
  revision: number;
  createdAt: string;
  /** Set once the source and its documents were taken out of the corpus; a removed source is never listed. */
  removedAt: string | null;
  /** What its kind takes beside the location: a git branch, the further addresses of a web source. */
  options: Record<string, unknown>;
  /** The connection it reads through; null for typed text and uploads, and for a source made before connections. */
  connectionId: string | null;
}

/** What removing a source answers: the source as it now is, and how many documents went with it. */
export interface SourceRemoval {
  source: SourceView;
  removedDocuments: number;
}

export interface CreateSourceRequest {
  kind: SourceKind;
  name: string;
  location?: string;
  /** The connection the source reads through; left out, the kind's only usable one is taken. */
  connectionId?: string;
  /** What the kind takes beside its location — see `GitOptions` and `WebOptions`. */
  options?: Record<string, unknown>;
}

/**
 * A git source checks out its repository's default branch unless it names one. Its hosting and token belong to
 * the connection it reads through.
 */
export interface GitOptions {
  branch?: string;
}

export type GitHostingKind = "GITHUB" | "GITLAB" | "OTHER";
export type RepositoryState =
  "FOUND" | "NOT_FOUND" | "FORBIDDEN" | "RATE_LIMITED" | "UNREACHABLE" | "NOT_CHECKED";
export type RepositoryVisibility = "PUBLIC" | "INTERNAL" | "PRIVATE";
export type AccessTokenState =
  "NOT_SET" | "ACCEPTED" | "REJECTED" | "NO_READ_SCOPE" | "NOT_CHECKED" | "NOT_USED";

/** What the hosting said about a git source's repository and its token when last asked. Never the token. */
export interface RepositoryAccessCheck {
  hosting: GitHostingKind;
  host: string | null;
  repository: string | null;
  repositoryState: RepositoryState;
  visibility: RepositoryVisibility | null;
  defaultBranch: string | null;
  tokenState: AccessTokenState;
  account: string | null;
  scopes: string[];
  scopesReported: boolean;
  tokenExpiresAt: string | null;
  rateLimitResetsAt: string | null;
  explanation: string;
  checkedAt: string;
}

/** A git source's access: whether a token is set — never the token itself — and the last check. */
export interface RepositoryAccessView {
  /** The connection the repository is read through, which holds the token; null for a source made before connections. */
  connectionId: string | null;
  connectionName: string | null;
  tokenSet: boolean;
  tokenChangedAt: string | null;
  lastCheck: RepositoryAccessCheck | null;
}

/**
 * A web source: further start addresses; whether it fetches only those pages or also follows links within
 * its sites, and then how many links deep (1-5, present only when following); and its page budget per scan.
 */
export interface WebOptions {
  urls: string[];
  crawlMode: "LISTED_PAGES" | "FOLLOW_LINKS";
  linkDepth?: number;
  maximumPages: number;
}

/** What one uploaded file became: its version, or the reason it was refused. */
export interface UploadOutcome {
  fileName: string;
  path: string;
  version: DocumentVersionView | null;
  refusal: string | null;
}

export interface SourceLocationRoot {
  /** As the person writes it: a host path such as C:\ or a plain server path. */
  path: string;
  available: boolean;
}

export interface SourceFolder {
  name: string;
  path: string;
}

export interface SourceFolderListing {
  path: string;
  /** Null at a configured root, so browsing cannot climb out of it. */
  parent: string | null;
  folders: SourceFolder[];
  truncated: boolean;
}

export interface ChangeSourceRequest {
  name: string;
  enabled: boolean;
  revision: number;
}

export type JobStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export interface JobAttemptView {
  attemptNumber: number;
  workerId: string;
  startedAt: string;
  finishedAt: string | null;
  outcome: string | null;
  failureCode: string | null;
  failureDetail: string | null;
}

export interface ManagedOriginalView {
  id: string;
  displayName: string;
  storedFileId: string;
  sha256: string;
  sizeBytes: number;
  backend: string;
}

export interface JobView {
  id: string;
  kind: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  availableAt: string;
  attemptCount: number;
  attemptLimit: number;
  configuration: Record<string, unknown>;
  failureCode: string | null;
  failureDetail: string | null;
  resultSha256: string | null;
  resultSizeBytes: number | null;
}

export type ParameterType =
  | "BOOLEAN"
  | "INTEGER"
  | "DECIMAL"
  | "TEXT"
  | "URI"
  | "UUID"
  | "OBJECT"
  | "CHOICE"
  | "UUID_LIST"
  | "TEXT_LIST"
  | "CHOICE_LIST";

export interface SystemParameterView {
  key: string;
  type: ParameterType;
  defaultValue: number;
  minimum: number;
  maximum: number;
  description: string;
  changeEffect: string;
  scope: string;
  effectiveValue: number;
  valueOrigin: string;
  revision: number;
  /** An address setting (type URI) holds text instead of a number: "" when not set; null on number settings. */
  defaultText: string | null;
  effectiveText: string | null;
}

/** Where this installation is reached from outside; null when no administrator has set it. */
export interface InstallationAddresses {
  publicBaseAddress: string | null;
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

export interface DocumentView {
  id: string;
  workspaceId: string;
  sourceId: string;
  externalId: string;
  revision: number;
  latestVersionId: string;
  title: string;
  /** Set once the document was taken out of the corpus; it stays readable by address, with its history. */
  removedAt: string | null;
  /** Where an imported document lives in the system it came from; absent for every other document. */
  origin?: DocumentOrigin | null;
}

/** An imported document's place, link and tags in the system it came from (a connected source). */
export interface DocumentOrigin {
  /** The remote tree's names down to the document, its own title last, joined by "/". */
  path: string;
  address: string | null;
  tags: string[];
  /** The remote version the latest capture was made from. */
  remoteVersion: string;
  /** Live constructs replaced by "Live content not imported" in that capture. */
  liveBlocks: number;
  updatedAt: string | null;
}

export interface DocumentVersionView {
  id: string;
  documentId: string;
  versionNumber: number;
  title: string;
  managedFileId: string;
  sha256: string;
  sizeBytes: number;
  mediaType: string;
  state: string;
  createdAt: string;
  processingEvaluationId: string | null;
  /** Who put this version in and through what; null for one registered before origins were recorded. */
  origin: CaptureOrigin | null;
}

/** The ways a document version gets in. */
export type CaptureChannel =
  "SCAN" | "UPLOAD" | "TEXT" | "PUSH_API" | "MCP" | "TELEGRAM" | "INTERNAL";

/** One uploader: the channel, the subject it acted as, and what tells two uploaders apart inside that channel. */
export interface CaptureOrigin {
  channel: CaptureChannel;
  subjectId: string | null;
  agentId: string | null;
  connectionId: string | null;
  telegramUserId: number | null;
  clientName: string | null;
}

/** The signed-in account's Telegram connection. */
export interface TelegramConnection {
  configured: boolean;
  connected: boolean;
  commandsBot: string | null;
  notificationsBot: string | null;
  notificationsLink: string | null;
}

/** ⚠️ `link` binds whoever opens it first, within a day. */
export interface TelegramInvitation {
  link: string;
  notificationsLink: string | null;
}

export interface TelegramJournalEntry {
  at: string;
  identityName: string | null;
  operation: "SEND" | "EDIT" | "DELETE" | "ANSWER_CALLBACK";
  chat: string | null;
  outcome: "DELIVERED" | "REFUSED";
  refusal: string | null;
  detail: string | null;
}

export interface TelegramJournalPage {
  items: TelegramJournalEntry[];
  total: number;
}
