import { useState } from "react";
import { Can } from "../../access/Can";
import { PERMISSIONS } from "../../access/permissions";
import { formatDateTime } from "../../application/format";
import { describeProblem, type Problem } from "../../application/problems";
import { useResource } from "../../application/useResource";
import { api } from "../../lib/api";
import type { RepositoryAccessCheck, RepositoryAccessView, SourceView } from "../../lib/contracts";
import { Notice, useToaster } from "../../ui/components";
import { Badge, Button, type BadgeTone } from "../../ui/primitives";
import { ARRIVAL_ACTIONS, ARRIVAL_FACTS, ARRIVAL_FORM, ARRIVAL_INLINE, REPOSITORY_ACCESS } from "./sourcePageClasses";
import { useTranslation } from "../../translations/TranslationProvider";
import { declareText, type DeclaredText } from "../../translations/translate";


/** GitHub and GitLab are names and stay as they are; only "another host" is worded. */
const HOSTING_LABEL: Record<RepositoryAccessCheck["hosting"], DeclaredText | string> = {
  GITHUB: "GitHub",
  GITLAB: "GitLab",
  OTHER: declareText("sourceSetup.repository.hosting.other", "Another host"),
};

const VISIBILITY_LABEL: Record<NonNullable<RepositoryAccessCheck["visibility"]>, DeclaredText> = {
  PUBLIC: declareText("sourceSetup.repository.visibility.public", "Public"),
  INTERNAL: declareText("sourceSetup.repository.visibility.internal", "Internal"),
  PRIVATE: declareText("sourceSetup.repository.visibility.private", "Private"),
};

const VERDICT = {
  setNotChecked: declareText("sourceSetup.repository.token.setNotChecked", "Set — not checked yet"),
  notSet: declareText("sourceSetup.repository.token.notSet", "Not set"),
  anonymous: declareText("sourceSetup.repository.token.anonymous", "Not set — clones are anonymous"),
  rejected: declareText("sourceSetup.repository.token.rejected", "Rejected"),
  noReadScope: declareText("sourceSetup.repository.token.noReadScope", "No read scope"),
  notUsed: declareText("sourceSetup.repository.token.notUsed", "Not used for this host"),
  rateLimited: declareText("sourceSetup.repository.token.rateLimited", "Rate limited"),
  notAnswered: declareText("sourceSetup.repository.token.notAnswered", "Not answered"),
  notFound: declareText("sourceSetup.repository.token.notFound", "Repository not found"),
  works: declareText("sourceSetup.repository.token.works", "Works"),
};

/** What the token's state means for a scan, in a word and a tone; the explanation carries the rest. */
function tokenVerdict(tokenSet: boolean, check: RepositoryAccessCheck | null): { tone: BadgeTone; label: DeclaredText } {
  if (check === null) {
    return tokenSet ? { tone: "neutral", label: VERDICT.setNotChecked } : { tone: "neutral", label: VERDICT.notSet };
  }
  switch (check.tokenState) {
    case "NOT_SET":
      return { tone: "neutral", label: VERDICT.anonymous };
    case "REJECTED":
      return { tone: "error", label: VERDICT.rejected };
    case "NO_READ_SCOPE":
      return { tone: "error", label: VERDICT.noReadScope };
    case "NOT_USED":
      return { tone: "warn", label: VERDICT.notUsed };
    case "NOT_CHECKED":
      return check.repositoryState === "RATE_LIMITED" || check.rateLimitResetsAt !== null
        ? { tone: "warn", label: VERDICT.rateLimited }
        : { tone: "warn", label: VERDICT.notAnswered };
    case "ACCEPTED":
      if (check.repositoryState === "NOT_FOUND") {
        return { tone: "error", label: VERDICT.notFound };
      }
      if (check.repositoryState === "RATE_LIMITED") {
        return { tone: "warn", label: VERDICT.rateLimited };
      }
      return { tone: "allow", label: VERDICT.works };
  }
}

interface RepositoryAccessProperties {
  workspaceId: string;
  source: SourceView;
}

/**
 * Who hosts a git source's repository, whether it is public, internal or private, and whether the access token of
 * the connection it reads through works. The token belongs to the connection, set in administration; the page only
 * learns whether one is set.
 */
export function RepositoryAccess({ workspaceId, source }: RepositoryAccessProperties) {
  const { t, say } = useTranslation();
  const { notify } = useToaster();
  const access = useResource(() => api.repositoryAccess(workspaceId, source.id), [workspaceId, source.id, source.revision]);
  const [shown, setShown] = useState<RepositoryAccessView | null>(null);
  const [busy, setBusy] = useState<"check" | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);

  if (access.status === "loading") {
    return <p className="text-xs text-muted">{t("sourceSetup.repository.loading", "Loading repository access…")}</p>;
  }
  if (access.status === "failed") {
    return (
      <Notice tone="error" title={t("sourceSetup.repository.failed", "Repository access could not be read")}>
        {access.problem.detail ?? access.problem.description}
      </Notice>
    );
  }
  const view = shown ?? access.data;
  const check = view.lastCheck;
  const verdict = tokenVerdict(view.tokenSet, check);
  const hostingLabel = (hosting: RepositoryAccessCheck["hosting"]): string => {
    const label = HOSTING_LABEL[hosting];
    return typeof label === "string" ? label : say(label);
  };

  const run = async (action: "check", call: () => Promise<RepositoryAccessView>, done: string) => {
    setBusy(action);
    setProblem(null);
    try {
      const answered = await call();
      setShown(answered);
      notify({ tone: "good", title: done });
    } catch (error) {
      setProblem(describeProblem(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={REPOSITORY_ACCESS}>
      <dl className={ARRIVAL_FACTS}>
        <dt>{t("sourceSetup.repository.connection", "Connection")}</dt>
        <dd>
          {view.connectionName === null ? (
            <Badge tone="error">{t("sourceSetup.connection.none", "None — add this source again, choosing a connection")}</Badge>
          ) : (
            <>
              {view.connectionName}{" "}
              <span className="text-xs text-secondary">
                {t("sourceSetup.repository.tokenOnConnection", "holds the access token; it is changed in Administration › Connections.")}
              </span>
            </>
          )}
        </dd>
        <dt>{t("sourceSetup.repository.hostedOn", "Hosted on")}</dt>
        <dd>
          {check === null ? (
            <span className="text-muted">{t("sourceSetup.repository.notCheckedYet", "not checked yet")}</span>
          ) : (
            <>
              {hostingLabel(check.hosting)}
              {check.host !== null && <span className="text-muted numeric"> · {check.host}</span>}
            </>
          )}
        </dd>
        <dt>{t("sourceSetup.repository.visibilityLabel", "Visibility")}</dt>
        <dd>
          {check?.visibility == null ? (
            <span className="text-muted">
              {check === null
                ? t("sourceSetup.repository.notCheckedYet", "not checked yet")
                : t("sourceSetup.repository.unknown", "unknown")}
            </span>
          ) : (
            <Badge tone={check.visibility === "PUBLIC" ? "neutral" : "active"}>{say(VISIBILITY_LABEL[check.visibility])}</Badge>
          )}
        </dd>
        {check?.defaultBranch != null && (
          <>
            <dt>{t("sourceSetup.repository.defaultBranch", "Default branch")}</dt>
            <dd className="numeric">{check.defaultBranch}</dd>
          </>
        )}
        <dt>{t("sourceSetup.git.accessToken", "Access token")}</dt>
        <dd className={ARRIVAL_INLINE}>
          <Badge tone={verdict.tone}>{say(verdict.label)}</Badge>
          {check?.tokenState === "ACCEPTED" && check.account !== null && (
            <span className="text-xs text-secondary">{t("sourceSetup.repository.asAccount", "as {account}", { account: check.account })}</span>
          )}
        </dd>
        {check !== null && check.tokenState !== "NOT_SET" && check.tokenState !== "NOT_USED" && check.scopesReported && (
          <>
            <dt>{t("sourceSetup.repository.scopes", "Scopes")}</dt>
            <dd className="numeric text-xs">
              {check.scopes.length === 0 ? <span className="text-muted">{t("sourceSetup.connected.none", "none")}</span> : check.scopes.join(", ")}
            </dd>
          </>
        )}
        {check?.tokenExpiresAt != null && (
          <>
            <dt>{t("sourceSetup.repository.tokenExpires", "Token expires")}</dt>
            <dd>{formatDateTime(check.tokenExpiresAt)}</dd>
          </>
        )}
      </dl>
      {check !== null && (
        <p className="text-xs text-secondary">
          {check.explanation}
          {check.rateLimitResetsAt !== null && (
            <>
              {" "}
              {t("sourceSetup.repository.answersAgain", "Answers again after {moment}.", { moment: formatDateTime(check.rateLimitResetsAt) })}
            </>
          )}{" "}
          <span className="text-muted">{t("sourceSetup.repository.checkedAt", "Checked {moment}.", { moment: formatDateTime(check.checkedAt) })}</span>
        </p>
      )}
      <Can permission={PERMISSIONS.sourceManage}>
        <div className={ARRIVAL_FORM}>
          {problem !== null && (
            <Notice tone="error" title={problem.title}>
              {problem.detail ?? problem.description}
            </Notice>
          )}
          <div className={ARRIVAL_ACTIONS}>
            <Button
              icon="refresh"
              disabled={busy !== null}
              onClick={() =>
                void run(
                  "check",
                  () => api.checkRepositoryAccess(workspaceId, source.id),
                  t("sourceSetup.repository.checked", "Access checked"),
                )
              }
            >
              {busy === "check" ? t("sourceSetup.repository.checking", "Checking…") : t("sourceSetup.repository.check", "Check access")}
            </Button>
          </div>
        </div>
      </Can>
    </div>
  );
}
