import { labelOfCode, shortIdentifier, type CodeLabels } from "../../application/format";
import type { CaptureChannel, CaptureOrigin } from "../../lib/contracts";
import { declareText } from "../../translations/translate";
import { useTranslation } from "../../translations/TranslationProvider";
import type { BadgeTone } from "../../ui/primitives";

// How a document version got in, said the same way wherever it is shown: the inspector, the version list, the
// Origin tab.

export const CAPTURE_CHANNELS: CodeLabels = {
  SCAN: declareText("documents.origin.channel.scan", "Scan"),
  UPLOAD: declareText("documents.origin.channel.upload", "Upload"),
  TEXT: declareText("documents.origin.channel.text", "Typed text"),
  PUSH_API: declareText("documents.origin.channel.pushApi", "Push API"),
  MCP: declareText("documents.origin.channel.mcp", "MCP"),
  TELEGRAM: declareText("documents.origin.channel.telegram", "Telegram"),
  INTERNAL: declareText("documents.origin.channel.internal", "Internal"),
};

/** A channel's colour: an agent and a chat stand out from the interface and the scanner, which are the ordinary ways in. */
export const CHANNEL_TONE: Record<CaptureChannel, BadgeTone> = {
  SCAN: "door",
  UPLOAD: "neutral",
  TEXT: "neutral",
  PUSH_API: "pipeline",
  MCP: "warn",
  TELEGRAM: "active",
  INTERNAL: "neutral",
};

/** How a version got in, in one line: the channel, and the agent or the Telegram account that sent it. */
export function CaptureOriginText({ origin }: { origin: CaptureOrigin | null }) {
  const { t } = useTranslation();
  if (origin === null) {
    return <span className="text-muted">{t("documents.origin.unrecorded", "Not recorded")}</span>;
  }
  const channel = labelOfCode(CAPTURE_CHANNELS, origin.channel);
  if (origin.channel === "MCP" && origin.agentId !== null) {
    return (
      <span>
        {t("documents.origin.agent", "{channel} · agent {agent}", {
          channel,
          agent: <span className="numeric" title={origin.agentId}>{shortIdentifier(origin.agentId)}</span>,
        })}
      </span>
    );
  }
  if (origin.channel === "TELEGRAM") {
    return <span>{origin.clientName === null ? channel : `${channel} · @${origin.clientName}`}</span>;
  }
  return <span>{channel}</span>;
}
