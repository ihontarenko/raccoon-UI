import { useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { ListedRuleSet, RuleSetHolder, RuleStage } from "../../lib/ruleSets";
import { useTranslation } from "../../translations/TranslationProvider";
import { EditorCard, EditorCardList } from "../../ui/components";
import { Badge, Button, Select } from "../../ui/primitives";
import { BINDING, BINDING_ADD, FIELD, LABEL, WARNING } from "./ruleSetsClasses";
import { placeTone, stageName } from "./ruleWords";

interface PolicyBindingListProperties {
  /** What is binding: a source runs a rule set's rules at the door, a processing profile its rules in the pipeline. */
  holder: RuleSetHolder;
  /** Every rule set of the workspace. */
  ruleSets: ListedRuleSet[];
  /** The bound rule sets, in the order their rules run. */
  boundIds: string[];
  editable: boolean;
  onChange: (boundIds: string[]) => void;
}

/** The stages a holder runs: the door for a source, everything after it for a profile. */
function runsHere(holder: RuleSetHolder, stage: RuleStage): boolean {
  return holder === "SOURCE" ? stage === "MATERIAL" : stage !== "MATERIAL";
}

/**
 * The rule sets a source or a processing profile binds — the same list in both places, every rule set a link to the one page
 * where its rules are edited.
 *
 * ⚠️ NOTHING IS EDITED HERE BUT THE LIST. A rule lives in its rule set, and a rule set may be bound by several sources and
 * profiles at once; editing it in place would be editing it for all of them from a screen that names only one.
 */
export function RuleSetBindingList({
  holder,
  ruleSets,
  boundIds,
  editable,
  onChange,
}: PolicyBindingListProperties) {
  const { t, plural } = useTranslation();
  const addId = useId();
  const [adding, setAdding] = useState("");
  const byId = new Map(ruleSets.map((ruleSet) => [ruleSet.id, ruleSet]));
  const offered = ruleSets.filter((ruleSet) => !boundIds.includes(ruleSet.id));

  const move = (index: number, direction: -1 | 1) => {
    const next = [...boundIds];
    const to = index + direction;
    if (to < 0 || to >= next.length) {
      return;
    }
    [next[index], next[to]] = [next[to], next[index]];
    onChange(next);
  };

  const unbind = (index: number) => onChange(boundIds.filter((_identifier, at) => at !== index));

  return (
    <div className={BINDING}>
      {boundIds.length === 0 ? (
        <p className="m-0 text-xs text-muted">
          {holder === "SOURCE"
            ? t(
                "rules.binding.noneSource",
                "No rule set bound: every file this source finds or receives is taken.",
              )
            : t(
                "rules.binding.noneProfile",
                "No rule set bound: everything the parser read is indexed as it is.",
              )}
        </p>
      ) : (
        <EditorCardList
          label={t("rules.binding.list", "Bound rule sets, in the order their rules run")}
        >
          {boundIds.map((identifier, index) => {
            const ruleSet = byId.get(identifier);
            const name =
              ruleSet?.name ?? t("rules.binding.gone", "A rule set that no longer exists");
            const stagesHere =
              ruleSet === undefined ? [] : ruleSet.stages.filter((stage) => runsHere(holder, stage));
            return (
              <EditorCard
                key={identifier}
                ordinal={index + 1}
                tone={ruleSet === undefined || stagesHere.length === 0 ? "warn" : "neutral"}
                title={
                  ruleSet === undefined ? (
                    <span className="text-warn">{name}</span>
                  ) : (
                    <Link to="/rules/$ruleSetId" params={{ ruleSetId: ruleSet.id }}>
                      {ruleSet.name}
                    </Link>
                  )
                }
                marks={
                  stagesHere.length > 0 ? (
                    <>
                      {stagesHere.map((stage) => (
                        <Badge key={stage} tone={placeTone(stage)}>
                          {stageName(stage, t)}
                        </Badge>
                      ))}
                    </>
                  ) : undefined
                }
                summary={
                  ruleSet === undefined ? undefined : stagesHere.length === 0 ? (
                    <span className={WARNING}>
                      {holder === "SOURCE"
                        ? t(
                            "rules.binding.nothingAtDoor",
                            "It has no rules at the door, so it does nothing on a source.",
                          )
                        : t(
                            "rules.binding.nothingInPipeline",
                            "It has only rules at the door, so it does nothing in a profile.",
                          )}
                    </span>
                  ) : (
                    plural("rules.binding.ruleCount", ruleSet.rules, {
                      one: "{count} rule",
                      other: "{count} rules",
                    }) +
                    (ruleSet.usedBy.length > 1
                      ? ` · ${t("rules.binding.shared", "also bound by {count} more", { count: String(ruleSet.usedBy.length - 1) })}`
                      : "")
                  )
                }
                actions={{
                  moveUp: {
                    label: t("rules.binding.earlier", "Run «{name}» earlier", { name }),
                    disabled: !editable || index === 0,
                    onClick: () => move(index, -1),
                  },
                  moveDown: {
                    label: t("rules.binding.later", "Run «{name}» later", { name }),
                    disabled: !editable || index === boundIds.length - 1,
                    onClick: () => move(index, 1),
                  },
                  remove: {
                    label: t("rules.binding.unbind", "Stop running «{name}»", { name }),
                    onClick: () => unbind(index),
                  },
                }}
              />
            );
          })}
        </EditorCardList>
      )}

      {editable && (
        <div className={BINDING_ADD}>
          <div className={FIELD}>
            <label htmlFor={addId} className={LABEL}>
              {t("rules.binding.add", "Bind a rule set")}
            </label>
            <Select id={addId} value={adding} onChange={(event) => setAdding(event.target.value)}>
              <option value="">{t("rules.binding.choose", "Choose a rule set…")}</option>
              {offered.map((ruleSet) => (
                <option key={ruleSet.id} value={ruleSet.id}>
                  {ruleSet.name}
                  {ruleSet.stages.some((stage) => runsHere(holder, stage))
                    ? ""
                    : ` — ${t("rules.binding.noRulesHereOption", "no rules here")}`}
                </option>
              ))}
            </Select>
          </div>
          <Button
            icon="plus"
            disabled={adding === ""}
            onClick={() => {
              onChange([...boundIds, adding]);
              setAdding("");
            }}
          >
            {t("rules.binding.bind", "Bind")}
          </Button>
          <Button href="/rules" variant="quiet" icon="arrow">
            {t("rules.binding.all", "All rule sets")}
          </Button>
        </div>
      )}
    </div>
  );
}
