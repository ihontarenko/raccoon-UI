import { useId } from "react";
import {
  NUMERIC_FACTS,
  actionAllowedAt,
  conditionAllowedAt,
  fieldFactsAt,
  newAction,
  newCondition,
  ruleAtStage,
  type ActionType,
  type ConditionType,
  type FailurePolicy,
  type FieldOperator,
  type RuleAction,
  type RuleCondition,
  type RuleFact,
  type Rule,
  type RuleStage,
  type RuleVocabulary,
  type StageView,
} from "../../lib/ruleSets";
import type { ScriptView } from "../../lib/sourceContracts";
import { useTranslation } from "../../translations/TranslationProvider";
import { ChipInput } from "../../ui/components";
import { Button, Checkbox, Input, Select, TextArea } from "../../ui/primitives";
import { PatternChips } from "./PatternChips";
import {
  CHECKBOX_GRID,
  COMPARISON,
  CONDITION,
  FIELD,
  HINT,
  LABEL,
  NESTED,
  NESTED_ITEM,
  PART,
  PART_TITLE,
  ROW,
  RULE_EDITOR,
  SCRIPT_ROW,
  WARNING,
} from "./ruleSetsClasses";
import {
  actionTypeName,
  conditionTypeName,
  factName,
  normalisationName,
  operatorName,
  stageName,
  stagePlace,
} from "./ruleWords";

/** Conditions nest at most this deep, as the server allows. */
const DEEPEST_NESTING = 4;

const TEXT_OPERATORS: FieldOperator[] = ["EQUALS", "PREFIX", "SUFFIX", "CONTAINS"];
const NUMERIC_OPERATORS: FieldOperator[] = ["EQUALS", "GREATER_THAN", "LESS_OR_EQUAL"];

export interface RuleEditorProperties {
  rule: Rule;
  vocabulary: RuleVocabulary;
  /** Every rule script of the workspace, both kinds; the stage picks the kind its script conditions may name. */
  scripts: ScriptView[];
  onChange: (rule: Rule) => void;
  /** Opens the script dialog for a script of `kind` — `script` to edit, or null to write one called `suggestedName`. */
  onEditScript: (kind: string, script: ScriptView | null, suggestedName: string) => void;
}

/**
 * One rule's settings — the same form whatever stage the rule runs at, because it is the same rule: a name, the stage it
 * sees, when it acts, what it does, and whether the rules after it still run. A stage that cannot answer a condition or
 * take an action never offers it, and moving a rule to another stage replaces what no longer fits with that stage's
 * default rather than leaving a rule the server would refuse.
 */
export function RuleEditor({
  rule,
  vocabulary,
  scripts,
  onChange,
  onEditScript,
}: RuleEditorProperties) {
  const { t } = useTranslation();
  const nameId = useId();
  const stageId = useId();
  const stopId = useId();
  const stage = stageOf(vocabulary, rule.stage);
  return (
    <div className={RULE_EDITOR}>
      <div className={ROW}>
        <div className={FIELD}>
          <label htmlFor={nameId} className={LABEL}>
            {t("rules.rule.name", "Name")}
          </label>
          <Input
            id={nameId}
            value={rule.name}
            maxLength={160}
            required
            aria-invalid={rule.name.trim() === "" ? true : undefined}
            onChange={(event) => onChange({ ...rule, name: event.target.value })}
          />
          {rule.name.trim() === "" && (
            <span className={WARNING}>
              {t(
                "rules.rule.nameRequired",
                "A rule needs a name: what it drops is recorded under it.",
              )}
            </span>
          )}
        </div>
        <div className={FIELD}>
          <label htmlFor={stageId} className={LABEL}>
            {t("rules.rule.stage", "Runs at")}
          </label>
          <Select
            id={stageId}
            value={rule.stage}
            onChange={(event) =>
              onChange(ruleAtStage(rule, stageOf(vocabulary, event.target.value as RuleStage)))
            }
          >
            {vocabulary.stages.map((candidate) => (
              <option key={candidate.stage} value={candidate.stage}>
                {stagePlace(candidate.stage, t)} · {stageName(candidate.stage, t)}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <fieldset className={PART}>
        <legend className={PART_TITLE}>{t("rules.rule.when", "Applies when")}</legend>
        <ConditionEditor
          condition={rule.condition}
          stage={stage}
          vocabulary={vocabulary}
          scripts={scripts}
          ruleName={rule.name}
          depth={1}
          onChange={(condition) => onChange({ ...rule, condition })}
          onEditScript={onEditScript}
        />
      </fieldset>
      <fieldset className={PART}>
        <legend className={PART_TITLE}>{t("rules.rule.then", "What it does to a match")}</legend>
        <ActionEditor
          action={rule.action}
          stage={stage}
          vocabulary={vocabulary}
          onChange={(action) => onChange({ ...rule, action })}
        />
        <div className={CONDITION}>
          <span aria-hidden="true" />
          <Checkbox
            id={stopId}
            label={t("rules.rule.stop", "Don't check further")}
            hint={
              rule.stopOnMatch
                ? t("rules.rule.stopHint", "The rules below never see what matched here.")
                : t(
                    "rules.rule.carryOnHint",
                    "The rules below check it too, and may change the outcome.",
                  )
            }
            checked={rule.stopOnMatch}
            onChange={(event) => onChange({ ...rule, stopOnMatch: event.target.checked })}
          />
        </div>
      </fieldset>
    </div>
  );
}

/** The stage's view from the vocabulary; the server lists every stage, so a missing one is a programming error. */
export function stageOf(vocabulary: RuleVocabulary, stage: RuleStage): StageView {
  const found = vocabulary.stages.find((candidate) => candidate.stage === stage);
  if (found === undefined) {
    throw new Error(`The vocabulary lists no stage ${stage}.`);
  }
  return found;
}

interface ConditionEditorProperties {
  condition: RuleCondition;
  stage: StageView;
  vocabulary: RuleVocabulary;
  scripts: ScriptView[];
  ruleName: string;
  depth: number;
  onChange: (condition: RuleCondition) => void;
  onEditScript: RuleEditorProperties["onEditScript"];
}

function ConditionEditor(properties: ConditionEditorProperties) {
  const { condition, stage, vocabulary, depth, onChange } = properties;
  const { t } = useTranslation();
  const typeId = useId();
  const types = vocabulary.conditions.filter(
    (type) =>
      conditionAllowedAt(type, stage) &&
      (depth < DEEPEST_NESTING || (type !== "ALL" && type !== "ANY" && type !== "NOT")),
  );
  return (
    <div className={CONDITION}>
      <div className={FIELD}>
        {/* The «When» legend names the outermost chooser; a nested one says what it is. */}
        <label htmlFor={typeId} className={depth > 1 ? LABEL : "sr-only"}>
          {t("contentSteps.conditionType", "Condition")}
        </label>
        <Select
          id={typeId}
          value={condition.type}
          onChange={(event) => onChange(newCondition(event.target.value as ConditionType, stage))}
        >
          {types.map((type) => (
            <option key={type} value={type}>
              {conditionTypeName(type, t)}
            </option>
          ))}
        </Select>
      </div>
      <ConditionValues {...properties} />
    </div>
  );
}

function ConditionValues({
  condition,
  stage,
  vocabulary,
  scripts,
  ruleName,
  depth,
  onChange,
  onEditScript,
}: ConditionEditorProperties) {
  const { t } = useTranslation();
  switch (condition.type) {
    case "ALWAYS":
      return null;
    case "FIELD":
      return (
        <FieldComparison
          condition={condition}
          stage={stage}
          vocabulary={vocabulary}
          onChange={onChange}
        />
      );
    case "PATH":
      return (
        <PatternChips
          patterns={condition.patterns}
          onChange={(patterns) => onChange({ ...condition, patterns })}
        />
      );
    case "PATTERN":
      return (
        <ListField
          label={t("profiles.content.patternsLabel", "Patterns")}
          hint={t(
            "rules.rule.patternsHint",
            "Regular expressions; the rule acts when any of them finds something in the text.",
          )}
          values={condition.patterns}
          code
          onChange={(patterns) => onChange({ ...condition, patterns })}
        />
      );
    case "CONTAINS_WORDS":
      return (
        <LinesField
          label={t("contentSteps.stopWordsLabel", "Stop words")}
          hint={t(
            "rules.rule.stopWordsHint",
            "One per line. The rule applies when the text holds any of them as a whole word, case ignored.",
          )}
          values={condition.words}
          onChange={(words) => onChange({ ...condition, words })}
        />
      );
    case "WORD_LIST":
      return (
        <LinesField
          label={t("contentSteps.wordsLabel", "Lines")}
          hint={t(
            "contentSteps.wordsHint",
            "One per line. The whole text must be one of them, case ignored.",
          )}
          values={condition.words}
          onChange={(words) => onChange({ ...condition, words })}
        />
      );
    case "SHORTER_THAN":
    case "LONGER_THAN":
      return (
        <NumberField
          label={t("contentSteps.characters", "Characters")}
          value={condition.characters}
          minimum={1}
          onChange={(characters) => onChange({ ...condition, characters })}
        />
      );
    case "REPEATS":
      return (
        <>
          <NumberField
            label={t("contentSteps.timesLabel", "Repeats")}
            hint={t("contentSteps.timesHint", "At least this many times in the document.")}
            value={condition.times}
            minimum={2}
            onChange={(times) => onChange({ ...condition, times })}
          />
          <Checkbox
            label={t(
              "contentSteps.ignoreDigits",
              "Numbers aside — «Page 3» and «Page 4» are the same line",
            )}
            checked={condition.ignoreDigits}
            onChange={(event) => onChange({ ...condition, ignoreDigits: event.target.checked })}
          />
        </>
      );
    case "SCRIPT":
      return (
        <ScriptChoice
          condition={condition}
          stage={stage}
          scripts={scripts}
          ruleName={ruleName}
          onChange={onChange}
          onEditScript={onEditScript}
        />
      );
    case "ALL":
    case "ANY":
      return (
        <div className={NESTED}>
          {condition.conditions.map((inner, index) => (
            <div key={index} className={NESTED_ITEM}>
              <ConditionEditor
                condition={inner}
                stage={stage}
                vocabulary={vocabulary}
                scripts={scripts}
                ruleName={ruleName}
                depth={depth + 1}
                onChange={(next) =>
                  onChange({
                    ...condition,
                    conditions: condition.conditions.map((existing, position) =>
                      position === index ? next : existing,
                    ),
                  })
                }
                onEditScript={onEditScript}
              />
              {condition.conditions.length > 1 && (
                <Button
                  variant="quiet"
                  icon="close"
                  iconOnly
                  aria-label={t("contentSteps.removeCondition", "Remove this condition")}
                  onClick={() =>
                    onChange({
                      ...condition,
                      conditions: condition.conditions.filter((_, position) => position !== index),
                    })
                  }
                />
              )}
            </div>
          ))}
          <div>
            <Button
              variant="quiet"
              icon="plus"
              onClick={() =>
                onChange({
                  ...condition,
                  conditions: [...condition.conditions, newCondition("ALWAYS", stage)],
                })
              }
            >
              {t("contentSteps.addCondition", "Add a condition")}
            </Button>
          </div>
        </div>
      );
    case "NOT":
      return (
        <div className={NESTED}>
          <ConditionEditor
            condition={condition.condition}
            stage={stage}
            vocabulary={vocabulary}
            scripts={scripts}
            ruleName={ruleName}
            depth={depth + 1}
            onChange={(inner) => onChange({ ...condition, condition: inner })}
            onEditScript={onEditScript}
          />
        </div>
      );
  }
}

/** A fact, how it compares and the values it compares with; a block kind is chosen from the kinds parsers mark. */
function FieldComparison({
  condition,
  stage,
  vocabulary,
  onChange,
}: {
  condition: Extract<RuleCondition, { type: "FIELD" }>;
  stage: StageView;
  vocabulary: RuleVocabulary;
  onChange: (condition: RuleCondition) => void;
}) {
  const { t } = useTranslation();
  const factId = useId();
  const operatorId = useId();
  const numeric = NUMERIC_FACTS.includes(condition.fact);
  const operators = numeric ? NUMERIC_OPERATORS : TEXT_OPERATORS;
  const changeFact = (fact: RuleFact) => {
    const nowNumeric = NUMERIC_FACTS.includes(fact);
    const operator = (nowNumeric ? NUMERIC_OPERATORS : TEXT_OPERATORS).includes(condition.operator)
      ? condition.operator
      : nowNumeric
        ? "GREATER_THAN"
        : "CONTAINS";
    const values =
      fact === "BLOCK_KIND"
        ? ["PAGE_FURNITURE"]
        : nowNumeric !== numeric
          ? [nowNumeric ? "0" : ""]
          : condition.values;
    onChange({ ...condition, fact, operator: fact === "BLOCK_KIND" ? "EQUALS" : operator, values });
  };
  return (
    <>
      <div className={COMPARISON}>
        <div className={FIELD}>
          <label htmlFor={factId} className={LABEL}>
            {t("rules.rule.fact", "Fact")}
          </label>
          <Select
            id={factId}
            value={condition.fact}
            onChange={(event) => changeFact(event.target.value as RuleFact)}
          >
            {fieldFactsAt(stage).map((fact) => (
              <option key={fact} value={fact}>
                {factName(fact, t)}
              </option>
            ))}
          </Select>
        </div>
        {condition.fact !== "BLOCK_KIND" && (
          <div className={FIELD}>
            <label htmlFor={operatorId} className={LABEL}>
              {t("sourceRules.condition.comparison", "Comparison")}
            </label>
            <Select
              id={operatorId}
              value={condition.operator}
              onChange={(event) =>
                onChange({ ...condition, operator: event.target.value as FieldOperator })
              }
            >
              {operators.map((operator) => (
                <option key={operator} value={operator}>
                  {operatorName(operator, numeric, t)}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
      {condition.fact === "BLOCK_KIND" ? (
        <div className={FIELD}>
          <span className={LABEL}>
            {t("contentSteps.kinds", "Block kinds, as parsers mark them")}
          </span>
          <div
            className={CHECKBOX_GRID}
            role="group"
            aria-label={t("contentSteps.kinds", "Block kinds, as parsers mark them")}
          >
            {vocabulary.blockKinds.map((kind) => (
              <Checkbox
                key={kind}
                label={kind}
                checked={condition.values.includes(kind)}
                onChange={(event) => {
                  const kinds = event.target.checked
                    ? [...condition.values, kind]
                    : condition.values.filter((candidate) => candidate !== kind);
                  onChange({
                    ...condition,
                    values: vocabulary.blockKinds.filter((candidate) => kinds.includes(candidate)),
                  });
                }}
              />
            ))}
          </div>
        </div>
      ) : numeric && condition.operator !== "EQUALS" ? (
        <NumberField
          label={t("sourceRules.condition.value", "Value")}
          value={Number.parseInt(condition.values[0] ?? "0", 10) || 0}
          minimum={0}
          onChange={(value) => onChange({ ...condition, values: [String(value)] })}
        />
      ) : (
        <ListField
          label={t("rules.rule.values", "Values")}
          hint={t("rules.rule.valuesHint", "The rule acts when any of them compares true.")}
          values={condition.values.filter((value) => value !== "")}
          code
          onChange={(values) => onChange({ ...condition, values })}
        />
      )}
    </>
  );
}

/** The rule script a script condition runs — of the kind its stage runs — with the way to write or change one. */
function ScriptChoice({
  condition,
  stage,
  scripts,
  ruleName,
  onChange,
  onEditScript,
}: {
  condition: Extract<RuleCondition, { type: "SCRIPT" }>;
  stage: StageView;
  scripts: ScriptView[];
  ruleName: string;
  onChange: (condition: RuleCondition) => void;
  onEditScript: RuleEditorProperties["onEditScript"];
}) {
  const { t } = useTranslation();
  const scriptId = useId();
  const kind = stage.scriptKind ?? "";
  const ofKind = scripts.filter((script) => script.stage === kind);
  const chosen =
    ofKind.find((script) => script.title.toLowerCase() === condition.script.toLowerCase()) ?? null;
  return (
    <>
      <div className={SCRIPT_ROW}>
        <div className={FIELD}>
          <label htmlFor={scriptId} className={LABEL}>
            {t("sourceRules.script.label", "Rule script")}
          </label>
          <Select
            id={scriptId}
            value={chosen?.title ?? ""}
            onChange={(event) => onChange({ ...condition, script: event.target.value })}
          >
            <option value="" disabled>
              {t("sourceRules.script.choose", "Choose a rule script…")}
            </option>
            {ofKind.map((script) => (
              <option key={script.id} value={script.title}>
                {script.activeVersionId === null
                  ? t("sourceRules.script.notActivatedOption", "{title} (not activated)", {
                      title: script.title,
                    })
                  : script.title}
              </option>
            ))}
          </Select>
        </div>
        {chosen !== null && (
          <Button
            variant="quiet"
            icon="code"
            onClick={() => onEditScript(kind, chosen, chosen.title)}
          >
            {t("sourceRules.script.edit", "Edit script")}
          </Button>
        )}
        <Button
          variant="quiet"
          icon="plus"
          onClick={() =>
            onEditScript(kind, null, ruleName || t("rules.rule.scriptName", "Rule script"))
          }
        >
          {t("sourceRules.script.new", "New rule script")}
        </Button>
      </div>
      <span className={HINT}>
        {stage.stage === "MATERIAL"
          ? t(
              "sourceRules.script.hint",
              "Refuses a file the rules above are taking. Variables it sets last the whole scan.",
            )
          : t(
              "rules.rule.contentScriptHint",
              "Holds when the script refuses the block or chunk. It runs once per block or chunk the rules above are keeping.",
            )}
      </span>
      {condition.script !== "" && chosen === null && (
        <p className={WARNING}>
          {t(
            "sourceRules.script.missing",
            "No rule script is called “{name}”. Choose one, or create it.",
            { name: condition.script },
          )}
        </p>
      )}
      {chosen !== null && chosen.activeVersionId === null && (
        <p className={WARNING}>
          {t(
            "rules.rule.scriptNeverActivated",
            "“{title}” has never been activated, so the rule fails when it runs.",
            { title: chosen.title },
          )}
        </p>
      )}
      <Checkbox
        label={t("rules.rule.failureStops", "A failing script stops the scan or the job")}
        checked={condition.failurePolicy === "STOP"}
        onChange={(event) => {
          const failurePolicy: FailurePolicy = event.target.checked ? "STOP" : "IGNORE";
          onChange({ ...condition, failurePolicy });
        }}
      />
    </>
  );
}

function ActionEditor({
  action,
  stage,
  vocabulary,
  onChange,
}: {
  action: RuleAction;
  stage: StageView;
  vocabulary: RuleVocabulary;
  onChange: (action: RuleAction) => void;
}) {
  const { t } = useTranslation();
  const typeId = useId();
  return (
    <div className={CONDITION}>
      <div className={FIELD}>
        {/* The «Then» legend above is this control's label; repeating the word beside it only thickened the form. */}
        <label htmlFor={typeId} className="sr-only">
          {t("contentSteps.actionType", "Action")}
        </label>
        <Select
          id={typeId}
          value={action.type}
          onChange={(event) => onChange(newAction(event.target.value as ActionType))}
        >
          {vocabulary.actions
            .filter((type) => actionAllowedAt(type, stage))
            .map((type) => (
              <option key={type} value={type}>
                {actionTypeName(type, t)}
              </option>
            ))}
        </Select>
      </div>
      {(action.type === "DEFINE_ENTITY" || action.type === "LINK_ENTITY") && (
        <>
          <TextField
            label={t("rules.semantic.namespace", "Namespace")}
            value={action.namespace}
            onChange={(namespace) => onChange({ ...action, namespace })}
          />
          <TextField
            label={t("rules.semantic.key", "Entity key")}
            value={action.key}
            onChange={(key) => onChange({ ...action, key })}
          />
          {action.type === "DEFINE_ENTITY" && (
            <>
              <TextField
                label={t("rules.semantic.name", "Entity name")}
                value={action.name}
                onChange={(name) => onChange({ ...action, name })}
              />
              <TextField
                label={t("rules.semantic.kind", "Entity kind")}
                value={action.kind}
                onChange={(kind) => onChange({ ...action, kind })}
              />
            </>
          )}
          {action.type === "LINK_ENTITY" && (
            <TextField
              label={t("rules.semantic.role", "Relation role")}
              value={action.role}
              onChange={(role) => onChange({ ...action, role })}
            />
          )}
          <p className={HINT}>
            {t(
              "rules.semantic.provenance",
              "Matched facts retain this block as evidence and the rule set revision as provenance.",
            )}
          </p>
        </>
      )}
      {action.type === "NORMALISE" && (
        <div className={FIELD}>
          <span className={LABEL}>{t("profiles.content.operations", "Rewrites")}</span>
          <div
            className={CHECKBOX_GRID}
            role="group"
            aria-label={t("profiles.content.operations", "Rewrites")}
          >
            {vocabulary.normalisations.map((normalisation) => (
              <Checkbox
                key={normalisation}
                label={normalisationName(normalisation, t)}
                checked={action.normalisations.includes(normalisation)}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...action.normalisations, normalisation]
                    : action.normalisations.filter((candidate) => candidate !== normalisation);
                  onChange({
                    ...action,
                    normalisations: vocabulary.normalisations.filter((candidate) =>
                      next.includes(candidate),
                    ),
                  });
                }}
              />
            ))}
          </div>
        </div>
      )}
      {action.type === "REPLACE" && (
        <>
          <ListField
            label={t("profiles.content.patternsLabel", "Patterns")}
            hint={t(
              "rules.rule.replacePatternsHint",
              "Regular expressions; everything any of them finds is replaced.",
            )}
            values={action.patterns}
            code
            onChange={(patterns) => onChange({ ...action, patterns })}
          />
          <TextField
            label={t("contentSteps.replacement", "Replace with")}
            hint={t("contentSteps.replacementHint", "Taken literally; empty removes what matches.")}
            value={action.replacement}
            onChange={(replacement) => onChange({ ...action, replacement })}
          />
        </>
      )}
      {action.type === "REMOVE_WORDS" && (
        <LinesField
          label={t("profiles.content.wordsLabel", "Words")}
          hint={t("profiles.content.wordsHint", "One per line.")}
          values={action.words}
          onChange={(words) => onChange({ ...action, words })}
        />
      )}
    </div>
  );
}

// ⚠️ A label names the field; it never explains it. A sentence used as a label sets the width of the column it sits in
// and pushes every control out of line with the one above. The explanation goes under the control, as a hint.

/** A short list of values, each a chip: patterns, compared values. */
function ListField({
  label,
  hint,
  values,
  code = false,
  onChange,
}: {
  label: string;
  hint?: string;
  values: string[];
  code?: boolean;
  onChange: (values: string[]) => void;
}) {
  const controlId = useId();
  const hintId = useId();
  const { t } = useTranslation();
  return (
    <div className={FIELD}>
      <label htmlFor={controlId} className={LABEL}>
        {label}
      </label>
      <ChipInput
        id={controlId}
        values={values}
        onChange={onChange}
        listLabel={label}
        addLabel={t("rules.rule.addValue", "Add a value")}
        removeLabel={(value) => t("rules.rule.removeValue", "Remove {value}", { value })}
        code={code}
        aria-describedby={hint === undefined ? undefined : hintId}
      />
      {hint !== undefined && (
        <span id={hintId} className={HINT}>
          {hint}
        </span>
      )}
    </div>
  );
}

/** A long list, one entry per line — word lists run to hundreds of entries, which a chip row cannot hold. */
function LinesField({
  label,
  hint,
  values,
  onChange,
}: {
  label: string;
  hint?: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const controlId = useId();
  const hintId = useId();
  return (
    <div className={FIELD}>
      <label htmlFor={controlId} className={LABEL}>
        {label}
      </label>
      <TextArea
        id={controlId}
        rows={3}
        value={values.join("\n")}
        aria-describedby={hint === undefined ? undefined : hintId}
        onChange={(event) => onChange(event.target.value.split("\n"))}
      />
      {hint !== undefined && (
        <span id={hintId} className={HINT}>
          {hint}
        </span>
      )}
    </div>
  );
}

function NumberField({
  label,
  hint,
  value,
  minimum,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  minimum: number;
  onChange: (value: number) => void;
}) {
  const controlId = useId();
  const hintId = useId();
  return (
    <div className={FIELD}>
      <label htmlFor={controlId} className={LABEL}>
        {label}
      </label>
      <Input
        id={controlId}
        type="number"
        min={minimum}
        className="numeric"
        value={String(value)}
        aria-describedby={hint === undefined ? undefined : hintId}
        onChange={(event) =>
          onChange(Math.max(minimum, Number.parseInt(event.target.value || String(minimum), 10)))
        }
      />
      {hint !== undefined && (
        <span id={hintId} className={HINT}>
          {hint}
        </span>
      )}
    </div>
  );
}

function TextField({
  label,
  hint = "",
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const controlId = useId();
  const hintId = useId();
  return (
    <div className={FIELD}>
      <label htmlFor={controlId} className={LABEL}>
        {label}
      </label>
      <Input
        id={controlId}
        value={value}
        maxLength={1024}
        aria-describedby={hintId}
        onChange={(event) => onChange(event.target.value)}
      />
      <span id={hintId} className={HINT}>
        {hint}
      </span>
    </div>
  );
}
