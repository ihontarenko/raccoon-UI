import { useState, type ReactNode } from "react";
import { Can } from "../../../access/Can";
import { usePermissions } from "../../../access/PermissionsProvider";
import { PERMISSIONS } from "../../../access/permissions";
import { formatDateTime, labelOfCode, type CodeLabels } from "../../../application/format";
import { describeProblem } from "../../../application/problems";
import { useResource } from "../../../application/useResource";
import { collectAllPages } from "../../../lib/api";
import {
  connectionsApi,
  isHealthy,
  opensWholeComputer,
  type ConnectionTypeDescriptor,
  type ConnectionView,
} from "../../../lib/connections";
import { declareText } from "../../../translations/translate";
import { useTranslation } from "../../../translations/TranslationProvider";
import { ConfirmDialog, EmptyState, PathText, ProblemState, Waiting, useToaster } from "../../../ui/components";
import { Badge, Button, Table } from "../../../ui/primitives";
import { ConnectionDialog } from "./ConnectionDialog";
import { orderedTypes, typeDescription, typeName } from "./connectionTypes";
import { CATALOGUE, DESCRIPTION_CELL, PANEL, SECTION_TITLE, TABLE_SURFACE } from "../ai/aiClasses";

type Editing = { open: false } | { open: true; connection: ConnectionView | null; startingType?: string };

/* A toolbar, not a panel: two totals as a sentence on the left, the one action on the right. */
const TOOLBAR = "flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4";

const TOTALS = "m-0 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-secondary [&_strong]:font-[650] [&_strong]:text-ink";

/* Health on one line — the verdict and when it was found — and the sentence the check gave under it. */
const HEALTH_LINE = "flex flex-wrap items-center gap-2";

/* The types that can be connected: one row each, the name, what it reads, its credential, and an Add. */
const TYPES = "m-0 grid list-none rounded-surface border border-line bg-surface p-0";

const TYPE_ROW = [
  "grid grid-cols-[calc(150px*var(--ui-scale))_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3",
  "not-first:border-t not-first:border-line",
  "max-[700px]:grid-cols-[minmax(0,1fr)_auto] max-[700px]:[&>p]:col-span-full max-[700px]:[&>p]:row-start-2",
].join(" ");

const TYPE_NAME = "grid justify-items-start gap-1 [&>strong]:text-sm";

/** What the last check of a connection found, from the server's `ConnectionHealthState`. */
const CONNECTION_HEALTH: CodeLabels = {
  HEALTHY: declareText("connections.health.healthy", "Works"),
  UNAUTHORISED: declareText("connections.health.unauthorised", "Credential refused"),
  UNREACHABLE: declareText("connections.health.unreachable", "Not answering"),
  NO_CREDENTIAL: declareText("connections.health.noCredential", "No credential"),
};

interface Catalogue {
  types: ConnectionTypeDescriptor[];
  connections: ConnectionView[];
}

function listOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/**
 * Connections of every source type, grouped by type: this computer and its folders, git hostings, web hosts, the push
 * address, knowledge bases. Each is configured once — what it offers, and the credential where the type takes one —
 * and any number of sources in any workspace pick inside it. A connection that works is marked blue, a broken one
 * red, with the sentence its last check gave.
 */
export function ConnectionsPanel() {
  const { notify } = useToaster();
  const { t, plural } = useTranslation();
  const mayWrite = usePermissions().may(PERMISSIONS.systemWrite);
  // Read whole: an administrator configures a handful, and the status line above the groups totals them all.
  const catalogue = useResource<Catalogue>(async () => {
    const [types, connections] = await Promise.all([connectionsApi.types(), collectAllPages((page) => connectionsApi.list(page))]);
    return { types, connections };
  }, []);
  const [editing, setEditing] = useState<Editing>({ open: false });
  const [removing, setRemoving] = useState<ConnectionView | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (catalogue.status === "loading") {
    return <Waiting label={t("connections.loading", "Loading connections")} lines={4} />;
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
  const { types, connections } = catalogue.data;

  const act = async (connection: ConnectionView, action: () => Promise<unknown>, done: string) => {
    setBusyId(connection.id);
    try {
      await action();
      notify({ tone: "good", title: done });
      catalogue.reload();
    } catch (error) {
      const problem = describeProblem(error);
      notify({ tone: "error", title: problem.title, description: problem.detail ?? problem.description });
    } finally {
      setBusyId(null);
    }
  };

  /** What a connection offers, in one or two short lines under its name. */
  const describeBoundary = (connection: ConnectionView): ReactNode => {
    const boundary = connection.boundary;
    switch (connection.kind) {
      case "LOCAL_FOLDER": {
        const roots = Array.isArray(boundary.roots) ? (boundary.roots as Record<string, unknown>[]) : [];
        return (
          <>
            {opensWholeComputer(boundary) && (
              <div>
                <Badge tone="error">{t("connections.wholeComputer", "Whole computer")}</Badge>
              </div>
            )}
            {roots
              .map((root) => root.path)
              .filter((path): path is string => typeof path === "string")
              .map((path) => (
                <div key={path} className="text-xs text-muted">
                  <PathText path={path} />
                </div>
              ))}
          </>
        );
      }
      case "GIT": {
        const hosting = boundary.hosting === "GITHUB" ? "GitHub" : boundary.hosting === "GITLAB" ? "GitLab" : t("connections.dialog.hostingOther", "Another https host");
        const owners = listOf(boundary.allowedOwners);
        return (
          <div className="text-xs text-muted">
            {hosting}
            {typeof boundary.baseAddress === "string" && <> · <PathText path={boundary.baseAddress} /></>}
            {" · "}
            {owners.length === 0 ? t("connections.anyOwner", "any owner") : owners.join(", ")}
          </div>
        );
      }
      case "WEB":
        return (
          <>
            <div className="text-xs text-muted">{listOf(boundary.allowedHosts).join(", ")}</div>
            <div className="text-xs text-muted numeric">
              {t("connections.webLimits", "{pause} ms between requests · at most {depth} links deep · {pages} pages a scan", {
                pause: String(boundary.pauseMilliseconds ?? ""),
                depth: String(boundary.maximumLinkDepth ?? ""),
                pages: String(boundary.maximumPages ?? ""),
              })}
            </div>
          </>
        );
      case "PUSH":
        return <div className="text-xs text-muted">{t("connections.pushLight", "Nothing to configure: the installation's own push address.")}</div>;
      default:
        return (
          <div className="text-xs text-muted">
            <PathText path={connection.address ?? ""} />
          </div>
        );
    }
  };

  const readingSources = connections.reduce((total, connection) => total + connection.sourceCount, 0);
  const groups = orderedTypes(types)
    .map((descriptor) => ({ descriptor, members: connections.filter((connection) => connection.type === descriptor.type) }))
    .filter((group) => group.members.length > 0);

  return (
    <div className={PANEL}>
      <div className={TOOLBAR}>
        <p className={TOTALS}>
          <span>
            {t("connections.totalsConnections", "{count} configured", {
              count: <strong className="numeric">{connections.length}</strong>,
            })}
          </span>
          <span>
            {t("connections.totalsSources", "{count} read by sources", {
              count: <strong className="numeric">{readingSources}</strong>,
            })}
          </span>
        </p>
        <Can permission={PERMISSIONS.systemWrite}>
          <Button
            variant="primary"
            icon="plus"
            disabled={types.length === 0}
            onClick={() => {
              setEditing({ open: true, connection: null });
            }}
          >
            {t("connections.dialog.addTitle", "Add connection")}
          </Button>
        </Can>
      </div>

      {connections.length === 0 && (
        <EmptyState
          title={t("connections.empty", "No connection yet")}
          description={t(
            "connections.emptyDescriptionEveryType",
            "Every source reads through a connection: this computer's allowed folders, a git hosting, web hosts, the push address or a knowledge base. Add one; workspaces then pick inside it for their sources.",
          )}
        />
      )}

      {groups.map(({ descriptor, members }) => {
        const headingId = `connections-${descriptor.type}`;
        return (
          <section key={descriptor.type} aria-labelledby={headingId}>
            <h2 id={headingId} className={SECTION_TITLE}>
              {typeName(descriptor.type, types)}
            </h2>
            <div className={TABLE_SURFACE}>
              <Table>
                <thead>
                  <tr>
                    <th scope="col">{t("connections.column.connection", "Connection")}</th>
                    <th scope="col">{t("connections.dialog.credential", "Credential")}</th>
                    <th scope="col">{t("connections.column.health", "Health")}</th>
                    <th scope="col" className="text-right">{t("connections.column.sources", "Sources")}</th>
                    <th scope="col">
                      <span className="sr-only">{t("common.actions", "Actions")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((connection) => {
                    const busy = busyId === connection.id;
                    const health = connection.health;
                    return (
                      <tr key={connection.id}>
                        <td className="wraps">
                          <strong>{connection.name}</strong>
                          {!connection.enabled && (
                            <>
                              {" "}
                              <Badge tone="neutral">{t("connections.switchedOff", "Switched off")}</Badge>
                            </>
                          )}
                          {describeBoundary(connection)}
                        </td>
                        <td>
                          {!descriptor.takesCredential ? (
                            <span className="text-xs text-muted">{t("connections.credentialNotTaken", "Not used")}</span>
                          ) : connection.credentialSet ? (
                            <Badge tone="good">{t("connections.credentialStored", "Stored")}</Badge>
                          ) : descriptor.credentialRequired ? (
                            <Badge tone="deny">{t("connections.credentialMissing", "Missing")}</Badge>
                          ) : (
                            <span className="text-xs text-muted">{t("connections.credentialNone", "None — anonymous")}</span>
                          )}
                          {connection.credentialChangedAt !== null && (
                            <div className="text-xs text-muted">{formatDateTime(connection.credentialChangedAt)}</div>
                          )}
                        </td>
                        <td className={`wraps ${DESCRIPTION_CELL}`}>
                          {health === null ? (
                            <Badge tone="neutral">{t("connections.health.notChecked", "Not checked")}</Badge>
                          ) : (
                            <>
                              <span className={HEALTH_LINE}>
                                <Badge tone={isHealthy(health.state) ? "active" : "error"}>{labelOfCode(CONNECTION_HEALTH, health.state)}</Badge>
                                <span className="text-xs text-muted">{formatDateTime(health.checkedAt)}</span>
                              </span>
                              <div className="text-xs text-secondary">{health.sentence}</div>
                            </>
                          )}
                        </td>
                        <td className="numeric text-right">{connection.sourceCount}</td>
                        <td className="actions">
                          {mayWrite && (
                            <>
                              <Button
                                variant="quiet"
                                icon="refresh"
                                disabled={busy}
                                onClick={() =>
                                  void act(
                                    connection,
                                    () => connectionsApi.check(connection.id),
                                    t("connections.checkedNotice", "{name} checked", { name: connection.name }),
                                  )
                                }
                              >
                                {t("connections.check", "Check")}
                              </Button>
                              <Button
                                variant="quiet"
                                iconOnly
                                icon="edit"
                                aria-label={t("connections.editNamed", "Edit {name}", { name: connection.name })}
                                title={t("connections.edit", "Edit")}
                                disabled={busy}
                                onClick={() => setEditing({ open: true, connection })}
                              />
                              <Button
                                variant="quiet"
                                iconOnly
                                icon="trash"
                                aria-label={t("connections.removeNamed", "Remove {name}", { name: connection.name })}
                                title={t("connections.remove", "Remove")}
                                disabled={busy}
                                onClick={() => setRemoving(connection)}
                              />
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          </section>
        );
      })}

      <section className={CATALOGUE} aria-labelledby="connection-types">
        <h2 id="connection-types" className={SECTION_TITLE}>
          {t("connections.installed", "What can be connected")}
        </h2>
        <ul className={TYPES}>
          {orderedTypes(types).map((descriptor) => {
            const count = connections.filter((connection) => connection.type === descriptor.type).length;
            return (
              <li key={descriptor.type} className={TYPE_ROW}>
                <span className={TYPE_NAME}>
                  <strong>{typeName(descriptor.type, types)}</strong>
                  {descriptor.takesCredential && descriptor.credentialLabel !== null && (
                    <Badge tone="neutral">{descriptor.credentialLabel}</Badge>
                  )}
                </span>
                <p className="m-0 text-xs leading-[1.5] text-secondary">
                  {typeDescription(descriptor)}
                  {count > 0 && (
                    <span className="text-muted">
                      {" · "}
                      {plural("connections.typeConfigured", count, { one: "{count} configured", other: "{count} configured" })}
                    </span>
                  )}
                </p>
                <Can permission={PERMISSIONS.systemWrite}>
                  <Button
                    variant="quiet"
                    icon="plus"
                    aria-label={t("connections.addOfType", "Add a {type} connection", { type: typeName(descriptor.type, types) })}
                    onClick={() => setEditing({ open: true, connection: null, startingType: descriptor.type })}
                  >
                    {t("connections.add", "Add")}
                  </Button>
                </Can>
              </li>
            );
          })}
        </ul>
      </section>

      <ConnectionDialog
        open={editing.open}
        connection={editing.open ? editing.connection : null}
        startingType={editing.open ? editing.startingType : undefined}
        types={types}
        onClose={() => setEditing({ open: false })}
        onSaved={(saved, created) => {
          setEditing({ open: false });
          const state = saved.health?.state;
          notify({
            tone: state === undefined || state === "HEALTHY" ? "good" : "error",
            title: created
              ? t("connections.addedNotice", "{name} added", { name: saved.name })
              : t("connections.savedNotice", "{name} saved", { name: saved.name }),
            description: saved.health?.sentence,
          });
          catalogue.reload();
        }}
      />
      <ConfirmDialog
        open={removing !== null}
        title={t("connections.removeTitle", "Remove connection")}
        confirmLabel={t("connections.remove", "Remove")}
        destructive
        onConfirm={() => {
          if (removing !== null) {
            const target = removing;
            setRemoving(null);
            void act(target, () => connectionsApi.remove(target), t("connections.removedNotice", "{name} removed", { name: target.name }));
          }
        }}
        onCancel={() => setRemoving(null)}
      >
        <p>
          {removing !== null && removing.sourceCount > 0
            ? plural(
                "connections.removeRefused",
                removing.sourceCount,
                {
                  one: "{count} source still reads through {name}, so it will be refused; remove that source first.",
                  other: "{count} sources still read through {name}, so it will be refused; remove those sources first.",
                },
                { name: removing.name },
              )
            : t(
                "connections.removeExplained",
                "{name} and its stored credential are removed. No source reads through it, and documents already imported stay.",
                { name: <strong>{removing?.name}</strong> },
              )}
        </p>
      </ConfirmDialog>
    </div>
  );
}
