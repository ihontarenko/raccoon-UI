import { useMemo, useState, type FormEvent } from "react";
import { Can } from "../../access/Can";
import { usePermissions } from "../../access/PermissionsProvider";
import { PERMISSIONS } from "../../access/permissions";
import { shortIdentifier } from "../../application/format";
import { describeProblem, type Problem } from "../../application/problems";
import { useReadySession } from "../../application/session";
import { useResource } from "../../application/useResource";
import { api, collectAllPages } from "../../lib/api";
import { declareText, translateDeclared, type DeclaredText } from "../../translations/translate";
import { useTranslation } from "../../translations/TranslationProvider";
import type { MemberView, SubjectView, WorkspaceRole } from "../../lib/contracts";
import {
  ConfirmDialog,
  EmptyState,
  Notice,
  ProblemState,
  Waiting,
  useToaster,
} from "../../ui/components";
import { Badge, Button, Dialog, Field, Input, Select, Table } from "../../ui/primitives";
import { ACCOUNT_NAME, PANEL_FORM, PANEL_SURFACE, PANEL_TOOLBAR } from "./administrationClasses";

const ROLES: { value: WorkspaceRole; label: DeclaredText; description: DeclaredText }[] = [
  {
    value: "OWNER",
    label: declareText("administration.members.role.owner", "Owner"),
    description: declareText("administration.members.role.ownerDescription", "Manage sources, automation and membership"),
  },
  {
    value: "EDITOR",
    label: declareText("administration.members.role.editor", "Editor"),
    description: declareText("administration.members.role.editorDescription", "Add documents, read sources"),
  },
  {
    value: "VIEWER",
    label: declareText("administration.members.role.viewer", "Viewer"),
    description: declareText("administration.members.role.viewerDescription", "Search and read"),
  },
];

function roleLabel(role: WorkspaceRole): string {
  const declared = ROLES.find((candidate) => candidate.value === role)?.label;
  return declared === undefined ? role : translateDeclared(declared);
}

export function MembersPanel() {
  const { workspace, viewer } = useReadySession();
  const workspaceId = workspace?.id ?? null;
  const permissions = usePermissions();
  const mayReadAccounts = permissions.may(PERMISSIONS.identityManage);
  const { notify } = useToaster();
  const { t, say } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<MemberView | null>(null);
  const [busy, setBusy] = useState(false);

  const members = useResource(
    () =>
      workspaceId === null
        ? Promise.resolve([])
        : collectAllPages((page) => api.listMembers(workspaceId, page)),
    [workspaceId],
  );
  // Names come from the account list, which only an identity administrator may read; everyone else
  // sees identifiers, which is still enough to tell members apart.
  const accounts = useResource(
    () =>
      mayReadAccounts ? collectAllPages((page) => api.listSubjects(page)) : Promise.resolve([]),
    [mayReadAccounts],
  );
  const accountById = useMemo(
    () =>
      new Map<string, SubjectView>(
        accounts.status === "ready" ? accounts.data.map((account) => [account.id, account]) : [],
      ),
    [accounts],
  );

  if (workspaceId === null) {
    return (
      <EmptyState
        title={t("shell.rail.noWorkspace", "No workspace")}
        description={t("administration.members.noWorkspace", "Membership belongs to a workspace, and none is open.")}
      />
    );
  }
  if (members.status === "loading") {
    return <Waiting label={t("administration.members.loading", "Loading members")} />;
  }
  if (members.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={members.problem}
        actions={
          <Button icon="refresh" onClick={members.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }

  const nameOf = (subjectId: string) =>
    accountById.get(subjectId)?.displayName ??
    t("administration.members.accountIdentifier", "Account {identifier}", { identifier: shortIdentifier(subjectId) });

  const changeRole = async (member: MemberView, role: WorkspaceRole) => {
    setBusy(true);
    try {
      const saved = await api.changeMember(workspaceId, member.subjectId, role, member.revision);
      members.replace(
        members.data.map((candidate) =>
          candidate.subjectId === saved.subjectId ? saved : candidate,
        ),
      );
      notify({
        tone: "good",
        title: t("administration.members.roleChanged", "{name} is now {role}", {
          name: nameOf(member.subjectId),
          role: roleLabel(role).toLowerCase(),
        }),
      });
    } catch (error) {
      const problem = describeProblem(error);
      notify({
        tone: "error",
        title: problem.title,
        description: problem.detail ?? problem.description,
      });
      members.reload();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (member: MemberView) => {
    setBusy(true);
    try {
      await api.removeMember(workspaceId, member);
      members.replace(members.data.filter((candidate) => candidate.subjectId !== member.subjectId));
      notify({
        tone: "good",
        title: t("administration.members.removedNotice", "{name} removed from {workspace}", {
          name: nameOf(member.subjectId),
          workspace: workspace?.name ?? t("administration.members.theWorkspace", "the workspace"),
        }),
      });
    } catch (error) {
      const problem = describeProblem(error);
      notify({
        tone: "error",
        title: problem.title,
        description: problem.detail ?? problem.description,
      });
    } finally {
      setBusy(false);
      setRemoving(null);
    }
  };

  const memberIds = new Set(members.data.map((member) => member.subjectId));

  return (
    <>
      <div className={PANEL_TOOLBAR}>
        <span className="text-xs text-secondary">
          {t(
            "administration.members.lead",
            "Members of {workspace}. A role decides what a member may do in this workspace only.",
            { workspace: <strong>{workspace?.name}</strong> },
          )}
        </span>
        <Can permission={PERMISSIONS.workspaceMembers}>
          <Button
            variant="primary"
            icon="plus"
            onClick={() => {
              setAdding(true);
            }}
          >
            {t("administration.members.add", "Add member")}
          </Button>
        </Can>
      </div>
      {members.data.length === 0 ? (
        <EmptyState
          title={t("administration.members.empty", "No members")}
          description={t("administration.members.emptyDescription", "Add an account to give it a role in this workspace.")}
        />
      ) : (
        <div className={PANEL_SURFACE}>
          <Table>
            <thead>
              <tr>
                <th scope="col">{t("administration.members.member", "Member")}</th>
                <th scope="col">{t("administration.members.role", "Role")}</th>
                <th scope="col">
                  <span className="sr-only">{t("common.actions", "Actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {members.data.map((member) => {
                const isViewer = member.subjectId === viewer.subjectId;
                return (
                  <tr key={member.subjectId}>
                    <td>
                      <strong className={ACCOUNT_NAME}>{nameOf(member.subjectId)}</strong>
                      <div className="numeric text-muted">
                        {shortIdentifier(member.subjectId)}
                        {isViewer ? t("administration.accounts.you", " · you") : ""}
                      </div>
                    </td>
                    <td>
                      <Can
                        permission={PERMISSIONS.workspaceMembers}
                        fallback={<Badge>{roleLabel(member.role)}</Badge>}
                      >
                        <Select
                          aria-label={t("administration.members.roleOf", "Role of {name}", { name: nameOf(member.subjectId) })}
                          value={member.role}
                          disabled={busy}
                          onChange={(event) =>
                            void changeRole(member, event.target.value as WorkspaceRole)
                          }
                        >
                          {ROLES.map((role) => (
                            <option key={role.value} value={role.value}>
                              {say(role.label)} — {say(role.description)}
                            </option>
                          ))}
                        </Select>
                      </Can>
                    </td>
                    <td className="actions">
                      <Can permission={PERMISSIONS.workspaceMembers}>
                        <Button
                          variant="quiet"
                          disabled={busy}
                          onClick={() => {
                            setRemoving(member);
                          }}
                        >
                          {t("administration.members.remove", "Remove")}
                        </Button>
                      </Can>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}

      <AddMemberDialog
        open={adding}
        workspaceId={workspaceId}
        candidates={
          accounts.status === "ready"
            ? accounts.data.filter((account) => !memberIds.has(account.id))
            : null
        }
        onClose={() => {
          setAdding(false);
        }}
        onAdded={(member) => {
          setAdding(false);
          members.replace([...members.data, member]);
          notify({
            tone: "good",
            title: t("administration.members.addedNotice", "{name} added as {role}", {
              name: nameOf(member.subjectId),
              role: roleLabel(member.role).toLowerCase(),
            }),
          });
        }}
      />
      <ConfirmDialog
        open={removing !== null}
        title={t("administration.members.removeMember", "Remove member")}
        confirmLabel={t("administration.members.removeMember", "Remove member")}
        destructive
        busy={busy}
        onConfirm={() => {
          if (removing !== null) {
            void remove(removing);
          }
        }}
        onCancel={() => {
          setRemoving(null);
        }}
      >
        <p>
          {t("administration.members.removeDescription", "{name} loses access to {workspace}.", {
            name: <strong>{removing === null ? "" : nameOf(removing.subjectId)}</strong>,
            workspace: workspace?.name ?? "",
          })}
          {removing?.subjectId === viewer.subjectId
            ? t("administration.members.ownMembership", " That is your own membership.")
            : ""}
        </p>
      </ConfirmDialog>
    </>
  );
}

interface AddMemberDialogProperties {
  open: boolean;
  workspaceId: string;
  /** Accounts that may be added, or null when the caller may not list accounts and types an identifier. */
  candidates: SubjectView[] | null;
  onClose: () => void;
  onAdded: (member: MemberView) => void;
}

function AddMemberDialog({
  open,
  workspaceId,
  candidates,
  onClose,
  onAdded,
}: AddMemberDialogProperties) {
  const { t, say } = useTranslation();
  const [subjectId, setSubjectId] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("VIEWER");
  const [subjectError, setSubjectError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  const close = () => {
    setSubjectId("");
    setRole("VIEWER");
    setSubjectError(undefined);
    setProblem(null);
    setSaving(false);
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (subjectId.trim().length === 0) {
      setSubjectError(t("administration.members.accountRequired", "Choose the account to add."));
      return;
    }
    setSubjectError(undefined);
    setSaving(true);
    setProblem(null);
    try {
      // A membership that does not exist yet is created at revision zero.
      const member = await api.changeMember(workspaceId, subjectId.trim(), role, 0);
      setSubjectId("");
      setSaving(false);
      onAdded(member);
    } catch (error) {
      setProblem(describeProblem(error));
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t("administration.members.add", "Add member")}
      footer={
        <>
          <Button variant="quiet" onClick={close} disabled={saving}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="submit" form="add-member-form" variant="primary" disabled={saving}>
            {saving ? t("administration.members.adding", "Adding…") : t("administration.members.add", "Add member")}
          </Button>
        </>
      }
    >
      <form
        id="add-member-form"
        className={PANEL_FORM}
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
      >
        {problem !== null && (
          <Notice tone="error" title={problem.title}>
            {problem.detail ?? problem.description}
          </Notice>
        )}
        {candidates === null ? (
          <Field
            label={t("administration.members.accountIdentifierLabel", "Account identifier")}
            required
            error={subjectError}
            hint={t("administration.members.accountIdentifierHint", "The account's full identifier.")}
          >
            <Input
              className="numeric"
              value={subjectId}
              onChange={(event) => {
                setSubjectId(event.target.value);
              }}
              fullWidth
              spellCheck={false}
            />
          </Field>
        ) : candidates.length === 0 ? (
          <Notice title={t("administration.members.everyoneMember", "Every account is already a member")}>
            {t("administration.members.createAccountFirst", "Create an account in Accounts first.")}
          </Notice>
        ) : (
          <Field label={t("administration.accounts.account", "Account")} required error={subjectError}>
            <Select
              value={subjectId}
              onChange={(event) => {
                setSubjectId(event.target.value);
              }}
              fullWidth
            >
              <option value="">{t("administration.members.chooseAccount", "Choose an account…")}</option>
              {candidates.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.displayName}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label={t("administration.members.role", "Role")}>
          <Select
            value={role}
            onChange={(event) => {
              setRole(event.target.value as WorkspaceRole);
            }}
            fullWidth
          >
            {ROLES.map((candidate) => (
              <option key={candidate.value} value={candidate.value}>
                {say(candidate.label)} — {say(candidate.description)}
              </option>
            ))}
          </Select>
        </Field>
      </form>
    </Dialog>
  );
}
