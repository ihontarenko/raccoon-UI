import { useEffect, useState, type FormEvent } from "react";
import { explainParameter } from "../../../application/parameterExplanations";
import { describeProblem, type Problem } from "../../../application/problems";
import {
  aiApi,
  type AiCapability,
  type ProviderConfiguration,
  type ProviderConfigurationDraft,
  type SupportedProvider,
} from "../../../lib/ai";
import { usePermissions } from "../../../access/PermissionsProvider";
import { PERMISSIONS } from "../../../access/permissions";
import { vaultApi, type VaultCredential } from "../../../lib/vault";
import { declareText, translate, type DeclaredText } from "../../../translations/translate";
import { useTranslation } from "../../../translations/TranslationProvider";
import {
  ExplainParameter,
  Notice,
  ParameterFindings,
  type ParameterFinding,
} from "../../../ui/components";
import { Button, Checkbox, Dialog, Field, Input, Select } from "../../../ui/primitives";
import { ERROR, FIELDSET, FORM, INLINE_ROW, LEGEND, TWO_COLUMNS } from "./aiClasses";

interface ProviderConfigurationDialogProperties {
  open: boolean;
  /** The configuration being changed; null adds a new one. */
  configuration: ProviderConfiguration | null;
  providers: SupportedProvider[];
  onClose: () => void;
  onSaved: (saved: ProviderConfiguration, created: boolean) => void;
}

const DEFAULT_MAXIMUM_TOKENS = 4096;
const MODEL_LIMIT = 128;
const PURPOSE_LIMIT = 64;
const ADDRESS_LIMIT = 255;

const CAPABILITY_LABEL: Record<AiCapability, DeclaredText> = {
  CHAT: declareText("administration.ai.configuration.capability.chat", "Answers (chat)"),
  EMBEDDINGS: declareText("administration.ai.configuration.capability.embeddings", "Embeddings (vectors)"),
  RERANK: declareText("administration.ai.configuration.capability.rerank", "Reranking (reorders search results)"),
};

/** The "About …" button of one field of this dialog. */
function aboutField(field: string, name: string, findings: ParameterFinding[] = []) {
  return (
    <ExplainParameter
      name={name}
      identifier={field}
      explanation={explainParameter("provider", field, { title: name })}
      findings={findings}
    />
  );
}

/** A chat allowance this small cuts every answer short; the profile's own output tokens cannot exceed it. */
const SHORT_CHAT_ALLOWANCE = 256;

function maximumTokensFindings(
  maximumTokens: string,
  capabilities: AiCapability[],
): ParameterFinding[] {
  const value = Number(maximumTokens);
  if (!Number.isFinite(value) || value < 1) {
    return [];
  }
  if (capabilities.includes("CHAT") && value < SHORT_CHAT_ALLOWANCE) {
    return [
      {
        tone: "warn",
        text: translate(
          "administration.ai.configuration.shortAllowance",
          "Answers through this configuration are cut to {count} output tokens, whatever the answer profile allows.",
          { count: value },
        ),
      },
    ];
  }
  return [];
}

function toggledCapabilities(
  current: AiCapability[],
  capability: AiCapability,
  checked: boolean,
): AiCapability[] {
  if (!checked) {
    return current.filter((candidate) => candidate !== capability);
  }
  return [...current.filter((candidate) => candidate !== capability), capability];
}

/**
 * One configuration has one address, and a provider is often several endpoints. Declared alone, Reranking
 * owns the address; declared with something else, the address belongs to that, and reranking goes to the
 * provider's catalogued rerank endpoint — the server refuses a search profile whose provider has none.
 */
const RERANK_ALONE_ADDRESS_HINT = declareText(
  "administration.ai.configuration.rerankAloneHint",
  "The rerank endpoint itself. Blank uses the provider's known rerank endpoint, where it has one.",
);
const RERANK_SHARED_NOTE = declareText(
  "administration.ai.configuration.rerankSharedNote",
  "Reranking is sent to the provider's own rerank endpoint, not to the address below. A provider without a known one, such as a local server, needs a configuration that declares Reranking alone.",
);

interface FormState {
  provider: string;
  model: string;
  apiKey: string;
  apiUrl: string;
  maximumTokens: string;
  purpose: string;
  capabilities: AiCapability[];
  /** A shared vault credential, or "" for the address and key typed here. */
  credentialName: string;
}

const OWN_CREDENTIAL_PREFIX = "ai/providers/";

/** Credentials a provider can take its address and key from: the AI and HTTP kinds, minus each configuration's own. */
function isShareable(credential: VaultCredential): boolean {
  return (credential.kind === "ai-provider" || credential.kind === "http-api") && !credential.name.startsWith(OWN_CREDENTIAL_PREFIX);
}

function initialState(
  configuration: ProviderConfiguration | null,
  providers: SupportedProvider[],
): FormState {
  if (configuration !== null) {
    return {
      provider: configuration.provider,
      model: configuration.model,
      apiKey: "",
      apiUrl: configuration.apiUrl ?? "",
      maximumTokens: String(configuration.maximumTokens),
      purpose: configuration.purpose ?? "",
      capabilities: configuration.capabilities,
      credentialName:
        configuration.credentialName === null || configuration.credentialName.startsWith(OWN_CREDENTIAL_PREFIX)
          ? ""
          : configuration.credentialName,
    };
  }
  const first = providers[0];
  return {
    provider: first?.name ?? "",
    model: "",
    apiKey: "",
    apiUrl: "",
    maximumTokens: String(DEFAULT_MAXIMUM_TOKENS),
    purpose: "",
    capabilities: first?.capabilities.slice(0, 1) ?? ["CHAT"],
    credentialName: "",
  };
}

/**
 * Adds or changes a provider configuration. The key field is write-only: a stored key is never shown,
 * and leaving the field blank on a change keeps it — the library's rule, said on the form.
 */
export function ProviderConfigurationDialog({
  open,
  configuration,
  providers,
  onClose,
  onSaved,
}: ProviderConfigurationDialogProperties) {
  const { t, say } = useTranslation();
  const [form, setForm] = useState<FormState>(() => initialState(configuration, providers));
  const [errors, setErrors] = useState<{
    model?: string;
    maximumTokens?: string;
    capabilities?: string;
  }>({});
  const [problem, setProblem] = useState<Problem | null>(null);
  const [saving, setSaving] = useState(false);
  const mayReadVault = usePermissions().may(PERMISSIONS.vaultRead);
  const [sharedCredentials, setSharedCredentials] = useState<VaultCredential[]>([]);

  useEffect(() => {
    if (!open || !mayReadVault) {
      return;
    }
    let current = true;
    vaultApi
      .credentials()
      .then((credentials) => {
        if (current) {
          setSharedCredentials(credentials.filter(isShareable));
        }
      })
      .catch(() => {
        if (current) {
          setSharedCredentials([]);
        }
      });
    return () => {
      current = false;
    };
  }, [open, mayReadVault]);

  useEffect(() => {
    if (open) {
      setForm(initialState(configuration, providers));
      setErrors({});
      setProblem(null);
      setSaving(false);
    }
  }, [open, configuration, providers]);

  const provider = providers.find((candidate) => candidate.name === form.provider) ?? null;
  const offered = provider?.capabilities ?? (["CHAT", "EMBEDDINGS"] as AiCapability[]);
  const update = (patch: Partial<FormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const chooseProvider = (name: string) => {
    const next = providers.find((candidate) => candidate.name === name);
    const kept = form.capabilities.filter(
      (capability) => next?.capabilities.includes(capability) ?? true,
    );
    update({
      provider: name,
      capabilities: kept.length > 0 ? kept : (next?.capabilities.slice(0, 1) ?? ["CHAT"]),
    });
  };

  const toggleCapability = (capability: AiCapability, checked: boolean) => {
    update({ capabilities: toggledCapabilities(form.capabilities, capability, checked) });
  };
  const reranksAlone = form.capabilities.length === 1 && form.capabilities[0] === "RERANK";
  const reranksBesideOthers = form.capabilities.includes("RERANK") && !reranksAlone;
  const tokenFindings = maximumTokensFindings(form.maximumTokens, form.capabilities);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const maximumTokens = Number(form.maximumTokens);
    const nextErrors: typeof errors = {};
    if (form.model.trim().length === 0) {
      nextErrors.model = t("administration.ai.configuration.modelRequired", "Name the model, as the provider spells it.");
    }
    if (!Number.isInteger(maximumTokens) || maximumTokens < 1) {
      nextErrors.maximumTokens = t("administration.ai.configuration.tokensInvalid", "A whole number of tokens, at least 1.");
    }
    if (form.capabilities.length === 0) {
      nextErrors.capabilities = t("administration.ai.configuration.capabilitiesRequired", "Choose at least one thing it is used for.");
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    const draft: ProviderConfigurationDraft = {
      provider: form.provider,
      model: form.model.trim(),
      apiKey: form.apiKey.trim().length === 0 ? null : form.apiKey.trim(),
      apiUrl: form.apiUrl.trim().length === 0 ? null : form.apiUrl.trim(),
      maximumTokens,
      purpose: form.purpose.trim().length === 0 ? null : form.purpose.trim(),
      capabilities: form.capabilities,
      credentialName: form.credentialName === "" ? null : form.credentialName,
    };
    setSaving(true);
    setProblem(null);
    try {
      const saved =
        configuration === null
          ? await aiApi.addConfiguration(draft)
          : await aiApi.changeConfiguration(configuration.id, draft);
      onSaved(saved, configuration === null);
    } catch (error) {
      setProblem(describeProblem(error));
      setSaving(false);
    }
  };

  const keyHint =
    provider?.requiresKey === false
      ? t("administration.ai.configuration.keyNotNeeded", "This provider needs no key.")
      : configuration?.keyConfigured === true
        ? t(
            "administration.ai.configuration.keyStored",
            "A key is stored and is never shown. Leave blank to keep it; type a new one to replace it.",
          )
        : t("administration.ai.configuration.keyWriteOnly", "Stored write-only: once saved it is never shown again, to anyone.");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        configuration === null
          ? t("administration.ai.configuration.addTitle", "Add provider configuration")
          : t("administration.ai.configuration.editTitle", "Edit provider configuration")
      }
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={saving}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            type="submit"
            form="provider-configuration-form"
            variant="primary"
            disabled={saving}
          >
            {saving
              ? t("common.saving", "Saving…")
              : configuration === null
                ? t("administration.ai.providers.add", "Add configuration")
                : t("common.save", "Save")}
          </Button>
        </>
      }
    >
      <form
        id="provider-configuration-form"
        className={FORM}
        onSubmit={(event) => void save(event)}
        noValidate
      >
        {problem !== null && (
          <Notice tone="error" title={problem.title}>
            {problem.detail ?? problem.description}
          </Notice>
        )}
        <Field
          label={t("administration.ai.configuration.provider", "Provider")}
          hint={provider?.note ?? undefined}
          labelAside={aboutField("provider", t("administration.ai.configuration.provider", "Provider"))}
        >
          <Select
            value={form.provider}
            fullWidth
            onChange={(event) => {
              chooseProvider(event.target.value);
            }}
          >
            {providers.map((candidate) => (
              <option key={candidate.name} value={candidate.name}>
                {candidate.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label={t("administration.ai.configuration.model", "Model")}
          required
          error={errors.model}
          labelAside={aboutField("model", t("administration.ai.configuration.model", "Model"))}
          hint={t(
            "administration.ai.configuration.modelHint",
            "Exactly as the provider names it, for example voyage-3.5 or claude-sonnet-5-5.",
          )}
        >
          <Input
            className="numeric"
            value={form.model}
            maxLength={MODEL_LIMIT}
            spellCheck={false}
            fullWidth
            onChange={(event) => {
              update({ model: event.target.value });
            }}
          />
        </Field>
        <fieldset className={FIELDSET}>
          <legend className={LEGEND}>
            {t("administration.ai.providers.usedFor", "Used for")}{" "}
            {aboutField("capabilities", t("administration.ai.providers.usedFor", "Used for"))}
          </legend>
          <div className={INLINE_ROW}>
            {offered.map((capability) => (
              <Checkbox
                key={capability}
                label={say(CAPABILITY_LABEL[capability])}
                checked={form.capabilities.includes(capability)}
                onChange={(event) => {
                  toggleCapability(capability, event.target.checked);
                }}
              />
            ))}
          </div>
          {reranksBesideOthers && <p className="text-xs text-secondary">{say(RERANK_SHARED_NOTE)}</p>}
          {errors.capabilities !== undefined && (
            <p className={ERROR}>{errors.capabilities}</p>
          )}
        </fieldset>
        <Field
          label={t("administration.ai.configuration.account", "Address and key")}
          hint={
            form.credentialName === ""
              ? t("administration.ai.configuration.accountOwn", "Typed below and kept in the vault as this configuration's own credential.")
              : t("administration.ai.configuration.accountShared", "Taken from the vault credential {name}, which other configurations may share. Change it on the Vault screen.", { name: form.credentialName })
          }
        >
          <Select
            value={form.credentialName}
            onChange={(event) => {
              update({ credentialName: event.target.value });
            }}
          >
            <option value="">{t("administration.ai.configuration.accountOwnOption", "Entered here")}</option>
            {sharedCredentials.map((credential) => (
              <option key={credential.name} value={credential.name}>
                {credential.name}
              </option>
            ))}
          </Select>
        </Field>
        {form.credentialName === "" && (
        <Field
          label={t("administration.ai.configuration.apiKey", "API key")}
          hint={keyHint}
          labelAside={aboutField("apiKey", t("administration.ai.configuration.apiKey", "API key"))}
        >
          <Input
            type="password"
            autoComplete="new-password"
            className="numeric"
            value={form.apiKey}
            maxLength={ADDRESS_LIMIT}
            disabled={provider?.requiresKey === false}
            placeholder={
              configuration?.keyConfigured === true
                ? t("administration.ai.configuration.keyPlaceholder", "•••••••• stored")
                : undefined
            }
            fullWidth
            onChange={(event) => {
              update({ apiKey: event.target.value });
            }}
          />
        </Field>
        )}
        <div className={TWO_COLUMNS}>
          {form.credentialName === "" && (
          <Field
            label={t("administration.settings.address", "Address")}
            labelAside={aboutField("apiUrl", t("administration.settings.address", "Address"))}
            hint={
              reranksAlone
                ? say(RERANK_ALONE_ADDRESS_HINT)
                : provider?.defaultApiUrl === null || provider === null
                  ? t("administration.ai.configuration.addressOwn", "The provider's own when blank.")
                  : t("administration.ai.configuration.addressBlank", "Blank uses {address}", {
                      address: provider.defaultApiUrl,
                    })
            }
          >
            <Input
              className="numeric"
              value={form.apiUrl}
              maxLength={ADDRESS_LIMIT}
              spellCheck={false}
              fullWidth
              onChange={(event) => {
                update({ apiUrl: event.target.value });
              }}
            />
          </Field>
          )}
          <Field
            label={t("administration.ai.configuration.maximumTokens", "Maximum tokens")}
            required
            error={errors.maximumTokens}
            labelAside={aboutField(
              "maximumTokens",
              t("administration.ai.configuration.maximumTokens", "Maximum tokens"),
              tokenFindings,
            )}
            hint={
              tokenFindings.length > 0 ? <ParameterFindings findings={tokenFindings} /> : undefined
            }
          >
            <Input
              type="number"
              min={1}
              className="numeric"
              value={form.maximumTokens}
              fullWidth
              onChange={(event) => {
                update({ maximumTokens: event.target.value });
              }}
            />
          </Field>
        </div>
        <Field
          label={t("administration.ai.configuration.purpose", "Purpose")}
          labelAside={aboutField("purpose", t("administration.ai.configuration.purpose", "Purpose"))}
          hint={t(
            "administration.ai.configuration.purposeHint",
            "Optional. Names what this row is for when several are kept, for example retrieval or answers.",
          )}
        >
          <Input
            value={form.purpose}
            maxLength={PURPOSE_LIMIT}
            fullWidth
            onChange={(event) => {
              update({ purpose: event.target.value });
            }}
          />
        </Field>
      </form>
    </Dialog>
  );
}
