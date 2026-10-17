import { useMemo, useState } from "react";
import { useResource } from "../../../application/useResource";
import { collectAllPages } from "../../../lib/api";
import { pipelineApi } from "../../../lib/pipeline";
import { useTranslation } from "../../../translations/TranslationProvider";
import { ProblemState, Waiting } from "../../../ui/components";
import { Button } from "../../../ui/primitives";
import { BulkRunSection } from "./BulkRunSection";
import { PreparationBindingSection } from "./PreparationBindingSection";
import { PreparationRequestsSection } from "./PreparationRequestsSection";
import { loadSourceStanding } from "./sourceIndexing";
import { PANEL, SPLIT } from "./sourceIndexingClasses";

interface SourceIndexingPanelProperties {
  workspaceId: string;
  sourceId: string;
  sourceName: string;
}

/**
 * Indexing a whole source, both ways: automatically for whatever scans capture from now on, and on
 * purpose for what is already here — each with its state, its queue and its trail.
 */
export function SourceIndexingPanel({ workspaceId, sourceId, sourceName }: SourceIndexingPanelProperties) {
  const { t } = useTranslation();
  const [refreshKey, setRefreshKey] = useState(0);
  const loaded = useResource(async () => {
    const [standing, profiles] = await Promise.all([
      loadSourceStanding(workspaceId, sourceId),
      collectAllPages((page) => pipelineApi.processingProfiles(workspaceId, page)),
    ]);
    return { standing, profiles };
  }, [workspaceId, sourceId, refreshKey]);
  const titles = useMemo(
    () => new Map(loaded.status === "ready" ? loaded.data.standing.documents.map((entry) => [entry.document.id, entry.document.title]) : []),
    [loaded],
  );

  if (loaded.status === "loading") {
    return <Waiting label={t("sources.indexing.loading", "Loading where the documents stand")} lines={6} />;
  }
  if (loaded.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={loaded.problem}
        actions={
          <Button icon="refresh" onClick={loaded.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }

  return (
    <div className={PANEL}>
      <BulkRunSection
        workspaceId={workspaceId}
        sourceName={sourceName}
        standing={loaded.data.standing}
        profiles={loaded.data.profiles}
        onChanged={() => {
          setRefreshKey((current) => current + 1);
        }}
      />
      <div className={SPLIT}>
        <PreparationBindingSection workspaceId={workspaceId} sourceId={sourceId} profiles={loaded.data.profiles} />
        <PreparationRequestsSection workspaceId={workspaceId} sourceId={sourceId} titles={titles} />
      </div>
    </div>
  );
}
