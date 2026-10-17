import { formatBytes, formatDateTime, labelOfCode } from "../../../application/format";
import type { DocumentVersionView } from "../../../lib/contracts";
import type { IndexGeneration } from "../../../lib/pipeline";
import { useTranslation } from "../../../translations/TranslationProvider";
import { Badge, Table } from "../../../ui/primitives";
import { RowName } from "../../../ui/components";
import { generationOfVersion } from "../documentPipeline";
import { TABLE_SURFACE } from "../documentPageClasses";
import { LEXICAL_GENERATION_STATES } from "../generationLabels";


interface VersionsTabProperties {
  versions: DocumentVersionView[];
  generations: IndexGeneration[];
  selectedId: string;
  latestId: string;
  onSelect: (versionId: string) => void;
}

/** Every captured version, newest first, with where each got to in the pipeline. */
export function VersionsTab({ versions, generations, selectedId, latestId, onSelect }: VersionsTabProperties) {
  const { t } = useTranslation();
  return (
    <div className={TABLE_SURFACE}>
      <Table>
        <thead>
          <tr>
            <th scope="col">{t("documents.versionLabel", "Version")}</th>
            <th scope="col">{t("documents.versions.captured", "Captured")}</th>
            <th scope="col" className="numeric">
              {t("documents.fact.size", "Size")}
            </th>
            <th scope="col">{t("documents.fact.type", "Type")}</th>
            <th scope="col">{t("documents.versions.index", "Index")}</th>
            <th scope="col">SHA-256</th>
          </tr>
        </thead>
        <tbody>
          {versions.map((version) => {
            const generation = generationOfVersion(generations, version.id);
            return (
              <tr key={version.id} data-selected={version.id === selectedId}>
                <td>
                  <RowName
                    selected={version.id === selectedId}
                    onSelect={() => {
                      onSelect(version.id);
                    }}
                  >
                    {t("documents.version", "Version {number}", { number: version.versionNumber })}
                  </RowName>
                  {version.id === latestId && <div className="text-xs text-muted">{t("documents.versions.current", "current")}</div>}
                </td>
                <td className="text-xs text-secondary">{formatDateTime(version.createdAt)}</td>
                <td className="numeric">{formatBytes(version.sizeBytes)}</td>
                <td className="numeric text-xs">{version.mediaType}</td>
                <td>
                  {generation === null ? (
                    <span className="text-xs text-muted">{t("documents.stageFilter.notProcessed", "Not processed")}</span>
                  ) : (
                    <Badge tone={generation.state === "PUBLISHED" ? "good" : generation.state === "PURGED" ? "neutral" : "warn"}>
                      {labelOfCode(LEXICAL_GENERATION_STATES, generation.state)}
                    </Badge>
                  )}
                </td>
                <td className="numeric text-xs text-muted" title={version.sha256}>
                  {version.sha256.slice(0, 16)}…
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
