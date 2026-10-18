import type { ProviderConfiguration } from "../../lib/ai";
import type {
  CatalogueParameter,
  Profile,
  ProfileConfiguration,
  ProfileKind,
} from "../../lib/profiles";
import { translate } from "../../translations/translate";
import {
  startingConfiguration,
  valueAt,
  withSectionFilled,
  withValueAt,
} from "./configurationPaths";

// What each kind of profile needs beyond its catalogue: which sections are optional, which follow from
// another choice, and how a profile is summed up in a list. The catalogue says what can be set; this
// says how the settings depend on each other, so the editor keeps them consistent as they change.

/** Sections that may be null; the editor offers to switch them on and off. */
export const OPTIONAL_SECTIONS: Record<ProfileKind, string[]> = {
  processing: ["preparation.chunking", "preparation.indexing", "preparation.relations"],
  embedding: [],
  search: ["retrieval.semantic", "retrieval.fusion", "retrieval.rerank"],
  read: [],
  context: [],
  answer: [],
};

/** A section switched on only because another choice needs it, with the reason shown beside it. */
export interface RequiredSection {
  section: string;
  because: string;
}

function asList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function requiredSections(
  kind: ProfileKind,
  configuration: ProfileConfiguration,
): RequiredSection[] {
  if (kind === "processing") {
    const steps = asList(valueAt(configuration, "preparation.steps"));
    return [
      ...(steps.includes("chunk")
        ? [{ section: "preparation.chunking", because: translate("profiles.rules.chunkStepOn", "the chunk step is on") }]
        : []),
      ...(steps.includes("lexical")
        ? [{ section: "preparation.indexing", because: translate("profiles.rules.lexicalStepOn", "the lexical step is on") }]
        : []),
      ...(steps.includes("relations")
        ? [{ section: "preparation.relations", because: translate("profiles.rules.relationsStepOn", "the relations step is on") }]
        : []),
    ];
  }
  if (kind === "search") {
    const modes = [
      valueAt(configuration, "retrieval.mode"),
      valueAt(configuration, "retrieval.automaticMode"),
      ...asList(valueAt(configuration, "retrieval.allowedOverrides")),
    ];
    const needsSemantic = modes.some(
      (mode) => mode === "SEMANTIC" || mode === "HYBRID" || mode === "AUTO",
    );
    const needsFusion =
      modes.some((mode) => mode === "HYBRID") ||
      (valueAt(configuration, "retrieval.mode") === "AUTO" &&
        valueAt(configuration, "retrieval.automaticMode") === "HYBRID");
    return [
      ...(needsSemantic
        ? [{ section: "retrieval.semantic", because: translate("profiles.rules.vectorMode", "a mode searches by vectors") }]
        : []),
      ...(needsFusion
        ? [{ section: "retrieval.fusion", because: translate("profiles.rules.hybridMode", "a hybrid mode merges two rankings") }]
        : []),
    ];
  }
  return [];
}

/** A setting another choice makes irrelevant: shown, not editable, with the reason beside it. */
export interface OverriddenParameter {
  path: string;
  because: string;
}

/** The chunk settings that only shape how small units are merged; keeping units as parsed merges nothing. */
const MERGING_ONLY_SETTINGS = [
  "preparation.chunking.entryUnit",
  "preparation.chunking.tableUnit",
  "preparation.chunking.maximumTableRowsPerFragment",
];

export function overriddenParameters(
  kind: ProfileKind,
  configuration: ProfileConfiguration,
): OverriddenParameter[] {
  if (kind !== "processing" || valueAt(configuration, "preparation.chunking.unitMerging") !== "AS_PARSED") {
    return [];
  }
  const because = translate(
    "profiles.rules.asParsedOverrides",
    "Not used while units are kept as parsed: every row, value and paragraph the parser found is already a chunk of its own. Choose MERGE_SMALL to use it.",
  );
  return MERGING_ONLY_SETTINGS.map((path) => ({ path, because }));
}

const PROTOCOL_OF_PROVIDER: Record<string, string> = {
  voyage: "VOYAGE",
  ollama: "OLLAMA",
  tei: "TEI",
};

/** The rerank wire format each provider speaks: Cohere's v2 shape also serves Jina and a gateway. */
const RERANK_PROTOCOL_OF_PROVIDER: Record<string, string> = {
  voyage: "VOYAGE",
  tei: "TEI",
  cohere: "COHERE",
  jina: "COHERE",
  gateway: "COHERE",
};

/**
 * Keeps a configuration consistent after a change: optional sections the choices need are filled from
 * the catalogue, ones nothing needs any more are cleared, and an embedding profile speaks the protocol
 * of the provider it names.
 */
export function reconcile(
  kind: ProfileKind,
  configuration: ProfileConfiguration,
  parameters: CatalogueParameter[],
  providers: ProviderConfiguration[],
): ProfileConfiguration {
  let next = configuration;
  const needed = new Set(requiredSections(kind, next).map((required) => required.section));
  for (const section of OPTIONAL_SECTIONS[kind]) {
    const present = valueAt(next, section);
    const hasValue = present !== null && present !== undefined;
    if (needed.has(section) && !hasValue) {
      next = withSectionFilled(next, section, parameters);
    } else if (!needed.has(section) && hasValue && kind === "processing") {
      // A processing section without its step is refused by the server, so it goes with the step.
      next = withValueAt(next, section, null);
    }
  }
  if (kind === "embedding") {
    const provider = providers.find(
      (candidate) => candidate.id === valueAt(next, "providerConfigurationId"),
    );
    if (provider !== undefined) {
      next = withValueAt(next, "protocol", PROTOCOL_OF_PROVIDER[provider.provider] ?? "OPENAI");
    }
  }
  if (
    kind === "search" &&
    valueAt(next, "retrieval.rerank") !== null &&
    valueAt(next, "retrieval.rerank") !== undefined
  ) {
    const provider = providers.find(
      (candidate) => candidate.id === valueAt(next, "retrieval.rerank.providerConfigurationId"),
    );
    const protocol =
      provider === undefined ? undefined : RERANK_PROTOCOL_OF_PROVIDER[provider.provider];
    if (protocol !== undefined) {
      next = withValueAt(next, "retrieval.rerank.protocol", protocol);
    }
  }
  return next;
}

const APPROXIMATE_TOKENS_PATH = "retrieval.semantic.allowApproximateTokens";

/**
 * When meaning search is switched on or its embedding profile changes, a search profile admits approximate
 * token counts if that embedding profile can only estimate them — otherwise every question would be refused
 * before the model is called. An exact tokenizer leaves the choice as it was; the backend's own suggestion
 * (false) stays the conservative default. Returns the configuration and, when it changed the value, why.
 */
export function alignApproximateTokens(
  previous: ProfileConfiguration,
  next: ProfileConfiguration,
  embeddingProfiles: Profile[],
): { configuration: ProfileConfiguration; note: string | null } {
  const section = valueAt(next, "retrieval.semantic");
  if (section === null || section === undefined) {
    return { configuration: next, note: null };
  }
  const previousSection = valueAt(previous, "retrieval.semantic");
  const embeddingId = valueAt(next, "retrieval.semantic.embeddingProfileId");
  const switchedOn = previousSection === null || previousSection === undefined;
  const embeddingChanged =
    embeddingId !== valueAt(previous, "retrieval.semantic.embeddingProfileId");
  if (!switchedOn && !embeddingChanged) {
    return { configuration: next, note: null };
  }
  const embedding = embeddingProfiles.find((profile) => profile.id === embeddingId);
  if (
    embedding === undefined ||
    valueAt(embedding.configuration, "tokenizer.strategy") !== "CODE_POINT_ESTIMATE" ||
    valueAt(next, APPROXIMATE_TOKENS_PATH) === true
  ) {
    return { configuration: next, note: null };
  }
  return {
    configuration: withValueAt(next, APPROXIMATE_TOKENS_PATH, true),
    note: translate(
      "profiles.rules.approximateTokensSwitchedOn",
      "“Allow approximate tokens” was switched on: {name} only estimates tokens, and with exact counts required every meaning search would be refused.",
      { name: embedding.name },
    ),
  };
}

/** Where an embedding profile starts:its catalogue suggests nothing, so these are sane first limits. */
const EMBEDDING_START: ProfileConfiguration = {
  providerConfigurationId: "",
  protocol: "OPENAI",
  modelRevision: "1",
  dimensions: 1024,
  inputType: "DOCUMENT",
  inputPrefix: "",
  tokenizer: {
    strategy: "CODE_POINT_ESTIMATE",
    tokenizer: "code-point-estimate",
    tokenizerRevision: "1",
    endpoint: null,
    codePointsPerToken: 4,
    additionalTokensPerInput: 0,
  },
  callLimits: {
    maximumInputs: 64,
    maximumInputCodePoints: 32000,
    maximumTotalCodePoints: 500000,
    timeoutMilliseconds: 30000,
    maximumResponseBytes: 16777216,
  },
  maximumChunks: 1000,
  maximumTotalCodePoints: 5000000,
  maximumTokens: 2000000,
  maximumCost: null,
  pricing: null,
  statementMilliseconds: 2000,
  maximumDurationMilliseconds: 300000,
  scriptGroupIds: [],
  enabled: true,
};

export function newConfiguration(
  kind: ProfileKind,
  parameters: CatalogueParameter[],
  suggestedInstructions: string | null,
): ProfileConfiguration {
  if (kind === "embedding") {
    return structuredClone(EMBEDDING_START);
  }
  let configuration = startingConfiguration(parameters, OPTIONAL_SECTIONS[kind]);
  for (const section of OPTIONAL_SECTIONS[kind]) {
    configuration = withValueAt(configuration, section, null);
  }
  if (kind === "answer" && suggestedInstructions !== null) {
    configuration = withValueAt(configuration, "systemInstructions", suggestedInstructions);
  }
  if (kind === "answer") {
    configuration = withValueAt(configuration, "providerConfigurationId", null);
  }
  return reconcile(kind, configuration, parameters, []);
}

/** A profile in one line, for the list: the few settings that tell two profiles apart. */
/** The same settings as one line, for a place that can only hold text — a title, a log line, a tooltip. */
export function summarise(kind: ProfileKind, configuration: ProfileConfiguration): string {
  return summariseParts(kind, configuration).join(" · ");
}

/**
 * What a profile is set to, one setting per entry: the parser it reads with, the steps it runs, the sizes it keeps
 * to. They are drawn as tokens rather than as a sentence — each is a setting somebody can point at, and a row of
 * them scans where a dot-joined line has to be read.
 */
export function summariseParts(kind: ProfileKind, configuration: ProfileConfiguration): string[] {
  const read = (path: string) => valueAt(configuration, path);
  switch (kind) {
    case "processing": {
      const steps = asList(read("preparation.steps"));
      const chunk = read("preparation.chunking.maximumCodePoints");
      return [
        `${String(read("parserId"))}`,
        steps.join(" → "),
        typeof chunk === "number" ? translate("profiles.rules.summary.chunks", "chunks of {size}", { size: chunk }) : null,
      ]
        .filter((part): part is string => Boolean(part));
    }
    case "embedding":
      return [
        String(read("protocol")),
        translate("profiles.rules.summary.dimensions", "{dimensions} dimensions", { dimensions: String(read("dimensions")) }),
        translate("profiles.rules.summary.input", "{type} input", { type: String(read("inputType")).toLowerCase() }),
      ];
    case "search":
      return [
        `${String(read("retrieval.mode") ?? "LEXICAL").toLowerCase()}`,
        translate("profiles.rules.summary.query", "{mode} query", { mode: String(read("queryMode")).toLowerCase() }),
        translate("profiles.rules.summary.results", "{count} results", { count: String(read("defaultResults")) }),
        read("retrieval.rerank") === null || read("retrieval.rerank") === undefined
          ? null
          : translate("profiles.rules.summary.reranks", "reranks {count}", { count: String(read("retrieval.rerank.candidates")) }),
      ]
        .filter((part): part is string => Boolean(part));
    case "read":
      return [
        translate("profiles.rules.summary.readSize", "{count} characters a read", { count: String(read("defaultCodePoints")) }),
        read("allowHistoricalVersions") === true
          ? translate("profiles.rules.summary.oldVersions", "old versions allowed")
          : translate("profiles.rules.summary.currentOnly", "current version only"),
      ];
    case "context":
      return [
        String(read("assembly")).toLowerCase().replace("_", " "),
        translate("profiles.rules.summary.fragments", "{count} fragments", { count: String(read("maximumFragments")) }),
        translate("profiles.rules.summary.radius", "radius {radius}", { radius: String(read("neighborRadius")) }),
      ];
    case "answer":
      return [
        read("providerConfigurationId") === null
          ? translate("profiles.rules.summary.sourcesOnly", "sources only")
          : translate("profiles.rules.summary.modelWrites", "model writes the answer"),
        translate("profiles.rules.summary.outputTokens", "{count} output tokens", { count: String(read("maximumOutputTokens")) }),
      ];
  }
}
