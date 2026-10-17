import { formatNumber } from "../../application/format";
import { estimatedTokens, type ProfileChunking } from "../../lib/chunkers";
import { useTranslation } from "../../translations/TranslationProvider";
import { EmptyState, Notice, RowLink, Workbench } from "../../ui/components";
import { Badge, Table } from "../../ui/primitives";
import { HEADER_WITH_HELP, PROFILE_SETTINGS, VECTOR_LIST } from "./chunkingClasses";
import { ENTRY_UNIT, TABLE_UNIT } from "./chunkSettingLabels";
import { SettingExplanation } from "./SettingExplanation";

/**
 * The chunk settings processing profiles run with, at which settings revision, and what changing them would cost:
 * documents and chunks prepared, vectors to make again. A change applies to the next processing only, and nothing is
 * re-vectorised by itself.
 */
export function ProfileSettings({ profiles, truncated }: { profiles: ProfileChunking[]; truncated: boolean }) {
  const { t } = useTranslation();
  const withChunking = profiles.filter((profile) => profile.chunking !== null);
  if (withChunking.length === 0) {
    return (
      <EmptyState
        title={t("chunking.profiles.empty", "No profile chunks documents")}
        description={t("chunking.profiles.emptyText", "Add the chunk step to a processing profile to cut its documents into chunks.")}
      />
    );
  }
  return (
    <div className={PROFILE_SETTINGS}>
      {truncated && (
        <Notice tone="information" title={t("chunking.profiles.truncated", "Only the first 100 profiles are shown")}>
          {t("chunking.profiles.truncatedText", "This workspace has more processing profiles; they are not listed here.")}
        </Notice>
      )}
      <Workbench>
        <Table>
          <thead>
            <tr>
              <th scope="col">{t("chunking.profiles.profile", "Profile")}</th>
              <th scope="col" className="numeric">
                <span className={HEADER_WITH_HELP}>
                  {t("chunking.profiles.sizeOverlap", "Size / overlap")}
                  <SettingExplanation setting="size" />
                </span>
              </th>
              <th scope="col" className="numeric">
                {t("chunking.profiles.documentsChunks", "Documents · chunks")}
              </th>
              <th scope="col">{t("chunking.profiles.vectors", "Vectors to make again")}</th>
            </tr>
          </thead>
          <tbody>
            {withChunking.map((profile) => (
              <ProfileRow key={profile.profileId} profile={profile} />
            ))}
          </tbody>
        </Table>
      </Workbench>
      <p className="text-xs text-secondary">
        {t("chunking.profiles.summary", "Change settings on the profile; they apply to the next processing, and nothing is re-vectorised by itself.")}
      </p>
    </div>
  );
}

function ProfileRow({ profile }: { profile: ProfileChunking }) {
  const { t, say } = useTranslation();
  const chunking = profile.chunking;
  if (chunking === null) {
    return null;
  }
  const tokens = estimatedTokens(profile.impact);
  return (
    <tr>
      <td>
        <RowLink href={`/profiles/processing/${profile.profileId}`}>{profile.name}</RowLink>
        {!profile.enabled && (
          <>
            {" "}
            <Badge tone="deny">{t("chunking.profiles.disabled", "Disabled")}</Badge>
          </>
        )}
        <div className="text-xs text-muted">
          {t("chunking.profiles.settingsRevisionLine", "Settings revision {revision}", { revision: profile.revision })} ·{" "}
          <span className="numeric">{chunking.chunkerIds.join(" → ")}</span>
        </div>
      </td>
      <td className="numeric">
        {formatNumber(chunking.maximumCodePoints)} <span className="text-muted">/ {formatNumber(chunking.overlapCodePoints)}</span>
        <div className="text-xs text-muted">
          {chunking.unitMerging === "AS_PARSED"
            ? t("chunking.profiles.asParsed", "units as parsed, nothing merged")
            : t("chunking.profiles.mergesBy", "merges small units · entries by {entryUnit} · tables by {tableUnit}", {
                entryUnit: say(ENTRY_UNIT[chunking.entryUnit]).toLowerCase(),
                tableUnit: say(TABLE_UNIT[chunking.tableUnit]).toLowerCase(),
              })}
        </div>
      </td>
      <td className="numeric">
        {formatNumber(profile.impact.documents)} <span className="text-muted">· {formatNumber(profile.impact.chunks)}</span>
      </td>
      <td className="wraps text-xs">
        {profile.impact.vectors.length === 0 ? (
          <span className="text-muted">{t("chunking.profiles.noVectors", "None — keyword search only")}</span>
        ) : (
          <ul className={VECTOR_LIST}>
            {profile.impact.vectors.map((vector) => (
              <li key={vector.embeddingProfileId}>
                <strong className="numeric">{formatNumber(vector.vectors)}</strong>{" "}
                {t("chunking.profiles.vectorsOf", "in {profile}, ≈ {tokens} tokens", {
                  profile: vector.embeddingProfileName,
                  tokens: formatNumber(vector.estimatedTokens),
                })}
              </li>
            ))}
            {profile.impact.vectors.length > 1 && (
              <li className="text-muted">{t("chunking.profiles.vectorsTotal", "≈ {tokens} tokens in all", { tokens: formatNumber(tokens) })}</li>
            )}
          </ul>
        )}
      </td>
    </tr>
  );
}
