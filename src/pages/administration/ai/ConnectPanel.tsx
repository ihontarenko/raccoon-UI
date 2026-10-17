import { useState } from "react";
import { useResource } from "../../../application/useResource";
import { useTranslation } from "../../../translations/TranslationProvider";
import { CopyableExample, Notice, ProblemState, Segmented, Waiting } from "../../../ui/components";
import { LIST_HEAD, PANEL, SECTION_TITLE } from "./aiClasses";

type Client = "claude" | "codex" | "grok" | "any";

/**
 * How an assistant is pointed at this installation.
 *
 * ⚠️ The address comes from the installation's OWN discovery document rather than from this browser or
 * from the public base address, and that is the whole point: a client connects to the API, while this
 * interface may be served from somewhere else entirely — in development it is a dev server on another
 * port. Building the command from `window.location.origin` is how somebody ends up registering the
 * interface's address and getting a 404 that reads as a broken server. `resource` in that document is by
 * definition the address this server tells clients to use, so the two cannot drift.
 */
export function ConnectPanel() {
  const { t } = useTranslation();
  const [client, setClient] = useState<Client>("claude");

  const discovery = useResource(async () => {
    const response = await fetch("/.well-known/oauth-protected-resource", { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`Discovery answered ${response.status}`);
    }
    return (await response.json()) as { resource: string; resource_name?: string };
  }, []);

  if (discovery.status === "loading") {
    return <Waiting label={t("administration.ai.connect.loading", "Reading the installation address")} lines={3} />;
  }
  if (discovery.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={discovery.problem}
        actions={null}
      />
    );
  }

  // Raccoon's protocol endpoint is /mcp, not /api/mcp: `jmouse.ai.protocol.endpoint` and
  // `credentials-confined-to` must agree, and the application refuses to start if they do not.
  const endpoint = `${discovery.data.resource}/mcp`;

  const examples: Record<Client, { label: string; example: string }[]> = {
    claude: [
      {
        label: t("administration.ai.connect.claude.add", "Register it (Claude Code)"),
        example: `claude mcp add --transport http raccoon ${endpoint}`,
      },
      {
        label: t("administration.ai.connect.claude.check", "Then authorize, and check"),
        example: `claude mcp list`,
      },
    ],
    codex: [
      {
        label: t("administration.ai.connect.codex.add", "Register it (Codex CLI)"),
        example: `codex mcp add raccoon --url ${endpoint}`,
      },
      {
        label: t("administration.ai.connect.codex.file", "Or by hand, in ~/.codex/config.toml"),
        example: `[mcp_servers.raccoon]\nurl = "${endpoint}"`,
      },
    ],
    grok: [
      {
        label: t("administration.ai.connect.grok.file", "In ~/.grok/config.toml"),
        example: `[mcp_servers.raccoon]\nurl = "${endpoint}"`,
      },
    ],
    any: [
      {
        label: t("administration.ai.connect.any.facts", "What any client needs"),
        example: `endpoint:   ${endpoint}\ntransport:  Streamable HTTP (POST only — GET is answered 405 on purpose)\nauth:       OAuth 2.1, discovered from the 401 this endpoint answers.\n            Registration is dynamic; the client needs nothing configured.`,
      },
    ],
  };

  return (
    <div className={PANEL}>
      <div className={LIST_HEAD}>
        <Segmented<Client>
          label={t("administration.ai.connect.client", "Client")}
          value={client}
          onChange={setClient}
          options={[
            { value: "claude", label: t("administration.ai.connect.clientClaude", "Claude Code") },
            { value: "codex", label: t("administration.ai.connect.clientCodex", "Codex") },
            { value: "grok", label: t("administration.ai.connect.clientGrok", "Grok") },
            { value: "any", label: t("administration.ai.connect.clientAny", "Any client") },
          ]}
        />
      </div>

      <section aria-label={t("administration.ai.connect.endpointSection", "The endpoint")}>
        <h2 className={SECTION_TITLE}>{t("administration.ai.connect.endpointTitle", "The endpoint")}</h2>
        <p className="text-xs text-secondary wraps">
          {t(
            "administration.ai.connect.endpointDescription",
            "Raccoon speaks the Model Context Protocol over Streamable HTTP at {endpoint}. Note the path: it is /mcp, not /api/mcp. No token goes into a client's configuration — the address is all it needs.",
            { endpoint: <span className="numeric">{endpoint}</span> },
          )}
        </p>
      </section>

      {examples[client].map((example) => (
        <CopyableExample key={example.label} label={example.label} example={example.example} />
      ))}

      <Notice tone="information" title={t("administration.ai.connect.approveTitle", "Approving it happens in this browser")}>
        {t(
          "administration.ai.connect.approveBody",
          "On its first call the client opens a tab here and asks you to approve the connection. Be signed in to Raccoon in that browser first — the approval screen reads the session this interface stored, and without one it can only say that nobody is signed in.",
        )}{" "}
        {t(
          "administration.ai.connect.approveActsAs",
          "The assistant then acts as you: the same workspaces, the same permissions. What a connection adds is that it can be revoked on its own and its calls can be told apart from your browser's.",
        )}
      </Notice>

      <section aria-label={t("administration.ai.connect.refusedSection", "If it is refused")}>
        <h2 className={SECTION_TITLE}>{t("administration.ai.connect.refusedTitle", "If the connection is refused")}</h2>
        <ul className="text-xs text-secondary">
          <li>
            {t(
              "administration.ai.connect.refusedRegistration",
              "\"Dynamic Client Registration rejected\" with a 404 — the client is pointed at the wrong address. The interface's own port is the usual mistake; the endpoint above is the API's.",
            )}
          </li>
          <li>
            {t(
              "administration.ai.connect.refusedInvalidClient",
              "\"invalid_client\" in the browser tab — this installation no longer holds that client's registration, because it expired or the records were reset. Starting the connection again registers afresh and works; one failed round trip is expected.",
            )}
          </li>
          <li>
            {t(
              "administration.ai.connect.refusedNobodySignedIn",
              "The approval screen says nobody is signed in — sign in to Raccoon in that same browser and open the link again.",
            )}
          </li>
          <li>
            {t(
              "administration.ai.connect.refused403",
              "403 — the caller's host or origin is not allowed. Raccoon checks both (raccoon.mcp.allowed-hosts, raccoon.mcp.allowed-origins), and by default only this machine is on the list.",
            )}
          </li>
          <li>
            {t(
              "administration.ai.connect.refused405",
              "405 on a GET — deliberate. Only POST and DELETE are served, because the protocol session identifier is not bound to an identity and a replayed stream would not be either.",
            )}
          </li>
          <li>
            {t(
              "administration.ai.connect.refused503",
              "503 — assistant access is switched off for the whole installation (the mcp.enabled setting).",
            )}
          </li>
          <li>
            {t(
              "administration.ai.connect.refusedRestart",
              "Everything stopped working after a restart — no signing secret is set, so one is generated per run and every credential issued before it is now invalid. Set RACCOON_MCP_SIGNING_SECRET and connect again.",
            )}
          </li>
        </ul>
      </section>
    </div>
  );
}
