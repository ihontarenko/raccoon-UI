import type { Profile, ProfileConfiguration, ProfileKind } from "../../lib/profiles";
import {
  declareText,
  translate,
  translateDeclared,
  translatePlural,
  type DeclaredText,
} from "../../translations/translate";
import type { ParameterFinding } from "../../ui/components";
import { valueAt } from "./configurationPaths";
import { findProfile, findProvider, publishedVectorsOf, type ProfileWiring } from "./profileWiring";

// Values that are each valid on their own but, together or against what exists, quietly stop work: a cost
// ceiling with no pricing to compute a cost from, a distance of 0, exact token counting demanded of a
// tokenizer that only estimates. Every rule mirrors a backend check (ManagedQueryEmbeddings, PostgresSemantic
// Retrieval, JsonAnswerPrompts, the profile records' own validation) so the flag under a field and the flow
// strip, which reads `meaningSearchBlocker` from here, say the same thing.

export interface ConfigurationHazard extends ParameterFinding {
  /** The parameter the finding is shown under. */
  path: string;
  /** Meaning search cannot run at all while this holds; the flow strip routes around it. */
  blocksMeaningSearch?: boolean;
  /** Meaning search runs but cannot return a hit. */
  emptiesMeaningSearch?: boolean;
}

const text = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;
const number = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

interface Pricing {
  currency: string;
  perMillionInputTokens: number;
  validFrom: string;
  validUntil: string;
}

function pricingOf(configuration: ProfileConfiguration): Pricing | null {
  const pricing = configuration.pricing;
  if (pricing === null || typeof pricing !== "object") {
    return null;
  }
  const candidate = pricing as Record<string, unknown>;
  const price = number(candidate.perMillionInputTokens);
  const currency = text(candidate.currency);
  const validFrom = text(candidate.validFrom);
  const validUntil = text(candidate.validUntil);
  if (price === null || currency === null || validFrom === null || validUntil === null) {
    return null;
  }
  return { currency, perMillionInputTokens: price, validFrom, validUntil };
}

/** The server compares pricing dates with today in UTC; ISO dates compare correctly as text. */
function todayInUniversalTime(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Why an embedding configuration's pricing cannot price a call today — "has no pricing" — or null when it can. */
function pricingGap(configuration: ProfileConfiguration): string | null {
  const pricing = pricingOf(configuration);
  if (pricing === null) {
    return translate("profiles.hazards.noPricing", "has no pricing");
  }
  const today = todayInUniversalTime();
  if (today < pricing.validFrom) {
    return translate("profiles.hazards.pricingNotStarted", "has pricing that only starts on {date}", { date: pricing.validFrom });
  }
  if (today > pricing.validUntil) {
    return translate("profiles.hazards.pricingEnded", "has pricing that ended on {date}", { date: pricing.validUntil });
  }
  return null;
}

/** Whether a search profile may embed a question: by default, through AUTO, or on a caller's request. */
export function mayUseMeaningSearch(configuration: ProfileConfiguration): boolean {
  const mode = text(valueAt(configuration, "retrieval.mode")) ?? "LEXICAL";
  const automatic = text(valueAt(configuration, "retrieval.automaticMode")) ?? "LEXICAL";
  const overrides = valueAt(configuration, "retrieval.allowedOverrides");
  const modes = [
    mode === "AUTO" ? automatic : mode,
    ...(Array.isArray(overrides) ? overrides : []),
  ];
  return modes.some(
    (candidate) =>
      candidate === "SEMANTIC" ||
      candidate === "HYBRID" ||
      (candidate === "AUTO" && automatic !== "LEXICAL"),
  );
}

function searchHazards(
  wiring: ProfileWiring,
  configuration: ProfileConfiguration,
): ConfigurationHazard[] {
  const hazards: ConfigurationHazard[] = [];
  const semantic = valueAt(configuration, "retrieval.semantic");
  if (mayUseMeaningSearch(configuration) && semantic !== null && typeof semantic === "object") {
    hazards.push(...meaningHazards(wiring, configuration));
  }

  const normalization = text(configuration.normalization);
  const minimumScore = number(configuration.minimumScore);
  if (minimumScore !== null && minimumScore >= 1) {
    hazards.push({
      path: "minimumScore",
      tone: "deny",
      text: translate(
        "profiles.hazards.minimumScoreOne",
        "A minimum score of 1 admits only perfect scores — practically no result is returned.",
      ),
    });
  } else if (minimumScore !== null && minimumScore > 0 && normalization === "NONE") {
    hazards.push({
      path: "minimumScore",
      tone: "warn",
      text: translate(
        "profiles.hazards.minimumScoreRaw",
        "Raw keyword ranks (normalisation NONE) are usually below 0.1, so this minimum may drop nearly every keyword hit.",
      ),
    });
  }
  if (configuration.includeDocuments === false && configuration.includeEditorial === false) {
    const message = translate(
      "profiles.hazards.nothingIncluded",
      "Neither documents nor editorial entries are included — the server refuses a profile with nothing to search.",
    );
    hazards.push(
      { path: "includeDocuments", tone: "deny", text: message },
      { path: "includeEditorial", tone: "deny", text: message },
    );
  }
  const defaultResults = number(configuration.defaultResults);
  const maximumResults = number(configuration.maximumResults);
  if (defaultResults !== null && maximumResults !== null && defaultResults > maximumResults) {
    hazards.push({
      path: "defaultResults",
      tone: "deny",
      text: translate(
        "profiles.hazards.defaultAboveMaximumResults",
        "The default ({default}) is above the maximum results ({maximum}) — the server refuses it.",
        { default: defaultResults, maximum: maximumResults },
      ),
    });
  }
  hazards.push(...analyzerHazards(wiring, configuration));

  const fusion = valueAt(configuration, "retrieval.fusion");
  if (fusion !== null && typeof fusion === "object") {
    if (
      text(valueAt(configuration, "retrieval.fusion.strategy")) === "WEIGHTED_SCORE" &&
      normalization !== "SCORE_FRACTION"
    ) {
      hazards.push({
        path: "retrieval.fusion.strategy",
        tone: "deny",
        text: translate(
          "profiles.hazards.weightedNeedsFraction",
          "Weighted fusion needs normalisation SCORE_FRACTION — the server refuses to save it otherwise.",
        ),
      });
    }
    for (const path of ["retrieval.fusion.lexicalWeight", "retrieval.fusion.semanticWeight"]) {
      const weight = number(valueAt(configuration, path));
      if (weight !== null && weight <= 0) {
        hazards.push({
          path,
          tone: "deny",
          text: translate("profiles.hazards.branchWeightZero", "A branch weight must be above 0 — the server refuses 0."),
        });
      }
    }
  }

  const rerank = valueAt(configuration, "retrieval.rerank");
  if (rerank !== null && typeof rerank === "object") {
    const candidates = number(valueAt(configuration, "retrieval.rerank.candidates"));
    const keep = number(valueAt(configuration, "retrieval.rerank.keep"));
    if (candidates !== null && keep !== null && keep > candidates) {
      hazards.push({
        path: "retrieval.rerank.keep",
        tone: "deny",
        text: translate(
          "profiles.hazards.keepsMoreThanCandidates",
          "Keeps {keep} of only {candidates} candidates — the server refuses it.",
          { keep, candidates },
        ),
      });
    }
    const timeout = number(valueAt(configuration, "retrieval.rerank.timeoutMilliseconds"));
    const systemTimeout = wiring.settings?.["search.maximum-rerank-milliseconds"];
    if (timeout !== null && systemTimeout !== undefined && timeout > systemTimeout) {
      hazards.push({
        path: "retrieval.rerank.timeoutMilliseconds",
        tone: "warn",
        text: translate(
          "profiles.hazards.rerankDeadline",
          "The installation's rerank deadline is {milliseconds} ms; that smaller value applies.",
          { milliseconds: systemTimeout },
        ),
      });
    }
  }
  return hazards;
}

/** Only what decides whether a question can be embedded and matched — the rules behind the flow strip. */
function meaningHazards(
  wiring: ProfileWiring,
  configuration: ProfileConfiguration,
): ConfigurationHazard[] {
  const hazards: ConfigurationHazard[] = [];
  const embedding = findProfile(
    wiring,
    "embedding",
    text(valueAt(configuration, "retrieval.semantic.embeddingProfileId")),
  );
  const tokenizer =
    embedding === null ? null : text(valueAt(embedding.configuration, "tokenizer.strategy"));

  const ceiling = number(valueAt(configuration, "retrieval.semantic.maximumQueryCost"));
  if (ceiling !== null) {
    const gap = embedding === null ? null : pricingGap(embedding.configuration);
    const pricing = embedding === null ? null : pricingOf(embedding.configuration);
    if (gap !== null && embedding !== null) {
      hazards.push({
        path: "retrieval.semantic.maximumQueryCost",
        tone: "deny",
        blocksMeaningSearch: true,
        text: translate(
          "profiles.hazards.questionCostUnknown",
          "A cost ceiling is set, but embedding profile {name} {gap}: the cost of a question cannot be computed, so every meaning search is refused. Clear the ceiling or add current pricing.",
          { name: embedding.name, gap },
        ),
      });
    } else if (ceiling === 0 && (pricing === null || pricing.perMillionInputTokens > 0)) {
      hazards.push({
        path: "retrieval.semantic.maximumQueryCost",
        tone: "deny",
        blocksMeaningSearch: embedding !== null,
        text:
          pricing === null
            ? translate(
                "profiles.hazards.zeroCeilingAnyPrice",
                "A ceiling of 0 admits only free calls — with any price at all, every meaning search is refused.",
              )
            : translate(
                "profiles.hazards.zeroCeilingPriced",
                "A ceiling of 0 admits only free calls; {name} costs {price} {currency} per million tokens, so every meaning search is refused.",
                {
                  name: embedding?.name ?? translate("profiles.hazards.theModel", "the model"),
                  price: pricing.perMillionInputTokens,
                  currency: pricing.currency,
                },
              ),
      });
    }
  }

  const distance = number(valueAt(configuration, "retrieval.semantic.maximumDistance"));
  const metric = text(valueAt(configuration, "retrieval.semantic.metric")) ?? "COSINE";
  if (distance === 0) {
    hazards.push({
      path: "retrieval.semantic.maximumDistance",
      tone: "deny",
      emptiesMeaningSearch: true,
      text: translate(
        "profiles.hazards.zeroDistance",
        "A maximum distance of 0 matches only vectors identical to the question — meaning search returns nothing. Clear it to keep the nearest neighbours.",
      ),
    });
  } else if (distance !== null && metric === "COSINE" && distance < 0.1) {
    hazards.push({
      path: "retrieval.semantic.maximumDistance",
      tone: "warn",
      text: translate(
        "profiles.hazards.tinyDistance",
        "Below 0.1 only near-copies of the question pass; ordinary paraphrases sit around 0.2–0.5.",
      ),
    });
  }

  if (tokenizer === "UNKNOWN" && embedding !== null) {
    hazards.push({
      path: "retrieval.semantic.embeddingProfileId",
      tone: "deny",
      blocksMeaningSearch: true,
      text: translate(
        "profiles.hazards.searchTokenizerUnknown",
        "{name} cannot count tokens (tokenizer UNKNOWN), so every question is refused before the model is called.",
        { name: embedding.name },
      ),
    });
  } else if (
    tokenizer === "CODE_POINT_ESTIMATE" &&
    valueAt(configuration, "retrieval.semantic.allowApproximateTokens") === false &&
    embedding !== null
  ) {
    hazards.push({
      path: "retrieval.semantic.allowApproximateTokens",
      tone: "deny",
      blocksMeaningSearch: true,
      text: translate(
        "profiles.hazards.searchExactOnly",
        "{name} only estimates tokens (CODE_POINT_ESTIMATE), and this profile accepts exact counts only — every meaning search is refused. Allow approximate counts.",
        { name: embedding.name },
      ),
    });
  }

  const candidates = number(valueAt(configuration, "retrieval.semantic.maximumCandidates"));
  const scanRecords = number(valueAt(configuration, "retrieval.semantic.maximumScanRecords"));
  if (candidates !== null && scanRecords !== null && scanRecords < candidates) {
    hazards.push({
      path: "retrieval.semantic.maximumScanRecords",
      tone: "deny",
      text: translate(
        "profiles.hazards.scanBelowCandidates",
        "The scan ceiling ({scan}) is below the meaning candidates ({candidates}) — the server refuses it.",
        { scan: scanRecords, candidates },
      ),
    });
  } else if (scanRecords !== null && embedding !== null) {
    const published = publishedVectorsOf(wiring, embedding);
    const vectors =
      published?.reduce(
        (sum, generation) => sum + generation.storedRecords - generation.removedRecords,
        0,
      ) ?? 0;
    const systemCeiling = wiring.settings?.["search.maximum-vector-scan-records"];
    const effective =
      systemCeiling === undefined ? scanRecords : Math.min(scanRecords, systemCeiling);
    if (vectors > effective) {
      hazards.push({
        path: "retrieval.semantic.maximumScanRecords",
        tone: "deny",
        blocksMeaningSearch: true,
        text: translatePlural(
          "profiles.hazards.vectorsAboveScan",
          vectors,
          {
            one: "{count} vector is published for {name}, above the scan ceiling of {ceiling} — exact meaning search is refused rather than searching part of them.",
            other: "{count} vectors are published for {name}, above the scan ceiling of {ceiling} — exact meaning search is refused rather than searching part of them.",
          },
          { name: embedding.name, ceiling: effective },
        ),
      });
    }
  }

  if (number(valueAt(configuration, "retrieval.semantic.cacheLifetimeSeconds")) === 0) {
    hazards.push({
      path: "retrieval.semantic.cacheLifetimeSeconds",
      tone: "warn",
      text: translate("profiles.hazards.noQuestionCache", "No question cache: every repeated question pays for a model call."),
    });
  }
  return hazards;
}

/** The analyzers a search lists against those the processing profiles index with. */
function analyzerHazards(
  wiring: ProfileWiring,
  configuration: ProfileConfiguration,
): ConfigurationHazard[] {
  const listed = Array.isArray(configuration.analyzers)
    ? (configuration.analyzers as string[])
    : [];
  const indexing = wiring.profiles.processing
    .filter((profile) => profile.configuration.enabled !== false)
    .map((profile) => text(valueAt(profile.configuration, "preparation.indexing.analyzer")))
    .filter((analyzer): analyzer is string => analyzer !== null);
  if (
    listed.length === 0 ||
    indexing.length === 0 ||
    indexing.some((analyzer) => listed.includes(analyzer))
  ) {
    return [];
  }
  return [
    {
      path: "analyzers",
      tone: "warn",
      text: translate(
        "profiles.hazards.analyzersUnlisted",
        "The processing profiles index with {analyzers}, none of which is listed — keyword search may find no document.",
        { analyzers: [...new Set(indexing)].join(", ") },
      ),
    },
  ];
}

function embeddingHazards(
  wiring: ProfileWiring,
  configuration: ProfileConfiguration,
  profileId: string | null,
): ConfigurationHazard[] {
  const hazards: ConfigurationHazard[] = [];
  const gap = pricingGap(configuration);
  const pricing = pricingOf(configuration);
  const ceiling = number(configuration.maximumCost);
  if (ceiling !== null && gap !== null) {
    hazards.push({
      path: "maximumCost",
      tone: "deny",
      text: translate(
        "profiles.hazards.vectorisingCostUnknown",
        "A cost ceiling is set, but this profile {gap}: every vectorising run is refused as cost unknown.",
        { gap },
      ),
    });
  } else if (ceiling === 0 && pricing !== null && pricing.perMillionInputTokens > 0) {
    hazards.push({
      path: "maximumCost",
      tone: "deny",
      text: translate("profiles.hazards.zeroCeilingVectorising", "A ceiling of 0 with a price above 0 refuses every vectorising run."),
    });
  }
  if (pricing !== null && todayInUniversalTime() > pricing.validUntil) {
    hazards.push({
      path: "pricing",
      tone: "warn",
      text: translate(
        "profiles.hazards.pricingExpired",
        "The pricing ended on {date}; from then on costs are unknown and every cost ceiling refuses.",
        { date: pricing.validUntil },
      ),
    });
  }

  const tokenizer = text(valueAt(configuration, "tokenizer.strategy"));
  if (tokenizer === "UNKNOWN") {
    hazards.push({
      path: "tokenizer.strategy",
      tone: "deny",
      text: translate(
        "profiles.hazards.tokenizerUnknown",
        "With an UNKNOWN tokenizer no token budget can be satisfied: vectorising is refused, and so is every meaning search through this profile.",
      ),
    });
  }

  // The search profiles reading this one, judged with this profile's values as they are on screen.
  const readers =
    profileId === null
      ? []
      : wiring.profiles.search.filter(
          (search) =>
            valueAt(search.configuration, "retrieval.semantic.embeddingProfileId") === profileId,
        );
  const costBound = readers.filter(
    (search) =>
      number(valueAt(search.configuration, "retrieval.semantic.maximumQueryCost")) !== null,
  );
  if (gap !== null && costBound.length > 0) {
    hazards.push({
      path: "pricing",
      tone: "deny",
      text: translate(
        "profiles.hazards.readersCostBound",
        "{names} set a question cost ceiling; without current pricing here, their meaning search is refused.",
        { names: costBound.map((search) => search.name).join(", ") },
      ),
    });
  }
  const exactOnly = readers.filter(
    (search) =>
      valueAt(search.configuration, "retrieval.semantic.allowApproximateTokens") === false,
  );
  if (tokenizer === "CODE_POINT_ESTIMATE" && exactOnly.length > 0) {
    hazards.push({
      path: "tokenizer.strategy",
      tone: "deny",
      text: translate(
        "profiles.hazards.readersExactOnly",
        "{names} accept exact token counts only; with an estimate here their meaning search is refused.",
        { names: exactOnly.map((search) => search.name).join(", ") },
      ),
    });
  }
  return hazards;
}

function answerHazards(
  wiring: ProfileWiring,
  configuration: ProfileConfiguration,
): ConfigurationHazard[] {
  const hazards: ConfigurationHazard[] = [];
  const chat = text(configuration.providerConfigurationId);
  if (chat !== null && configuration.allowApproximateTokens === false) {
    hazards.push({
      path: "allowApproximateTokens",
      tone: "deny",
      text: translate(
        "profiles.hazards.chatExactOnly",
        "The chat adapter only estimates tokens, so with exact counts required every answer that reaches the model is refused.",
      ),
    });
  }
  const output = number(configuration.maximumOutputTokens);
  const total = number(configuration.maximumTotalTokens);
  if (output !== null && total !== null && output >= total) {
    hazards.push({
      path: "maximumTotalTokens",
      tone: "deny",
      text: translate(
        "profiles.hazards.outputFillsTotal",
        "The output allowance ({output}) leaves no room for the prompt within {total} total tokens — every answer is refused before the call.",
        { output, total },
      ),
    });
  }
  const timeout = number(configuration.timeoutMilliseconds);
  const systemTimeout = wiring.settings?.["answer.maximum-model-milliseconds"];
  const deadline = number(configuration.maximumDurationMilliseconds);
  const effectiveTimeout =
    timeout === null
      ? null
      : systemTimeout === undefined
        ? timeout
        : Math.min(timeout, systemTimeout);
  if (
    chat !== null &&
    deadline !== null &&
    effectiveTimeout !== null &&
    deadline <= effectiveTimeout
  ) {
    hazards.push({
      path: "maximumDurationMilliseconds",
      tone: "deny",
      text: translate(
        "profiles.hazards.deadlineBelowTimeout",
        "The answer deadline ({deadline} ms) is not above the response timeout ({timeout} ms): once search has run, the time left never admits the model call.",
        { deadline, timeout: effectiveTimeout },
      ),
    });
  }
  const context = findProfile(wiring, "context", text(configuration.contextProfileId));
  const contextSize = context === null ? null : number(context.configuration.maximumCodePoints);
  const prompt = number(configuration.maximumPromptCodePoints);
  if (chat !== null && contextSize !== null && prompt !== null && contextSize >= prompt) {
    hazards.push({
      path: "maximumPromptCodePoints",
      tone: "warn",
      text: translate(
        "profiles.hazards.contextOverflowsPrompt",
        "{name} may return {size} characters, which with the instructions does not fit a prompt of {prompt} — a full context refuses the answer.",
        {
          name: context?.name ?? translate("profiles.hazards.theContextProfile", "The context profile"),
          size: contextSize,
          prompt,
        },
      ),
    });
  }
  if (number(configuration.maximumCalls) === 0 && chat !== null) {
    hazards.push({
      path: "maximumCalls",
      tone: "warn",
      text: translate("profiles.hazards.zeroCalls", "0 calls: the chat provider is never called and answers are sources only."),
    });
  }
  if (chat !== null) {
    const provider = findProvider(wiring, chat);
    if (provider !== null && configuration.unavailableChat === "FAIL" && !provider.active) {
      hazards.push({
        path: "unavailableChat",
        tone: "deny",
        text: translate(
          "profiles.hazards.chatNotInForce",
          "{provider} is not in force, so with FAIL every answer fails.",
          { provider: `${provider.provider} · ${provider.model}` },
        ),
      });
    }
  }
  return hazards;
}

function contextHazards(configuration: ProfileConfiguration): ConfigurationHazard[] {
  const fragment = number(configuration.maximumFragmentCodePoints);
  const total = number(configuration.maximumCodePoints);
  if (fragment !== null && total !== null && fragment > total) {
    return [
      {
        path: "maximumFragmentCodePoints",
        tone: "warn",
        text: translate(
          "profiles.hazards.fragmentAboveBudget",
          "One fragment ({fragment}) can be larger than the whole budget ({total}) and crowd out the rest.",
          { fragment, total },
        ),
      },
    ];
  }
  return [];
}

function readHazards(configuration: ProfileConfiguration): ConfigurationHazard[] {
  const preferred = number(configuration.defaultCodePoints);
  const maximum = number(configuration.maximumCodePoints);
  if (preferred !== null && maximum !== null && preferred > maximum) {
    return [
      {
        path: "defaultCodePoints",
        tone: "deny",
        text: translate(
          "profiles.hazards.defaultAboveMaximum",
          "The default ({default}) is above the maximum ({maximum}) — the server refuses it.",
          { default: preferred, maximum },
        ),
      },
    ];
  }
  return [];
}

function processingHazards(
  wiring: ProfileWiring,
  configuration: ProfileConfiguration,
): ConfigurationHazard[] {
  const hazards: ConfigurationHazard[] = [];
  const size = number(valueAt(configuration, "preparation.chunking.maximumCodePoints"));
  const overlap = number(valueAt(configuration, "preparation.chunking.overlapCodePoints"));
  if (size !== null && overlap !== null && overlap >= size) {
    hazards.push({
      path: "preparation.chunking.overlapCodePoints",
      tone: "deny",
      text: translate(
        "profiles.hazards.overlapAboveSize",
        "The overlap ({overlap}) must be smaller than the chunk size ({size}) — the server refuses it.",
        { overlap, size },
      ),
    });
  }
  const steps = valueAt(configuration, "preparation.steps");
  if (Array.isArray(steps) && steps.includes("relations")) {
    if (!steps.includes("parse")) {
      hazards.push({ path: "preparation.steps", tone: "warn", text: translate("profiles.hazards.relationsReuse",
        "This profile requires an explicit earlier parse of the same version with compatible semantic facts. Old parses may need reprocessing.") });
    }
    if (steps.includes("chunk") && steps.indexOf("relations") < steps.indexOf("chunk")) {
      hazards.push({ path: "preparation.steps", tone: "deny", text: translate("profiles.hazards.relationsOrder",
        "Place relations after chunking so content exclusions also apply to graph evidence.") });
    }
  }
  if (Array.isArray(steps) && steps.length > 0 && !steps.includes("lexical")) {
    hazards.push({
      path: "preparation.steps",
      tone: "warn",
      text: translate(
        "profiles.hazards.noLexicalStep",
        "Without the lexical step no keyword entries are published. Relations remain available to a separately built graph.",
      ),
    });
  }
  if (valueAt(configuration, "preparation.indexing.publishAutomatically") === false) {
    hazards.push({
      path: "preparation.indexing.publishAutomatically",
      tone: "warn",
      text: translate(
        "profiles.hazards.publishByHand",
        "Processed documents stay unsearchable until a generation is published by hand.",
      ),
    });
  }
  const analyzer = text(valueAt(configuration, "preparation.indexing.analyzer"));
  const searches = wiring.profiles.search.filter(
    (search) => search.configuration.enabled !== false,
  );
  if (
    analyzer !== null &&
    searches.length > 0 &&
    !searches.some(
      (search) =>
        Array.isArray(search.configuration.analyzers) &&
        (search.configuration.analyzers as string[]).includes(analyzer),
    )
  ) {
    hazards.push({
      path: "preparation.indexing.analyzer",
      tone: "warn",
      text: translate(
        "profiles.hazards.analyzerUnused",
        "No enabled search profile lists {analyzer} — what this profile indexes is invisible to keyword search.",
        { analyzer },
      ),
    });
  }
  return hazards;
}

/** Every finding for a profile's configuration as it stands — saved or still being edited. */
export function profileHazards(
  wiring: ProfileWiring,
  kind: ProfileKind,
  configuration: ProfileConfiguration,
  profileId: string | null,
): ConfigurationHazard[] {
  switch (kind) {
    case "search":
      return searchHazards(wiring, configuration);
    case "embedding":
      return embeddingHazards(wiring, configuration, profileId);
    case "answer":
      return answerHazards(wiring, configuration);
    case "context":
      return contextHazards(configuration);
    case "read":
      return readHazards(configuration);
    case "processing":
      return processingHazards(wiring, configuration);
    default:
      return [];
  }
}

/** The findings grouped by the parameter they belong under. */
export function findingsByPath(hazards: ConfigurationHazard[]): Map<string, ParameterFinding[]> {
  const grouped = new Map<string, ParameterFinding[]>();
  for (const hazard of hazards) {
    grouped.set(hazard.path, [
      ...(grouped.get(hazard.path) ?? []),
      { tone: hazard.tone, text: hazard.text },
    ]);
  }
  return grouped;
}

/**
 * Why a search profile's meaning search is refused before any vector is compared, by its own values set
 * against its embedding profile — or null. The flow strip treats it like a missing provider.
 */
export function meaningSearchBlocker(wiring: ProfileWiring, search: Profile): string | null {
  const blocking = meaningHazards(wiring, search.configuration).find(
    (hazard) => hazard.blocksMeaningSearch === true,
  );
  if (blocking === undefined) {
    return null;
  }
  const reason = MEANING_BLOCK_REASON[blocking.path];
  if (reason === undefined) {
    return translate("profiles.hazards.blocked.budget", "a budget setting refuses every question");
  }
  return translateDeclared(reason);
}

/** Whether meaning search runs but can never return a hit — such as a maximum distance of 0. */
export function meaningSearchEmptied(wiring: ProfileWiring, search: Profile): string | null {
  const emptying = meaningHazards(wiring, search.configuration).find(
    (hazard) => hazard.emptiesMeaningSearch === true,
  );
  if (emptying === undefined) {
    return null;
  }
  return translate("profiles.hazards.emptied", "maximum distance 0 matches only identical vectors — it finds nothing");
}

const MEANING_BLOCK_REASON: Record<string, DeclaredText> = {
  "retrieval.semantic.maximumQueryCost": declareText(
    "profiles.hazards.blocked.questionCost",
    "its question cost ceiling cannot be met (no current pricing, or a ceiling of 0)",
  ),
  "retrieval.semantic.allowApproximateTokens": declareText(
    "profiles.hazards.blocked.exactTokens",
    "it requires exact token counts and its embedding profile only estimates them",
  ),
  "retrieval.semantic.embeddingProfileId": declareText(
    "profiles.hazards.blocked.tokenizerUnknown",
    "its embedding profile cannot count tokens (tokenizer UNKNOWN)",
  ),
  "retrieval.semantic.maximumScanRecords": declareText(
    "profiles.hazards.blocked.scanCeiling",
    "more vectors are published than its scan ceiling allows",
  ),
};
