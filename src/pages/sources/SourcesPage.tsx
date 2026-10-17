import { useState } from "react";
import { Can } from "../../access/Can";
import { PERMISSIONS } from "../../access/permissions";
import { formatDateTime, shortIdentifier } from "../../application/format";
import { describeProblem } from "../../application/problems";
import { useReadySession } from "../../application/session";
import { usePageTitle } from "../../application/usePageTitle";
import { usePagedList } from "../../application/usePagedList";
import { api } from "../../lib/api";
import type { SourceView } from "../../lib/contracts";
import { useTranslation } from "../../translations/TranslationProvider";
import {
  ConfirmDialog,
  EmptyState,
  Facts,
  Inspector,
  InspectorActions,
  InspectorSection,
  ListFooter,
  PageHeader,
  PathText,
  ProblemState,
  RowName,
  Waiting,
  Workbench,
  useToaster,
} from "../../ui/components";
import { Badge, Button, Table } from "../../ui/primitives";
import { SourceFormDialog } from "./SourceFormDialog";
import { SOURCE_KINDS } from "./sourceKinds";

export function SourcesPage() {
  const { t, plural } = useTranslation();
  usePageTitle(t("sources.title", "Sources"));
  const { workspace } = useReadySession();
  const workspaceId = workspace?.id ?? null;
  const { notify } = useToaster();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<SourceView | null>(null);
  const [disabling, setDisabling] = useState<SourceView | null>(null);
  const [busy, setBusy] = useState(false);

  const sources = usePagedList(
    (page) => (workspaceId === null ? Promise.resolve([]) : api.listSources(workspaceId, page)),
    [workspaceId],
  );

  const header = (
    <PageHeader
      eyebrow={t("sources.eyebrow", "Materials")}
      title={t("sources.title", "Sources")}
      lead={t(
        "sources.lead",
        "Where documents come from: folders, repositories and pushed text. Each source is scanned into versioned documents.",
      )}
      actions={
        workspaceId !== null && (
          <Can permission={PERMISSIONS.sourceManage}>
            <Button variant="primary" icon="plus" href="/sources/new">
              {t("sources.add", "Add source")}
            </Button>
          </Can>
        )
      }
    />
  );

  if (workspaceId === null) {
    return (
      <>
        {header}
        <EmptyState
          title={t("sources.noWorkspace", "No workspace")}
          description={t("sources.noWorkspaceDescription", "Sources belong to a workspace, and you are not a member of any yet.")}
        />
      </>
    );
  }
  if (sources.status === "loading") {
    return (
      <>
        {header}
        <Waiting label={t("sources.loading", "Loading sources")} />
      </>
    );
  }
  if (sources.status === "failed") {
    return (
      <>
        {header}
        <ProblemState
          layout="section"
          problem={sources.problem}
          actions={
            <Button icon="refresh" onClick={sources.reload}>
              {t("common.tryAgain", "Try again")}
            </Button>
          }
        />
      </>
    );
  }

  const selected =
    sources.items.find((source) => source.id === selectedId) ?? sources.items[0] ?? null;

  const replaceSource = (saved: SourceView) => {
    sources.replaceItem((source) => source.id === saved.id, saved);
    setSelectedId(saved.id);
  };

  const setEnabled = async (source: SourceView, enabled: boolean) => {
    setBusy(true);
    try {
      const saved = await api.changeSource(workspaceId, source.id, {
        name: source.name,
        enabled,
        revision: source.revision,
      });
      replaceSource(saved);
      notify({
        tone: "good",
        title: enabled
          ? t("sources.enabledToast", "{name} enabled", { name: source.name })
          : t("sources.disabledToast", "{name} disabled", { name: source.name }),
      });
    } catch (error) {
      const problem = describeProblem(error);
      notify({
        tone: "error",
        title: problem.title,
        description: problem.detail ?? problem.description,
      });
      if (problem.kind === "conflict") {
        sources.reload();
      }
    } finally {
      setBusy(false);
      setDisabling(null);
    }
  };

  return (
    <>
      {header}
      {sources.items.length === 0 ? (
        <EmptyState
          title={t("sources.empty", "No sources yet")}
          description={t(
            "sources.emptyDescription",
            "Add a folder, a repository or a push channel, then scan it to register its documents.",
          )}
          action={
            <Can permission={PERMISSIONS.sourceManage}>
              <Button icon="plus" href="/sources/new">
                {t("sources.add", "Add source")}
              </Button>
            </Can>
          }
        />
      ) : (
        <Workbench>
          <section aria-label={t("sources.title", "Sources")}>
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t("sources.column.source", "Source")}</th>
                  <th scope="col">{t("sources.column.location", "Location")}</th>
                  <th scope="col">{t("sources.column.state", "State")}</th>
                  <th scope="col">{t("sources.column.created", "Created")}</th>
                </tr>
              </thead>
              <tbody>
                {sources.items.map((source) => (
                  <tr key={source.id} data-selected={source.id === selected?.id}>
                    <td>
                      <RowName
                        selected={source.id === selected?.id}
                        onSelect={() => {
                          setSelectedId(source.id);
                        }}
                      >
                        {source.name}
                      </RowName>
                      <div className="text-xs text-muted">{SOURCE_KINDS[source.kind].label}</div>
                    </td>
                    <td className="[&_.keep-end]:w-[calc(320px*var(--ui-scale))]">{source.location === null ? "—" : <PathText path={source.location} fit="end" />}</td>
                    <td>
                      <Badge tone={source.enabled ? "allow" : "deny"}>
                        {source.enabled ? t("sources.enabled", "Enabled") : t("sources.disabled", "Disabled")}
                      </Badge>
                    </td>
                    <td className="text-xs text-secondary">{formatDateTime(source.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <ListFooter
              shown={sources.items.length}
              counted={plural("sources.count", sources.items.length, { one: "{count} source", other: "{count} sources" })}
              hasMore={sources.hasMore}
              loadingMore={sources.loadingMore}
              moreProblem={sources.moreProblem}
              onLoadMore={sources.loadMore}
            />
          </section>
          {selected !== null && (
            <Inspector
              label={t("sources.selected", "Selected source")}
              eyebrow={SOURCE_KINDS[selected.kind].label}
              title={selected.name}
            >
              <InspectorSection title={t("sources.connection", "Connection")}>
                <Facts
                  rows={[
                    [
                      t("sources.column.location", "Location"),
                      selected.location === null ? (
                        t("sources.locationPushed", "None — content is pushed")
                      ) : (
                        <PathText path={selected.location} />
                      ),
                    ],
                    [
                      t("sources.column.state", "State"),
                      selected.enabled
                        ? t("sources.stateEnabled", "Enabled — scanned and searchable")
                        : t("sources.stateDisabled", "Disabled — not scanned"),
                    ],
                    [t("sources.column.created", "Created"), formatDateTime(selected.createdAt)],
                    [
                      t("sources.identifier", "Identifier"),
                      <span className="numeric" title={selected.id}>
                        {shortIdentifier(selected.id)}
                      </span>,
                    ],
                    [t("sources.revision", "Revision"), <span className="numeric">{selected.revision}</span>],
                  ]}
                />
              </InspectorSection>
              <InspectorSection title={t("sources.manage", "Manage")}>
                <InspectorActions>
                  <Button variant="primary" icon="arrow" href={`/sources/${selected.id}`}>
                    {t("sources.open", "Open source")}
                  </Button>
                  <Can permission={PERMISSIONS.sourceManage}>
                    <Button
                      onClick={() => {
                        setRenaming(selected);
                      }}
                    >
                      {t("sources.rename", "Rename")}
                    </Button>
                    {selected.enabled ? (
                      <Button
                        variant="danger"
                        disabled={busy}
                        onClick={() => {
                          setDisabling(selected);
                        }}
                      >
                        {t("sources.disable", "Disable")}
                      </Button>
                    ) : (
                      <Button disabled={busy} onClick={() => void setEnabled(selected, true)}>
                        {t("sources.enable", "Enable")}
                      </Button>
                    )}
                  </Can>
                </InspectorActions>
              </InspectorSection>
            </Inspector>
          )}
        </Workbench>
      )}

      <SourceFormDialog
        open={renaming !== null}
        workspaceId={workspaceId}
        source={renaming}
        onClose={() => {
          setRenaming(null);
        }}
        onSaved={(saved) => {
          setRenaming(null);
          replaceSource(saved);
          notify({ tone: "good", title: t("sources.savedToast", "{name} saved", { name: saved.name }) });
        }}
      />
      <ConfirmDialog
        open={disabling !== null}
        title={t("sources.disableSource", "Disable source")}
        confirmLabel={t("sources.disableSource", "Disable source")}
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
            "sources.disableRegisteredConfirmation",
            "{name} stops being scanned. Documents already registered from it stay, and can be enabled again later.",
            { name: <strong>{disabling?.name}</strong> },
          )}
        </p>
      </ConfirmDialog>
    </>
  );
}
