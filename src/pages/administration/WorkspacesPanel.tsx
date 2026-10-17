import { useEffect, useState, type FormEvent } from "react";
import { Can } from "../../access/Can";
import { PERMISSIONS } from "../../access/permissions";
import { formatDateTime, shortIdentifier } from "../../application/format";
import { describeProblem, type Problem } from "../../application/problems";
import { useReadySession } from "../../application/session";
import { usePagedList } from "../../application/usePagedList";
import { api } from "../../lib/api";
import { useTranslation } from "../../translations/TranslationProvider";
import type { WorkspaceView } from "../../lib/contracts";
import { EmptyState, ListFooter, Notice, ProblemState, Waiting, useToaster } from "../../ui/components";
import { Badge, Button, Dialog, Field, Input, Table } from "../../ui/primitives";
import { WorkspacePinDialog } from "./WorkspacePinDialog";
import { ACCOUNT_NAME, NAME_LINE, PANEL_FORM, PANEL_SURFACE, PANEL_TOOLBAR } from "./administrationClasses";

const NAME_LIMIT = 160;

type Editing = { workspace: WorkspaceView | null } | null;

/**
 * The workspaces this account can see — every one, for an administrator of all of them. A workspace is
 * where sources, documents and their indexes live apart from every other.
 */
export function WorkspacesPanel() {
  const { workspace: current, selectWorkspace, rememberWorkspace } = useReadySession();
  const { notify } = useToaster();
  const { t, plural } = useTranslation();
  const workspaces = usePagedList((page) => api.listWorkspaces(page), []);
  const [editing, setEditing] = useState<Editing>(null);
  const [pinOf, setPinOf] = useState<WorkspaceView | null>(null);

  if (workspaces.status === "loading") {
    return <Waiting label={t("administration.workspaces.loading", "Loading workspaces")} />;
  }
  if (workspaces.status === "failed") {
    return <ProblemState layout="section" problem={workspaces.problem} actions={<Button icon="refresh" onClick={workspaces.reload}>{t("common.tryAgain", "Try again")}</Button>} />;
  }

  return (
    <>
      <div className={PANEL_TOOLBAR}>
        <span className="text-xs text-secondary">
          {t("administration.workspaces.lead", "Each workspace keeps its own sources, documents, index, scripts and members.")}
        </span>
        <Can permission={PERMISSIONS.workspaceCreate}>
          <Button variant="primary" icon="plus" onClick={() => setEditing({ workspace: null })}>
            {t("administration.workspaces.new", "New workspace")}
          </Button>
        </Can>
      </div>
      {workspaces.items.length === 0 ? (
        <EmptyState
          title={t("administration.workspaces.empty", "No workspaces")}
          description={t("administration.workspaces.emptyDescription", "Create the first workspace to start adding sources.")}
        />
      ) : (
        <div className={PANEL_SURFACE}>
          <Table>
            <thead>
              <tr>
                <th scope="col">{t("administration.workspaces.workspace", "Workspace")}</th>
                <th scope="col">{t("administration.workspaces.created", "Created")}</th>
                <th scope="col">{t("administration.workspaces.changed", "Changed")}</th>
                <th scope="col">
                  <span className="sr-only">{t("common.actions", "Actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {workspaces.items.map((workspace) => {
                const isCurrent = workspace.id === current?.id;
                return (
                  <tr key={workspace.id} data-selected={isCurrent}>
                    <td>
                      <div className={NAME_LINE}>
                        <strong className={ACCOUNT_NAME}>{workspace.name}</strong>
                        {isCurrent && <Badge tone="active">{t("administration.workspaces.current", "Current")}</Badge>}
                        {workspace.locked && <Badge tone="warn">{t("administration.workspaces.pinned", "PIN")}</Badge>}
                      </div>
                      <div className="numeric text-muted" title={workspace.id}>
                        {t("administration.workspaces.identity", "{identifier} · revision {revision}", {
                          identifier: shortIdentifier(workspace.id),
                          revision: workspace.revision,
                        })}
                      </div>
                    </td>
                    <td className="text-xs text-secondary">{formatDateTime(workspace.createdAt)}</td>
                    <td className="text-xs text-secondary">{formatDateTime(workspace.updatedAt)}</td>
                    <td className="actions">
                      <Button variant="quiet" icon="access" onClick={() => setPinOf(workspace)}>
                        {workspace.locked ? t("administration.workspaces.removePin", "Remove PIN") : t("administration.workspaces.setPin", "Lock with PIN")}
                      </Button>
                      <Button variant="quiet" iconOnly icon="edit" aria-label={t("administration.workspaces.renameNamed", "Rename {name}", { name: workspace.name })} title={t("administration.workspaces.rename", "Rename")} onClick={() => setEditing({ workspace })} />
                      {!isCurrent && (
                        <Button
                          variant="quiet"
                          onClick={() => {
                            rememberWorkspace(workspace);
                            selectWorkspace(workspace.id);
                            notify({ tone: "good", title: t("administration.workspaces.switched", "Working in {name}", { name: workspace.name }) });
                          }}
                        >
                          {t("administration.workspaces.switchTo", "Switch to")}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <ListFooter
            shown={workspaces.items.length}
            counted={plural("administration.workspaces.count", workspaces.items.length, { one: "{count} workspace", other: "{count} workspaces" })}
            hasMore={workspaces.hasMore}
            loadingMore={workspaces.loadingMore}
            moreProblem={workspaces.moreProblem}
            onLoadMore={workspaces.loadMore}
          />
        </div>
      )}
      <WorkspacePinDialog
        workspace={pinOf}
        onClose={() => setPinOf(null)}
        onSaved={() => {
          const changed = pinOf;
          setPinOf(null);
          notify({
            tone: "good",
            title: changed?.locked
              ? t("administration.workspaces.pinRemoved", "{name} has no PIN now", { name: changed?.name ?? "" })
              : t("administration.workspaces.pinSet", "{name} is locked with a PIN", { name: changed?.name ?? "" }),
          });
          workspaces.reload();
          if (changed !== null) {
            void api.getWorkspace(changed.id).then(rememberWorkspace).catch(() => undefined);
          }
        }}
      />
      <WorkspaceDialog
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={(saved, created) => {
          setEditing(null);
          rememberWorkspace(saved);
          workspaces.reload();
          notify({
            tone: "good",
            title: created
              ? t("administration.workspaces.createdNotice", "{name} created", { name: saved.name })
              : t("administration.workspaces.savedNotice", "{name} saved", { name: saved.name }),
            description: created
              ? t("administration.workspaces.createdDescription", "You are its owner; example scripts were added as drafts.")
              : undefined,
          });
        }}
      />
    </>
  );
}

function WorkspaceDialog({ editing, onClose, onSaved }: { editing: Editing; onClose: () => void; onSaved: (workspace: WorkspaceView, created: boolean) => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [saving, setSaving] = useState(false);
  const target = editing?.workspace ?? null;

  useEffect(() => {
    if (editing !== null) {
      setName(editing.workspace?.name ?? "");
      setNameError(undefined);
      setProblem(null);
      setSaving(false);
    }
  }, [editing]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim().length === 0) {
      setNameError(t("administration.workspaces.nameRequired", "Name the workspace."));
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      onSaved(target === null ? await api.createWorkspace(name.trim()) : await api.renameWorkspace(target, name.trim()), target === null);
    } catch (error) {
      setProblem(describeProblem(error));
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={editing !== null}
      onClose={onClose}
      title={
        target === null
          ? t("administration.workspaces.new", "New workspace")
          : t("administration.workspaces.renameNamed", "Rename {name}", { name: target.name })
      }
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={saving}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="submit" form="workspace-form" variant="primary" disabled={saving}>
            {saving
              ? t("common.saving", "Saving…")
              : target === null
                ? t("administration.workspaces.create", "Create workspace")
                : t("common.save", "Save")}
          </Button>
        </>
      }
    >
      <form id="workspace-form" className={PANEL_FORM} onSubmit={(event) => void save(event)} noValidate>
        {problem !== null && (
          <Notice tone="error" title={problem.title}>
            {problem.detail ?? problem.description}
          </Notice>
        )}
        <Field label={t("administration.workspaces.name", "Name")} required error={nameError}>
          <Input value={name} maxLength={NAME_LIMIT} fullWidth autoFocus onChange={(event) => setName(event.target.value)} />
        </Field>
      </form>
    </Dialog>
  );
}
