import { useState } from "react";
import type { ProfileConfiguration, ProfileVersion } from "../../lib/profiles";
import { useTranslation } from "../../translations/TranslationProvider";
import { Button } from "../../ui/primitives";
import { HISTORY_LAYOUT, JSON_BLOCK, REVISION, REVISIONS, REVISION_BUTTON, REVISION_DETAIL, SIDE_PANEL, SIDE_TITLE } from "./profilesClasses";

interface ProfileHistoryProperties {
  versions: ProfileVersion[];
  currentRevision: number;
  /** The draft as it stands, unsaved changes included: what a save would write. */
  draft: ProfileConfiguration;
  mayEdit: boolean;
  onLoadRevision: (version: ProfileVersion) => void;
}

/**
 * A profile's saved settings revisions, newest first, each opened in place; an older one can be loaded into the draft
 * and saved as the next revision. Beside them, what a save would write now.
 */
export function ProfileHistory({ versions, currentRevision, draft, mayEdit, onLoadRevision }: ProfileHistoryProperties) {
  const { t, plural } = useTranslation();
  const [openRevision, setOpenRevision] = useState<number | null>(null);
  const newestFirst = [...versions].sort((first, second) => second.revision - first.revision);

  return (
    <div className={HISTORY_LAYOUT}>
      <section className={SIDE_PANEL} aria-labelledby="profile-revisions">
        <h2 id="profile-revisions" className={SIDE_TITLE}>
          {plural("profiles.history.revisions", versions.length, {
            one: "{count} settings revision",
            other: "{count} settings revisions",
          })}
        </h2>
        <ol className={REVISIONS}>
          {newestFirst.map((version) => {
            const current = version.revision === currentRevision;
            const open = openRevision === version.revision;
            return (
              <li key={version.revision} className={REVISION} data-current={current}>
                <button
                  type="button"
                  className={REVISION_BUTTON}
                  aria-expanded={open}
                  onClick={() => {
                    setOpenRevision(open ? null : version.revision);
                  }}
                >
                  {t("profiles.settingsRevision", "Settings revision {revision}", { revision: version.revision })}
                  {current && <span className="text-xs text-muted"> · {t("profiles.history.current", "current")}</span>}
                </button>
                {open && (
                  <div className={REVISION_DETAIL}>
                    <pre className={JSON_BLOCK}>{JSON.stringify(version.configuration, null, 2)}</pre>
                    {mayEdit && !current && (
                      <Button
                        variant="quiet"
                        icon="refresh"
                        onClick={() => {
                          onLoadRevision(version);
                        }}
                      >
                        {t("profiles.history.load", "Load into the draft")}
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>
      <section className={SIDE_PANEL} aria-labelledby="profile-draft">
        <h2 id="profile-draft" className={SIDE_TITLE}>
          {t("profiles.history.draft", "What a save writes")}
        </h2>
        <pre className={JSON_BLOCK}>{JSON.stringify(draft, null, 2)}</pre>
      </section>
    </div>
  );
}
