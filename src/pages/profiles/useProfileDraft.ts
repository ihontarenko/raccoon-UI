import { useEffect, useState } from "react";
import { usePermissions } from "../../access/PermissionsProvider";
import { PERMISSIONS } from "../../access/permissions";
import { describeProblem, type Problem } from "../../application/problems";
import { useReadySession } from "../../application/session";
import { useResource, type Resource } from "../../application/useResource";
import { profilesApi, type Profile, type ProfileCatalogue, type ProfileConfiguration, type ProfileKind } from "../../lib/profiles";
import { useTranslation } from "../../translations/TranslationProvider";
import { useToaster } from "../../ui/components";
import { loadProfileReferences, type ProfileReferences } from "./profileReferences";
import { reconcile } from "./profileRules";
import { loadProfileWiring } from "./profileWiring";

export interface LoadedProfile {
  catalogue: ProfileCatalogue;
  references: ProfileReferences;
  profile: Profile;
}

export interface ProfileDraft {
  loaded: Resource<LoadedProfile | null>;
  /** The configuration as edited; null until the profile has been read. */
  configuration: ProfileConfiguration | null;
  change: (next: ProfileConfiguration) => void;
  /** Whether the draft differs from the saved revision. */
  changed: boolean;
  /** Back to the saved revision. */
  discard: () => void;
  save: () => Promise<Profile | null>;
  saving: boolean;
  problem: Problem | null;
  mayEdit: boolean;
}

/**
 * One profile read for editing in place — a dialog beside a search, a panel on a parser's or chunker's page. The draft
 * is reconciled the way the full editor reconciles it, and a save writes the same settings revision the editor would.
 * Nothing is read while {@code active} is false, because the references a form needs are several requests.
 */
export function useProfileDraft(kind: ProfileKind, profileId: string, active = true): ProfileDraft {
  const { t } = useTranslation();
  const { workspace } = useReadySession();
  const workspaceId = workspace?.id ?? "";
  const permissions = usePermissions();
  const mayEdit = permissions.may(PERMISSIONS.automationManage);
  const { notify } = useToaster();

  const loaded = useResource<LoadedProfile | null>(async () => {
    if (!active || profileId === "") {
      return null;
    }
    const wiring = await loadProfileWiring(workspaceId);
    const [catalogue, references, profile] = await Promise.all([
      profilesApi.catalogue(workspaceId, kind),
      loadProfileReferences(workspaceId, kind, wiring),
      profilesApi.get(workspaceId, kind, profileId),
    ]);
    return { catalogue, references, profile };
  }, [active, workspaceId, kind, profileId]);

  const [configuration, setConfiguration] = useState<ProfileConfiguration | null>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const data = loaded.status === "ready" ? loaded.data : null;

  useEffect(() => {
    setConfiguration(data?.profile.configuration ?? null);
    setProblem(null);
  }, [data]);

  const change = (next: ProfileConfiguration) => {
    if (data === null) {
      return;
    }
    setConfiguration(reconcile(kind, next, data.catalogue.parameters, data.references.providers));
  };

  const save = async (): Promise<Profile | null> => {
    if (data === null || configuration === null) {
      return null;
    }
    setSaving(true);
    setProblem(null);
    try {
      const saved = await profilesApi.save(workspaceId, kind, data.profile, data.profile.name, configuration);
      notify({
        tone: "good",
        title: t("profiles.quick.saved", "{name} saved as settings revision {revision}", { name: saved.name, revision: saved.revision }),
      });
      loaded.reload();
      return saved;
    } catch (error) {
      setProblem(describeProblem(error));
      return null;
    } finally {
      setSaving(false);
    }
  };

  return {
    loaded,
    configuration,
    change,
    changed: data !== null && configuration !== null && JSON.stringify(configuration) !== JSON.stringify(data.profile.configuration),
    discard: () => {
      setConfiguration(data?.profile.configuration ?? null);
      setProblem(null);
    },
    save,
    saving,
    problem,
    mayEdit,
  };
}
