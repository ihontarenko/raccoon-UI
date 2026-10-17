import type { DocumentOrigin } from "../../lib/contracts";
import { useTranslation } from "../../translations/TranslationProvider";
import { Badge, Icon } from "../../ui/primitives";
import { ORIGIN, ORIGIN_LINK, ORIGIN_TAGS } from "./documentPageClasses";

/**
 * Where an imported document lives in the knowledge base it came from: the link back, its tags, the remote
 * version captured, and how many live blocks were replaced by a marker instead of being imported.
 */
export function DocumentOriginStrip({ origin, externalId }: { origin: DocumentOrigin; externalId: string }) {
  const { t, plural } = useTranslation();
  return (
    <section className={ORIGIN} aria-label={t("documents.origin.label", "Where it comes from")}>
      {origin.address !== null && (
        <a className={ORIGIN_LINK} href={origin.address} target="_blank" rel="noopener noreferrer">
          <Icon name="link" size="small" />
          {t("documents.origin.open", "Open the original")}
          <span className="sr-only"> {t("documents.origin.newTab", "(opens in a new tab)")}</span>
        </a>
      )}
      {origin.tags.length > 0 && (
        <span className={ORIGIN_TAGS} aria-label={t("documents.origin.tags", "Tags")}>
          {origin.tags.map((tag) => (
            <Badge key={tag} tone="neutral">
              {tag}
            </Badge>
          ))}
        </span>
      )}
      <span className="text-xs text-muted">
        {t("documents.origin.remote", "Remote id {identifier} · version {version}", {
          identifier: externalId,
          version: origin.remoteVersion,
        })}
      </span>
      {origin.liveBlocks > 0 && (
        <Badge tone="warn">
          {plural("documents.origin.liveBlocks", origin.liveBlocks, {
            one: "{count} live block not imported",
            other: "{count} live blocks not imported",
          })}
        </Badge>
      )}
    </section>
  );
}
