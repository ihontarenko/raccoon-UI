import { labelOfCode, type CodeLabels } from "../../application/format";
import type { SourceKind } from "../../lib/contracts";
import type { RuleSetPreset, PresetGroup } from "../../lib/ruleSets";
import type { PresetChoice } from "../../ui/components";
import { declareText, translate, translatePlural } from "../../translations/translate";
import type { Translate } from "../../translations/TranslationProvider";
import { stageName } from "./ruleWords";

/**
 * The ready rule sets, said in the viewer's language.
 *
 * ⚠️ WHAT A PRESET IS LIVES ON THE SERVER, IN ONE FILE — `presets/rule-sets.json`: its rules, the kinds of source it is
 * written for, and what happens to a file no rule decides. The vocabulary call hands the whole catalogue over. This module
 * holds only the WORDS for it, keyed by the catalogue's own keys, the way `codeLabels.ts` names every other shipped code. A
 * preset or rule the release adds but this file does not name still reads — in the English the catalogue ships.
 *
 * The translation keys are the ones the presets had when they were defined in this interface, so no translation is lost.
 */

const PRESET_NAMES: CodeLabels = {
  "component-reference-candidates": declareText(
    "processing.candidatePreset",
    "Component reference candidates",
  ),
  everything: declareText("sourceSetup.preset.everything.label", "Everything useful"),
  "text-only": declareText("sourceSetup.preset.textOnly.label", "Everything readable"),
  "no-media": declareText("sourceSetup.preset.noMedia.label", "Everything except media"),
  "media-only": declareText("sourceSetup.preset.mediaOnly.label", "Pictures only"),
  "review-unknown": declareText(
    "sourceSetup.preset.reviewUnknown.label",
    "Documents, the rest for review",
  ),
  "review-everything": declareText(
    "sourceSetup.preset.reviewEverything.label",
    "Everything for review",
  ),
  documents: declareText("sourceSetup.preset.documents.label", "Documents and text"),
  markdown: declareText("sourceSetup.preset.markdown.label", "Markdown only"),
  office: declareText("sourceSetup.preset.office.label", "Office documents and PDF"),
  "notes-vault": declareText("sourceSetup.preset.notesVault.label", "Notes vault"),
  "repository-documentation": declareText(
    "sourceSetup.preset.repositoryDocumentation.label",
    "Repository documentation",
  ),
  "source-code": declareText(
    "sourceSetup.preset.sourceCode.label",
    "Source code and its documentation",
  ),
  configuration: declareText("sourceSetup.preset.configuration.label", "Configuration"),
  "web-articles": declareText("sourceSetup.preset.webArticles.label", "Pages without listings"),
  "web-converted": declareText(
    "sourceSetup.preset.webConverted.label",
    "HTML and Markdown pages only",
  ),
  "web-pages": declareText("sourceSetup.preset.webPages.label", "Saved web pages (HTML)"),
  "stop-words": declareText("sourceSetup.preset.stopWords.label", "Everything except stop words"),
  empty: declareText("sourceSetup.preset.empty.label", "No rules"),
  "usual-cleanup": declareText("rules.presetSet.usualCleanup", "Usual cleanup"),
  "scanned-paper": declareText("rules.presetSet.scannedPaper", "Scanned paper"),
  "search-hygiene": declareText("rules.presetSet.searchHygiene", "Search hygiene"),
  minimal: declareText("rules.presetSet.minimal", "Minimal"),
};

const PRESET_SUMMARIES: CodeLabels = {
  "component-reference-candidates": declareText(
    "processing.candidatePresetHelp",
    "Mentions of NE555 and LM358 suggest matching jMX components. Suggestions retain their rule evidence; missing or duplicate targets remain unresolved or ambiguous.",
  ),
  everything: declareText(
    "sourceSetup.preset.everything.description",
    "Every file, except dependency, build and version-control folders and system litter.",
  ),
  "text-only": declareText(
    "sourceSetup.preset.textOnly.description",
    "Every file except media, archives, binaries and files over 20 MB.",
  ),
  "no-media": declareText(
    "sourceSetup.preset.noMedia.description",
    "Takes every file but pictures, sound, video, archives, binaries and anything over 20 MB.",
  ),
  "media-only": declareText(
    "sourceSetup.preset.mediaOnly.description",
    "Only pictures a parser can read text out of — PNG, JPEG and TIFF; everything else is skipped. For a source of scans.",
  ),
  "review-unknown": declareText(
    "sourceSetup.preset.reviewUnknown.description",
    "Documents are taken; any other file waits for a person to decide.",
  ),
  "review-everything": declareText(
    "sourceSetup.preset.reviewEverything.description",
    "Nothing is taken until a person decides, one document at a time.",
  ),
  documents: declareText(
    "sourceSetup.preset.documents.description",
    "Markdown, text, AsciiDoc, reStructuredText and Org; everything else is skipped.",
  ),
  markdown: declareText(
    "sourceSetup.preset.markdown.description",
    "Only .md files; everything else is skipped.",
  ),
  office: declareText(
    "sourceSetup.preset.office.description",
    "PDF, Word, spreadsheets and presentations, up to 50 MB each.",
  ),
  "notes-vault": declareText(
    "sourceSetup.preset.notesVault.description",
    "An Obsidian or Logseq vault: its Markdown, without the app's own settings and trash.",
  ),
  "repository-documentation": declareText(
    "sourceSetup.preset.repositoryDocumentation.description",
    "READMEs, changelogs, docs/ and architecture decisions — the prose a repository carries.",
  ),
  "source-code": declareText(
    "sourceSetup.preset.sourceCode.description",
    "Source files in common languages, plus Markdown, under 2 MB each.",
  ),
  configuration: declareText(
    "sourceSetup.preset.configuration.description",
    "YAML, JSON, TOML, XML and properties files — how a system is set up.",
  ),
  "web-articles": declareText(
    "sourceSetup.preset.webArticles.description",
    "Every fetched page except the tag, category, author and archive listings a site builds around its articles.",
  ),
  "web-converted": declareText(
    "sourceSetup.preset.webConverted.description",
    "Pages that were HTML or Markdown; plain-text files the site serves are left out.",
  ),
  "web-pages": declareText(
    "sourceSetup.preset.webPages.description",
    "HTML files kept in a folder; scripts, styles and images are skipped.",
  ),
  "stop-words": declareText(
    "sourceSetup.preset.stopWords.description",
    "Takes everything, but leaves out a document whose own text holds a listed word. Only formats that are already text are read at the door — edit the words after applying it.",
  ),
  empty: declareText(
    "sourceSetup.preset.empty.description",
    "Take everything the source holds or receives. Rules can be added later.",
  ),
  "usual-cleanup": declareText(
    "rules.presetSet.usualCleanup.summary",
    "What nearly every corpus wants: empty blocks, page furniture, consistent whitespace and Unicode, and words put back together across a line break.",
  ),
  "scanned-paper": declareText(
    "rules.presetSet.scannedPaper.summary",
    "For documents that came off a scanner or a press: running headers and footers, watermarks, and the rules and dot leaders a layout leaves behind.",
  ),
  "search-hygiene": declareText(
    "rules.presetSet.searchHygiene.summary",
    "Acts after the text is cut: drops chunks too short for any search to return, and keeps the commonest English words out of the keyword index.",
  ),
  minimal: declareText(
    "rules.presetSet.minimal.summary",
    "The two nothing is lost by: empty blocks, and one spelling of every space and quote.",
  ),
};

const GROUP_NAMES: Record<PresetGroup, CodeLabels[string]> = {
  GENERAL: declareText("sourceSetup.presetGroup.general", "General"),
  WRITING: declareText("sourceSetup.presetGroup.writing", "Writing"),
  CODE: declareText("sourceSetup.presetGroup.code", "Code"),
  WEB: declareText("sourceSetup.presetGroup.web", "Web"),
  NARROW: declareText("sourceSetup.presetGroup.narrow", "Narrow"),
  PIPELINE: declareText("rules.presetGroup.pipeline", "In the pipeline"),
};

/** A ready rule's name, which the created rule set's rule is saved under — so it is written in the language in use then. */
const RULE_NAMES: Readonly<Record<string, () => string>> = {
  "skip-the-rest": () =>
    translate("sourceSetup.presetRule.skipTheRest", "Skip whatever no rule takes"),
  "review-the-rest": () =>
    translate("sourceSetup.presetRule.reviewTheRest", "Send whatever no rule decides for review"),
  "skip-dependency-folders": () =>
    translate("sourceSetup.presetRule.dependencyFolders", "Leave dependency and build folders"),
  "skip-system-files": () => translate("sourceSetup.presetRule.systemFiles", "Leave system files"),
  "skip-binaries": () =>
    translate("sourceSetup.presetRule.binaries", "Leave media, archives and binaries"),
  "skip-over-2-mb": () =>
    translate("sourceSetup.presetRule.largerThan", "Leave files over {size} MB", { size: 2 }),
  "skip-over-20-mb": () =>
    translate("sourceSetup.presetRule.largerThan", "Leave files over {size} MB", { size: 20 }),
  "skip-over-50-mb": () =>
    translate("sourceSetup.presetRule.largerThan", "Leave files over {size} MB", { size: 50 }),
  "skip-stop-words": () =>
    translate("sourceSetup.presetRule.stopWords", "Leave documents holding a stop word"),
  "skip-application-folders": () =>
    translate("sourceSetup.presetRule.applicationFolders", "Leave the app's own folders"),
  "skip-generated-code": () =>
    translate("sourceSetup.presetRule.generatedCode", "Leave generated and minified code"),
  "skip-lock-files-and-secrets": () =>
    translate("sourceSetup.presetRule.lockFilesAndSecrets", "Leave lock files and secrets"),
  "skip-listing-pages": () =>
    translate("sourceSetup.presetRule.listingPages", "Leave listing pages"),
  "take-pictures": () => translate("sourceSetup.presetRule.pictures", "Pictures"),
  "take-documents": () => translate("sourceSetup.presetRule.documents", "Documents"),
  "take-documents-and-office": () => translate("sourceSetup.presetRule.documents", "Documents"),
  "take-markdown-files": () => translate("sourceSetup.presetRule.markdownFiles", "Markdown files"),
  "take-office-documents": () =>
    translate("sourceSetup.presetRule.officeDocuments", "Office documents"),
  "take-notes": () => translate("sourceSetup.presetRule.notes", "Notes"),
  "take-top-level-prose": () =>
    translate("sourceSetup.presetRule.topLevelProse", "Top-level prose"),
  "take-documentation-folders": () =>
    translate("sourceSetup.presetRule.documentationFolders", "Documentation folders"),
  "take-source-code": () => translate("sourceSetup.presetRule.sourceCode", "Source code"),
  "take-documentation": () => translate("sourceSetup.presetRule.documentation", "Documentation"),
  "take-configuration-files": () =>
    translate("sourceSetup.presetRule.configurationFiles", "Configuration files"),
  "take-pages": () => translate("sourceSetup.presetRule.pages", "Pages"),
  "take-web-pages": () => translate("sourceSetup.presetRule.webPages", "Web pages"),
};

export function presetName(preset: RuleSetPreset): string {
  return PRESET_NAMES[preset.key] === undefined
    ? preset.name
    : labelOfCode(PRESET_NAMES, preset.key);
}

export function presetSummary(preset: RuleSetPreset): string {
  return PRESET_SUMMARIES[preset.key] === undefined
    ? preset.summary
    : labelOfCode(PRESET_SUMMARIES, preset.key);
}

/** The created rule set's rule names in the viewer's language, by ready-rule key — what create-from-preset is sent. */
export function ruleNamesOf(preset: RuleSetPreset): Record<string, string> {
  return Object.fromEntries(
    preset.ruleKeys.flatMap((key) =>
      RULE_NAMES[key] === undefined ? [] : [[key, RULE_NAMES[key]()]],
    ),
  );
}

/** The presets written for a kind of source, in catalogue order. */
export function presetsForKind(
  presets: readonly RuleSetPreset[],
  kind: SourceKind,
): RuleSetPreset[] {
  return presets.filter((preset) => preset.kinds.includes(kind));
}

/** The pipeline's ready rule sets — those no source binds by its kind. */
export function pipelinePresets(presets: readonly RuleSetPreset[]): RuleSetPreset[] {
  return presets.filter((preset) => preset.group === "PIPELINE");
}

/** Where a picker starts: the first of the preferred keys on offer, else the first on offer, else nothing. */
export function startingPreset(
  offered: readonly RuleSetPreset[],
  preferred: readonly string[],
): RuleSetPreset | null {
  for (const key of preferred) {
    const match = offered.find((preset) => preset.key === key);
    if (match !== undefined) {
      return match;
    }
  }
  return offered[0] ?? null;
}

/** What the picker shows of each preset — the same facts on every screen that offers one. */
export function presetChoices(presets: readonly RuleSetPreset[], t: Translate): PresetChoice[] {
  return presets.map((preset) => ({
    key: preset.key,
    group: labelOfCode(GROUP_NAMES, preset.group),
    name: presetName(preset),
    description: presetSummary(preset),
    facts: [
      translatePlural("rules.ruleCount", preset.rules.length, {
        one: "{count} rule",
        other: "{count} rules",
      }),
      ...(preset.otherwise === null
        ? preset.stages.map((stage) => stageName(stage, t))
        : [otherwiseFact(preset.otherwise, t)]),
    ],
  }));
}

function otherwiseFact(otherwise: NonNullable<RuleSetPreset["otherwise"]>, t: Translate): string {
  switch (otherwise) {
    case "TAKE":
      return t("sourceRules.presetDefault.include", "otherwise takes the file");
    case "SKIP":
      return t("sourceRules.presetDefault.skip", "otherwise skips the file");
    case "REVIEW":
      return t("sourceRules.presetDefault.review", "otherwise sends it for review");
  }
}
