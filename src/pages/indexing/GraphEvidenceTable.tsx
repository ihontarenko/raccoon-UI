import { GraphOriginalLink } from "./GraphOriginalLink";
import type { GraphEdge } from "../../lib/graph";
import { useTranslation } from "../../translations/TranslationProvider";
import { Badge, Table } from "../../ui/primitives";
import { TABLE_SURFACE } from "./indexingClasses";

/** Exact-version relation evidence, shared with the UI Kit; uncertainty is always a separate column. */
export function GraphEvidenceTable({
  edges,
  titles,
}: {
  edges: GraphEdge[];
  titles: Map<string, string>;
}) {
  const { t } = useTranslation();
  return (
    <div className={TABLE_SURFACE}>
      <Table>
        <thead>
          <tr>
            <th scope="col">{t("graph.evidence.owner", "Owner / target")}</th>
            <th scope="col">{t("graph.evidence.role", "Relation")}</th>
            <th scope="col">{t("graph.evidence.certainty", "Resolution")}</th>
            <th scope="col">{t("graph.evidence.original", "Original")}</th>
          </tr>
        </thead>
        <tbody>
          {edges.map((edge) => (
            <tr key={edge.id}>
              <td>
                <code>{edge.ownerKey ?? "—"}</code>
                <div className="text-xs text-secondary">{edge.writtenTarget}</div>
              </td>
              <td>
                <span>{edge.role}</span>
                <div className="text-xs text-muted">
                  {edge.origin} / {edge.factOrigin}
                </div>
              </td>
              <td>
                <Badge tone={edge.status === "RESOLVED" && edge.reliable ? "allow" : "warn"}>
                  {edge.status}
                </Badge>
                {edge.reason !== null && (
                  <div className="text-xs text-secondary">{edge.reason}</div>
                )}
              </td>
              <td>
                <GraphOriginalLink
                  evidence={edge.evidence}
                  title={titles.get(edge.evidence.documentId)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
