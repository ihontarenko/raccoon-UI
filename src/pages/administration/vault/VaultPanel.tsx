import { useState } from "react";
import { Can } from "../../../access/Can";
import { usePermissions } from "../../../access/PermissionsProvider";
import { PERMISSIONS } from "../../../access/permissions";
import { formatDateTime, labelOfCode, type CodeLabels } from "../../../application/format";
import { describeProblem } from "../../../application/problems";
import { useResource } from "../../../application/useResource";
import {
  vaultApi,
  type CredentialKind,
  type RevealedSecret,
  type VaultAuditEvent,
  type VaultCredential,
  type VaultEntry,
  type VaultOverview,
  type VaultSecret,
} from "../../../lib/vault";
import { declareText } from "../../../translations/translate";
import { useTranslation } from "../../../translations/TranslationProvider";
import { ConfirmDialog, EmptyState, ProblemState, Waiting, useToaster } from "../../../ui/components";
import { Badge, Button, Table } from "../../../ui/primitives";
import { PANEL, SECTION_TITLE, STATUS_CELL, STATUS_STRIP, TABLE_SURFACE } from "../ai/aiClasses";
import { CredentialDialog, RevealDialog, SecretDialog } from "./VaultDialogs";

const MONO = "font-mono text-xs [overflow-wrap:anywhere]";

/* A row's actions stay on one line: Reveal, then the icon buttons, never stacked under each other. */
const ACTIONS_LINE = "flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap";

/* A moment in the trail: left-aligned like the rest of the row, figures in fixed width, never wrapped. */
const MOMENT = "whitespace-nowrap text-xs [font-variant-numeric:tabular-nums]";

const FIELD_LIST = "m-0 grid list-none gap-[calc(2px*var(--ui-scale))] p-0 text-xs";

const ACTIONS: CodeLabels = {
  SECRET_SET: declareText("vault.audit.secretSet", "Set"),
  SECRET_DESCRIBED: declareText("vault.audit.secretDescribed", "Described"),
  SECRET_REMOVED: declareText("vault.audit.secretRemoved", "Removed"),
  SECRET_REVEALED: declareText("vault.audit.secretRevealed", "Revealed"),
  CREDENTIAL_SAVED: declareText("vault.audit.credentialSaved", "Credential saved"),
  CREDENTIAL_REMOVED: declareText("vault.audit.credentialRemoved", "Credential removed"),
  RESEALED: declareText("vault.audit.resealed", "Resealed"),
};

interface Catalogue {
  overview: VaultOverview;
  secrets: VaultSecret[];
  credentials: VaultCredential[];
  kinds: CredentialKind[];
  audit: VaultAuditEvent[];
}

type SecretEditing = { open: false } | { open: true; secret: VaultSecret | null };
type CredentialEditing = { open: false } | { open: true; credential: VaultCredential | null };
type Removing = { kind: "secret"; name: string } | { kind: "credential"; name: string } | null;

/**
 * The vault: every secret Raccoon uses and where each one answers from — the database first, then the environment —
 * and the credentials built from them (a provider's URL beside its key). Names, sources and fingerprints are shown;
 * a value only on Reveal, which is its own permission and lands in the audit trail at the bottom.
 */
export function VaultPanel() {
  const { t } = useTranslation();
  const { notify } = useToaster();
  const permissions = usePermissions();
  const mayWrite = permissions.may(PERMISSIONS.vaultWrite);
  const mayReveal = permissions.may(PERMISSIONS.vaultReveal);
  const catalogue = useResource<Catalogue>(async () => {
    const [overview, secrets, credentials, kinds, audit] = await Promise.all([
      vaultApi.overview(),
      vaultApi.secrets(),
      vaultApi.credentials(),
      vaultApi.kinds(),
      vaultApi.audit(),
    ]);
    return { overview, secrets, credentials, kinds, audit };
  }, []);
  const [secretEditing, setSecretEditing] = useState<SecretEditing>({ open: false });
  const [credentialEditing, setCredentialEditing] = useState<CredentialEditing>({ open: false });
  const [removing, setRemoving] = useState<Removing>(null);
  const [revealed, setRevealed] = useState<RevealedSecret | null>(null);
  const [busyName, setBusyName] = useState<string | null>(null);

  if (catalogue.status === "loading") {
    return <Waiting label={t("vault.loading", "Reading the vault")} lines={5} />;
  }
  if (catalogue.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={catalogue.problem}
        actions={
          <Button icon="refresh" onClick={catalogue.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }
  const { overview, secrets, credentials, kinds, audit } = catalogue.data;
  const editable = overview.writableSource !== null;
  const standalone = secrets.filter((secret) => secret.credential === null);
  const kindTitle = (name: string) => kinds.find((kind) => kind.name === name)?.title ?? name;

  const run = async (name: string, action: () => Promise<unknown>, done?: string) => {
    setBusyName(name);
    try {
      await action();
      if (done !== undefined) {
        notify({ tone: "good", title: done });
      }
      catalogue.reload();
    } catch (error) {
      const problem = describeProblem(error);
      notify({ tone: "error", title: problem.title, description: problem.detail ?? problem.description });
    } finally {
      setBusyName(null);
    }
  };

  const reveal = (name: string) => run(name, async () => setRevealed(await vaultApi.reveal(name)));

  const origin = (entry: VaultEntry) => (
    <>
      <Badge tone={entry.source === overview.writableSource ? "active" : "neutral"}>{entry.source}</Badge>
      {entry.location !== null && entry.source !== overview.writableSource && <div className={`${MONO} text-muted`}>{entry.location}</div>}
    </>
  );

  return (
    <div className={PANEL}>
      <div className={STATUS_STRIP}>
        <div className={STATUS_CELL}>
          <span className="text-xs text-muted">{t("vault.status.order", "Asked in this order")}</span>
          <strong>{overview.sources.join(" → ")}</strong>
        </div>
        <div className={STATUS_CELL}>
          <span className="text-xs text-muted">{t("vault.status.writable", "Changed here")}</span>
          <strong>{overview.writableSource ?? t("vault.status.nothing", "Nothing — read only")}</strong>
        </div>
        {overview.environmentExample !== null && (
          <div className={STATUS_CELL}>
            <span className="text-xs text-muted">{t("vault.status.environment", "In the environment, example/api-key is")}</span>
            <strong className={MONO}>{overview.environmentExample.replace(/^environment \((.*)\)$/, "$1")}</strong>
          </div>
        )}
        <span />
      </div>

      <section aria-labelledby="vault-credentials">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="vault-credentials" className="m-0 text-base">
            {t("vault.credentials.title", "Credentials")}
          </h2>
          {editable && (
            <Can permission={PERMISSIONS.vaultWrite}>
              <Button variant="primary" icon="plus" onClick={() => setCredentialEditing({ open: true, credential: null })}>
                {t("vault.credential.addTitle", "Add credential")}
              </Button>
            </Can>
          )}
        </div>
        {credentials.length === 0 ? (
          <EmptyState
            title={t("vault.credentials.empty", "No credential yet")}
            description={t(
              "vault.credentials.emptyDescription",
              "A credential is a set of values a service needs together — a provider's base URL and its key, a client's ID and secret. Add one per account: ai/openai/primary, ai/openai/backup.",
            )}
          />
        ) : (
          <div className={TABLE_SURFACE}>
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t("vault.column.name", "Name")}</th>
                  <th scope="col">{t("vault.column.kind", "Kind")}</th>
                  <th scope="col">{t("vault.column.fields", "Fields")}</th>
                  <th scope="col">{t("vault.column.secrets", "Secrets")}</th>
                  <th scope="col">
                    <span className="sr-only">{t("common.actions", "Actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {credentials.map((credential) => (
                  <tr key={credential.name}>
                    <td className="wraps">
                      <strong className={MONO}>{credential.name}</strong>
                      {credential.description !== null && <div className="text-xs text-secondary">{credential.description}</div>}
                      {credential.missing.length > 0 && (
                        <div>
                          <Badge tone="deny">{t("vault.credential.missing", "Missing {fields}", { fields: credential.missing.join(", ") })}</Badge>
                        </div>
                      )}
                    </td>
                    <td>{kindTitle(credential.kind)}</td>
                    <td className="wraps">
                      <ul className={FIELD_LIST}>
                        {Object.entries(credential.fields).map(([field, value]) => (
                          <li key={field}>
                            <span className="text-muted">{field}</span> <span className={MONO}>{value}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="wraps">
                      <ul className={FIELD_LIST}>
                        {credential.secretFields.map((field) => {
                          const entry = credential.secrets[field];
                          return (
                            <li key={field} className="flex flex-wrap items-center gap-2">
                              <span className="text-muted">{field}</span>
                              {entry == null ? (
                                <Badge tone="deny">{t("vault.secret.notSet", "Not set")}</Badge>
                              ) : (
                                <>
                                  <Badge tone={entry.source === overview.writableSource ? "active" : "neutral"}>{entry.source}</Badge>
                                  <span className={`${MONO} text-muted`}>{entry.fingerprint}</span>
                                  {mayReveal && (
                                    <Button
                                      variant="quiet"
                                      iconOnly
                                      icon="eye"
                                      disabled={busyName !== null}
                                      aria-label={t("vault.reveal.named", "Reveal {name}", { name: `${credential.name}/${field}` })}
                                      title={t("vault.reveal.action", "Reveal")}
                                      onClick={() => void reveal(`${credential.name}/${field}`)}
                                    />
                                  )}
                                </>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </td>
                    <td className="actions">
                      {mayWrite && credential.editable && (
                        <div className={ACTIONS_LINE}>
                          <Button
                            variant="quiet"
                            iconOnly
                            icon="edit"
                            aria-label={t("vault.editNamed", "Edit {name}", { name: credential.name })}
                            title={t("vault.edit", "Edit")}
                            onClick={() => setCredentialEditing({ open: true, credential })}
                          />
                          <Button
                            variant="quiet"
                            iconOnly
                            icon="trash"
                            aria-label={t("vault.removeNamed", "Remove {name}", { name: credential.name })}
                            title={t("vault.remove", "Remove")}
                            onClick={() => setRemoving({ kind: "credential", name: credential.name })}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </section>

      <section aria-labelledby="vault-secrets">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="vault-secrets" className="m-0 text-base">
            {t("vault.secrets.title", "Secrets")}
          </h2>
          {editable && (
            <Can permission={PERMISSIONS.vaultWrite}>
              <Button variant="quiet" icon="plus" onClick={() => setSecretEditing({ open: true, secret: null })}>
                {t("vault.secret.addTitle", "Add secret")}
              </Button>
            </Can>
          )}
        </div>
        {standalone.length === 0 ? (
          <EmptyState title={t("vault.secrets.empty", "No secret yet")} description={t("vault.secrets.emptyDescription", "Secrets outside any credential appear here: a bot token, a signing secret.")} />
        ) : (
          <div className={TABLE_SURFACE}>
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t("vault.column.name", "Name")}</th>
                  <th scope="col">{t("vault.column.source", "Answers from")}</th>
                  <th scope="col">{t("vault.column.fingerprint", "Fingerprint")}</th>
                  <th scope="col">{t("vault.column.changed", "Changed")}</th>
                  <th scope="col">
                    <span className="sr-only">{t("common.actions", "Actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {standalone.map((secret) => {
                  const busy = busyName === secret.name;
                  return (
                    <tr key={secret.name}>
                      <td className="wraps">
                        <strong className={MONO}>{secret.name}</strong>
                        {secret.resolved.description !== null && <div className="text-xs text-secondary">{secret.resolved.description}</div>}
                      </td>
                      <td className="wraps">
                        {origin(secret.resolved)}
                        {secret.shadowed.length > 0 && (
                          <div className="text-xs text-muted">
                            {t("vault.secret.shadowed", "Also in {sources}, unused", { sources: secret.shadowed.map((entry) => entry.source).join(", ") })}
                          </div>
                        )}
                      </td>
                      <td className={MONO}>{secret.resolved.fingerprint}</td>
                      <td className={`${MOMENT} text-muted`}>
                        {secret.resolved.updatedAt === null ? "—" : formatDateTime(secret.resolved.updatedAt)}
                        {secret.resolved.updatedBy !== null && <div>{secret.resolved.updatedBy}</div>}
                      </td>
                      <td className="actions">
                        <div className={ACTIONS_LINE}>
                          {mayReveal && (
                            <Button variant="quiet" icon="eye" disabled={busy} onClick={() => void reveal(secret.name)}>
                              {t("vault.reveal.action", "Reveal")}
                            </Button>
                          )}
                          {mayWrite && editable && (
                            <Button
                              variant="quiet"
                              iconOnly
                              icon="edit"
                              aria-label={t("vault.setNamed", "Set {name}", { name: secret.name })}
                              title={secret.editable ? t("vault.set", "Set a new value") : t("vault.override", "Override in the database")}
                              disabled={busy}
                              onClick={() => setSecretEditing({ open: true, secret })}
                            />
                          )}
                          {mayWrite && secret.editable && (
                            <Button
                              variant="quiet"
                              iconOnly
                              icon="trash"
                              aria-label={t("vault.removeNamed", "Remove {name}", { name: secret.name })}
                              title={t("vault.remove", "Remove")}
                              disabled={busy}
                              onClick={() => setRemoving({ kind: "secret", name: secret.name })}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </section>

      <section aria-labelledby="vault-audit">
        <h2 id="vault-audit" className={SECTION_TITLE}>
          {t("vault.audit.title", "Audit trail")}
        </h2>
        {audit.length === 0 ? (
          <EmptyState title={t("vault.audit.empty", "Nothing recorded yet")} description={t("vault.audit.emptyDescription", "Every change and every reveal is written here, with who did it.")} />
        ) : (
          <div className={TABLE_SURFACE}>
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t("vault.column.when", "When")}</th>
                  <th scope="col">{t("vault.column.who", "Who")}</th>
                  <th scope="col">{t("vault.column.what", "What")}</th>
                  <th scope="col">{t("vault.column.subject", "Name")}</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((event, index) => (
                  <tr key={`${event.occurredAt}-${index}`}>
                    <td className={MOMENT}>{formatDateTime(event.occurredAt)}</td>
                    <td className="text-xs">{event.actor ?? "—"}</td>
                    <td>
                      <Badge tone={event.action === "SECRET_REVEALED" ? "warn" : "neutral"}>{labelOfCode(ACTIONS, event.action)}</Badge>
                    </td>
                    <td className={MONO}>{event.subject}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </section>

      <SecretDialog
        open={secretEditing.open}
        name={secretEditing.open && secretEditing.secret !== null ? secretEditing.secret.name : null}
        description={secretEditing.open && secretEditing.secret !== null ? secretEditing.secret.resolved.description : null}
        overriding={secretEditing.open && secretEditing.secret !== null && !secretEditing.secret.editable ? secretEditing.secret.resolved.source : null}
        onClose={() => setSecretEditing({ open: false })}
        onSaved={(name) => {
          setSecretEditing({ open: false });
          notify({ tone: "good", title: t("vault.secret.savedNotice", "{name} saved", { name }) });
          catalogue.reload();
        }}
      />
      <CredentialDialog
        open={credentialEditing.open}
        credential={credentialEditing.open ? credentialEditing.credential : null}
        kinds={kinds}
        onClose={() => setCredentialEditing({ open: false })}
        onSaved={(saved) => {
          setCredentialEditing({ open: false });
          notify({ tone: "good", title: t("vault.credential.savedNotice", "{name} saved", { name: saved.name }) });
          catalogue.reload();
        }}
      />
      <RevealDialog revealed={revealed} onClose={() => setRevealed(null)} />
      <ConfirmDialog
        open={removing !== null}
        title={removing?.kind === "credential" ? t("vault.credential.removeTitle", "Remove credential") : t("vault.secret.removeTitle", "Remove secret")}
        confirmLabel={t("vault.remove", "Remove")}
        destructive
        onConfirm={() => {
          if (removing !== null) {
            const target = removing;
            setRemoving(null);
            void run(
              target.name,
              () => (target.kind === "credential" ? vaultApi.removeCredential(target.name) : vaultApi.removeSecret(target.name)),
              t("vault.removedNotice", "{name} removed", { name: target.name }),
            );
          }
        }}
        onCancel={() => setRemoving(null)}
      >
        <p>
          {removing?.kind === "credential"
            ? t("vault.credential.removeExplained", "{name} and every secret of it kept in the database are removed. Whatever uses it fails until it is added again.", {
                name: <strong>{removing.name}</strong>,
              })
            : t("vault.secret.removeExplained", "{name} is removed from the database. If the environment also holds it, that value answers again.", {
                name: <strong>{removing?.name}</strong>,
              })}
        </p>
      </ConfirmDialog>
    </div>
  );
}
