import { Link } from "@tanstack/react-router";
import { useReadySession } from "../../application/session";
import { useResource } from "../../application/useResource";
import { ruleSetsApi, type RuleAction, type Rule, type RuleStage } from "../../lib/ruleSets";
import type { ProfileConfiguration } from "../../lib/profiles";
import { useTranslation } from "../../translations/TranslationProvider";
import { Waiting } from "../../ui/components";
import { Badge } from "../../ui/primitives";
import { describeAction, describeCondition, stageName } from "../rules/ruleWords";

const LIST = "m-0 grid list-none gap-1 p-0";
const ROW = "grid grid-cols-[calc(130px*var(--ui-scale))_minmax(0,1fr)] items-baseline gap-3 text-xs max-[700px]:grid-cols-1 max-[700px]:gap-0.5";

/** The actions that rewrite text rather than decide about it. */
const REWRITING: ReadonlySet<RuleAction["type"]> = new Set(["NORMALISE", "REPLACE", "REMOVE_WORDS"]);

interface Transform {
  ruleSetId: string;
  ruleSetName: string;
  rule: Rule;
}

/**
 * The rules that rewrite a profile's text before it is indexed — normalising, replacing by a pattern, removing words —
 * read from the rule sets the profile binds, at the stages asked for. They change only what is indexed and embedded:
 * the stored original, the chunk slices and every citation stay exact.
 */
export function TextTransforms({
  configuration,
  stages,
  includeDecisions = false,
}: {
  configuration: ProfileConfiguration;
  stages: RuleStage[];
  /** Also the rules that keep, drop or send for review — every rule of the stage, as a layer shows it. */
  includeDecisions?: boolean;
}) {
  const { t } = useTranslation();
  const { workspace } = useReadySession();
  const workspaceId = workspace?.id ?? "";
  const preparation = configuration.preparation as { ruleSetIds?: unknown } | undefined;
  const ruleSetIds = Array.isArray(preparation?.ruleSetIds) ? (preparation.ruleSetIds as string[]) : [];

  const transforms = useResource<Transform[]>(async () => {
    const ruleSets = await Promise.all(ruleSetIds.map((ruleSetId) => ruleSetsApi.get(workspaceId, ruleSetId).catch(() => null)));
    return ruleSets.flatMap((ruleSet) =>
      ruleSet === null
        ? []
        : ruleSet.configuration.rules
            .filter((rule) => rule.enabled && stages.includes(rule.stage) && (includeDecisions || REWRITING.has(rule.action.type)))
            .map((rule) => ({ ruleSetId: ruleSet.id, ruleSetName: ruleSet.name, rule })),
    );
  }, [workspaceId, ruleSetIds.join(","), stages.join(","), includeDecisions]);

  if (transforms.status === "loading") {
    return <Waiting label={t("transforms.loading", "Reading the profile's rules")} lines={2} />;
  }
  if (transforms.status === "failed") {
    return null;
  }
  if (transforms.data.length === 0) {
    return (
      <p className="m-0 text-xs text-secondary">
        {includeDecisions
          ? t("transforms.noneAtLayer", "No rule of the bound rule sets works at this layer.")
          : t(
          "transforms.none",
          "Nothing rewrites the text before it is indexed. Normalising whitespace or Unicode, replacing what a pattern finds, or removing words is a rule with a rewriting action in a rule set bound to this profile.",
          )}{" "}
        <Link to="/rules" className="font-semibold text-accent-text hover:underline">
          {t("transforms.ruleSets", "Rule sets")}
        </Link>
      </p>
    );
  }
  return (
    <ol className={LIST}>
      {transforms.data.map((transform) => (
        <li key={`${transform.ruleSetId}-${transform.rule.order}`} className={ROW}>
          <Badge tone="pipeline">{stageName(transform.rule.stage, t)}</Badge>
          <span>
            <strong className="font-semibold text-ink">{transform.rule.name}</strong>
            <span className="text-secondary">
              {" — "}
              {describeCondition(transform.rule.condition, t)} → {describeAction(transform.rule.action, t)}
            </span>{" "}
            <Link to="/rules/$ruleSetId" params={{ ruleSetId: transform.ruleSetId }} className="text-accent-text hover:underline">
              {transform.ruleSetName}
            </Link>
          </span>
        </li>
      ))}
    </ol>
  );
}
