import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useStoredChoice } from "../../application/useStoredChoice";
import type { ProfileKind } from "../../lib/profiles";
import { useTranslation } from "../../translations/TranslationProvider";
import { EmptyState, ProblemState, Waiting } from "../../ui/components";
import { Badge, Button, Select } from "../../ui/primitives";
import { fieldsOutOfBounds } from "./ProfileQuickSettings";
import { useProfileDraft, type ProfileDraft } from "./useProfileDraft";

const PANEL = "grid gap-4 rounded-surface border border-line bg-surface p-4";
const PANEL_HEAD = "flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line pb-3";
const PANEL_LABEL = "text-[11px] font-semibold tracking-[0.06em] text-muted uppercase";
const SAVE_BAR = "flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3";

export interface ScopedProfile {
  id: string;
  name: string;
  enabled: boolean;
}

interface ProfileScopedPanelProperties {
  kind: ProfileKind;
  /** The profiles this page's subject runs under; the first is shown unless another was chosen here before. */
  profiles: ScopedProfile[];
  /** Remembers the chosen profile per page in this browser. */
  storageKey: string;
  /** What the panel shows for the chosen profile, as a phrase: "Chunk settings of". */
  title: string;
  /** The fields whose bounds keep the save off, so a value the server would refuse is not sent. */
  paths: string[];
  /** Said when no profile runs this page's subject. */
  emptyText: string;
  children: (draft: ProfileDraft) => ReactNode;
}

/**
 * A parser's or chunker's settings are a profile's settings: there is no "the chunker's size", only what each
 * processing profile asks of it. This panel makes that the shape of the page — choose a profile, see what it asks
 * here, change it in place — instead of a sentence pointing elsewhere. A save is a new settings revision of that
 * profile, the same one its editor writes.
 */
export function ProfileScopedPanel({ kind, profiles, storageKey, title, paths, emptyText, children }: ProfileScopedPanelProperties) {
  const { t } = useTranslation();
  const identifiers = profiles.map((profile) => profile.id);
  const [chosenId, setChosenId] = useStoredChoice<string>(storageKey, identifiers[0] ?? "", identifiers);
  const profileId = identifiers.includes(chosenId) ? chosenId : (identifiers[0] ?? "");
  const draft = useProfileDraft(kind, profileId, profileId !== "");
  const data = draft.loaded.status === "ready" ? draft.loaded.data : null;
  const chosen = profiles.find((profile) => profile.id === profileId) ?? null;

  if (profiles.length === 0) {
    return <EmptyState title={t("profiles.scoped.none", "No profile runs it")} description={emptyText} />;
  }

  return (
    <section className={PANEL} aria-label={title}>
      <div className={PANEL_HEAD}>
        <span className={PANEL_LABEL}>{title}</span>
        <Select
          aria-label={t("profiles.scoped.profile", "Processing profile")}
          value={profileId}
          onChange={(event) => {
            setChosenId(event.target.value);
          }}
        >
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </Select>
        {data !== null && <span className="numeric text-xs text-muted">{t("profiles.scoped.revision", "revision {revision}", { revision: data.profile.revision })}</span>}
        {chosen !== null && !chosen.enabled && <Badge tone="deny">{t("profiles.scoped.disabled", "Disabled")}</Badge>}
        <Link to="/profiles/$kind/$profileId" params={{ kind, profileId }} className="ml-auto text-xs font-semibold text-accent-text hover:underline">
          {t("profiles.quick.full", "Every setting of this profile")}
        </Link>
      </div>

      {draft.loaded.status === "loading" && <Waiting label={t("profiles.editor.loading", "Loading the profile")} lines={4} />}
      {draft.loaded.status === "failed" && <ProblemState layout="section" problem={draft.loaded.problem} />}
      {data !== null && draft.configuration !== null && children(draft)}
      {draft.problem !== null && <ProblemState layout="section" problem={draft.problem} />}

      {draft.mayEdit ? (
        draft.changed && (
          <div className={SAVE_BAR}>
            <span className="mr-auto text-xs text-secondary">
              {t("profiles.scoped.effect", "Applies to the next processing. Documents prepared already keep their chunks until processed again.")}
            </span>
            <Button variant="quiet" onClick={draft.discard} disabled={draft.saving}>
              {t("profiles.scoped.discard", "Discard")}
            </Button>
            <Button variant="primary" disabled={draft.saving || fieldsOutOfBounds(draft, paths)} onClick={() => void draft.save()}>
              {draft.saving ? t("profiles.quick.saving", "Saving…") : t("profiles.quick.save", "Save as a new revision")}
            </Button>
          </div>
        )
      ) : (
        <p className="m-0 text-xs text-muted">{t("profiles.quick.readOnly", "You may read these settings but not change them.")}</p>
      )}
    </section>
  );
}
