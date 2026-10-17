import { collectAllPages } from "../../lib/api";
import { pipelineApi } from "../../lib/pipeline";
import { profileKind, type Profile, type ProfileKind } from "../../lib/profiles";
import { useResource } from "../../application/useResource";
import { useTranslation } from "../../translations/TranslationProvider";
import { EmptyState, ProblemState, RowLink, Waiting, Workbench } from "../../ui/components";
import { Badge, Button, Table } from "../../ui/primitives";
import { publishedVectorsOf, stateOf, usedBy, type ProfileWiring } from "./profileWiring";
import { USED_BY_PANEL } from "./profilesClasses";

interface ProfileUsedByProperties {
  workspaceId: string;
  kind: ProfileKind;
  profile: Profile;
  wiring: ProfileWiring;
}

/**
 * Where a profile is used: the profiles that name it, and for a processing profile the sources whose automatic
 * preparation sends their documents through it. Each row opens what uses it.
 */
export function ProfileUsedBy({ workspaceId, kind, profile, wiring }: ProfileUsedByProperties) {
  const { t, plural } = useTranslation();
  const links = usedBy(wiring, kind, profile.id);
  const publishedVectors = kind === "embedding" ? (publishedVectorsOf(wiring, profile) ?? []) : [];
  const vectorCount = publishedVectors.reduce((sum, generation) => sum + generation.storedRecords - generation.removedRecords, 0);

  return (
    <div className={USED_BY_PANEL}>
      {kind === "embedding" && publishedVectors.length > 0 && (
        <p className="text-secondary">
          {plural("profiles.usedBy.vectors", vectorCount, {
            one: "{count} vector is published for this model.",
            other: "{count} vectors are published for this model.",
          })}
        </p>
      )}
      {kind === "processing" && <PreparingSources workspaceId={workspaceId} profileId={profile.id} />}
      {links.length > 0 && (
        <Workbench>
          <Table>
            <thead>
              <tr>
                <th scope="col">{t("profiles.usedBy.profile", "Profile")}</th>
                <th scope="col">{t("profiles.usedBy.state", "State")}</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => {
                const state = stateOf(wiring, link.kind, link.profile);
                return (
                  <tr key={`${link.kind}:${link.profile.id}`}>
                    <td>
                      <RowLink href={`/profiles/${link.kind}/${link.profile.id}`}>{link.profile.name}</RowLink>
                      <div className="text-xs text-muted">
                        {profileKind(link.kind).label} ·{" "}
                        {t("profiles.settingsRevision", "Settings revision {revision}", { revision: link.profile.revision })}
                      </div>
                    </td>
                    <td>
                      <Badge tone={state.verdict.tone}>{state.verdict.text}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Workbench>
      )}
      {kind !== "processing" && links.length === 0 && (
        <EmptyState
          title={t("profiles.usedBy.none", "Nothing names this profile")}
          description={t("profiles.usedBy.noneText", "Another profile uses it by choosing it in its own settings.")}
        />
      )}
    </div>
  );
}

interface PreparingSource {
  id: string;
  name: string;
  enabled: boolean;
  mediaTypeCount: number;
}

/** Sources whose automatic preparation names this processing profile — read only when this tab is opened. */
function PreparingSources({ workspaceId, profileId }: { workspaceId: string; profileId: string }) {
  const { t, plural } = useTranslation();
  const sources = useResource<PreparingSource[]>(async () => {
    const bound = await collectAllPages((page) => pipelineApi.boundSources(workspaceId, profileId, page));
    return bound.map((binding) => ({
      id: binding.sourceId,
      name: binding.sourceName,
      enabled: binding.configuration.enabled,
      mediaTypeCount: binding.configuration.mediaTypes.length,
    }));
  }, [workspaceId, profileId]);

  if (sources.status === "loading") {
    return <Waiting label={t("profiles.usedBy.loadingSources", "Loading the sources that prepare with it")} lines={3} />;
  }
  if (sources.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={sources.problem}
        actions={
          <Button icon="refresh" onClick={sources.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }
  if (sources.data.length === 0) {
    return (
      <EmptyState
        title={t("profiles.usedBy.noSources", "No source prepares with it automatically")}
        description={t(
          "profiles.usedBy.noSourcesText",
          "A source chooses its processing profile under Indexing › Automatic preparation; it can still be run by hand.",
        )}
      />
    );
  }
  return (
    <Workbench>
      <Table>
        <thead>
          <tr>
            <th scope="col">{t("profiles.usedBy.source", "Source")}</th>
            <th scope="col">{t("profiles.usedBy.preparation", "Automatic preparation")}</th>
          </tr>
        </thead>
        <tbody>
          {sources.data.map((source) => (
            <tr key={source.id}>
              <td>
                <RowLink href={`/sources/${source.id}`}>{source.name}</RowLink>
                {source.mediaTypeCount > 0 && (
                  <div className="text-xs text-muted">
                    {plural("profiles.usedBy.mediaTypes", source.mediaTypeCount, {
                      one: "{count} media type",
                      other: "{count} media types",
                    })}
                  </div>
                )}
              </td>
              <td>
                <Badge tone={source.enabled ? "allow" : "deny"}>
                  {source.enabled ? t("profiles.usedBy.preparationOn", "On") : t("profiles.usedBy.preparationOff", "Off")}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Workbench>
  );
}
