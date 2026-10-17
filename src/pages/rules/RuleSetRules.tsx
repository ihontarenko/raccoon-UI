import { useState } from "react";
import {
  newRule,
  type RuleSetBinding,
  type Rule,
  type RuleStage,
  type RuleVocabulary,
} from "../../lib/ruleSets";
import type { ScriptView } from "../../lib/sourceContracts";
import { useTranslation } from "../../translations/TranslationProvider";
import { EditorCard, EditorCardList } from "../../ui/components";
import { Badge, Button, Checkbox } from "../../ui/primitives";
import { RuleEditor, stageOf } from "./RuleEditor";
import {
  ROW_DISCLOSURE,
  STAGE_GROUP,
  STAGE_HEAD,
  STAGE_PURPOSE,
  STAGE_TITLE,
  WARNING,
} from "./ruleSetsClasses";
import {
  describeRule,
  placeTone,
  stageName,
  stagePlace,
  stagePurpose,
  verdictOf,
} from "./ruleWords";

interface PolicyRulesProperties {
  rules: Rule[];
  vocabulary: RuleVocabulary;
  scripts: ScriptView[];
  /** What binds the rule set — the stage headings say which of them runs each stage's rules. */
  usedBy: RuleSetBinding[];
  editable: boolean;
  onChange: (rules: Rule[]) => void;
  onEditScript: (kind: string, script: ScriptView | null, suggestedName: string) => void;
}

/**
 * A rule set's rules, grouped by the stage they run at, in the order a document meets the stages — every rule the same
 * card with the same editor, at the door and in the pipeline alike.
 *
 * ⚠️ EVERY STAGE IS SHOWN, INCLUDING THE EMPTY ONES. Which stages exist is a fact about the product, not about this
 * rule set, and a stage that only appears once it holds something is a stage nobody discovers. Each heading says what a
 * rule there sees and who runs it, and carries the control that adds to it.
 */
export function RuleSetRules({
  rules,
  vocabulary,
  scripts,
  usedBy,
  editable,
  onChange,
  onEditScript,
}: PolicyRulesProperties) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<number | null>(null);

  const replace = (index: number, rule: Rule) => {
    const next = rules.map((current, at) => (at === index ? rule : current));
    // A rule moved to another stage is moved to the end of the list, so it lands last in its new stage rather than
    // wherever its old position happened to fall among the new stage's rules.
    if (rule.stage !== rules[index].stage) {
      const moved = [...next.slice(0, index), ...next.slice(index + 1), rule];
      onChange(renumbered(moved));
      setEditing(moved.length - 1);
      return;
    }
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(renumbered(rules.filter((_rule, at) => at !== index)));
    setEditing(null);
  };

  /** Swaps a rule with its neighbour in the same stage — the only order that changes what a rule sees. */
  const move = (index: number, direction: -1 | 1) => {
    const sameStage = rules
      .map((rule, at) => ({ rule, at }))
      .filter(({ rule }) => rule.stage === rules[index].stage);
    const position = sameStage.findIndex(({ at }) => at === index);
    const neighbour = sameStage[position + direction];
    if (neighbour === undefined) {
      return;
    }
    const next = [...rules];
    [next[index], next[neighbour.at]] = [next[neighbour.at], next[index]];
    onChange(renumbered(next));
    setEditing(editing === index ? neighbour.at : editing);
  };

  const add = (stage: RuleStage) => {
    const rule = newRule(stageOf(vocabulary, stage), (rules.length + 1) * 10);
    onChange(renumbered([...rules, rule]));
    setEditing(rules.length);
  };

  return (
    <>
      {vocabulary.stages.map((stage) => {
        const here = rules
          .map((rule, index) => ({ rule, index }))
          .filter(({ rule }) => rule.stage === stage.stage);
        const runners = usedBy.filter((binding) => binding.holder === stage.holder);
        const headingId = `stage-${stage.stage.toLowerCase()}`;
        return (
          <section key={stage.stage} className={STAGE_GROUP} aria-labelledby={headingId}>
            <div className={STAGE_HEAD}>
              <h3 id={headingId} className={STAGE_TITLE}>
                <Badge tone={placeTone(stage.stage)}>{stagePlace(stage.stage, t)}</Badge>
                {stageName(stage.stage, t)}
                {here.length > 0 && (
                  <span className="numeric text-xs font-normal text-muted">{here.length}</span>
                )}
              </h3>
              {editable && (
                <Button variant="quiet" icon="plus" flush onClick={() => add(stage.stage)}>
                  {t("rules.rules.add", "Add a rule")}
                </Button>
              )}
            </div>
            <p className={STAGE_PURPOSE}>{stagePurpose(stage.stage, t)}</p>
            {here.length > 0 && runners.length === 0 && (
              <p className={WARNING}>
                {stage.holder === "SOURCE"
                  ? t(
                      "rules.rules.noSource",
                      "No source binds this rule set, so these rules run nowhere yet. Bind it on a source's Rules tab.",
                    )
                  : t(
                      "rules.rules.noProfile",
                      "No processing profile binds this rule set, so these rules run nowhere yet. Bind it in a processing profile's content section.",
                    )}
              </p>
            )}
            {here.length > 0 && (
              <EditorCardList label={stageName(stage.stage, t)}>
                {here.map(({ rule, index }, position) => {
                  const open = editing === index;
                  const verdict = verdictOf(rule.action, t);
                  const name =
                    rule.name.trim() === ""
                      ? t("rules.rules.unnamed", "Unnamed rule")
                      : rule.name;
                  return (
                    <EditorCard
                      key={index}
                      ordinal={position + 1}
                      resting={!rule.enabled}
                      tone={
                        verdict?.tone === "allow"
                          ? "allow"
                          : verdict?.tone === "deny"
                            ? "deny"
                            : verdict?.tone === "warn"
                              ? "warn"
                              : "neutral"
                      }
                      toggle={
                        <Checkbox
                          label={
                            <span className="sr-only">
                              {t("rules.rules.runs", "«{name}» runs", { name })}
                            </span>
                          }
                          checked={rule.enabled}
                          disabled={!editable}
                          onChange={(event) =>
                            replace(index, { ...rule, enabled: event.target.checked })
                          }
                        />
                      }
                      title={
                        <button
                          type="button"
                          className={ROW_DISCLOSURE}
                          aria-expanded={open}
                          onClick={() => setEditing(open ? null : index)}
                        >
                          {name}
                        </button>
                      }
                      marks={
                        verdict === null ? (
                          <Badge>{t("rules.verdict.rewrites", "Rewrites")}</Badge>
                        ) : (
                          <Badge tone={verdict.tone}>{verdict.word}</Badge>
                        )
                      }
                      summary={describeRule(rule, t)}
                      actions={{
                        moveUp: {
                          label: t("rules.rules.earlier", "Run «{name}» earlier", { name }),
                          disabled: !editable || position === 0,
                          onClick: () => move(index, -1),
                        },
                        moveDown: {
                          label: t("rules.rules.later", "Run «{name}» later", { name }),
                          disabled: !editable || position === here.length - 1,
                          onClick: () => move(index, 1),
                        },
                        remove: {
                          label: t("rules.rules.remove", "Remove «{name}»", { name }),
                          onClick: () => remove(index),
                        },
                      }}
                    >
                      {open ? (
                        <RuleEditor
                          rule={rule}
                          vocabulary={vocabulary}
                          scripts={scripts}
                          onChange={(next) => replace(index, next)}
                          onEditScript={onEditScript}
                        />
                      ) : undefined}
                    </EditorCard>
                  );
                })}
              </EditorCardList>
            )}
          </section>
        );
      })}
    </>
  );
}

/** Orders as the server stores them: the list's own order, in tens, so a rule inserted by hand later has room. */
export function renumbered(rules: Rule[]): Rule[] {
  return rules.map((rule, index) => ({ ...rule, order: (index + 1) * 10 }));
}
