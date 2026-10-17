import { useState, type FormEvent } from "react";
import { Can } from "../../access/Can";
import { PERMISSIONS } from "../../access/permissions";
import { formatDateTime, shortIdentifier } from "../../application/format";
import { describeProblem, type Problem } from "../../application/problems";
import { useReadySession } from "../../application/session";
import { usePagedList } from "../../application/usePagedList";
import { api } from "../../lib/api";
import { useTranslation } from "../../translations/TranslationProvider";
import type { SubjectView } from "../../lib/contracts";
import {
  ConfirmDialog,
  EmptyState,
  ListFooter,
  Notice,
  ProblemState,
  Waiting,
  useToaster,
} from "../../ui/components";
import { Badge, Button, Dialog, Field, Input, Table } from "../../ui/primitives";
import { CredentialsDialog } from "./CredentialsDialog";
import { ACCOUNT_NAME, PANEL_FORM, PANEL_SURFACE, PANEL_TOOLBAR } from "./administrationClasses";

export function AccountsPanel() {
  const { viewer } = useReadySession();
  const { notify } = useToaster();
  const { t, plural } = useTranslation();
  const accounts = usePagedList((page) => api.listSubjects(page), []);
  const [creating, setCreating] = useState(false);
  const [disabling, setDisabling] = useState<SubjectView | null>(null);
  const [showingCredentials, setShowingCredentials] = useState<SubjectView | null>(null);
  const [busy, setBusy] = useState(false);

  if (accounts.status === "loading") {
    return <Waiting label={t("administration.accounts.loading", "Loading accounts")} />;
  }
  if (accounts.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={accounts.problem}
        actions={
          <Button icon="refresh" onClick={accounts.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }

  const setEnabled = async (account: SubjectView, enabled: boolean) => {
    setBusy(true);
    try {
      const saved = await api.setSubjectEnabled(account.id, enabled, account.revision);
      accounts.replaceItem((candidate) => candidate.id === account.id, saved);
      notify({
        tone: "good",
        title: enabled
          ? t("administration.accounts.enabledNotice", "{name} enabled", { name: account.displayName })
          : t("administration.accounts.disabledNotice", "{name} disabled", { name: account.displayName }),
      });
    } catch (error) {
      const problem = describeProblem(error);
      notify({
        tone: "error",
        title: problem.title,
        description: problem.detail ?? problem.description,
      });
      if (problem.kind === "conflict") {
        accounts.reload();
      }
    } finally {
      setBusy(false);
      setDisabling(null);
    }
  };

  return (
    <>
      <div className={PANEL_TOOLBAR}>
        <span className="text-xs text-secondary">
          {t(
            "administration.accounts.lead",
            "An account signs in with a credential; disabling one stops all of its credentials.",
          )}
        </span>
        <Can permission={PERMISSIONS.identityManage}>
          <Button
            variant="primary"
            icon="plus"
            onClick={() => {
              setCreating(true);
            }}
          >
            {t("administration.accounts.new", "New account")}
          </Button>
        </Can>
      </div>
      {accounts.items.length === 0 ? (
        <EmptyState
          title={t("administration.accounts.empty", "No accounts")}
          description={t("administration.accounts.emptyDescription", "Create the first account to let someone sign in.")}
        />
      ) : (
        <div className={PANEL_SURFACE}>
          <Table>
            <thead>
              <tr>
                <th scope="col">{t("administration.accounts.account", "Account")}</th>
                <th scope="col">{t("administration.accounts.state", "State")}</th>
                <th scope="col">{t("administration.accounts.created", "Created")}</th>
                <th scope="col">
                  <span className="sr-only">{t("common.actions", "Actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {accounts.items.map((account) => {
                const isViewer = account.id === viewer.subjectId;
                return (
                  <tr key={account.id}>
                    <td>
                      <strong className={ACCOUNT_NAME}>{account.displayName}</strong>
                      <div className="numeric text-muted" title={account.id}>
                        {shortIdentifier(account.id)}
                        {isViewer ? t("administration.accounts.you", " · you") : ""}
                      </div>
                    </td>
                    <td>
                      <Badge tone={account.enabled ? "allow" : "deny"}>
                        {account.enabled
                          ? t("administration.accounts.enabled", "Enabled")
                          : t("administration.accounts.disabled", "Disabled")}
                      </Badge>
                    </td>
                    <td className="text-xs text-secondary">{formatDateTime(account.createdAt)}</td>
                    <td className="actions">
                      <Can permission={PERMISSIONS.identityManage}>
                        {isViewer ? null : account.enabled ? (
                          <Button
                            variant="quiet"
                            disabled={busy}
                            onClick={() => {
                              setDisabling(account);
                            }}
                          >
                            {t("administration.accounts.disable", "Disable")}
                          </Button>
                        ) : (
                          <Button
                            variant="quiet"
                            disabled={busy}
                            onClick={() => void setEnabled(account, true)}
                          >
                            {t("administration.accounts.enable", "Enable")}
                          </Button>
                        )}
                        <Button
                          variant="quiet"
                          icon="key"
                          onClick={() => {
                            setShowingCredentials(account);
                          }}
                        >
                          {t("administration.accounts.credentials", "Credentials")}
                        </Button>
                      </Can>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <ListFooter
            shown={accounts.items.length}
            counted={plural("administration.accounts.count", accounts.items.length, { one: "{count} account", other: "{count} accounts" })}
            hasMore={accounts.hasMore}
            loadingMore={accounts.loadingMore}
            moreProblem={accounts.moreProblem}
            onLoadMore={accounts.loadMore}
          />
        </div>
      )}

      <CredentialsDialog
        account={showingCredentials}
        onClose={() => {
          setShowingCredentials(null);
        }}
      />
      <NewAccountDialog
        open={creating}
        onClose={() => {
          setCreating(false);
        }}
        onCreated={(account) => {
          setCreating(false);
          accounts.reload();
          notify({ tone: "good", title: t("administration.accounts.createdNotice", "{name} created", { name: account.displayName }) });
        }}
      />
      <ConfirmDialog
        open={disabling !== null}
        title={t("administration.accounts.disableAccount", "Disable account")}
        confirmLabel={t("administration.accounts.disableAccount", "Disable account")}
        destructive
        busy={busy}
        onConfirm={() => {
          if (disabling !== null) {
            void setEnabled(disabling, false);
          }
        }}
        onCancel={() => {
          setDisabling(null);
        }}
      >
        <p>
          {t(
            "administration.accounts.disableDescription",
            "{name} can no longer sign in, and every credential it holds stops working. It can be enabled again later.",
            { name: <strong>{disabling?.displayName}</strong> },
          )}
        </p>
      </ConfirmDialog>
    </>
  );
}

function NewAccountDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (account: SubjectView) => void;
}) {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState("");
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  const reset = () => {
    setDisplayName("");
    setNameError(undefined);
    setProblem(null);
    setSaving(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (displayName.trim().length === 0) {
      setNameError(t("administration.accounts.nameRequired", "Give the account a name people will recognise."));
      return;
    }
    setNameError(undefined);
    setSaving(true);
    setProblem(null);
    try {
      const account = await api.createSubject(displayName.trim());
      reset();
      onCreated(account);
    } catch (error) {
      setProblem(describeProblem(error));
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={t("administration.accounts.new", "New account")}
      footer={
        <>
          <Button
            variant="quiet"
            disabled={saving}
            onClick={() => {
              reset();
              onClose();
            }}
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="submit" form="new-account-form" variant="primary" disabled={saving}>
            {saving
              ? t("administration.accounts.creating", "Creating…")
              : t("administration.accounts.create", "Create account")}
          </Button>
        </>
      }
    >
      <form
        id="new-account-form"
        className={PANEL_FORM}
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
      >
        {problem !== null && (
          <Notice tone="error" title={problem.title}>
            {problem.detail ?? problem.description}
          </Notice>
        )}
        <Field
          label={t("administration.accounts.displayName", "Display name")}
          required
          error={nameError}
          hint={t("administration.accounts.displayNameHint", "Shown wherever this account appears.")}
        >
          <Input
            value={displayName}
            maxLength={160}
            onChange={(event) => {
              setDisplayName(event.target.value);
            }}
            fullWidth
            autoFocus
          />
        </Field>
      </form>
    </Dialog>
  );
}
