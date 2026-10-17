// How rule set rules are said in the interface: stages, facts, condition and action types, and a whole rule as one line —
// «holds pikachu → drop». One vocabulary for every stage, so a rule at the door and a rule over parsed blocks read the
// same wherever they are shown: on the rule set itself, on the source or profile that binds it, in a preview.

import type {
  ActionType,
  ConditionType,
  FieldOperator,
  Normalisation,
  RuleAction,
  RuleCondition,
  RuleFact,
  Rule,
  RuleStage,
} from "../../lib/ruleSets";
import type { useTranslation } from "../../translations/TranslationProvider";
import type { BadgeTone } from "../../ui/primitives";

type Translate = ReturnType<typeof useTranslation>["t"];

export function stageName(stage: RuleStage, t: Translate): string {
  switch (stage) {
    case "MATERIAL":
      return t("rules.stage.arrivingFiles", "Arriving files");
    case "BLOCKS":
      return t("profiles.content.stage.blocks", "Parsed blocks");
    case "CHUNKS":
      return t("profiles.content.stage.chunks", "Chunks");
    case "KEYWORD_TEXT":
      return t("profiles.content.stage.keywordText", "Keyword text");
    case "EMBEDDING_TEXT":
      return t("profiles.content.stage.embeddingText", "Embedding text");
    case "QUERY":
      return t("profiles.content.stage.query", "Search queries");
  }
}

/** What a rule at a stage sees, and who runs it — the line under a stage's heading. */
export function stagePurpose(stage: RuleStage, t: Translate): string {
  switch (stage) {
    case "MATERIAL":
      return t(
        "rules.stagePurpose.material",
        "Each file or page as it arrives, before anything is stored: its path, name, media type, size, and its text when it is already text. Runs on every source that binds this rule set.",
      );
    case "BLOCKS":
      return t(
        "rules.stagePurpose.blocks",
        "The blocks a parser read, before they are cut into chunks: their text, kind, page and heading level. Runs in every processing profile that binds this rule set.",
      );
    case "CHUNKS":
      return t(
        "rules.stagePurpose.chunks",
        "Each chunk, with the text composed from its blocks. Runs in processing profiles.",
      );
    case "KEYWORD_TEXT":
      return t(
        "rules.stagePurpose.keywordText",
        "The text keyword entries are built from. Rewritten only — never dropped.",
      );
    case "EMBEDDING_TEXT":
      return t(
        "rules.stagePurpose.embeddingText",
        "The text vectors are built from. Rewritten only — never dropped.",
      );
    case "QUERY":
      return t(
        "rules.stagePurpose.query",
        "A search query. Normalising rules anywhere in the pipeline apply to queries too; a rule here applies to queries only.",
      );
  }
}

/** Where a stage sits, in two words: at the door of the corpus, or in the processing pipeline. */
export function stagePlace(stage: RuleStage, t: Translate): string {
  return stage === "MATERIAL"
    ? t("rules.place.door", "Door")
    : t("rules.place.pipeline", "Pipeline");
}

export function factName(fact: RuleFact, t: Translate): string {
  switch (fact) {
    case "PATH":
      return t("sourceRules.field.path", "Path");
    case "TITLE":
      return t("sourceRules.field.fileName", "File name");
    case "MEDIA_TYPE":
      return t("sourceRules.field.mediaType", "Media type");
    case "SOURCE_KIND":
      return t("sourceRules.field.sourceKind", "Source kind");
    case "SIZE_BYTES":
      return t("sourceRules.field.size", "Size in bytes");
    case "TEXT":
      return t("rules.fact.text", "Text");
    case "BLOCK_KIND":
      return t("rules.fact.blockKind", "Block kind");
    case "PAGE":
      return t("rules.fact.page", "Page");
    case "HEADING_LEVEL":
      return t("rules.fact.headingLevel", "Heading level");
    case "POSITION":
      return t("rules.fact.position", "Position");
    case "REPETITION":
      return t("rules.fact.repetition", "Repetitions");
  }
}

export function operatorName(operator: FieldOperator, numeric: boolean, t: Translate): string {
  switch (operator) {
    case "EQUALS":
      return numeric
        ? t("sourceRules.operator.exactly", "is exactly")
        : t("sourceRules.operator.equals", "is");
    case "PREFIX":
      return t("sourceRules.operator.prefix", "starts with");
    case "SUFFIX":
      return t("sourceRules.operator.suffix", "ends with");
    case "CONTAINS":
      return t("sourceRules.operator.contains", "contains");
    case "GREATER_THAN":
      return t("sourceRules.operator.greaterThan", "is more than");
    case "LESS_OR_EQUAL":
      return t("sourceRules.operator.atMost", "is at most");
  }
}

export function conditionTypeName(type: ConditionType, t: Translate): string {
  switch (type) {
    case "ALWAYS":
      return t("contentSteps.condition.always", "Always");
    case "FIELD":
      return t("rules.condition.field", "A fact compares with a value");
    case "PATH":
      return t("rules.condition.path", "Path matches a glob");
    case "PATTERN":
      return t("contentSteps.condition.pattern", "Text matches a pattern");
    case "CONTAINS_WORDS":
      return t("contentSteps.condition.containsWords", "Text holds a stop word");
    case "WORD_LIST":
      return t("contentSteps.condition.wordList", "Text is in a word list");
    case "SHORTER_THAN":
      return t("contentSteps.condition.shorterThan", "Shorter than");
    case "LONGER_THAN":
      return t("contentSteps.condition.longerThan", "Longer than");
    case "REPEATS":
      return t("contentSteps.condition.repeats", "Repeats in the document");
    case "SCRIPT":
      return t("contentSteps.condition.script", "jMS script refuses");
    case "ALL":
      return t("contentSteps.condition.all", "All of");
    case "ANY":
      return t("contentSteps.condition.any", "Any of");
    case "NOT":
      return t("contentSteps.condition.not", "Not");
  }
}

export function actionTypeName(type: ActionType, t: Translate): string {
  switch (type) {
    case "KEEP":
      return t("rules.action.keep", "Keep");
    case "DROP":
      return t("contentSteps.action.drop", "Drop");
    case "REVIEW":
      return t("sourceRules.action.review", "Send it for review");
    case "NORMALISE":
      return t("contentSteps.action.normalise", "Normalise");
    case "REPLACE":
      return t("contentSteps.action.replace", "Replace by pattern");
    case "REMOVE_WORDS":
      return t("contentSteps.action.removeWords", "Remove words");
  }
}

/**
 * What a rule does to what it matches, as a verdict word with its colour — one table for every stage, so «drop» at the
 * door and «drop» over blocks are the same red. A rewriting rule has no verdict.
 */
export function verdictOf(
  action: RuleAction,
  t: Translate,
): { word: string; tone: BadgeTone } | null {
  switch (action.type) {
    case "KEEP":
      return { word: t("rules.verdict.keep", "Keeps"), tone: "allow" };
    case "DROP":
      return { word: t("rules.verdict.drop", "Drops"), tone: "deny" };
    case "REVIEW":
      return { word: t("sourceRules.verdict.review", "For review"), tone: "warn" };
    default:
      return null;
  }
}

export function normalisationName(normalisation: Normalisation, t: Translate): string {
  switch (normalisation) {
    case "WHITESPACE":
      return t("profiles.content.normalisation.whitespace", "Whitespace");
    case "UNICODE":
      return t("profiles.content.normalisation.unicode", "Unicode (µ → μ)");
    case "NON_BREAKING_SPACES":
      return t("profiles.content.normalisation.nonBreakingSpaces", "Non-breaking spaces");
    case "QUOTES":
      return t("profiles.content.normalisation.quotes", "Quotes and dashes");
    case "HYPHENATION":
      return t("profiles.content.normalisation.hyphenation", "Hyphenated line breaks");
  }
}

/** A condition as a phrase. */
export function describeCondition(condition: RuleCondition, t: Translate): string {
  switch (condition.type) {
    case "ALWAYS":
      return t("contentSteps.says.always", "always");
    case "FIELD":
      return t("rules.says.field", "{fact} {operator} {values}", {
        fact: factName(condition.fact, t).toLowerCase(),
        operator: operatorName(condition.operator, condition.fact === "SIZE_BYTES", t),
        values: condition.values.join(" | ") || "…",
      });
    case "PATH":
      return t("rules.says.path", "path matches {patterns}", {
        patterns: condition.patterns.join(" | ") || "…",
      });
    case "PATTERN":
      return t("contentSteps.says.pattern", "matches {patterns}", {
        patterns: condition.patterns.join(" | "),
      });
    case "CONTAINS_WORDS":
      return t("contentSteps.says.containsWords", "holds {words}", {
        words: condition.words.join(" | "),
      });
    case "WORD_LIST":
      return t("contentSteps.says.wordList", "is one of {count} listed lines", {
        count: String(condition.words.length),
      });
    case "SHORTER_THAN":
      return t("contentSteps.says.shorterThan", "shorter than {characters}", {
        characters: String(condition.characters),
      });
    case "LONGER_THAN":
      return t("contentSteps.says.longerThan", "longer than {characters}", {
        characters: String(condition.characters),
      });
    case "REPEATS":
      return condition.ignoreDigits
        ? t("contentSteps.says.repeatsDigits", "repeats ≥ {times}×, numbers aside", {
            times: String(condition.times),
          })
        : t("contentSteps.says.repeats", "repeats ≥ {times}×", { times: String(condition.times) });
    case "SCRIPT":
      return t("contentSteps.says.script", "script {script} refuses", {
        script: condition.script || "…",
      });
    case "ALL":
      return condition.conditions
        .map((inner) => describeCondition(inner, t))
        .join(t("contentSteps.says.and", " and "));
    case "ANY":
      return `(${condition.conditions.map((inner) => describeCondition(inner, t)).join(t("contentSteps.says.or", " or "))})`;
    case "NOT":
      return t("contentSteps.says.not", "not ({condition})", {
        condition: describeCondition(condition.condition, t),
      });
  }
}

/** An action as a phrase. */
export function describeAction(action: RuleAction, t: Translate): string {
  switch (action.type) {
    case "KEEP":
      return t("rules.says.keep", "keep");
    case "DROP":
      return t("contentSteps.says.drop", "drop");
    case "REVIEW":
      return t("rules.says.review", "send for review");
    case "NORMALISE":
      return t("contentSteps.says.normalise", "normalise {what}", {
        what: action.normalisations
          .map((normalisation) => normalisationName(normalisation, t).toLowerCase())
          .join(", "),
      });
    case "REPLACE":
      return action.replacement === ""
        ? t("contentSteps.says.remove", "remove what matches {patterns}", {
            patterns: action.patterns.join(" | "),
          })
        : t("contentSteps.says.replace", "replace {patterns} with «{replacement}»", {
            patterns: action.patterns.join(" | "),
            replacement: action.replacement,
          });
    case "REMOVE_WORDS":
      return t("contentSteps.says.removeWords", "remove {count} listed words", {
        count: String(action.words.length),
      });
  }
}

/** A whole rule as one line: «holds pikachu → drop · no further checks». */
export function describeRule(
  rule: Pick<Rule, "condition" | "action" | "stopOnMatch">,
  t: Translate,
): string {
  const line = `${describeCondition(rule.condition, t)} → ${describeAction(rule.action, t)}`;
  return rule.stopOnMatch
    ? t("rules.says.thenStop", "{rule} · no further checks", { rule: line })
    : line;
}

/** The colour of a place: violet at the door, teal in the pipeline — and the thing that runs it wears the same. */
export function placeTone(stage: RuleStage): "door" | "pipeline" {
  return stage === "MATERIAL" ? "door" : "pipeline";
}

/** The colour of what binds a rule set: a source runs the door, a processing profile the pipeline. */
export function holderTone(holder: "SOURCE" | "PROFILE"): "door" | "pipeline" {
  return holder === "SOURCE" ? "door" : "pipeline";
}
