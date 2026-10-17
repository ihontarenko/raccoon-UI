import { declareText } from "../translations/translate";
import type { CodeLabels } from "./format";

// The words server codes are shown with when more than one screen shows them. Each table mirrors one server enum;
// a code the table does not list yet is still readable through `labelOfCode`, humanized from the constant.

/** A model call's state — answers, query embeddings, reranks and vector batches: `answers/AnswerCalls`, `search/RetrievalDiagnostics`. */
export const MODEL_CALL_STATES: CodeLabels = {
  RESERVED: declareText("codes.callState.reserved", "Reserved"),
  COMPLETED: declareText("codes.callState.completed", "Completed"),
  FAILED: declareText("codes.callState.failed", "Failed"),
  UNKNOWN: declareText("codes.callState.unknown", "Unknown"),
  ACKNOWLEDGED: declareText("codes.callState.acknowledged", "Acknowledged"),
};

/**
 * A runtime journal's event types: the union of `SearchEventType`, `ContextEventType`, `AnswerEventType`,
 * `ReadEventType`, `ProcessingEventType`, `EmbeddingEventType` and `EvaluationEventType`, which share their names.
 */
export const RUNTIME_EVENT_TYPES: CodeLabels = {
  STARTED: declareText("codes.eventType.started", "Started"),
  COMPLETED: declareText("codes.eventType.completed", "Completed"),
  FAILED: declareText("codes.eventType.failed", "Failed"),
  STOPPED: declareText("codes.eventType.stopped", "Stopped"),
  CANCELLED: declareText("codes.eventType.cancelled", "Cancelled"),
  FALLBACK: declareText("codes.eventType.fallback", "Fallback"),
  BEFORE_RETURN: declareText("codes.eventType.beforeReturn", "Before return"),
  BEFORE_PROVIDER_ADMISSION: declareText("codes.eventType.beforeProviderAdmission", "Before provider admission"),
  BEFORE_SEARCH: declareText("codes.eventType.beforeSearch", "Before search"),
  AFTER_SEARCH: declareText("codes.eventType.afterSearch", "After search"),
  BEFORE_CONTEXT: declareText("codes.eventType.beforeContext", "Before context"),
  AFTER_CONTEXT: declareText("codes.eventType.afterContext", "After context"),
  BEFORE_PROMPT: declareText("codes.eventType.beforePrompt", "Before prompt"),
  AFTER_PROMPT: declareText("codes.eventType.afterPrompt", "After prompt"),
  BEFORE_MODEL: declareText("codes.eventType.beforeModel", "Before model"),
  AFTER_MODEL: declareText("codes.eventType.afterModel", "After model"),
  BEFORE_CITATIONS: declareText("codes.eventType.beforeCitations", "Before citations"),
  AFTER_CITATIONS: declareText("codes.eventType.afterCitations", "After citations"),
  MODEL_RESPONSE_LIMIT_REACHED: declareText("codes.eventType.modelResponseLimitReached", "Model response limit reached"),
  BEFORE_QUERY: declareText("codes.eventType.beforeQuery", "Before query"),
  AFTER_QUERY: declareText("codes.eventType.afterQuery", "After query"),
  BEFORE_ROUTING: declareText("codes.eventType.beforeRouting", "Before routing"),
  AFTER_ROUTING: declareText("codes.eventType.afterRouting", "After routing"),
  BEFORE_INDEX_CHECK: declareText("codes.eventType.beforeIndexCheck", "Before index check"),
  AFTER_INDEX_CHECK: declareText("codes.eventType.afterIndexCheck", "After index check"),
  BEFORE_QUERY_TOKENIZE: declareText("codes.eventType.beforeQueryTokenize", "Before query tokenize"),
  AFTER_QUERY_TOKENIZE: declareText("codes.eventType.afterQueryTokenize", "After query tokenize"),
  BEFORE_QUERY_CACHE: declareText("codes.eventType.beforeQueryCache", "Before query cache"),
  AFTER_QUERY_CACHE: declareText("codes.eventType.afterQueryCache", "After query cache"),
  BEFORE_QUERY_EMBEDDING: declareText("codes.eventType.beforeQueryEmbedding", "Before query embedding"),
  AFTER_QUERY_EMBEDDING: declareText("codes.eventType.afterQueryEmbedding", "After query embedding"),
  BEFORE_QUERY_RESERVATION: declareText("codes.eventType.beforeQueryReservation", "Before query reservation"),
  BEFORE_QUERY_STORE: declareText("codes.eventType.beforeQueryStore", "Before query store"),
  AFTER_QUERY_STORE: declareText("codes.eventType.afterQueryStore", "After query store"),
  BEFORE_LEXICAL: declareText("codes.eventType.beforeLexical", "Before lexical"),
  AFTER_LEXICAL: declareText("codes.eventType.afterLexical", "After lexical"),
  BEFORE_SEMANTIC: declareText("codes.eventType.beforeSemantic", "Before semantic"),
  AFTER_SEMANTIC: declareText("codes.eventType.afterSemantic", "After semantic"),
  BEFORE_FUSION: declareText("codes.eventType.beforeFusion", "Before fusion"),
  AFTER_FUSION: declareText("codes.eventType.afterFusion", "After fusion"),
  BEFORE_RERANK: declareText("codes.eventType.beforeRerank", "Before rerank"),
  AFTER_RERANK: declareText("codes.eventType.afterRerank", "After rerank"),
  RERANK_SKIPPED: declareText("codes.eventType.rerankSkipped", "Rerank skipped"),
  RERANK_FALLBACK: declareText("codes.eventType.rerankFallback", "Rerank fallback"),
  BEFORE_SELECTION: declareText("codes.eventType.beforeSelection", "Before selection"),
  AFTER_SELECTION: declareText("codes.eventType.afterSelection", "After selection"),
  BEFORE_MERGE: declareText("codes.eventType.beforeMerge", "Before merge"),
  AFTER_MERGE: declareText("codes.eventType.afterMerge", "After merge"),
  BEFORE_ORIGINAL_READ: declareText("codes.eventType.beforeOriginalRead", "Before original read"),
  AFTER_ORIGINAL_READ: declareText("codes.eventType.afterOriginalRead", "After original read"),
  BEFORE_FRAGMENT: declareText("codes.eventType.beforeFragment", "Before fragment"),
  AFTER_FRAGMENT: declareText("codes.eventType.afterFragment", "After fragment"),
  BEFORE_READ: declareText("codes.eventType.beforeRead", "Before read"),
  AFTER_READ: declareText("codes.eventType.afterRead", "After read"),
  BEFORE_VERIFICATION: declareText("codes.eventType.beforeVerification", "Before verification"),
  AFTER_VERIFICATION: declareText("codes.eventType.afterVerification", "After verification"),
  BEFORE_DECODE: declareText("codes.eventType.beforeDecode", "Before decode"),
  AFTER_DECODE: declareText("codes.eventType.afterDecode", "After decode"),
  BEFORE_STEP: declareText("codes.eventType.beforeStep", "Before step"),
  AFTER_STEP: declareText("codes.eventType.afterStep", "After step"),
  BEFORE_PUBLICATION: declareText("codes.eventType.beforePublication", "Before publication"),
  INDEX_GENERATION_STORED: declareText("codes.eventType.indexGenerationStored", "Index generation stored"),
  STRUCTURE_FALLBACK: declareText("codes.eventType.structureFallback", "Structure fallback"),
  PARSE_OBSERVATION: declareText("codes.eventType.parseObservation", "Parse observation"),
  BEFORE_TOKENIZE: declareText("codes.eventType.beforeTokenize", "Before tokenize"),
  AFTER_TOKENIZE: declareText("codes.eventType.afterTokenize", "After tokenize"),
  VECTOR_STARTED: declareText("codes.eventType.vectorStarted", "Vector started"),
  BEFORE_REUSE: declareText("codes.eventType.beforeReuse", "Before reuse"),
  AFTER_REUSE: declareText("codes.eventType.afterReuse", "After reuse"),
  BEFORE_RESERVATION: declareText("codes.eventType.beforeReservation", "Before reservation"),
  BEFORE_VECTORIZE: declareText("codes.eventType.beforeVectorize", "Before vectorize"),
  AFTER_VECTORIZE: declareText("codes.eventType.afterVectorize", "After vectorize"),
  BEFORE_STORE: declareText("codes.eventType.beforeStore", "Before store"),
  AFTER_STORE: declareText("codes.eventType.afterStore", "After store"),
  VECTOR_COMPLETED: declareText("codes.eventType.vectorCompleted", "Vector completed"),
  VECTOR_FAILED: declareText("codes.eventType.vectorFailed", "Vector failed"),
  BEFORE_ASSESSMENT: declareText("codes.eventType.beforeAssessment", "Before assessment"),
  AFTER_ASSESSMENT: declareText("codes.eventType.afterAssessment", "After assessment"),
  BEFORE_REPORT: declareText("codes.eventType.beforeReport", "Before report"),
};

/** How a stage's scripts ran, and how one script binding ran: `automation/ScriptStageRunner`. */
export const STAGE_OUTCOMES: CodeLabels = {
  EXECUTED: declareText("codes.stageOutcome.executed", "Executed"),
  GUARD_NOT_MATCHED: declareText("codes.stageOutcome.guardNotMatched", "Guard not matched"),
  ERROR: declareText("codes.stageOutcome.error", "Error"),
};

/** A search's retrieval mode: `search/RetrievalPolicy.Mode`. */
export const RETRIEVAL_MODES: CodeLabels = {
  LEXICAL: declareText("codes.retrievalMode.lexical", "Lexical"),
  SEMANTIC: declareText("codes.retrievalMode.semantic", "Semantic"),
  HYBRID: declareText("codes.retrievalMode.hybrid", "Hybrid"),
  AUTO: declareText("codes.retrievalMode.auto", "Auto"),
};

/** Why a search ran in the mode it did: `search/RetrievalReport.Reason`. */
export const RETRIEVAL_REASONS: CodeLabels = {
  SELECTED: declareText("codes.retrievalReason.selected", "Selected"),
  AUTOMATIC_POLICY: declareText("codes.retrievalReason.automaticPolicy", "Automatic policy"),
  INDEX_UNAVAILABLE: declareText("codes.retrievalReason.indexUnavailable", "Index unavailable"),
  MODEL_UNAVAILABLE: declareText("codes.retrievalReason.modelUnavailable", "Model unavailable"),
  MODEL_CHANGED: declareText("codes.retrievalReason.modelChanged", "Model changed"),
  INDEX_SCAN_LIMIT: declareText("codes.retrievalReason.indexScanLimit", "Index scan limit"),
  QUERY_BUDGET: declareText("codes.retrievalReason.queryBudget", "Query budget"),
  QUERY_USAGE_UNKNOWN: declareText("codes.retrievalReason.queryUsageUnknown", "Query usage unknown"),
  QUERY_IN_FLIGHT: declareText("codes.retrievalReason.queryInFlight", "Query in flight"),
  PROVIDER_UNAVAILABLE: declareText("codes.retrievalReason.providerUnavailable", "Provider unavailable"),
  PROVIDER_RATE_LIMIT: declareText("codes.retrievalReason.providerRateLimit", "Provider rate limit"),
  INVALID_QUERY_VECTOR: declareText("codes.retrievalReason.invalidQueryVector", "Invalid query vector"),
};

/** Where an indexed entry came from: `search/KnowledgeSearch.Origin`. */
export const ENTRY_ORIGINS: CodeLabels = {
  DERIVED: declareText("codes.entryOrigin.derived", "Derived"),
  MANUAL: declareText("codes.entryOrigin.manual", "Manual"),
  OVERRIDE: declareText("codes.entryOrigin.override", "Override"),
};

/** How exact a token count is: `embeddings/TokenCounter.Quality`. */
export const TOKEN_QUALITIES: CodeLabels = {
  EXACT: declareText("codes.tokenQuality.exact", "Exact"),
  APPROXIMATE: declareText("codes.tokenQuality.approximate", "Approximate"),
  UNKNOWN: declareText("codes.tokenQuality.unknown", "Unknown"),
};

/** When a changed system parameter is first read: the `changeEffect` of `settings/SystemParameterCatalogue`. */
export const CHANGE_EFFECTS: CodeLabels = {
  IMMEDIATE: declareText("codes.changeEffect.immediate", "Immediate"),
  RESTART_REQUIRED: declareText("codes.changeEffect.restartRequired", "Restart required"),
  NEXT_ANSWER: declareText("codes.changeEffect.nextAnswer", "Next answer"),
  NEXT_AUTOMATIC_DISPATCH: declareText("codes.changeEffect.nextAutomaticDispatch", "Next automatic dispatch"),
  NEXT_CHAT_TRANSPORT: declareText("codes.changeEffect.nextChatTransport", "Next chat transport"),
  NEXT_CONTEXT: declareText("codes.changeEffect.nextContext", "Next context"),
  NEXT_CREDENTIAL: declareText("codes.changeEffect.nextCredential", "Next credential"),
  NEXT_EVALUATION: declareText("codes.changeEffect.nextEvaluation", "Next evaluation"),
  NEXT_INDEX_WRITE: declareText("codes.changeEffect.nextIndexWrite", "Next index write"),
  NEXT_JOB: declareText("codes.changeEffect.nextJob", "Next job"),
  NEXT_MCP_CALL: declareText("codes.changeEffect.nextMcpCall", "Next MCP call"),
  NEXT_MCP_REQUEST: declareText("codes.changeEffect.nextMcpRequest", "Next MCP request"),
  NEXT_ORIGINAL_READ: declareText("codes.changeEffect.nextOriginalRead", "Next original read"),
  NEXT_PREFLIGHT: declareText("codes.changeEffect.nextPreflight", "Next preflight"),
  NEXT_PROCESSING_JOB: declareText("codes.changeEffect.nextProcessingJob", "Next processing job"),
  NEXT_PROVIDER_ADMISSION: declareText("codes.changeEffect.nextProviderAdmission", "Next provider admission"),
  NEXT_REQUEST: declareText("codes.changeEffect.nextRequest", "Next request"),
  NEXT_RETRIEVAL_EVALUATION: declareText("codes.changeEffect.nextRetrievalEvaluation", "Next retrieval evaluation"),
  NEXT_SCAN: declareText("codes.changeEffect.nextScan", "Next scan"),
  NEXT_SEARCH: declareText("codes.changeEffect.nextSearch", "Next search"),
  NEXT_SUBMISSION: declareText("codes.changeEffect.nextSubmission", "Next submission"),
  NEXT_WORKER_POLL: declareText("codes.changeEffect.nextWorkerPoll", "Next worker poll"),
};

/** What an AI provider can do: `AiCapability`. */
export const AI_CAPABILITIES: CodeLabels = {
  CHAT: declareText("codes.aiCapability.chat", "Chat"),
  EMBEDDINGS: declareText("codes.aiCapability.embeddings", "Embeddings"),
  RERANK: declareText("codes.aiCapability.rerank", "Rerank"),
};
