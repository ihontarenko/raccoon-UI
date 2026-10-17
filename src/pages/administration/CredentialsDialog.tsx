import { useEffect, useState, type FormEvent } from "react";
import { formatDateTime } from "../../application/format";
import { describeProblem, type Problem } from "../../application/problems";
import { usePagedList } from "../../application/usePagedList";
import { api } from "../../lib/api";
import { declareText, type DeclaredText } from "../../translations/translate";
import { useTranslation } from "../../translations/TranslationProvider";
import type { CredentialView, IssuedCredential, SubjectView } from "../../lib/contracts";
import { ConfirmDialog, ListFooter, Notice, ProblemState, Waiting, useToaster } from "../../ui/components";
import { Badge, Button, Dialog, Field, Input, Table, type BadgeTone } from "../../ui/primitives";
import { ISSUE_ROW, PANEL_FORM, PANEL_SURFACE, TOKEN_ROW, TOKEN_VALUE } from "./administrationClasses";

const LABEL_LIMIT = 160;

const REVOKED = declareText("administration.credentials.revoked", "Revoked");
const EXPIRED = declareText("administration.credentials.expired", "Expired");
const ACTIVE = declareText("administration.credentials.active", "Active");

function stateOf(credential: CredentialView): { active: boolean; label: DeclaredText; tone: BadgeTone } {
  if (credential.revokedAt !== null) {
    return { active: false, label: REVOKED, tone: "neutral" };
  }
  if (new Date(credential.expiresAt).getTime() < Date.now()) {
    return { active: false, label: EXPIRED, tone: "warn" };
  }
  return { active: true, label: ACTIVE, tone: "good" };
}

/**
 * The credentials one account signs in with. Issuing shows the token exactly once — it is stored only
 * as a hash — so the dialog keeps it on screen until the person has copied it and closes it themselves.
 */
export function CredentialsDialog({ account, onClose }: { account: SubjectView | null; onClose: () => void }) {
  const { notify } = useToaster();
  const { t, plural, say } = useTranslation();
  const credentials = usePagedList(
    (page) => (account === null ? Promise.resolve([]) : api.listCredentials(account.id, page)),
    [account?.id],
  );
  const [label, setLabel] = useState("");
  const [issued, setIssued] = useState<IssuedCredential | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [revoking, setRevoking] = useState<CredentialView | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLabel("");
    setIssued(null);
    setProblem(null);
    setCopied(false);
  }, [account?.id]);

  const issue = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (account === null || label.trim().length === 0) {
      return;
    }
    setIssuing(true);
    setProblem(null);
    try {
      const result = await api.issueCredential(account.id, label.trim());
      setIssued(result);
      setCopied(false);
      setLabel("");
      credentials.reload();
    } catch (error) {
      setProblem(describeProblem(error));
    } finally {
      setIssuing(false);
    }
  };

  const revoke = async (credential: CredentialView) => {
    if (account === null) {
      return;
    }
    try {
      await api.revokeCredential(account.id, credential.id);
      notify({
        tone: "good",
        title: t("administration.credentials.revokedNotice", "{label} revoked", { label: credential.label }),
        description: t("administration.credentials.revokedDescription", "It stops working at once."),
      });
      credentials.reload();
    } catch (error) {
      const failure = describeProblem(error);
      notify({ tone: "error", title: failure.title, description: failure.detail ?? failure.description });
    }
  };

  const copy = async () => {
    if (issued === null) {
      return;
    }
    try {
      await navigator.clipboard.writeText(issued.token);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <Dialog open={account !== null} onClose={onClose} title={t("administration.credentials.title", "Credentials of {name}", { name: account?.displayName ?? "" })} size="wide">
        <div className={PANEL_FORM}>
          {issued !== null && (
            <Notice tone="warn" title={t("administration.credentials.copyNow", "Copy the token for “{label}” now", { label: issued.credential.label })}>
              <div className={TOKEN_ROW}>
                <code className={TOKEN_VALUE}>{issued.token}</code>
                <Button icon={copied ? "check" : "copy"} onClick={() => void copy()}>
                  {copied ? t("administration.credentials.copied", "Copied") : t("administration.credentials.copy", "Copy")}
                </Button>
              </div>
              {t("administration.credentials.shownOnce", "It is never shown again. Valid until {date}.", {
                date: formatDateTime(issued.credential.expiresAt),
              })}
            </Notice>
          )}
          {problem !== null && (
            <Notice tone="error" title={problem.title}>
              {problem.detail ?? problem.description}
            </Notice>
          )}
          <form className={ISSUE_ROW} onSubmit={(event) => void issue(event)}>
            <Field
              label={t("administration.credentials.new", "New credential")}
              hint={t("administration.credentials.newHint", "Name it for where it will be used: a laptop, a script, an assistant.")}
            >
              <Input value={label} maxLength={LABEL_LIMIT} fullWidth placeholder={t("administration.credentials.placeholder", "Build server")} onChange={(event) => setLabel(event.target.value)} />
            </Field>
            <Button type="submit" variant="primary" icon="key" disabled={issuing || label.trim().length === 0 || account?.enabled === false}>
              {issuing ? t("administration.credentials.issuing", "Issuing…") : t("administration.credentials.issue", "Issue")}
            </Button>
          </form>
          {account?.enabled === false && <p className="text-xs text-muted">{t("administration.credentials.disabledAccount", "A disabled account cannot be issued credentials.")}</p>}
          {credentials.status === "loading" && <Waiting label={t("administration.credentials.loading", "Loading credentials")} lines={3} />}
          {credentials.status === "failed" && <ProblemState layout="section" problem={credentials.problem} />}
          {credentials.status === "ready" &&
            (credentials.items.length === 0 ? (
              <p className="text-xs text-muted">
                {t("administration.credentials.empty", "No credentials yet. Issue one to let this account sign in or call the API.")}
              </p>
            ) : (
              <div className={PANEL_SURFACE}>
                <Table>
                  <thead>
                    <tr>
                      <th scope="col">{t("administration.credentials.credential", "Credential")}</th>
                      <th scope="col">{t("administration.credentials.issued", "Issued")}</th>
                      <th scope="col">{t("administration.credentials.validUntil", "Valid until")}</th>
                      <th scope="col">{t("administration.credentials.state", "State")}</th>
                      <th scope="col">
                        <span className="sr-only">{t("common.actions", "Actions")}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {credentials.items.map((credential) => {
                      const state = stateOf(credential);
                      return (
                        <tr key={credential.id}>
                          <td>
                            <strong>{credential.label}</strong>
                          </td>
                          <td className="text-xs text-secondary">{formatDateTime(credential.createdAt)}</td>
                          <td className="text-xs text-secondary">{formatDateTime(credential.expiresAt)}</td>
                          <td>
                            <Badge tone={state.tone}>{say(state.label)}</Badge>
                            {credential.revokedAt !== null && <div className="text-xs text-muted">{formatDateTime(credential.revokedAt)}</div>}
                          </td>
                          <td className="actions">
                            {state.active && (
                              <Button variant="quiet" onClick={() => setRevoking(credential)}>
                                {t("administration.credentials.revoke", "Revoke")}
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
                <ListFooter
                  shown={credentials.items.length}
                  counted={plural("administration.credentials.count", credentials.items.length, { one: "{count} credential", other: "{count} credentials" })}
                  hasMore={credentials.hasMore}
                  loadingMore={credentials.loadingMore}
                  moreProblem={credentials.moreProblem}
                  onLoadMore={credentials.loadMore}
                />
              </div>
            ))}
        </div>
      </Dialog>
      <ConfirmDialog
        open={revoking !== null}
        title={t("administration.credentials.revokeTitle", "Revoke credential")}
        confirmLabel={t("administration.credentials.revoke", "Revoke")}
        destructive
        onConfirm={() => {
          if (revoking !== null) {
            const target = revoking;
            setRevoking(null);
            void revoke(target);
          }
        }}
        onCancel={() => setRevoking(null)}
      >
        <p>
          {t(
            "administration.credentials.revokeDescription",
            "{label} stops working immediately. Whatever uses it has to be given a new one.",
            { label: <strong>{revoking?.label}</strong> },
          )}
        </p>
      </ConfirmDialog>
    </>
  );
}
