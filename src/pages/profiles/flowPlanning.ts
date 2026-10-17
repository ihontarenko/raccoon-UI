import type { Profile } from "../../lib/profiles";
import { declareText, translate, translateDeclared, type DeclaredText } from "../../translations/translate";
import { meaningSearchBlocker, meaningSearchEmptied } from "./configurationHazards";
import { valueAt } from "./configurationPaths";
import {
  embeddingOfSearch,
  findProfile,
  findProvider,
  hasRerank,
  inForce,
  isEnabled,
  keyStored,
  providerLabel,
  providerVerdict,
  publishedVectorsOf,
  rerankVerdict,
  vectorCount,
  type ProfileWiring,
} from "./profileWiring";

// What a search or an answer profile will actually do, stage by stage, judged now against what exists:
// the providers in force, the vectors published, the installation's switches. It mirrors the backend's
// own routing (ManagedRetrievalBackend, KnowledgeAnswerService): AUTO resolves to the profile's automatic
// mode, a meaning search that cannot run falls back to keywords only when the profile's unavailable
// policy says LEXICAL, and an answer without a usable chat model returns its sources only when the
// profile's unavailable-chat policy says so. Nothing is invented — a stage that cannot be judged says so.

/**
 * How a stage will go. `runs` — it will run (blue); `falls-back` — it cannot, and something smaller runs in
 * its place (amber); `cannot-run` — it cannot, and the whole request fails (red); `off` — the configuration
 * leaves it out on purpose (grey).
 */
export type StageState = "runs" | "falls-back" | "cannot-run" | "off";

export type StageKey =
  "question" | "keywords" | "meaning" | "fusion" | "rerank" | "context" | "model" | "result";

export interface FlowFix {
  label: string;
  href: string;
}

export interface FlowStage {
  key: StageKey;
  name: string;
  state: StageState;
  /** The state in words: "Runs", "Falls back", "Cannot run", "Off". */
  word: string;
  /** The concrete setting or fact that decides the state. */
  decidedBy: string;
  /** What happens next because of it, when that is not obvious from the state. */
  consequence?: string;
  fix?: FlowFix;
}

export interface ProfileFlowPlan {
  /** One plain sentence: what a request through this profile does today. */
  summary: string;
  /** Whether the request as a whole can complete. */
  outcome: "works" | "degraded" | "fails" | "disabled";
  stages: FlowStage[];
}

/** A search mode as the profile and the search request name it. */
export type FlowMode = "LEXICAL" | "SEMANTIC" | "HYBRID" | "AUTO";
type Mode = FlowMode;

const WORD: Record<StageState, DeclaredText> = {
  runs: declareText("profiles.flow.state.runs", "Runs"),
  "falls-back": declareText("profiles.flow.state.fallsBack", "Falls back"),
  "cannot-run": declareText("profiles.flow.state.cannotRun", "Cannot run"),
  off: declareText("profiles.flow.state.off", "Off"),
};

/** Each stage's name, shown on the strip and in the full flow. */
const STAGE_NAME = {
  question: declareText("profiles.flow.stage.question", "Question"),
  keywords: declareText("profiles.flow.stage.keywords", "Keyword search"),
  meaning: declareText("profiles.flow.stage.meaning", "Meaning search"),
  fusion: declareText("profiles.flow.stage.fusion", "Fusion"),
  rerank: declareText("profiles.flow.stage.rerank", "Rerank"),
  search: declareText("profiles.flow.stage.search", "Search"),
  context: declareText("profiles.flow.stage.context", "Context"),
  model: declareText("profiles.flow.stage.model", "Answer model"),
  result: declareText("profiles.flow.stage.result", "Result"),
} satisfies Record<string, DeclaredText>;

type StageName = keyof typeof STAGE_NAME;

const text = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;
const number = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

function stage(
  key: StageKey,
  name: StageName,
  state: StageState,
  decidedBy: string,
  extra: { consequence?: string; fix?: FlowFix } = {},
): FlowStage {
  return {
    key,
    name: translateDeclared(STAGE_NAME[name]),
    state,
    word: translateDeclared(WORD[state]),
    decidedBy,
    ...extra,
  };
}

function editFix(kind: string, profile: Profile, label?: string): FlowFix {
  return {
    label: label ?? translate("profiles.flow.fix.edit", "Edit {name}", { name: profile.name }),
    href: `/profiles/${kind}/${profile.id}`,
  };
}

function providersFix(): FlowFix {
  return { label: translate("profiles.flow.fix.providers", "AI providers"), href: "/administration/providers" };
}

function vectoriseFix(): FlowFix {
  return { label: translate("profiles.flow.fix.vectorise", "Vectorise"), href: "/index?tab=vectors" };
}

function settingsFix(): FlowFix {
  return { label: translate("profiles.flow.fix.settings", "System settings"), href: "/administration/settings" };
}

/** What the keyword stage runs with: the query mode in words, then the analyzers. */
function queryNote(queryMode: string, analyzers: string): string {
  return translate("profiles.flow.query", "{mode} query · {analyzers}", {
    mode: queryMode.toLowerCase().replace("_", " "),
    analyzers,
  });
}

/** "The answer fails" — the consequence every stage an answer cannot do without shares. */
function answerFails(): string {
  return translate("profiles.flow.answerFails", "The answer fails");
}

function sourcesOnly(): string {
  return translate("profiles.flow.sourcesOnly", "Sources only");
}

/** Lower-cases a verdict's first letter, so it reads inside a sentence. */
function inSentence(sentence: string): string {
  return sentence.charAt(0).toLowerCase() + sentence.slice(1);
}

/** Why meaning search cannot run now, in the words a person would act on — or null when it can. */
function meaningObstacle(
  wiring: ProfileWiring,
  search: Profile,
): { reason: string; fix: FlowFix } | null {
  const embeddingId = text(valueAt(search.configuration, "retrieval.semantic.embeddingProfileId"));
  if (embeddingId === null) {
    return {
      reason: translate("profiles.flow.obstacle.noEmbedding", "no embedding profile is named"),
      fix: editFix("search", search),
    };
  }
  const embedding = embeddingOfSearch(wiring, search);
  if (embedding === null) {
    return {
      reason: translate("profiles.flow.obstacle.embeddingGone", "its embedding profile no longer exists"),
      fix: editFix("search", search),
    };
  }
  if (!isEnabled(embedding)) {
    return {
      reason: translate("profiles.flow.obstacle.embeddingDisabled", "embedding profile {name} is disabled", {
        name: embedding.name,
      }),
      fix: editFix("embedding", embedding),
    };
  }
  const provider = providerVerdict(
    wiring,
    text(embedding.configuration.providerConfigurationId),
    "EMBEDDINGS",
  );
  if (provider.tone === "deny") {
    return { reason: inSentence(provider.text), fix: providersFix() };
  }
  const published = publishedVectorsOf(wiring, embedding);
  if (published !== null && published.length === 0) {
    const model = text(embedding.configuration.modelRevision);
    return {
      reason:
        model === null
          ? translate("profiles.flow.obstacle.noVectorsForThisModel", "no vectors are published for this model")
          : translate("profiles.flow.obstacle.noVectors", "no vectors are published for {model}", { model }),
      fix: vectoriseFix(),
    };
  }
  // The profile's own budget values set against its embedding profile — the same rules that flag the fields.
  const blocker = meaningSearchBlocker(wiring, search);
  if (blocker !== null) {
    return { reason: blocker, fix: editFix("search", search) };
  }
  return null;
}

function meaningSource(wiring: ProfileWiring, search: Profile): string {
  const embedding = embeddingOfSearch(wiring, search);
  if (embedding === null) {
    return translate("profiles.flow.anEmbeddingProfile", "an embedding profile");
  }
  const provider = findProvider(wiring, text(embedding.configuration.providerConfigurationId));
  const published = publishedVectorsOf(wiring, embedding);
  const vectors =
    published === null
      ? ""
      : ` · ${translate("profiles.flow.vectorsPublished", "{vectors} published", {
          vectors: vectorCount(
            published.reduce((sum, generation) => sum + generation.storedRecords - generation.removedRecords, 0),
          ),
        })}`;
  const keyState = provider !== null && provider.keyConfigured ? ` · ${keyStored()}` : "";
  const providerState =
    provider === null
      ? translate("profiles.flow.providerHidden", "provider not visible")
      : `${providerLabel(provider)} ${inForce()}${keyState}`;
  return `${embedding.name}: ${providerState}${vectors}`;
}

function modeOf(
  search: Profile,
  override?: Mode,
): { requested: Mode; selected: Exclude<Mode, "AUTO"> } {
  const requested =
    override ?? ((text(valueAt(search.configuration, "retrieval.mode")) ?? "LEXICAL") as Mode);
  const automatic = (text(valueAt(search.configuration, "retrieval.automaticMode")) ??
    "LEXICAL") as Exclude<Mode, "AUTO">;
  return {
    requested,
    selected: requested === "AUTO" ? automatic : (requested as Exclude<Mode, "AUTO">),
  };
}

interface SearchRoute {
  stages: FlowStage[];
  /** Keyword-only, meaning-only, both — after any fall-back. */
  finds: "keywords" | "meaning" | "both" | "nothing";
  fails: boolean;
  fallback: string | null;
  /** Why the rerank stage will return the fused order instead — or null when it runs or is not configured. */
  rerankFallback: string | null;
}

/** Retrieval, then the optional rerank stage after fusion — the backend's order (KnowledgeSearchService). */
function routeSearch(wiring: ProfileWiring, search: Profile, override?: Mode): SearchRoute {
  const route = routeRetrieval(wiring, search, override);
  const rerank = rerankStage(wiring, search, !route.fails);
  return { ...route, stages: [...route.stages, rerank.stage], rerankFallback: rerank.fallback };
}

/**
 * The rerank stage: off without one; otherwise it runs when its provider configuration declares RERANK,
 * is in force and holds a key. When it cannot, the search still answers in the fused order (amber).
 */
function rerankStage(
  wiring: ProfileWiring,
  search: Profile,
  reached: boolean,
): { stage: FlowStage; fallback: string | null } {
  if (!hasRerank(search)) {
    return {
      stage: stage(
        "rerank",
        "rerank",
        "off",
        translate("profiles.flow.rerank.none", "No rerank stage — results keep the fused order"),
      ),
      fallback: null,
    };
  }
  if (!reached) {
    return { stage: stage("rerank", "rerank", "off", neverReached()), fallback: null };
  }
  const configuration = search.configuration;
  const candidates = number(valueAt(configuration, "retrieval.rerank.candidates"));
  const keep = number(valueAt(configuration, "retrieval.rerank.keep"));
  const model = text(valueAt(configuration, "retrieval.rerank.model"));
  const timeout = number(valueAt(configuration, "retrieval.rerank.timeoutMilliseconds"));
  const systemTimeout = wiring.settings?.["search.maximum-rerank-milliseconds"];
  const deadline =
    timeout === null
      ? null
      : systemTimeout === undefined
        ? timeout
        : Math.min(timeout, systemTimeout);
  const shape = [
    translate("profiles.flow.rerank.shape", "first {candidates} candidates → keeps {keep}", {
      candidates: candidates ?? "?",
      keep: keep ?? "?",
    }),
    model === null ? null : translate("profiles.flow.rerank.model", "model {model}", { model }),
    deadline === null ? null : `${deadline} ms`,
  ]
    .filter(Boolean)
    .join(" · ");
  const verdict = rerankVerdict(wiring, search);
  if (verdict.tone === "deny") {
    const reason = inSentence(verdict.text);
    return {
      stage: stage("rerank", "rerank", "falls-back", butBecause(shape, reason), {
        consequence: translate(
          "profiles.flow.rerank.fallsBack",
          "Falls back to the fused order — the search still answers",
        ),
        fix: providersFix(),
      }),
      fallback: reason,
    };
  }
  return { stage: stage("rerank", "rerank", "runs", `${verdict.text} · ${shape}`), fallback: null };
}

function neverReached(): string {
  return translate("profiles.flow.neverReached", "Never reached");
}

/** "mode HYBRID, but no embedding profile is named" — a setting, and what stops it. */
function butBecause(setting: string, reason: string): string {
  return translate("profiles.flow.but", "{setting}, but {reason}", { setting, reason });
}

function routeRetrieval(
  wiring: ProfileWiring,
  search: Profile,
  override?: Mode,
): Omit<SearchRoute, "rerankFallback"> {
  const configuration = search.configuration;
  const { requested, selected } = modeOf(search, override);
  const routing = translate("profiles.flow.mode", "mode {mode}", {
    mode: requested === "AUTO" ? `AUTO → ${selected}` : requested,
  });
  const unavailablePolicy = text(valueAt(configuration, "retrieval.unavailablePolicy")) ?? "FAIL";
  const queryMode = text(configuration.queryMode) ?? "PLAIN";
  const analyzers = Array.isArray(configuration.analyzers)
    ? (configuration.analyzers as unknown[]).join(", ")
    : "simple";
  const query = queryNote(queryMode, analyzers);
  const characters = number(configuration.maximumQueryCharacters);
  const stages: FlowStage[] = [
    stage(
      "question",
      "question",
      "runs",
      characters === null
        ? translate("profiles.flow.question.any", "Any question the profile accepts")
        : translate("profiles.flow.question.upTo", "Up to {count} characters", { count: characters }),
    ),
  ];
  const oneList = () => translate("profiles.flow.fusion.oneList", "One list — nothing to combine");

  if (selected === "LEXICAL") {
    stages.push(stage("keywords", "keywords", "runs", `${routing} · ${query}`));
    stages.push(
      stage(
        "meaning",
        "meaning",
        "off",
        translate("profiles.flow.meaning.keywordsOnly", "{routing} — this profile finds by keywords only", { routing }),
      ),
    );
    stages.push(stage("fusion", "fusion", "off", oneList()));
    return { stages, finds: "keywords", fails: false, fallback: null };
  }

  const obstacle = meaningObstacle(wiring, search);
  const tokens = number(valueAt(configuration, "retrieval.semantic.maximumQueryTokens"));
  const systemTokens = wiring.settings?.["search.maximum-query-embedding-tokens"];
  const tokenNote =
    tokens === null
      ? ""
      : ` · ${translate("profiles.flow.meaning.queryTokens", "up to {count} query tokens", {
          count: systemTokens === undefined ? tokens : Math.min(tokens, systemTokens),
        })}`;
  const distance = number(valueAt(configuration, "retrieval.semantic.maximumDistance"));
  const distanceNote =
    distance === null ? "" : ` · ${translate("profiles.flow.meaning.distance", "distance ≤ {distance}", { distance })}`;

  if (obstacle === null) {
    if (selected === "HYBRID") {
      stages.push(stage("keywords", "keywords", "runs", `${routing} · ${query}`));
    } else {
      stages.push(
        stage(
          "keywords",
          "keywords",
          "off",
          translate("profiles.flow.keywords.meaningOnly", "{routing} — this profile finds by meaning only", { routing }),
        ),
      );
    }
    const emptied = meaningSearchEmptied(wiring, search);
    stages.push(
      stage(
        "meaning",
        "meaning",
        "runs",
        `${meaningSource(wiring, search)}${tokenNote}${distanceNote}`,
        emptied === null
          ? {}
          : {
              consequence: translate("profiles.flow.meaning.noHits", "Returns no hits — {reason}", { reason: emptied }),
              fix: editFix("search", search),
            },
      ),
    );
    if (selected === "HYBRID") {
      const strategy =
        text(valueAt(configuration, "retrieval.fusion.strategy")) ?? "RECIPROCAL_RANK";
      const fusionNote =
        strategy === "WEIGHTED_SCORE"
          ? translate("profiles.flow.fusion.weighted", "Weighted scores · keywords {keywords} / meaning {meaning}", {
              keywords: number(valueAt(configuration, "retrieval.fusion.lexicalWeight")) ?? "?",
              meaning: number(valueAt(configuration, "retrieval.fusion.semanticWeight")) ?? "?",
            })
          : translate("profiles.flow.fusion.reciprocal", "Reciprocal rank · k = {constant}", {
              constant: number(valueAt(configuration, "retrieval.fusion.rankConstant")) ?? "?",
            });
      stages.push(stage("fusion", "fusion", "runs", fusionNote));
      return { stages, finds: "both", fails: false, fallback: null };
    }
    stages.push(stage("fusion", "fusion", "off", oneList()));
    return { stages, finds: "meaning", fails: false, fallback: null };
  }

  // Meaning search cannot run: the profile's unavailable policy decides between keywords and failing.
  if (unavailablePolicy === "LEXICAL") {
    stages.push(
      stage(
        "keywords",
        "keywords",
        "runs",
        translate("profiles.flow.keywords.inPlace", "Runs in place of meaning search · {query}", { query }),
      ),
    );
    stages.push(
      stage("meaning", "meaning", "falls-back", butBecause(routing, obstacle.reason), {
        consequence: translate(
          "profiles.flow.meaning.fallsBack",
          "Falls back to keyword search (unavailable policy: LEXICAL)",
        ),
        fix: obstacle.fix,
      }),
    );
    stages.push(
      stage("fusion", "fusion", "off", translate("profiles.flow.fusion.afterFallBack", "One list after the fall-back")),
    );
    return { stages, finds: "keywords", fails: false, fallback: obstacle.reason };
  }
  stages.push(
    stage(
      "keywords",
      "keywords",
      selected === "HYBRID" ? "cannot-run" : "off",
      selected === "HYBRID"
        ? translate("profiles.flow.keywords.searchFailsFirst", "Never reached — the search fails first")
        : translate("profiles.flow.keywords.meaningOnlyShort", "{routing} — meaning only", { routing }),
    ),
  );
  stages.push(
    stage("meaning", "meaning", "cannot-run", butBecause(routing, obstacle.reason), {
      consequence: translate("profiles.flow.meaning.searchFails", "The search fails (unavailable policy: FAIL)"),
      fix: obstacle.fix,
    }),
  );
  stages.push(stage("fusion", "fusion", "off", neverReached()));
  return { stages, finds: "nothing", fails: true, fallback: obstacle.reason };
}

function searchSentence(route: SearchRoute, search: Profile): string {
  const plain = retrievalSentence(route);
  // With a rerank stage a provider is involved after all, so the keyword-only sentence must not deny it.
  const retrieval =
    hasRerank(search) && route.finds === "keywords" && route.fallback === null
      ? translate("profiles.flow.summary.keywordSearch", "Keyword search.")
      : plain;
  if (route.fails) {
    return retrieval;
  }
  if (route.rerankFallback !== null) {
    const rerank = translate("profiles.flow.summary.rerankFallsBack", "Reranking falls back to the fused order — {reason}.", {
      reason: route.rerankFallback,
    });
    return `${retrieval} ${rerank}`;
  }
  if (hasRerank(search)) {
    const candidates = number(valueAt(search.configuration, "retrieval.rerank.candidates"));
    const keep = number(valueAt(search.configuration, "retrieval.rerank.keep"));
    const rerank = translate(
      "profiles.flow.summary.rerank",
      "Then a rerank model reorders the first {candidates} and keeps the best {keep}.",
      { candidates: candidates ?? "?", keep: keep ?? "?" },
    );
    return `${retrieval} ${rerank}`;
  }
  return retrieval;
}

function retrievalSentence(route: SearchRoute): string {
  if (route.fails) {
    return translate("profiles.flow.summary.searchesFail", "Searches fail — meaning search is required, but {reason}.", {
      reason: route.fallback ?? "",
    });
  }
  if (route.fallback !== null) {
    return translate(
      "profiles.flow.summary.keywordsAfterFallBack",
      "Keyword search only — meaning search falls back because {reason}.",
      { reason: route.fallback },
    );
  }
  if (route.finds === "both") {
    return translate("profiles.flow.summary.both", "Finds by keywords and by meaning, and fuses the two lists.");
  }
  if (route.finds === "meaning") {
    return translate("profiles.flow.summary.meaningOnly", "Finds by meaning only — keywords are not consulted.");
  }
  return translate("profiles.flow.summary.keywordsOnly", "Keyword search only — no AI provider is involved.");
}

function resultStage(
  results: number | null,
  sentence: string,
  state: StageState = "runs",
): FlowStage {
  return stage(
    "result",
    "result",
    state,
    results === null
      ? sentence
      : `${sentence} · ${translate("profiles.flow.result.upToHits", "up to {count} hits", { count: results })}`,
  );
}

function disabledSummary(profile: Profile): string {
  return translate("profiles.flow.summary.disabled", "{name} is disabled — nothing runs through it.", { name: profile.name });
}

/** What a search through this profile does now. `mode` is an override the caller may choose, if the profile allows it. */
export function planSearchFlow(
  wiring: ProfileWiring,
  search: Profile,
  mode?: Mode,
): ProfileFlowPlan {
  const route = routeSearch(wiring, search, mode);
  const results = number(search.configuration.defaultResults);
  const stages = [
    ...route.stages,
    route.fails
      ? resultStage(null, translate("profiles.flow.result.searchError", "An error — no hits"), "cannot-run")
      : resultStage(results, translate("profiles.flow.result.hits", "Ranked hits with excerpts and citations")),
  ];
  if (!isEnabled(search)) {
    return { summary: disabledSummary(search), outcome: "disabled", stages };
  }
  const emptied =
    route.finds !== "keywords" && route.finds !== "nothing"
      ? meaningSearchEmptied(wiring, search)
      : null;
  const degraded = route.fallback !== null || route.rerankFallback !== null || emptied !== null;
  const summary =
    emptied === null
      ? searchSentence(route, search)
      : `${searchSentence(route, search)} ${translate("profiles.flow.summary.findsNothing", "Meaning search finds nothing: {reason}.", { reason: emptied })}`;
  return { summary, outcome: route.fails ? "fails" : degraded ? "degraded" : "works", stages };
}

/** What an answer through this profile does now: its search, its context and its model. */
export function planAnswerFlow(wiring: ProfileWiring, answer: Profile): ProfileFlowPlan {
  const configuration = answer.configuration;
  const search = findProfile(wiring, "search", text(configuration.searchProfileId));
  const context = findProfile(wiring, "context", text(configuration.contextProfileId));
  const stages: FlowStage[] = [];
  const sentences: string[] = [];
  let fails = false;
  let degraded = false;

  if (search === null || !isEnabled(search)) {
    stages.push(stage("question", "question", "runs", translate("profiles.flow.question.anything", "Any question")));
    stages.push(
      stage(
        "keywords",
        "search",
        "cannot-run",
        search === null
          ? translate("profiles.flow.answer.searchGone", "Its search profile no longer exists")
          : translate("profiles.flow.answer.searchDisabled", "Search profile {name} is disabled", { name: search.name }),
        {
          consequence: answerFails(),
          fix: search === null ? editFix("answer", answer) : editFix("search", search),
        },
      ),
    );
    fails = true;
    sentences.push(translate("profiles.flow.summary.noSearch", "Answers fail — there is no usable search profile."));
  } else {
    const route = routeSearch(wiring, search);
    stages.push(...route.stages);
    if (route.fails) {
      fails = true;
    }
    if (route.fallback !== null || route.rerankFallback !== null) {
      degraded = true;
    }
    const sentence = searchSentence(route, search);
    sentences.push(`${search.name}: ${inSentence(sentence)}`);
  }

  if (context === null || !isEnabled(context)) {
    stages.push(
      stage(
        "context",
        "context",
        "cannot-run",
        context === null
          ? translate("profiles.flow.answer.contextGone", "Its context profile no longer exists")
          : translate("profiles.flow.answer.contextDisabled", "Context profile {name} is disabled", { name: context.name }),
        {
          consequence: answerFails(),
          fix: context === null ? editFix("answer", answer) : editFix("context", context),
        },
      ),
    );
    fails = true;
  } else {
    const read = findProfile(wiring, "read", text(context.configuration.readProfileId));
    const fragments = number(context.configuration.maximumFragments);
    const characters = number(context.configuration.maximumCodePoints);
    if (read === null || !isEnabled(read)) {
      stages.push(
        stage(
          "context",
          "context",
          "cannot-run",
          read === null
            ? translate("profiles.flow.answer.readGone", "{context}: its read profile no longer exists", {
                context: context.name,
              })
            : translate("profiles.flow.answer.readDisabled", "{context}: read profile {name} is disabled", {
                context: context.name,
                name: read.name,
              }),
          {
            consequence: answerFails(),
            fix: editFix("context", context),
          },
        ),
      );
      fails = true;
    } else {
      const parts = [
        context.name,
        translate("profiles.flow.context.readsWith", "reads with {name}", { name: read.name }),
        fragments === null
          ? null
          : translate("profiles.flow.context.passages", "up to {count} passages", { count: fragments }),
        characters === null
          ? null
          : translate("profiles.flow.context.characters", "{count} characters", { count: characters }),
      ];
      stages.push(stage("context", "context", "runs", parts.filter(Boolean).join(" · ")));
    }
  }

  const model = modelStage(wiring, answer);
  stages.push(model.stage);
  if (model.stage.state === "cannot-run") {
    fails = true;
  }
  if (model.stage.state === "falls-back") {
    degraded = true;
  }
  sentences.push(model.sentence);
  stages.push(
    fails
      ? resultStage(null, translate("profiles.flow.result.answerError", "An error — no answer"), "cannot-run")
      : resultStage(
          null,
          model.writes
            ? translate("profiles.flow.result.writtenAnswer", "A written answer with verified citations")
            : translate("profiles.flow.result.sourcesOnly", "Verified sources, no written answer"),
        ),
  );

  if (!isEnabled(answer)) {
    return { summary: disabledSummary(answer), outcome: "disabled", stages };
  }
  return {
    summary: sentences.join(" "),
    outcome: fails ? "fails" : degraded ? "degraded" : "works",
    stages,
  };
}

function modelStage(
  wiring: ProfileWiring,
  answer: Profile,
): { stage: FlowStage; sentence: string; writes: boolean } {
  const configuration = answer.configuration;
  const systemCalls = wiring.settings?.["answer.maximum-calls"];
  const profileCalls = number(configuration.maximumCalls);
  const configurationId = text(configuration.providerConfigurationId);
  const unavailableChat = text(configuration.unavailableChat) ?? "SOURCES_ONLY";
  if (systemCalls === 0) {
    return {
      stage: stage(
        "model",
        "model",
        "off",
        translate(
          "profiles.flow.model.installationOff",
          "Model calls are switched off for the installation (answer.maximum-calls = 0)",
        ),
        {
          consequence: sourcesOnly(),
          fix: settingsFix(),
        },
      ),
      sentence: translate(
        "profiles.flow.summary.installationOff",
        "Answers return sources without a model — model calls are switched off for the installation.",
      ),
      writes: false,
    };
  }
  if (profileCalls === 0) {
    return {
      stage: stage(
        "model",
        "model",
        "off",
        translate("profiles.flow.model.profileOff", "This profile makes no model call (maximum calls 0)"),
        { consequence: sourcesOnly(), fix: editFix("answer", answer) },
      ),
      sentence: translate("profiles.flow.summary.profileOff", "Answers return sources without a model, by this profile's choice."),
      writes: false,
    };
  }
  if (configurationId === null) {
    return {
      stage: stage("model", "model", "off", translate("profiles.flow.model.noChat", "No chat provider chosen"), {
        consequence: sourcesOnly(),
        fix: editFix("answer", answer, translate("profiles.flow.fix.chooseChat", "Choose a chat provider")),
      }),
      sentence: translate(
        "profiles.flow.summary.noChat",
        "Answers return sources without a model — no chat provider is chosen.",
      ),
      writes: false,
    };
  }
  const verdict = providerVerdict(wiring, configurationId, "CHAT");
  if (verdict.tone === "allow") {
    const outputTokens = number(configuration.maximumOutputTokens);
    const parts = [
      verdict.text,
      outputTokens === null
        ? null
        : translate("profiles.flow.model.outputTokens", "up to {count} output tokens", { count: outputTokens }),
      translate("profiles.flow.model.oneTurn", "one turn, no tools"),
    ];
    const provider = findProvider(wiring, configurationId);
    return {
      stage: stage("model", "model", "runs", parts.filter(Boolean).join(" · ")),
      sentence: translate("profiles.flow.summary.writtenBy", "Answers are written by {provider}.", {
        provider: provider === null ? verdict.text : providerLabel(provider),
      }),
      writes: true,
    };
  }
  if (verdict.tone === "neutral") {
    return {
      stage: stage("model", "model", "runs", verdict.text),
      sentence: translate(
        "profiles.flow.summary.writtenByChosen",
        "Answers are written by the chosen chat provider, if it is in force.",
      ),
      writes: true,
    };
  }
  const reason = inSentence(verdict.text);
  const chat = translate("profiles.flow.model.chat", "Chat: {reason}", { reason });
  if (unavailableChat === "SOURCES_ONLY") {
    return {
      stage: stage("model", "model", "falls-back", chat, {
        consequence: translate(
          "profiles.flow.model.fallsBack",
          "Falls back to sources only (unavailable chat: SOURCES_ONLY)",
        ),
        fix: providersFix(),
      }),
      sentence: translate("profiles.flow.summary.chatFallsBack", "Answers return sources without a model — {reason}.", {
        reason,
      }),
      writes: false,
    };
  }
  return {
    stage: stage("model", "model", "cannot-run", chat, {
      consequence: translate("profiles.flow.model.fails", "The answer fails (unavailable chat: FAIL)"),
      fix: providersFix(),
    }),
    sentence: translate("profiles.flow.summary.chatFails", "Answers fail — {reason}.", { reason }),
    writes: false,
  };
}
