import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useReadySession } from "../../application/session";
import { useResource } from "../../application/useResource";
import { ruleSetsApi, type ListedRuleSet, type Rule, type RuleStage } from "../../lib/ruleSets";
import { useTranslation } from "../../translations/TranslationProvider";
import { ProblemState, Waiting } from "../../ui/components";
import { Badge, Button } from "../../ui/primitives";
import { describeAction, describeCondition, stageName, stagePurpose } from "./ruleWords";

const FLOW = "m-0 grid list-none gap-0 p-0";
const STAGE = "grid gap-2 border-l-2 border-l-accent py-3 pl-4";
/* A step of the path where no rule can work — the parser, the chunker: drawn as a quiet waypoint so the order reads. */
const WAYPOINT = "flex flex-wrap items-baseline gap-x-2 border-l-2 border-dashed border-l-line-strong py-2 pl-4 text-xs text-muted";
const BRANCH_HEAD = "list-none pt-3 pb-1 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase";
const BRANCHES = "grid list-none grid-cols-2 gap-4 max-[900px]:grid-cols-1";
const STAGE_HEAD = "flex flex-wrap items-center gap-x-3 gap-y-1";
const RULES = "m-0 grid list-none gap-1 p-0";
const RULE = "flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs data-[enabled=false]:opacity-50";
const ADD_ROW = "flex flex-wrap items-center gap-2 rounded-control border border-line bg-well px-3 py-2 text-xs";

const REWRITING = new Set<Rule["action"]["type"]>(["NORMALISE", "REPLACE", "REMOVE_WORDS"]);

interface Placed {
  ruleSet: ListedRuleSet;
  rule: Rule;
}

/**
 * Every rule of every rule set on the path a document takes, top to bottom: at the door, after parsing, after cutting,
 * then the two branches each chunk feeds at once — keyword text and vector text — and finally the query at search time.
 * A stage with nothing is shown empty, so it is plain where a new rule would land, and «+ Rule here» opens the chosen
 * rule set with a new rule already at that stage.
 */
export function RuleFlow({ ruleSets, editable }: { ruleSets: ListedRuleSet[]; editable: boolean }) {
  const { t } = useTranslation();
  const { workspace } = useReadySession();
  const workspaceId = workspace?.id ?? "";
  const navigate = useNavigate();
  const [addingAt, setAddingAt] = useState<RuleStage | null>(null);
  const placed = useResource<Placed[]>(async () => {
    const full = await Promise.all(ruleSets.map((listed) => ruleSetsApi.get(workspaceId, listed.id)));
    return full.flatMap((ruleSet, index) =>
      ruleSet.configuration.rules
        .slice()
        .sort((first, second) => first.order - second.order)
        .map((rule) => ({ ruleSet: ruleSets[index], rule })),
    );
  }, [workspaceId, ruleSets.map((ruleSet) => `${ruleSet.id}:${ruleSet.revision}`).join(",")]);

  if (placed.status === "loading") {
    return <Waiting label={t("rules.flow.loading", "Reading every rule set")} lines={6} />;
  }
  if (placed.status === "failed") {
    return <ProblemState layout="section" problem={placed.problem} />;
  }

  const stage = (key: RuleStage) => {
    const here = placed.data.filter((entry) => entry.rule.stage === key);
    return (
      <li key={key} className={STAGE}>
        <div className={STAGE_HEAD}>
          <strong className="text-sm text-ink">{stageName(key, t)}</strong>
          <span className="numeric text-xs text-muted">{here.length}</span>
          {editable && ruleSets.length > 0 && (
            <span className="ml-auto">
              <Button
                variant="quiet"
                flush
                icon="plus"
                aria-expanded={addingAt === key}
                onClick={() => {
                  setAddingAt(addingAt === key ? null : key);
                }}
              >
                {t("rules.flow.addHere", "Rule here")}
              </Button>
            </span>
          )}
        </div>
        {addingAt === key && (
          <div className={ADD_ROW}>
            <span className="text-secondary">{t("rules.flow.into", "Into which rule set:")}</span>
            {ruleSets.map((ruleSet) => (
              <Button
                key={ruleSet.id}
                variant="quiet"
                onClick={() => void navigate({ to: "/rules/$ruleSetId", params: { ruleSetId: ruleSet.id }, search: { addStage: key } })}
              >
                {ruleSet.name}
              </Button>
            ))}
          </div>
        )}
        <p className="m-0 text-xs text-secondary">{stagePurpose(key, t)}</p>
        {here.length === 0 ? (
          <p className="m-0 text-xs text-muted">{t("rules.flow.empty", "No rule here — everything passes on unchanged.")}</p>
        ) : (
          <ol className={RULES}>
            {here.map(({ ruleSet, rule }) => (
              <li key={`${ruleSet.id}-${rule.order}`} className={RULE} data-enabled={rule.enabled}>
                <Badge tone={REWRITING.has(rule.action.type) ? "pipeline" : "neutral"}>
                  {REWRITING.has(rule.action.type) ? t("rules.flow.transform", "Transform") : t("rules.flow.decide", "Decide")}
                </Badge>
                <strong className="font-semibold text-ink">{rule.name}</strong>
                <span className="text-secondary">
                  {describeCondition(rule.condition, t)} → {describeAction(rule.action, t)}
                </span>
                <Link to="/rules/$ruleSetId" params={{ ruleSetId: ruleSet.id }} className="text-accent-text hover:underline">
                  {ruleSet.name}
                </Link>
                {!rule.enabled && <Badge tone="deny">{t("rules.flow.disabled", "Off")}</Badge>}
              </li>
            ))}
          </ol>
        )}
      </li>
    );
  };

  const waypoint = (key: string, label: string, to: string) => (
    <li key={key} className={WAYPOINT}>
      <span>{label}</span>
      <Link to={to} className="font-semibold text-accent-text hover:underline">
        {t("rules.flow.open", "Open")}
      </Link>
    </li>
  );

  return (
    <ol className={FLOW} aria-label={t("rules.flow.label", "Rules in the order a document meets them")}>
      {stage("MATERIAL")}
      {waypoint("parsing", t("rules.flow.parsing", "Parsing — a parser reads the file into blocks; no rule works here"), "/parsers")}
      {stage("BLOCKS")}
      {waypoint("cutting", t("rules.flow.cutting", "Cutting — the chain of chunkers makes chunks; no rule works here"), "/chunking")}
      {stage("CHUNKS")}
      {/* Keyword text and vector text are not one after the other: both start from the same chunk, side by side. */}
      <li className={BRANCH_HEAD}>{t("rules.flow.branches", "From each chunk, two branches at once")}</li>
      <li className={BRANCHES}>
        <ol className={FLOW} aria-label={t("rules.flow.keywordBranch", "Keyword branch")}>
          {stage("KEYWORD_TEXT")}
          {waypoint("keyword-index", t("rules.flow.keywordIndex", "→ keyword index"), "/index")}
        </ol>
        <ol className={FLOW} aria-label={t("rules.flow.vectorBranch", "Vector branch")}>
          {stage("EMBEDDING_TEXT")}
          {waypoint("vectors", t("rules.flow.vectors", "→ vectors, when the document is vectorised"), "/index")}
        </ol>
      </li>
      <li className={BRANCH_HEAD}>{t("rules.flow.atSearch", "Later, at search time")}</li>
      {stage("QUERY")}
    </ol>
  );
}
