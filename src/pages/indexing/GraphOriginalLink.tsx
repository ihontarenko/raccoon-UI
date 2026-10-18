import { Link } from "@tanstack/react-router";
import type { GraphEvidence } from "../../lib/graph";
import { useTranslation } from "../../translations/TranslationProvider";
import { ROW_LINK } from "./indexingClasses";

/** Open the exact version; retain addresses the reader cannot yet navigate to as visible evidence. */
export function GraphOriginalLink({
  evidence,
  title,
}: {
  evidence: GraphEvidence;
  title?: string;
}) {
  const { t } = useTranslation();
  const location = evidence.location;
  const address =
    location.startLine !== null
      ? `${location.startLine}–${location.endLine}`
      : (location.anchor ??
        location.path ??
        (location.page !== null ? `${t("graph.page", "Page")} ${location.page}` : location.kind));
  return (
    <Link
      to="/documents/$documentId"
      params={{ documentId: evidence.documentId }}
      className={ROW_LINK}
      search={{
        version: evidence.versionId,
        tab: "read",
        page: location.page ?? undefined,
        lines:
          location.startLine !== null ? `${location.startLine}-${location.endLine}` : undefined,
      }}
    >
      {title ?? t("graph.evidence.document", "Document")} · {address}
    </Link>
  );
}
