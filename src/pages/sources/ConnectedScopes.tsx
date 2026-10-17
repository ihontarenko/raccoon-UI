import { Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { Can } from "../../access/Can";
import { PERMISSIONS } from "../../access/permissions";
import { formatNumber } from "../../application/format";
import { useResource } from "../../application/useResource";
import { connectionsApi, scopePathText, type ChosenScope, type ConnectionChoice, type RemoteScope } from "../../lib/connections";
import { Notice, Waiting } from "../../ui/components";
import { Badge, Button, Checkbox, Field, Select } from "../../ui/primitives";
import { useTranslation } from "../../translations/TranslationProvider";
import { declareText, translate, type DeclaredText } from "../../translations/translate";

/* One line per section, indented by its depth, in a bounded well so a large tree scrolls inside the
   step rather than making the step itself scroll. On a phone the bound is dropped: a nested scroll
   inside a page that already scrolls is a trap. */
const SCOPE_LIST = [
  "m-0 grid max-h-[calc(320px*var(--ui-scale))] list-none gap-1 overflow-y-auto px-3 py-2",
  "rounded-control border border-line bg-well [&>li]:min-w-0",
  "max-[720px]:max-h-none",
].join(" ");


export interface ConnectedDraft {
  connectionId: string;
  scopes: ChosenScope[];
}

export interface ConnectedErrors {
  connection?: string;
  scopes?: string;
}

export const NEW_CONNECTED: ConnectedDraft = { connectionId: "", scopes: [] };

/** What the form is missing before a connected source can be saved; empty when nothing is. */
export function validateConnected(draft: ConnectedDraft): ConnectedErrors {
  const errors: ConnectedErrors = {};
  if (draft.connectionId === "") {
    errors.connection = translate("sourceSetup.connected.error.connection", "Choose the connection to read through.");
  } else if (draft.scopes.length === 0) {
    errors.scopes = translate("sourceSetup.connected.error.scopes", "Choose at least one section to import.");
  }
  return errors;
}

/** A connected source's options as the server takes them. */
export function connectedOptionsOfDraft(draft: ConnectedDraft): Record<string, unknown> {
  return { connectionId: draft.connectionId, scopes: draft.scopes.map((scope) => ({ id: scope.id, path: scope.path })) };
}

const HEALTH_LABEL: Record<NonNullable<ConnectionChoice["health"]>, DeclaredText> = {
  HEALTHY: declareText("sourceSetup.connected.health.healthy", "Works"),
  UNAUTHORISED: declareText("sourceSetup.connected.health.unauthorised", "Credential refused"),
  UNREACHABLE: declareText("sourceSetup.connected.health.unreachable", "Unreachable"),
  NO_CREDENTIAL: declareText("sourceSetup.connected.health.noCredential", "No credential"),
};

/**
 * Which connection a connected source reads through and which of its scopes it imports. The scopes are what
 * the connection's credential may read now, as the knowledge base answers; a scope chosen earlier that it no
 * longer offers stays listed, marked, so it can be taken out rather than silently dropped.
 */
export function ConnectedScopes({
  workspaceId,
  draft,
  errors,
  onChange,
  connectionType,
}: {
  workspaceId: string;
  draft: ConnectedDraft;
  errors: ConnectedErrors;
  onChange: (next: ConnectedDraft) => void;
  /** Only connections of this knowledge-base type, when the form already chose one. */
  connectionType?: string;
}) {
  const { t, say } = useTranslation();
  const choices = useResource(() => connectionsApi.choices(workspaceId), [workspaceId]);

  if (choices.status === "loading") {
    return <Waiting label={t("sourceSetup.connected.loading", "Loading connections")} lines={2} />;
  }
  if (choices.status === "failed") {
    return (
      <Notice
        tone="error"
        title={choices.problem.title}
        action={
          <Button icon="refresh" onClick={choices.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      >
        {choices.problem.detail ?? choices.problem.description}
      </Notice>
    );
  }
  // Only knowledge-base connections — of the chosen type, when there is one — carry sections to import.
  const offeredChoices = choices.data.filter(
    (choice) => choice.kind === "CONNECTED" && (connectionType === undefined || choice.type === connectionType),
  );
  if (offeredChoices.length === 0) {
    return (
      <Notice tone="warn" title={t("sourceSetup.connected.noConnection.title", "No connection to a knowledge base yet")}>
        {t(
          "sourceSetup.connected.noConnection.description",
          "An installation administrator adds one once — its address and the credential that decides what may be read — and every workspace can then import through it.",
        )}{" "}
        <Can permission={PERMISSIONS.systemRead}>
          <Link to="/administration/$section" params={{ section: "connections" }}>
            {t("sourceSetup.connected.noConnection.open", "Open Connections")}
          </Link>
        </Can>
      </Notice>
    );
  }
  const chosen = offeredChoices.find((choice) => choice.id === draft.connectionId) ?? null;

  return (
    <div className="grid min-w-0 gap-3">
      <Field
        label={t("sourceSetup.connected.connection", "Connection")}
        required
        error={errors.connection}
        hint={
          chosen === null
            ? t("sourceSetup.connected.connectionHint", "Configured once by an administrator, shared by every source that reads through it.")
            : t("sourceSetup.connected.connectorHint", "A {connector} connection.", { connector: chosen.connectorName })
        }
      >
        <Select
          value={draft.connectionId}
          fullWidth
          onChange={(event) => {
            onChange({ connectionId: event.target.value, scopes: [] });
          }}
        >
          <option value="">{t("sourceSetup.connected.choose", "Choose a connection…")}</option>
          {offeredChoices.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.name} · {choice.connectorName}
              {choice.health !== null && choice.health !== "HEALTHY" ? ` (${say(HEALTH_LABEL[choice.health])})` : ""}
            </option>
          ))}
        </Select>
      </Field>
      {chosen !== null && (
        <ScopeChoice workspaceId={workspaceId} connection={chosen} draft={draft} error={errors.scopes} onChange={onChange} />
      )}
      <Notice tone="error" title={t("sourceSetup.connected.importWarning.title", "Whatever the credential can read is imported")}>
        {t(
          "sourceSetup.connected.importWarning.description",
          "Every page this connection's credential may read in the chosen {noun}s and those under them is imported and kept. From then on Raccoon's own workspace access decides who reads it here — not the knowledge base's per-page access.",
          { noun: chosen?.scopeNoun ?? "section" },
        )}
      </Notice>
    </div>
  );
}

function ScopeChoice({
  workspaceId,
  connection,
  draft,
  error,
  onChange,
}: {
  workspaceId: string;
  connection: ConnectionChoice;
  draft: ConnectedDraft;
  error: string | undefined;
  onChange: (next: ConnectedDraft) => void;
}) {
  const { t } = useTranslation();
  const scopes = useResource(() => connectionsApi.scopes(workspaceId, connection.id), [workspaceId, connection.id]);
  const noun = connection.scopeNoun;
  const connector = connection.connectorName;

  if (scopes.status === "loading") {
    return <Waiting label={t("sourceSetup.connected.asking", "Asking {connector} for its {noun}s", { connector, noun })} lines={3} />;
  }
  if (scopes.status === "failed") {
    return (
      <Notice
        tone="error"
        title={t("sourceSetup.connected.notListed", "{connector} did not list its {noun}s", { connector, noun })}
        action={
          <Button icon="refresh" onClick={scopes.reload}>
            {t("sourceSetup.connected.askAgain", "Ask again")}
          </Button>
        }
      >
        {scopes.problem.detail ?? scopes.problem.description}
      </Notice>
    );
  }
  const offered: RemoteScope[] = scopes.data;
  const offeredIds = new Set(offered.map((scope) => scope.id));
  const vanished = draft.scopes.filter((scope) => !offeredIds.has(scope.id));
  const isChosen = (identifier: string) => draft.scopes.some((scope) => scope.id === identifier);
  const toggle = (scope: ChosenScope, checked: boolean) => {
    const others = draft.scopes.filter((candidate) => candidate.id !== scope.id);
    onChange({ ...draft, scopes: checked ? [...others, scope] : others });
  };
  const errorId = "connected-scopes-error";

  return (
    <fieldset className="m-0 grid min-w-0 gap-2 border-0 p-0" aria-describedby={error === undefined ? undefined : errorId}>
      <legend className="mb-1 p-0 text-xs font-semibold">
        {t("sourceSetup.connected.toImport", "{noun}s to import", { noun: noun.charAt(0).toUpperCase() + noun.slice(1) })}{" "}
        <span className="text-xs text-secondary">{t("sourceSetup.connected.eachWithChildren", "— each with every {noun} under it", { noun })}</span>
      </legend>
      {offered.length === 0 ? (
        <p className="text-xs text-secondary">
          {t("sourceSetup.connected.nothingReadable", "The credential may read no {noun} yet. Grant it one in {connector}, then ask again.", {
            noun,
            connector,
          })}
        </p>
      ) : (
        <ul className={SCOPE_LIST}>
          {offered.map((scope) => (
            <li key={scope.id} className="ps-[calc(var(--depth,0)*var(--space-4))]" style={{ "--depth": Math.max(0, scope.path.length - 1) } as CSSProperties}>
              <Checkbox
                label={
                  <span className="inline-flex min-w-0 flex-wrap items-baseline gap-2 [overflow-wrap:anywhere]">
                    <span>{scope.name}</span>
                    {scope.pageCount !== null && scope.pageCount > 0 && (
                      <span className="text-xs text-muted numeric">
                        {t("sourceSetup.connected.pagesHere", "{count} here", { count: formatNumber(scope.pageCount) })}
                      </span>
                    )}
                  </span>
                }
                hint={scope.path.length > 1 ? scopePathText(scope.path) : undefined}
                checked={isChosen(scope.id)}
                onChange={(event) => toggle({ id: scope.id, path: scope.path }, event.target.checked)}
              />
            </li>
          ))}
        </ul>
      )}
      {vanished.length > 0 && (
        <ul className={SCOPE_LIST}>
          {vanished.map((scope) => (
            <li key={scope.id}>
              <Checkbox
                label={
                  <span className="inline-flex min-w-0 flex-wrap items-baseline gap-2 [overflow-wrap:anywhere]">
                    <span>{scope.path.length > 0 ? scopePathText(scope.path) : scope.id}</span>
                    <Badge tone="deny">{t("sourceSetup.connected.noLongerOffered", "No longer offered")}</Badge>
                  </span>
                }
                hint={t(
                  "sourceSetup.connected.vanishedHint",
                  "The credential cannot read this {noun} any more; a scan stops until it is taken out or the grant is back.",
                  { noun },
                )}
                checked
                onChange={(event) => toggle(scope, event.target.checked)}
              />
            </li>
          ))}
        </ul>
      )}
      {error !== undefined && (
        <p id={errorId} className="m-0 text-xs text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
