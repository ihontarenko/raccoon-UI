// Answers, context and the runtime journals: what was asked, which fragments were assembled as
// verified context, whether a model wrote the answer, and the event trail of every search, read,
// context and answer. See `.scratch/ui-contracts-admin.md` §9 and §10.

import { api, pageQuery, workspacePath, type PageRequest } from "./api";
import type { DocumentCitation, RerankReason, SearchResponse } from "./contracts";
import type { GraphContextFragment, GraphContextSelection } from "./graph";

export type FragmentOrigin = "DERIVED" | "MANUAL" | "OVERRIDE";

export interface EntryReference {
  entryId: string;
  revision: number;
}

export interface Fragment {
  entries: EntryReference[];
  origin: FragmentOrigin;
  linkedEntryId: string | null;
  title: string;
  text: string;
  startOffset: number | null;
  endOffset: number | null;
  truncated: boolean;
  citations: DocumentCitation[];
}

export type ExclusionReason =
  | "NOT_AVAILABLE"
  | "REVISION_CHANGED"
  | "EDITORIAL_DISABLED"
  | "CANDIDATE_BUDGET"
  | "FRAGMENT_BUDGET"
  | "CHARACTER_BUDGET"
  | "ORIGINAL_UNAVAILABLE";

export interface ContextResponse {
  contextId: string;
  profileId: string;
  profileRevision: number;
  effective: Record<string, number | boolean>;
  fragments: Fragment[];
  graphFragments: GraphContextFragment[];
  graphExclusions: { definitionId: string; reason: string }[];
  exclusions: { entryId: string; reason: ExclusionReason }[];
  returnedCodePoints: number;
}

export type AnswerReason =
  | "GENERATED"
  | "SOURCES_ONLY"
  | "NO_MATCHES"
  | "NO_CONTEXT"
  | "CHAT_UNAVAILABLE"
  | "CALLS_DISABLED";

export interface AnswerResponse {
  answerId: string;
  profileId: string;
  profileRevision: number;
  reason: AnswerReason;
  generated: { text: string; citedSourceIds: string[] } | null;
  sources: {
    id: string;
    fragment: Fragment | null;
    graphFragment: GraphContextFragment | null;
    label?: string | null;
  }[];
  search: SearchResponse | null;
  context: ContextResponse | null;
  effective: Record<string, number>;
  usage: {
    calls: number;
    inputTokens: number | null;
    outputTokens: number | null;
    unknown: boolean;
  };
}

export interface AnswerRequest {
  profileId: string;
  question: string;
  sourceId?: string | null;
  limit?: number | null;
  graph?: GraphContextSelection | null;
}

export interface HookExecution {
  scriptVersionId: string;
  groupId: string;
  groupRevision: number;
  outcome: "EXECUTED" | "GUARD_NOT_MATCHED" | "ERROR";
}

/** The fields every runtime journal event shares; each journal adds its own counts. */
export interface JournalEvent {
  id: string;
  profileId: string;
  profileRevision: number;
  actorId: string;
  type: string;
  outcome: "EXECUTED" | "ERROR";
  executions: HookExecution[];
  [count: string]: unknown;
}

export type CallState = "RESERVED" | "COMPLETED" | "FAILED" | "UNKNOWN" | "ACKNOWLEDGED";

export interface AnswerCall {
  id: string;
  answerId: string;
  profileId: string;
  providerConfigurationId: string;
  model: string;
  predictedInputTokens: number;
  inputTokens: number | null;
  outputTokens: number | null;
  state: CallState;
  createdAt: string;
  expiresAt: string;
  completedAt: string | null;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
}

export interface QueryEmbeddingCall {
  id: string;
  queryId: string;
  embeddingProfileId: string;
  providerConfigurationId: string;
  modelSpace: string;
  state: CallState;
  predictedTokens: number;
  actualTokens: number | null;
  createdAt: string;
  expiresAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
}

/** One rerank model request, metadata only: no query, no document text, no key. */
export interface RerankCall {
  id: string;
  queryId: string;
  searchProfileId: string;
  searchProfileRevision: number;
  providerConfigurationId: string;
  providerRevision: number;
  protocol: string;
  model: string;
  candidates: number;
  kept: number | null;
  predictedTokens: number;
  reportedTokens: number | null;
  state: "RESERVED" | "COMPLETED" | "FAILED" | "UNKNOWN";
  failureCode: RerankReason | null;
  providerStatus: number | null;
  latencyMilliseconds: number | null;
  createdAt: string;
  completedAt: string | null;
}

export interface RetrievalReportRow {
  queryId: string;
  profileId: string;
  profileRevision: number;
  actorId: string;
  retrieval: SearchResponse["retrieval"] & {
    estimatedTokens?: number | null;
    model?: string | null;
  };
  createdAt: string;
}

export interface QueryCacheEntry {
  id: string;
  modelSpace: string;
  inputIdentity: string;
  dimensions: number;
  reportedTokens: number | null;
  createdAt: string;
  expiresAt: string;
}

export interface RetrievalStatistics {
  reports: number;
  calls: number;
  unresolvedCalls: number;
  unknownUsageCalls: number;
  reportedInputTokens: number;
  cachedVectors: number;
  expiredVectors: number;
  cachedVectorBytes: number;
}

/** The journals, each named by the path segment the backend serves it under. */
export type JournalKind =
  "search-events" | "context-events" | "answer-events" | "original-read-events";

export const answersApi = {
  availableAnswerProfiles: (workspaceId: string, page: PageRequest) =>
    api.send<{ id: string; name: string }[]>(
      "GET",
      workspacePath(workspaceId, `/answer-profiles/available?${pageQuery(page)}`),
    ),
  answer: (workspaceId: string, request: AnswerRequest) =>
    api.send<AnswerResponse>("POST", workspacePath(workspaceId, "/answers"), request),

  journal: (workspaceId: string, kind: JournalKind, page: PageRequest) =>
    api.send<JournalEvent[]>("GET", workspacePath(workspaceId, `/${kind}?${pageQuery(page)}`)),
  answerCalls: (workspaceId: string, page: PageRequest) =>
    api.send<AnswerCall[]>("GET", workspacePath(workspaceId, `/answer-calls?${pageQuery(page)}`)),
  acknowledgeAnswerCall: (workspaceId: string, callId: string) =>
    api.send<void>("POST", workspacePath(workspaceId, `/answer-calls/${callId}/acknowledgement`)),

  retrievalStatistics: (workspaceId: string) =>
    api.send<RetrievalStatistics>("GET", workspacePath(workspaceId, "/retrieval/statistics")),
  retrievalReports: (workspaceId: string, page: PageRequest) =>
    api.send<RetrievalReportRow[]>(
      "GET",
      workspacePath(workspaceId, `/retrieval/reports?${pageQuery(page)}`),
    ),
  queryCalls: (workspaceId: string, page: PageRequest) =>
    api.send<QueryEmbeddingCall[]>(
      "GET",
      workspacePath(workspaceId, `/retrieval/calls?${pageQuery(page)}`),
    ),
  rerankCalls: (workspaceId: string, page: PageRequest) =>
    api.send<RerankCall[]>(
      "GET",
      workspacePath(workspaceId, `/retrieval/rerank-calls?${pageQuery(page)}`),
    ),
  acknowledgeQueryCall: (workspaceId: string, callId: string) =>
    api.send<void>("POST", workspacePath(workspaceId, `/retrieval/calls/${callId}/acknowledge`)),
  queryCache: (workspaceId: string, page: PageRequest) =>
    api.send<QueryCacheEntry[]>(
      "GET",
      workspacePath(workspaceId, `/retrieval/cache?${pageQuery(page)}`),
    ),
  clearQueryCache: (workspaceId: string, expiredOnly: boolean) =>
    api.send<number>(
      "DELETE",
      workspacePath(workspaceId, `/retrieval/cache?expiredOnly=${expiredOnly}`),
    ),
};
