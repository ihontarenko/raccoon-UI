import { useEffect, useState, type FormEvent } from "react";
import { Can } from "../../access/Can";
import { usePermissions } from "../../access/PermissionsProvider";
import { PERMISSIONS } from "../../access/permissions";
import { describeProblem, type Problem } from "../../application/problems";
import { useResource } from "../../application/useResource";
import { api } from "../../lib/api";
import { connectedOptionsOf, connectionsApi, scopePathText } from "../../lib/connections";
import type { SourceView } from "../../lib/contracts";
import type { ScannerRunView } from "../../lib/sourceContracts";
import { Notice, useToaster } from "../../ui/components";
import { Badge, Button } from "../../ui/primitives";
import {
  ConnectedScopes,
  connectedOptionsOfDraft,
  validateConnected,
  type ConnectedDraft,
  type ConnectedErrors,
} from "./ConnectedScopes";
import { ARRIVAL, ARRIVAL_BODY, ARRIVAL_FACTS, ARRIVAL_FORM, ARRIVAL_HEAD, ARRIVAL_INLINE } from "./sourcePageClasses";
import { useTranslation } from "../../translations/TranslationProvider";

/**
 * Where a connected source reads from: the connection, the sections it imports, and what the last scan
 * listed — pages, deletions, and the remote moment it reached. Someone who manages sources may change the
 * sections; the next scan reads them.
 */
export function ConnectedArrival({
  workspaceId,
  source,
  latestScan,
  onChanged,
}: {
  workspaceId: string;
  source: SourceView;
  latestScan: ScannerRunView | null;
  onChanged: () => void;
}) {
  const { t, plural } = useTranslation();
  const { notify } = useToaster();
  const mayManage = usePermissions().may(PERMISSIONS.sourceManage);
  const stored = connectedOptionsOf(source.options);
  const initial: ConnectedDraft = { connectionId: stored?.connectionId ?? "", scopes: stored?.scopes ?? [] };
  const [draft, setDraft] = useState<ConnectedDraft>(initial);
  const [errors, setErrors] = useState<ConnectedErrors>({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  // The connection's name is shown to whoever may choose one; a reader sees the sections only.
  const choices = useResource(
    () => (mayManage ? connectionsApi.choices(workspaceId) : Promise.resolve([])),
    [workspaceId, mayManage],
  );
  useEffect(() => {
    setDraft({ connectionId: stored?.connectionId ?? "", scopes: stored?.scopes ?? [] });
    setErrors({});
    // The stored options change only when the source is saved; their identity follows its revision.
  }, [source.revision]);

  const connection = choices.status === "ready" ? choices.data.find((choice) => choice.id === stored?.connectionId) ?? null : null;
  const detail = latestScan?.snapshotDetail ?? {};
  const listed = typeof detail.listed === "number" ? detail.listed : null;
  const deletions = typeof detail.deletions === "number" ? detail.deletions : 0;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const found = validateConnected(draft);
    setErrors(found);
    if (found.connection !== undefined || found.scopes !== undefined) {
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      await api.changeSourceOptions(workspaceId, source, connectedOptionsOfDraft(draft));
      notify({
        tone: "good",
        title: t("sourceSetup.connected.saved", "Sections saved"),
        description: t("sourceSetup.connected.savedDescription", "The next scan reads them."),
      });
      setEditing(false);
      onChanged();
    } catch (error) {
      setProblem(describeProblem(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={ARRIVAL} aria-label={t("sourceSetup.connected.title", "Knowledge base")}>
      <div className={ARRIVAL_HEAD}>
        <span className="eyebrow">{t("sourceSetup.connected.title", "Knowledge base")}</span>
        <p className="text-xs text-secondary">
          {t(
            "sourceSetup.connected.lead",
            "Every scan lists the chosen sections and those under them, fetches only pages whose version changed, and removes pages deleted there. What the connection's credential may read is imported; Raccoon's workspace access governs it here.",
          )}
        </p>
      </div>
      <div className={ARRIVAL_BODY}>
        <dl className={ARRIVAL_FACTS}>
          {mayManage && (
            <>
              <dt>{t("sourceSetup.connected.readsThrough", "Reads through")}</dt>
              <dd>
                {connection === null ? (
                  <span className="text-muted">
                    {choices.status === "loading" ? "…" : t("sourceSetup.connected.connectionGone", "a connection no longer offered")}
                  </span>
                ) : (
                  <>
                    {connection.name} <span className="text-muted">· {connection.connectorName}</span>
                    {connection.health !== null && connection.health !== "HEALTHY" && (
                      <>
                        {" "}
                        <Badge tone="deny">
                          {connection.health === "UNAUTHORISED"
                            ? t("sourceSetup.connected.health.unauthorised", "Credential refused")
                            : t("sourceSetup.connected.notAnswering", "Not answering")}
                        </Badge>
                      </>
                    )}
                  </>
                )}
              </dd>
            </>
          )}
          <dt>{t("sourceSetup.connected.sections", "Sections")}</dt>
          <dd>
            {stored === null || stored.scopes.length === 0 ? (
              <span className="text-muted">{t("sourceSetup.connected.none", "none")}</span>
            ) : (
              stored.scopes.map((scope) => (
                <div key={scope.id}>{scope.path.length > 0 ? scopePathText(scope.path) : <span className="numeric">{scope.id}</span>}</div>
              ))
            )}
          </dd>
          <dt>{t("sourceSetup.connected.lastListed", "Last listed")}</dt>
          <dd>
            {latestScan === null || listed === null ? (
              <span className="text-muted">{t("sourceSetup.arrival.notScannedYet", "not scanned yet")}</span>
            ) : (
              <span className={ARRIVAL_INLINE}>
                <span className="numeric">
                  {plural("sourceSetup.arrival.pages.fetched", listed, { one: "{count} page", other: "{count} pages" })}
                </span>
                {deletions > 0 && (
                  <Badge tone="deny">
                    {plural("sourceSetup.connected.deletions", deletions, { one: "{count} deletion", other: "{count} deletions" })}
                  </Badge>
                )}
                {latestScan.snapshotRevision !== null && (
                  <span className="text-xs text-muted">
                    {t("sourceSetup.connected.changesUpTo", "changes up to {moment}", {
                      moment: latestScan.snapshotRevision.replace("T", " "),
                    })}
                  </span>
                )}
              </span>
            )}
          </dd>
        </dl>
        {typeof detail.failureReason === "string" && (
          <Notice tone="error" title={t("sourceSetup.connected.listingRefused", "The last listing was refused")}>
            {detail.failureReason}
          </Notice>
        )}
        <Can permission={PERMISSIONS.sourceManage}>
          {editing ? (
            <form className={ARRIVAL_FORM} noValidate onSubmit={(event) => void save(event)}>
              {problem !== null && (
                <Notice tone="error" title={problem.title}>
                  {problem.detail ?? problem.description}
                </Notice>
              )}
              <ConnectedScopes
                workspaceId={workspaceId}
                draft={draft}
                errors={errors}
                onChange={(next) => {
                  setDraft(next);
                  setErrors({});
                }}
              />
              <div className={ARRIVAL_INLINE}>
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? t("common.saving", "Saving…") : t("sourceSetup.connected.save", "Save sections")}
                </Button>
                <Button
                  variant="quiet"
                  disabled={saving}
                  onClick={() => {
                    setEditing(false);
                    setDraft(initial);
                    setProblem(null);
                  }}
                >
                  {t("common.cancel", "Cancel")}
                </Button>
              </div>
            </form>
          ) : (
            <div>
              <Button icon="edit" onClick={() => setEditing(true)}>
                {t("sourceSetup.connected.change", "Change sections")}
              </Button>
            </div>
          )}
        </Can>
      </div>
    </section>
  );
}
