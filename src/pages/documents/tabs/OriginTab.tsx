import { useMemo } from "react";
import { formatBytes, formatDateTime, labelOfCode, shortIdentifier } from "../../../application/format";
import { useResource } from "../../../application/useResource";
import { aiApi } from "../../../lib/ai";
import { api } from "../../../lib/api";
import type { CaptureOrigin, DocumentVersionView, DocumentView, SourceView } from "../../../lib/contracts";
import { useTranslation } from "../../../translations/TranslationProvider";
import { PathText } from "../../../ui/components";
import { Badge, Table } from "../../../ui/primitives";
import { CAPTURE_CHANNELS, CHANNEL_TONE } from "../captureOrigin";
import { TABLE_SURFACE } from "../documentPageClasses";

/* Where it lives on top — source, path, the remote system's own address — then who put each version in, by what. */
const LAYOUT = "grid gap-6";

const PLACE = [
  "grid grid-cols-[calc(140px*var(--ui-scale))_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-surface border border-line bg-surface p-4",
  "[&>dt]:text-xs [&>dt]:text-muted [&>dd]:m-0 [&>dd]:text-sm",
  "max-[700px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

const SECTION_TITLE = "m-0 mb-2 text-sm font-[650]";

const UPLOADERS = "flex flex-wrap gap-2";

const UPLOADER = "grid gap-1 rounded-control border border-line bg-surface px-3 py-2 text-xs";

interface OriginTabProperties {
  document: DocumentView;
  versions: DocumentVersionView[];
  source: SourceView | null;
}

/** The fields that make two uploaders the same uploader — the same fields the server fingerprints. */
function uploaderKey(origin: CaptureOrigin): string {
  return [origin.channel, origin.subjectId, origin.agentId, origin.connectionId, origin.telegramUserId, origin.clientName].join("|");
}

/**
 * Where a document came from and who put each version in: the source and path, the remote system's own address when
 * it was imported, and per version the channel — scan, upload, push, an agent over MCP, a Telegram chat — with the
 * person it acted as, the agent and its connection, or the Telegram account.
 */
export function OriginTab({ document, versions, source }: OriginTabProperties) {
  const { t } = useTranslation();
  const subjectIds = useMemo(
    () => [...new Set(versions.map((version) => version.origin?.subjectId).filter((id): id is string => id !== null && id !== undefined))].sort(),
    [versions],
  );
  const names = useResource(async () => {
    const [subjects, agents] = await Promise.all([
      Promise.allSettled(subjectIds.map((id) => api.getSubject(id))),
      aiApi.agents().catch(() => []),
    ]);
    const people = new Map<string, string>();
    subjects.forEach((result) => {
      if (result.status === "fulfilled") {
        people.set(result.value.id, result.value.displayName);
      }
    });
    return { people, agents: new Map(agents.map((agent) => [agent.id, agent.name])) };
  }, [subjectIds.join(",")]);
  const person = (id: string | null) =>
    id === null ? "—" : names.status === "ready" ? (names.data.people.get(id) ?? shortIdentifier(id)) : shortIdentifier(id);
  const agent = (id: string) => (names.status === "ready" ? (names.data.agents.get(id) ?? shortIdentifier(id)) : shortIdentifier(id));

  const uploaders = useMemo(() => {
    const seen = new Map<string, { origin: CaptureOrigin; count: number }>();
    for (const version of versions) {
      if (version.origin !== null) {
        const key = uploaderKey(version.origin);
        const before = seen.get(key);
        seen.set(key, { origin: version.origin, count: (before?.count ?? 0) + 1 });
      }
    }
    return [...seen.values()];
  }, [versions]);

  const via = (origin: CaptureOrigin) => {
    if (origin.channel === "MCP" && origin.agentId !== null) {
      return t("documents.originTab.viaAgent", "agent {agent}", { agent: agent(origin.agentId) });
    }
    if (origin.channel === "TELEGRAM") {
      return origin.clientName !== null ? `@${origin.clientName}` : origin.telegramUserId !== null ? `#${origin.telegramUserId}` : "";
    }
    return "";
  };

  return (
    <div className={LAYOUT}>
      <section aria-labelledby="origin-place">
        <h3 id="origin-place" className={SECTION_TITLE}>
          {t("documents.originTab.where", "Where it lives")}
        </h3>
        <dl className={PLACE}>
          <dt>{t("documents.source", "Source")}</dt>
          <dd>
            {source === null ? shortIdentifier(document.sourceId) : (
              <>
                {source.name} <Badge tone="door">{source.kind}</Badge>
              </>
            )}
          </dd>
          <dt>{t("documents.fact.path", "Path")}</dt>
          <dd className="font-mono text-xs">
            <PathText path={document.externalId} />
          </dd>
          {source?.location !== null && source?.location !== undefined && (
            <>
              <dt>{t("documents.originTab.location", "Source location")}</dt>
              <dd className="font-mono text-xs">
                <PathText path={source.location} />
              </dd>
            </>
          )}
          {document.origin !== null && document.origin !== undefined && (
            <>
              <dt>{t("documents.originTab.remotePath", "In the remote system")}</dt>
              <dd>{document.origin.path}</dd>
              {document.origin.address !== null && (
                <>
                  <dt>{t("documents.originTab.remoteAddress", "Remote address")}</dt>
                  <dd>
                    <a href={document.origin.address} target="_blank" rel="noreferrer">
                      {document.origin.address}
                    </a>
                  </dd>
                </>
              )}
            </>
          )}
        </dl>
      </section>

      <section aria-labelledby="origin-uploaders">
        <h3 id="origin-uploaders" className={SECTION_TITLE}>
          {t("documents.originTab.uploaders", "Who put it in")}
        </h3>
        {uploaders.length === 0 ? (
          <p className="m-0 text-xs text-muted">{t("documents.originTab.noUploaders", "Not recorded — these versions came in before origins were kept.")}</p>
        ) : (
          <div className={UPLOADERS}>
            {uploaders.map(({ origin, count }) => (
              <div key={uploaderKey(origin)} className={UPLOADER}>
                <span className="flex items-center gap-2">
                  <Badge tone={CHANNEL_TONE[origin.channel]}>{labelOfCode(CAPTURE_CHANNELS, origin.channel)}</Badge>
                  <strong>{person(origin.subjectId)}</strong>
                </span>
                <span className="text-muted">
                  {[via(origin), t("documents.originTab.versionCount", "{count} versions", { count })].filter((part) => part !== "").join(" · ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="origin-versions">
        <h3 id="origin-versions" className={SECTION_TITLE}>
          {t("documents.originTab.byVersion", "Version by version")}
        </h3>
        <div className={TABLE_SURFACE}>
          <Table>
            <thead>
              <tr>
                <th scope="col">{t("documents.fact.version", "Version")}</th>
                <th scope="col">{t("documents.originTab.when", "When")}</th>
                <th scope="col">{t("documents.originTab.channel", "Channel")}</th>
                <th scope="col">{t("documents.originTab.as", "As")}</th>
                <th scope="col">{t("documents.originTab.through", "Through")}</th>
                <th scope="col" className="numeric">{t("documents.fact.size", "Size")}</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.id}>
                  <td className="numeric">v{version.versionNumber}</td>
                  <td className="text-xs text-secondary">{formatDateTime(version.createdAt)}</td>
                  <td>
                    {version.origin === null ? (
                      <span className="text-xs text-muted">{t("documents.origin.unrecorded", "Not recorded")}</span>
                    ) : (
                      <Badge tone={CHANNEL_TONE[version.origin.channel]}>{labelOfCode(CAPTURE_CHANNELS, version.origin.channel)}</Badge>
                    )}
                  </td>
                  <td>{version.origin === null ? "—" : person(version.origin.subjectId)}</td>
                  <td className="text-xs">
                    {version.origin === null ? "—" : via(version.origin) || "—"}
                    {version.origin?.connectionId !== null && version.origin?.connectionId !== undefined && (
                      <div className="text-muted" title={version.origin.connectionId}>
                        {t("documents.originTab.connection", "connection {connection}", { connection: shortIdentifier(version.origin.connectionId) })}
                      </div>
                    )}
                  </td>
                  <td className="numeric text-xs">{formatBytes(version.sizeBytes)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </section>
    </div>
  );
}
