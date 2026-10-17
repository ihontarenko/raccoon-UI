import { useState } from "react";
import { Can } from "../../../access/Can";
import { usePermissions } from "../../../access/PermissionsProvider";
import { PERMISSIONS } from "../../../access/permissions";
import { AI_CAPABILITIES } from "../../../application/codeLabels";
import { formatDateTime, formatNumber, labelOfCode } from "../../../application/format";
import { describeProblem } from "../../../application/problems";
import { useResource } from "../../../application/useResource";
import { aiApi, type ProviderConfiguration, type StoredConfigurations } from "../../../lib/ai";
import { useTranslation } from "../../../translations/TranslationProvider";
import { ConfirmDialog, EmptyState, PathText, ProblemState, Waiting, useToaster } from "../../../ui/components";
import { Badge, Button, Table } from "../../../ui/primitives";
import { ProviderConfigurationDialog } from "./ProviderConfigurationDialog";
import { RateLimitsDialog } from "./RateLimitsDialog";
import { CATALOGUE, CATALOGUE_LIST, CATALOGUE_NAME, CHIP_ROW, PANEL, SECTION_TITLE, STATE_CHANGE, STATUS_CELL, STATUS_STRIP, TABLE_SURFACE } from "./aiClasses";

type Editing = { open: false } | { open: true; configuration: ProviderConfiguration | null };

/** Which model Raccoon talks to, on whose key — embeddings and answers alike. */
export function ProvidersPanel() {
  const { notify } = useToaster();
  const { t, plural } = useTranslation();
  const permissions = usePermissions();
  const mayWrite = permissions.may(PERMISSIONS.systemWrite);
  const stored = useResource(() => aiApi.configurations(), []);
  const overview = useResource(() => aiApi.overview(), []);
  const [editing, setEditing] = useState<Editing>({ open: false });
  const [discarding, setDiscarding] = useState<ProviderConfiguration | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [limiting, setLimiting] = useState<ProviderConfiguration | null>(null);

  if (stored.status === "loading") {
    return <Waiting label={t("administration.ai.providers.loading", "Loading providers")} lines={4} />;
  }
  if (stored.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={stored.problem}
        actions={
          <Button icon="refresh" onClick={stored.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }

  const catalogue: StoredConfigurations = stored.data;
  const refresh = () => {
    stored.reload();
    overview.reload();
  };

  const act = async (configuration: ProviderConfiguration, action: () => Promise<unknown>, done: string) => {
    setBusyId(configuration.id);
    try {
      await action();
      notify({ tone: "good", title: done });
      refresh();
    } catch (error) {
      const problem = describeProblem(error);
      notify({ tone: "error", title: problem.title, description: problem.detail ?? problem.description });
    } finally {
      setBusyId(null);
    }
  };

  const active = overview.status === "ready" ? overview.data.activeProvider : null;
  const embeddingsInForce = catalogue.configurations.filter(
    (configuration) => configuration.active && configuration.capabilities.includes("EMBEDDINGS"),
  );
  const rerankingInForce = catalogue.configurations.filter(
    (configuration) => configuration.active && configuration.capabilities.includes("RERANK"),
  );
  const supported = new Map(catalogue.providers.map((provider) => [provider.name, provider]));

  return (
    <div className={PANEL}>
      <section className={STATUS_STRIP} aria-label={t("administration.ai.providers.inForceSummary", "What is in force")}>
        <div className={STATUS_CELL}>
          <span className="eyebrow">{t("administration.ai.providers.answers", "Answers")}</span>
          {active === null ? (
            <span className="text-secondary">{t("administration.ai.providers.noChat", "No chat model in force")}</span>
          ) : (
            <span>
              <strong>{active.providerName}</strong> <span className="numeric text-xs">{active.model}</span>{" "}
              <Badge tone={active.usable ? "good" : "error"}>
                {active.usable ? t("administration.ai.providers.ready", "Ready") : t("administration.ai.providers.noKey", "No key")}
              </Badge>
            </span>
          )}
        </div>
        <div className={STATUS_CELL}>
          <span className="eyebrow">{t("administration.overview.embeddings", "Embeddings")}</span>
          {embeddingsInForce.length === 0 ? (
            <span className="text-secondary">{t("administration.ai.providers.noEmbedding", "No embedding model in force")}</span>
          ) : (
            embeddingsInForce.map((configuration) => (
              <span key={configuration.id}>
                <strong>{configuration.provider}</strong> <span className="numeric text-xs">{configuration.model}</span>
              </span>
            ))
          )}
        </div>
        <div className={STATUS_CELL}>
          <span className="eyebrow">{t("administration.ai.providers.reranking", "Reranking")}</span>
          {rerankingInForce.length === 0 ? (
            <span className="text-secondary">{t("administration.ai.providers.noRerank", "No rerank model in force")}</span>
          ) : (
            rerankingInForce.map((configuration) => (
              <span key={configuration.id}>
                <strong>{configuration.provider}</strong> <span className="numeric text-xs">{configuration.model}</span>
              </span>
            ))
          )}
        </div>
        <div className={STATUS_CELL}>
          <span className="eyebrow">{t("administration.ai.providers.toolsPublished", "Tools published")}</span>
          <strong className="numeric">
            {overview.status === "ready"
              ? t("administration.ai.providers.actionsInTools", "{actions} in {tools}", {
                  actions: plural("administration.ai.tools.actionCount", overview.data.publishedActions, {
                    one: "{count} action",
                    other: "{count} actions",
                  }),
                  tools: plural("administration.ai.providers.toolCount", overview.data.publishedTools, {
                    one: "{count} tool",
                    other: "{count} tools",
                  }),
                })
              : "…"}
          </strong>
        </div>
        <Can permission={PERMISSIONS.systemWrite}>
          <Button
            variant="primary"
            icon="plus"
            onClick={() => {
              setEditing({ open: true, configuration: null });
            }}
          >
            {t("administration.ai.providers.add", "Add configuration")}
          </Button>
        </Can>
      </section>

      {catalogue.configurations.length === 0 ? (
        <EmptyState
          title={t("administration.ai.providers.empty", "No provider configured")}
          description={t(
            "administration.ai.providers.emptyDescription",
            "Add a configuration: a provider, a model and, where the provider needs one, a key. It stays idle until you put it in force.",
          )}
        />
      ) : (
        <div className={TABLE_SURFACE}>
          <Table>
            <thead>
              <tr>
                <th scope="col">{t("administration.ai.providers.providerAndModel", "Provider and model")}</th>
                <th scope="col">{t("administration.ai.providers.usedFor", "Used for")}</th>
                <th scope="col">{t("administration.ai.providers.key", "Key")}</th>
                <th scope="col">{t("administration.accounts.state", "State")}</th>
                <th scope="col">
                  <span className="sr-only">{t("common.actions", "Actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {catalogue.configurations.map((configuration) => {
                const provider = supported.get(configuration.provider);
                const busy = busyId === configuration.id;
                return (
                  <tr key={configuration.id} data-selected={configuration.active}>
                    <td className="wraps">
                      <strong>{configuration.provider}</strong>
                      <div className="numeric text-xs text-secondary">{configuration.model}</div>
                      {configuration.apiUrl !== null && (
                        <div className="text-xs text-muted">
                          <PathText path={configuration.apiUrl} />
                        </div>
                      )}
                    </td>
                    <td>
                      <div className={CHIP_ROW}>
                        {configuration.capabilities.map((capability) => (
                          <Badge key={capability} tone="active">
                            {labelOfCode(AI_CAPABILITIES, capability)}
                          </Badge>
                        ))}
                      </div>
                      {configuration.purpose !== null && <div className="text-xs text-secondary">{configuration.purpose}</div>}
                      <div className="text-xs text-muted numeric">
                        {t("administration.ai.providers.upToTokens", "up to {count} tokens", {
                          count: formatNumber(configuration.maximumTokens),
                        })}
                      </div>
                    </td>
                    <td>
                      {configuration.keyConfigured ? (
                        <Badge tone="good">{t("administration.ai.providers.keyStored", "Stored")}</Badge>
                      ) : provider?.requiresKey === false ? (
                        <Badge tone="neutral">{t("administration.ai.providers.keyNotNeeded", "Not needed")}</Badge>
                      ) : (
                        <Badge tone="deny">{t("administration.ai.providers.keyMissing", "Missing")}</Badge>
                      )}
                      {configuration.credentialName !== null && (
                        <div className="font-mono text-xs text-muted [overflow-wrap:anywhere]">{configuration.credentialName}</div>
                      )}
                    </td>
                    <td>
                      <Badge tone={configuration.active ? "allow" : "neutral"}>
                        {configuration.active
                          ? t("administration.ai.prompts.inForce", "In force")
                          : t("administration.ai.providers.idle", "Idle")}
                      </Badge>
                      <div className="text-xs text-muted">{formatDateTime(configuration.updatedAt)}</div>
                      <div className={STATE_CHANGE}>
                        {mayWrite &&
                          (configuration.active ? (
                            <Button
                              variant="quiet"
                              flush
                              disabled={busy}
                              onClick={() =>
                                void act(
                                  configuration,
                                  () => aiApi.takeOutOfForce(configuration.id),
                                  t("administration.ai.providers.takenOutNotice", "{provider} taken out of force", {
                                    provider: configuration.provider,
                                  }),
                                )
                              }
                            >
                              {t("administration.ai.providers.takeOutOfForce", "Take out of force")}
                            </Button>
                          ) : (
                            <Button
                              variant="quiet"
                              flush
                              icon="play"
                              disabled={busy}
                              onClick={() =>
                                void act(
                                  configuration,
                                  () => aiApi.putInForce(configuration.id),
                                  t("administration.ai.providers.inForceNotice", "{provider} is in force", {
                                    provider: configuration.provider,
                                  }),
                                )
                              }
                            >
                              {t("administration.ai.prompts.putInForce", "Put in force")}
                            </Button>
                          ))}
                      </div>
                    </td>
                    <td className="actions">
                      {mayWrite && (
                        <>
                          <Button
                            variant="quiet"
                            iconOnly
                            icon="edit"
                            aria-label={t("administration.ai.providers.editNamed", "Edit {provider} {model}", {
                              provider: configuration.provider,
                              model: configuration.model,
                            })}
                            title={t("administration.ai.prompts.edit", "Edit")}
                            disabled={busy}
                            onClick={() => {
                              setEditing({ open: true, configuration });
                            }}
                          />
                          <Button
                            variant="quiet"
                            iconOnly
                            icon="trash"
                            aria-label={t("administration.ai.providers.discardNamed", "Discard {provider} {model}", {
                              provider: configuration.provider,
                              model: configuration.model,
                            })}
                            title={t("administration.ai.prompts.discard", "Discard")}
                            disabled={busy}
                            onClick={() => {
                              setDiscarding(configuration);
                            }}
                          />
                        </>
                      )}
                      <Button variant="quiet" icon="gauge" onClick={() => setLimiting(configuration)}>
                        {t("administration.ai.providers.limits", "Limits")}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}

      <section className={CATALOGUE} aria-labelledby="supported-providers">
        <h2 id="supported-providers" className={SECTION_TITLE}>
          {t("administration.ai.providers.whatCanBeConfigured", "What can be configured")}
        </h2>
        <ul className={CATALOGUE_LIST}>
          {catalogue.providers.map((provider) => (
            <li key={provider.name}>
              <span className={CATALOGUE_NAME}>{provider.name}</span>
              <span className={CHIP_ROW}>
                {provider.capabilities.map((capability) => (
                  <Badge key={capability} tone="neutral">
                    {labelOfCode(AI_CAPABILITIES, capability)}
                  </Badge>
                ))}
                {!provider.requiresKey && <Badge tone="good">{t("administration.ai.providers.noKey", "No key")}</Badge>}
              </span>
              <span className="text-xs text-secondary">{provider.note ?? ""}</span>
            </li>
          ))}
        </ul>
      </section>

      <ProviderConfigurationDialog
        open={editing.open}
        configuration={editing.open ? editing.configuration : null}
        providers={catalogue.providers}
        onClose={() => {
          setEditing({ open: false });
        }}
        onSaved={(saved, created) => {
          setEditing({ open: false });
          notify({
            tone: "good",
            title: created
              ? t("administration.ai.providers.addedNotice", "{provider} added — idle until put in force", { provider: saved.provider })
              : t("administration.ai.providers.savedNotice", "{provider} saved", { provider: saved.provider }),
          });
          refresh();
        }}
      />
      <RateLimitsDialog configuration={limiting} onClose={() => setLimiting(null)} />
      <ConfirmDialog
        open={discarding !== null}
        title={t("administration.ai.providers.discardConfiguration", "Discard configuration")}
        confirmLabel={t("administration.ai.prompts.discard", "Discard")}
        destructive
        onConfirm={() => {
          if (discarding !== null) {
            const target = discarding;
            setDiscarding(null);
            void act(
              target,
              () => aiApi.discardConfiguration(target.id),
              t("administration.ai.providers.discardedNotice", "{provider} discarded", { provider: target.provider }),
            );
          }
        }}
        onCancel={() => {
          setDiscarding(null);
        }}
      >
        <p>
          {t("administration.ai.providers.discardDescription", "{configuration} and its stored key are deleted.", {
            configuration: (
              <strong>
                {discarding?.provider} · {discarding?.model}
              </strong>
            ),
          })}{" "}
          {discarding?.active
            ? t(
                "administration.ai.providers.discardInForce",
                "It is in force now, so model calls stop until another is put in force.",
              )
            : ""}
        </p>
      </ConfirmDialog>
    </div>
  );
}
