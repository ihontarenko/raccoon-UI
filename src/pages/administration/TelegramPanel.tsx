import { useState, type ReactNode } from "react";
import { describeProblem } from "../../application/problems";
import { useResource } from "../../application/useResource";
import { api } from "../../lib/api";
import type { TelegramInvitation } from "../../lib/contracts";
import { useTranslation } from "../../translations/TranslationProvider";
import { EmptyState, ProblemState, Waiting } from "../../ui/components";
import { Badge, Button, Checkbox, Icon, Table, type IconName } from "../../ui/primitives";

/* Telegram — the overview's panel language: a framed surface, a head with its title and its action,
   label/value rows, then content with the same inner padding. */
const PANEL_HEAD = [
  "flex items-center justify-between gap-3 border-b border-line px-4 py-3",
  "[&_h2]:m-0 [&_h2]:flex [&_h2]:items-center [&_h2]:gap-2 [&_h2]:text-sm",
  "max-[720px]:flex-wrap",
].join(" ");

const PANEL_ROW = [
  "grid grid-cols-[calc(150px*var(--ui-scale))_minmax(0,1fr)] items-baseline gap-3 border-b border-line",
  "px-4 py-2 last:border-b-0",
  "[&>dt]:text-xs [&>dt]:text-muted",
  "[&>dd]:m-0 [&>dd]:min-w-0 [&>dd]:[font-variant-numeric:tabular-nums]",
  "max-[720px]:grid-cols-[minmax(0,1fr)] max-[720px]:gap-[calc(2px*var(--ui-scale))]",
].join(" ");

/* The numbered steps for setting the bot up: indented twice, so the numbers hang clear of the text. */
const SETUP_STEPS = [
  "m-0 grid gap-3 border-t border-line [&>li]:pl-1",
  "[padding:var(--space-3)_var(--space-4)_var(--space-4)_calc(var(--space-4)+var(--space-4))]",
].join(" ");

const QUIET_NOTE = "mt-[calc(2px*var(--ui-scale))] block text-xs text-muted";

/* Telegram: connecting your account to @jmouse_raccoon_bot, and what Telegram said.

   Two panels in the overview's language. The connection reads as label/value rows with its one action in
   the head; while connecting, the two links are numbered steps inside the same panel — both are needed:
   Raccoon's own bot completes the connection (its link carries a one-time code), and the shared
   notification bot must be started once, because a bot cannot write to somebody who never started it.
   The tokens are not here and never will be. */

export function TelegramPanel() {
  return (
    <div className="grid max-w-[calc(1100px*var(--ui-scale))] gap-4">
      <ConnectionPanel />
      <JournalPanel />
    </div>
  );
}

function ConnectionPanel() {
  const { t } = useTranslation();
  const connection = useResource(() => api.telegramConnection(), []);
  const [invitation, setInvitation] = useState<TelegramInvitation | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setFailure(null);
    try {
      await action();
    } catch (problem) {
      const described = describeProblem(problem);
      setFailure(described.detail ?? described.title);
    } finally {
      setBusy(false);
    }
  }

  const title = t("telegram.connection.title", "Your connection");

  if (connection.status === "loading") {
    return (
      <Panel title={title} icon="link">
        <div className="px-4 py-3">
          <Waiting label={t("telegram.connection.loading", "Reading the connection")} lines={3} />
        </div>
      </Panel>
    );
  }

  if (connection.status === "failed") {
    return (
      <Panel title={title} icon="link">
        <div className="px-4 py-3">
          <ProblemState
            layout="section"
            problem={connection.problem}
            actions={
              <Button icon="refresh" onClick={connection.reload}>
                {t("common.tryAgain", "Try again")}
              </Button>
            }
          />
        </div>
      </Panel>
    );
  }

  const state = connection.data;

  if (!state.configured) {
    return (
      <Panel title={title} icon="link">
        <div className="px-4 py-3">
          <EmptyState
            title={t("telegram.connection.notConfiguredTitle", "Telegram is not set up")}
            description={t(
              "telegram.connection.notConfigured",
              "This server has no bot tokens. Set telegram/raccoon-commands/token and telegram/notifications/token on the Vault screen.",
            )}
          />
        </div>
      </Panel>
    );
  }

  const action = state.connected ? (
    <Button
      variant="quiet"
      disabled={busy}
      onClick={() =>
        run(async () => {
          connection.replace(await api.disconnectTelegram());
          setInvitation(null);
        })
      }
    >
      {t("telegram.connection.disconnect", "Disconnect")}
    </Button>
  ) : (
    <Button
      variant="primary"
      icon="link"
      disabled={busy || invitation !== null}
      onClick={() => run(async () => setInvitation(await api.inviteTelegram()))}
    >
      {t("telegram.connection.connect", "Connect")}
    </Button>
  );

  return (
    <Panel title={title} icon="link" actions={action}>
      <dl className="m-0">
        <Row label={t("telegram.connection.status", "Status")}>
          {state.connected ? (
            <Badge tone="good">{t("telegram.connection.connected", "Connected")}</Badge>
          ) : (
            <Badge tone="neutral">{t("telegram.connection.notConnected", "Not connected")}</Badge>
          )}
        </Row>
        <Row label={t("telegram.connection.commandsBot", "Commands")}>
          <span className="[font-variant-numeric:tabular-nums] whitespace-nowrap">{state.commandsBot ?? "—"}</span>
          <span className={QUIET_NOTE}>
            {t("telegram.connection.commandsHint", "Search, documents and profiles from your phone, as you.")}
          </span>
        </Row>
        <Row label={t("telegram.connection.noticesBot", "Notices from")}>
          <span className="[font-variant-numeric:tabular-nums] whitespace-nowrap">{state.notificationsBot ?? "—"}</span>
          <span className={QUIET_NOTE}>
            {t("telegram.connection.noticesHint", "Jobs that failed for good — the same notices the toaster shows.")}
          </span>
        </Row>
      </dl>

      {!state.connected && invitation !== null && (
        <ol className={SETUP_STEPS}>
          <li>
            <a href={invitation.link} target="_blank" rel="noreferrer">
              {t("telegram.connection.openCommands", "Open {bot} and press Start", { bot: state.commandsBot ?? "" })}
            </a>
            <span className={QUIET_NOTE}>
              {t("telegram.connection.once", "The link works once, for a day. Open it on the phone you want connected.")}
            </span>
          </li>
          {invitation.notificationsLink !== null && (
            <li>
              <a href={invitation.notificationsLink} target="_blank" rel="noreferrer">
                {t("telegram.connection.openNotifications", "Then open {bot} and press Start once", {
                  bot: state.notificationsBot ?? "",
                })}
              </a>
              <span className={QUIET_NOTE}>
                {t("telegram.connection.why", "Notices come from this one, and a bot cannot write to somebody who never started it.")}
              </span>
            </li>
          )}
          <li>
            <Button variant="quiet" icon="refresh" onClick={connection.reload}>
              {t("telegram.connection.check", "Done — check again")}
            </Button>
          </li>
        </ol>
      )}

      {failure !== null && (
        <p role="alert" className="m-0 [padding:0_var(--space-4)_var(--space-3)] text-xs text-danger">
          {failure}
        </p>
      )}
    </Panel>
  );
}

function JournalPanel() {
  const { t } = useTranslation();
  const [refusalsOnly, setRefusalsOnly] = useState(false);
  const journal = useResource(() => api.telegramJournal(refusalsOnly), [refusalsOnly]);

  const toggle = (
    <Checkbox
      label={t("telegram.journal.refusalsOnly", "Only refusals")}
      checked={refusalsOnly}
      onChange={(event) => setRefusalsOnly(event.target.checked)}
    />
  );

  return (
    <Panel title={t("telegram.journal.title", "What Telegram said")} icon="jobs" actions={toggle}>
      {journal.status === "loading" ? (
        <div className="px-4 py-3">
          <Waiting label={t("telegram.journal.loading", "Reading the journal")} lines={4} />
        </div>
      ) : journal.status === "failed" ? (
        <div className="px-4 py-3">
          <ProblemState layout="section" problem={journal.problem} />
        </div>
      ) : journal.data.items.length === 0 ? (
        <div className="px-4 py-3">
          <EmptyState
            title={refusalsOnly ? t("telegram.journal.noRefusals", "Nothing was refused") : t("telegram.journal.empty", "Nothing yet")}
            description={t("telegram.journal.emptyHint", "Every message a bot sends, or fails to, appears here.")}
          />
        </div>
      ) : (
        <Table>
          <thead>
            <tr>
              <th scope="col">{t("telegram.journal.when", "When")}</th>
              <th scope="col">{t("telegram.journal.bot", "Bot")}</th>
              <th scope="col">{t("telegram.journal.chat", "Chat")}</th>
              <th scope="col">{t("telegram.journal.outcome", "Outcome")}</th>
            </tr>
          </thead>
          <tbody>
            {journal.data.items.map((entry, index) => (
              <tr key={`${entry.at}:${index}`}>
                <td className="[font-variant-numeric:tabular-nums] whitespace-nowrap">{new Date(entry.at).toLocaleString()}</td>
                <td>{entry.identityName ?? "—"}</td>
                <td className="[font-variant-numeric:tabular-nums] whitespace-nowrap">{entry.chat ?? "—"}</td>
                <td>
                  {entry.outcome === "DELIVERED" ? (
                    <Badge tone="good">{t("telegram.journal.delivered", "Delivered")}</Badge>
                  ) : (
                    <>
                      <Badge tone="error">{entry.refusal ?? t("telegram.journal.refused", "Refused")}</Badge>
                      {entry.detail !== null && <span className={QUIET_NOTE}>{entry.detail}</span>}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Panel>
  );
}

function Panel({
  title,
  icon,
  actions,
  children,
}: {
  title: string;
  icon: IconName;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-surface border border-line bg-surface" aria-label={title}>
      <header className={PANEL_HEAD}>
        <h2>
          <Icon name={icon} size="small" />
          {title}
        </h2>
        {actions !== undefined && <div className="flex items-center gap-3">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={PANEL_ROW}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
