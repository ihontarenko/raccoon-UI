import { Link } from "@tanstack/react-router";
import { useResource } from "../../application/useResource";
import { chunkersApi, type ChunkImpact } from "../../lib/chunkers";
import { ruleSetsApi, type ListedRuleSet } from "../../lib/ruleSets";
import type { ProfileConfiguration } from "../../lib/profiles";
import { useTranslation } from "../../translations/TranslationProvider";
import { ProblemState, Waiting } from "../../ui/components";
import { RuleSetBindingList } from "../rules/RuleSetBindingList";
import { valueAt, withValueAt } from "./configurationPaths";
import { SECTION, SECTION_LINK, SECTION_TITLE } from "./sectionClasses";

/** Where the profile names the rule sets it binds — the same shape it already uses for its script groups. */
const BOUND = "preparation.policyIds";

interface ContentPipelineSectionProperties {
  workspaceId: string;
  profileId: string | null;
  configuration: ProfileConfiguration;
  onChange: (configuration: ProfileConfiguration) => void;
  disabled: boolean;
}

function boundIdsOf(configuration: ProfileConfiguration): string[] {
  const value = valueAt(configuration, BOUND);
  return Array.isArray(value) ? (value as string[]) : [];
}

/**
 * What this profile does to the text before it is indexed: the rule sets it binds, in the order their rules run.
 *
 * ⚠️ NO RULE IS EDITED HERE. A rule lives in its rule set — the same rule sets a source binds for its door — and is edited on
 * the rule set's own page; a profile binds them. The list is the one a source's Rules tab draws, so binding reads the same
 * in both places.
 */
export function ContentPipelineSection({
  workspaceId,
  profileId,
  configuration,
  onChange,
  disabled,
}: ContentPipelineSectionProperties) {
  const { t, locale } = useTranslation();
  const ruleSets = useResource<ListedRuleSet[]>(() => ruleSetsApi.list(workspaceId), [workspaceId]);
  const impact = useResource<ChunkImpact | null>(async () => {
    if (profileId === null) {
      return null;
    }
    const overview = await chunkersApi.overview(workspaceId);
    return overview.profiles.find((profile) => profile.profileId === profileId)?.impact ?? null;
  }, [workspaceId, profileId]);

  if (ruleSets.status === "loading") {
    return (
      <Waiting label={t("profiles.content.loadingRuleSets", "Loading the rule sets")} lines={3} />
    );
  }
  if (ruleSets.status === "failed") {
    return <ProblemState problem={ruleSets.problem} layout="section" />;
  }

  return (
    <fieldset className={SECTION} disabled={disabled}>
      <legend className={SECTION_TITLE}>
        {t("profiles.content.titleRuleSets", "Rule sets in the pipeline")}
      </legend>

      <p>
        {t(
          "profiles.content.summaryBound",
          "The rule sets whose rules run on what this profile prepares — parsed blocks, chunks, keyword and embedding text, search queries — one after another in this order. Their rules are edited on each rule set's page.",
        )}{" "}
        <Link to="/rules" className={SECTION_LINK}>
          {t("profiles.content.catalogue", "Every rule set in the workspace")}
        </Link>
      </p>

      {impact.status === "ready" && impact.data !== null && (
        <p className="text-xs text-muted">
          {t(
            "profiles.content.impact",
            "A change applies when documents are processed again: {documents} prepared with this profile, {chunks} chunks.",
            {
              documents: impact.data.documents.toLocaleString(locale),
              chunks: impact.data.chunks.toLocaleString(locale),
            },
          )}
        </p>
      )}

      <RuleSetBindingList
        holder="PROFILE"
        ruleSets={ruleSets.data}
        boundIds={boundIdsOf(configuration)}
        editable={!disabled}
        onChange={(next) => onChange(withValueAt(configuration, BOUND, next))}
      />
    </fieldset>
  );
}
