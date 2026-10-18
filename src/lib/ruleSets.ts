// Rule sets: named, revisioned lists of rules — one rule shape for every stage, at the door of the corpus and inside the
// pipeline alike. A rule sees a fragment with facts about it (a material, a block, a chunk, a piece of text), decides or
// rewrites, and its stage says which fragment that is. A source binds rule sets for their rules at the door; a processing
// profile binds them for their rules in the pipeline.
//
// Mirrors `rule sets/*` on the server: `PolicyRule`, `PolicyCondition`, `PolicyAction`, `PolicyStage`, `PolicyController`.

import { api, workspacePath } from "./api";
import type { SourceKind } from "./contracts";
import type { RulePreview } from "./sourceContracts";

/** Where a rule runs, named by what it sees. */
export type RuleStage =
  | "MATERIAL"
  | "BLOCKS"
  | "CHUNKS"
  | "KEYWORD_TEXT"
  | "EMBEDDING_TEXT"
  | "QUERY"
  | "SEMANTIC_EXTRACTION"
  | "RELATIONS";

/** The stages in the order a document meets them. */
export const RULE_STAGES: RuleStage[] = [
  "MATERIAL",
  "BLOCKS",
  "CHUNKS",
  "KEYWORD_TEXT",
  "EMBEDDING_TEXT",
  "QUERY",
  "SEMANTIC_EXTRACTION",
  "RELATIONS",
];

/** What binds a rule set for its rules at a stage to run. */
export type RuleSetHolder = "SOURCE" | "PROFILE";

/** Something a rule may ask about a fragment; which of them exist is the stage's to say. */
export type RuleFact =
  | "PATH"
  | "TITLE"
  | "MEDIA_TYPE"
  | "SOURCE_KIND"
  | "SIZE_BYTES"
  | "TEXT"
  | "BLOCK_KIND"
  | "PAGE"
  | "HEADING_LEVEL"
  | "POSITION"
  | "REPETITION"
  | "SEMANTIC_PROVIDER"
  | "ENTITY_KIND"
  | "RELATION_ROLE"
  | "FACT_ORIGIN"
  | "TARGET_NAMESPACE"
  | "TARGET_KEY";

export const NUMERIC_FACTS: RuleFact[] = [
  "SIZE_BYTES",
  "PAGE",
  "HEADING_LEVEL",
  "POSITION",
  "REPETITION",
];

export type FieldOperator =
  "EQUALS" | "PREFIX" | "SUFFIX" | "CONTAINS" | "GREATER_THAN" | "LESS_OR_EQUAL";
export type Normalisation =
  "WHITESPACE" | "UNICODE" | "NON_BREAKING_SPACES" | "QUOTES" | "HYPHENATION";
export type FailurePolicy = "STOP" | "IGNORE";

export type RuleCondition =
  | { type: "ALWAYS" }
  | { type: "FIELD"; fact: RuleFact; operator: FieldOperator; values: string[] }
  /** Globs over the material's path: `docs/**`, `*.md`, `node_modules/`. */
  | { type: "PATH"; patterns: string[] }
  | { type: "PATTERN"; patterns: string[] }
  | { type: "CONTAINS_WORDS"; words: string[] }
  | { type: "WORD_LIST"; words: string[] }
  | { type: "SHORTER_THAN"; characters: number }
  | { type: "LONGER_THAN"; characters: number }
  | { type: "REPEATS"; times: number; ignoreDigits: boolean }
  | { type: "SCRIPT"; script: string; failurePolicy: FailurePolicy }
  | { type: "ALL"; conditions: RuleCondition[] }
  | { type: "ANY"; conditions: RuleCondition[] }
  | { type: "NOT"; condition: RuleCondition };

export type ConditionType = RuleCondition["type"];

export type RuleAction =
  | { type: "KEEP" }
  | { type: "DROP" }
  | { type: "REVIEW" }
  | { type: "NORMALISE"; normalisations: Normalisation[] }
  | { type: "REPLACE"; patterns: string[]; replacement: string }
  | { type: "REMOVE_WORDS"; words: string[] }
  | { type: "DEFINE_ENTITY"; namespace: string; key: string; name: string; kind: string }
  | { type: "LINK_ENTITY"; role: string; namespace: string; key: string };

export type ActionType = RuleAction["type"];

/** The decisions an action can make; every other action rewrites the text. */
export const DECIDING_ACTIONS: ActionType[] = ["KEEP", "DROP", "REVIEW"];

export interface Rule {
  name: string;
  order: number;
  enabled: boolean;
  stage: RuleStage;
  condition: RuleCondition;
  action: RuleAction;
  /** Whether the rules after it still run on a fragment it acted on. */
  stopOnMatch: boolean;
}

export interface RuleSetConfiguration {
  rules: Rule[];
}

export interface RuleSetBinding {
  holder: RuleSetHolder;
  id: string;
  name: string;
}

export interface ListedRuleSet {
  id: string;
  name: string;
  revision: number;
  rules: number;
  /** The stages its rules run at, in pipeline order. */
  stages: RuleStage[];
  usedBy: RuleSetBinding[];
}

export interface RuleSet {
  id: string;
  name: string;
  revision: number;
  configuration: RuleSetConfiguration;
  usedBy: RuleSetBinding[];
}

export interface RuleSetRevision {
  revision: number;
  createdAt: string;
  configuration: RuleSetConfiguration;
}

export interface RuleDrop {
  documentId: string;
  versionId: string;
  title: string;
  parsedAt: string;
  what: "BLOCK" | "CHUNK";
  step: string;
  startLine: number | null;
  reason: string;
  excerpt: string | null;
}

/** One stage as a rule editor needs it: what binds it, which facts its fragments carry, what can be done to them. */
export interface StageView {
  stage: RuleStage;
  holder: RuleSetHolder;
  facts: RuleFact[];
  decides: boolean;
  rewrites: boolean;
  /** The kind of rule script a script condition here runs, or null where no script may judge. */
  scriptKind: string | null;
}

/** Where a ready rule set is offered: at a source's door, by what the source holds, or inside the pipeline. */
export type PresetGroup = "GENERAL" | "WRITING" | "CODE" | "WEB" | "NARROW" | "PIPELINE";

/** One ready rule set of the server's catalogue (`presets/rule-sets.json`) — the only place its rules are written. */
export interface RuleSetPreset {
  key: string;
  group: PresetGroup;
  /** The catalogue's English name; the interface names it by `key`. */
  name: string;
  summary: string;
  /** The kinds of source it is written for; empty for a pipeline preset. */
  kinds: SourceKind[];
  /** What happens at the door to a file no rule decides; null for a pipeline preset. */
  otherwise: "TAKE" | "SKIP" | "REVIEW" | null;
  stages: RuleStage[];
  /** Its rules' English names, in order. */
  rules: string[];
  /** The same rules' catalogue keys. */
  ruleKeys: string[];
}

export interface RuleVocabulary {
  stages: StageView[];
  facts: RuleFact[];
  operators: FieldOperator[];
  conditions: ConditionType[];
  actions: ActionType[];
  normalisations: Normalisation[];
  blockKinds: string[];
  presets: RuleSetPreset[];
}

export interface SourceRuleSetBinding {
  sourceId: string;
  ruleSetIds: string[];
  scriptGroupIds: string[];
  revision: number;
}

/** A preview of a source's door: the rule sets being chosen, with one of them replaced by a draft not yet saved. */
export interface RulePreviewRequest {
  ruleSetIds: string[];
  draftRuleSetId?: string | null;
  draft?: RuleSetConfiguration | null;
  maximumDepth: number;
}

export const ruleSetsApi = {
  list: (workspaceId: string) =>
    api.send<ListedRuleSet[]>("GET", workspacePath(workspaceId, "/rule-sets")),
  vocabulary: (workspaceId: string) =>
    api.send<RuleVocabulary>("GET", workspacePath(workspaceId, "/rule-sets/vocabulary")),
  get: (workspaceId: string, ruleSetId: string) =>
    api.send<RuleSet>("GET", workspacePath(workspaceId, `/rule-sets/${ruleSetId}`)),
  create: (workspaceId: string, name: string, configuration: RuleSetConfiguration) =>
    api.send<RuleSet>("POST", workspacePath(workspaceId, "/rule-sets"), {
      name,
      revision: 0,
      configuration,
    }),
  /**
   * The server builds it from the preset's key: only its catalogue knows what each ready rule is. The name and the rule
   * names are the viewer's words for it; either may be left to the catalogue's English.
   */
  createFromPreset: (
    workspaceId: string,
    preset: string,
    words: { name?: string; ruleNames?: Record<string, string> } = {},
  ) =>
    api.send<RuleSet>(
      "POST",
      workspacePath(workspaceId, `/rule-sets/from-preset?preset=${encodeURIComponent(preset)}`),
      words,
    ),
  change: (
    workspaceId: string,
    ruleSetId: string,
    name: string,
    revision: number,
    configuration: RuleSetConfiguration,
  ) =>
    api.send<RuleSet>("PUT", workspacePath(workspaceId, `/rule-sets/${ruleSetId}`), {
      name,
      revision,
      configuration,
    }),
  history: (workspaceId: string, ruleSetId: string) =>
    api.send<RuleSetRevision[]>(
      "GET",
      workspacePath(workspaceId, `/rule-sets/${ruleSetId}/history`),
    ),
  dropped: (workspaceId: string, ruleSetId: string) =>
    api.send<RuleDrop[]>("GET", workspacePath(workspaceId, `/rule-sets/${ruleSetId}/dropped`)),
  sourceBinding: (workspaceId: string, sourceId: string) =>
    api.send<SourceRuleSetBinding>(
      "GET",
      workspacePath(workspaceId, `/sources/${sourceId}/rule-sets`),
    ),
  bindSource: (workspaceId: string, binding: SourceRuleSetBinding) =>
    api.send<SourceRuleSetBinding>(
      "PUT",
      workspacePath(workspaceId, `/sources/${binding.sourceId}/rule-sets`),
      {
        ruleSetIds: binding.ruleSetIds,
        scriptGroupIds: binding.scriptGroupIds,
        revision: binding.revision,
      },
    ),
  /** Walks a local folder source with the chosen rule sets and reports what a scan would do; nothing is saved. */
  previewSource: (workspaceId: string, sourceId: string, request: RulePreviewRequest) =>
    api.send<RulePreview>(
      "POST",
      workspacePath(workspaceId, `/sources/${sourceId}/rule-sets/preview`),
      request,
    ),
};

/** The way to what binds a rule set. A profile's address carries its kind, and only processing profiles bind rule sets. */
export function holderAddress(binding: RuleSetBinding): string {
  return binding.holder === "SOURCE"
    ? `/sources/${binding.id}?tab=rules`
    : `/profiles/processing/${binding.id}?tab=content`;
}

/** Whether a stage's fragments carry every fact a condition type needs, and whether a script may judge there. */
export function conditionAllowedAt(type: ConditionType, stage: StageView): boolean {
  switch (type) {
    case "PATH":
      return stage.facts.includes("PATH");
    case "PATTERN":
    case "CONTAINS_WORDS":
    case "WORD_LIST":
    case "SHORTER_THAN":
    case "LONGER_THAN":
      return stage.facts.includes("TEXT");
    case "REPEATS":
      return stage.facts.includes("REPETITION");
    case "FIELD":
      return fieldFactsAt(stage).length > 0;
    case "SCRIPT":
      return stage.scriptKind !== null;
    default:
      return true;
  }
}

/** The facts a field comparison may name at a stage: everything it carries but the text and the repetition count. */
export function fieldFactsAt(stage: StageView): RuleFact[] {
  return stage.facts.filter((fact) => fact !== "TEXT" && fact !== "REPETITION");
}

/** Whether an action means something at a stage. */
export function actionAllowedAt(type: ActionType, stage: StageView): boolean {
  switch (type) {
    case "KEEP":
    case "DROP":
      return stage.decides;
    case "REVIEW":
      return stage.stage === "MATERIAL";
    case "DEFINE_ENTITY":
    case "LINK_ENTITY":
      return stage.stage === "SEMANTIC_EXTRACTION";
    case "REMOVE_WORDS":
      return stage.stage === "KEYWORD_TEXT";
    default:
      return stage.rewrites;
  }
}

/** Whether every condition in a tree can be answered at a stage. */
export function conditionFitsStage(condition: RuleCondition, stage: StageView): boolean {
  switch (condition.type) {
    case "ALL":
    case "ANY":
      return condition.conditions.every((inner) => conditionFitsStage(inner, stage));
    case "NOT":
      return conditionFitsStage(condition.condition, stage);
    case "FIELD":
      return fieldFactsAt(stage).includes(condition.fact);
    default:
      return conditionAllowedAt(condition.type, stage);
  }
}

/** A fresh condition of a type, with values a person then edits. */
export function newCondition(type: ConditionType, stage: StageView): RuleCondition {
  switch (type) {
    case "ALWAYS":
      return { type };
    case "FIELD": {
      const fact = fieldFactsAt(stage)[0] ?? "PATH";
      return fact === "BLOCK_KIND"
        ? { type, fact, operator: "EQUALS", values: ["PAGE_FURNITURE"] }
        : NUMERIC_FACTS.includes(fact)
          ? { type, fact, operator: "GREATER_THAN", values: ["0"] }
          : { type, fact, operator: "CONTAINS", values: [""] };
    }
    case "PATH":
      return { type, patterns: ["docs/**"] };
    case "PATTERN":
      return { type, patterns: ["^\\s*$"] };
    case "CONTAINS_WORDS":
      return { type, words: ["pikachu"] };
    case "WORD_LIST":
      return { type, words: ["Draft"] };
    case "SHORTER_THAN":
      return { type, characters: 3 };
    case "LONGER_THAN":
      return { type, characters: 2000 };
    case "REPEATS":
      return { type, times: 5, ignoreDigits: true };
    case "SCRIPT":
      return { type, script: "", failurePolicy: "STOP" };
    case "ALL":
    case "ANY":
      return {
        type,
        conditions: [
          newCondition(stage.facts.includes("TEXT") ? "CONTAINS_WORDS" : "ALWAYS", stage),
        ],
      };
    case "NOT":
      return {
        type,
        condition: newCondition(stage.facts.includes("TEXT") ? "CONTAINS_WORDS" : "ALWAYS", stage),
      };
  }
}

/** A fresh action of a type. */
export function newAction(type: ActionType): RuleAction {
  switch (type) {
    case "KEEP":
    case "DROP":
    case "REVIEW":
      return { type };
    case "NORMALISE":
      return { type, normalisations: ["WHITESPACE"] };
    case "REPLACE":
      return { type, patterns: ["\\s*\\[\\d+\\]"], replacement: "" };
    case "REMOVE_WORDS":
      return { type, words: ["the"] };
    case "DEFINE_ENTITY":
      return { type, namespace: "topic", key: "example", name: "Example", kind: "TOPIC" };
    case "LINK_ENTITY":
      return { type, role: "MENTIONS", namespace: "topic", key: "example" };
  }
}

/**
 * A new rule at a stage: where a fragment can be left out, it leaves out whatever holds a stop word and stops there — the
 * commonest rule anybody writes — and where it cannot, it normalises whitespace.
 */
export function newRule(stage: StageView, order: number): Rule {
  const action: RuleAction =
    stage.stage === "SEMANTIC_EXTRACTION"
      ? newAction("DEFINE_ENTITY")
      : stage.decides
        ? { type: "DROP" }
        : newAction("NORMALISE");
  const condition: RuleCondition =
    stage.decides && stage.facts.includes("TEXT")
      ? newCondition("CONTAINS_WORDS", stage)
      : { type: "ALWAYS" };
  return {
    name: "",
    order,
    enabled: true,
    stage: stage.stage,
    condition,
    action,
    stopOnMatch: stage.decides,
  };
}

/** The rule moved to another stage: whatever no longer fits there is replaced by the stage's default. */
export function ruleAtStage(rule: Rule, stage: StageView): Rule {
  const fallback = newRule(stage, rule.order);
  return {
    ...rule,
    stage: stage.stage,
    condition: conditionFitsStage(rule.condition, stage) ? rule.condition : fallback.condition,
    action: actionAllowedAt(rule.action.type, stage) ? rule.action : fallback.action,
    stopOnMatch: stage.decides ? rule.stopOnMatch : false,
  };
}

/** A name no listed rule set has: the wanted one, cut to fit, or it with a number after it. */
export function uniquePolicyName(wanted: string, ruleSets: ListedRuleSet[]): string {
  const taken = new Set(ruleSets.map((ruleSet) => ruleSet.name));
  const base = wanted.slice(0, 150);
  let candidate = base;
  for (let number = 2; taken.has(candidate); number++) {
    candidate = `${base} ${number}`;
  }
  return candidate;
}

/** The rule sets a holder bound, each frozen at the revision its work began with — what a scan or a job actually ran. */
export interface BoundRuleSets {
  ruleSets: {
    id: string | null;
    name: string;
    revision: number;
    configuration: RuleSetConfiguration;
  }[];
}
