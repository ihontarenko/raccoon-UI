// Retrieval evaluation: suites of questions with the documents that should answer them, run against
// one or more search profiles and scored — hit rate, recall, reciprocal rank — against thresholds.
// See `.scratch/ui-contracts-admin.md` §11.

import { api, pageQuery, workspacePath, type PageRequest } from "./api";
import type { RetrievalMode } from "./contracts";

export type Expectation = "RELEVANT" | "EMPTY";

export interface EvaluationTarget {
  documentId: string;
  versionId: string;
}

export interface EvaluationQuestion {
  id: string;
  text: string;
  tags: string[];
  expectation: Expectation;
  relevant: EvaluationTarget[];
}

export interface EvaluationSelection {
  profileId: string;
  mode: RetrievalMode;
}

export interface Thresholds {
  hitRate: number;
  recall: number;
  meanReciprocalRank: number;
  maximumUnexpectedResponseRate: number;
}

export interface SuiteConfiguration {
  questions: EvaluationQuestion[];
  selections: EvaluationSelection[];
  sourceId: string | null;
  readProfileId: string;
  cutoff: number;
  maximumSearches: number;
  maximumEmbeddingCalls: number;
  maximumEmbeddingTokens: number;
  maximumDurationMilliseconds: number;
  thresholds: Thresholds;
  scriptGroupIds: string[];
  enabled: boolean;
}

export interface Suite {
  id: string;
  name: string;
  revision: number;
  configuration: SuiteConfiguration;
}

export type RunState = "RUNNING" | "COMPLETED" | "STOPPED" | "CANCELLED" | "FAILED";

export interface RunLimits {
  maximumSearches: number;
  maximumEmbeddingCalls: number;
  maximumEmbeddingTokens: number;
  maximumDurationMilliseconds: number;
}

/** One returned hit; `citation` names the original document it came from, absent for an editorial entry. */
export interface EvaluationReference {
  entryId: string;
  entryRevision: number;
  score: number | null;
  citation: { documentId: string; versionId: string; sourceId: string; externalId: string; startPage: number | null; endPage: number | null } | null;
  citationState: "VERIFIED" | "INVALID" | "UNVERIFIED" | "EDITORIAL";
}

export interface Assessment {
  returnedHits: number;
  distinctDocuments: number;
  relevantDocuments: number;
  foundRelevantDocuments: number;
  hit: number | null;
  recall: number | null;
  reciprocalRank: number | null;
  unexpectedResponse: boolean | null;
  references: EvaluationReference[];
}

export interface RunResult {
  position: number;
  questionId: string;
  tags: string[];
  selection: EvaluationSelection;
  profileRevision: number;
  queryId: string | null;
  assessment: Assessment | null;
  embeddingCalls: number;
  reportedTokens: number | null;
  elapsedMilliseconds: number;
  failure: string | null;
}

export interface RunSummary {
  selection: EvaluationSelection;
  plannedCases: number;
  completedCases: number;
  failedCases: number;
  hitRate: number | null;
  recall: number | null;
  meanReciprocalRank: number | null;
  unexpectedResponseRate: number | null;
  unverifiedCitations: number;
  invalidCitations: number;
  fallbackCases: number;
  passed: boolean;
}

export interface Run {
  id: string;
  suiteId: string;
  suiteRevision: number;
  revision: number;
  actorId: string;
  state: RunState;
  reason: string | null;
  limits: RunLimits;
  effectiveLimits: RunLimits | null;
  results: RunResult[];
  summaries: RunSummary[];
  createdAt: string;
  completedAt: string | null;
}

export interface EvaluationEvent {
  id: string;
  type: string;
  metadata: { completedSearches: number; embeddingCalls: number; knownInputTokens: number; unknownUsage: boolean };
  outcome: "EXECUTED" | "ERROR";
}

/** A document a run names, by its latest title and its path inside its source. */
export interface RunDocument {
  documentId: string;
  sourceId: string;
  title: string;
  externalId: string;
  removed: boolean;
}

/** What a run was frozen against; the suite as it stood carries each question's text and expectations. */
export interface RunPlan {
  suite: Suite;
}

export type DraftLanguage = "UK" | "EN";

/** An answer profile whose chat model can draft questions now. */
export interface DraftingModel {
  answerProfileId: string;
  answerProfileName: string;
  providerName: string;
  model: string;
}

export interface DraftRequest {
  answerProfileId: string;
  documentIds: string[];
  count: number;
  language: DraftLanguage;
}

export interface DraftEstimate {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  maximumOutputTokens: number;
  maximumTotalTokens: number;
  includedChunks: number;
  availableChunks: number;
  model: string;
}

/** A proposed question: the document version that answers it and, when the model named one, the chunk. */
export interface QuestionDraft {
  text: string;
  documentId: string;
  versionId: string;
  documentTitle: string;
  chunkNumber: number | null;
  startLine: number | null;
  endLine: number | null;
  startPage: number | null;
  endPage: number | null;
  excerpt: string | null;
}

export interface QuestionDrafts {
  drafts: QuestionDraft[];
  discarded: number;
  inputTokens: number | null;
  outputTokens: number | null;
  model: string;
}

const base = (workspaceId: string) => workspacePath(workspaceId, "/retrieval/evaluation");

export const evaluationApi = {
  suites: (workspaceId: string, page: PageRequest) => api.send<Suite[]>("GET", `${base(workspaceId)}/suites?${pageQuery(page)}`),
  suite: (workspaceId: string, suiteId: string) => api.send<Suite>("GET", `${base(workspaceId)}/suites/${suiteId}`),
  createSuite: (workspaceId: string, name: string, configuration: SuiteConfiguration) =>
    api.send<Suite>("POST", `${base(workspaceId)}/suites`, { name, revision: 0, configuration }),
  saveSuite: (workspaceId: string, suite: Suite, name: string, configuration: SuiteConfiguration) =>
    api.send<Suite>("PUT", `${base(workspaceId)}/suites/${suite.id}`, { name, revision: suite.revision, configuration }),
  /** Synchronous: the server runs every search, scores it and returns the finished run. */
  runSuite: (workspaceId: string, suiteId: string) => api.send<Run>("POST", `${base(workspaceId)}/suites/${suiteId}/runs`),
  /** Newest first; `suiteId` narrows the list to one suite's runs. */
  runs: (workspaceId: string, page: PageRequest, suiteId?: string) =>
    api.send<Run[]>("GET", `${base(workspaceId)}/runs?${pageQuery(page)}${suiteId === undefined ? "" : `&suiteId=${suiteId}`}`),
  runPlan: (workspaceId: string, runId: string) => api.send<RunPlan>("GET", `${base(workspaceId)}/runs/${runId}/plan`),
  runDocuments: (workspaceId: string, runId: string) => api.send<RunDocument[]>("GET", `${base(workspaceId)}/runs/${runId}/documents`),
  draftingModels: (workspaceId: string) => api.send<DraftingModel[]>("GET", `${base(workspaceId)}/drafting/models`),
  estimateDrafts: (workspaceId: string, request: DraftRequest) => api.send<DraftEstimate>("POST", `${base(workspaceId)}/drafting/estimate`, request),
  /** One admitted, journalled model call; nothing is saved until the suite is. */
  draftQuestions: (workspaceId: string, request: DraftRequest) => api.send<QuestionDrafts>("POST", `${base(workspaceId)}/drafting/drafts`, request),
  run: (workspaceId: string, runId: string) => api.send<Run>("GET", `${base(workspaceId)}/runs/${runId}`),
  events: (workspaceId: string, runId: string, page: PageRequest) =>
    api.send<EvaluationEvent[]>("GET", `${base(workspaceId)}/runs/${runId}/events?${pageQuery(page)}`),
  cancelRun: (workspaceId: string, run: Run) => api.send<Run>("POST", `${base(workspaceId)}/runs/${run.id}/cancel`, { revision: run.revision }),
  /**
   * Closes a cancelled run that never finished — its worker died — once its deadline and the call grace
   * have passed, settling each search still in progress with the usage that was actually reported.
   * Installation administration only.
   */
  settleCancelledRun: (workspaceId: string, run: Run) =>
    api.send<Run>("POST", `${base(workspaceId)}/runs/${run.id}/settle-cancelled`, { revision: run.revision }),
  removeRun: (workspaceId: string, run: Run) => api.send<void>("DELETE", `${base(workspaceId)}/runs/${run.id}?revision=${run.revision}`),
};
