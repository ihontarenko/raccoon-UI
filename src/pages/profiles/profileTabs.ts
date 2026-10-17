import type { CatalogueParameter, ProfileConfiguration, ProfileKind } from "../../lib/profiles";
import { declareText, type DeclaredText } from "../../translations/translate";

// How a profile's settings are split across tabs: by the stage of work they decide, so a long form becomes a few short
// ones. A tab claims configuration paths; a parameter or a change belongs to the first tab that claims its path, and
// whatever no tab claims lands on General — a field the catalogue adds later can never fall out of the editor.

/** The tabs a settings page has beside its settings: who uses the profile, and its saved revisions. */
export type ProfileRecordTab = "used-by" | "history";

export interface SettingsTab {
  key: string;
  label: DeclaredText;
  /** Paths the tab holds: a path itself, everything beneath it, and a section a held path sits in. */
  claims: string[];
}

const GENERAL: SettingsTab = {
  key: "general",
  label: declareText("profiles.tab.general", "General"),
  claims: ["enabled", "scriptGroupIds", "preparation.scriptGroupIds"],
};

function settingsTab(key: string, label: DeclaredText, claims: string[]): SettingsTab {
  return { key, label, claims };
}

const SETTINGS_TABS: Record<ProfileKind, SettingsTab[]> = {
  processing: [
    { ...GENERAL, claims: [...GENERAL.claims, "preparation.steps"] },
    settingsTab("parsing", declareText("profiles.tab.parsing", "Parsing"), [
      "parserId",
      "maximumCharacters",
      "maximumBlocks",
      "automaticParserIds",
      "parserOptions",
    ]),
    settingsTab("chunking", declareText("profiles.tab.chunking", "Chunking"), [
      "preparation.chunking",
    ]),
    settingsTab("content", declareText("profiles.tab.ruleSets", "Rule sets"), [
      "preparation.policyIds",
    ]),
    settingsTab("indexing", declareText("profiles.tab.indexing", "Indexing"), [
      "preparation.indexing",
    ]),
  ],
  search: [
    GENERAL,
    settingsTab("retrieval", declareText("profiles.tab.retrieval", "Retrieval"), [
      "retrieval.mode",
      "retrieval.allowedOverrides",
      "retrieval.automaticMode",
      "retrieval.unavailablePolicy",
      "backendId",
      "queryMode",
      "lexicalQuery",
      "recognition",
      "analyzers",
      "includeDocuments",
      "includeEditorial",
    ]),
    settingsTab("vectors", declareText("profiles.tab.vectors", "Vectors"), ["retrieval.semantic"]),
    settingsTab("ranking", declareText("profiles.tab.ranking", "Ranking"), [
      "retrieval.fusion",
      "ranking",
      "normalization",
      "minimumScore",
    ]),
    settingsTab("rerank", declareText("profiles.tab.rerank", "Rerank"), ["retrieval.rerank"]),
    settingsTab("limits", declareText("profiles.tab.limits", "Limits"), [
      "defaultResults",
      "maximumResults",
      "maximumQueryCharacters",
      "maximumExcerptCodePoints",
      "maximumResponseCodePoints",
      "statementMilliseconds",
    ]),
  ],
  embedding: [
    GENERAL,
    settingsTab("model", declareText("profiles.tab.model", "Model"), [
      "providerConfigurationId",
      "protocol",
      "modelRevision",
      "dimensions",
      "inputType",
      "inputPrefix",
    ]),
    settingsTab("tokenizer", declareText("profiles.tab.tokenizer", "Tokenizer"), ["tokenizer"]),
    settingsTab("calls", declareText("profiles.tab.calls", "Calls"), ["callLimits"]),
    settingsTab("budget", declareText("profiles.tab.budget", "Budget"), [
      "maximumChunks",
      "maximumTotalCodePoints",
      "maximumTokens",
      "maximumCost",
      "pricing",
      "statementMilliseconds",
      "maximumDurationMilliseconds",
    ]),
  ],
  context: [
    { ...GENERAL, claims: [...GENERAL.claims, "readProfileId"] },
    settingsTab("assembly", declareText("profiles.tab.assembly", "Assembly"), [
      "assembly",
      "maximumCandidates",
      "maximumFragments",
      "neighborRadius",
      "includeEditorial",
      "unavailableOriginal",
    ]),
    settingsTab("limits", declareText("profiles.tab.limits", "Limits"), [
      "maximumFragmentCodePoints",
      "maximumCodePoints",
      "statementMilliseconds",
    ]),
  ],
  read: [
    { ...GENERAL, claims: [...GENERAL.claims, "allowHistoricalVersions"] },
    settingsTab("limits", declareText("profiles.tab.limits", "Limits"), [
      "defaultCodePoints",
      "maximumCodePoints",
      "maximumOriginalBytes",
      "maximumOriginalCharacters",
    ]),
  ],
  answer: [
    { ...GENERAL, claims: [...GENERAL.claims, "allowEditorial"] },
    settingsTab("sources", declareText("profiles.tab.answerSources", "Search and context"), [
      "searchProfileId",
      "contextProfileId",
      "unavailableChat",
    ]),
    settingsTab("model", declareText("profiles.tab.model", "Model"), [
      "providerConfigurationId",
      "systemInstructions",
    ]),
    settingsTab("tokens", declareText("profiles.tab.tokens", "Tokens"), [
      "maximumPromptCodePoints",
      "maximumAnswerCodePoints",
      "maximumOutputTokens",
      "maximumEstimatedInputTokens",
      "maximumTotalTokens",
      "codePointsPerToken",
      "estimatedOverheadTokens",
      "allowApproximateTokens",
      "allowUnknownUsage",
    ]),
    settingsTab("limits", declareText("profiles.tab.limits", "Limits"), [
      "maximumResponseBytes",
      "maximumCalls",
      "maximumConcurrentCalls",
      "connectTimeoutMilliseconds",
      "timeoutMilliseconds",
      "maximumDurationMilliseconds",
    ]),
  ],
};

export function settingsTabsOf(kind: ProfileKind): SettingsTab[] {
  return SETTINGS_TABS[kind];
}

function claimsPath(claim: string, path: string): boolean {
  return path === claim || path.startsWith(`${claim}.`) || claim.startsWith(`${path}.`);
}

/** The tab a configuration path belongs to: the first that claims it, otherwise General. */
export function tabOfPath(tabs: SettingsTab[], path: string): string {
  const holder = tabs.find((tab) => tab.claims.some((claim) => claimsPath(claim, path)));
  return holder?.key ?? tabs[0].key;
}

/** The catalogue's parameters a tab draws, in catalogue order. */
export function parametersOfTab(
  tabs: SettingsTab[],
  tabKey: string,
  parameters: CatalogueParameter[],
): CatalogueParameter[] {
  return parameters.filter((parameter) => tabOfPath(tabs, parameter.path) === tabKey);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** The deepest paths at which two configurations differ; a list or a section that appears or goes is one path. */
export function changedPaths(saved: unknown, draft: unknown, prefix = ""): string[] {
  if (isPlainObject(saved) && isPlainObject(draft)) {
    const keys = new Set([...Object.keys(saved), ...Object.keys(draft)]);
    return [...keys].flatMap((key) =>
      changedPaths(saved[key], draft[key], prefix === "" ? key : `${prefix}.${key}`),
    );
  }
  if (JSON.stringify(saved) === JSON.stringify(draft)) {
    return [];
  }
  return [prefix];
}

/** The tabs holding unsaved changes. */
export function changedTabs(
  tabs: SettingsTab[],
  saved: ProfileConfiguration,
  draft: ProfileConfiguration,
): Set<string> {
  return new Set(changedPaths(saved, draft).map((path) => tabOfPath(tabs, path)));
}

/**
 * The parameter a server refusal names, if its words name one: the longest catalogue path, or a path's last segment,
 * found in the text. The refusal is then shown on the tab that holds it.
 */
export function parameterNamedBy(
  text: string,
  parameters: CatalogueParameter[],
): CatalogueParameter | null {
  const byLength = [...parameters].sort((first, second) => second.path.length - first.path.length);
  const whole = byLength.find((parameter) => text.includes(parameter.path));
  if (whole !== undefined) {
    return whole;
  }
  return (
    byLength.find((parameter) =>
      new RegExp(`\\b${parameter.path.slice(parameter.path.lastIndexOf(".") + 1)}\\b`).test(text),
    ) ?? null
  );
}
