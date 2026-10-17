import { api, collectAllPages } from "../../lib/api";
import { aiApi, type AiCapability, type ProviderConfiguration } from "../../lib/ai";
import { pipelineApi, type VectorGeneration } from "../../lib/pipeline";
import { PROFILE_KINDS, profilesApi, type Profile, type ProfileKind } from "../../lib/profiles";
import { declareText, translate, translateDeclared, translatePlural, type DeclaredText } from "../../translations/translate";
import { valueAt } from "./configurationPaths";

// How the profiles of a workspace connect: an embedding profile binds one AI provider configuration and
// one model; vectors are built per embedding profile; a search profile that finds by vectors names one
// embedding profile and only ever reads vectors of that model; an answer profile names a search profile,
// a context profile and, optionally, a chat provider. Everything here is read from what exists — nothing
// is assumed — so a link that cannot work is shown broken before somebody finds out from a failed search.

export interface ProfileWiring {
  profiles: Record<ProfileKind, Profile[]>;
  /** Null when the caller may not read the installation's provider configurations. */
  providers: ProviderConfiguration[] | null;
  /** Null when the caller may not read vector generations. */
  vectorGenerations: VectorGeneration[] | null;
  /** The installation's effective system settings by key; null when the caller may not read them. */
  settings: Record<string, number> | null;
}

async function orNothing<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch {
    return null;
  }
}

export async function loadProfileWiring(workspaceId: string): Promise<ProfileWiring> {
  const [lists, stored, generations, parameters] = await Promise.all([
    Promise.all(
      PROFILE_KINDS.map(async (description) => [description.kind, (await orNothing(() => collectAllPages((page) => profilesApi.list(workspaceId, description.kind, page)))) ?? []] as const),
    ),
    orNothing(() => aiApi.configurations()),
    orNothing(() => collectAllPages((page) => pipelineApi.vectorGenerations(workspaceId, page))),
    orNothing(() => api.listSystemParameters()),
  ]);
  return {
    profiles: Object.fromEntries(lists) as Record<ProfileKind, Profile[]>,
    providers: stored?.configurations ?? null,
    vectorGenerations: generations,
    settings: parameters === null ? null : Object.fromEntries(parameters.map((parameter) => [parameter.key, parameter.effectiveValue])),
  };
}

/** A judgement on one link: blue when it works, red when it cannot, grey when there is nothing to judge. */
export interface Verdict {
  tone: "allow" | "deny" | "neutral";
  text: string;
}

/** "… does not offer chat" — one sentence per capability, since its word inflects differently in each language. */
const CAPABILITY_MISSING: Record<AiCapability, DeclaredText> = {
  CHAT: declareText("profiles.wiring.noChat", "{provider} does not offer chat"),
  EMBEDDINGS: declareText("profiles.wiring.noEmbeddings", "{provider} does not offer embeddings"),
  RERANK: declareText("profiles.wiring.noReranking", "{provider} does not offer reranking"),
};

/** How a search profile finds, by its `retrieval.mode`. */
const SEARCH_MODES: Record<string, DeclaredText> = {
  LEXICAL: declareText("profiles.searchMode.lexical", "Keywords"),
  SEMANTIC: declareText("profiles.searchMode.semantic", "Vectors"),
  HYBRID: declareText("profiles.searchMode.hybrid", "Keywords and vectors"),
};

/** Providers that run without an account, so a missing key is how they are meant to be configured. */
const KEYLESS_PROVIDERS = new Set(["ollama", "tei"]);

const text = (value: unknown): string | null => (typeof value === "string" && value.length > 0 ? value : null);

export function isEnabled(profile: Profile): boolean {
  return profile.configuration.enabled !== false;
}

export function findProfile(wiring: ProfileWiring, kind: ProfileKind, profileId: string | null): Profile | null {
  if (profileId === null) {
    return null;
  }
  return wiring.profiles[kind].find((profile) => profile.id === profileId) ?? null;
}

export function findProvider(wiring: ProfileWiring, configurationId: string | null): ProviderConfiguration | null {
  if (configurationId === null || wiring.providers === null) {
    return null;
  }
  return wiring.providers.find((provider) => provider.id === configurationId) ?? null;
}

export function providerLabel(provider: ProviderConfiguration): string {
  return `${provider.provider} · ${provider.model}`;
}

/** "voyage · voyage-4-lite · 1024 dimensions" — or why the provider is not usable. */
export function embeddingSource(wiring: ProfileWiring, embedding: Profile): string {
  const configurationId = typeof embedding.configuration.providerConfigurationId === "string" ? embedding.configuration.providerConfigurationId : null;
  const provider = findProvider(wiring, configurationId);
  const dimensions =
    typeof embedding.configuration.dimensions === "number"
      ? ` · ${translate("profiles.wiring.dimensions", "{dimensions} dimensions", { dimensions: embedding.configuration.dimensions })}`
      : "";
  if (provider !== null) {
    return `${providerLabel(provider)}${dimensions}`;
  }
  const verdict = providerVerdict(wiring, configurationId, "EMBEDDINGS");
  if (verdict.tone !== "neutral") {
    return verdict.text;
  }
  const model = embedding.configuration.modelRevision ?? translate("profiles.wiring.model", "model");
  return `${String(model)}${dimensions}`;
}

/** Whether a provider configuration can serve a profile now: a model is only called through one in force. */
export function providerVerdict(wiring: ProfileWiring, configurationId: string | null, capability: AiCapability): Verdict {
  if (configurationId === null) {
    return { tone: "deny", text: translate("profiles.wiring.noProvider", "No provider chosen") };
  }
  if (wiring.providers === null) {
    return { tone: "neutral", text: translate("profiles.wiring.providersHidden", "Providers are not visible to you") };
  }
  const provider = findProvider(wiring, configurationId);
  if (provider === null) {
    return { tone: "deny", text: translate("profiles.wiring.providerRemoved", "Provider configuration was removed") };
  }
  const label = providerLabel(provider);
  if (!provider.capabilities.includes(capability)) {
    return { tone: "deny", text: translateDeclared(CAPABILITY_MISSING[capability], { provider: label }) };
  }
  if (!provider.active) {
    return { tone: "deny", text: translate("profiles.wiring.notInForce", "{provider} is not in force", { provider: label }) };
  }
  if (!provider.keyConfigured && !KEYLESS_PROVIDERS.has(provider.provider)) {
    return { tone: "deny", text: translate("profiles.wiring.noKey", "{provider} has no key", { provider: label }) };
  }
  return { tone: "allow", text: `${label} · ${inForce()}` };
}

/** Who writes an answer profile's answers: no model, a named chat provider, or why the named one is unusable. */
export function answerWriter(wiring: ProfileWiring, answer: Profile): string {
  const configurationId = text(answer.configuration.providerConfigurationId);
  if (configurationId === null) {
    return translate("profiles.wiring.sourcesOnly", "sources only, no model");
  }
  const provider = findProvider(wiring, configurationId);
  if (provider === null) {
    return providerVerdict(wiring, configurationId, "CHAT").text;
  }
  return translate("profiles.wiring.writtenBy", "written by {provider}", { provider: providerLabel(provider) });
}

/** "in force" — what a usable provider configuration is marked with. */
export function inForce(): string {
  return translate("profiles.wiring.inForce", "in force");
}

/** "key stored" — said of a provider configuration that holds its key. */
export function keyStored(): string {
  return translate("profiles.wiring.keyStored", "key stored");
}

/** "1 200 vectors", counted in the held language. */
export function vectorCount(count: number): string {
  return translatePlural("profiles.wiring.vectors", count, { one: "{count} vector", other: "{count} vectors" });
}

/** The published vector generations built with this embedding profile's model — the only ones its searches read. */
export function publishedVectorsOf(wiring: ProfileWiring, embedding: Profile): VectorGeneration[] | null {
  if (wiring.vectorGenerations === null) {
    return null;
  }
  const configurationId = text(embedding.configuration.providerConfigurationId);
  const modelRevision = text(embedding.configuration.modelRevision);
  const dimensions = embedding.configuration.dimensions;
  return wiring.vectorGenerations.filter(
    (generation) =>
      generation.state === "PUBLISHED" &&
      generation.model.configurationId === configurationId &&
      generation.model.modelRevision === modelRevision &&
      generation.model.dimensions === dimensions,
  );
}

export function vectorsVerdict(wiring: ProfileWiring, embedding: Profile): Verdict {
  const published = publishedVectorsOf(wiring, embedding);
  if (published === null) {
    return { tone: "neutral", text: translate("profiles.wiring.generationsHidden", "Vector generations are not visible to you") };
  }
  if (published.length === 0) {
    return { tone: "deny", text: translate("profiles.wiring.noPublishedVectors", "No published vectors for this model yet") };
  }
  const records = published.reduce((sum, generation) => sum + generation.storedRecords - generation.removedRecords, 0);
  const generations = translatePlural("profiles.wiring.publishedGenerations", published.length, {
    one: "{count} published generation",
    other: "{count} published generations",
  });
  return {
    tone: "allow",
    text: translate("profiles.wiring.vectorsInGenerations", "{vectors} in {generations}", { vectors: vectorCount(records), generations }),
  };
}

/** How a search profile finds: by keywords, by vectors, or both. */
export function searchMode(search: Profile): string {
  const mode = text(valueAt(search.configuration, "retrieval.mode")) ?? "LEXICAL";
  if (mode === "AUTO") {
    const automatic = text(valueAt(search.configuration, "retrieval.automaticMode")) ?? "LEXICAL";
    return translate("profiles.searchMode.automatic", "Automatic ({mode})", { mode: searchModeName(automatic).toLowerCase() });
  }
  return searchModeName(mode);
}

function searchModeName(mode: string): string {
  const declared = SEARCH_MODES[mode];
  if (declared === undefined) {
    return mode.toLowerCase();
  }
  return translateDeclared(declared);
}

export function usesVectors(search: Profile): boolean {
  const modes = [valueAt(search.configuration, "retrieval.mode"), valueAt(search.configuration, "retrieval.automaticMode")];
  return modes.some((mode) => mode === "SEMANTIC" || mode === "HYBRID");
}

/** Whether a search profile reorders its fused results with a rerank model. */
export function hasRerank(search: Profile): boolean {
  const stage = valueAt(search.configuration, "retrieval.rerank");
  return stage !== null && typeof stage === "object";
}

/**
 * Whether the rerank stage can run now — its provider configuration declares RERANK, is in force and holds
 * a key — said with the facts that decide it. A stage that cannot run never fails the search; it falls back.
 */
export function rerankVerdict(wiring: ProfileWiring, search: Profile): Verdict {
  const configurationId = text(valueAt(search.configuration, "retrieval.rerank.providerConfigurationId"));
  const verdict = providerVerdict(wiring, configurationId, "RERANK");
  const provider = findProvider(wiring, configurationId);
  if (verdict.tone !== "allow" || provider === null) {
    return verdict;
  }
  const key = KEYLESS_PROVIDERS.has(provider.provider) ? translate("profiles.wiring.noKeyNeeded", "no key needed") : keyStored();
  const declares = translate("profiles.wiring.declaresRerank", "declares RERANK");
  return { tone: "allow", text: `${providerLabel(provider)} · ${inForce()} · ${key} · ${declares}` };
}

export function embeddingOfSearch(wiring: ProfileWiring, search: Profile): Profile | null {
  return findProfile(wiring, "embedding", text(valueAt(search.configuration, "retrieval.semantic.embeddingProfileId")));
}

/** Everything that keeps a profile from working, in the words a person would act on. */
export function problemsOf(wiring: ProfileWiring, kind: ProfileKind, profile: Profile): string[] {
  const problems: string[] = [];
  const configuration = profile.configuration;
  if (kind === "embedding") {
    const provider = providerVerdict(wiring, text(configuration.providerConfigurationId), "EMBEDDINGS");
    if (provider.tone === "deny") {
      problems.push(provider.text);
    }
  }
  if (kind === "search" && usesVectors(profile)) {
    const embeddingId = text(valueAt(configuration, "retrieval.semantic.embeddingProfileId"));
    const embedding = embeddingOfSearch(wiring, profile);
    if (embeddingId === null) {
      problems.push(translate("profiles.wiring.namesNoEmbedding", "Finds by vectors but names no embedding profile"));
    } else if (embedding === null) {
      problems.push(translate("profiles.wiring.embeddingGone", "Its embedding profile no longer exists"));
    } else {
      if (!isEnabled(embedding)) {
        problems.push(translate("profiles.wiring.embeddingDisabled", "Embedding profile {name} is disabled", { name: embedding.name }));
      }
      problems.push(...problemsOf(wiring, "embedding", embedding).map((problem) => `${embedding.name}: ${problem}`));
      const vectors = vectorsVerdict(wiring, embedding);
      if (vectors.tone === "deny") {
        problems.push(`${embedding.name}: ${vectors.text}`);
      }
    }
  }
  if (kind === "context") {
    const read = findProfile(wiring, "read", text(configuration.readProfileId));
    if (read === null) {
      problems.push(translate("profiles.wiring.readGone", "Its read profile no longer exists"));
    } else if (!isEnabled(read)) {
      problems.push(translate("profiles.wiring.readDisabled", "Read profile {name} is disabled", { name: read.name }));
    }
  }
  if (kind === "answer") {
    const search = findProfile(wiring, "search", text(configuration.searchProfileId));
    const context = findProfile(wiring, "context", text(configuration.contextProfileId));
    if (search === null) {
      problems.push(translate("profiles.wiring.searchGone", "Its search profile no longer exists"));
    } else if (!isEnabled(search)) {
      problems.push(translate("profiles.wiring.searchDisabled", "Search profile {name} is disabled", { name: search.name }));
    } else {
      problems.push(...problemsOf(wiring, "search", search).map((problem) => `${search.name} → ${problem}`));
    }
    if (context === null) {
      problems.push(translate("profiles.wiring.contextGone", "Its context profile no longer exists"));
    } else if (!isEnabled(context)) {
      problems.push(translate("profiles.wiring.contextDisabled", "Context profile {name} is disabled", { name: context.name }));
    }
    const chat = text(configuration.providerConfigurationId);
    if (chat !== null) {
      const verdict = providerVerdict(wiring, chat, "CHAT");
      if (verdict.tone === "deny") {
        problems.push(verdict.text);
      }
    }
  }
  return problems;
}

/** One state for a list row: disabled, broken (with why), or ready. */
export function stateOf(wiring: ProfileWiring, kind: ProfileKind, profile: Profile): { verdict: Verdict; problems: string[] } {
  if (!isEnabled(profile)) {
    return { verdict: { tone: "neutral", text: translate("profiles.state.disabled", "Disabled") }, problems: [] };
  }
  const problems = problemsOf(wiring, kind, profile);
  if (problems.length === 0) {
    return { verdict: { tone: "allow", text: translate("profiles.state.ready", "Ready") }, problems };
  }
  return { verdict: { tone: "deny", text: translate("profiles.state.broken", "Broken") }, problems };
}

export interface ProfileLink {
  kind: ProfileKind;
  profile: Profile;
}

/** Which profiles name this one. */
export function usedBy(wiring: ProfileWiring, kind: ProfileKind, profileId: string): ProfileLink[] {
  const naming = (otherKind: ProfileKind, path: string): ProfileLink[] =>
    wiring.profiles[otherKind].filter((profile) => valueAt(profile.configuration, path) === profileId).map((profile) => ({ kind: otherKind, profile }));
  switch (kind) {
    case "embedding":
      return naming("search", "retrieval.semantic.embeddingProfileId");
    case "read":
      return naming("context", "readProfileId");
    case "search":
      return naming("answer", "searchProfileId");
    case "context":
      return naming("answer", "contextProfileId");
    default:
      return [];
  }
}

/** "Used by 2 search profiles" — or where a kind is used when nothing names it by identifier. */
export function usedBySentence(wiring: ProfileWiring, kind: ProfileKind, profileId: string): string {
  if (kind === "processing") {
    return translate(
      "profiles.wiring.processingChosen",
      "Chosen when a document is processed, by hand or by a source's automatic preparation.",
    );
  }
  if (kind === "answer") {
    return translate("profiles.wiring.answerChosen", "Chosen when somebody asks a question, here or through an assistant.");
  }
  const links = usedBy(wiring, kind, profileId);
  if (links.length === 0) {
    if (kind === "embedding") {
      return translate("profiles.wiring.vectorsUnread", "No search profile reads its vectors yet.");
    }
    return translate("profiles.wiring.unused", "Nothing uses it yet.");
  }
  const otherKind = links[0]?.kind ?? kind;
  const names = links.map((link) => link.profile.name).join(", ");
  // Only these three kinds name another profile; each gets its own sentence so the kind's word can inflect.
  switch (otherKind) {
    case "search":
      return translatePlural(
        "profiles.wiring.usedBySearch",
        links.length,
        { one: "Used by {count} search profile: {names}.", other: "Used by {count} search profiles: {names}." },
        { names },
      );
    case "context":
      return translatePlural(
        "profiles.wiring.usedByContext",
        links.length,
        { one: "Used by {count} context profile: {names}.", other: "Used by {count} context profiles: {names}." },
        { names },
      );
    default:
      return translatePlural(
        "profiles.wiring.usedByAnswer",
        links.length,
        { one: "Used by {count} answer profile: {names}.", other: "Used by {count} answer profiles: {names}." },
        { names },
      );
  }
}
