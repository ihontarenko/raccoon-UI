import { useEffect, useState, type ReactNode } from "react";
import { usePermissions } from "../../../access/PermissionsProvider";
import { PERMISSIONS } from "../../../access/permissions";
import { formatDateTime, formatNumber } from "../../../application/format";
import { explainParameter } from "../../../application/parameterExplanations";
import { describeProblem, type Problem } from "../../../application/problems";
import { useResource } from "../../../application/useResource";
import { api, collectAllPages, pageQuery } from "../../../lib/api";
import type { AiCapability, ProviderConfiguration } from "../../../lib/ai";
import { declareText, translate, type DeclaredText } from "../../../translations/translate";
import { useTranslation } from "../../../translations/TranslationProvider";
import {
  ExplainParameter,
  Notice,
  ParameterFindings,
  ProblemState,
  Segmented,
  Waiting,
  useToaster,
  type ParameterFinding,
} from "../../../ui/components";
import { Badge, Button, Checkbox, Dialog, Field, Input, Table } from "../../../ui/primitives";
import { CHECK_LINE, FIELDSET, FORM, HISTORY, METER, ROW_ACTIONS, SHARED_BUDGET, TWO_COLUMNS, USAGE } from "./aiClasses";

type Operation = "embedding" | "chat" | "rerank";

const OPERATION_LABEL: Record<Operation, DeclaredText> = {
  embedding: declareText("administration.overview.embeddings", "Embeddings"),
  chat: declareText("administration.ai.providers.answers", "Answers"),
  rerank: declareText("administration.ai.providers.reranking", "Reranking"),
};

interface RateConfiguration {
  maximumRequests: number;
  windowMilliseconds: number;
  minimumSpacingMilliseconds: number;
  maximumPredictedTokens: number;
  enabled: boolean;
}

interface RatePolicy {
  providerConfigurationId: string;
  capability: AiCapability;
  /** 0 while the installation's defaults apply. */
  revision: number;
  configuration: RateConfiguration;
}

interface RateUsage {
  policy: RatePolicy;
  requests: number;
  predictedTokens: number;
  latestAdmission: string | null;
}

const path = (providerId: string, operation: Operation) =>
  `/v1/ai/providers/${providerId}/${operation}-rate`;

const rateApi = {
  policy: (providerId: string, operation: Operation) =>
    api.send<RatePolicy>("GET", path(providerId, operation)),
  save: (
    providerId: string,
    operation: Operation,
    revision: number,
    configuration: RateConfiguration,
  ) => api.send<RatePolicy>("PUT", path(providerId, operation), { revision, configuration }),
  versions: (providerId: string, operation: Operation) =>
    collectAllPages((page) =>
      api.send<RatePolicy[]>("GET", `${path(providerId, operation)}/versions?${pageQuery(page)}`),
    ),
  usage: (providerId: string, operation: Operation) =>
    api.send<RateUsage>("GET", `${path(providerId, operation)}/usage`),
};

const OPERATION_OF: Record<AiCapability, Operation> = {
  EMBEDDINGS: "embedding",
  CHAT: "chat",
  RERANK: "rerank",
};

/**
 * How fast raccoon may call one provider: requests per window, the gap between them and the tokens a
 * window may carry — with what the current window has already used, and every change made before.
 */
export function RateLimitsDialog({
  configuration,
  onClose,
}: {
  configuration: ProviderConfiguration | null;
  onClose: () => void;
}) {
  const { t, say } = useTranslation();
  const operations = (configuration?.capabilities ?? [])
    .map((capability) => OPERATION_OF[capability])
    .filter((operation): operation is Operation => operation !== undefined);
  const [operation, setOperation] = useState<Operation>("embedding");

  useEffect(() => {
    if (configuration !== null) {
      setOperation(operations[0] ?? "embedding");
    }
    // Only a newly opened configuration resets the chosen operation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configuration?.id]);
  // Until the reset above lands, never ask for a partition the configuration does not declare (a RERANK-only
  // configuration would otherwise be asked for its embedding limits first, and refused).
  const shown: Operation = operations.includes(operation)
    ? operation
    : (operations[0] ?? "embedding");

  return (
    <Dialog
      open={configuration !== null}
      onClose={onClose}
      title={t("administration.ai.limits.title", "Call limits · {provider} {model}", {
        provider: configuration?.provider ?? "",
        model: configuration?.model ?? "",
      })}
      size="wide"
    >
      {configuration !== null && (
        <div className={FORM}>
          {operations.length > 1 && (
            <Segmented<Operation>
              label={t("administration.ai.limits.operation", "Operation")}
              value={shown}
              onChange={setOperation}
              options={operations.map((candidate) => ({
                value: candidate,
                label: say(OPERATION_LABEL[candidate]),
              }))}
            />
          )}
          <RatePolicyEditor
            key={`${configuration.id}:${shown}`}
            providerId={configuration.id}
            operation={shown}
          />
          <AccountBudgetEditor key={`${configuration.id}:account`} providerId={configuration.id} />
        </div>
      )}
    </Dialog>
  );
}

interface AccountMember {
  providerConfigurationId: string;
  model: string;
  capabilities: AiCapability[];
  active: boolean;
}

interface AccountPolicy {
  provider: string;
  /** 0 while no shared budget has been set. */
  revision: number;
  configuration: RateConfiguration | null;
  sharedBy: AccountMember[];
  /** Set when this configuration's key was replaced and a budget was carried over or superseded. */
  rotation: {
    rotatedAt: string;
    outcome: "CARRIED_OVER" | "KEPT_EXISTING";
    message: string;
  } | null;
}

interface AccountUsage {
  policy: AccountPolicy;
  requests: number;
  predictedTokens: number;
  latestAdmission: string | null;
}

const accountPath = (providerId: string) => `/v1/ai/providers/${providerId}/account-rate`;

const accountApi = {
  policy: (providerId: string) => api.send<AccountPolicy>("GET", accountPath(providerId)),
  usage: (providerId: string) => api.send<AccountUsage>("GET", `${accountPath(providerId)}/usage`),
  save: (providerId: string, revision: number, configuration: RateConfiguration) =>
    api.send<AccountPolicy>("PUT", accountPath(providerId), { revision, configuration }),
};

/** A starting point when no shared budget exists yet; nothing is enforced until it is saved. */
const NEW_BUDGET: RateConfiguration = {
  maximumRequests: 60,
  windowMilliseconds: 60000,
  minimumSpacingMilliseconds: 0,
  maximumPredictedTokens: 100000,
  enabled: true,
};

const CAPABILITY_WORD: Record<AiCapability, DeclaredText> = {
  EMBEDDINGS: declareText("administration.ai.limits.capability.embeddings", "embeddings"),
  CHAT: declareText("administration.ai.limits.capability.chat", "answers"),
  RERANK: declareText("administration.ai.limits.capability.rerank", "reranking"),
};

/**
 * The budget every configuration with the same provider and key shares — what the provider itself counts.
 * A call must fit both its capability's limits above and this.
 */
function AccountBudgetEditor({ providerId }: { providerId: string }) {
  const { notify } = useToaster();
  const { t, say } = useTranslation();
  const mayWrite = usePermissions().may(PERMISSIONS.systemWrite);
  const loaded = useResource(async () => {
    const [policy, usage] = await Promise.all([
      accountApi.policy(providerId),
      accountApi.usage(providerId),
    ]);
    return { policy, usage };
  }, [providerId]);
  const [draft, setDraft] = useState<RateConfiguration | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loaded.status === "ready") {
      setDraft(loaded.data.policy.configuration);
    }
  }, [loaded]);

  if (loaded.status === "loading") {
    return <Waiting label={t("administration.ai.limits.loadingBudget", "Loading the shared budget")} lines={3} />;
  }
  if (loaded.status === "failed") {
    return <ProblemState layout="section" problem={loaded.problem} />;
  }
  const { policy, usage } = loaded.data;
  const dirty = JSON.stringify(draft) !== JSON.stringify(policy.configuration);

  const save = async () => {
    if (draft === null) {
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      await accountApi.save(providerId, policy.revision, draft);
      notify({
        tone: "good",
        title: t("administration.ai.limits.budgetSaved", "Shared budget saved"),
        description: t("administration.ai.limits.budgetSavedDescription", "Every configuration on this account is admitted under it."),
      });
      loaded.reload();
    } catch (error) {
      setProblem(describeProblem(error));
    } finally {
      setSaving(false);
    }
  };

  const members = policy.sharedBy
    .map(
      (member) =>
        `${member.model} (${member.capabilities.map((capability) => say(CAPABILITY_WORD[capability])).join(", ")})`,
    )
    .join(" · ");

  return (
    <section className={SHARED_BUDGET} aria-labelledby="shared-budget-title">
      <h3 id="shared-budget-title">
        {t("administration.ai.limits.sharedBy", "Shared by this {provider} account", { provider: policy.provider })}
      </h3>
      <p className="text-xs text-secondary">
        {t(
          "administration.ai.limits.sharedDescription",
          "Every configuration with this provider and key: {members}. A call must fit its own limits above and this budget.",
          { members },
        )}
      </p>
      {policy.rotation !== null && (
        <Notice
          tone={policy.rotation.outcome === "CARRIED_OVER" ? "information" : "warn"}
          title={t("administration.ai.limits.keyReplaced", "Key replaced {date}", {
            date: formatDateTime(policy.rotation.rotatedAt),
          })}
        >
          {policy.rotation.message}
        </Notice>
      )}
      <UsageStrip
        requests={usage.requests}
        predictedTokens={usage.predictedTokens}
        latestAdmission={usage.latestAdmission}
        limits={policy.configuration}
        policyBadge={
          policy.configuration === null ? (
            <Badge tone="neutral">{t("administration.settings.notSet", "Not set")}</Badge>
          ) : !policy.configuration.enabled ? (
            <Badge tone="neutral">{t("administration.ai.limits.notEnforced", "Not enforced")}</Badge>
          ) : (
            <Badge tone="active">{t("administration.ai.limits.revision", "Revision {revision}", { revision: policy.revision })}</Badge>
          )
        }
      />
      {problem !== null && (
        <Notice tone="error" title={problem.title}>
          {problem.detail ?? problem.description}
        </Notice>
      )}
      {draft === null ? (
        mayWrite && (
          <div className={ROW_ACTIONS}>
            <Button variant="quiet" icon="plus" onClick={() => setDraft(NEW_BUDGET)}>
              {t("administration.ai.limits.setBudget", "Set a shared budget")}
            </Button>
          </div>
        )
      ) : (
        <>
          <LimitFields
            scope="shared-budget"
            draft={draft}
            disabled={!mayWrite}
            onChange={setDraft}
            enforceHint={t("administration.ai.limits.budgetEnforceHint", "Off keeps the budget and its counts, but admits every call.")}
          />
          {mayWrite && (
            <div className={ROW_ACTIONS}>
              <Button
                variant="quiet"
                disabled={!dirty || saving}
                onClick={() => setDraft(policy.configuration)}
              >
                {t("administration.ai.prompts.discard", "Discard")}
              </Button>
              <Button variant="primary" disabled={!dirty || saving} onClick={() => void save()}>
                {saving
                  ? t("common.saving", "Saving…")
                  : policy.revision === 0
                    ? t("administration.ai.limits.setTheBudget", "Set the shared budget")
                    : t("administration.ai.limits.saveRevision", "Save a new revision")}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** What the current window has used against its limits. */
function UsageStrip({
  requests,
  predictedTokens,
  latestAdmission,
  limits,
  policyBadge,
}: {
  requests: number;
  predictedTokens: number;
  latestAdmission: string | null;
  limits: RateConfiguration | null;
  policyBadge: ReactNode;
}) {
  const { t } = useTranslation();
  const share = (used: number, limit: number) =>
    Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  return (
    <dl className={USAGE}>
      <div>
        <dt>{t("administration.ai.limits.requestsThisWindow", "Requests this window")}</dt>
        <dd className="numeric">
          {formatNumber(requests)}{" "}
          {limits !== null && (
            <span className="text-xs text-muted">
              {t("administration.ai.limits.ofLimit", "of {limit}", { limit: formatNumber(limits.maximumRequests) })}
            </span>
          )}
        </dd>
        {limits !== null && (
          <span className={METER}>
            <span style={{ width: `${share(requests, limits.maximumRequests)}%` }} />
          </span>
        )}
      </div>
      <div>
        <dt>{t("administration.ai.limits.tokensThisWindow", "Tokens this window")}</dt>
        <dd className="numeric">
          {formatNumber(predictedTokens)}{" "}
          {limits !== null && (
            <span className="text-xs text-muted">
              {t("administration.ai.limits.ofLimit", "of {limit}", { limit: formatNumber(limits.maximumPredictedTokens) })}
            </span>
          )}
        </dd>
        {limits !== null && (
          <span className={METER}>
            <span style={{ width: `${share(predictedTokens, limits.maximumPredictedTokens)}%` }} />
          </span>
        )}
      </div>
      <div>
        <dt>{t("administration.ai.limits.lastAdmitted", "Last admitted")}</dt>
        <dd>{latestAdmission === null ? t("administration.ai.limits.never", "Never") : formatDateTime(latestAdmission)}</dd>
      </div>
      <div>
        <dt>{t("administration.ai.limits.policy", "Policy")}</dt>
        <dd>{policyBadge}</dd>
      </div>
    </dl>
  );
}

type LimitScope = "call-limits" | "shared-budget";

/** A single call predicting more tokens than this rarely fits; a window below it may never admit one. */
const SMALL_TOKEN_WINDOW = 1000;

/**
 * Limits that are valid one by one but stop calls together — the same rules ProviderRateLimits applies when
 * it admits a call. "Off" means opposite things in the two scopes, so it is said in each one's words.
 */
function limitFindings(
  scope: LimitScope,
  draft: RateConfiguration,
): Map<keyof RateConfiguration, ParameterFinding[]> {
  const findings = new Map<keyof RateConfiguration, ParameterFinding[]>();
  if (!draft.enabled) {
    findings.set(
      "enabled",
      scope === "call-limits"
        ? [
            {
              tone: "deny",
              text: translate(
                "administration.ai.limits.finding.callLimitsOff",
                "Off: every call of this use through this configuration is refused — off means closed, not unlimited.",
              ),
            },
          ]
        : [
            {
              tone: "warn",
              text: translate(
                "administration.ai.limits.finding.budgetOff",
                "Off: the shared budget admits every call; only each use's own limits apply.",
              ),
            },
          ],
    );
  }
  if (draft.minimumSpacingMilliseconds > draft.windowMilliseconds) {
    findings.set("minimumSpacingMilliseconds", [
      { tone: "deny", text: translate("administration.ai.limits.finding.gapTooLong", "The gap is longer than the window — the server refuses it.") },
    ]);
  } else if (
    draft.minimumSpacingMilliseconds === draft.windowMilliseconds &&
    draft.maximumRequests > 1
  ) {
    findings.set("minimumSpacingMilliseconds", [
      {
        tone: "warn",
        text: translate(
          "administration.ai.limits.finding.gapAsWindow",
          "A gap as long as the window admits one call per window, not {count}.",
          { count: formatNumber(draft.maximumRequests) },
        ),
      },
    ]);
  }
  if (draft.maximumPredictedTokens < SMALL_TOKEN_WINDOW) {
    findings.set("maximumPredictedTokens", [
      {
        tone: "warn",
        text: translate(
          "administration.ai.limits.finding.smallTokenWindow",
          "A call predicting more tokens than this — an answer reserves its whole output allowance — is never admitted.",
        ),
      },
    ]);
  }
  return findings;
}

function LimitFields({
  scope,
  draft,
  disabled,
  onChange,
  enforceHint,
}: {
  scope: LimitScope;
  draft: RateConfiguration;
  disabled: boolean;
  onChange: (next: RateConfiguration) => void;
  enforceHint: string;
}) {
  const { say } = useTranslation();
  const findings = limitFindings(scope, draft);
  const enforceLabel =
    scope === "call-limits"
      ? translate("administration.ai.limits.enforceLimits", "Enforce these limits")
      : translate("administration.ai.limits.enforceBudget", "Enforce the shared budget");
  const about = (field: keyof RateConfiguration, name: string) => (
    <ExplainParameter
      name={name}
      identifier={field}
      explanation={explainParameter(scope, field, { title: name })}
      findings={findings.get(field) ?? []}
    />
  );
  // Each control is disabled on its own: a disabled fieldset would disable the "About …" buttons too.
  return (
    <fieldset className={FIELDSET}>
      <div className={TWO_COLUMNS}>
        {FIELDS.map((field) => (
          <Field
            key={field.name}
            label={say(field.label)}
            labelAside={about(field.name, say(field.label))}
            hint={
              findings.has(field.name) ? (
                <>
                  {say(field.hint)}
                  <ParameterFindings findings={findings.get(field.name) ?? []} />
                </>
              ) : (
                say(field.hint)
              )
            }
          >
            <Input
              type="number"
              className="numeric"
              min={0}
              disabled={disabled}
              value={String(draft[field.name])}
              fullWidth
              onChange={(event) =>
                onChange({ ...draft, [field.name]: Math.trunc(Number(event.target.value)) })
              }
            />
          </Field>
        ))}
      </div>
      <div className={CHECK_LINE}>
        <Checkbox
          label={enforceLabel}
          hint={enforceHint}
          checked={draft.enabled}
          disabled={disabled}
          onChange={(event) => onChange({ ...draft, enabled: event.target.checked })}
        />
        {about("enabled", enforceLabel)}
      </div>
      <ParameterFindings findings={findings.get("enabled") ?? []} />
    </fieldset>
  );
}

const FIELDS: { name: keyof Omit<RateConfiguration, "enabled">; label: DeclaredText; hint: DeclaredText }[] = [
  {
    name: "maximumRequests",
    label: declareText("administration.ai.limits.field.requests", "Requests per window"),
    hint: declareText("administration.ai.limits.field.requestsHint", "1 – 100,000"),
  },
  {
    name: "windowMilliseconds",
    label: declareText("administration.ai.limits.field.window", "Window, milliseconds"),
    hint: declareText("administration.ai.limits.field.windowHint", "10 – 3,600,000"),
  },
  {
    name: "minimumSpacingMilliseconds",
    label: declareText("administration.ai.limits.field.gap", "Gap between calls, milliseconds"),
    hint: declareText("administration.ai.limits.field.gapHint", "0 – the window"),
  },
  {
    name: "maximumPredictedTokens",
    label: declareText("administration.ai.limits.field.tokens", "Tokens per window"),
    hint: declareText("administration.ai.limits.field.tokensHint", "Predicted input tokens a window may carry"),
  },
];

function RatePolicyEditor({ providerId, operation }: { providerId: string; operation: Operation }) {
  const { notify } = useToaster();
  const { t } = useTranslation();
  const mayWrite = usePermissions().may(PERMISSIONS.systemWrite);
  const loaded = useResource(async () => {
    const [policy, usage, versions] = await Promise.all([
      rateApi.policy(providerId, operation),
      rateApi.usage(providerId, operation),
      rateApi.versions(providerId, operation),
    ]);
    return { policy, usage, versions };
  }, [providerId, operation]);
  const [draft, setDraft] = useState<RateConfiguration | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loaded.status === "ready") {
      setDraft(loaded.data.policy.configuration);
    }
  }, [loaded]);

  if (loaded.status === "loading" || draft === null) {
    return <Waiting label={t("administration.ai.limits.loading", "Loading call limits")} lines={4} />;
  }
  if (loaded.status === "failed") {
    return <ProblemState layout="section" problem={loaded.problem} />;
  }
  const { policy, usage, versions } = loaded.data;
  const dirty = JSON.stringify(draft) !== JSON.stringify(policy.configuration);

  const save = async () => {
    setSaving(true);
    setProblem(null);
    try {
      await rateApi.save(providerId, operation, policy.revision, draft);
      notify({
        tone: "good",
        title: t("administration.ai.limits.saved", "Call limits saved"),
        description: t("administration.ai.limits.savedDescription", "The next call is admitted under them."),
      });
      loaded.reload();
    } catch (error) {
      setProblem(describeProblem(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={FORM}>
      <UsageStrip
        requests={usage.requests}
        predictedTokens={usage.predictedTokens}
        latestAdmission={usage.latestAdmission}
        limits={policy.configuration}
        policyBadge={
          policy.revision === 0 ? (
            <Badge tone="neutral">{t("administration.ai.limits.installationDefaults", "Installation defaults")}</Badge>
          ) : (
            <Badge tone="active">{t("administration.ai.limits.revision", "Revision {revision}", { revision: policy.revision })}</Badge>
          )
        }
      />
      {problem !== null && (
        <Notice tone="error" title={problem.title}>
          {problem.detail ?? problem.description}
        </Notice>
      )}
      <LimitFields
        scope="call-limits"
        draft={draft}
        disabled={!mayWrite}
        onChange={setDraft}
        enforceHint={t("administration.ai.limits.limitsEnforceHint", "Off refuses every call through this configuration.")}
      />
      {mayWrite && (
        <div className={ROW_ACTIONS}>
          <Button
            variant="quiet"
            disabled={!dirty || saving}
            onClick={() => setDraft(policy.configuration)}
          >
            {t("administration.ai.prompts.discard", "Discard")}
          </Button>
          <Button variant="primary" disabled={!dirty || saving} onClick={() => void save()}>
            {saving
              ? t("common.saving", "Saving…")
              : policy.revision === 0
                ? t("administration.ai.limits.overrideDefaults", "Override the defaults")
                : t("administration.ai.limits.saveRevision", "Save a new revision")}
          </Button>
        </div>
      )}
      {versions.length > 0 && (
        <details className={HISTORY}>
          <summary>{t("administration.ai.limits.earlier", "Earlier limits · {count}", { count: versions.length })}</summary>
          <Table>
            <thead>
              <tr>
                <th scope="col">{t("administration.ai.limits.revisionColumn", "Revision")}</th>
                <th scope="col" className="numeric">
                  {t("administration.ai.limits.requests", "Requests")}
                </th>
                <th scope="col" className="numeric">
                  {t("administration.ai.limits.window", "Window")}
                </th>
                <th scope="col" className="numeric">
                  {t("administration.ai.limits.gap", "Gap")}
                </th>
                <th scope="col" className="numeric">
                  {t("administration.ai.tools.tokens", "Tokens")}
                </th>
                <th scope="col">{t("administration.ai.limits.enforced", "Enforced")}</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.revision}>
                  <td className="numeric">{version.revision}</td>
                  <td className="numeric">{formatNumber(version.configuration.maximumRequests)}</td>
                  <td className="numeric">
                    {formatNumber(version.configuration.windowMilliseconds)} ms
                  </td>
                  <td className="numeric">
                    {formatNumber(version.configuration.minimumSpacingMilliseconds)} ms
                  </td>
                  <td className="numeric">
                    {formatNumber(version.configuration.maximumPredictedTokens)}
                  </td>
                  <td>{version.configuration.enabled ? t("administration.ai.limits.yes", "Yes") : t("administration.ai.limits.no", "No")}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </details>
      )}
    </div>
  );
}
