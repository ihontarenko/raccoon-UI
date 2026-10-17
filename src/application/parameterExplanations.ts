// What every configuration parameter is, what it affects, its safe value, what its extremes do and an
// example — the one catalogue behind every "About …" button. Written from the backend's own validation and
// use of each value (RetrievalPolicy, ManagedQueryEmbeddings, PostgresSemanticRetrieval, the profile
// catalogues, ProviderRateLimits, SystemParameterCatalogue, the scanners), not from the field names.
//
// Keys are "<scope>:<path>": a profile kind and its configuration path ("search:retrieval.semantic.
// maximumDistance"), or one of the operational scopes below with its field or setting key. A parameter
// without a written entry still gets one, built from what the server says about it, so a button never
// opens on nothing.
//
// Every sentence is declared, not rendered: the catalogue is built when the module loads, and the dialog says
// each text in the viewer's language when it opens. Numbers, ranges and identifiers stay plain strings.

import type {
  ExplanationExtreme,
  ExplanationText,
  ParameterExplanationContent,
} from "../ui/components/ParameterExplanation";
import type { ProfileKind } from "../lib/profiles";
import { declareText, type DeclaredText } from "../translations/translate";

export type ExplanationScope =
  ProfileKind | "provider" | "call-limits" | "shared-budget" | "system" | "scanning" | "web-crawl" | "evaluation";

type Entry = ParameterExplanationContent;

const trap = (when: ExplanationText, then: ExplanationText): ExplanationExtreme => ({
  when,
  then,
  trap: true,
});
const plain = (when: ExplanationText, then: ExplanationText): ExplanationExtreme => ({
  when,
  then,
});

// ---------------------------------------------------------------------------------------------------------
// Shared by several profile kinds. Each use writes its own sentences rather than filling a noun into one:
// a noun dropped into a sentence reads well in English and breaks the grammar of most other languages.

function scriptGroups(texts: {
  what: DeclaredText;
  affects: DeclaredText;
  refused: DeclaredText;
}): Entry {
  return {
    title: declareText("explanations.shared.scriptGroups.title", "Script groups"),
    what: texts.what,
    affects: texts.affects,
    safeValue: declareText(
      "explanations.shared.scriptGroups.safeValue",
      "None, unless a script is needed for a policy such as refusing certain questions or narrowing a budget per caller.",
    ),
    extremes: [
      plain(
        declareText("explanations.shared.scriptGroups.extremes.none.when", "None"),
        declareText(
          "explanations.shared.scriptGroups.extremes.none.then",
          "Nothing runs; the profile's own values apply as they are.",
        ),
      ),
      trap(
        declareText(
          "explanations.shared.scriptGroups.extremes.alwaysRefuses.when",
          "A group whose script always refuses",
        ),
        texts.refused,
      ),
    ],
    example: declareText(
      "explanations.shared.scriptGroups.example",
      "A group that narrows the result count for agent callers to 5 keeps assistant answers short without changing the profile.",
    ),
  };
}

function enabledSwitch(texts: {
  what: DeclaredText;
  affects: DeclaredText;
  refused: DeclaredText;
  example: DeclaredText;
}): Entry {
  return {
    title: declareText("explanations.shared.enabled.title", "Enabled"),
    what: texts.what,
    affects: texts.affects,
    safeValue: declareText(
      "explanations.shared.enabled.safeValue",
      "On. Turn it off to retire a profile without deleting what it produced.",
    ),
    extremes: [trap(declareText("explanations.shared.off", "Off"), texts.refused)],
    example: texts.example,
  };
}

function statementDeadline(texts: { what: DeclaredText; affects: DeclaredText }): Entry {
  return {
    title: declareText("explanations.shared.statementDeadline.title", "Statement deadline"),
    what: texts.what,
    affects: texts.affects,
    safeValue: declareText(
      "explanations.shared.statementDeadline.safeValue",
      "1000–2000 ms. Raise it only when a large workspace times out on ordinary requests.",
    ),
    extremes: [
      trap(
        declareText("explanations.shared.minimumTenMilliseconds", "10 ms (the minimum)"),
        declareText(
          "explanations.shared.statementDeadline.extremes.minimum.then",
          "Almost every statement is cancelled; the stage fails on any real data.",
        ),
      ),
      plain(
        declareText(
          "explanations.shared.statementDeadline.extremes.maximum.when",
          "10000 ms (the maximum)",
        ),
        declareText(
          "explanations.shared.statementDeadline.extremes.maximum.then",
          "Slow statements are tolerated, and a pathological request holds a connection for up to ten seconds.",
        ),
      ),
    ],
    example: declareText(
      "explanations.shared.statementDeadline.example",
      "A workspace with a million index entries may need 2000 ms for a broad keyword search.",
    ),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Search profiles.

const SEARCH: Record<string, Entry> = {
  "retrieval.mode": {
    title: declareText("explanations.search.retrieval.mode.title", "Retrieval mode"),
    what: declareText(
      "explanations.search.retrieval.mode.what",
      "How a search finds candidates by default. LEXICAL matches keywords in the full-text index; SEMANTIC embeds the question with a model and finds the closest vectors; HYBRID does both and fuses the two lists; AUTO resolves to the automatic mode below.",
    ),
    affects: declareText(
      "explanations.search.retrieval.mode.affects",
      "Which retrieval branches run, and whether a search pays for a model call (meaning search embeds the question). The flow strip above shows the branches that will actually run.",
    ),
    safeValue: declareText(
      "explanations.search.retrieval.mode.safeValue",
      "LEXICAL when nothing is vectorised; HYBRID once vectors are published for the embedding profile.",
    ),
    extremes: [
      plain(
        "LEXICAL",
        declareText(
          "explanations.search.retrieval.mode.extremes.0.then",
          "No provider, no cost, no vectors needed — but synonyms and paraphrases are missed.",
        ),
      ),
      trap(
        declareText(
          "explanations.search.retrieval.mode.extremes.1.when",
          "SEMANTIC or HYBRID with meaning search blocked",
        ),
        declareText(
          "explanations.search.retrieval.mode.extremes.1.then",
          "Every search fails, unless the unavailable policy is LEXICAL, in which case it quietly becomes a keyword search.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.retrieval.mode.example",
      "HYBRID finds “how do I rotate the key” both by the word “rotate” and by a passage that says “replace the credential”.",
    ),
  },
  "retrieval.allowedOverrides": {
    title: declareText("explanations.search.retrieval.allowedOverrides.title", "Allowed overrides"),
    what: declareText(
      "explanations.search.retrieval.allowedOverrides.what",
      "The modes a caller may ask for explicitly — the mode switch on the search page, or an assistant's search request. Asking for the profile's own default mode is always allowed.",
    ),
    affects: declareText(
      "explanations.search.retrieval.allowedOverrides.affects",
      "Which explicit mode requests are accepted. A request for a mode not listed is refused with “The requested retrieval mode is not permitted by this profile”.",
    ),
    safeValue: declareText(
      "explanations.search.retrieval.allowedOverrides.safeValue",
      "Empty for a fixed profile; LEXICAL plus the default mode when people compare modes.",
    ),
    extremes: [
      plain(
        declareText("explanations.search.retrieval.allowedOverrides.extremes.0.when", "Empty"),
        declareText(
          "explanations.search.retrieval.allowedOverrides.extremes.0.then",
          "Only the default mode runs; the mode switch offers nothing else.",
        ),
      ),
      plain(
        declareText(
          "explanations.search.retrieval.allowedOverrides.extremes.1.when",
          "SEMANTIC or HYBRID listed",
        ),
        declareText(
          "explanations.search.retrieval.allowedOverrides.extremes.1.then",
          "The profile then needs its meaning-search section (and fusion for HYBRID), even when the default is LEXICAL.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.retrieval.allowedOverrides.example",
      "Default HYBRID with LEXICAL allowed lets someone check whether a hit came from keywords alone.",
    ),
  },
  "retrieval.automaticMode": {
    title: declareText("explanations.search.retrieval.automaticMode.title", "Automatic mode"),
    what: declareText(
      "explanations.search.retrieval.automaticMode.what",
      "What AUTO means for this profile. There is no classifier and no guess: AUTO is simply this mode.",
    ),
    affects: declareText(
      "explanations.search.retrieval.automaticMode.affects",
      "Only searches whose mode is AUTO — the default when the mode above is AUTO, or a caller asking for AUTO.",
    ),
    safeValue: declareText(
      "explanations.search.retrieval.automaticMode.safeValue",
      "HYBRID when vectors are published; LEXICAL otherwise.",
    ),
    extremes: [
      plain(
        declareText(
          "explanations.search.retrieval.automaticMode.extremes.0.when",
          "Anything but AUTO",
        ),
        declareText(
          "explanations.search.retrieval.automaticMode.extremes.0.then",
          "AUTO cannot point at itself; the server refuses it.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.retrieval.automaticMode.example",
      "Mode AUTO with automatic mode HYBRID lets the profile switch every caller to LEXICAL later by changing one value.",
    ),
  },
  "retrieval.unavailablePolicy": {
    title: declareText(
      "explanations.search.retrieval.unavailablePolicy.title",
      "When meaning search is unavailable",
    ),
    what: declareText(
      "explanations.search.retrieval.unavailablePolicy.what",
      "What a search does when its meaning branch cannot run: no published vectors, the provider not in force or without a key, a token or cost budget refusal, a rate limit, a timeout, too many vectors to scan.",
    ),
    affects: declareText(
      "explanations.search.retrieval.unavailablePolicy.affects",
      "Whether such a search fails (FAIL) or runs as a keyword search and reports why (LEXICAL). Access checks and script refusals are never bypassed either way.",
    ),
    safeValue: declareText(
      "explanations.search.retrieval.unavailablePolicy.safeValue",
      "LEXICAL while a profile is being set up, so a budget mistake degrades instead of breaking every search; FAIL when silent degradation would mislead.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.search.retrieval.unavailablePolicy.extremes.0.when",
          "FAIL with a budget misconfigured",
        ),
        declareText(
          "explanations.search.retrieval.unavailablePolicy.extremes.0.then",
          "Every search through the profile fails — the cost ceiling, token or distance settings below decide this.",
        ),
      ),
      plain(
        "LEXICAL",
        declareText(
          "explanations.search.retrieval.unavailablePolicy.extremes.1.then",
          "Searches keep answering, by keywords; the reason is in the search report and the activity log.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.retrieval.unavailablePolicy.example",
      "With LEXICAL, a provider outage turns hybrid searches into keyword searches instead of errors.",
    ),
  },
  "retrieval.semantic.embeddingProfileId": {
    title: declareText(
      "explanations.search.retrieval.semantic.embeddingProfileId.title",
      "Embedding profile",
    ),
    what: declareText(
      "explanations.search.retrieval.semantic.embeddingProfileId.what",
      "The embedding profile whose model turns the question into a vector. Its provider configuration, model and dimensions define the model space; only vectors made in that same space are read.",
    ),
    affects: declareText(
      "explanations.search.retrieval.semantic.embeddingProfileId.affects",
      "Which provider is called for every meaning search, its token counting and pricing (used by the token and cost checks below), and which published vectors are searched.",
    ),
    safeValue: declareText(
      "explanations.search.retrieval.semantic.embeddingProfileId.safeValue",
      "The embedding profile the documents were vectorised with.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.search.retrieval.semantic.embeddingProfileId.extremes.0.when",
          "A profile with no published vectors",
        ),
        declareText(
          "explanations.search.retrieval.semantic.embeddingProfileId.extremes.0.then",
          "Meaning search finds no eligible vectors and is unavailable — the unavailable policy then decides between failing and keywords.",
        ),
      ),
      trap(
        declareText(
          "explanations.search.retrieval.semantic.embeddingProfileId.extremes.1.when",
          "A profile whose tokenizer is UNKNOWN",
        ),
        declareText(
          "explanations.search.retrieval.semantic.embeddingProfileId.extremes.1.then",
          "The question's tokens cannot be counted, so every meaning search is refused before the model is called.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.retrieval.semantic.embeddingProfileId.example",
      "Documents vectorised with voyage-4-lite at 1024 dimensions are only found by a search naming that same embedding profile.",
    ),
  },
  "retrieval.semantic.queryInputType": {
    title: declareText(
      "explanations.search.retrieval.semantic.queryInputType.title",
      "Query input type",
    ),
    what: declareText(
      "explanations.search.retrieval.semantic.queryInputType.what",
      "The retrieval role sent to the provider with the question: QUERY, DOCUMENT or UNSPECIFIED. Models such as Voyage embed questions and documents slightly differently.",
    ),
    affects: declareText(
      "explanations.search.retrieval.semantic.queryInputType.affects",
      "The question's vector, and therefore closeness. It is part of the query cache identity.",
    ),
    safeValue: declareText(
      "explanations.search.retrieval.semantic.queryInputType.safeValue",
      "QUERY when the documents were embedded as DOCUMENT; UNSPECIFIED when the model has no roles.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.search.retrieval.semantic.queryInputType.extremes.0.when",
          "A role the installed protocol does not support",
        ),
        declareText(
          "explanations.search.retrieval.semantic.queryInputType.extremes.0.then",
          "The model is reported unavailable and meaning search does not run.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.retrieval.semantic.queryInputType.example",
      "Voyage: documents as DOCUMENT, questions as QUERY.",
    ),
  },
  "retrieval.semantic.queryPrefix": {
    title: declareText("explanations.search.retrieval.semantic.queryPrefix.title", "Query prefix"),
    what: declareText(
      "explanations.search.retrieval.semantic.queryPrefix.what",
      "Text put in front of the question, exactly as written, before it is embedded — some models expect an instruction such as “query: ”.",
    ),
    affects: declareText(
      "explanations.search.retrieval.semantic.queryPrefix.affects",
      "The question's vector and its token count. It is part of the query cache identity, separate from the documents' own prefix.",
    ),
    safeValue: declareText(
      "explanations.search.retrieval.semantic.queryPrefix.safeValue",
      "Empty, unless the model's documentation asks for a query instruction.",
    ),
    extremes: [
      plain(
        declareText(
          "explanations.search.retrieval.semantic.queryPrefix.extremes.0.when",
          "A wrong or missing instruction",
        ),
        declareText(
          "explanations.search.retrieval.semantic.queryPrefix.extremes.0.then",
          "Nothing fails, but closeness quietly drops; compare on the evaluation page.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.retrieval.semantic.queryPrefix.example",
      "For an e5 model: “query: ” here and “passage: ” as the embedding profile's input prefix.",
    ),
  },
  "retrieval.semantic.metric": {
    title: declareText("explanations.search.retrieval.semantic.metric.title", "Distance metric"),
    what: declareText(
      "explanations.search.retrieval.semantic.metric.what",
      "How the distance between the question's vector and a document's vector is measured. COSINE: distance = 1 − cosine similarity, from 0 to 2, score = 1 − distance / 2. EUCLIDEAN: straight-line distance from 0 upwards, score = 1 / (1 + distance).",
    ),
    affects: declareText(
      "explanations.search.retrieval.semantic.metric.affects",
      "The order of meaning hits, their scores, and the scale the maximum distance is read on.",
    ),
    safeValue: declareText(
      "explanations.search.retrieval.semantic.metric.safeValue",
      "COSINE — what nearly every text embedding model is trained for.",
    ),
    extremes: [
      plain(
        declareText(
          "explanations.search.retrieval.semantic.metric.extremes.0.when",
          "EUCLIDEAN with unnormalised vectors",
        ),
        declareText(
          "explanations.search.retrieval.semantic.metric.extremes.0.then",
          "Long and short passages are compared by vector length as much as by meaning.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.retrieval.semantic.metric.example",
      "Two passages saying the same thing in other words typically sit at a cosine distance of 0.2–0.4.",
    ),
  },
  "retrieval.semantic.maximumDistance": {
    title: declareText(
      "explanations.search.retrieval.semantic.maximumDistance.title",
      "Maximum distance",
    ),
    what: declareText(
      "explanations.search.retrieval.semantic.maximumDistance.what",
      "An optional ceiling on how far a vector may be from the question and still count as a meaning hit, in the metric's own units. Empty keeps nearest-neighbour behaviour: the closest vectors are taken whatever their distance. A search request may narrow it further; the smaller value applies.",
    ),
    affects: declareText(
      "explanations.search.retrieval.semantic.maximumDistance.affects",
      "Which meaning hits are eligible before fusion and reranking. It does not change keyword hits.",
    ),
    safeValue: declareText(
      "explanations.search.retrieval.semantic.maximumDistance.safeValue",
      "Empty, until it is calibrated against labelled questions on the evaluation page; then for COSINE usually 0.4–0.7.",
    ),
    extremes: [
      trap(
        "0",
        declareText(
          "explanations.search.retrieval.semantic.maximumDistance.extremes.0.then",
          "Only vectors identical to the question match — in practice nothing, so meaning search silently returns no hits.",
        ),
      ),
      trap(
        declareText(
          "explanations.search.retrieval.semantic.maximumDistance.extremes.1.when",
          "Very small, such as 0.05 for COSINE",
        ),
        declareText(
          "explanations.search.retrieval.semantic.maximumDistance.extremes.1.then",
          "Only near-duplicates of the question pass; ordinary paraphrases are dropped.",
        ),
      ),
      plain(
        declareText(
          "explanations.search.retrieval.semantic.maximumDistance.extremes.2.when",
          "2 for COSINE (the largest allowed)",
        ),
        declareText(
          "explanations.search.retrieval.semantic.maximumDistance.extremes.2.then",
          "No filtering at all — the same as empty.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.retrieval.semantic.maximumDistance.example",
      "With COSINE and 0.6, a passage at distance 0.35 is kept and one at 0.8 (barely related) is dropped.",
    ),
  },
  "retrieval.semantic.access": {
    title: declareText("explanations.search.retrieval.semantic.access.title", "Vector access"),
    what: declareText(
      "explanations.search.retrieval.semantic.access.what",
      "How vectors are searched. EXACT compares the question with every eligible vector in the database; approximate indexes are not implemented.",
    ),
    affects: declareText(
      "explanations.search.retrieval.semantic.access.affects",
      "Accuracy (always exact) and cost (proportional to the number of eligible vectors, bounded by the scan ceiling below).",
    ),
    safeValue: declareText(
      "explanations.search.retrieval.semantic.access.safeValue",
      "EXACT — the only choice.",
    ),
    extremes: [],
    example: declareText(
      "explanations.search.retrieval.semantic.access.example",
      "Ten thousand vectors are compared in full on every meaning search.",
    ),
  },
  "retrieval.semantic.maximumQueryTokens": {
    title: declareText(
      "explanations.search.retrieval.semantic.maximumQueryTokens.title",
      "Maximum question tokens",
    ),
    what: declareText(
      "explanations.search.retrieval.semantic.maximumQueryTokens.what",
      "The most tokens one question, prefix included, may have before it is embedded. The smallest of this, the system setting search.maximum-query-embedding-tokens and the provider configuration's maximum tokens applies.",
    ),
    affects: declareText(
      "explanations.search.retrieval.semantic.maximumQueryTokens.affects",
      "Admission of the model call. A longer question is refused for meaning search (a budget refusal) before anything is sent.",
    ),
    safeValue: declareText(
      "explanations.search.retrieval.semantic.maximumQueryTokens.safeValue",
      "2000 — far above any typed question.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.search.retrieval.semantic.maximumQueryTokens.extremes.0.when",
          "Below the length of real questions, such as 5",
        ),
        declareText(
          "explanations.search.retrieval.semantic.maximumQueryTokens.extremes.0.then",
          "Most questions are refused for meaning search and fall back or fail.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.retrieval.semantic.maximumQueryTokens.example",
      "A pasted log excerpt of 3000 tokens is refused for meaning search at 2000 and searched by keywords if the policy allows.",
    ),
  },
  "retrieval.semantic.allowApproximateTokens": {
    title: declareText(
      "explanations.shared.allowApproximateTokenCounts",
      "Allow approximate token counts",
    ),
    what: declareText(
      "explanations.search.retrieval.semantic.allowApproximateTokens.what",
      "Whether a question may be admitted on an estimated token count. The count comes from the embedding profile's tokenizer: TEI counts exactly, CODE_POINT_ESTIMATE estimates from characters, UNKNOWN cannot count at all.",
    ),
    affects: declareText(
      "explanations.search.retrieval.semantic.allowApproximateTokens.affects",
      "Whether meaning search runs at all with an estimating tokenizer. The estimate is never relabelled as exact.",
    ),
    safeValue: declareText(
      "explanations.search.retrieval.semantic.allowApproximateTokens.safeValue",
      "On whenever the embedding profile's tokenizer is CODE_POINT_ESTIMATE — that is, for most hosted providers.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.search.retrieval.semantic.allowApproximateTokens.extremes.0.when",
          "Off with a CODE_POINT_ESTIMATE tokenizer",
        ),
        declareText(
          "explanations.search.retrieval.semantic.allowApproximateTokens.extremes.0.then",
          "Every question is refused before the model is called: meaning search never runs.",
        ),
      ),
      plain(
        declareText(
          "explanations.search.retrieval.semantic.allowApproximateTokens.extremes.1.when",
          "Off with a TEI tokenizer",
        ),
        declareText(
          "explanations.search.retrieval.semantic.allowApproximateTokens.extremes.1.then",
          "Works: the count is exact.",
        ),
      ),
      trap(
        declareText(
          "explanations.search.retrieval.semantic.allowApproximateTokens.extremes.2.when",
          "Any value with an UNKNOWN tokenizer",
        ),
        declareText(
          "explanations.search.retrieval.semantic.allowApproximateTokens.extremes.2.then",
          "Refused regardless — an unknown count never satisfies a budget.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.retrieval.semantic.allowApproximateTokens.example",
      "Voyage through a code-point estimate needs this on; a local Text Embeddings Inference server with its tokenizer endpoint does not.",
    ),
  },
  "retrieval.semantic.allowUnknownUsage": {
    title: declareText("explanations.shared.allowUnknownUsage", "Allow unknown usage"),
    what: declareText(
      "explanations.search.retrieval.semantic.allowUnknownUsage.what",
      "Whether a vector is accepted when the provider's response does not say how many input tokens it billed.",
    ),
    affects: declareText(
      "explanations.search.retrieval.semantic.allowUnknownUsage.affects",
      "What happens after the model call. Off: the vector is not cached and the meaning search is refused (usage unknown), although the call was made and may be billed. On: the vector is used and cached; the usage stays recorded as unknown.",
    ),
    safeValue: declareText(
      "explanations.search.retrieval.semantic.allowUnknownUsage.safeValue",
      "Off for providers that report usage; on for a provider known not to report it.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.search.retrieval.semantic.allowUnknownUsage.extremes.0.when",
          "Off with a provider that never reports usage",
        ),
        declareText(
          "explanations.search.retrieval.semantic.allowUnknownUsage.extremes.0.then",
          "Every meaning search pays for a call and is then refused.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.retrieval.semantic.allowUnknownUsage.example",
      "A self-hosted embedding server that returns vectors without a usage block needs this on.",
    ),
  },
  "retrieval.semantic.maximumQueryCost": {
    title: declareText(
      "explanations.search.retrieval.semantic.maximumQueryCost.title",
      "Maximum question cost",
    ),
    what: declareText(
      "explanations.search.retrieval.semantic.maximumQueryCost.what",
      "An optional ceiling on the price of embedding one question, in the currency of the embedding profile's pricing: price per million input tokens × tokens ÷ 1,000,000. Empty means no cost check.",
    ),
    affects: declareText(
      "explanations.search.retrieval.semantic.maximumQueryCost.affects",
      "Admission of every meaning search, checked before the call and again with the reported usage. The pricing is the embedding profile's, and it must be valid today (UTC).",
    ),
    safeValue: declareText(
      "explanations.search.retrieval.semantic.maximumQueryCost.safeValue",
      "Empty — the provider's rate limits and the account budget already bound spending. Set it only together with current pricing on the embedding profile.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.search.retrieval.semantic.maximumQueryCost.extremes.0.when",
          "Any value while the embedding profile has no pricing",
        ),
        declareText(
          "explanations.search.retrieval.semantic.maximumQueryCost.extremes.0.then",
          "The cost cannot be computed, so every meaning search is refused — the failure behind “meaning search never works”.",
        ),
      ),
      trap(
        declareText(
          "explanations.search.retrieval.semantic.maximumQueryCost.extremes.1.when",
          "Any value once the pricing's “valid until” date has passed",
        ),
        declareText(
          "explanations.search.retrieval.semantic.maximumQueryCost.extremes.1.then",
          "Same: pricing is stale, the cost is unknown, every meaning search is refused.",
        ),
      ),
      trap(
        "0",
        declareText(
          "explanations.search.retrieval.semantic.maximumQueryCost.extremes.2.then",
          "Only free calls are admitted: with a price above zero every question is refused, and without pricing too.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.retrieval.semantic.maximumQueryCost.example",
      "At 0.02 USD per million tokens a 40-token question costs 0.0000008 USD; a ceiling of 0.0001 admits any typed question.",
    ),
  },
  "retrieval.semantic.timeoutMilliseconds": {
    title: declareText(
      "explanations.search.retrieval.semantic.timeoutMilliseconds.title",
      "Question embedding timeout",
    ),
    what: declareText(
      "explanations.search.retrieval.semantic.timeoutMilliseconds.what",
      "How long the provider may take to embed the question. The smallest of this, the embedding profile's call timeout and the system setting search.maximum-query-embedding-milliseconds applies.",
    ),
    affects: declareText(
      "explanations.search.retrieval.semantic.timeoutMilliseconds.affects",
      "Meaning search latency. Past the deadline the call counts as failed and meaning search is unavailable for that request; a call whose outcome is uncertain is never replayed automatically.",
    ),
    safeValue: declareText(
      "explanations.search.retrieval.semantic.timeoutMilliseconds.safeValue",
      "5000–15000 ms for a hosted provider.",
    ),
    extremes: [
      trap(
        declareText("explanations.shared.minimumTenMilliseconds", "10 ms (the minimum)"),
        declareText(
          "explanations.search.retrieval.semantic.timeoutMilliseconds.extremes.0.then",
          "Nearly every call times out; meaning search is effectively off.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.retrieval.semantic.timeoutMilliseconds.example",
      "A provider answering in 300 ms is unaffected by 15000; a slow local model on a laptop may need 30000.",
    ),
  },
  "retrieval.semantic.maximumCandidates": {
    title: declareText(
      "explanations.search.retrieval.semantic.maximumCandidates.title",
      "Meaning candidates",
    ),
    what: declareText(
      "explanations.search.retrieval.semantic.maximumCandidates.what",
      "How many of the closest vectors the meaning branch returns before fusion, reranking and the final cut.",
    ),
    affects: declareText(
      "explanations.search.retrieval.semantic.maximumCandidates.affects",
      "Recall of the meaning branch and the size of the pool fusion and reranking work on. It is independent of the number of results shown.",
    ),
    safeValue: "50–100.",
    extremes: [
      plain(
        "1",
        declareText(
          "explanations.search.retrieval.semantic.maximumCandidates.extremes.0.then",
          "Fusion sees a single meaning hit; HYBRID becomes keywords plus one passage.",
        ),
      ),
      plain(
        "1000",
        declareText(
          "explanations.search.retrieval.semantic.maximumCandidates.extremes.1.then",
          "More database work on every search for candidates nobody reads.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.retrieval.semantic.maximumCandidates.example",
      "100 candidates with 10 results shown lets fusion promote a passage that keyword search ranked 40th.",
    ),
  },
  "retrieval.semantic.maximumScanRecords": {
    title: declareText(
      "explanations.search.retrieval.semantic.maximumScanRecords.title",
      "Vector scan ceiling",
    ),
    what: declareText(
      "explanations.search.retrieval.semantic.maximumScanRecords.what",
      "The most eligible vectors an exact search may compare. The smaller of this and the system setting search.maximum-vector-scan-records applies. It must be at least the meaning candidates.",
    ),
    affects: declareText(
      "explanations.search.retrieval.semantic.maximumScanRecords.affects",
      "Whether meaning search runs at all as the workspace grows: more eligible vectors than the ceiling refuses the branch instead of silently searching a part of it.",
    ),
    safeValue: declareText(
      "explanations.search.retrieval.semantic.maximumScanRecords.safeValue",
      "Comfortably above the workspace's vector count — 10000 by default.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.search.retrieval.semantic.maximumScanRecords.extremes.0.when",
          "Below the number of published vectors",
        ),
        declareText(
          "explanations.search.retrieval.semantic.maximumScanRecords.extremes.0.then",
          "Meaning search is refused on every request (scan limit) — it worked yesterday and stopped when documents were added.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.retrieval.semantic.maximumScanRecords.example",
      "A workspace with 12000 vectors and a ceiling of 10000 never searches by meaning until the ceiling is raised.",
    ),
  },
  "retrieval.semantic.cacheLifetimeSeconds": {
    title: declareText(
      "explanations.search.retrieval.semantic.cacheLifetimeSeconds.title",
      "Question cache lifetime",
    ),
    what: declareText(
      "explanations.search.retrieval.semantic.cacheLifetimeSeconds.what",
      "How long the vector of a question is kept and reused for the same question, prefix, input type and model space.",
    ),
    affects: declareText(
      "explanations.search.retrieval.semantic.cacheLifetimeSeconds.affects",
      "Cost and latency of repeated questions: a cache hit makes no model call and consumes no rate limit.",
    ),
    safeValue: declareText(
      "explanations.search.retrieval.semantic.cacheLifetimeSeconds.safeValue",
      "600 s; up to 86400 for stable workspaces.",
    ),
    extremes: [
      plain(
        "0",
        declareText(
          "explanations.search.retrieval.semantic.cacheLifetimeSeconds.extremes.0.then",
          "No cache reads or writes — every repeated question pays for a model call.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.retrieval.semantic.cacheLifetimeSeconds.example",
      "An evaluation suite run twice within ten minutes embeds each question once.",
    ),
  },
  "retrieval.semantic.maximumConcurrentCalls": {
    title: declareText(
      "explanations.search.retrieval.semantic.maximumConcurrentCalls.title",
      "Concurrent question embeddings",
    ),
    what: declareText(
      "explanations.search.retrieval.semantic.maximumConcurrentCalls.what",
      "How many question embedding calls may be in flight at once in this workspace, across every process. The smaller of this and the system setting search.maximum-concurrent-embedding-calls applies.",
    ),
    affects: declareText(
      "explanations.search.retrieval.semantic.maximumConcurrentCalls.affects",
      "Throughput under load. A search arriving while the limit is in use is refused for meaning search (in flight) rather than queued.",
    ),
    safeValue: "2–4.",
    extremes: [
      plain(
        "1",
        declareText(
          "explanations.search.retrieval.semantic.maximumConcurrentCalls.extremes.0.then",
          "Two people searching at the same moment: one of them gets keyword results or an error.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.retrieval.semantic.maximumConcurrentCalls.example",
      "A team of five searching interactively rarely needs more than 4.",
    ),
  },
  "retrieval.fusion.strategy": {
    title: declareText("explanations.search.retrieval.fusion.strategy.title", "Fusion strategy"),
    what: declareText(
      "explanations.search.retrieval.fusion.strategy.what",
      "How the keyword and meaning lists become one. RECIPROCAL_RANK scores a hit by its position in each list: (k + 1) / (k + position + 1), weighted by branch and summed. WEIGHTED_SCORE adds the branches' own scores, weighted.",
    ),
    affects: declareText(
      "explanations.search.retrieval.fusion.strategy.affects",
      "The order of hybrid results. Hits found by both branches rise; duplicates of the same entry are merged.",
    ),
    safeValue: declareText(
      "explanations.search.retrieval.fusion.strategy.safeValue",
      "RECIPROCAL_RANK — it needs no score calibration.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.search.retrieval.fusion.strategy.extremes.0.when",
          "WEIGHTED_SCORE without SCORE_FRACTION normalisation",
        ),
        declareText(
          "explanations.search.retrieval.fusion.strategy.extremes.0.then",
          "The server refuses to save it: raw keyword ranks are not comparable with vector scores.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.retrieval.fusion.strategy.example",
      "A passage 2nd by keywords and 5th by meaning outranks one that is 1st by keywords only.",
    ),
  },
  "retrieval.fusion.lexicalWeight": {
    title: declareText(
      "explanations.search.retrieval.fusion.lexicalWeight.title",
      "Keyword weight",
    ),
    what: declareText(
      "explanations.search.retrieval.fusion.lexicalWeight.what",
      "How much the keyword list contributes to the fused score, relative to the meaning weight. Only the ratio of the two weights matters.",
    ),
    affects: declareText(
      "explanations.shared.theOrderOfHybridResults",
      "The order of hybrid results.",
    ),
    safeValue: declareText(
      "explanations.search.retrieval.fusion.lexicalWeight.safeValue",
      "1 — equal to the meaning weight.",
    ),
    extremes: [
      trap(
        "0",
        declareText(
          "explanations.shared.refusedByTheServerABranch",
          "Refused by the server: a branch weight must be above zero.",
        ),
      ),
      plain(
        declareText(
          "explanations.search.retrieval.fusion.lexicalWeight.extremes.1.when",
          "1000 against a meaning weight of 1",
        ),
        declareText(
          "explanations.search.retrieval.fusion.lexicalWeight.extremes.1.then",
          "Hybrid results are keyword results with meaning hits appended.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.retrieval.fusion.lexicalWeight.example",
      "2 against 1 favours exact terminology — useful for code identifiers.",
    ),
  },
  "retrieval.fusion.semanticWeight": {
    title: declareText(
      "explanations.search.retrieval.fusion.semanticWeight.title",
      "Meaning weight",
    ),
    what: declareText(
      "explanations.search.retrieval.fusion.semanticWeight.what",
      "How much the meaning list contributes to the fused score, relative to the keyword weight. Only the ratio matters.",
    ),
    affects: declareText(
      "explanations.shared.theOrderOfHybridResults",
      "The order of hybrid results.",
    ),
    safeValue: declareText(
      "explanations.search.retrieval.fusion.semanticWeight.safeValue",
      "1 — equal to the keyword weight.",
    ),
    extremes: [
      trap(
        "0",
        declareText(
          "explanations.shared.refusedByTheServerABranch",
          "Refused by the server: a branch weight must be above zero.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.retrieval.fusion.semanticWeight.example",
      "1.5 against 1 favours paraphrases — useful for prose documentation.",
    ),
  },
  "retrieval.fusion.rankConstant": {
    title: declareText(
      "explanations.search.retrieval.fusion.rankConstant.title",
      "Rank constant (k)",
    ),
    what: declareText(
      "explanations.search.retrieval.fusion.rankConstant.what",
      "The smoothing constant k of reciprocal-rank fusion. A larger k flattens the difference between first and tenth place.",
    ),
    affects: declareText(
      "explanations.search.retrieval.fusion.rankConstant.affects",
      "The order of hybrid results with RECIPROCAL_RANK; it has no effect with WEIGHTED_SCORE.",
    ),
    safeValue: declareText(
      "explanations.search.retrieval.fusion.rankConstant.safeValue",
      "60 — the value the method is usually published with.",
    ),
    extremes: [
      plain(
        "1",
        declareText(
          "explanations.search.retrieval.fusion.rankConstant.extremes.0.then",
          "Top positions dominate: first place is worth twice the second.",
        ),
      ),
      plain(
        "1000",
        declareText(
          "explanations.search.retrieval.fusion.rankConstant.extremes.1.then",
          "Positions barely matter; agreement between the two lists decides.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.retrieval.fusion.rankConstant.example",
      "With k = 60, first place scores 1.0 and tenth about 0.87.",
    ),
  },
  "retrieval.fusion.lexicalCandidates": {
    title: declareText(
      "explanations.search.retrieval.fusion.lexicalCandidates.title",
      "Keyword candidates",
    ),
    what: declareText(
      "explanations.search.retrieval.fusion.lexicalCandidates.what",
      "How many keyword hits enter fusion. The smaller of this and the system setting search.maximum-results applies.",
    ),
    affects: declareText(
      "explanations.search.retrieval.fusion.lexicalCandidates.affects",
      "The keyword side of the hybrid pool; it is separate from the number of results shown.",
    ),
    safeValue: "25.",
    extremes: [
      plain(
        "1",
        declareText(
          "explanations.search.retrieval.fusion.lexicalCandidates.extremes.0.then",
          "Hybrid search sees a single keyword hit.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.retrieval.fusion.lexicalCandidates.example",
      "25 keyword and 100 meaning candidates fused, then cut to 10 results.",
    ),
  },
  "retrieval.rerank.providerConfigurationId": {
    title: declareText(
      "explanations.search.retrieval.rerank.providerConfigurationId.title",
      "Rerank provider",
    ),
    what: declareText(
      "explanations.search.retrieval.rerank.providerConfigurationId.what",
      "The provider configuration that reorders the fused results. It must declare Reranking; whether it is in force and holds a key is checked at every search.",
    ),
    affects: declareText(
      "explanations.search.retrieval.rerank.providerConfigurationId.affects",
      "Only the order (and the cut) after fusion. A rerank stage that cannot run never fails the search: the fused order is returned with the reason.",
    ),
    safeValue: declareText(
      "explanations.search.retrieval.rerank.providerConfigurationId.safeValue",
      "A configuration declaring Reranking alone, so its address is the rerank endpoint.",
    ),
    extremes: [
      plain(
        declareText(
          "explanations.search.retrieval.rerank.providerConfigurationId.extremes.0.when",
          "A configuration not in force or without a key",
        ),
        declareText(
          "explanations.search.retrieval.rerank.providerConfigurationId.extremes.0.then",
          "Every search falls back to the fused order — the flow strip shows it amber.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.retrieval.rerank.providerConfigurationId.example",
      "voyage · rerank-2.5-lite, declared for Reranking only.",
    ),
  },
  "retrieval.rerank.protocol": {
    title: declareText("explanations.search.retrieval.rerank.protocol.title", "Rerank protocol"),
    what: declareText(
      "explanations.search.retrieval.rerank.protocol.what",
      "The wire format spoken to the rerank endpoint: VOYAGE for Voyage AI, COHERE for Cohere v2 and Jina, TEI for Text Embeddings Inference.",
    ),
    affects: declareText(
      "explanations.search.retrieval.rerank.protocol.affects",
      "Whether the rerank call is understood at all.",
    ),
    safeValue: declareText(
      "explanations.search.retrieval.rerank.protocol.safeValue",
      "The protocol of the chosen provider.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.shared.aProtocolTheProviderDoesNot",
          "A protocol the provider does not speak",
        ),
        declareText(
          "explanations.search.retrieval.rerank.protocol.extremes.0.then",
          "Every rerank call fails and every search falls back to the fused order.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.retrieval.rerank.protocol.example",
      "A local TEI reranker with protocol TEI.",
    ),
  },
  "retrieval.rerank.model": {
    title: declareText("explanations.search.retrieval.rerank.model.title", "Rerank model"),
    what: declareText(
      "explanations.search.retrieval.rerank.model.what",
      "The rerank model to ask for. Empty uses the provider configuration's own model.",
    ),
    affects: declareText(
      "explanations.search.retrieval.rerank.model.affects",
      "Which model scores the candidates.",
    ),
    safeValue: declareText(
      "explanations.search.retrieval.rerank.model.safeValue",
      "Empty — the configuration's model.",
    ),
    extremes: [
      plain(
        declareText(
          "explanations.search.retrieval.rerank.model.extremes.0.when",
          "A model the provider does not know",
        ),
        declareText(
          "explanations.search.retrieval.rerank.model.extremes.0.then",
          "The call is refused and the search falls back to the fused order.",
        ),
      ),
    ],
    example: "rerank-2.5-lite.",
  },
  "retrieval.rerank.candidates": {
    title: declareText(
      "explanations.search.retrieval.rerank.candidates.title",
      "Rerank candidates",
    ),
    what: declareText(
      "explanations.search.retrieval.rerank.candidates.what",
      "How many of the first fused results are sent to the rerank model, 2 to 100. A keyword-only search retrieves this many, bounded by the system result ceiling.",
    ),
    affects: declareText(
      "explanations.search.retrieval.rerank.candidates.affects",
      "Rerank cost (one call per search, priced per sent text) and how deep the reranker can reach for a better passage.",
    ),
    safeValue: "20–30.",
    extremes: [
      plain(
        "2",
        declareText(
          "explanations.search.retrieval.rerank.candidates.extremes.0.then",
          "The reranker can only swap the first two results.",
        ),
      ),
      plain(
        "100",
        declareText(
          "explanations.search.retrieval.rerank.candidates.extremes.1.then",
          "The largest and slowest request; the system's rerank size ceilings may then refuse it, falling back to the fused order.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.retrieval.rerank.candidates.example",
      "30 candidates, keep 10: the reranker picks the best ten of thirty.",
    ),
  },
  "retrieval.rerank.keep": {
    title: declareText(
      "explanations.search.retrieval.rerank.keep.title",
      "Results kept after reranking",
    ),
    what: declareText(
      "explanations.search.retrieval.rerank.keep.what",
      "How many reranked results are kept, at most the candidates. The caller's own result limit still applies.",
    ),
    affects: declareText(
      "explanations.search.retrieval.rerank.keep.affects",
      "The number of results a search returns when reranking runs.",
    ),
    safeValue: "10.",
    extremes: [
      trap(
        declareText(
          "explanations.search.retrieval.rerank.keep.extremes.0.when",
          "More than the candidates",
        ),
        declareText(
          "explanations.search.retrieval.rerank.keep.extremes.0.then",
          "Refused by the server — the stage cannot keep more than it was given.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.retrieval.rerank.keep.example",
      "Keep 5 for an answer profile, so the model reads only the best five passages.",
    ),
  },
  "retrieval.rerank.timeoutMilliseconds": {
    title: declareText(
      "explanations.search.retrieval.rerank.timeoutMilliseconds.title",
      "Rerank timeout",
    ),
    what: declareText(
      "explanations.search.retrieval.rerank.timeoutMilliseconds.what",
      "How long the rerank call may take. The smaller of this and the system setting search.maximum-rerank-milliseconds applies.",
    ),
    affects: declareText(
      "explanations.search.retrieval.rerank.timeoutMilliseconds.affects",
      "Search latency. Past the deadline, or on any other failure, the fused order is returned with the reason.",
    ),
    safeValue: "3000–5000 ms.",
    extremes: [
      trap(
        declareText("explanations.shared.minimumTenMilliseconds", "10 ms (the minimum)"),
        declareText(
          "explanations.search.retrieval.rerank.timeoutMilliseconds.extremes.0.then",
          "Reranking never finishes; every search returns the fused order.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.retrieval.rerank.timeoutMilliseconds.example",
      "A rerank call over 30 short passages usually returns in under a second.",
    ),
  },
  backendId: {
    title: declareText("explanations.search.backendId.title", "Search backend"),
    what: declareText(
      "explanations.search.backendId.what",
      "The installed retrieval implementation that runs the search.",
    ),
    affects: declareText(
      "explanations.search.backendId.affects",
      "Everything about how the profile searches; the other values are read by this backend.",
    ),
    safeValue: declareText(
      "explanations.search.backendId.safeValue",
      "The only installed backend.",
    ),
    extremes: [],
    example: declareText(
      "explanations.search.backendId.example",
      "postgresql — full-text search plus pgvector in the same database.",
    ),
  },
  queryMode: {
    title: declareText("explanations.search.queryMode.title", "Keyword query mode"),
    what: declareText(
      "explanations.search.queryMode.what",
      "How the question is read as a keyword query. PLAIN requires all terms; PHRASE requires the terms in order; WEBSEARCH understands quotes, OR and minus; ANY_TERMS accepts entries matching some of the terms, governed by the minimum matched terms and coverage below.",
    ),
    affects: declareText(
      "explanations.search.queryMode.affects",
      "Which entries the keyword branch finds.",
    ),
    safeValue: declareText(
      "explanations.search.queryMode.safeValue",
      "PLAIN for short technical queries; ANY_TERMS for natural-language questions.",
    ),
    extremes: [
      plain(
        declareText(
          "explanations.search.queryMode.extremes.0.when",
          "PLAIN with a long natural-language question",
        ),
        declareText(
          "explanations.search.queryMode.extremes.0.then",
          "Every word must match, so a full sentence usually finds nothing by keywords.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.queryMode.example",
      "“rotate api key” with PLAIN finds only entries containing all three words.",
    ),
  },
  "lexicalQuery.stopWords": {
    title: declareText("explanations.search.lexicalQuery.stopWords.title", "Stop words"),
    what: declareText(
      "explanations.search.lexicalQuery.stopWords.what",
      "Words left out of an ANY_TERMS query, as the analyzer reduces them (lexemes). No language word list is built in.",
    ),
    affects: declareText(
      "explanations.search.lexicalQuery.stopWords.affects",
      "ANY_TERMS queries only: which words count towards the matched terms and coverage.",
    ),
    safeValue: declareText(
      "explanations.search.lexicalQuery.stopWords.safeValue",
      "Empty, or the few filler words of the questions people actually ask.",
    ),
    extremes: [
      plain(
        declareText(
          "explanations.search.lexicalQuery.stopWords.extremes.0.when",
          "A meaningful term listed",
        ),
        declareText(
          "explanations.search.lexicalQuery.stopWords.extremes.0.then",
          "It is never searched for, in any ANY_TERMS question.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.lexicalQuery.stopWords.example",
      "how, what, the — so “how do I deploy” is matched on “deploy”.",
    ),
  },
  "lexicalQuery.minimumMatchedTerms": {
    title: declareText(
      "explanations.search.lexicalQuery.minimumMatchedTerms.title",
      "Minimum matched terms",
    ),
    what: declareText(
      "explanations.search.lexicalQuery.minimumMatchedTerms.what",
      "For ANY_TERMS: how many distinct query terms an entry must contain.",
    ),
    affects: declareText(
      "explanations.shared.recallAndPrecisionOfAnyTerms",
      "Recall and precision of ANY_TERMS keyword search.",
    ),
    safeValue: "1–2.",
    extremes: [
      plain(
        declareText(
          "explanations.search.lexicalQuery.minimumMatchedTerms.extremes.0.when",
          "More than a question has terms",
        ),
        declareText(
          "explanations.search.lexicalQuery.minimumMatchedTerms.extremes.0.then",
          "A short question can never be matched.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.lexicalQuery.minimumMatchedTerms.example",
      "2 makes “deploy staging server” need at least two of its three terms.",
    ),
  },
  "lexicalQuery.minimumTermCoverage": {
    title: declareText(
      "explanations.search.lexicalQuery.minimumTermCoverage.title",
      "Minimum term coverage",
    ),
    what: declareText(
      "explanations.search.lexicalQuery.minimumTermCoverage.what",
      "For ANY_TERMS: the share of the question's remaining terms an entry must contain, from 0 to 1, rounded up.",
    ),
    affects: declareText(
      "explanations.shared.recallAndPrecisionOfAnyTerms",
      "Recall and precision of ANY_TERMS keyword search.",
    ),
    safeValue: "0–0.5.",
    extremes: [
      plain(
        "1",
        declareText(
          "explanations.search.lexicalQuery.minimumTermCoverage.extremes.0.then",
          "Every term must match — the same as PLAIN.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.lexicalQuery.minimumTermCoverage.example",
      "0.5 on a six-term question needs three matches.",
    ),
  },
  ranking: {
    title: declareText("explanations.search.ranking.title", "Keyword ranking"),
    what: declareText(
      "explanations.search.ranking.what",
      "How keyword hits are scored: FREQUENCY counts occurrences, COVER_DENSITY rewards query terms that appear close together.",
    ),
    affects: declareText(
      "explanations.search.ranking.affects",
      "The order of keyword hits. Scores are not comparable across backends.",
    ),
    safeValue: "COVER_DENSITY.",
    extremes: [],
    example: declareText(
      "explanations.search.ranking.example",
      "COVER_DENSITY ranks “api key rotation” in one sentence above the three words scattered over a page.",
    ),
  },
  normalization: {
    title: declareText("explanations.search.normalization.title", "Score normalisation"),
    what: declareText(
      "explanations.search.normalization.what",
      "How a raw keyword rank becomes a score. NONE keeps the raw rank (usually a small fraction, unbounded); SCORE_FRACTION maps it to rank ÷ (rank + 1), between 0 and 1.",
    ),
    affects: declareText(
      "explanations.search.normalization.affects",
      "The scores shown, the meaning of the minimum score, and whether weighted fusion is allowed.",
    ),
    safeValue: "SCORE_FRACTION.",
    extremes: [
      trap(
        declareText(
          "explanations.search.normalization.extremes.0.when",
          "NONE with a minimum score above 0",
        ),
        declareText(
          "explanations.search.normalization.extremes.0.then",
          "Raw ranks are often below 0.1, so a minimum score of 0.3 can drop nearly every keyword hit.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.normalization.example",
      "A raw rank of 0.5 becomes 0.33 with SCORE_FRACTION.",
    ),
  },
  analyzers: {
    title: declareText("explanations.search.analyzers.title", "Analyzers"),
    what: declareText(
      "explanations.search.analyzers.what",
      "Which full-text analyzers' index entries are searched. An entry is indexed with the analyzer its processing profile chose, and only entries built with a selected analyzer can match.",
    ),
    affects: declareText(
      "explanations.search.analyzers.affects",
      "Which documents are reachable by keywords at all.",
    ),
    safeValue: declareText(
      "explanations.search.analyzers.safeValue",
      "The analyzer the processing profiles index with — simple, unless they chose english.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.search.analyzers.extremes.0.when",
          "Only an analyzer no processing profile uses",
        ),
        declareText(
          "explanations.search.analyzers.extremes.0.then",
          "The keyword branch finds nothing, for every question.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.analyzers.example",
      "english stems “deploying” to “deploy”; simple does not.",
    ),
  },
  minimumScore: {
    title: declareText("explanations.search.minimumScore.title", "Minimum score"),
    what: declareText(
      "explanations.search.minimumScore.what",
      "The lowest score a hit may have, from 0 to 1, in the selected normalisation. Meaning hits are filtered by it too, on their vector score (for COSINE, 1 − distance ÷ 2).",
    ),
    affects: declareText(
      "explanations.search.minimumScore.affects",
      "Which hits are returned, from both branches.",
    ),
    safeValue: declareText(
      "explanations.search.minimumScore.safeValue",
      "0, then raise it after looking at real scores.",
    ),
    extremes: [
      plain(
        "0",
        declareText(
          "explanations.search.minimumScore.extremes.0.then",
          "Nothing is filtered by score.",
        ),
      ),
      trap(
        "1",
        declareText(
          "explanations.search.minimumScore.extremes.1.then",
          "Only perfect scores pass — practically nothing is returned.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.minimumScore.example",
      "0.6 with COSINE drops meaning hits farther than a distance of 0.8.",
    ),
  },
  includeDocuments: {
    title: declareText("explanations.search.includeDocuments.title", "Include documents"),
    what: declareText(
      "explanations.search.includeDocuments.what",
      "Whether entries derived from the current published documents are searched.",
    ),
    affects: declareText(
      "explanations.shared.whichEntriesAreEligible",
      "Which entries are eligible.",
    ),
    safeValue: declareText("explanations.shared.on", "On."),
    extremes: [
      trap(
        declareText(
          "explanations.search.includeDocuments.extremes.0.when",
          "Off together with editorial entries off",
        ),
        declareText(
          "explanations.search.includeDocuments.extremes.0.then",
          "Refused by the server — the search would have nothing to search.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.includeDocuments.example",
      "Off with editorial on makes a profile that searches only hand-written entries.",
    ),
  },
  includeEditorial: {
    title: declareText("explanations.shared.includeEditorialEntries", "Include editorial entries"),
    what: declareText(
      "explanations.search.includeEditorial.what",
      "Whether active manual and override entries are searched. They carry their editorial origin and never a fabricated document citation.",
    ),
    affects: declareText(
      "explanations.shared.whichEntriesAreEligible",
      "Which entries are eligible.",
    ),
    safeValue: declareText(
      "explanations.search.includeEditorial.safeValue",
      "On when the index has curated entries.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.search.includeEditorial.extremes.0.when",
          "Off together with documents off",
        ),
        declareText("explanations.shared.refusedByTheServer", "Refused by the server."),
      ),
    ],
    example: declareText(
      "explanations.search.includeEditorial.example",
      "A hand-written FAQ entry is found only when this is on.",
    ),
  },
  defaultResults: {
    title: declareText("explanations.search.defaultResults.title", "Default results"),
    what: declareText(
      "explanations.search.defaultResults.what",
      "How many results a search returns when the caller does not ask for a number.",
    ),
    affects: declareText(
      "explanations.search.defaultResults.affects",
      "The result count of most searches.",
    ),
    safeValue: "10.",
    extremes: [
      trap(
        declareText(
          "explanations.search.defaultResults.extremes.0.when",
          "More than the maximum results",
        ),
        declareText("explanations.shared.refusedByTheServer", "Refused by the server."),
      ),
    ],
    example: declareText(
      "explanations.search.defaultResults.example",
      "10 by default, while an assistant may ask for up to the maximum.",
    ),
  },
  maximumResults: {
    title: declareText("explanations.search.maximumResults.title", "Maximum results"),
    what: declareText(
      "explanations.search.maximumResults.what",
      "The most results a caller may ask for. The smallest of this, the system setting search.maximum-results and the caller's request applies; scripts may narrow it.",
    ),
    affects: declareText(
      "explanations.search.maximumResults.affects",
      "The largest result page of any search through this profile.",
    ),
    safeValue: "25.",
    extremes: [
      trap(
        declareText(
          "explanations.search.maximumResults.extremes.0.when",
          "Less than the default results",
        ),
        declareText("explanations.shared.refusedByTheServer", "Refused by the server."),
      ),
    ],
    example: declareText(
      "explanations.search.maximumResults.example",
      "An assistant asking for 50 results gets 25.",
    ),
  },
  maximumQueryCharacters: {
    title: declareText(
      "explanations.search.maximumQueryCharacters.title",
      "Maximum question length",
    ),
    what: declareText(
      "explanations.search.maximumQueryCharacters.what",
      "The longest question accepted, in characters. The smaller of this and the system setting search.maximum-query-characters applies.",
    ),
    affects: declareText(
      "explanations.search.maximumQueryCharacters.affects",
      "Every search: a longer question fails before anything runs.",
    ),
    safeValue: "1024.",
    extremes: [
      trap(
        declareText(
          "explanations.search.maximumQueryCharacters.extremes.0.when",
          "Very small, such as 10",
        ),
        declareText(
          "explanations.search.maximumQueryCharacters.extremes.0.then",
          "Nearly every question is rejected outright.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.maximumQueryCharacters.example",
      "A pasted 2000-character error report is rejected at 1024.",
    ),
  },
  maximumExcerptCodePoints: {
    title: declareText("explanations.search.maximumExcerptCodePoints.title", "Excerpt length"),
    what: declareText(
      "explanations.search.maximumExcerptCodePoints.what",
      "How many characters (Unicode code points) of each hit are returned as its excerpt — an exact, unmodified prefix of the entry.",
    ),
    affects: declareText(
      "explanations.search.maximumExcerptCodePoints.affects",
      "What a person or an assistant reads per result. The smaller of this and the system setting search.maximum-excerpt-code-points applies.",
    ),
    safeValue: "400.",
    extremes: [
      plain(
        "1",
        declareText(
          "explanations.search.maximumExcerptCodePoints.extremes.0.then",
          "Results carry almost no text.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.maximumExcerptCodePoints.example",
      "400 characters is roughly a paragraph.",
    ),
  },
  maximumResponseCodePoints: {
    title: declareText(
      "explanations.search.maximumResponseCodePoints.title",
      "Response excerpt budget",
    ),
    what: declareText(
      "explanations.search.maximumResponseCodePoints.what",
      "The total characters of all excerpts in one search response; titles and provenance are not counted.",
    ),
    affects: declareText(
      "explanations.search.maximumResponseCodePoints.affects",
      "How many excerpts arrive in full. Once the budget is spent, later results come with shorter or no excerpts.",
    ),
    safeValue: "10000.",
    extremes: [
      plain(
        declareText(
          "explanations.search.maximumResponseCodePoints.extremes.0.when",
          "Below excerpt length × results",
        ),
        declareText(
          "explanations.search.maximumResponseCodePoints.extremes.0.then",
          "Later results arrive without text.",
        ),
      ),
    ],
    example: declareText(
      "explanations.search.maximumResponseCodePoints.example",
      "25 results × 400 characters needs 10000.",
    ),
  },
  statementMilliseconds: statementDeadline({
    what: declareText(
      "explanations.search.statementMilliseconds.what",
      "How long one database statement of the search may run, in milliseconds. The smaller of this and the system setting search.maximum-statement-milliseconds applies.",
    ),
    affects: declareText(
      "explanations.search.statementMilliseconds.affects",
      "The search's database work. Past the deadline the statement is cancelled and the request fails with a timeout rather than holding the database.",
    ),
  }),
  scriptGroupIds: scriptGroups({
    what: declareText(
      "explanations.search.scriptGroupIds.what",
      "jMS script groups that run at the search hook points. Each group's revision is frozen when a request is admitted, so a script edited mid-request does not change it.",
    ),
    affects: declareText(
      "explanations.search.scriptGroupIds.affects",
      "Every search through this profile. Scripts may refuse a request or narrow its limits (fewer results, a smaller budget); they can never widen a limit or bypass access checks.",
    ),
    refused: declareText(
      "explanations.search.scriptGroupIds.extremes.alwaysRefuses.then",
      "Every search through this profile is refused — check the script's dry run before binding it.",
    ),
  }),
  enabled: enabledSwitch({
    what: declareText(
      "explanations.search.enabled.what",
      "Whether new searches may run through this profile.",
    ),
    affects: declareText(
      "explanations.search.enabled.affects",
      "New searches only. A request already admitted keeps the snapshot it froze, and history stays readable.",
    ),
    refused: declareText(
      "explanations.search.enabled.extremes.off.then",
      "Every new search naming this profile is refused, and every profile that names this one stops working too.",
    ),
    example: declareText(
      "explanations.search.enabled.example",
      "Switch it off while a replacement profile is tested, then switch the searches over.",
    ),
  }),
};

// ---------------------------------------------------------------------------------------------------------
// Embedding profiles.

const EMBEDDING: Record<string, Entry> = {
  providerConfigurationId: {
    title: declareText(
      "explanations.embedding.providerConfigurationId.title",
      "Provider configuration",
    ),
    what: declareText(
      "explanations.embedding.providerConfigurationId.what",
      "The shared AI provider configuration that makes the vectors. It must declare Embeddings; keys stay with the configuration and are never copied here.",
    ),
    affects: declareText(
      "explanations.embedding.providerConfigurationId.affects",
      "Who is called for vectorising and for every search question through this profile, and which vectors belong together: a different configuration is a different model space.",
    ),
    safeValue: declareText(
      "explanations.embedding.providerConfigurationId.safeValue",
      "A configuration in force, with a key, declaring Embeddings.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.shared.changedAfterVectorsArePublished",
          "Changed after vectors are published",
        ),
        declareText(
          "explanations.embedding.providerConfigurationId.extremes.0.then",
          "Searches reading this profile find nothing by meaning until documents are vectorised again.",
        ),
      ),
    ],
    example: "voyage · voyage-4-lite.",
  },
  protocol: {
    title: declareText("explanations.embedding.protocol.title", "Protocol"),
    what: declareText(
      "explanations.embedding.protocol.what",
      "The installed adapter that speaks to the provider's embedding endpoint.",
    ),
    affects: declareText(
      "explanations.embedding.protocol.affects",
      "Whether embedding calls are understood, and which input roles are supported.",
    ),
    safeValue: declareText(
      "explanations.embedding.protocol.safeValue",
      "The provider's own protocol.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.shared.aProtocolTheProviderDoesNot",
          "A protocol the provider does not speak",
        ),
        declareText(
          "explanations.embedding.protocol.extremes.0.then",
          "Every vectorising run and every meaning search fails at the call.",
        ),
      ),
    ],
    example: declareText(
      "explanations.embedding.protocol.example",
      "VOYAGE for Voyage AI, TEI for a local Text Embeddings Inference server.",
    ),
  },
  modelRevision: {
    title: declareText("explanations.embedding.modelRevision.title", "Model revision"),
    what: declareText(
      "explanations.embedding.modelRevision.what",
      "The exact model name the provider is asked for, managed by the operator. It is not inferred from the provider.",
    ),
    affects: declareText(
      "explanations.embedding.modelRevision.affects",
      "The vectors produced and the model space. Searches read only vectors of the same model.",
    ),
    safeValue: declareText(
      "explanations.embedding.modelRevision.safeValue",
      "The model the documents were vectorised with.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.shared.changedAfterVectorsArePublished",
          "Changed after vectors are published",
        ),
        declareText(
          "explanations.embedding.modelRevision.extremes.0.then",
          "Old vectors no longer match; meaning search finds nothing until documents are vectorised again.",
        ),
      ),
    ],
    example: "voyage-4-lite.",
  },
  dimensions: {
    title: declareText("explanations.embedding.dimensions.title", "Dimensions"),
    what: declareText(
      "explanations.embedding.dimensions.what",
      "The vector length the model returns; every response is checked against it.",
    ),
    affects: declareText(
      "explanations.embedding.dimensions.affects",
      "Storage and the model space. A response of another length is rejected.",
    ),
    safeValue: declareText(
      "explanations.embedding.dimensions.safeValue",
      "The model's documented output dimension.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.embedding.dimensions.extremes.0.when",
          "A size the model does not return",
        ),
        declareText(
          "explanations.embedding.dimensions.extremes.0.then",
          "Every embedding response is rejected; nothing is vectorised and meaning search fails.",
        ),
      ),
    ],
    example: declareText("explanations.embedding.dimensions.example", "1024 for voyage-4-lite."),
  },
  inputType: {
    title: declareText("explanations.embedding.inputType.title", "Document input type"),
    what: declareText(
      "explanations.embedding.inputType.what",
      "The retrieval role sent with document chunks: UNSPECIFIED, DOCUMENT or QUERY. A change makes earlier vectors not reusable.",
    ),
    affects: declareText(
      "explanations.embedding.inputType.affects",
      "The document vectors, and therefore closeness to questions embedded as QUERY.",
    ),
    safeValue: declareText(
      "explanations.embedding.inputType.safeValue",
      "DOCUMENT for models with roles; UNSPECIFIED otherwise.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.embedding.inputType.extremes.0.when",
          "A role the protocol does not support",
        ),
        declareText(
          "explanations.embedding.inputType.extremes.0.then",
          "Refused at the call; nothing is vectorised.",
        ),
      ),
    ],
    example: declareText(
      "explanations.embedding.inputType.example",
      "Voyage: DOCUMENT here, QUERY in the search profile.",
    ),
  },
  inputPrefix: {
    title: declareText("explanations.embedding.inputPrefix.title", "Document prefix"),
    what: declareText(
      "explanations.embedding.inputPrefix.what",
      "Text put in front of every chunk, exactly as written, before it is embedded. Counted in the token and size limits.",
    ),
    affects: declareText(
      "explanations.embedding.inputPrefix.affects",
      "The document vectors and the number of tokens paid for.",
    ),
    safeValue: declareText(
      "explanations.embedding.inputPrefix.safeValue",
      "Empty, unless the model asks for one.",
    ),
    extremes: [
      plain(
        declareText("explanations.embedding.inputPrefix.extremes.0.when", "A long prefix"),
        declareText(
          "explanations.embedding.inputPrefix.extremes.0.then",
          "Paid for once per chunk, on every chunk.",
        ),
      ),
    ],
    example: declareText(
      "explanations.embedding.inputPrefix.example",
      "“passage: ” for an e5 model.",
    ),
  },
  "tokenizer.strategy": {
    title: declareText("explanations.embedding.tokenizer.strategy.title", "Token counting"),
    what: declareText(
      "explanations.embedding.tokenizer.strategy.what",
      "How tokens are counted before a call. TEI asks a real tokenizer endpoint and counts exactly; CODE_POINT_ESTIMATE estimates from characters and is marked approximate; UNKNOWN does not count.",
    ),
    affects: declareText(
      "explanations.embedding.tokenizer.strategy.affects",
      "Every budget check: vectorising admission and every meaning-search question through this profile.",
    ),
    safeValue: declareText(
      "explanations.embedding.tokenizer.strategy.safeValue",
      "CODE_POINT_ESTIMATE for hosted providers, with “allow approximate tokens” on where it is used; TEI for a local TEI server.",
    ),
    extremes: [
      trap(
        "UNKNOWN",
        declareText(
          "explanations.embedding.tokenizer.strategy.extremes.0.then",
          "No budget can be satisfied: vectorising is refused and every meaning search through this profile is refused.",
        ),
      ),
      trap(
        declareText(
          "explanations.embedding.tokenizer.strategy.extremes.1.when",
          "CODE_POINT_ESTIMATE while a search profile disallows approximate tokens",
        ),
        declareText(
          "explanations.embedding.tokenizer.strategy.extremes.1.then",
          "That search profile never runs meaning search.",
        ),
      ),
    ],
    example: declareText(
      "explanations.embedding.tokenizer.strategy.example",
      "Voyage: CODE_POINT_ESTIMATE at about 3.5 characters per token.",
    ),
  },
  "tokenizer.tokenizer": {
    title: declareText("explanations.embedding.tokenizer.tokenizer.title", "Tokenizer"),
    what: declareText(
      "explanations.embedding.tokenizer.tokenizer.what",
      "The tokenizer's identity, recorded with every count. With TEI it must be the configured model's own.",
    ),
    affects: declareText(
      "explanations.shared.provenanceOfTokenCounts",
      "Provenance of token counts.",
    ),
    safeValue: declareText(
      "explanations.embedding.tokenizer.tokenizer.safeValue",
      "The model name.",
    ),
    extremes: [],
    example: "voyage-4-lite.",
  },
  "tokenizer.tokenizerRevision": {
    title: declareText(
      "explanations.embedding.tokenizer.tokenizerRevision.title",
      "Tokenizer revision",
    ),
    what: declareText(
      "explanations.embedding.tokenizer.tokenizerRevision.what",
      "The tokenizer's revision, recorded with every count.",
    ),
    affects: declareText(
      "explanations.shared.provenanceOfTokenCounts",
      "Provenance of token counts.",
    ),
    safeValue: declareText(
      "explanations.embedding.tokenizer.tokenizerRevision.safeValue",
      "The revision the provider documents, or the model revision.",
    ),
    extremes: [],
    example: "2026-01.",
  },
  "tokenizer.endpoint": {
    title: declareText("explanations.embedding.tokenizer.endpoint.title", "Tokenizer endpoint"),
    what: declareText(
      "explanations.embedding.tokenizer.endpoint.what",
      "For TEI: the tokenize endpoint, on the same origin as the embedding endpoint.",
    ),
    affects: declareText(
      "explanations.embedding.tokenizer.endpoint.affects",
      "Exact token counting.",
    ),
    safeValue: declareText(
      "explanations.embedding.tokenizer.endpoint.safeValue",
      "The TEI server's /tokenize address.",
    ),
    extremes: [
      trap(
        declareText("explanations.embedding.tokenizer.endpoint.extremes.0.when", "Unreachable"),
        declareText(
          "explanations.embedding.tokenizer.endpoint.extremes.0.then",
          "Counting fails, so vectorising and meaning searches through this profile are refused.",
        ),
      ),
    ],
    example: "http://localhost:8081/tokenize.",
  },
  "tokenizer.codePointsPerToken": {
    title: declareText("explanations.shared.charactersPerToken", "Characters per token"),
    what: declareText(
      "explanations.embedding.tokenizer.codePointsPerToken.what",
      "For CODE_POINT_ESTIMATE: how many characters one token is assumed to hold, 0.01 to 1000. The estimate stays approximate.",
    ),
    affects: declareText(
      "explanations.embedding.tokenizer.codePointsPerToken.affects",
      "Predicted tokens, and so the token budgets, rate limits and cost estimates.",
    ),
    safeValue: declareText(
      "explanations.embedding.tokenizer.codePointsPerToken.safeValue",
      "3–4 for English prose; lower for code and non-Latin scripts.",
    ),
    extremes: [
      plain(
        declareText(
          "explanations.embedding.tokenizer.codePointsPerToken.extremes.0.when",
          "Too high, such as 20",
        ),
        declareText(
          "explanations.embedding.tokenizer.codePointsPerToken.extremes.0.then",
          "Tokens are underestimated; budgets admit more than they should.",
        ),
      ),
      plain(
        declareText(
          "explanations.embedding.tokenizer.codePointsPerToken.extremes.1.when",
          "Too low, such as 0.5",
        ),
        declareText(
          "explanations.embedding.tokenizer.codePointsPerToken.extremes.1.then",
          "Tokens are overestimated; budgets and rate limits refuse ordinary work.",
        ),
      ),
    ],
    example: declareText(
      "explanations.embedding.tokenizer.codePointsPerToken.example",
      "3.5 for voyage models on English documentation.",
    ),
  },
  "tokenizer.additionalTokensPerInput": {
    title: declareText(
      "explanations.embedding.tokenizer.additionalTokensPerInput.title",
      "Extra tokens per input",
    ),
    what: declareText(
      "explanations.embedding.tokenizer.additionalTokensPerInput.what",
      "Tokens added to each estimated input for the model's special tokens. TEI counts them itself.",
    ),
    affects: declareText(
      "explanations.embedding.tokenizer.additionalTokensPerInput.affects",
      "Predicted tokens.",
    ),
    safeValue: "0–2.",
    extremes: [],
    example: declareText(
      "explanations.embedding.tokenizer.additionalTokensPerInput.example",
      "2 for a model that wraps every input in start and end markers.",
    ),
  },
  "callLimits.maximumInputs": {
    title: declareText("explanations.embedding.callLimits.maximumInputs.title", "Inputs per call"),
    what: declareText(
      "explanations.embedding.callLimits.maximumInputs.what",
      "How many chunks are sent in one embedding call.",
    ),
    affects: declareText(
      "explanations.embedding.callLimits.maximumInputs.affects",
      "The number of calls a vectorising run makes, and so its rate-limit pressure.",
    ),
    safeValue: "32–128.",
    extremes: [
      plain(
        "1",
        declareText(
          "explanations.embedding.callLimits.maximumInputs.extremes.0.then",
          "One call per chunk — slow and rate-limit hungry.",
        ),
      ),
    ],
    example: declareText(
      "explanations.embedding.callLimits.maximumInputs.example",
      "128 chunks per call vectorises 10000 chunks in 79 calls.",
    ),
  },
  "callLimits.maximumInputCodePoints": {
    title: declareText(
      "explanations.embedding.callLimits.maximumInputCodePoints.title",
      "Characters per input",
    ),
    what: declareText(
      "explanations.embedding.callLimits.maximumInputCodePoints.what",
      "The longest single input, prefix included, in characters. Also bounds a search question.",
    ),
    affects: declareText(
      "explanations.embedding.callLimits.maximumInputCodePoints.affects",
      "Which chunks and questions can be sent at all.",
    ),
    safeValue: declareText(
      "explanations.embedding.callLimits.maximumInputCodePoints.safeValue",
      "Above the processing profile's chunk size plus the prefix.",
    ),
    extremes: [
      trap(
        declareText("explanations.shared.belowTheChunkSize", "Below the chunk size"),
        declareText(
          "explanations.embedding.callLimits.maximumInputCodePoints.extremes.0.then",
          "Chunks are refused rather than truncated; vectorising fails.",
        ),
      ),
    ],
    example: declareText(
      "explanations.embedding.callLimits.maximumInputCodePoints.example",
      "8000 for chunks of 1200 characters.",
    ),
  },
  "callLimits.maximumTotalCodePoints": {
    title: declareText(
      "explanations.embedding.callLimits.maximumTotalCodePoints.title",
      "Characters per call",
    ),
    what: declareText(
      "explanations.embedding.callLimits.maximumTotalCodePoints.what",
      "The most characters one call may carry, across its inputs.",
    ),
    affects: declareText(
      "explanations.embedding.callLimits.maximumTotalCodePoints.affects",
      "Batching: a batch over it is refused.",
    ),
    safeValue: declareText(
      "explanations.embedding.callLimits.maximumTotalCodePoints.safeValue",
      "Inputs per call × characters per input, or the provider's request limit.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.embedding.callLimits.maximumTotalCodePoints.extremes.0.when",
          "Below one input",
        ),
        declareText(
          "explanations.embedding.callLimits.maximumTotalCodePoints.extremes.0.then",
          "Nothing can be sent.",
        ),
      ),
    ],
    example: "128 × 1300 = 166400.",
  },
  "callLimits.timeoutMilliseconds": {
    title: declareText(
      "explanations.embedding.callLimits.timeoutMilliseconds.title",
      "Call timeout",
    ),
    what: declareText(
      "explanations.embedding.callLimits.timeoutMilliseconds.what",
      "How long one embedding call may take, until the whole response has arrived. Also bounds question embeddings.",
    ),
    affects: declareText(
      "explanations.embedding.callLimits.timeoutMilliseconds.affects",
      "Vectorising and meaning-search reliability.",
    ),
    safeValue: declareText(
      "explanations.embedding.callLimits.timeoutMilliseconds.safeValue",
      "30000 ms for batches; question embeddings take the smaller of this and the search profile's timeout.",
    ),
    extremes: [
      trap(
        declareText("explanations.shared.minimumTenMilliseconds", "10 ms (the minimum)"),
        declareText(
          "explanations.embedding.callLimits.timeoutMilliseconds.extremes.0.then",
          "Every call times out.",
        ),
      ),
    ],
    example: declareText(
      "explanations.embedding.callLimits.timeoutMilliseconds.example",
      "A 128-chunk batch to a hosted provider usually completes in 1–3 seconds.",
    ),
  },
  "callLimits.maximumResponseBytes": {
    title: declareText(
      "explanations.embedding.callLimits.maximumResponseBytes.title",
      "Response size",
    ),
    what: declareText(
      "explanations.embedding.callLimits.maximumResponseBytes.what",
      "The largest response accepted before it is decoded.",
    ),
    affects: declareText(
      "explanations.embedding.callLimits.maximumResponseBytes.affects",
      "Large batches of large vectors.",
    ),
    safeValue: declareText(
      "explanations.embedding.callLimits.maximumResponseBytes.safeValue",
      "Inputs per call × dimensions × about 20 bytes, with room to spare.",
    ),
    extremes: [
      trap(
        declareText("explanations.shared.belowARealResponse", "Below a real response"),
        declareText(
          "explanations.embedding.callLimits.maximumResponseBytes.extremes.0.then",
          "Every call is rejected after it was made — and may still be billed.",
        ),
      ),
    ],
    example: "128 × 1024 × 20 ≈ 2.6 MB.",
  },
  maximumChunks: {
    title: declareText("explanations.embedding.maximumChunks.title", "Maximum chunks"),
    what: declareText(
      "explanations.embedding.maximumChunks.what",
      "The most chunks one preflight may select. More is refused, never silently truncated. The smaller of this and the system setting embedding.maximum-chunks applies.",
    ),
    affects: declareText(
      "explanations.embedding.maximumChunks.affects",
      "How much one vectorising run may cover.",
    ),
    safeValue: declareText(
      "explanations.embedding.maximumChunks.safeValue",
      "Above the chunk count of a typical run — 1000 by default.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.embedding.maximumChunks.extremes.0.when",
          "Below a source's chunk count",
        ),
        declareText(
          "explanations.embedding.maximumChunks.extremes.0.then",
          "That source can never be vectorised in one run.",
        ),
      ),
    ],
    example: declareText(
      "explanations.embedding.maximumChunks.example",
      "A 2000-chunk source needs at least 2000.",
    ),
  },
  maximumTotalCodePoints: {
    title: declareText(
      "explanations.embedding.maximumTotalCodePoints.title",
      "Maximum characters per run",
    ),
    what: declareText(
      "explanations.embedding.maximumTotalCodePoints.what",
      "The total characters a run may send, prefixes and chunk overlap included.",
    ),
    affects: declareText(
      "explanations.shared.admissionOfAVectorisingRun",
      "Admission of a vectorising run.",
    ),
    safeValue: declareText(
      "explanations.embedding.maximumTotalCodePoints.safeValue",
      "Chunks × chunk size, with room.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.embedding.maximumTotalCodePoints.extremes.0.when",
          "Below the run's text",
        ),
        declareText(
          "explanations.embedding.maximumTotalCodePoints.extremes.0.then",
          "The preflight refuses the run.",
        ),
      ),
    ],
    example: declareText(
      "explanations.embedding.maximumTotalCodePoints.example",
      "1000 chunks × 1300 = 1.3 million.",
    ),
  },
  maximumTokens: {
    title: declareText("explanations.embedding.maximumTokens.title", "Maximum tokens per run"),
    what: declareText(
      "explanations.embedding.maximumTokens.what",
      "The predicted token ceiling of one run. The smaller of this and the system setting embedding.maximum-tokens applies. An unknown count never satisfies it.",
    ),
    affects: declareText(
      "explanations.shared.admissionOfAVectorisingRun",
      "Admission of a vectorising run.",
    ),
    safeValue: declareText(
      "explanations.embedding.maximumTokens.safeValue",
      "Characters per run ÷ characters per token, with room.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.embedding.maximumTokens.extremes.0.when",
          "Below the run's predicted tokens",
        ),
        declareText(
          "explanations.embedding.maximumTokens.extremes.0.then",
          "The preflight reports the budget exceeded and the run cannot start.",
        ),
      ),
    ],
    example: declareText(
      "explanations.embedding.maximumTokens.example",
      "1.3 million characters at 3.5 per token ≈ 370000 tokens.",
    ),
  },
  maximumCost: {
    title: declareText("explanations.embedding.maximumCost.title", "Maximum cost per run"),
    what: declareText(
      "explanations.embedding.maximumCost.what",
      "An optional ceiling on a run's predicted cost, in the pricing's currency. It is an estimate, not an invoice. Empty means no cost check.",
    ),
    affects: declareText(
      "explanations.embedding.maximumCost.affects",
      "Admission of a vectorising run: the preflight's cost budget must be within it.",
    ),
    safeValue: declareText(
      "explanations.embedding.maximumCost.safeValue",
      "Empty, or a ceiling together with current pricing.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.embedding.maximumCost.extremes.0.when",
          "Any value without pricing",
        ),
        declareText(
          "explanations.embedding.maximumCost.extremes.0.then",
          "The cost is unknown, so every vectorising run is refused.",
        ),
      ),
      trap(
        declareText(
          "explanations.embedding.maximumCost.extremes.1.when",
          "Any value after the pricing's “valid until” date",
        ),
        declareText(
          "explanations.embedding.maximumCost.extremes.1.then",
          "Same: stale pricing, unknown cost, refused.",
        ),
      ),
      trap(
        declareText(
          "explanations.embedding.maximumCost.extremes.2.when",
          "0 with a price above zero",
        ),
        declareText("explanations.embedding.maximumCost.extremes.2.then", "Every run is refused."),
      ),
    ],
    example: declareText(
      "explanations.embedding.maximumCost.example",
      "1.00 USD covers 50 million tokens at 0.02 USD per million.",
    ),
  },
  pricing: {
    title: declareText("explanations.embedding.pricing.title", "Pricing"),
    what: declareText(
      "explanations.embedding.pricing.what",
      "The dated price of input tokens: currency (three capital letters), perMillionInputTokens (zero or more), validFrom and validUntil. Empty means the cost is unknown — normal for a local provider.",
    ),
    affects: declareText(
      "explanations.embedding.pricing.affects",
      "Cost estimates of vectorising runs, and every cost ceiling: this profile's maximum cost and the maximum question cost of each search profile that names this profile.",
    ),
    safeValue: declareText(
      "explanations.embedding.pricing.safeValue",
      "Empty unless a cost ceiling is used; when it is, the provider's list price with a validity that has not ended.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.embedding.pricing.extremes.0.when",
          "Empty while a cost ceiling is set (here or in a search profile)",
        ),
        declareText(
          "explanations.embedding.pricing.extremes.0.then",
          "Costs cannot be computed: the runs or searches bounded by that ceiling are refused.",
        ),
      ),
      trap(
        declareText("explanations.embedding.pricing.extremes.1.when", "validUntil in the past"),
        declareText(
          "explanations.embedding.pricing.extremes.1.then",
          "Treated as no pricing from the next day on — a ceiling that worked starts refusing everything.",
        ),
      ),
    ],
    example:
      '{ "currency": "USD", "perMillionInputTokens": 0.02, "validFrom": "2026-01-01", "validUntil": "2027-01-01" }',
  },
  statementMilliseconds: statementDeadline({
    what: declareText(
      "explanations.embedding.statementMilliseconds.what",
      "How long one database statement of the preflight's selection may run, in milliseconds. The smaller of this and the system setting embedding.maximum-statement-milliseconds applies.",
    ),
    affects: declareText(
      "explanations.embedding.statementMilliseconds.affects",
      "The preflight's selection's database work. Past the deadline the statement is cancelled and the request fails with a timeout rather than holding the database.",
    ),
  }),
  maximumDurationMilliseconds: {
    title: declareText(
      "explanations.embedding.maximumDurationMilliseconds.title",
      "Preflight deadline",
    ),
    what: declareText(
      "explanations.embedding.maximumDurationMilliseconds.what",
      "The total time a preflight may take, checked between stages and batches; it also bounds each call.",
    ),
    affects: declareText(
      "explanations.embedding.maximumDurationMilliseconds.affects",
      "Large preflights that count tokens remotely.",
    ),
    safeValue: "60000 ms.",
    extremes: [
      trap(
        declareText("explanations.shared.minimumTenMilliseconds", "10 ms (the minimum)"),
        declareText(
          "explanations.embedding.maximumDurationMilliseconds.extremes.0.then",
          "Every preflight stops before it finishes.",
        ),
      ),
    ],
    example: declareText(
      "explanations.embedding.maximumDurationMilliseconds.example",
      "A TEI tokenizer counting 10000 chunks may need a minute.",
    ),
  },
  scriptGroupIds: scriptGroups({
    what: declareText(
      "explanations.embedding.scriptGroupIds.what",
      "jMS script groups that run at the vectorising preflight hook points. Each group's revision is frozen when a request is admitted, so a script edited mid-request does not change it.",
    ),
    affects: declareText(
      "explanations.embedding.scriptGroupIds.affects",
      "Every vectorising preflight through this profile. Scripts may refuse a request or narrow its limits (fewer results, a smaller budget); they can never widen a limit or bypass access checks.",
    ),
    refused: declareText(
      "explanations.embedding.scriptGroupIds.extremes.alwaysRefuses.then",
      "Every vectorising preflight through this profile is refused — check the script's dry run before binding it.",
    ),
  }),
  enabled: enabledSwitch({
    what: declareText(
      "explanations.embedding.enabled.what",
      "Whether new preflights may run through this profile.",
    ),
    affects: declareText(
      "explanations.embedding.enabled.affects",
      "New preflights only. A request already admitted keeps the snapshot it froze, and history stays readable.",
    ),
    refused: declareText(
      "explanations.embedding.enabled.extremes.off.then",
      "Every new preflight naming this profile is refused, and every profile that names this one stops working too.",
    ),
    example: declareText(
      "explanations.embedding.enabled.example",
      "Switch it off while a replacement profile is tested, then switch the preflights over.",
    ),
  }),
};

// ---------------------------------------------------------------------------------------------------------
// Answer profiles.

const ANSWER: Record<string, Entry> = {
  searchProfileId: {
    title: declareText("explanations.answer.searchProfileId.title", "Search profile"),
    what: declareText(
      "explanations.answer.searchProfileId.what",
      "The search profile that finds the passages an answer is built from. Keyword, meaning or hybrid routing is decided there.",
    ),
    affects: declareText(
      "explanations.answer.searchProfileId.affects",
      "Which passages the answer can cite.",
    ),
    safeValue: declareText(
      "explanations.answer.searchProfileId.safeValue",
      "A working search profile — the flow strip shows whether it runs.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.shared.aDisabledOrMissingProfile",
          "A disabled or missing profile",
        ),
        declareText("explanations.shared.everyAnswerFails", "Every answer fails."),
      ),
    ],
    example: declareText(
      "explanations.answer.searchProfileId.example",
      "A hybrid profile with reranking that keeps 5.",
    ),
  },
  contextProfileId: {
    title: declareText("explanations.answer.contextProfileId.title", "Context profile"),
    what: declareText(
      "explanations.answer.contextProfileId.what",
      "The context profile that turns search hits into verified passages: neighbours, merging and size limits.",
    ),
    affects: declareText(
      "explanations.answer.contextProfileId.affects",
      "How much source text the model reads, and its prompt size.",
    ),
    safeValue: declareText(
      "explanations.answer.contextProfileId.safeValue",
      "A context profile whose total size fits the maximum prompt below.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.shared.aDisabledOrMissingProfile",
          "A disabled or missing profile",
        ),
        declareText("explanations.shared.everyAnswerFails", "Every answer fails."),
      ),
    ],
    example: declareText(
      "explanations.answer.contextProfileId.example",
      "Up to 10 fragments of 4000 characters, merged when adjacent.",
    ),
  },
  providerConfigurationId: {
    title: declareText("explanations.answer.providerConfigurationId.title", "Chat provider"),
    what: declareText(
      "explanations.answer.providerConfigurationId.what",
      "The provider configuration that writes the answer. It must declare Chat. Empty returns the verified sources without a written answer.",
    ),
    affects: declareText(
      "explanations.answer.providerConfigurationId.affects",
      "Whether a model is called and who is billed.",
    ),
    safeValue: declareText(
      "explanations.answer.providerConfigurationId.safeValue",
      "A configuration in force, with a key, declaring Chat.",
    ),
    extremes: [
      plain(
        declareText("explanations.answer.providerConfigurationId.extremes.0.when", "None"),
        declareText(
          "explanations.answer.providerConfigurationId.extremes.0.then",
          "Answers are the sources only — no cost.",
        ),
      ),
      trap(
        declareText(
          "explanations.answer.providerConfigurationId.extremes.1.when",
          "A configuration not in force",
        ),
        declareText(
          "explanations.answer.providerConfigurationId.extremes.1.then",
          "The unavailable-chat policy decides: sources only, or failure.",
        ),
      ),
    ],
    example: "anthropic · claude-sonnet-5-5.",
  },
  systemInstructions: {
    title: declareText("explanations.answer.systemInstructions.title", "System instructions"),
    what: declareText(
      "explanations.answer.systemInstructions.what",
      "The instructions the model receives. Sources and the question are passed as untrusted data, and the answer must come back as JSON with citations to the supplied sources.",
    ),
    affects: declareText(
      "explanations.answer.systemInstructions.affects",
      "The answer's tone and grounding, and its prompt size.",
    ),
    safeValue: declareText(
      "explanations.answer.systemInstructions.safeValue",
      "The suggested instructions, adapted.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.answer.systemInstructions.extremes.0.when",
          "Instructions asking for prose instead of the JSON contract",
        ),
        declareText(
          "explanations.answer.systemInstructions.extremes.0.then",
          "The response cannot be decoded and the answer fails after the model was paid.",
        ),
      ),
    ],
    example: declareText(
      "explanations.answer.systemInstructions.example",
      "Answer only from the sources; say so when they do not cover the question.",
    ),
  },
  maximumPromptCodePoints: {
    title: declareText("explanations.answer.maximumPromptCodePoints.title", "Maximum prompt size"),
    what: declareText(
      "explanations.answer.maximumPromptCodePoints.what",
      "The most characters the prompt may have: instructions, question and the serialised sources together. The smaller of this and the system setting answer.maximum-prompt-code-points applies.",
    ),
    affects: declareText(
      "explanations.shared.admissionBeforeTheModelCall",
      "Admission before the model call.",
    ),
    safeValue: declareText(
      "explanations.answer.maximumPromptCodePoints.safeValue",
      "Above the context profile's total size plus the instructions — 20000 by default.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.answer.maximumPromptCodePoints.extremes.0.when",
          "Below the context profile's total size",
        ),
        declareText(
          "explanations.answer.maximumPromptCodePoints.extremes.0.then",
          "A full context makes every such answer refused before the model is called.",
        ),
      ),
    ],
    example: declareText(
      "explanations.answer.maximumPromptCodePoints.example",
      "Context of 20000 characters plus 2000 of instructions needs about 23000.",
    ),
  },
  maximumAnswerCodePoints: {
    title: declareText("explanations.answer.maximumAnswerCodePoints.title", "Maximum answer size"),
    what: declareText(
      "explanations.answer.maximumAnswerCodePoints.what",
      "The longest answer text accepted, checked after the response is decoded.",
    ),
    affects: declareText(
      "explanations.answer.maximumAnswerCodePoints.affects",
      "Acceptance of the model's answer. An answer over it is rejected; its usage is still recorded.",
    ),
    safeValue: "10000.",
    extremes: [
      trap(
        declareText("explanations.shared.verySmallSuchAs50", "Very small, such as 50"),
        declareText(
          "explanations.answer.maximumAnswerCodePoints.extremes.0.then",
          "Most answers are rejected after they were paid for.",
        ),
      ),
    ],
    example: declareText(
      "explanations.answer.maximumAnswerCodePoints.example",
      "10000 characters is about two pages.",
    ),
  },
  maximumResponseBytes: {
    title: declareText("explanations.answer.maximumResponseBytes.title", "Maximum response size"),
    what: declareText(
      "explanations.answer.maximumResponseBytes.what",
      "The largest HTTP body accepted from the chat provider before it is decoded, for success and error responses alike.",
    ),
    affects: declareText(
      "explanations.answer.maximumResponseBytes.affects",
      "Acceptance of a response.",
    ),
    safeValue: "1 MB.",
    extremes: [
      trap(
        declareText("explanations.shared.belowARealResponse", "Below a real response"),
        declareText(
          "explanations.answer.maximumResponseBytes.extremes.0.then",
          "Answers are rejected after the model was paid.",
        ),
      ),
    ],
    example: declareText(
      "explanations.answer.maximumResponseBytes.example",
      "A 2000-token answer is about 10 KB.",
    ),
  },
  maximumOutputTokens: {
    title: declareText("explanations.answer.maximumOutputTokens.title", "Maximum output tokens"),
    what: declareText(
      "explanations.answer.maximumOutputTokens.what",
      "The output allowance sent to the provider. The smallest of this, the system setting answer.maximum-output-tokens and the provider configuration's maximum tokens applies.",
    ),
    affects: declareText(
      "explanations.answer.maximumOutputTokens.affects",
      "Answer length and the tokens reserved against rate limits.",
    ),
    safeValue: "1000–2000.",
    extremes: [
      trap(
        declareText(
          "explanations.answer.maximumOutputTokens.extremes.0.when",
          "At or above the maximum total tokens",
        ),
        declareText(
          "explanations.answer.maximumOutputTokens.extremes.0.then",
          "No room is left for the prompt: every answer is refused before the call.",
        ),
      ),
    ],
    example: declareText(
      "explanations.answer.maximumOutputTokens.example",
      "2000 output tokens within a total of 10000.",
    ),
  },
  maximumEstimatedInputTokens: {
    title: declareText(
      "explanations.answer.maximumEstimatedInputTokens.title",
      "Maximum input tokens",
    ),
    what: declareText(
      "explanations.answer.maximumEstimatedInputTokens.what",
      "The ceiling on the estimated prompt tokens (prompt characters ÷ characters per token + overhead).",
    ),
    affects: declareText(
      "explanations.shared.admissionBeforeTheModelCall",
      "Admission before the model call.",
    ),
    safeValue: "8000.",
    extremes: [
      trap(
        declareText(
          "explanations.answer.maximumEstimatedInputTokens.extremes.0.when",
          "Below a normal prompt's estimate",
        ),
        declareText(
          "explanations.answer.maximumEstimatedInputTokens.extremes.0.then",
          "Answers are refused before the call.",
        ),
      ),
    ],
    example: declareText(
      "explanations.answer.maximumEstimatedInputTokens.example",
      "23000 characters at 4 per token plus 100 ≈ 5850 tokens.",
    ),
  },
  maximumTotalTokens: {
    title: declareText("explanations.answer.maximumTotalTokens.title", "Maximum total tokens"),
    what: declareText(
      "explanations.answer.maximumTotalTokens.what",
      "Estimated input plus the output allowance must fit within it before the call; the reported usage is checked against it afterwards.",
    ),
    affects: declareText(
      "explanations.answer.maximumTotalTokens.affects",
      "Admission and acceptance of answers.",
    ),
    safeValue: declareText(
      "explanations.answer.maximumTotalTokens.safeValue",
      "Input allowance plus output allowance — 10000 by default.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.shared.atOrBelowTheOutputTokens",
          "At or below the output tokens",
        ),
        declareText(
          "explanations.answer.maximumTotalTokens.extremes.0.then",
          "Every answer is refused before the call.",
        ),
      ),
    ],
    example: declareText(
      "explanations.answer.maximumTotalTokens.example",
      "8000 input + 2000 output = 10000.",
    ),
  },
  maximumCalls: {
    title: declareText("explanations.answer.maximumCalls.title", "Model calls per answer"),
    what: declareText(
      "explanations.answer.maximumCalls.what",
      "How many model turns one answer may make: 0 or 1. There are no tools and no follow-up turns.",
    ),
    affects: declareText(
      "explanations.answer.maximumCalls.affects",
      "Whether a model is called at all.",
    ),
    safeValue: "1.",
    extremes: [
      plain(
        "0",
        declareText(
          "explanations.answer.maximumCalls.extremes.0.then",
          "Answers return the verified sources only, by this profile's choice — no cost.",
        ),
      ),
    ],
    example: declareText(
      "explanations.answer.maximumCalls.example",
      "0 makes a source-finding profile for an assistant that writes its own answer.",
    ),
  },
  maximumConcurrentCalls: {
    title: declareText("explanations.answer.maximumConcurrentCalls.title", "Concurrent chat calls"),
    what: declareText(
      "explanations.answer.maximumConcurrentCalls.what",
      "How many chat calls may be live at once in this workspace, across every process.",
    ),
    affects: declareText(
      "explanations.answer.maximumConcurrentCalls.affects",
      "Throughput. An answer arriving while the limit is in use is refused; so is any answer while an earlier call's outcome is still unresolved.",
    ),
    safeValue: "1–4.",
    extremes: [
      plain(
        "1",
        declareText(
          "explanations.answer.maximumConcurrentCalls.extremes.0.then",
          "Two simultaneous questions: one is refused.",
        ),
      ),
    ],
    example: declareText(
      "explanations.answer.maximumConcurrentCalls.example",
      "A small team asking questions interactively: 2.",
    ),
  },
  connectTimeoutMilliseconds: {
    title: declareText(
      "explanations.answer.connectTimeoutMilliseconds.title",
      "Connection timeout",
    ),
    what: declareText(
      "explanations.answer.connectTimeoutMilliseconds.what",
      "How long connecting to the chat provider may take.",
    ),
    affects: declareText(
      "explanations.answer.connectTimeoutMilliseconds.affects",
      "Failure speed when the provider is unreachable.",
    ),
    safeValue: "3000 ms.",
    extremes: [
      trap(
        declareText("explanations.shared.minimumTenMilliseconds", "10 ms (the minimum)"),
        declareText(
          "explanations.answer.connectTimeoutMilliseconds.extremes.0.then",
          "Most connections fail.",
        ),
      ),
    ],
    example: declareText(
      "explanations.answer.connectTimeoutMilliseconds.example",
      "3000 ms fails fast during an outage.",
    ),
  },
  timeoutMilliseconds: {
    title: declareText("explanations.answer.timeoutMilliseconds.title", "Response timeout"),
    what: declareText(
      "explanations.answer.timeoutMilliseconds.what",
      "How long the chat provider may take to answer. The smaller of this and the system setting answer.maximum-model-milliseconds applies.",
    ),
    affects: declareText(
      "explanations.answer.timeoutMilliseconds.affects",
      "Long answers from slow models. A timed-out call is uncertain: it is not retried and may still be billed.",
    ),
    safeValue: declareText(
      "explanations.answer.timeoutMilliseconds.safeValue",
      "15000–60000 ms, and below the answer deadline.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.answer.timeoutMilliseconds.extremes.0.when",
          "At or above the answer deadline",
        ),
        declareText(
          "explanations.answer.timeoutMilliseconds.extremes.0.then",
          "Once search and context have taken their time, the remaining time can never admit the call: every answer is refused.",
        ),
      ),
    ],
    example: declareText(
      "explanations.answer.timeoutMilliseconds.example",
      "30000 ms for a 2000-token answer from a large model.",
    ),
  },
  maximumDurationMilliseconds: {
    title: declareText("explanations.answer.maximumDurationMilliseconds.title", "Answer deadline"),
    what: declareText(
      "explanations.answer.maximumDurationMilliseconds.what",
      "The whole answer's time budget: search, context, the model call and the hand-off, checked between steps.",
    ),
    affects: declareText(
      "explanations.answer.maximumDurationMilliseconds.affects",
      "Admission of the model call: the time left must cover the response timeout.",
    ),
    safeValue: declareText(
      "explanations.answer.maximumDurationMilliseconds.safeValue",
      "The response timeout plus 10–20 seconds for search and context.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.answer.maximumDurationMilliseconds.extremes.0.when",
          "Not above the response timeout",
        ),
        declareText(
          "explanations.answer.maximumDurationMilliseconds.extremes.0.then",
          "Every answer that reaches the model is refused.",
        ),
      ),
    ],
    example: declareText(
      "explanations.answer.maximumDurationMilliseconds.example",
      "Timeout 30000 and deadline 60000.",
    ),
  },
  codePointsPerToken: {
    title: declareText("explanations.shared.charactersPerToken", "Characters per token"),
    what: declareText(
      "explanations.answer.codePointsPerToken.what",
      "The calibration of the prompt estimate: prompt characters are divided by it. The estimate is never exact.",
    ),
    affects: declareText(
      "explanations.answer.codePointsPerToken.affects",
      "Predicted input tokens, the token limits above and the rate-limit reservation.",
    ),
    safeValue: declareText("explanations.answer.codePointsPerToken.safeValue", "4 for English."),
    extremes: [
      plain(
        declareText("explanations.answer.codePointsPerToken.extremes.0.when", "Too high"),
        declareText(
          "explanations.answer.codePointsPerToken.extremes.0.then",
          "Prompts are underestimated; the provider may reject them as too long.",
        ),
      ),
    ],
    example: declareText(
      "explanations.answer.codePointsPerToken.example",
      "4 characters per token on English documentation.",
    ),
  },
  estimatedOverheadTokens: {
    title: declareText("explanations.answer.estimatedOverheadTokens.title", "Overhead tokens"),
    what: declareText(
      "explanations.answer.estimatedOverheadTokens.what",
      "Tokens added to the estimate for the protocol's own framing.",
    ),
    affects: declareText(
      "explanations.answer.estimatedOverheadTokens.affects",
      "Predicted input tokens.",
    ),
    safeValue: "100.",
    extremes: [],
    example: "100.",
  },
  allowApproximateTokens: {
    title: declareText(
      "explanations.shared.allowApproximateTokenCounts",
      "Allow approximate token counts",
    ),
    what: declareText(
      "explanations.answer.allowApproximateTokens.what",
      "Whether a prompt may be admitted on an estimated token count. The chat adapter only estimates; it has no exact tokenizer.",
    ),
    affects: declareText(
      "explanations.answer.allowApproximateTokens.affects",
      "Whether a model is ever called through this profile.",
    ),
    safeValue: declareText("explanations.shared.on", "On."),
    extremes: [
      trap(
        declareText(
          "explanations.answer.allowApproximateTokens.extremes.0.when",
          "Off with a chat provider chosen",
        ),
        declareText(
          "explanations.answer.allowApproximateTokens.extremes.0.then",
          "Every answer that reaches the model is refused — exact counting is not available.",
        ),
      ),
    ],
    example: declareText(
      "explanations.answer.allowApproximateTokens.example",
      "On, always, until an exact chat tokenizer exists.",
    ),
  },
  allowUnknownUsage: {
    title: declareText("explanations.shared.allowUnknownUsage", "Allow unknown usage"),
    what: declareText(
      "explanations.answer.allowUnknownUsage.what",
      "Whether an answer is accepted when the provider's response does not report its token usage (or reports zero for both).",
    ),
    affects: declareText(
      "explanations.answer.allowUnknownUsage.affects",
      "Acceptance after the call; usage is then recorded as unknown, never as free.",
    ),
    safeValue: declareText(
      "explanations.answer.allowUnknownUsage.safeValue",
      "Off for providers that report usage.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.answer.allowUnknownUsage.extremes.0.when",
          "Off with a provider that does not report usage",
        ),
        declareText(
          "explanations.answer.allowUnknownUsage.extremes.0.then",
          "Every answer is rejected after the model was paid.",
        ),
      ),
    ],
    example: declareText(
      "explanations.answer.allowUnknownUsage.example",
      "A local model server without usage reporting needs this on.",
    ),
  },
  allowEditorial: {
    title: declareText("explanations.answer.allowEditorial.title", "Allow editorial sources"),
    what: declareText(
      "explanations.answer.allowEditorial.what",
      "Whether admitted editorial fragments (manual entries) may be given to the model. They keep their editorial origin and never get a fabricated document citation.",
    ),
    affects: declareText(
      "explanations.answer.allowEditorial.affects",
      "Which sources an answer may cite.",
    ),
    safeValue: declareText(
      "explanations.answer.allowEditorial.safeValue",
      "Off, unless the index has curated entries meant for answers.",
    ),
    extremes: [],
    example: declareText(
      "explanations.answer.allowEditorial.example",
      "On for a workspace with a hand-written FAQ.",
    ),
  },
  unavailableChat: {
    title: declareText("explanations.answer.unavailableChat.title", "When chat is unavailable"),
    what: declareText(
      "explanations.answer.unavailableChat.what",
      "What an answer does when its chat provider cannot be used before the call — not in force, no key, removed. FAIL refuses the answer; SOURCES_ONLY returns the verified sources without a written answer. A failure during the call is never retried and never falls back.",
    ),
    affects: declareText(
      "explanations.answer.unavailableChat.affects",
      "Whether answers survive a provider being switched off.",
    ),
    safeValue: declareText(
      "explanations.answer.unavailableChat.safeValue",
      "SOURCES_ONLY while setting up; FAIL when a missing answer would mislead.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.answer.unavailableChat.extremes.0.when",
          "FAIL with the provider not in force",
        ),
        declareText("explanations.shared.everyAnswerFails", "Every answer fails."),
      ),
    ],
    example: declareText(
      "explanations.answer.unavailableChat.example",
      "SOURCES_ONLY keeps assistants useful while a key is being rotated.",
    ),
  },
  scriptGroupIds: scriptGroups({
    what: declareText(
      "explanations.answer.scriptGroupIds.what",
      "jMS script groups that run at the answer hook points. Each group's revision is frozen when a request is admitted, so a script edited mid-request does not change it.",
    ),
    affects: declareText(
      "explanations.answer.scriptGroupIds.affects",
      "Every answer through this profile. Scripts may refuse a request or narrow its limits (fewer results, a smaller budget); they can never widen a limit or bypass access checks.",
    ),
    refused: declareText(
      "explanations.answer.scriptGroupIds.extremes.alwaysRefuses.then",
      "Every answer through this profile is refused — check the script's dry run before binding it.",
    ),
  }),
  enabled: enabledSwitch({
    what: declareText(
      "explanations.answer.enabled.what",
      "Whether new answers may run through this profile.",
    ),
    affects: declareText(
      "explanations.answer.enabled.affects",
      "New answers only. A request already admitted keeps the snapshot it froze, and history stays readable.",
    ),
    refused: declareText(
      "explanations.answer.enabled.extremes.off.then",
      "Every new answer naming this profile is refused, and every profile that names this one stops working too.",
    ),
    example: declareText(
      "explanations.answer.enabled.example",
      "Switch it off while a replacement profile is tested, then switch the answers over.",
    ),
  }),
};

// ---------------------------------------------------------------------------------------------------------
// Context profiles.

const CONTEXT: Record<string, Entry> = {
  readProfileId: {
    title: declareText("explanations.context.readProfileId.title", "Read profile"),
    what: declareText(
      "explanations.context.readProfileId.what",
      "The read profile used to read the originals the passages come from; its current policy is checked on every read.",
    ),
    affects: declareText(
      "explanations.context.readProfileId.affects",
      "Whether passages can be verified against their originals, and how much may be read.",
    ),
    safeValue: declareText(
      "explanations.context.readProfileId.safeValue",
      "An enabled read profile with limits above the context's fragment size.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.shared.aDisabledOrMissingProfile",
          "A disabled or missing profile",
        ),
        declareText(
          "explanations.context.readProfileId.extremes.0.then",
          "Every context assembly — and every answer using it — fails.",
        ),
      ),
    ],
    example: declareText("explanations.context.readProfileId.example", "The default read profile."),
  },
  assembly: {
    title: declareText("explanations.context.assembly.title", "Assembly"),
    what: declareText(
      "explanations.context.assembly.what",
      "INDEPENDENT keeps every selected chunk as its own fragment; MERGE_CONNECTED joins overlapping or adjacent spans of the same document version into one.",
    ),
    affects: declareText(
      "explanations.context.assembly.affects",
      "The number and shape of fragments given to a reader or a model.",
    ),
    safeValue: declareText(
      "explanations.context.assembly.safeValue",
      "MERGE_CONNECTED — fewer, more readable fragments.",
    ),
    extremes: [],
    example: declareText(
      "explanations.context.assembly.example",
      "Chunks 4, 5 and 6 of one page become one fragment with MERGE_CONNECTED.",
    ),
  },
  maximumCandidates: {
    title: declareText("explanations.context.maximumCandidates.title", "Maximum candidates"),
    what: declareText(
      "explanations.context.maximumCandidates.what",
      "The most records selected, neighbours included. The smaller of this and the system setting context.maximum-candidates applies.",
    ),
    affects: declareText(
      "explanations.context.maximumCandidates.affects",
      "How much is loaded and verified per assembly.",
    ),
    safeValue: "100.",
    extremes: [
      plain(
        "1",
        declareText(
          "explanations.context.maximumCandidates.extremes.0.then",
          "Only the top hit is considered, without neighbours.",
        ),
      ),
    ],
    example: declareText(
      "explanations.context.maximumCandidates.example",
      "10 hits with a neighbour radius of 1 select up to 30 records.",
    ),
  },
  maximumFragments: {
    title: declareText("explanations.context.maximumFragments.title", "Maximum fragments"),
    what: declareText(
      "explanations.context.maximumFragments.what",
      "The most fragments returned. The smaller of this and the system setting context.maximum-fragments applies; scripts may narrow it.",
    ),
    affects: declareText(
      "explanations.context.maximumFragments.affects",
      "How many passages a reader or a model gets.",
    ),
    safeValue: "5–10.",
    extremes: [
      plain(
        "1",
        declareText(
          "explanations.context.maximumFragments.extremes.0.then",
          "Answers are built from a single passage.",
        ),
      ),
    ],
    example: declareText(
      "explanations.context.maximumFragments.example",
      "10 fragments of up to 4000 characters.",
    ),
  },
  neighborRadius: {
    title: declareText("explanations.context.neighborRadius.title", "Neighbour radius"),
    what: declareText(
      "explanations.context.neighborRadius.what",
      "How many published chunks before and after a selected chunk are added to it, 0 to 5. Scripts may only reduce it.",
    ),
    affects: declareText(
      "explanations.context.neighborRadius.affects",
      "How much surrounding text a passage carries.",
    ),
    safeValue: "1.",
    extremes: [
      plain(
        "0",
        declareText(
          "explanations.context.neighborRadius.extremes.0.then",
          "Only the matched chunk itself — sentences cut at chunk borders stay cut.",
        ),
      ),
    ],
    example: declareText(
      "explanations.context.neighborRadius.example",
      "1 adds the chunk before and after, so a definition split across two chunks arrives whole.",
    ),
  },
  maximumFragmentCodePoints: {
    title: declareText("explanations.context.maximumFragmentCodePoints.title", "Fragment size"),
    what: declareText(
      "explanations.context.maximumFragmentCodePoints.what",
      "The longest fragment, in characters: an exact prefix of the selected span.",
    ),
    affects: declareText(
      "explanations.context.maximumFragmentCodePoints.affects",
      "How much of each passage is kept.",
    ),
    safeValue: "4000.",
    extremes: [
      trap(
        declareText(
          "explanations.context.maximumFragmentCodePoints.extremes.0.when",
          "Above the total size",
        ),
        declareText(
          "explanations.context.maximumFragmentCodePoints.extremes.0.then",
          "One fragment can use the whole budget and crowd out the rest.",
        ),
      ),
    ],
    example: declareText(
      "explanations.context.maximumFragmentCodePoints.example",
      "4000 characters ≈ 1000 tokens.",
    ),
  },
  maximumCodePoints: {
    title: declareText("explanations.context.maximumCodePoints.title", "Total size"),
    what: declareText(
      "explanations.context.maximumCodePoints.what",
      "The total characters of all fragments; citation metadata is not counted. It is not a model token limit.",
    ),
    affects: declareText(
      "explanations.context.maximumCodePoints.affects",
      "How much source text an answer's prompt carries.",
    ),
    safeValue: declareText(
      "explanations.context.maximumCodePoints.safeValue",
      "20000, and below the answer profile's maximum prompt size.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.context.maximumCodePoints.extremes.0.when",
          "Above the answer profile's maximum prompt size",
        ),
        declareText(
          "explanations.context.maximumCodePoints.extremes.0.then",
          "A full context makes the answer's prompt too large: the answer is refused.",
        ),
      ),
    ],
    example: declareText(
      "explanations.context.maximumCodePoints.example",
      "20000 characters ≈ 5000 tokens.",
    ),
  },
  includeEditorial: {
    title: declareText("explanations.shared.includeEditorialEntries", "Include editorial entries"),
    what: declareText(
      "explanations.context.includeEditorial.what",
      "Whether manual and override entries may become fragments, with their editorial origin and no fabricated document citation.",
    ),
    affects: declareText(
      "explanations.context.includeEditorial.affects",
      "Which passages are offered.",
    ),
    safeValue: declareText(
      "explanations.context.includeEditorial.safeValue",
      "Off, unless curated entries are meant to be quoted.",
    ),
    extremes: [],
    example: declareText(
      "explanations.context.includeEditorial.example",
      "On for a hand-written FAQ.",
    ),
  },
  unavailableOriginal: {
    title: declareText(
      "explanations.context.unavailableOriginal.title",
      "When an original is unavailable",
    ),
    what: declareText(
      "explanations.context.unavailableOriginal.what",
      "FAIL aborts the assembly when an original cannot be read; SKIP leaves that passage out and reports it. A script refusal or the caller's lack of access is never skipped.",
    ),
    affects: declareText(
      "explanations.context.unavailableOriginal.affects",
      "Whether one unreadable original breaks the whole context.",
    ),
    safeValue: declareText(
      "explanations.context.unavailableOriginal.safeValue",
      "SKIP for answers; FAIL when every citation must be checked.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.context.unavailableOriginal.extremes.0.when",
          "FAIL with large originals above the read profile's limits",
        ),
        declareText(
          "explanations.context.unavailableOriginal.extremes.0.then",
          "Every context touching such a document fails.",
        ),
      ),
    ],
    example: declareText(
      "explanations.context.unavailableOriginal.example",
      "A removed file is skipped and named in the report.",
    ),
  },
  statementMilliseconds: statementDeadline({
    what: declareText(
      "explanations.context.statementMilliseconds.what",
      "How long one database statement of the context may run, in milliseconds. The smaller of this and the system setting context.maximum-statement-milliseconds applies.",
    ),
    affects: declareText(
      "explanations.context.statementMilliseconds.affects",
      "The context's database work. Past the deadline the statement is cancelled and the request fails with a timeout rather than holding the database.",
    ),
  }),
  scriptGroupIds: scriptGroups({
    what: declareText(
      "explanations.context.scriptGroupIds.what",
      "jMS script groups that run at the context assembly hook points. Each group's revision is frozen when a request is admitted, so a script edited mid-request does not change it.",
    ),
    affects: declareText(
      "explanations.context.scriptGroupIds.affects",
      "Every context assembly through this profile. Scripts may refuse a request or narrow its limits (fewer results, a smaller budget); they can never widen a limit or bypass access checks.",
    ),
    refused: declareText(
      "explanations.context.scriptGroupIds.extremes.alwaysRefuses.then",
      "Every context assembly through this profile is refused — check the script's dry run before binding it.",
    ),
  }),
  enabled: enabledSwitch({
    what: declareText(
      "explanations.context.enabled.what",
      "Whether new context assemblies may run through this profile.",
    ),
    affects: declareText(
      "explanations.context.enabled.affects",
      "New context assemblies only. A request already admitted keeps the snapshot it froze, and history stays readable.",
    ),
    refused: declareText(
      "explanations.context.enabled.extremes.off.then",
      "Every new context assembly naming this profile is refused, and every profile that names this one stops working too.",
    ),
    example: declareText(
      "explanations.context.enabled.example",
      "Switch it off while a replacement profile is tested, then switch the context assemblies over.",
    ),
  }),
};

// ---------------------------------------------------------------------------------------------------------
// Read profiles.

const READ: Record<string, Entry> = {
  defaultCodePoints: {
    title: declareText("explanations.read.defaultCodePoints.title", "Default read size"),
    what: declareText(
      "explanations.read.defaultCodePoints.what",
      "How many characters are returned when the reader does not ask for a size.",
    ),
    affects: declareText(
      "explanations.read.defaultCodePoints.affects",
      "Most original reads, including those behind contexts.",
    ),
    safeValue: "4000.",
    extremes: [
      trap(
        declareText(
          "explanations.read.defaultCodePoints.extremes.0.when",
          "Above the maximum read size",
        ),
        declareText("explanations.shared.refusedByTheServer", "Refused by the server."),
      ),
    ],
    example: declareText(
      "explanations.read.defaultCodePoints.example",
      "4000 characters by default, up to the maximum on request.",
    ),
  },
  maximumCodePoints: {
    title: declareText("explanations.read.maximumCodePoints.title", "Maximum read size"),
    what: declareText(
      "explanations.read.maximumCodePoints.what",
      "The most characters one read may return. The smallest of this, the request and the system setting documents.read-maximum-code-points applies; scripts may narrow it.",
    ),
    affects: declareText(
      "explanations.read.maximumCodePoints.affects",
      "How much of an original can be read back at once.",
    ),
    safeValue: "10000.",
    extremes: [
      plain(
        "1",
        declareText(
          "explanations.read.maximumCodePoints.extremes.0.then",
          "Reads return a single character.",
        ),
      ),
    ],
    example: declareText(
      "explanations.read.maximumCodePoints.example",
      "An assistant reading a long page in 10000-character steps.",
    ),
  },
  maximumOriginalBytes: {
    title: declareText("explanations.read.maximumOriginalBytes.title", "Maximum original size"),
    what: declareText(
      "explanations.read.maximumOriginalBytes.what",
      "The largest original, in bytes, that may be verified and decoded for a read. The smaller of this and the system setting documents.read-maximum-original-bytes applies.",
    ),
    affects: declareText(
      "explanations.read.maximumOriginalBytes.affects",
      "Which originals can be read at all — a larger one is refused before decoding.",
    ),
    safeValue: "4 MB.",
    extremes: [
      trap(
        declareText(
          "explanations.read.maximumOriginalBytes.extremes.0.when",
          "Below the size of real files",
        ),
        declareText(
          "explanations.read.maximumOriginalBytes.extremes.0.then",
          "Those originals cannot be read, and contexts that need them fail or skip them.",
        ),
      ),
    ],
    example: declareText(
      "explanations.read.maximumOriginalBytes.example",
      "A 6 MB Markdown export needs at least 6291456.",
    ),
  },
  maximumOriginalCharacters: {
    title: declareText(
      "explanations.read.maximumOriginalCharacters.title",
      "Maximum decoded characters",
    ),
    what: declareText(
      "explanations.read.maximumOriginalCharacters.what",
      "The most characters a whole decoded original may have; a larger one fails without returning content.",
    ),
    affects: declareText(
      "explanations.read.maximumOriginalCharacters.affects",
      "Which originals can be read.",
    ),
    safeValue: "1048576.",
    extremes: [
      trap(
        declareText("explanations.shared.small", "Small"),
        declareText(
          "explanations.read.maximumOriginalCharacters.extremes.0.then",
          "Long documents cannot be read.",
        ),
      ),
    ],
    example: declareText(
      "explanations.read.maximumOriginalCharacters.example",
      "One million characters is a long book.",
    ),
  },
  allowHistoricalVersions: {
    title: declareText("explanations.read.allowHistoricalVersions.title", "Allow older versions"),
    what: declareText(
      "explanations.read.allowHistoricalVersions.what",
      "Whether older stored versions of an original may be read, whatever the index currently publishes.",
    ),
    affects: declareText(
      "explanations.read.allowHistoricalVersions.affects",
      "Reads of a version other than the current one.",
    ),
    safeValue: declareText("explanations.read.allowHistoricalVersions.safeValue", "Off."),
    extremes: [],
    example: declareText(
      "explanations.read.allowHistoricalVersions.example",
      "On for an audit profile comparing a document with its earlier version.",
    ),
  },
  scriptGroupIds: scriptGroups({
    what: declareText(
      "explanations.read.scriptGroupIds.what",
      "jMS script groups that run at the original read hook points. Each group's revision is frozen when a request is admitted, so a script edited mid-request does not change it.",
    ),
    affects: declareText(
      "explanations.read.scriptGroupIds.affects",
      "Every original read through this profile. Scripts may refuse a request or narrow its limits (fewer results, a smaller budget); they can never widen a limit or bypass access checks.",
    ),
    refused: declareText(
      "explanations.read.scriptGroupIds.extremes.alwaysRefuses.then",
      "Every original read through this profile is refused — check the script's dry run before binding it.",
    ),
  }),
  enabled: enabledSwitch({
    what: declareText(
      "explanations.read.enabled.what",
      "Whether new reads may run through this profile.",
    ),
    affects: declareText(
      "explanations.read.enabled.affects",
      "New reads only. A request already admitted keeps the snapshot it froze, and history stays readable.",
    ),
    refused: declareText(
      "explanations.read.enabled.extremes.off.then",
      "Every new read naming this profile is refused, and every profile that names this one stops working too.",
    ),
    example: declareText(
      "explanations.read.enabled.example",
      "Switch it off while a replacement profile is tested, then switch the reads over.",
    ),
  }),
};

// ---------------------------------------------------------------------------------------------------------
// Processing (preparation) profiles.

// ---------------------------------------------------------------------------------------------------------
// The XML and JSON parsers label every entry `path : value`; their options decide what an entry is and how its path
// reads. Both parsers share the sentences, each under its own parser.

const STRUCTURED_DATA_OPTIONS: Record<string, Entry> = {
  pathStyle: {
    title: declareText("explanations.processing.parserOptions.pathStyle.title", "Path style"),
    what: declareText(
      "explanations.processing.parserOptions.pathStyle.what",
      "How an entry's path is written: XPath-like /project/build/plugins/plugin[2]/artifactId, a JSON path $.dependencies.react, or dotted project.build.plugins.plugin[2].artifactId.",
    ),
    affects: declareText(
      "explanations.processing.parserOptions.pathStyle.affects",
      "The path every entry is indexed under and found by — its symbol, like Type#member for Java — and the Paths view. The words of the path are searchable in every style.",
    ),
    safeValue: declareText("explanations.processing.parserOptions.pathStyle.safeValue", "XPATH for XML, JSON_PATH for JSON."),
    extremes: [
      plain(
        declareText("explanations.processing.parserOptions.pathStyle.extremes.0.when", "DOTTED"),
        declareText(
          "explanations.processing.parserOptions.pathStyle.extremes.0.then",
          "Paths read like property keys; a search typed as /project/… no longer matches a path exactly.",
        ),
      ),
    ],
    example: declareText(
      "explanations.processing.parserOptions.pathStyle.example",
      "XPATH: /project/dependencies/dependency[3] : groupId=org.jmouse · artifactId=jmouse-core.",
    ),
  },
  includeAttributes: {
    title: declareText("explanations.processing.parserOptions.includeAttributes.title", "Include attributes"),
    what: declareText(
      "explanations.processing.parserOptions.includeAttributes.what",
      "An element's attributes are values of its entry, written @name=value.",
    ),
    affects: declareText(
      "explanations.processing.parserOptions.includeAttributes.affects",
      "What XML entries index. The attributes stay in the chunk for reading either way.",
    ),
    safeValue: declareText("explanations.processing.parserOptions.includeAttributes.safeValue", "On."),
    extremes: [
      plain(
        declareText("explanations.shared.off", "Off"),
        declareText(
          "explanations.processing.parserOptions.includeAttributes.extremes.0.then",
          "Identifiers held in attributes — id, name, ref — are no longer found by search.",
        ),
      ),
    ],
    example: declareText(
      "explanations.processing.parserOptions.includeAttributes.example",
      "On: /beans/bean[2] : @id=dataSource · @class=HikariDataSource.",
    ),
  },
  indexKeysOnly: {
    title: declareText("explanations.processing.parserOptions.indexKeysOnly.title", "Index keys only"),
    what: declareText(
      "explanations.processing.parserOptions.indexKeysOnly.what",
      "On indexes keys and paths only — for schema-like files whose structure matters more than their values.",
    ),
    affects: declareText(
      "explanations.processing.parserOptions.indexKeysOnly.affects",
      "What keyword search and vectors read of each entry. The values stay in their chunks for reading and citation.",
    ),
    safeValue: declareText("explanations.processing.parserOptions.indexKeysOnly.safeValue", "Off."),
    extremes: [
      trap(
        declareText("explanations.processing.parserOptions.indexKeysOnly.extremes.0.when", "On"),
        declareText(
          "explanations.processing.parserOptions.indexKeysOnly.extremes.0.then",
          "A search for a version number or a URL finds nothing in this file.",
        ),
      ),
    ],
    example: declareText(
      "explanations.processing.parserOptions.indexKeysOnly.example",
      "On: $.dependencies : react · vite.",
    ),
  },
  skipPaths: {
    title: declareText("explanations.processing.parserOptions.skipPaths.title", "Skip paths"),
    what: declareText(
      "explanations.processing.parserOptions.skipPaths.what",
      "Paths left out of the entries, one per line, in any path style. * stands for one step, ** for any number; a step without a position matches every position.",
    ),
    affects: declareText(
      "explanations.processing.parserOptions.skipPaths.affects",
      "What is indexed. A skipped node and everything under it is left out of entries; its text stays in the original.",
    ),
    safeValue: declareText("explanations.processing.parserOptions.skipPaths.safeValue", "Empty."),
    extremes: [
      trap(
        declareText("explanations.processing.parserOptions.skipPaths.extremes.0.when", "A pattern near the root"),
        declareText(
          "explanations.processing.parserOptions.skipPaths.extremes.0.then",
          "/project or $ leaves the whole file out of search.",
        ),
      ),
    ],
    example: declareText(
      "explanations.processing.parserOptions.skipPaths.example",
      "$.lockfileVersion, /project/build/pluginManagement, **.description.",
    ),
  },
  maximumDepth: {
    title: declareText("explanations.processing.parserOptions.maximumDepth.title", "Maximum depth"),
    what: declareText(
      "explanations.processing.parserOptions.maximumDepth.what",
      "How deep the path goes before a node is kept whole: everything below it is folded into its entry by relative path.",
    ),
    affects: declareText(
      "explanations.processing.parserOptions.maximumDepth.affects",
      "How finely a deep file is cut into entries.",
    ),
    safeValue: declareText("explanations.processing.parserOptions.maximumDepth.safeValue", "4 for XML (the root is 1), 3 for JSON."),
    extremes: [
      trap(
        declareText("explanations.shared.small", "Small"),
        declareText(
          "explanations.processing.parserOptions.maximumDepth.extremes.0.then",
          "Large parts of the file become one entry each; a chunk holding one is cut into windows.",
        ),
      ),
      plain(
        declareText("explanations.shared.large", "Large"),
        declareText(
          "explanations.processing.parserOptions.maximumDepth.extremes.1.then",
          "Every level is entered; every value at the bottom is an entry of its own.",
        ),
      ),
    ],
    example: declareText(
      "explanations.processing.parserOptions.maximumDepth.example",
      "4: /project/build/plugins/plugin[2] : groupId=… · configuration/release=21.",
    ),
  },
  maximumArrayItems: {
    title: declareText("explanations.processing.parserOptions.maximumArrayItems.title", "Most items per entry"),
    what: declareText(
      "explanations.processing.parserOptions.maximumArrayItems.what",
      "A list of values with at most this many items is one value, its items on one line; a longer list is an entry per item.",
    ),
    affects: declareText(
      "explanations.processing.parserOptions.maximumArrayItems.affects",
      "How long lists are split into entries.",
    ),
    safeValue: "20.",
    extremes: [
      plain(
        declareText("explanations.shared.small", "Small"),
        declareText(
          "explanations.processing.parserOptions.maximumArrayItems.extremes.0.then",
          "Even short lists are split item by item.",
        ),
      ),
    ],
    example: declareText(
      "explanations.processing.parserOptions.maximumArrayItems.example",
      "20: $.keywords : pdf, search, index is one entry.",
    ),
  },
};

/** The structured-data explanations under one parser's keys. */
function structuredDataOptions(parserId: string, names: string[]): Record<string, Entry> {
  const entries: Record<string, Entry> = {};
  for (const name of names) {
    const entry = STRUCTURED_DATA_OPTIONS[name];
    if (entry !== undefined) {
      entries[`parserOptions.${parserId}.${name}`] = entry;
    }
  }
  return entries;
}

const PROCESSING: Record<string, Entry> = {
  ...structuredDataOptions("xml-structure", [
    "pathStyle",
    "includeAttributes",
    "indexKeysOnly",
    "skipPaths",
    "maximumDepth",
  ]),
  ...structuredDataOptions("json-structure", ["pathStyle", "indexKeysOnly", "skipPaths", "maximumDepth", "maximumArrayItems"]),
  enabled: enabledSwitch({
    what: declareText(
      "explanations.processing.enabled.what",
      "Whether new processing submissions may run through this profile.",
    ),
    affects: declareText(
      "explanations.processing.enabled.affects",
      "New processing submissions only. A request already admitted keeps the snapshot it froze, and history stays readable.",
    ),
    refused: declareText(
      "explanations.processing.enabled.extremes.off.then",
      "Every new processing submission naming this profile is refused, and every profile that names this one stops working too.",
    ),
    example: declareText(
      "explanations.processing.enabled.example",
      "Switch it off while a replacement profile is tested, then switch the processing submissions over.",
    ),
  }),
  "preparation.steps": {
    title: declareText("explanations.processing.preparation.steps.title", "Preparation steps"),
    what: declareText(
      "explanations.processing.preparation.steps.what",
      "The steps a document goes through, in order: parse, then chunk, then index. A step needs the steps before it.",
    ),
    affects: declareText(
      "explanations.processing.preparation.steps.affects",
      "How far processing goes: without indexing nothing becomes searchable.",
    ),
    safeValue: declareText(
      "explanations.processing.preparation.steps.safeValue",
      "Parse, chunk and index.",
    ),
    extremes: [
      trap(
        declareText("explanations.processing.preparation.steps.extremes.0.when", "Parse only"),
        declareText(
          "explanations.processing.preparation.steps.extremes.0.then",
          "Documents are parsed but never chunked or indexed — not searchable.",
        ),
      ),
    ],
    example: declareText(
      "explanations.processing.preparation.steps.example",
      "All three for a normal source.",
    ),
  },
  "preparation.scriptGroupIds": scriptGroups({
    what: declareText(
      "explanations.processing.preparation.scriptGroupIds.what",
      "jMS script groups that run at the preparation hook points. Each group's revision is frozen when a request is admitted, so a script edited mid-request does not change it.",
    ),
    affects: declareText(
      "explanations.processing.preparation.scriptGroupIds.affects",
      "Every preparation through this profile. Scripts may refuse a request or narrow its limits (fewer results, a smaller budget); they can never widen a limit or bypass access checks.",
    ),
    refused: declareText(
      "explanations.processing.preparation.scriptGroupIds.extremes.alwaysRefuses.then",
      "Every preparation through this profile is refused — check the script's dry run before binding it.",
    ),
  }),
  parserId: {
    title: declareText("explanations.processing.parserId.title", "Parser"),
    what: declareText(
      "explanations.processing.parserId.what",
      "How an original's bytes become structured text: plain UTF-8 text, Markdown with its headings, and other installed parsers.",
    ),
    affects: declareText(
      "explanations.processing.parserId.affects",
      "Headings, blocks and the text that is chunked and indexed.",
    ),
    safeValue: declareText(
      "explanations.processing.parserId.safeValue",
      "The parser matching the source's files.",
    ),
    extremes: [
      plain(
        declareText("explanations.processing.parserId.extremes.0.when", "Plain text for Markdown"),
        declareText(
          "explanations.processing.parserId.extremes.0.then",
          "Headings are not recognised, so chunks lose their section titles.",
        ),
      ),
    ],
    example: declareText(
      "explanations.processing.parserId.example",
      "markdown for a documentation repository.",
    ),
  },
  maximumCharacters: {
    title: declareText("explanations.processing.maximumCharacters.title", "Maximum characters"),
    what: declareText(
      "explanations.processing.maximumCharacters.what",
      "The longest decoded original that may be processed. The smaller of this and the system setting processing.maximum-characters applies, frozen at submission.",
    ),
    affects: declareText(
      "explanations.processing.maximumCharacters.affects",
      "Which documents can be processed — a longer one fails.",
    ),
    safeValue: "1048576.",
    extremes: [
      trap(
        declareText("explanations.shared.small", "Small"),
        declareText(
          "explanations.processing.maximumCharacters.extremes.0.then",
          "Long documents fail processing.",
        ),
      ),
    ],
    example: declareText(
      "explanations.processing.maximumCharacters.example",
      "One million characters.",
    ),
  },
  maximumBlocks: {
    title: declareText("explanations.processing.maximumBlocks.title", "Maximum blocks"),
    what: declareText(
      "explanations.processing.maximumBlocks.what",
      "The most structural blocks (paragraphs, headings, list items) one document may parse into. The smaller of this and the system setting processing.maximum-blocks applies.",
    ),
    affects: declareText(
      "explanations.processing.maximumBlocks.affects",
      "Which documents can be processed.",
    ),
    safeValue: "10000.",
    extremes: [
      trap(
        declareText("explanations.shared.small", "Small"),
        declareText(
          "explanations.processing.maximumBlocks.extremes.0.then",
          "Long structured documents fail processing.",
        ),
      ),
    ],
    example: declareText(
      "explanations.processing.maximumBlocks.example",
      "A 300-page manual may have 8000 blocks.",
    ),
  },
  maximumChunks: {
    title: declareText("explanations.processing.maximumChunks.title", "Maximum chunks"),
    what: declareText(
      "explanations.processing.maximumChunks.what",
      "The most chunks one document may be cut into. Keep it small for notes and code, and raise it on the profiles that read books and PDFs. The smaller of this and the system setting processing.maximum-chunks applies.",
    ),
    affects: declareText("explanations.processing.maximumChunks.affects", "Which long documents can be processed."),
    safeValue: "1000; 10000 for books and PDFs.",
    extremes: [
      trap(
        declareText("explanations.shared.small", "Small"),
        declareText("explanations.processing.maximumChunks.extremes.0.then", "A long document fails processing: it cuts into more chunks than allowed."),
      ),
    ],
    example: declareText("explanations.processing.maximumChunks.example", "A 600-page novel cuts into about 1,100 chunks of 1,200 characters."),
  },
  "preparation.chunking.strategyId": {
    title: declareText(
      "explanations.processing.preparation.chunking.strategyId.title",
      "Chunking strategy",
    ),
    what: declareText(
      "explanations.processing.preparation.chunking.strategyId.what",
      "How parsed text is cut into chunks: by sections within a size window, by code structure, and other installed strategies.",
    ),
    affects: declareText(
      "explanations.processing.preparation.chunking.strategyId.affects",
      "What one search hit and one vector cover.",
    ),
    safeValue: declareText(
      "explanations.processing.preparation.chunking.strategyId.safeValue",
      "section-window for prose.",
    ),
    extremes: [],
    example: declareText(
      "explanations.processing.preparation.chunking.strategyId.example",
      "section-window keeps a chunk inside one heading's section.",
    ),
  },
  "preparation.chunking.maximumCodePoints": {
    title: declareText(
      "explanations.processing.preparation.chunking.maximumCodePoints.title",
      "Chunk size",
    ),
    what: declareText(
      "explanations.processing.preparation.chunking.maximumCodePoints.what",
      "The longest chunk, in characters.",
    ),
    affects: declareText(
      "explanations.processing.preparation.chunking.maximumCodePoints.affects",
      "Search precision, excerpt content and vectorising cost: smaller chunks are sharper hits but more vectors.",
    ),
    safeValue: "800–1500.",
    extremes: [
      plain(
        declareText("explanations.shared.verySmallSuchAs50", "Very small, such as 50"),
        declareText(
          "explanations.processing.preparation.chunking.maximumCodePoints.extremes.0.then",
          "Hits are fragments of sentences; vectors lose context.",
        ),
      ),
      plain(
        "10000",
        declareText(
          "explanations.processing.preparation.chunking.maximumCodePoints.extremes.1.then",
          "Hits are whole pages; a vector averages many topics.",
        ),
      ),
    ],
    example: declareText(
      "explanations.processing.preparation.chunking.maximumCodePoints.example",
      "1200 characters ≈ a few paragraphs.",
    ),
  },
  "preparation.chunking.overlapCodePoints": {
    title: declareText(
      "explanations.processing.preparation.chunking.overlapCodePoints.title",
      "Chunk overlap",
    ),
    what: declareText(
      "explanations.processing.preparation.chunking.overlapCodePoints.what",
      "How many characters each chunk repeats from the end of the one before. It must be smaller than the chunk size.",
    ),
    affects: declareText(
      "explanations.processing.preparation.chunking.overlapCodePoints.affects",
      "Whether text at a chunk border is found intact; overlap is embedded and paid for twice.",
    ),
    safeValue: declareText(
      "explanations.processing.preparation.chunking.overlapCodePoints.safeValue",
      "About a tenth of the chunk size.",
    ),
    extremes: [
      plain(
        "0",
        declareText(
          "explanations.processing.preparation.chunking.overlapCodePoints.extremes.0.then",
          "A sentence split at a border is found in neither half.",
        ),
      ),
      trap(
        declareText(
          "explanations.processing.preparation.chunking.overlapCodePoints.extremes.1.when",
          "At or above the chunk size",
        ),
        declareText(
          "explanations.processing.preparation.chunking.overlapCodePoints.extremes.1.then",
          "Refused by the server — chunking would never advance.",
        ),
      ),
    ],
    example: declareText(
      "explanations.processing.preparation.chunking.overlapCodePoints.example",
      "120 with chunks of 1200.",
    ),
  },
  "preparation.chunking.unitMerging": {
    title: declareText("explanations.processing.preparation.chunking.unitMerging.title", "Unit merging"),
    what: declareText(
      "explanations.processing.preparation.chunking.unitMerging.what",
      "For documents whose parser reads logical units, whether the chunker merges them. As parsed: every unit the parser emitted — a table row, a list item, a paragraph, a declaration, a value of JSON or XML — is exactly one chunk, and the entry and table units do not apply. Merge small: small neighbours share a chunk up to the chunk size, as the entry and table units say.",
    ),
    affects: declareText(
      "explanations.processing.preparation.chunking.unitMerging.affects",
      "How many chunks and vectors every structured document gets. In both modes a unit longer than the chunk size is still cut into windows that keep its symbol — a model cannot take unbounded text.",
    ),
    safeValue: declareText(
      "explanations.processing.preparation.chunking.unitMerging.safeValue",
      "Merge small for meaning search; As parsed when every fragment must be exactly what the parser found.",
    ),
    extremes: [
      plain(
        declareText("explanations.processing.preparation.chunking.unitMerging.extremes.0.when", "As parsed"),
        declareText(
          "explanations.processing.preparation.chunking.unitMerging.extremes.0.then",
          "The most chunks: one per row, line item, paragraph and value — exact for keyword search, many small vectors to pay for.",
        ),
      ),
    ],
    example: declareText(
      "explanations.processing.preparation.chunking.unitMerging.example",
      "As parsed: a 40-row register table is 40 chunks, whatever the table unit says.",
    ),
  },
  "preparation.chunking.entryUnit": {
    title: declareText("explanations.processing.preparation.chunking.entryUnit.title", "Entry unit"),
    what: declareText(
      "explanations.processing.preparation.chunking.entryUnit.what",
      "How many values of a JSON or XML document share a chunk. Value: each value on its own. Object: the values of one object or element together, up to the chunk size. Group: consecutive values up to the chunk size, whichever objects they belong to. Every value keeps its full path either way.",
    ),
    affects: declareText(
      "explanations.processing.preparation.chunking.entryUnit.affects",
      "How many chunks and vectors a data file gets, and how precisely a hit points at one value. Not used when units are kept as parsed.",
    ),
    safeValue: declareText(
      "explanations.processing.preparation.chunking.entryUnit.safeValue",
      "Value for keyword search; Object when the profile also makes vectors.",
    ),
    extremes: [
      trap(
        declareText("explanations.processing.preparation.chunking.entryUnit.extremes.0.when", "Value"),
        declareText(
          "explanations.processing.preparation.chunking.entryUnit.extremes.0.then",
          "Many small chunks: fine for keyword search, weak and costly for vectors — a lone «groupId = org.jmouse» means little to a model.",
        ),
      ),
      plain(
        declareText("explanations.processing.preparation.chunking.entryUnit.extremes.1.when", "Group"),
        declareText(
          "explanations.processing.preparation.chunking.entryUnit.extremes.1.then",
          "The fewest chunks; a hit says which part of the file, not which value.",
        ),
      ),
    ],
    example: declareText(
      "explanations.processing.preparation.chunking.entryUnit.example",
      "Object: $.dependencies with react = 19.2.8 and vite = 8.2.2 is one chunk; Value makes it two.",
    ),
  },
  "preparation.chunking.tableUnit": {
    title: declareText("explanations.processing.preparation.chunking.tableUnit.title", "Table unit"),
    what: declareText(
      "explanations.processing.preparation.chunking.tableUnit.what",
      "How big a retrieval unit of a table is: the whole table in fragments, the rows one merged cell ties together, each row, or each cell with a value. Every unit carries the table's title and header, and merged cells are filled down into every row, so a unit stands on its own.",
    ),
    affects: declareText(
      "explanations.processing.preparation.chunking.tableUnit.affects",
      "How many chunks and vectors a document with tables gets, and how precisely a search hit points at one value. Changing it re-chunks without re-parsing. Not used when units are kept as parsed: then every row is a chunk.",
    ),
    safeValue: declareText(
      "explanations.processing.preparation.chunking.tableUnit.safeValue",
      "Row — one parameter per hit. Table when the chunk ceiling or the embedding budget is tight.",
    ),
    extremes: [
      plain(
        declareText("explanations.processing.preparation.chunking.tableUnit.extremes.0.when", "Cell"),
        declareText(
          "explanations.processing.preparation.chunking.tableUnit.extremes.0.then",
          "The most chunks: every value with its row label and column — exact, and the most vectors to pay for.",
        ),
      ),
      plain(
        declareText("explanations.processing.preparation.chunking.tableUnit.extremes.1.when", "Table"),
        declareText(
          "explanations.processing.preparation.chunking.tableUnit.extremes.1.then",
          "The fewest chunks: up to the row limit per fragment; a hit says which table, not which row.",
        ),
      ),
    ],
    example: declareText(
      "explanations.processing.preparation.chunking.tableUnit.example",
      "Row: «No.: 5 · Item: Input Voltage › VCI · Description: 2.50V ~ 3.30V» is one chunk under the table's title and header.",
    ),
  },
  "preparation.chunking.maximumTableRowsPerFragment": {
    title: declareText(
      "explanations.processing.preparation.chunking.maximumTableRowsPerFragment.title",
      "Rows per table chunk",
    ),
    what: declareText(
      "explanations.processing.preparation.chunking.maximumTableRowsPerFragment.what",
      "The most rows one table chunk holds, the header aside, when the table unit is Table or Row group. A larger table is cut between rows — never inside a group of rows a merged cell ties together — and every fragment repeats the title and header.",
    ),
    affects: declareText(
      "explanations.processing.preparation.chunking.maximumTableRowsPerFragment.affects",
      "How many chunks a long table becomes. The chunk size still applies.",
    ),
    safeValue: "20.",
    extremes: [
      plain(
        declareText("explanations.shared.one", "1"),
        declareText(
          "explanations.processing.preparation.chunking.maximumTableRowsPerFragment.extremes.0.then",
          "A table fragment is one row, as with the Row unit.",
        ),
      ),
    ],
    example: declareText(
      "explanations.processing.preparation.chunking.maximumTableRowsPerFragment.example",
      "20: a 60-row register table becomes three chunks, each with the table's header.",
    ),
  },
  "parserOptions.pdf-layout.removePageFurniture": {
    title: declareText("explanations.processing.parserOptions.removePageFurniture.title", "Keep page headers and footers out"),
    what: declareText(
      "explanations.processing.parserOptions.removePageFurniture.what",
      "Lines repeated at the top or bottom of many pages — the part number and title in the header, «Page 14 of 233» and the copyright in the footer — are read as page furniture: kept in the parsed text for reading and citing, left out of keyword entries and vectors.",
    ),
    affects: declareText(
      "explanations.processing.parserOptions.removePageFurniture.affects",
      "What PDF chunks index. The furniture still names the document: its part, maker and revision go in front of every chunk.",
    ),
    safeValue: declareText("explanations.processing.parserOptions.removePageFurniture.safeValue", "On."),
    extremes: [
      trap(
        declareText("explanations.shared.off", "Off"),
        declareText(
          "explanations.processing.parserOptions.removePageFurniture.extremes.0.then",
          "Every page's header and footer is indexed again — the same words on every page, matching every query about the part. A pipeline step can still drop them.",
        ),
      ),
    ],
    example: declareText(
      "explanations.processing.parserOptions.removePageFurniture.example",
      "On: «ILI9341 · a-Si TFT LCD Single Chip Driver» is indexed once, as the document's identity, not 233 times.",
    ),
  },
  "parserOptions.pdf-layout.joinHyphenatedLines": {
    title: declareText("explanations.processing.parserOptions.joinHyphenatedLines.title", "Join hyphenated lines"),
    what: declareText(
      "explanations.processing.parserOptions.joinHyphenatedLines.what",
      "A paragraph is indexed as one line, and a word a hyphen broke at the end of a line is joined again. A hyphen before a capital or a digit stays: «a-Si», «8-bit».",
    ),
    affects: declareText(
      "explanations.processing.parserOptions.joinHyphenatedLines.affects",
      "The words keyword search finds in PDF paragraphs and table cells. The parsed text keeps its lines either way.",
    ),
    safeValue: declareText("explanations.processing.parserOptions.joinHyphenatedLines.safeValue", "On."),
    extremes: [
      plain(
        declareText("explanations.shared.off", "Off"),
        declareText(
          "explanations.processing.parserOptions.joinHyphenatedLines.extremes.0.then",
          "Paragraphs keep their line breaks; «exam-» and «ple» stay two words unless a pipeline step joins them.",
        ),
      ),
    ],
    example: declareText(
      "explanations.processing.parserOptions.joinHyphenatedLines.example",
      "On: «configu-» at a line end and «ration» on the next index as «configuration».",
    ),
  },
  "parserOptions.pdf-layout.maximumPages": {
    title: declareText("explanations.processing.parserOptions.maximumPages.title", "Most pages"),
    what: declareText(
      "explanations.processing.parserOptions.maximumPages.what",
      "A PDF with more pages is refused rather than read in part, so nothing is ever cited from half a document.",
    ),
    affects: declareText(
      "explanations.processing.parserOptions.maximumPages.affects",
      "Which PDFs can be processed. Reading by layout holds every page's glyphs while it reads.",
    ),
    safeValue: "1000.",
    extremes: [
      trap(
        declareText("explanations.shared.small", "Small"),
        declareText(
          "explanations.processing.parserOptions.maximumPages.extremes.0.then",
          "Long manuals are refused with the page count in the reason.",
        ),
      ),
    ],
    example: declareText("explanations.processing.parserOptions.maximumPages.example", "A 233-page datasheet needs at least 233."),
  },
  "preparation.indexing.backendId": {
    title: declareText(
      "explanations.processing.preparation.indexing.backendId.title",
      "Index backend",
    ),
    what: declareText(
      "explanations.processing.preparation.indexing.backendId.what",
      "Where chunks are written for keyword search.",
    ),
    affects: declareText(
      "explanations.processing.preparation.indexing.backendId.affects",
      "Which search backend can find them.",
    ),
    safeValue: "postgresql-fts.",
    extremes: [],
    example: "postgresql-fts.",
  },
  "preparation.indexing.analyzer": {
    title: declareText("explanations.processing.preparation.indexing.analyzer.title", "Analyzer"),
    what: declareText(
      "explanations.processing.preparation.indexing.analyzer.what",
      "How text is reduced to searchable terms. simple lowercases words; english also stems them and drops English stop words.",
    ),
    affects: declareText(
      "explanations.processing.preparation.indexing.analyzer.affects",
      "Which search profiles can find these entries: a search profile matches only analyzers it lists.",
    ),
    safeValue: declareText(
      "explanations.processing.preparation.indexing.analyzer.safeValue",
      "The analyzer the search profiles list — simple by default.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.processing.preparation.indexing.analyzer.extremes.0.when",
          "An analyzer no search profile lists",
        ),
        declareText(
          "explanations.processing.preparation.indexing.analyzer.extremes.0.then",
          "Processed documents are invisible to every keyword search.",
        ),
      ),
    ],
    example: declareText(
      "explanations.processing.preparation.indexing.analyzer.example",
      "english finds “deploying” for “deploy”.",
    ),
  },
  "preparation.indexing.includeTitle": {
    title: declareText(
      "explanations.processing.preparation.indexing.includeTitle.title",
      "Include the title",
    ),
    what: declareText(
      "explanations.processing.preparation.indexing.includeTitle.what",
      "Whether the document title is indexed with each chunk.",
    ),
    affects: declareText(
      "explanations.processing.preparation.indexing.includeTitle.affects",
      "Whether a search for the title's words finds every chunk of the document.",
    ),
    safeValue: declareText("explanations.shared.on", "On."),
    extremes: [],
    example: declareText(
      "explanations.processing.preparation.indexing.includeTitle.example",
      "A chunk of “Deployment guide” is found by “deployment” even if the chunk never says it.",
    ),
  },
  "preparation.indexing.publishAutomatically": {
    title: declareText(
      "explanations.processing.preparation.indexing.publishAutomatically.title",
      "Publish automatically",
    ),
    what: declareText(
      "explanations.processing.preparation.indexing.publishAutomatically.what",
      "Whether a newly indexed generation becomes the searchable one as soon as it is ready (for the latest version).",
    ),
    affects: declareText(
      "explanations.processing.preparation.indexing.publishAutomatically.affects",
      "When processed documents become searchable.",
    ),
    safeValue: declareText("explanations.shared.on", "On."),
    extremes: [
      trap(
        declareText("explanations.shared.off", "Off"),
        declareText(
          "explanations.processing.preparation.indexing.publishAutomatically.extremes.0.then",
          "Processed documents stay unsearchable until a generation is published by hand on the index page.",
        ),
      ),
    ],
    example: declareText(
      "explanations.processing.preparation.indexing.publishAutomatically.example",
      "Off to review a re-chunked source before switching searches to it.",
    ),
  },
};

// ---------------------------------------------------------------------------------------------------------
// AI provider configurations.

const PROVIDER: Record<string, Entry> = {
  provider: {
    title: declareText("explanations.provider.provider.title", "Provider"),
    what: declareText(
      "explanations.provider.provider.what",
      "Which provider the configuration talks to; it decides the default address, whether a key is needed and which uses are offered.",
    ),
    affects: declareText(
      "explanations.provider.provider.affects",
      "Every call made through this configuration.",
    ),
    safeValue: declareText(
      "explanations.provider.provider.safeValue",
      "The provider whose account and model you use.",
    ),
    extremes: [],
    example: declareText(
      "explanations.provider.provider.example",
      "voyage for embeddings and reranking, anthropic for answers.",
    ),
  },
  model: {
    title: declareText("explanations.provider.model.title", "Model"),
    what: declareText(
      "explanations.provider.model.what",
      "The model name exactly as the provider spells it. Embedding profiles and rerank stages may name their own model; answers use this one.",
    ),
    affects: declareText(
      "explanations.provider.model.affects",
      "Which model answers calls. For embeddings it is part of the model space.",
    ),
    safeValue: declareText("explanations.provider.model.safeValue", "A model the provider lists."),
    extremes: [
      trap(
        declareText("explanations.provider.model.extremes.0.when", "A misspelt name"),
        declareText(
          "explanations.provider.model.extremes.0.then",
          "Every call is refused by the provider.",
        ),
      ),
    ],
    example: "voyage-4-lite, claude-sonnet-5-5.",
  },
  capabilities: {
    title: declareText("explanations.provider.capabilities.title", "Used for"),
    what: declareText(
      "explanations.provider.capabilities.what",
      "What this configuration may serve: Answers (chat), Embeddings (vectors), Reranking. Each use has its own call limits.",
    ),
    affects: declareText(
      "explanations.provider.capabilities.affects",
      "Which profiles may choose it. Declared alone, Reranking owns the address; declared with another use, reranking goes to the provider's known rerank endpoint.",
    ),
    safeValue: declareText(
      "explanations.provider.capabilities.safeValue",
      "One use per configuration where the provider has separate endpoints.",
    ),
    extremes: [
      trap(
        declareText(
          "explanations.provider.capabilities.extremes.0.when",
          "Reranking beside another use, for a provider without a known rerank endpoint",
        ),
        declareText(
          "explanations.provider.capabilities.extremes.0.then",
          "Search profiles cannot rerank with it; add a configuration declaring Reranking alone.",
        ),
      ),
    ],
    example: declareText(
      "explanations.provider.capabilities.example",
      "Voyage: one configuration for Embeddings, one for Reranking.",
    ),
  },
  apiKey: {
    title: declareText("explanations.provider.apiKey.title", "API key"),
    what: declareText(
      "explanations.provider.apiKey.what",
      "The provider account's key. It is stored write-only and never shown again; leaving the field blank on a change keeps the stored key.",
    ),
    affects: declareText(
      "explanations.provider.apiKey.affects",
      "Whether calls are accepted. Configurations sharing a provider and key share one account budget.",
    ),
    safeValue: declareText(
      "explanations.provider.apiKey.safeValue",
      "A key for a dedicated project or account with its own spending limit.",
    ),
    extremes: [
      plain(
        declareText(
          "explanations.provider.apiKey.extremes.0.when",
          "No key, for a provider that needs one",
        ),
        declareText(
          "explanations.provider.apiKey.extremes.0.then",
          "Profiles show the configuration as unusable; nothing is called.",
        ),
      ),
    ],
    example: declareText(
      "explanations.provider.apiKey.example",
      "Replacing the key carries the account's shared budget over, or reports why it could not.",
    ),
  },
  apiUrl: {
    title: declareText("explanations.provider.apiUrl.title", "Address"),
    what: declareText(
      "explanations.provider.apiUrl.what",
      "The endpoint called. Blank uses the provider's default; for a configuration declaring Reranking alone it is the rerank endpoint itself.",
    ),
    affects: declareText("explanations.provider.apiUrl.affects", "Where requests go."),
    safeValue: declareText(
      "explanations.provider.apiUrl.safeValue",
      "Blank for a hosted provider; the server's address for a local one.",
    ),
    extremes: [
      trap(
        declareText("explanations.provider.apiUrl.extremes.0.when", "Another provider's address"),
        declareText(
          "explanations.provider.apiUrl.extremes.0.then",
          "Calls fail or are understood wrongly.",
        ),
      ),
    ],
    example: declareText(
      "explanations.provider.apiUrl.example",
      "http://localhost:8080 for a local Text Embeddings Inference server.",
    ),
  },
  maximumTokens: {
    title: declareText("explanations.provider.maximumTokens.title", "Maximum tokens"),
    what: declareText(
      "explanations.provider.maximumTokens.what",
      "The configuration's own token ceiling. For answers it caps the output tokens; for a search question it caps the tokens one question may have; it is passed to the rerank call.",
    ),
    affects: declareText(
      "explanations.provider.maximumTokens.affects",
      "Answer length and which questions may be embedded.",
    ),
    safeValue: declareText(
      "explanations.provider.maximumTokens.safeValue",
      "The model's output limit for chat (4096 is common); a few thousand for embeddings.",
    ),
    extremes: [
      trap(
        "1",
        declareText(
          "explanations.provider.maximumTokens.extremes.0.then",
          "Answers get at most one token, and every search question is over budget for meaning search.",
        ),
      ),
    ],
    example: "4096.",
  },
  purpose: {
    title: declareText("explanations.provider.purpose.title", "Purpose"),
    what: declareText(
      "explanations.provider.purpose.what",
      "A free label naming what the configuration is for when several are kept.",
    ),
    affects: declareText("explanations.provider.purpose.affects", "Nothing but the label."),
    safeValue: declareText(
      "explanations.provider.purpose.safeValue",
      "Anything that tells the configurations apart.",
    ),
    extremes: [],
    example: declareText("explanations.provider.purpose.example", "retrieval, answers."),
  },
};

// ---------------------------------------------------------------------------------------------------------
// Call limits and the account's shared budget — the same four limits with different scopes.

function limitEntries(scope: "call-limits" | "shared-budget"): Record<string, Entry> {
  return {
    maximumRequests: {
      title: declareText("explanations.limits.maximumRequests.title", "Requests per window"),
      what:
        scope === "call-limits"
          ? declareText(
              "explanations.callLimits.maximumRequests.what",
              "How many calls of this one use (answers, embeddings or reranking) through this configuration may be admitted within one rolling window, 1 to 100000.",
            )
          : declareText(
              "explanations.sharedBudget.maximumRequests.what",
              "How many calls, across every configuration that shares this provider account (same provider and key), may be admitted within one rolling window, 1 to 100000.",
            ),
      affects: declareText(
        "explanations.limits.maximumRequests.affects",
        "Admission of each call, across every process and workspace. A refused call is not sent; the work waits or reports a rate limit.",
      ),
      safeValue: declareText(
        "explanations.limits.maximumRequests.safeValue",
        "Below the provider's own published rate limit.",
      ),
      extremes: [
        plain(
          "1",
          declareText(
            "explanations.limits.maximumRequests.extremes.one.then",
            "One call per window; vectorising crawls and searches queue behind each other.",
          ),
        ),
      ],
      example: declareText(
        "explanations.limits.maximumRequests.example",
        "60 per 60000 ms is one call per second on average.",
      ),
    },
    windowMilliseconds: {
      title: declareText("explanations.limits.windowMilliseconds.title", "Window"),
      what: declareText(
        "explanations.limits.windowMilliseconds.what",
        "The length of the rolling window, 10 to 3600000 ms.",
      ),
      affects: declareText(
        "explanations.limits.windowMilliseconds.affects",
        "How requests and tokens are counted: always over the last window, not per calendar minute.",
      ),
      safeValue: declareText(
        "explanations.limits.windowMilliseconds.safeValue",
        "60000 ms — how most providers state their limits.",
      ),
      extremes: [],
      example: declareText(
        "explanations.limits.windowMilliseconds.example",
        "60000 with 300 requests matches a 300-per-minute account.",
      ),
    },
    minimumSpacingMilliseconds: {
      title: declareText(
        "explanations.limits.minimumSpacingMilliseconds.title",
        "Gap between calls",
      ),
      what: declareText(
        "explanations.limits.minimumSpacingMilliseconds.what",
        "The least time between two admitted calls, from 0 up to the window.",
      ),
      affects: declareText(
        "explanations.limits.minimumSpacingMilliseconds.affects",
        "Burst behaviour: calls are spread out instead of fired together.",
      ),
      safeValue: declareText(
        "explanations.limits.minimumSpacingMilliseconds.safeValue",
        "0, unless the provider refuses bursts.",
      ),
      extremes: [
        trap(
          declareText("explanations.shared.equalToTheWindow", "Equal to the window"),
          declareText(
            "explanations.limits.minimumSpacingMilliseconds.extremes.window.then",
            "Only one call per window, whatever the request limit says.",
          ),
        ),
      ],
      example: declareText(
        "explanations.limits.minimumSpacingMilliseconds.example",
        "200 ms spreads a vectorising run to at most five calls a second.",
      ),
    },
    maximumPredictedTokens: {
      title: declareText("explanations.limits.maximumPredictedTokens.title", "Tokens per window"),
      what: declareText(
        "explanations.limits.maximumPredictedTokens.what",
        "The predicted tokens a window may carry. Chat reserves its estimated input plus the full output allowance; embeddings their predicted input; reranking one token per character sent (an upper estimate).",
      ),
      affects: declareText(
        "explanations.limits.maximumPredictedTokens.affects",
        "Admission of large calls. A call whose prediction does not fit in what is left of the window is refused.",
      ),
      safeValue: declareText(
        "explanations.limits.maximumPredictedTokens.safeValue",
        "Well above one call's prediction — the provider's tokens-per-minute limit.",
      ),
      extremes: [
        trap(
          declareText(
            "explanations.limits.maximumPredictedTokens.extremes.belowOneCall.when",
            "Below a single call's prediction",
          ),
          declareText(
            "explanations.limits.maximumPredictedTokens.extremes.belowOneCall.then",
            "That call can never be admitted, even in an empty window — an answer reserving 10000 tokens never runs under 5000.",
          ),
        ),
      ],
      example: declareText(
        "explanations.limits.maximumPredictedTokens.example",
        "1000000 tokens per minute for embeddings.",
      ),
    },
    enabled:
      scope === "call-limits"
        ? {
            title: declareText("explanations.callLimits.enabled.title", "Enforce these limits"),
            what: declareText(
              "explanations.callLimits.enabled.what",
              "Whether this use of the configuration admits calls under these limits.",
            ),
            affects: declareText(
              "explanations.callLimits.enabled.affects",
              "Every call of this use through this configuration.",
            ),
            safeValue: declareText("explanations.shared.on", "On."),
            extremes: [
              trap(
                declareText("explanations.shared.off", "Off"),
                declareText(
                  "explanations.callLimits.enabled.extremes.off.then",
                  "Every call through this configuration is refused — off means closed, not unlimited.",
                ),
              ),
            ],
            example: declareText(
              "explanations.callLimits.enabled.example",
              "Switch it off to stop all embedding calls through one configuration immediately.",
            ),
          }
        : {
            title: declareText(
              "explanations.sharedBudget.enabled.title",
              "Enforce the shared budget",
            ),
            what: declareText(
              "explanations.sharedBudget.enabled.what",
              "Whether the account's shared budget is applied on top of each use's own limits.",
            ),
            affects: declareText(
              "explanations.sharedBudget.enabled.affects",
              "Calls through every configuration on this account.",
            ),
            safeValue: declareText(
              "explanations.sharedBudget.enabled.safeValue",
              "On, once the account's real limits are known.",
            ),
            extremes: [
              plain(
                declareText("explanations.shared.off", "Off"),
                declareText(
                  "explanations.sharedBudget.enabled.extremes.off.then",
                  "The budget and its counts are kept, but every call is admitted as far as it is concerned — the opposite of the per-use switch.",
                ),
              ),
            ],
            example: declareText(
              "explanations.sharedBudget.enabled.example",
              "Off while measuring how much the account really uses.",
            ),
          },
  };
}

// ---------------------------------------------------------------------------------------------------------
// Scanning and web crawling.

const SCANNING: Record<string, Entry> = {
  enabled: {
    title: declareText("explanations.scanning.enabled.title", "Scanning allowed"),
    what: declareText(
      "explanations.scanning.enabled.what",
      "Whether this source's binding to its scanner may run scans.",
    ),
    affects: declareText(
      "explanations.scanning.enabled.affects",
      "New scans of this source only; other sources sharing the scanner are unaffected.",
    ),
    safeValue: declareText("explanations.shared.on", "On."),
    extremes: [
      plain(
        declareText("explanations.shared.off", "Off"),
        declareText(
          "explanations.scanning.enabled.extremes.0.then",
          "Scans of this source are refused, by hand and on schedule; its documents stay as they are.",
        ),
      ),
    ],
    example: declareText(
      "explanations.scanning.enabled.example",
      "Off while a repository is being reorganised.",
    ),
  },
  maximumDepth: {
    title: declareText("explanations.scanning.maximumDepth.title", "Folders deep"),
    what: declareText(
      "explanations.scanning.maximumDepth.what",
      "How many folder levels below the source a scan opens, 0 to 32. It belongs to the scanner, so every source bound to the scanner shares it. Web sources are not limited by it.",
    ),
    affects: declareText(
      "explanations.scanning.maximumDepth.affects",
      "Which files a scan sees. Folders past the depth are listed as skipped, not opened.",
    ),
    safeValue: declareText(
      "explanations.scanning.maximumDepth.safeValue",
      "Deep enough for the source's layout — 8 covers most repositories.",
    ),
    extremes: [
      trap(
        "0",
        declareText(
          "explanations.scanning.maximumDepth.extremes.0.then",
          "Only files directly in the source folder are taken; every subfolder is skipped.",
        ),
      ),
    ],
    example: declareText(
      "explanations.scanning.maximumDepth.example",
      "docs/guides/setup/install.md is three folders deep.",
    ),
  },
};

const WEB_CRAWL: Record<string, Entry> = {
  crawlMode: {
    title: declareText("explanations.webCrawl.crawlMode.title", "Pages to fetch"),
    what: declareText(
      "explanations.webCrawl.crawlMode.what",
      "LISTED_PAGES fetches exactly the start address and the further addresses; FOLLOW_LINKS also follows links to pages of the same sites, as far as the link depth.",
    ),
    affects: declareText(
      "explanations.webCrawl.crawlMode.affects",
      "Which pages a scan fetches and how long it takes. robots.txt is honoured either way.",
    ),
    safeValue: declareText(
      "explanations.webCrawl.crawlMode.safeValue",
      "LISTED_PAGES for a handful of known pages; FOLLOW_LINKS with depth 1–2 for a documentation site.",
    ),
    extremes: [],
    example: declareText(
      "explanations.webCrawl.crawlMode.example",
      "A product's docs index with FOLLOW_LINKS at depth 1 fetches the index and every page it links to.",
    ),
  },
  linkDepth: {
    title: declareText("explanations.webCrawl.linkDepth.title", "Links deep"),
    what: declareText(
      "explanations.webCrawl.linkDepth.what",
      "With FOLLOW_LINKS: how many links away from a start page a page may be, 1 to 5.",
    ),
    affects: declareText(
      "explanations.webCrawl.linkDepth.affects",
      "How much of a site is fetched — growth is roughly exponential per level.",
    ),
    safeValue: "1–2.",
    extremes: [
      plain(
        "5",
        declareText(
          "explanations.webCrawl.linkDepth.extremes.0.then",
          "Large sites are fetched until the page budget stops the scan.",
        ),
      ),
    ],
    example: declareText(
      "explanations.webCrawl.linkDepth.example",
      "Depth 2 reaches the pages linked from the pages the start page links to.",
    ),
  },
  maximumPages: {
    title: declareText("explanations.webCrawl.maximumPages.title", "Pages per scan"),
    what: declareText(
      "explanations.webCrawl.maximumPages.what",
      "The most pages one scan fetches, 1 to 500. The scan stops there and says how many it left.",
    ),
    affects: declareText(
      "explanations.webCrawl.maximumPages.affects",
      "Scan duration and how complete the snapshot is.",
    ),
    safeValue: declareText(
      "explanations.webCrawl.maximumPages.safeValue",
      "50 — raise it once you know the site's size.",
    ),
    extremes: [
      plain(
        "1",
        declareText(
          "explanations.webCrawl.maximumPages.extremes.0.then",
          "Only the start page is fetched.",
        ),
      ),
    ],
    example: declareText(
      "explanations.webCrawl.maximumPages.example",
      "A 120-page documentation site needs at least 120.",
    ),
  },
};

// ---------------------------------------------------------------------------------------------------------
// System settings: installation-wide ceilings, combined with every profile as the smaller value.

function ceiling(
  title: ExplanationText,
  what: ExplanationText,
  affects: ExplanationText,
  safeValue: ExplanationText,
  extremes: ExplanationExtreme[],
  example: ExplanationText,
): Entry {
  return { title, what, affects, safeValue, extremes, example };
}

// Each kind of call writes its own sentences, for the same reason as the shared profile entries above.

function chatProviderDefaults(): Record<string, Entry> {
  return {
    "provider.maximum-chat-requests": ceiling(
      declareText(
        "explanations.system.provider.maximumChatRequests.title",
        "Default answer requests per window",
      ),
      declareText(
        "explanations.system.provider.maximumChatRequests.what",
        "The request limit every provider configuration's answer calls use until its own call limits are saved.",
      ),
      declareText(
        "explanations.system.provider.maximumChatRequests.affects",
        "Answer admission, across API and workers, for configurations without their own limits.",
      ),
      declareText(
        "explanations.shared.belowTheProvidersPublishedRateLimit",
        "Below the provider's published rate limit.",
      ),
      [
        plain(
          "1",
          declareText(
            "explanations.system.provider.maximumChatRequests.extremes.one.then",
            "One answer call per window for every configuration on defaults.",
          ),
        ),
      ],
      declareText("explanations.shared.sixtyPerMinute", "60 per minute."),
    ),
    "provider.chat-window-milliseconds": ceiling(
      declareText(
        "explanations.system.provider.chatWindowMilliseconds.title",
        "Default answer window",
      ),
      declareText(
        "explanations.system.provider.chatWindowMilliseconds.what",
        "The rolling window of the default answer limits.",
      ),
      declareText(
        "explanations.system.provider.chatWindowMilliseconds.affects",
        "How default answer requests and tokens are counted.",
      ),
      "60000 ms.",
      [],
      "60000.",
    ),
    "provider.chat-minimum-spacing-milliseconds": ceiling(
      declareText(
        "explanations.system.provider.chatMinimumSpacingMilliseconds.title",
        "Default answer gap between calls",
      ),
      declareText(
        "explanations.system.provider.chatMinimumSpacingMilliseconds.what",
        "The least time between two answer calls under the defaults, at most the window.",
      ),
      declareText(
        "explanations.shared.burstBehaviourOfConfigurationsOnDefaults",
        "Burst behaviour of configurations on defaults.",
      ),
      "0.",
      [
        trap(
          declareText("explanations.shared.equalToTheWindow", "Equal to the window"),
          declareText(
            "explanations.shared.oneCallPerWindowWhateverTheLimit",
            "One call per window whatever the request limit says.",
          ),
        ),
      ],
      "0.",
    ),
    "provider.maximum-predicted-chat-tokens": ceiling(
      declareText(
        "explanations.system.provider.maximumPredictedChatTokens.title",
        "Default answer tokens per window",
      ),
      declareText(
        "explanations.system.provider.maximumPredictedChatTokens.what",
        "The predicted tokens a default answer window may carry.",
      ),
      declareText(
        "explanations.system.provider.maximumPredictedChatTokens.affects",
        "Admission of large answer calls on defaults.",
      ),
      declareText(
        "explanations.shared.theProvidersTokensPerMinuteLimit",
        "The provider's tokens-per-minute limit.",
      ),
      [
        trap(
          declareText("explanations.shared.belowOneCallsPrediction", "Below one call's prediction"),
          declareText(
            "explanations.shared.thatCallIsNeverAdmitted",
            "That call is never admitted.",
          ),
        ),
      ],
      "1000000.",
    ),
  };
}

function embeddingProviderDefaults(): Record<string, Entry> {
  return {
    "provider.maximum-embedding-requests": ceiling(
      declareText(
        "explanations.system.provider.maximumEmbeddingRequests.title",
        "Default embedding requests per window",
      ),
      declareText(
        "explanations.system.provider.maximumEmbeddingRequests.what",
        "The request limit every provider configuration's embedding calls use until its own call limits are saved.",
      ),
      declareText(
        "explanations.system.provider.maximumEmbeddingRequests.affects",
        "Embedding admission, across API and workers, for configurations without their own limits.",
      ),
      declareText(
        "explanations.shared.belowTheProvidersPublishedRateLimit",
        "Below the provider's published rate limit.",
      ),
      [
        plain(
          "1",
          declareText(
            "explanations.system.provider.maximumEmbeddingRequests.extremes.one.then",
            "One embedding call per window for every configuration on defaults.",
          ),
        ),
      ],
      declareText("explanations.shared.sixtyPerMinute", "60 per minute."),
    ),
    "provider.embedding-window-milliseconds": ceiling(
      declareText(
        "explanations.system.provider.embeddingWindowMilliseconds.title",
        "Default embedding window",
      ),
      declareText(
        "explanations.system.provider.embeddingWindowMilliseconds.what",
        "The rolling window of the default embedding limits.",
      ),
      declareText(
        "explanations.system.provider.embeddingWindowMilliseconds.affects",
        "How default embedding requests and tokens are counted.",
      ),
      "60000 ms.",
      [],
      "60000.",
    ),
    "provider.embedding-minimum-spacing-milliseconds": ceiling(
      declareText(
        "explanations.system.provider.embeddingMinimumSpacingMilliseconds.title",
        "Default embedding gap between calls",
      ),
      declareText(
        "explanations.system.provider.embeddingMinimumSpacingMilliseconds.what",
        "The least time between two embedding calls under the defaults, at most the window.",
      ),
      declareText(
        "explanations.shared.burstBehaviourOfConfigurationsOnDefaults",
        "Burst behaviour of configurations on defaults.",
      ),
      "0.",
      [
        trap(
          declareText("explanations.shared.equalToTheWindow", "Equal to the window"),
          declareText(
            "explanations.shared.oneCallPerWindowWhateverTheLimit",
            "One call per window whatever the request limit says.",
          ),
        ),
      ],
      "0.",
    ),
    "provider.maximum-predicted-embedding-tokens": ceiling(
      declareText(
        "explanations.system.provider.maximumPredictedEmbeddingTokens.title",
        "Default embedding tokens per window",
      ),
      declareText(
        "explanations.system.provider.maximumPredictedEmbeddingTokens.what",
        "The predicted tokens a default embedding window may carry.",
      ),
      declareText(
        "explanations.system.provider.maximumPredictedEmbeddingTokens.affects",
        "Admission of large embedding calls on defaults.",
      ),
      declareText(
        "explanations.shared.theProvidersTokensPerMinuteLimit",
        "The provider's tokens-per-minute limit.",
      ),
      [
        trap(
          declareText("explanations.shared.belowOneCallsPrediction", "Below one call's prediction"),
          declareText(
            "explanations.shared.thatCallIsNeverAdmitted",
            "That call is never admitted.",
          ),
        ),
      ],
      "1000000.",
    ),
  };
}

function rerankProviderDefaults(): Record<string, Entry> {
  return {
    "provider.maximum-rerank-requests": ceiling(
      declareText(
        "explanations.system.provider.maximumRerankRequests.title",
        "Default rerank requests per window",
      ),
      declareText(
        "explanations.system.provider.maximumRerankRequests.what",
        "The request limit every provider configuration's rerank calls use until its own call limits are saved.",
      ),
      declareText(
        "explanations.system.provider.maximumRerankRequests.affects",
        "Rerank admission, across API and workers, for configurations without their own limits.",
      ),
      declareText(
        "explanations.shared.belowTheProvidersPublishedRateLimit",
        "Below the provider's published rate limit.",
      ),
      [
        plain(
          "1",
          declareText(
            "explanations.system.provider.maximumRerankRequests.extremes.one.then",
            "One rerank call per window for every configuration on defaults.",
          ),
        ),
      ],
      declareText("explanations.shared.sixtyPerMinute", "60 per minute."),
    ),
    "provider.rerank-window-milliseconds": ceiling(
      declareText(
        "explanations.system.provider.rerankWindowMilliseconds.title",
        "Default rerank window",
      ),
      declareText(
        "explanations.system.provider.rerankWindowMilliseconds.what",
        "The rolling window of the default rerank limits.",
      ),
      declareText(
        "explanations.system.provider.rerankWindowMilliseconds.affects",
        "How default rerank requests and tokens are counted.",
      ),
      "60000 ms.",
      [],
      "60000.",
    ),
    "provider.rerank-minimum-spacing-milliseconds": ceiling(
      declareText(
        "explanations.system.provider.rerankMinimumSpacingMilliseconds.title",
        "Default rerank gap between calls",
      ),
      declareText(
        "explanations.system.provider.rerankMinimumSpacingMilliseconds.what",
        "The least time between two rerank calls under the defaults, at most the window.",
      ),
      declareText(
        "explanations.shared.burstBehaviourOfConfigurationsOnDefaults",
        "Burst behaviour of configurations on defaults.",
      ),
      "0.",
      [
        trap(
          declareText("explanations.shared.equalToTheWindow", "Equal to the window"),
          declareText(
            "explanations.shared.oneCallPerWindowWhateverTheLimit",
            "One call per window whatever the request limit says.",
          ),
        ),
      ],
      "0.",
    ),
    "provider.maximum-predicted-rerank-tokens": ceiling(
      declareText(
        "explanations.system.provider.maximumPredictedRerankTokens.title",
        "Default rerank tokens per window",
      ),
      declareText(
        "explanations.system.provider.maximumPredictedRerankTokens.what",
        "The predicted tokens a default rerank window may carry.",
      ),
      declareText(
        "explanations.system.provider.maximumPredictedRerankTokens.affects",
        "Admission of large rerank calls on defaults.",
      ),
      declareText(
        "explanations.shared.theProvidersTokensPerMinuteLimit",
        "The provider's tokens-per-minute limit.",
      ),
      [
        trap(
          declareText("explanations.shared.belowOneCallsPrediction", "Below one call's prediction"),
          declareText(
            "explanations.shared.thatCallIsNeverAdmitted",
            "That call is never admitted.",
          ),
        ),
      ],
      "1000000.",
    ),
  };
}

const SYSTEM: Record<string, Entry> = {
  "answer.maximum-calls": ceiling(
    declareText(
      "explanations.system.answer.maximumCalls.title",
      "Model calls per answer (installation)",
    ),
    declareText(
      "explanations.system.answer.maximumCalls.what",
      "Whether any answer anywhere may call a model: 0 or 1.",
    ),
    declareText(
      "explanations.system.answer.maximumCalls.affects",
      "Every answer profile — combined with each profile's own value.",
    ),
    "1.",
    [
      trap(
        "0",
        declareText(
          "explanations.system.answer.maximumCalls.extremes.0.then",
          "Every answer in every workspace returns sources only; profiles look fine but never write an answer.",
        ),
      ),
    ],
    declareText(
      "explanations.system.answer.maximumCalls.example",
      "0 during a provider incident stops all chat spending at once.",
    ),
  ),
  "answer.maximum-prompt-code-points": ceiling(
    declareText(
      "explanations.system.answer.maximumPromptCodePoints.title",
      "Maximum prompt size (installation)",
    ),
    declareText(
      "explanations.system.answer.maximumPromptCodePoints.what",
      "The largest prompt any answer may send, in characters.",
    ),
    declareText(
      "explanations.system.answer.maximumPromptCodePoints.affects",
      "Every answer; the smaller of this and the profile's value applies.",
    ),
    "20000.",
    [
      trap(
        declareText(
          "explanations.system.answer.maximumPromptCodePoints.extremes.0.when",
          "Below the context size",
        ),
        declareText(
          "explanations.system.answer.maximumPromptCodePoints.extremes.0.then",
          "Answers with a full context are refused.",
        ),
      ),
    ],
    "20000.",
  ),
  "answer.maximum-answer-code-points": ceiling(
    declareText(
      "explanations.system.answer.maximumAnswerCodePoints.title",
      "Maximum answer size (installation)",
    ),
    declareText(
      "explanations.system.answer.maximumAnswerCodePoints.what",
      "The longest accepted answer text.",
    ),
    declareText(
      "explanations.system.answer.maximumAnswerCodePoints.affects",
      "Every answer; an answer over it is rejected with its usage kept.",
    ),
    "10000.",
    [],
    "10000.",
  ),
  "answer.maximum-output-tokens": ceiling(
    declareText(
      "explanations.system.answer.maximumOutputTokens.title",
      "Maximum output tokens (installation)",
    ),
    declareText(
      "explanations.system.answer.maximumOutputTokens.what",
      "The output allowance passed to chat providers.",
    ),
    declareText(
      "explanations.system.answer.maximumOutputTokens.affects",
      "Every answer's length and reservation.",
    ),
    "2000.",
    [
      trap(
        declareText(
          "explanations.system.answer.maximumOutputTokens.extremes.0.when",
          "Close to the total tokens",
        ),
        declareText(
          "explanations.system.answer.maximumOutputTokens.extremes.0.then",
          "Prompts no longer fit; answers are refused.",
        ),
      ),
    ],
    "2000.",
  ),
  "answer.maximum-estimated-input-tokens": ceiling(
    declareText(
      "explanations.system.answer.maximumEstimatedInputTokens.title",
      "Maximum input tokens (installation)",
    ),
    declareText(
      "explanations.system.answer.maximumEstimatedInputTokens.what",
      "The estimated prompt-token ceiling.",
    ),
    declareText(
      "explanations.system.answer.maximumEstimatedInputTokens.affects",
      "Every answer's admission.",
    ),
    "8000.",
    [],
    "8000.",
  ),
  "answer.maximum-total-tokens": ceiling(
    declareText(
      "explanations.system.answer.maximumTotalTokens.title",
      "Maximum total tokens (installation)",
    ),
    declareText(
      "explanations.system.answer.maximumTotalTokens.what",
      "Estimated input plus reserved output, checked again against the reported usage.",
    ),
    declareText(
      "explanations.system.answer.maximumTotalTokens.affects",
      "Every answer's admission and acceptance.",
    ),
    "10000.",
    [
      trap(
        declareText(
          "explanations.shared.atOrBelowTheOutputTokens",
          "At or below the output tokens",
        ),
        declareText(
          "explanations.system.answer.maximumTotalTokens.extremes.0.then",
          "Every answer is refused.",
        ),
      ),
    ],
    "10000.",
  ),
  "answer.maximum-model-milliseconds": ceiling(
    declareText(
      "explanations.system.answer.maximumModelMilliseconds.title",
      "Chat response deadline (installation)",
    ),
    declareText(
      "explanations.system.answer.maximumModelMilliseconds.what",
      "The longest chat request deadline any profile may use.",
    ),
    declareText(
      "explanations.system.answer.maximumModelMilliseconds.affects",
      "Every answer's model call.",
    ),
    "15000–60000 ms.",
    [],
    "15000.",
  ),
  "answer.maximum-duration-milliseconds": ceiling(
    declareText(
      "explanations.system.answer.maximumDurationMilliseconds.title",
      "Answer deadline (installation)",
    ),
    declareText(
      "explanations.system.answer.maximumDurationMilliseconds.what",
      "The whole-answer time budget across search, context, model and hand-off.",
    ),
    declareText("explanations.shared.everyAnswer", "Every answer."),
    "60000.",
    [
      trap(
        declareText(
          "explanations.system.answer.maximumDurationMilliseconds.extremes.0.when",
          "Not above the chat response deadline",
        ),
        declareText(
          "explanations.system.answer.maximumDurationMilliseconds.extremes.0.then",
          "No time is ever left for the model call: answers are refused.",
        ),
      ),
    ],
    "60000.",
  ),
  "answer.maximum-response-bytes": ceiling(
    declareText(
      "explanations.system.answer.maximumResponseBytes.title",
      "Maximum chat response size (installation)",
    ),
    declareText(
      "explanations.system.answer.maximumResponseBytes.what",
      "The largest chat HTTP body accepted before decoding.",
    ),
    declareText("explanations.shared.everyAnswer", "Every answer."),
    "1 MB.",
    [],
    "1048576.",
  ),
  "answer.maximum-model-configurations": ceiling(
    declareText(
      "explanations.system.answer.maximumModelConfigurations.title",
      "Kept chat transports",
    ),
    declareText(
      "explanations.system.answer.maximumModelConfigurations.what",
      "How many provider/timeout HTTP configurations one API process keeps.",
    ),
    declareText(
      "explanations.system.answer.maximumModelConfigurations.affects",
      "Adding new chat configurations: when exhausted, new ones are refused until restart.",
    ),
    "32.",
    [],
    "32.",
  ),
  ...chatProviderDefaults(),
  ...embeddingProviderDefaults(),
  ...rerankProviderDefaults(),
  "search.maximum-rerank-milliseconds": ceiling(
    declareText(
      "explanations.system.search.maximumRerankMilliseconds.title",
      "Rerank deadline (installation)",
    ),
    declareText(
      "explanations.system.search.maximumRerankMilliseconds.what",
      "The longest rerank call; combined with each profile's rerank timeout.",
    ),
    declareText(
      "explanations.system.search.maximumRerankMilliseconds.affects",
      "Every rerank stage. Past it the fused order is returned.",
    ),
    "10000.",
    [
      trap(
        "10",
        declareText(
          "explanations.system.search.maximumRerankMilliseconds.extremes.0.then",
          "Reranking never completes; every search keeps the fused order.",
        ),
      ),
    ],
    "10000.",
  ),
  "search.maximum-rerank-document-code-points": ceiling(
    declareText(
      "explanations.system.search.maximumRerankDocumentCodePoints.title",
      "Longest rerank candidate",
    ),
    declareText(
      "explanations.system.search.maximumRerankDocumentCodePoints.what",
      "The longest candidate text sent to a rerank model. A longer one is not truncated: the stage falls back.",
    ),
    declareText("explanations.shared.everyRerankStage", "Every rerank stage."),
    declareText(
      "explanations.system.search.maximumRerankDocumentCodePoints.safeValue",
      "Above the processing profiles' chunk size plus neighbours — 16000.",
    ),
    [
      trap(
        declareText("explanations.shared.belowTheChunkSize", "Below the chunk size"),
        declareText(
          "explanations.system.search.maximumRerankDocumentCodePoints.extremes.0.then",
          "Every search with reranking falls back to the fused order.",
        ),
      ),
    ],
    "16000.",
  ),
  "search.maximum-rerank-total-code-points": ceiling(
    declareText(
      "explanations.system.search.maximumRerankTotalCodePoints.title",
      "Rerank request size",
    ),
    declareText(
      "explanations.system.search.maximumRerankTotalCodePoints.what",
      "Question plus all candidate texts of one rerank request, in characters.",
    ),
    declareText(
      "explanations.system.search.maximumRerankTotalCodePoints.affects",
      "Every rerank stage; a larger request falls back.",
    ),
    "800000.",
    [
      trap(
        declareText(
          "explanations.system.search.maximumRerankTotalCodePoints.extremes.0.when",
          "Below candidates × chunk size",
        ),
        declareText(
          "explanations.system.search.maximumRerankTotalCodePoints.extremes.0.then",
          "Reranking always falls back.",
        ),
      ),
    ],
    declareText(
      "explanations.system.search.maximumRerankTotalCodePoints.example",
      "30 candidates × 1200 = 36000.",
    ),
  ),
  "search.maximum-rerank-response-bytes": ceiling(
    declareText(
      "explanations.system.search.maximumRerankResponseBytes.title",
      "Rerank response size",
    ),
    declareText(
      "explanations.system.search.maximumRerankResponseBytes.what",
      "The largest rerank response accepted before parsing.",
    ),
    declareText("explanations.shared.everyRerankStage", "Every rerank stage."),
    "1 MB.",
    [],
    "1048576.",
  ),
  "search.maximum-query-embedding-tokens": ceiling(
    declareText(
      "explanations.system.search.maximumQueryEmbeddingTokens.title",
      "Question tokens (installation)",
    ),
    declareText(
      "explanations.system.search.maximumQueryEmbeddingTokens.what",
      "The most tokens a search question may have for meaning search.",
    ),
    declareText(
      "explanations.shared.everyMeaningSearchCombinedWithThe",
      "Every meaning search; combined with the profile's value.",
    ),
    "2000.",
    [
      trap(
        declareText(
          "explanations.system.search.maximumQueryEmbeddingTokens.extremes.0.when",
          "Very small",
        ),
        declareText(
          "explanations.system.search.maximumQueryEmbeddingTokens.extremes.0.then",
          "Questions are refused for meaning search everywhere.",
        ),
      ),
    ],
    "2000.",
  ),
  "search.maximum-vector-scan-records": ceiling(
    declareText(
      "explanations.system.search.maximumVectorScanRecords.title",
      "Vector scan ceiling (installation)",
    ),
    declareText(
      "explanations.system.search.maximumVectorScanRecords.what",
      "The most eligible vectors an exact meaning search may compare before it is refused.",
    ),
    declareText(
      "explanations.shared.everyMeaningSearchCombinedWithThe",
      "Every meaning search; combined with the profile's value.",
    ),
    declareText(
      "explanations.system.search.maximumVectorScanRecords.safeValue",
      "Above the largest workspace's vector count.",
    ),
    [
      trap(
        declareText(
          "explanations.system.search.maximumVectorScanRecords.extremes.0.when",
          "Below a workspace's vectors",
        ),
        declareText(
          "explanations.system.search.maximumVectorScanRecords.extremes.0.then",
          "Meaning search in that workspace is refused on every request.",
        ),
      ),
    ],
    "10000.",
  ),
  "search.maximum-query-embedding-milliseconds": ceiling(
    declareText(
      "explanations.system.search.maximumQueryEmbeddingMilliseconds.title",
      "Question embedding deadline (installation)",
    ),
    declareText(
      "explanations.system.search.maximumQueryEmbeddingMilliseconds.what",
      "The longest question-embedding call.",
    ),
    declareText(
      "explanations.system.search.maximumQueryEmbeddingMilliseconds.affects",
      "Every meaning search.",
    ),
    "15000.",
    [
      trap(
        "10",
        declareText(
          "explanations.system.search.maximumQueryEmbeddingMilliseconds.extremes.0.then",
          "Every question embedding times out.",
        ),
      ),
    ],
    "15000.",
  ),
  "search.maximum-concurrent-embedding-calls": ceiling(
    declareText(
      "explanations.system.search.maximumConcurrentEmbeddingCalls.title",
      "Concurrent question embeddings (installation)",
    ),
    declareText(
      "explanations.system.search.maximumConcurrentEmbeddingCalls.what",
      "Live question-embedding calls per workspace.",
    ),
    declareText(
      "explanations.system.search.maximumConcurrentEmbeddingCalls.affects",
      "Meaning search under load; a search over it is refused for meaning search.",
    ),
    "2–4.",
    [],
    "2.",
  ),
  "search.maximum-query-characters": ceiling(
    declareText(
      "explanations.system.search.maximumQueryCharacters.title",
      "Question length (installation)",
    ),
    declareText(
      "explanations.system.search.maximumQueryCharacters.what",
      "The longest search question, in characters.",
    ),
    declareText("explanations.shared.everySearch", "Every search."),
    "1024.",
    [],
    "1024.",
  ),
  "search.maximum-results": ceiling(
    declareText(
      "explanations.system.search.maximumResults.title",
      "Results per search (installation)",
    ),
    declareText(
      "explanations.system.search.maximumResults.what",
      "The most results one search may return; also caps keyword candidates for fusion.",
    ),
    declareText("explanations.shared.everySearch", "Every search."),
    "50.",
    [
      plain(
        "1",
        declareText(
          "explanations.system.search.maximumResults.extremes.0.then",
          "Every search returns one result; hybrid fusion sees one keyword candidate.",
        ),
      ),
    ],
    "50.",
  ),
  "search.maximum-excerpt-code-points": ceiling(
    declareText(
      "explanations.system.search.maximumExcerptCodePoints.title",
      "Excerpt length (installation)",
    ),
    declareText(
      "explanations.system.search.maximumExcerptCodePoints.what",
      "The longest excerpt per result.",
    ),
    declareText("explanations.shared.everySearch", "Every search."),
    "500.",
    [],
    "500.",
  ),
  "search.maximum-response-code-points": ceiling(
    declareText(
      "explanations.system.search.maximumResponseCodePoints.title",
      "Response excerpt budget (installation)",
    ),
    declareText(
      "explanations.system.search.maximumResponseCodePoints.what",
      "Total excerpt characters per search.",
    ),
    declareText("explanations.shared.everySearch", "Every search."),
    "10000.",
    [],
    "10000.",
  ),
  "search.maximum-statement-milliseconds": ceiling(
    declareText(
      "explanations.system.search.maximumStatementMilliseconds.title",
      "Search statement deadline (installation)",
    ),
    declareText(
      "explanations.system.search.maximumStatementMilliseconds.what",
      "The longest retrieval statement.",
    ),
    declareText("explanations.shared.everySearch", "Every search."),
    "2000.",
    [],
    "2000.",
  ),
  "evaluation.maximum-searches": ceiling(
    declareText("explanations.system.evaluation.maximumSearches.title", "Searches per evaluation"),
    declareText(
      "explanations.system.evaluation.maximumSearches.what",
      "The most retrieval attempts one evaluation run makes.",
    ),
    declareText("explanations.shared.evaluationRunsOnly", "Evaluation runs only."),
    "20.",
    [],
    "20.",
  ),
  "evaluation.maximum-embedding-calls": ceiling(
    declareText(
      "explanations.system.evaluation.maximumEmbeddingCalls.title",
      "Question embeddings per evaluation",
    ),
    declareText(
      "explanations.system.evaluation.maximumEmbeddingCalls.what",
      "The most question-embedding calls one evaluation may make.",
    ),
    declareText("explanations.shared.evaluationRunsOnly", "Evaluation runs only."),
    "8.",
    [
      plain(
        "0",
        declareText(
          "explanations.system.evaluation.maximumEmbeddingCalls.extremes.0.then",
          "Only cached question vectors are used; uncached questions cannot be searched by meaning.",
        ),
      ),
    ],
    "8.",
  ),
  "evaluation.maximum-embedding-tokens": ceiling(
    declareText(
      "explanations.system.evaluation.maximumEmbeddingTokens.title",
      "Question tokens per evaluation",
    ),
    declareText(
      "explanations.system.evaluation.maximumEmbeddingTokens.what",
      "Predicted question tokens one evaluation may admit.",
    ),
    declareText("explanations.shared.evaluationRunsOnly", "Evaluation runs only."),
    "2000.",
    [
      plain(
        "0",
        declareText(
          "explanations.system.evaluation.maximumEmbeddingTokens.extremes.0.then",
          "Cache only.",
        ),
      ),
    ],
    "2000.",
  ),
  "evaluation.maximum-duration-milliseconds": ceiling(
    declareText(
      "explanations.system.evaluation.maximumDurationMilliseconds.title",
      "Evaluation deadline",
    ),
    declareText(
      "explanations.system.evaluation.maximumDurationMilliseconds.what",
      "The time one evaluation may take.",
    ),
    declareText("explanations.shared.evaluationRunsOnly", "Evaluation runs only."),
    "60000.",
    [],
    "60000.",
  ),
  "embedding.maximum-chunks": ceiling(
    declareText(
      "explanations.system.embedding.maximumChunks.title",
      "Chunks per vectorising run (installation)",
    ),
    declareText(
      "explanations.system.embedding.maximumChunks.what",
      "The most chunks one preflight may select; more is refused.",
    ),
    declareText("explanations.shared.everyVectorisingRun", "Every vectorising run."),
    "1000.",
    [
      trap(
        declareText(
          "explanations.system.embedding.maximumChunks.extremes.0.when",
          "Below a source's chunks",
        ),
        declareText(
          "explanations.system.embedding.maximumChunks.extremes.0.then",
          "That source cannot be vectorised in one run.",
        ),
      ),
    ],
    "1000.",
  ),
  "embedding.maximum-total-code-points": ceiling(
    declareText(
      "explanations.system.embedding.maximumTotalCodePoints.title",
      "Characters per vectorising run (installation)",
    ),
    declareText(
      "explanations.system.embedding.maximumTotalCodePoints.what",
      "Total planned input characters, prefixes and overlap included.",
    ),
    declareText("explanations.shared.everyVectorisingRun", "Every vectorising run."),
    "10000000.",
    [],
    "10000000.",
  ),
  "embedding.maximum-tokens": ceiling(
    declareText(
      "explanations.system.embedding.maximumTokens.title",
      "Tokens per vectorising run (installation)",
    ),
    declareText(
      "explanations.system.embedding.maximumTokens.what",
      "The most predicted input tokens of one run; an unknown count never satisfies it.",
    ),
    declareText("explanations.shared.everyVectorisingRun", "Every vectorising run."),
    "10000000.",
    [],
    "10000000.",
  ),
  "embedding.maximum-statement-milliseconds": ceiling(
    declareText(
      "explanations.system.embedding.maximumStatementMilliseconds.title",
      "Preflight statement deadline (installation)",
    ),
    declareText(
      "explanations.system.embedding.maximumStatementMilliseconds.what",
      "The longest selection statement of a preflight.",
    ),
    declareText(
      "explanations.system.embedding.maximumStatementMilliseconds.affects",
      "Every preflight.",
    ),
    "2000.",
    [],
    "2000.",
  ),
  "embedding.connect-timeout-milliseconds": ceiling(
    declareText(
      "explanations.system.embedding.connectTimeoutMilliseconds.title",
      "Embedding connection timeout",
    ),
    declareText(
      "explanations.system.embedding.connectTimeoutMilliseconds.what",
      "How long connecting to an embedding provider may take. Set at deployment; a restart applies it.",
    ),
    declareText(
      "explanations.system.embedding.connectTimeoutMilliseconds.affects",
      "Every embedding call.",
    ),
    "10000.",
    [],
    "10000.",
  ),
  "context.maximum-candidates": ceiling(
    declareText(
      "explanations.system.context.maximumCandidates.title",
      "Context candidates (installation)",
    ),
    declareText(
      "explanations.system.context.maximumCandidates.what",
      "The most records a context may select, neighbours included.",
    ),
    declareText("explanations.shared.everyContextAssembly", "Every context assembly."),
    "200.",
    [],
    "200.",
  ),
  "context.maximum-fragments": ceiling(
    declareText(
      "explanations.system.context.maximumFragments.title",
      "Context fragments (installation)",
    ),
    declareText(
      "explanations.system.context.maximumFragments.what",
      "The most fragments a context may return.",
    ),
    declareText("explanations.shared.everyContextAssembly", "Every context assembly."),
    "20.",
    [],
    "20.",
  ),
  "context.maximum-fragment-code-points": ceiling(
    declareText(
      "explanations.system.context.maximumFragmentCodePoints.title",
      "Fragment size (installation)",
    ),
    declareText(
      "explanations.system.context.maximumFragmentCodePoints.what",
      "The longest fragment, in characters — never tokens.",
    ),
    declareText("explanations.shared.everyContextAssembly", "Every context assembly."),
    "4000.",
    [],
    "4000.",
  ),
  "context.maximum-code-points": ceiling(
    declareText(
      "explanations.system.context.maximumCodePoints.title",
      "Context size (installation)",
    ),
    declareText(
      "explanations.system.context.maximumCodePoints.what",
      "The total fragment characters of one context.",
    ),
    declareText(
      "explanations.system.context.maximumCodePoints.affects",
      "Every context assembly and so every answer's prompt.",
    ),
    "20000.",
    [],
    "20000.",
  ),
  "context.maximum-statement-milliseconds": ceiling(
    declareText(
      "explanations.system.context.maximumStatementMilliseconds.title",
      "Context statement deadline (installation)",
    ),
    declareText(
      "explanations.system.context.maximumStatementMilliseconds.what",
      "The longest context load or revalidation statement.",
    ),
    declareText("explanations.shared.everyContextAssembly", "Every context assembly."),
    "2000.",
    [],
    "2000.",
  ),
  "documents.read-maximum-code-points": ceiling(
    declareText(
      "explanations.system.documents.readMaximumCodePoints.title",
      "Read size (installation)",
    ),
    declareText(
      "explanations.system.documents.readMaximumCodePoints.what",
      "The most characters one original read may return.",
    ),
    declareText("explanations.shared.everyOriginalRead", "Every original read."),
    "10000.",
    [],
    "10000.",
  ),
  "documents.read-maximum-original-bytes": ceiling(
    declareText(
      "explanations.system.documents.readMaximumOriginalBytes.title",
      "Original size for reads (installation)",
    ),
    declareText(
      "explanations.system.documents.readMaximumOriginalBytes.what",
      "The largest original that may be verified and decoded for a read.",
    ),
    declareText("explanations.shared.everyOriginalRead", "Every original read."),
    "4 MB.",
    [
      trap(
        declareText(
          "explanations.system.documents.readMaximumOriginalBytes.extremes.0.when",
          "Below real files",
        ),
        declareText(
          "explanations.system.documents.readMaximumOriginalBytes.extremes.0.then",
          "Those originals cannot be read back.",
        ),
      ),
    ],
    "4194304.",
  ),
  "documents.read-maximum-original-characters": ceiling(
    declareText(
      "explanations.system.documents.readMaximumOriginalCharacters.title",
      "Decoded characters for reads (installation)",
    ),
    declareText(
      "explanations.system.documents.readMaximumOriginalCharacters.what",
      "The longest decoded original that may be read.",
    ),
    declareText("explanations.shared.everyOriginalRead", "Every original read."),
    "1048576.",
    [],
    "1048576.",
  ),
  "documents.maximum-text-characters": ceiling(
    declareText("explanations.system.documents.maximumTextCharacters.title", "Manual text size"),
    declareText(
      "explanations.system.documents.maximumTextCharacters.what",
      "The longest text document added by hand; its bytes also obey the blob limit.",
    ),
    declareText(
      "explanations.system.documents.maximumTextCharacters.affects",
      "Adding text by hand.",
    ),
    "1048576.",
    [],
    "1048576.",
  ),
  "mcp.enabled": ceiling(
    declareText("explanations.system.mcp.enabled.title", "Assistant access (MCP)"),
    declareText(
      "explanations.system.mcp.enabled.what",
      "Whether assistants connected over the Model Context Protocol are admitted at all.",
    ),
    declareText("explanations.system.mcp.enabled.affects", "Every assistant request."),
    declareText("explanations.shared.on", "On."),
    [
      trap(
        declareText("explanations.shared.off", "Off"),
        declareText(
          "explanations.system.mcp.enabled.extremes.0.then",
          "Every assistant request is refused, whatever the switches below say.",
        ),
      ),
    ],
    declareText(
      "explanations.system.mcp.enabled.example",
      "Off during an incident cuts every assistant off at once.",
    ),
  ),
  "mcp.search-enabled": ceiling(
    declareText("explanations.system.mcp.searchEnabled.title", "Assistant search"),
    declareText("explanations.system.mcp.searchEnabled.what", "Whether assistants may search."),
    declareText(
      "explanations.system.mcp.searchEnabled.affects",
      "The assistant search action; searches here are unaffected.",
    ),
    declareText("explanations.shared.on", "On."),
    [
      plain(
        declareText("explanations.shared.off", "Off"),
        declareText(
          "explanations.system.mcp.searchEnabled.extremes.0.then",
          "Assistants cannot search.",
        ),
      ),
    ],
    declareText("explanations.shared.on", "On."),
  ),
  "mcp.answers-enabled": ceiling(
    declareText("explanations.system.mcp.answersEnabled.title", "Assistant answers"),
    declareText(
      "explanations.system.mcp.answersEnabled.what",
      "Whether assistants may ask for grounded answers and discover answer profiles.",
    ),
    declareText("explanations.system.mcp.answersEnabled.affects", "The assistant answer action."),
    declareText("explanations.shared.on", "On."),
    [
      plain(
        declareText("explanations.shared.off", "Off"),
        declareText(
          "explanations.system.mcp.answersEnabled.extremes.0.then",
          "Assistants cannot ask for answers.",
        ),
      ),
    ],
    declareText("explanations.shared.on", "On."),
  ),
  "mcp.context-enabled": ceiling(
    declareText("explanations.system.mcp.contextEnabled.title", "Assistant context"),
    declareText(
      "explanations.system.mcp.contextEnabled.what",
      "Whether assistants may assemble context and discover context profiles.",
    ),
    declareText("explanations.system.mcp.contextEnabled.affects", "The assistant context action."),
    declareText("explanations.shared.on", "On."),
    [],
    declareText("explanations.shared.on", "On."),
  ),
  "mcp.original-read-enabled": ceiling(
    declareText("explanations.system.mcp.originalReadEnabled.title", "Assistant original reads"),
    declareText(
      "explanations.system.mcp.originalReadEnabled.what",
      "Whether assistants may read originals and discover read profiles.",
    ),
    declareText(
      "explanations.system.mcp.originalReadEnabled.affects",
      "The assistant read action.",
    ),
    declareText("explanations.shared.on", "On."),
    [],
    declareText("explanations.shared.on", "On."),
  ),
  "mcp.discovery-enabled": ceiling(
    declareText("explanations.system.mcp.discoveryEnabled.title", "Assistant discovery"),
    declareText(
      "explanations.system.mcp.discoveryEnabled.what",
      "Whether assistants may list workspaces, sources and available profiles.",
    ),
    declareText("explanations.system.mcp.discoveryEnabled.affects", "Assistant discovery actions."),
    declareText("explanations.shared.on", "On."),
    [
      plain(
        declareText("explanations.shared.off", "Off"),
        declareText(
          "explanations.system.mcp.discoveryEnabled.extremes.0.then",
          "Assistants must already know every identifier.",
        ),
      ),
    ],
    declareText("explanations.shared.on", "On."),
  ),
  "mcp.default-page-size": ceiling(
    declareText("explanations.system.mcp.defaultPageSize.title", "Assistant page size"),
    declareText(
      "explanations.system.mcp.defaultPageSize.what",
      "The default page size of assistant listings.",
    ),
    declareText(
      "explanations.system.mcp.defaultPageSize.affects",
      "Assistant listings that give no limit.",
    ),
    "25.",
    [],
    "25.",
  ),
  "processing.automatic-submission-enabled": ceiling(
    declareText(
      "explanations.system.processing.automaticSubmissionEnabled.title",
      "Automatic preparation",
    ),
    declareText(
      "explanations.system.processing.automaticSubmissionEnabled.what",
      "Whether automatic preparation requests are dispatched to processing. Jobs already running continue.",
    ),
    declareText(
      "explanations.system.processing.automaticSubmissionEnabled.affects",
      "Sources that prepare documents automatically after a scan.",
    ),
    declareText("explanations.shared.on", "On."),
    [
      trap(
        declareText("explanations.shared.off", "Off"),
        declareText(
          "explanations.system.processing.automaticSubmissionEnabled.extremes.0.then",
          "Scans still find changes, but nothing is processed until it is switched back on — requests wait as pending.",
        ),
      ),
    ],
    declareText(
      "explanations.system.processing.automaticSubmissionEnabled.example",
      "Off while changing a processing profile used by many sources.",
    ),
  ),
  "processing.automatic-submissions-per-poll": ceiling(
    declareText(
      "explanations.system.processing.automaticSubmissionsPerPoll.title",
      "Automatic submissions per poll",
    ),
    declareText(
      "explanations.system.processing.automaticSubmissionsPerPoll.what",
      "How many automatic preparation requests one worker poll submits.",
    ),
    declareText(
      "explanations.system.processing.automaticSubmissionsPerPoll.affects",
      "How fast a large scan's documents enter processing.",
    ),
    "10.",
    [],
    "10.",
  ),
  "processing.maximum-chunks": ceiling(
    declareText(
      "explanations.system.processing.maximumChunks.title",
      "Chunks per document (installation)",
    ),
    declareText(
      "explanations.system.processing.maximumChunks.what",
      "The most chunks one document's preparation may produce, frozen at submission.",
    ),
    declareText("explanations.shared.everyProcessingJob", "Every processing job."),
    "1000.",
    [
      trap(
        declareText(
          "explanations.system.processing.maximumChunks.extremes.0.when",
          "Below a long document's chunks",
        ),
        declareText(
          "explanations.system.processing.maximumChunks.extremes.0.then",
          "That document fails processing.",
        ),
      ),
    ],
    "1000.",
  ),
  "processing.maximum-characters": ceiling(
    declareText(
      "explanations.system.processing.maximumCharacters.title",
      "Characters per document (installation)",
    ),
    declareText(
      "explanations.system.processing.maximumCharacters.what",
      "The longest decoded document that may be processed.",
    ),
    declareText("explanations.shared.everyProcessingJob", "Every processing job."),
    "1048576.",
    [],
    "1048576.",
  ),
  "processing.maximum-blocks": ceiling(
    declareText(
      "explanations.system.processing.maximumBlocks.title",
      "Blocks per document (installation)",
    ),
    declareText(
      "explanations.system.processing.maximumBlocks.what",
      "The most structural blocks per document.",
    ),
    declareText("explanations.shared.everyProcessingJob", "Every processing job."),
    "10000.",
    [],
    "10000.",
  ),
  "index.maximum-manual-characters": ceiling(
    declareText("explanations.system.index.maximumManualCharacters.title", "Manual entry size"),
    declareText(
      "explanations.system.index.maximumManualCharacters.what",
      "The longest manual index entry.",
    ),
    declareText(
      "explanations.system.index.maximumManualCharacters.affects",
      "Writing manual entries.",
    ),
    "65536.",
    [],
    "65536.",
  ),
  "scanner.maximum-total-bytes": ceiling(
    declareText("explanations.system.scanner.maximumTotalBytes.title", "Bytes per scan"),
    declareText(
      "explanations.system.scanner.maximumTotalBytes.what",
      "The most original bytes one scan takes in; files past it are recorded as skipped.",
    ),
    declareText("explanations.shared.everyScan", "Every scan."),
    "1 GB.",
    [
      trap(
        declareText("explanations.shared.small", "Small"),
        declareText(
          "explanations.system.scanner.maximumTotalBytes.extremes.0.then",
          "Scans take only the first files and skip the rest.",
        ),
      ),
    ],
    "1073741824.",
  ),
  "scanner.maximum-entries": ceiling(
    declareText("explanations.system.scanner.maximumEntries.title", "Entries visited per scan"),
    declareText(
      "explanations.system.scanner.maximumEntries.what",
      "The most filesystem entries one scan visits while building its manifest.",
    ),
    declareText(
      "explanations.system.scanner.maximumEntries.affects",
      "Every scan of a large tree.",
    ),
    "10000.",
    [
      trap(
        declareText(
          "explanations.system.scanner.maximumEntries.extremes.0.when",
          "Below a repository's entries",
        ),
        declareText(
          "explanations.system.scanner.maximumEntries.extremes.0.then",
          "The scan stops discovering partway.",
        ),
      ),
    ],
    "10000.",
  ),
  "scanner.maximum-files": ceiling(
    declareText("explanations.system.scanner.maximumFiles.title", "Files per scan"),
    declareText(
      "explanations.system.scanner.maximumFiles.what",
      "The most regular files one scan's manifest keeps; more are counted, not kept.",
    ),
    declareText("explanations.shared.everyScan", "Every scan."),
    "1000.",
    [
      trap(
        declareText(
          "explanations.system.scanner.maximumFiles.extremes.0.when",
          "Below a source's file count",
        ),
        declareText(
          "explanations.system.scanner.maximumFiles.extremes.0.then",
          "Files past it are never taken.",
        ),
      ),
    ],
    "1000.",
  ),
  "automation.script-steps": ceiling(
    declareText("explanations.system.automation.scriptSteps.title", "Script steps"),
    declareText(
      "explanations.system.automation.scriptSteps.what",
      "The most evaluation steps one script binding may take.",
    ),
    declareText("explanations.shared.everyJmsScript", "Every jMS script."),
    "2000.",
    [],
    "2000.",
  ),
  "automation.script-deadline-milliseconds": ceiling(
    declareText(
      "explanations.system.automation.scriptDeadlineMilliseconds.title",
      "Script deadline",
    ),
    declareText(
      "explanations.system.automation.scriptDeadlineMilliseconds.what",
      "The time one script binding may take.",
    ),
    declareText("explanations.shared.everyJmsScript", "Every jMS script."),
    "50.",
    [],
    "50.",
  ),
  "automation.pipeline-deadline-milliseconds": ceiling(
    declareText(
      "explanations.system.automation.pipelineDeadlineMilliseconds.title",
      "Stage script deadline",
    ),
    declareText(
      "explanations.system.automation.pipelineDeadlineMilliseconds.what",
      "The time all script bindings at one stage may take together.",
    ),
    declareText(
      "explanations.system.automation.pipelineDeadlineMilliseconds.affects",
      "Every stage with scripts.",
    ),
    "1000.",
    [],
    "1000.",
  ),
  "automation.log-capacity": ceiling(
    declareText("explanations.system.automation.logCapacity.title", "Script log lines"),
    declareText(
      "explanations.system.automation.logCapacity.what",
      "Diagnostic lines kept per process.",
    ),
    declareText("explanations.system.automation.logCapacity.affects", "Script debugging."),
    "200.",
    [],
    "200.",
  ),
  "identity.password-iterations": ceiling(
    declareText(
      "explanations.system.identity.passwordIterations.title",
      "Password hashing iterations",
    ),
    declareText(
      "explanations.system.identity.passwordIterations.what",
      "PBKDF2 iterations for newly set passwords. Set at deployment; existing hashes keep their cost.",
    ),
    declareText(
      "explanations.system.identity.passwordIterations.affects",
      "Sign-in cost and password strength.",
    ),
    "600000.",
    [],
    "600000.",
  ),
  "identity.password-salt-bytes": ceiling(
    declareText("explanations.system.identity.passwordSaltBytes.title", "Password salt length"),
    declareText(
      "explanations.system.identity.passwordSaltBytes.what",
      "Salt length for newly set passwords; deployment-managed.",
    ),
    declareText("explanations.shared.newPasswords", "New passwords."),
    "16.",
    [],
    "16.",
  ),
  "identity.password-key-bytes": ceiling(
    declareText("explanations.system.identity.passwordKeyBytes.title", "Password key length"),
    declareText(
      "explanations.system.identity.passwordKeyBytes.what",
      "Derived key length for newly set passwords; deployment-managed.",
    ),
    declareText("explanations.shared.newPasswords", "New passwords."),
    "32.",
    [],
    "32.",
  ),
  "identity.credential-lifetime-seconds": ceiling(
    declareText(
      "explanations.system.identity.credentialLifetimeSeconds.title",
      "Credential lifetime",
    ),
    declareText(
      "explanations.system.identity.credentialLifetimeSeconds.what",
      "How long newly issued API credentials stay valid; existing ones keep their expiry.",
    ),
    declareText(
      "explanations.system.identity.credentialLifetimeSeconds.affects",
      "New credentials.",
    ),
    "86400.",
    [
      plain(
        "60",
        declareText(
          "explanations.system.identity.credentialLifetimeSeconds.extremes.0.then",
          "Credentials expire after a minute — unusable for integrations.",
        ),
      ),
    ],
    declareText(
      "explanations.system.identity.credentialLifetimeSeconds.example",
      "86400 is one day.",
    ),
  ),
  "storage.maximum-blob-bytes": ceiling(
    declareText("explanations.system.storage.maximumBlobBytes.title", "Largest stored file"),
    declareText(
      "explanations.system.storage.maximumBlobBytes.what",
      "The largest content accepted, enforced while streaming whatever size was declared.",
    ),
    declareText(
      "explanations.system.storage.maximumBlobBytes.affects",
      "Uploads, pushes and scans.",
    ),
    "50 MB.",
    [
      trap(
        declareText("explanations.shared.small", "Small"),
        declareText(
          "explanations.system.storage.maximumBlobBytes.extremes.0.then",
          "Ordinary files are refused.",
        ),
      ),
    ],
    "52428800.",
  ),
  "jobs.maximum-attempts": ceiling(
    declareText("explanations.system.jobs.maximumAttempts.title", "Job attempts"),
    declareText(
      "explanations.system.jobs.maximumAttempts.what",
      "Attempts per retry cycle of a job.",
    ),
    declareText("explanations.shared.everyBackgroundJob", "Every background job."),
    "3.",
    [
      plain(
        "1",
        declareText(
          "explanations.system.jobs.maximumAttempts.extremes.0.then",
          "A transient failure fails the job.",
        ),
      ),
    ],
    "3.",
  ),
  "jobs.lease-seconds": ceiling(
    declareText("explanations.system.jobs.leaseSeconds.title", "Job lease"),
    declareText(
      "explanations.system.jobs.leaseSeconds.what",
      "How long a worker holds a job before it is considered abandoned and recovered.",
    ),
    declareText("explanations.shared.everyBackgroundJob", "Every background job."),
    "60.",
    [
      trap(
        declareText(
          "explanations.system.jobs.leaseSeconds.extremes.0.when",
          "Shorter than real work between heartbeats",
        ),
        declareText(
          "explanations.system.jobs.leaseSeconds.extremes.0.then",
          "Working jobs are taken away and retried.",
        ),
      ),
    ],
    "60.",
  ),
  "jobs.retry-delay-seconds": ceiling(
    declareText("explanations.system.jobs.retryDelaySeconds.title", "Retry delay"),
    declareText(
      "explanations.system.jobs.retryDelaySeconds.what",
      "The wait before retrying a failed or abandoned attempt.",
    ),
    declareText("explanations.shared.everyBackgroundJob", "Every background job."),
    "5.",
    [],
    "5.",
  ),
  "ui.page-size": ceiling(
    declareText("explanations.system.ui.pageSize.title", "Rows per page"),
    declareText("explanations.system.ui.pageSize.what", "How many rows a list shows on one page."),
    declareText("explanations.system.ui.pageSize.affects", "Every list in the interface."),
    "25.",
    [],
    "25.",
  ),
  "worker.heartbeat-milliseconds": ceiling(
    declareText("explanations.system.worker.heartbeatMilliseconds.title", "Worker heartbeat"),
    declareText(
      "explanations.system.worker.heartbeatMilliseconds.what",
      "How often the worker reports it is alive; set at deployment.",
    ),
    declareText(
      "explanations.system.worker.heartbeatMilliseconds.affects",
      "Detection of a stopped worker.",
    ),
    "15000.",
    [],
    "15000.",
  ),
};

// ---------------------------------------------------------------------------------------------------------
// Evaluation suites: what is scored and what a run may spend. Written from `evaluation/EvaluationSuites`,
// `JudgedEvaluationReports` and `ManagedEvaluationRuns`.

const EVALUATION: Record<string, Entry> = {
  readProfileId: {
    title: declareText("explanations.evaluation.readProfileId.title", "Read profile"),
    what: declareText(
      "explanations.evaluation.readProfileId.what",
      "The read profile a run uses to open each cited passage in its original and check that the passage is really there.",
    ),
    affects: declareText(
      "explanations.evaluation.readProfileId.affects",
      "Whether a hit counts as verified. It does not change which documents are found.",
    ),
    safeValue: declareText("explanations.evaluation.readProfileId.safeValue", "The workspace's default read profile."),
    extremes: [],
    example: declareText(
      "explanations.evaluation.readProfileId.example",
      "A hit whose lines no longer match the original is reported as an invalid citation.",
    ),
  },
  sourceId: {
    title: declareText("explanations.evaluation.sourceId.title", "Only search"),
    what: declareText("explanations.evaluation.sourceId.what", "Narrows every search of the run to one source, or searches them all."),
    affects: declareText(
      "explanations.evaluation.sourceId.affects",
      "Which documents can be found. An expected document in another source can then never be found.",
    ),
    safeValue: declareText("explanations.evaluation.sourceId.safeValue", "Every source, as people search."),
    extremes: [
      trap(
        declareText("explanations.evaluation.sourceId.extremes.0.when", "A source the expected documents are not in"),
        declareText("explanations.evaluation.sourceId.extremes.0.then", "Every question misses, whatever the profile."),
      ),
    ],
    example: declareText(
      "explanations.evaluation.sourceId.example",
      "Only the datasheets source, to measure search over datasheets alone.",
    ),
  },
  cutoff: {
    title: declareText("explanations.evaluation.cutoff.title", "Top"),
    what: declareText(
      "explanations.evaluation.cutoff.what",
      "How many hits of each search are scored, 1 to 100. An expected document found below this rank counts as not found.",
    ),
    affects: declareText("explanations.evaluation.cutoff.affects", "Hit rate, recall and reciprocal rank of every question."),
    safeValue: declareText(
      "explanations.evaluation.cutoff.safeValue",
      "As many hits as a person really looks at — 10.",
    ),
    extremes: [
      plain("1", declareText("explanations.evaluation.cutoff.extremes.0.then", "Only the first hit counts; the strictest measure.")),
      plain("100", declareText("explanations.evaluation.cutoff.extremes.1.then", "Almost anything found counts; the numbers look better than search feels.")),
    ],
    example: declareText(
      "explanations.evaluation.cutoff.example",
      "With 10, a datasheet found at rank 12 is a miss.",
    ),
  },
  "thresholds.hitRate": {
    title: declareText("explanations.evaluation.hitRate.title", "Hit rate"),
    what: declareText(
      "explanations.evaluation.hitRate.what",
      "The share of questions for which at least one expected document is among the top hits. A profile passes only at or above this share.",
    ),
    affects: declareText("explanations.evaluation.hitRate.affects", "The verdict of each compared profile."),
    safeValue: declareText("explanations.evaluation.hitRate.safeValue", "80 %."),
    extremes: [
      trap("0 %", declareText("explanations.evaluation.hitRate.extremes.0.then", "Always passes; the check says nothing.")),
      plain("100 %", declareText("explanations.evaluation.hitRate.extremes.1.then", "One miss fails the profile.")),
    ],
    example: declareText(
      "explanations.evaluation.hitRate.example",
      "8 of 10 questions found something expected: 80 %.",
    ),
  },
  "thresholds.recall": {
    title: declareText("explanations.evaluation.recall.title", "Recall"),
    what: declareText(
      "explanations.evaluation.recall.what",
      "The share of all expected documents that were found, averaged over the questions. It differs from the hit rate only when a question expects several documents.",
    ),
    affects: declareText("explanations.evaluation.recall.affects", "The verdict of each compared profile."),
    safeValue: declareText("explanations.evaluation.recall.safeValue", "60 %."),
    extremes: [
      trap("0 %", declareText("explanations.evaluation.recall.extremes.0.then", "Always passes; the check says nothing.")),
    ],
    example: declareText(
      "explanations.evaluation.recall.example",
      "A question expects a datasheet and an application note and finds only the datasheet: 50 %.",
    ),
  },
  "thresholds.meanReciprocalRank": {
    title: declareText("explanations.evaluation.reciprocalRank.title", "Reciprocal rank"),
    what: declareText(
      "explanations.evaluation.reciprocalRank.what",
      "How high the first expected document ranks: 1 at rank 1, ½ at rank 2, ⅓ at rank 3, 0 when not found — averaged over the questions.",
    ),
    affects: declareText("explanations.evaluation.reciprocalRank.affects", "The verdict of each compared profile."),
    safeValue: declareText("explanations.evaluation.reciprocalRank.safeValue", "50 % — the expected document is usually first or second."),
    extremes: [
      trap("0 %", declareText("explanations.evaluation.reciprocalRank.extremes.0.then", "Always passes; ranking is not judged.")),
    ],
    example: declareText(
      "explanations.evaluation.reciprocalRank.example",
      "Found first for one question and third for another: (1 + ⅓) ÷ 2 ≈ 67 %.",
    ),
  },
  "thresholds.maximumUnexpectedResponseRate": {
    title: declareText("explanations.evaluation.unexpected.title", "Unexpected answers"),
    what: declareText(
      "explanations.evaluation.unexpected.what",
      "For questions that should find nothing: the share that found something anyway. A profile passes only at or below this share.",
    ),
    affects: declareText(
      "explanations.evaluation.unexpected.affects",
      "The verdict, and only when the suite has questions that should find nothing.",
    ),
    safeValue: declareText("explanations.evaluation.unexpected.safeValue", "20 %."),
    extremes: [
      plain("0 %", declareText("explanations.evaluation.unexpected.extremes.0.then", "Any answer to an unanswerable question fails the profile.")),
      trap("100 %", declareText("explanations.evaluation.unexpected.extremes.1.then", "Always passes; the check says nothing.")),
    ],
    example: declareText(
      "explanations.evaluation.unexpected.example",
      "“Price of a Ferrari” should find nothing in a datasheet library.",
    ),
  },
  maximumSearches: {
    title: declareText("explanations.evaluation.maximumSearches.title", "Searches"),
    what: declareText(
      "explanations.evaluation.maximumSearches.what",
      "The most searches one run makes, 1 to 1000. A run searches each question once per compared profile.",
    ),
    affects: declareText("explanations.evaluation.maximumSearches.affects", "Run length; a run that reaches it stops with the searches made so far."),
    safeValue: declareText(
      "explanations.evaluation.maximumSearches.safeValue",
      "Questions × compared profiles, or more.",
    ),
    extremes: [
      trap(
        declareText("explanations.evaluation.maximumSearches.extremes.0.when", "Below questions × profiles"),
        declareText("explanations.evaluation.maximumSearches.extremes.0.then", "Every run stops early and its numbers cover only part of the suite."),
      ),
    ],
    example: declareText("explanations.evaluation.maximumSearches.example", "20 questions and 2 profiles need 40."),
  },
  maximumEmbeddingCalls: {
    title: declareText("explanations.evaluation.maximumEmbeddingCalls.title", "Embedding calls"),
    what: declareText(
      "explanations.evaluation.maximumEmbeddingCalls.what",
      "The most paid calls a run may make to turn questions into vectors, for meaning and hybrid search.",
    ),
    affects: declareText("explanations.evaluation.maximumEmbeddingCalls.affects", "What a run costs at the embedding provider."),
    safeValue: declareText(
      "explanations.evaluation.maximumEmbeddingCalls.safeValue",
      "0 when only keyword profiles are compared; otherwise the number of questions.",
    ),
    extremes: [
      plain("0", declareText("explanations.evaluation.maximumEmbeddingCalls.extremes.0.then", "Keyword search and vectors already cached only; nothing is paid.")),
    ],
    example: declareText("explanations.evaluation.maximumEmbeddingCalls.example", "20 questions compared in hybrid mode need 20."),
  },
  maximumEmbeddingTokens: {
    title: declareText("explanations.evaluation.maximumEmbeddingTokens.title", "Embedding tokens"),
    what: declareText(
      "explanations.evaluation.maximumEmbeddingTokens.what",
      "The most tokens those embedding calls may report in total.",
    ),
    affects: declareText("explanations.evaluation.maximumEmbeddingTokens.affects", "What a run costs at the embedding provider."),
    safeValue: declareText("explanations.evaluation.maximumEmbeddingTokens.safeValue", "About 50 per question."),
    extremes: [
      plain("0", declareText("explanations.evaluation.maximumEmbeddingTokens.extremes.0.then", "No question may be embedded.")),
    ],
    example: declareText("explanations.evaluation.maximumEmbeddingTokens.example", "20 short questions: 1000."),
  },
  maximumDurationMilliseconds: {
    title: declareText("explanations.evaluation.maximumDuration.title", "Run time"),
    what: declareText(
      "explanations.evaluation.maximumDuration.what",
      "How long one run may take, in milliseconds, 10 to 600000. A run that reaches it stops with the searches made so far.",
    ),
    affects: declareText("explanations.evaluation.maximumDuration.affects", "How long the Run button waits."),
    safeValue: declareText("explanations.evaluation.maximumDuration.safeValue", "60000 — a minute."),
    extremes: [],
    example: declareText("explanations.evaluation.maximumDuration.example", "100 keyword searches usually take a few seconds."),
  },
};

const CATALOGUE: Record<ExplanationScope, Record<string, Entry>> = {
  search: SEARCH,
  embedding: EMBEDDING,
  answer: ANSWER,
  context: CONTEXT,
  read: READ,
  processing: PROCESSING,
  provider: PROVIDER,
  "call-limits": limitEntries("call-limits"),
  "shared-budget": limitEntries("shared-budget"),
  system: SYSTEM,
  scanning: SCANNING,
  "web-crawl": WEB_CRAWL,
  evaluation: EVALUATION,
};

/** Whether a parameter has a written explanation, rather than one built from the server's description. */
export function hasWrittenExplanation(scope: ExplanationScope, path: string): boolean {
  return CATALOGUE[scope][path] !== undefined;
}

/**
 * The explanation of one parameter. `fallback` names it and carries the server's own description, used when
 * nothing is written yet — a parameter a newer backend added still opens on what the server says.
 */
export function explainParameter(
  scope: ExplanationScope,
  path: string,
  fallback: { title: string; description?: string | null },
): ParameterExplanationContent {
  const entry = CATALOGUE[scope][path];
  if (entry !== undefined) {
    return entry;
  }
  return {
    title: fallback.title,
    what:
      fallback.description !== undefined &&
      fallback.description !== null &&
      fallback.description !== ""
        ? fallback.description
        : declareText(
            "explanations.unwritten.what",
            "The server describes this parameter only by its type and bounds below.",
          ),
    affects: declareText(
      "explanations.unwritten.affects",
      "Not described in detail yet; the server's own description above is what is known.",
    ),
    safeValue: declareText(
      "explanations.unwritten.safeValue",
      "The value the editor suggests for a new configuration.",
    ),
    extremes: [],
    example: "—",
  };
}
