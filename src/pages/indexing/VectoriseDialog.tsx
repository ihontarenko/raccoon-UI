import { useEffect, useState } from "react";
import { Can } from "../../access/Can";
import { PERMISSIONS } from "../../access/permissions";
import { TOKEN_QUALITIES } from "../../application/codeLabels";
import { formatDateTime, formatNumber, labelOfCode, type CodeLabels } from "../../application/format";
import { describeProblem, type Problem } from "../../application/problems";
import { collectAllPages } from "../../lib/api";
import {
  pipelineApi,
  submissionKey,
  type AvailableProfile,
  type PreflightReport,
  type VectorCatalogue,
  type VectorGeneration,
  type VectorPolicy,
} from "../../lib/pipeline";
import { declareText, type DeclaredText } from "../../translations/translate";
import { useTranslation } from "../../translations/TranslationProvider";
import { EmptyState, Notice, Waiting } from "../../ui/components";
import { Badge, Button, Checkbox, Dialog, Field, Input, Select, type BadgeTone } from "../../ui/primitives";
import { BUDGETS, DIALOG_BODY, POLICY, POLICY_GRID, PREFLIGHT, PREFLIGHT_FACTS, PREFLIGHT_HEAD } from "./indexingClasses";

interface VectoriseDialogProperties {
  open: boolean;
  workspaceId: string;
  /** Lexical generation ids to embed — at most a hundred, as the backend admits. */
  generationIds: string[];
  /** What is being vectorised, in the person's words: "README.md", "12 documents of Docs". */
  subject: string;
  onClose: () => void;
  onSubmitted: (generation: VectorGeneration) => void;
}

/** Sensible first limits; each is clamped to what the installation's catalogue allows. */
const STARTING_POLICY: VectorPolicy = {
  maximumAttempts: 3,
  retryDelaySeconds: 30,
  maximumConcurrentCalls: 2,
  maximumCalls: 200,
  maximumDurationMilliseconds: 600000,
  maximumPreflightAgeSeconds: 3600,
  allowApproximateTokens: true,
  allowUnknownUsage: false,
};

const BUDGET_TONE: Record<string, BadgeTone> = { WITHIN: "good", EXCEEDED: "error", UNKNOWN: "warn" };

/** A preflight's token count against the policy's budget: `Budget`. */
const TOKEN_BUDGETS: CodeLabels = {
  WITHIN: declareText("index.preflights.tokensWithin", "Tokens within"),
  EXCEEDED: declareText("index.preflights.tokensExceeded", "Tokens exceeded"),
  UNKNOWN: declareText("index.preflights.tokensUnknown", "Tokens unknown"),
};

/** A preflight's estimated cost against the policy's budget: `Budget`. */
const COST_BUDGETS: CodeLabels = {
  WITHIN: declareText("index.preflights.costWithin", "Cost within"),
  EXCEEDED: declareText("index.preflights.costExceeded", "Cost exceeded"),
  UNKNOWN: declareText("index.preflights.costUnknown", "Cost unknown"),
};

const POLICY_LABEL: Record<keyof VectorPolicy, DeclaredText> = {
  maximumAttempts: declareText("index.policy.maximumAttempts", "Attempts"),
  retryDelaySeconds: declareText("index.policy.retryDelaySeconds", "Retry delay, seconds"),
  maximumConcurrentCalls: declareText("index.policy.maximumConcurrentCalls", "Calls at once"),
  maximumCalls: declareText("index.policy.maximumCalls", "Calls at most"),
  maximumDurationMilliseconds: declareText("index.policy.maximumDurationMilliseconds", "Run time, milliseconds"),
  maximumPreflightAgeSeconds: declareText("index.policy.maximumPreflightAgeSeconds", "Preflight valid for, seconds"),
  allowApproximateTokens: declareText("index.policy.allowApproximateTokens", "Accept an approximate token count"),
  allowUnknownUsage: declareText("index.policy.allowUnknownUsage", "Accept a provider that reports no usage"),
};

function clampedPolicy(catalogue: VectorCatalogue | null): VectorPolicy {
  const policy = { ...STARTING_POLICY };
  for (const parameter of catalogue?.executionPolicy ?? []) {
    const current = policy[parameter.name];
    if (typeof current === "number") {
      let value = current;
      if (parameter.minimum !== null) {
        value = Math.max(value, parameter.minimum);
      }
      if (parameter.maximum !== null) {
        value = Math.min(value, parameter.maximum);
      }
      (policy as Record<string, number | boolean>)[parameter.name] = value;
    }
  }
  return policy;
}

type Stage =
  | { kind: "loading" }
  | { kind: "failed"; problem: Problem }
  | { kind: "choosing"; profiles: AvailableProfile[]; catalogue: VectorCatalogue | null };

/**
 * Vectorises in two deliberate steps: a preflight that selects the inputs and forecasts tokens, cost
 * and budget without calling the model, then the submission the preflight admits. Nothing spends money
 * until the second button.
 */
export function VectoriseDialog({ open, workspaceId, generationIds, subject, onClose, onSubmitted }: VectoriseDialogProperties) {
  const { t, plural, say } = useTranslation();
  const [stage, setStage] = useState<Stage>({ kind: "loading" });
  const [profileId, setProfileId] = useState<string>("");
  const [report, setReport] = useState<PreflightReport | null>(null);
  const [policy, setPolicy] = useState<VectorPolicy>(STARTING_POLICY);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [working, setWorking] = useState<"preflight" | "submit" | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setReport(null);
    setProblem(null);
    setWorking(null);
    setStage({ kind: "loading" });
    let current = true;
    Promise.all([collectAllPages((page) => pipelineApi.availableEmbeddingProfiles(workspaceId, page)), pipelineApi.vectorCatalogue(workspaceId)])
      .then(([profiles, catalogue]) => {
        if (current) {
          setStage({ kind: "choosing", profiles, catalogue });
          setProfileId(profiles[0]?.id ?? "");
          setPolicy(clampedPolicy(catalogue));
        }
      })
      .catch((error: unknown) => {
        if (current) {
          setStage({ kind: "failed", problem: describeProblem(error) });
        }
      });
    return () => {
      current = false;
    };
  }, [open, workspaceId]);

  const runPreflight = async () => {
    setWorking("preflight");
    setProblem(null);
    try {
      setReport(await pipelineApi.preflight(workspaceId, profileId, generationIds));
    } catch (error) {
      setProblem(describeProblem(error));
    } finally {
      setWorking(null);
    }
  };

  const submit = async () => {
    if (report === null) {
      return;
    }
    setWorking("submit");
    setProblem(null);
    try {
      onSubmitted(await pipelineApi.submitVectors(workspaceId, report.preflightId, generationIds, policy, submissionKey("vectors", report.preflightId)));
    } catch (error) {
      setProblem(describeProblem(error));
      setWorking(null);
    }
  };

  const admitted =
    report !== null &&
    report.tokenBudget === "WITHIN" &&
    report.costBudget === "WITHIN" &&
    report.pendingTokens !== null &&
    (report.pendingTokens === 0 || report.quality === "EXACT" || policy.allowApproximateTokens);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("index.vectorise.title", "Vectorise {subject}", { subject })}
      size="wide"
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={working !== null}>
            {report === null ? t("common.cancel", "Cancel") : t("common.close", "Close")}
          </Button>
          {report === null ? (
            <Button
              variant="primary"
              disabled={stage.kind !== "choosing" || profileId === "" || working !== null}
              onClick={() => void runPreflight()}
            >
              {working === "preflight" ? t("index.vectorise.checking", "Checking…") : t("index.vectorise.runPreflight", "Run preflight")}
            </Button>
          ) : (
            <Can
              permission={PERMISSIONS.systemWrite}
              fallback={<span className="text-xs text-muted">{t("index.vectorise.needsWrite", "Starting needs system write access")}</span>}
            >
              <Button variant="primary" icon="vectors" disabled={!admitted || working !== null} onClick={() => void submit()}>
                {working === "submit" ? t("index.vectorise.starting", "Starting…") : t("index.vectorise.start", "Start vectorising")}
              </Button>
            </Can>
          )}
        </>
      }
    >
      <div className={DIALOG_BODY}>
        {problem !== null && (
          <Notice tone="error" title={problem.title}>
            {problem.detail ?? problem.description}
          </Notice>
        )}
        {stage.kind === "loading" && <Waiting label={t("index.vectorise.loadingProfiles", "Loading embedding profiles")} lines={3} />}
        {stage.kind === "failed" && (
          <Notice tone="error" title={stage.problem.title}>
            {stage.problem.detail ?? stage.problem.description}
          </Notice>
        )}
        {stage.kind === "choosing" &&
          (stage.profiles.length === 0 ? (
            <EmptyState
              title={t("index.vectorise.noProfile", "No embedding profile")}
              description={t(
                "index.vectorise.noProfileDescription",
                "An embedding profile names the model, its dimensions and its limits. Create one under Profiles, on a provider that can embed.",
              )}
            />
          ) : (
            <>
              <Field
                label={t("index.vectorise.profile", "Embedding profile")}
                hint={plural("index.vectorise.selected", generationIds.length, {
                  one: "{count} index generation selected.",
                  other: "{count} index generations selected.",
                })}
              >
                <Select
                  value={profileId}
                  fullWidth
                  disabled={report !== null}
                  onChange={(event) => {
                    setProfileId(event.target.value);
                  }}
                >
                  {stage.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </Select>
              </Field>
              {report === null ? (
                <p className="text-xs text-secondary">
                  {t(
                    "index.vectorise.explains",
                    "The preflight selects the published chunks, counts their tokens and estimates the cost. It never calls the embedding model.",
                  )}
                </p>
              ) : (
                <PreflightSummary report={report} />
              )}
              {report !== null && (
                <details className={POLICY}>
                  <summary>{t("index.vectorise.limits", "Execution limits")}</summary>
                  <div className={POLICY_GRID}>
                    {(Object.keys(POLICY_LABEL) as (keyof VectorPolicy)[]).map((name) => {
                      const value = policy[name];
                      if (typeof value === "boolean") {
                        return (
                          <Checkbox
                            key={name}
                            label={say(POLICY_LABEL[name])}
                            checked={value}
                            onChange={(event) => {
                              setPolicy((currentPolicy) => ({ ...currentPolicy, [name]: event.target.checked }));
                            }}
                          />
                        );
                      }
                      const limits = stage.catalogue?.executionPolicy.find((parameter) => parameter.name === name);
                      return (
                        <Field key={name} label={say(POLICY_LABEL[name])} hint={limits?.description}>
                          <Input
                            type="number"
                            className="numeric"
                            min={limits?.minimum ?? undefined}
                            max={limits?.maximum ?? undefined}
                            value={String(value)}
                            fullWidth
                            onChange={(event) => {
                              setPolicy((currentPolicy) => ({ ...currentPolicy, [name]: Number(event.target.value) }));
                            }}
                          />
                        </Field>
                      );
                    })}
                  </div>
                </details>
              )}
            </>
          ))}
      </div>
    </Dialog>
  );
}

function PreflightSummary({ report }: { report: PreflightReport }) {
  const { t, locale } = useTranslation();
  const costFormat = new Intl.NumberFormat(locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return (
    <section className={PREFLIGHT} aria-label={t("index.vectors.preflight", "Preflight")}>
      <div className={PREFLIGHT_HEAD}>
        <span>
          <strong>{report.model.provider}</strong> <span className="numeric text-xs">{report.model.model}</span> ·{" "}
          {t("index.vectors.dimensions", "{count} dimensions", { count: formatNumber(report.model.dimensions) })}
        </span>
        <span className="text-xs text-muted">{formatDateTime(report.createdAt)}</span>
      </div>
      <dl className={PREFLIGHT_FACTS}>
        <div>
          <dt>{t("index.column.files", "Files")}</dt>
          <dd className="numeric">{formatNumber(report.preparedFiles)}</dd>
        </div>
        <div>
          <dt>{t("index.column.chunks", "Chunks")}</dt>
          <dd className="numeric">
            {formatNumber(report.chunks)}{" "}
            <span className="text-xs text-muted">
              {t("index.preflights.cached", "{count} cached", { count: formatNumber(report.reusableChunks) })}
            </span>
          </dd>
        </div>
        <div>
          <dt>{t("index.preflights.tokensToSend", "Tokens to send")}</dt>
          <dd className="numeric">{report.pendingTokens === null ? t("index.unknown", "Unknown") : formatNumber(report.pendingTokens)}</dd>
        </div>
        <div>
          <dt>{t("index.vectorise.estimatedCost", "Estimated cost")}</dt>
          <dd className="numeric">
            {report.estimatedCost === null
              ? t("index.unknown", "Unknown")
              : `${costFormat.format(report.estimatedCost)} ${report.currency ?? ""}`}
          </dd>
        </div>
      </dl>
      <p className={BUDGETS}>
        <Badge tone={BUDGET_TONE[report.tokenBudget] ?? "neutral"}>
          {labelOfCode(TOKEN_BUDGETS, report.tokenBudget)}
        </Badge>
        <Badge tone={BUDGET_TONE[report.costBudget] ?? "neutral"}>
          {labelOfCode(COST_BUDGETS, report.costBudget)}
        </Badge>
        <Badge tone={report.quality === "EXACT" ? "good" : "warn"}>
          {t("index.vectorise.count", "Count {quality}", { quality: labelOfCode(TOKEN_QUALITIES, report.quality).toLowerCase() })}
        </Badge>
      </p>
      {(report.tokenBudget !== "WITHIN" || report.costBudget !== "WITHIN") && (
        <Notice tone="warn" title={t("index.vectorise.outsideBudget", "Outside the profile's budget")}>
          {t(
            "index.vectorise.outsideBudgetDescription",
            "Raise the profile's token or cost limit, or vectorise fewer documents at a time.",
          )}
        </Notice>
      )}
    </section>
  );
}
