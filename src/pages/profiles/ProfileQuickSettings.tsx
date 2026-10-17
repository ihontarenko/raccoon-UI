import { Link } from "@tanstack/react-router";
import type { Profile, ProfileKind } from "../../lib/profiles";
import { useTranslation } from "../../translations/TranslationProvider";
import { ProblemState, Waiting } from "../../ui/components";
import { Button, Dialog } from "../../ui/primitives";
import { CatalogueForm, outOfBounds } from "./CatalogueForm";
import { valueAt } from "./configurationPaths";
import { OPTIONAL_SECTIONS, overriddenParameters, requiredSections } from "./profileRules";
import { useProfileDraft, type ProfileDraft } from "./useProfileDraft";

/**
 * The settings a person reaches for from the page that uses a profile — not the whole editor. Each is the profile's
 * own field, drawn by the same form the editor uses, so a change here is the same change there and saves the same
 * settings revision. Everything else stays one link away, on the profile's page.
 */
export const QUICK_SETTINGS: Partial<Record<ProfileKind, string[]>> = {
  search: [
    "grouping.mode",
    "grouping.entriesPerDocument",
    "defaultResults",
    "queryMode",
    "analyzers",
    "minimumScore",
    "lexicalQuery.minimumTermCoverage",
    "recognition.parts",
    "recognition.symbols",
  ],
  answer: [
    "searchProfileId",
    "contextProfileId",
    "providerConfigurationId",
    "maximumOutputTokens",
    "allowEditorial",
    "systemInstructions",
  ],
  processing: [
    "parserId",
    "preparation.chunking.chunkerIds",
    "preparation.chunking.maximumCodePoints",
    "preparation.chunking.overlapCodePoints",
    "preparation.chunking.unitMerging",
    "preparation.indexing.analyzer",
    "preparation.indexing.publishAutomatically",
  ],
};

/** The catalogue's own fields for these paths, in the order given, drawn by the editor's form over a draft. */
export function ProfileFields({ draft, kind, paths }: { draft: ProfileDraft; kind: ProfileKind; paths: string[] }) {
  const data = draft.loaded.status === "ready" ? draft.loaded.data : null;
  if (data === null || draft.configuration === null) {
    return null;
  }
  const parameters = paths
    .map((path) => data.catalogue.parameters.find((parameter) => parameter.path === path))
    .filter((parameter) => parameter !== undefined);
  return (
    <CatalogueForm
      parameters={parameters}
      configuration={draft.configuration}
      onChange={draft.change}
      references={data.references}
      optionalSections={OPTIONAL_SECTIONS[kind]}
      requiredSections={requiredSections(kind, draft.configuration)}
      explanationScope={kind}
      overriddenParameters={overriddenParameters(kind, draft.configuration)}
      disabled={!draft.mayEdit || draft.saving}
    />
  );
}

/** Whether any of these fields holds a value outside its bounds — the save stays off until it does not. */
export function fieldsOutOfBounds(draft: ProfileDraft, paths: string[]): boolean {
  const data = draft.loaded.status === "ready" ? draft.loaded.data : null;
  const configuration = draft.configuration;
  if (data === null || configuration === null) {
    return false;
  }
  return data.catalogue.parameters
    .filter((parameter) => paths.includes(parameter.path))
    .some((parameter) => outOfBounds(parameter, valueAt(configuration, parameter.path)) !== null);
}

interface ProfileQuickSettingsProperties {
  open: boolean;
  kind: ProfileKind;
  profileId: string;
  onClose: () => void;
  /** After a save, with the new revision — a page searches again, or offers to process again. */
  onSaved?: (profile: Profile) => void;
  /** One sentence on when the change takes effect, in the words of the page that opened it. */
  effectNote?: string;
}

export function ProfileQuickSettings({ open, kind, profileId, onClose, onSaved, effectNote }: ProfileQuickSettingsProperties) {
  const { t } = useTranslation();
  const draft = useProfileDraft(kind, profileId, open);
  const paths = QUICK_SETTINGS[kind] ?? [];
  const data = draft.loaded.status === "ready" ? draft.loaded.data : null;

  const save = async () => {
    const saved = await draft.save();
    if (saved !== null) {
      onSaved?.(saved);
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="wide"
      title={
        data === null
          ? t("profiles.quick.title", "Profile settings")
          : t("profiles.quick.titleNamed", "{name} · revision {revision}", { name: data.profile.name, revision: data.profile.revision })
      }
      footer={
        <>
          <Link to="/profiles/$kind/$profileId" params={{ kind, profileId }} className="mr-auto self-center text-xs font-semibold text-accent-text hover:underline">
            {t("profiles.quick.full", "Every setting of this profile")}
          </Link>
          <Button variant="quiet" onClick={onClose} disabled={draft.saving}>
            {t("common.cancel", "Cancel")}
          </Button>
          {draft.mayEdit && (
            <Button variant="primary" disabled={!draft.changed || fieldsOutOfBounds(draft, paths) || draft.saving} onClick={() => void save()}>
              {draft.saving ? t("profiles.quick.saving", "Saving…") : t("profiles.quick.save", "Save as a new revision")}
            </Button>
          )}
        </>
      }
    >
      {draft.loaded.status === "loading" && <Waiting label={t("profiles.editor.loading", "Loading the profile")} lines={5} />}
      {draft.loaded.status === "failed" && <ProblemState layout="section" problem={draft.loaded.problem} />}
      {data !== null && (
        <div className="grid gap-4">
          <p className="m-0 text-xs text-secondary">
            {effectNote ??
              t("profiles.quick.effect", "The settings used most from this page. A save keeps the old revision in the profile's history.")}
            {!draft.mayEdit && ` ${t("profiles.quick.readOnly", "You may read these settings but not change them.")}`}
          </p>
          <ProfileFields draft={draft} kind={kind} paths={paths} />
          {draft.problem !== null && <ProblemState layout="section" problem={draft.problem} />}
        </div>
      )}
    </Dialog>
  );
}
