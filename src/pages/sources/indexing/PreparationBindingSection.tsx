import { useEffect, useState } from "react";
import { usePermissions } from "../../../access/PermissionsProvider";
import { PERMISSIONS } from "../../../access/permissions";
import { describeProblem } from "../../../application/problems";
import { useResource } from "../../../application/useResource";
import { ApiError, collectAllPages } from "../../../lib/api";
import { pipelineApi, type PreparationBinding, type ProcessingProfile } from "../../../lib/pipeline";
import { useTranslation } from "../../../translations/TranslationProvider";
import { ChipInput, Notice, ProblemState, Waiting, useToaster } from "../../../ui/components";
import { Badge, Button, Checkbox, Field, Select } from "../../../ui/primitives";
import { BINDING_FOOTER, BINDING_FORM, BLOCK, BLOCK_HEAD, BLOCK_STATE, BLOCK_TITLE, HISTORY, HISTORY_LIST } from "./sourceIndexingClasses";

/** Media types a folder scan registers; a Markdown file arrives as an octet stream. */
const SUGGESTED_MEDIA_TYPES = ["application/octet-stream", "text/plain", "text/markdown"];

interface PreparationBindingSectionProperties {
  workspaceId: string;
  sourceId: string;
  profiles: ProcessingProfile[];
}

/**
 * Whether every version a scan captures from now on is processed by itself, with which profile and
 * for which media types. It never reaches back: documents captured before it was switched on wait
 * for the run below.
 */
export function PreparationBindingSection({ workspaceId, sourceId, profiles }: PreparationBindingSectionProperties) {
  const { t } = useTranslation();
  const { notify } = useToaster();
  const mayManage = usePermissions().may(PERMISSIONS.automationManage);
  const binding = useResource<PreparationBinding | null>(async () => {
    try {
      return await pipelineApi.preparationBinding(workspaceId, sourceId);
    } catch (error) {
      // Never saved is an answer, not a failure.
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }, [workspaceId, sourceId]);
  const versions = useResource(
    () => collectAllPages((page) => pipelineApi.preparationBindingVersions(workspaceId, sourceId, page)),
    [workspaceId, sourceId, binding.status === "ready" ? binding.data?.revision : null],
  );

  const enabledProfiles = profiles.filter((profile) => profile.configuration.enabled !== false);
  const [profileId, setProfileId] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [mediaTypes, setMediaTypes] = useState<string[]>(SUGGESTED_MEDIA_TYPES);
  const [saving, setSaving] = useState(false);

  const stored = binding.status === "ready" ? binding.data : null;
  useEffect(() => {
    if (binding.status !== "ready") {
      return;
    }
    setProfileId(stored?.configuration.profileId ?? enabledProfiles[0]?.id ?? "");
    setEnabled(stored?.configuration.enabled ?? true);
    setMediaTypes(stored?.configuration.mediaTypes ?? SUGGESTED_MEDIA_TYPES);
    // The form follows the stored binding, not every change to the profile list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binding.status, stored]);

  if (binding.status === "loading") {
    return <Waiting label={t("sources.preparation.loading", "Loading automatic preparation")} lines={3} />;
  }
  if (binding.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={binding.problem}
        actions={
          <Button icon="refresh" onClick={binding.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }

  const dirty =
    stored === null ||
    stored.configuration.profileId !== profileId ||
    stored.configuration.enabled !== enabled ||
    JSON.stringify(stored.configuration.mediaTypes) !== JSON.stringify(mediaTypes);

  const save = async () => {
    setSaving(true);
    try {
      await pipelineApi.savePreparationBinding(workspaceId, sourceId, { profileId, enabled, mediaTypes }, stored?.revision ?? 0);
      notify({
        tone: "good",
        title: enabled
          ? t("sources.preparation.savedOn", "Automatic preparation on")
          : t("sources.preparation.savedOff", "Automatic preparation saved, switched off"),
        description: t("sources.preparation.savedDescription", "It applies to versions captured from now on."),
      });
      binding.reload();
    } catch (error) {
      const problem = describeProblem(error);
      notify({ tone: "error", title: problem.title, description: problem.detail ?? problem.description });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={BLOCK} aria-labelledby="automatic-preparation">
      <header className={BLOCK_HEAD}>
        <div>
          <h2 id="automatic-preparation" className={BLOCK_TITLE}>
            {t("sources.preparation.title", "After every scan")}
          </h2>
          <p className="text-xs text-secondary">
            {t(
              "sources.preparation.lead",
              "Each version a scan captures is queued for processing by itself. Earlier documents are not touched.",
            )}
          </p>
        </div>
        {stored === null ? (
          <Badge tone="neutral">{t("sources.preparation.notSetUp", "Not set up")}</Badge>
        ) : (
          <span className={BLOCK_STATE}>
            <Badge tone={stored.configuration.enabled ? "allow" : "deny"}>
              {stored.configuration.enabled ? t("sources.preparation.on", "On") : t("sources.preparation.off", "Off")}
            </Badge>
            <span className="text-xs text-muted">{t("sources.preparation.revision", "revision {revision}", { revision: stored.revision })}</span>
          </span>
        )}
      </header>
      {enabledProfiles.length === 0 ? (
        <Notice tone="warn" title={t("sources.preparation.noProfile", "No processing profile")}>
          {t("sources.preparation.noProfileDescription", "Create a processing profile first; it decides how documents are chunked and indexed.")}
        </Notice>
      ) : (
        <fieldset className={BINDING_FORM} disabled={!mayManage}>
          <Field label={t("sources.preparation.profile", "Processing profile")}>
            <Select
              value={profileId}
              fullWidth
              onChange={(event) => {
                setProfileId(event.target.value);
              }}
            >
              {enabledProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {t("sources.preparation.profileOption", "{name} · revision {revision}", { name: profile.name, revision: profile.revision })}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={t("sources.preparation.mediaTypes", "Media types")}
            hint={t("sources.preparation.mediaTypesHint", "Only versions of these types are prepared; others are skipped and say why.")}
          >
            <ChipInput
              values={mediaTypes}
              onChange={setMediaTypes}
              listLabel={t("sources.preparation.mediaTypes", "Media types")}
              addLabel={t("sources.preparation.addMediaType", "Add a media type")}
              removeLabel={(value) => t("sources.preparation.removeMediaType", "Remove media type {value}", { value })}
              code
              placeholder="text/plain"
            />
          </Field>
          <div className={BINDING_FOOTER}>
            <Checkbox
              label={t("sources.preparation.automatically", "Prepare automatically")}
              hint={t("sources.preparation.automaticallyHint", "Off keeps the setting but stops queueing new versions.")}
              checked={enabled}
              onChange={(event) => {
                setEnabled(event.target.checked);
              }}
            />
            {mayManage && (
              <Button variant="primary" disabled={!dirty || saving || profileId === "" || mediaTypes.length === 0} onClick={() => void save()}>
                {saving ? t("common.saving", "Saving…") : stored === null ? t("sources.preparation.setUp", "Set up") : t("common.save", "Save")}
              </Button>
            )}
          </div>
        </fieldset>
      )}
      {versions.status === "ready" && versions.data.length > 1 && (
        <details className={HISTORY}>
          <summary>{t("sources.preparation.earlier", "Earlier settings · {count}", { count: versions.data.length - 1 })}</summary>
          <ol className={HISTORY_LIST}>
            {versions.data.slice(1).map((version) => (
              <li key={version.revision}>
                <span className="numeric">{t("sources.preparation.revisionHeading", "Revision {revision}", { revision: version.revision })}</span> ·{" "}
                {profiles.find((profile) => profile.id === version.configuration.profileId)?.name ??
                  t("sources.preparation.removedProfile", "a removed profile")}{" "}
                ·{" "}
                {version.configuration.enabled ? t("sources.preparation.onLower", "on") : t("sources.preparation.offLower", "off")} ·{" "}
                <span className="numeric text-xs">{version.configuration.mediaTypes.join(", ")}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
