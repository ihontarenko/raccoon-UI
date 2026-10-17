import { Link, useSearch } from "@tanstack/react-router";
import { Can } from "../../access/Can";
import { PERMISSIONS } from "../../access/permissions";
import { useReadySession } from "../../application/session";
import { usePageTitle } from "../../application/usePageTitle";
import { useResource } from "../../application/useResource";
import { PROFILE_KINDS, isProfileKind, type Profile, type ProfileKind, type ProfileKindDescription } from "../../lib/profiles";
import { useTranslation } from "../../translations/TranslationProvider";
import { declareText, type DeclaredText } from "../../translations/translate";
import { DetailTokens, EmptyState, PageHeader, ProblemState, Tabs, TabPanel, Waiting } from "../../ui/components";
import { Button, Table } from "../../ui/primitives";
import { ProfileConnections, VerdictBadge } from "./ProfileConnections";
import { summariseParts } from "./profileRules";
import {
  answerWriter,
  embeddingOfSearch,
  embeddingSource,
  findProfile,
  findProvider,
  loadProfileWiring,
  searchMode,
  stateOf,
  usedBy,
  usesVectors,
  vectorsVerdict,
  type ProfileWiring,
} from "./profileWiring";
import { CELL_STACK, DECIDES, PROBLEM, PROFILE_LINK, TABLE_SURFACE } from "./profilesClasses";
import { useAddressChange } from "../../application/useAddressChange";

type ProfilesTab = "connections" | ProfileKind;

/**
 * The settings every stage runs with: first how the profiles connect into working stacks, then every
 * profile of each kind — what it is set to, what it connects to, what uses it, and whether it works.
 */
export function ProfilesPage() {
  const { t, say } = useTranslation();
  usePageTitle(t("profiles.title", "Profiles"));
  const { workspace } = useReadySession();
  const workspaceId = workspace?.id ?? "";
  const search = useSearch({ strict: false }) as { kind?: string };
  const changeAddress = useAddressChange();
  const tab: ProfilesTab = isProfileKind(search.kind) ? search.kind : "connections";
  const description = tab === "connections" ? null : (PROFILE_KINDS.find((candidate) => candidate.kind === tab) ?? null);

  const wiring = useResource(() => loadProfileWiring(workspaceId), [workspaceId]);

  return (
    <>
      <PageHeader
        eyebrow={t("profiles.eyebrow", "Pipeline")}
        title={t("profiles.title", "Profiles")}
        lead={t(
          "profiles.lead",
          "The settings each stage runs with, and how they connect. Saving writes a new revision; work already started keeps the revision it froze.",
        )}
        actions={
          description !== null && (
            <Can permission={PERMISSIONS.automationManage}>
              <Button variant="primary" icon="plus" href={`/profiles/${description.kind}/new`}>
                {say(description.newProfile)}
              </Button>
            </Can>
          )
        }
      />
      <Tabs<ProfilesTab>
        label={t("profiles.title", "Profiles")}
        active={tab}
        onSelect={(next) => {
          void changeAddress({ to: "/profiles", search: { kind: next === "connections" ? undefined : next } });
        }}
        items={[
          { key: "connections", label: t("profiles.tab.connections", "How they connect") },
          ...PROFILE_KINDS.map((candidate) => ({
            key: candidate.kind,
            label: say(candidate.name),
            count: wiring.status === "ready" ? wiring.data.profiles[candidate.kind].length : undefined,
          })),
        ]}
      />
      <TabPanel tabKey={tab}>
        {wiring.status === "loading" && <Waiting label={t("profiles.loading", "Loading profiles")} lines={5} />}
        {wiring.status === "failed" && (
          <ProblemState
            layout="section"
            problem={wiring.problem}
            actions={
              <Button icon="refresh" onClick={wiring.reload}>
                {t("common.tryAgain", "Try again")}
              </Button>
            }
          />
        )}
        {wiring.status === "ready" &&
          (description === null ? (
            <ProfileConnections wiring={wiring.data} />
          ) : (
            <KindList wiring={wiring.data} description={description} />
          ))}
      </TabPanel>
    </>
  );
}

function KindList({ wiring, description }: { wiring: ProfileWiring; description: ProfileKindDescription }) {
  const { t, say } = useTranslation();
  const kind = description.kind;
  const decides = say(description.decision);
  const profiles = wiring.profiles[kind];
  const connects = kind !== "processing" && kind !== "read";
  const used = kind !== "processing" && kind !== "answer";

  return (
    <>
      <p className={DECIDES}>{decides}</p>
      {profiles.length === 0 ? (
        <EmptyState
          title={say(description.noProfile)}
          description={decides}
          action={
            <Can permission={PERMISSIONS.automationManage}>
              <Button icon="plus" href={`/profiles/${kind}/new`}>
                {say(description.newProfile)}
              </Button>
            </Can>
          }
        />
      ) : (
        <div className={TABLE_SURFACE}>
          <Table>
            <thead>
              <tr>
                <th scope="col">{t("profiles.list.profile", "Profile")}</th>
                <th scope="col">{t("profiles.list.setTo", "Set to")}</th>
                {connects && <th scope="col">{t("profiles.list.connectsTo", "Connects to")}</th>}
                {used && <th scope="col">{t("profiles.list.usedBy", "Used by")}</th>}
                <th scope="col" className="numeric">
                  {t("profiles.list.revision", "Revision")}
                </th>
                <th scope="col">{t("profiles.list.state", "State")}</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => {
                const state = stateOf(wiring, kind, profile);
                const users = usedBy(wiring, kind, profile.id);
                return (
                  <tr key={profile.id}>
                    <td>
                      <Link to="/profiles/$kind/$profileId" params={{ kind, profileId: profile.id }} className={PROFILE_LINK}>
                        {profile.name}
                      </Link>
                    </td>
                    <td className="wraps">
                      <DetailTokens values={summariseParts(kind, profile.configuration)} />
                    </td>
                    {connects && <td className="wraps">{<ConnectsTo wiring={wiring} kind={kind} profile={profile} />}</td>}
                    {used && (
                      <td className="text-xs wraps">
                        {users.length === 0 ? (
                          <span className="text-muted">{t("profiles.list.nothing", "Nothing")}</span>
                        ) : (
                          users.map((user, index) => (
                            <span key={user.profile.id}>
                              {index > 0 && ", "}
                              <Link to="/profiles/$kind/$profileId" params={{ kind: user.kind, profileId: user.profile.id }} className={PROFILE_LINK}>
                                {user.profile.name}
                              </Link>
                            </span>
                          ))
                        )}
                      </td>
                    )}
                    <td className="numeric">{profile.revision}</td>
                    <td className="wraps">
                      <VerdictBadge verdict={state.verdict} />
                      {state.problems.map((problem) => (
                        <div key={problem} className={PROBLEM}>
                          {problem}
                        </div>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}
    </>
  );
}

/** What a profile names: a provider and model, another profile, or both. */
function ConnectsTo({ wiring, kind, profile }: { wiring: ProfileWiring; kind: ProfileKind; profile: Profile }) {
  const { t, say } = useTranslation();
  const configuration = profile.configuration;
  const reference = (otherKind: ProfileKind, profileId: unknown) => {
    const other = findProfile(wiring, otherKind, typeof profileId === "string" ? profileId : null);
    return other === null ? (
      <span className={PROBLEM}>{say(MISSING_PROFILE[otherKind])}</span>
    ) : (
      <Link to="/profiles/$kind/$profileId" params={{ kind: otherKind, profileId: other.id }} className={PROFILE_LINK}>
        {other.name}
      </Link>
    );
  };

  if (kind === "embedding") {
    return (
      <div className={CELL_STACK}>
        <span className="text-xs">{embeddingSource(wiring, profile)}</span>
        <VerdictBadge verdict={vectorsVerdict(wiring, profile)} />
      </div>
    );
  }
  if (kind === "search") {
    const embedding = usesVectors(profile) ? embeddingOfSearch(wiring, profile) : null;
    return (
      <div className={CELL_STACK}>
        <span className="text-xs">{searchMode(profile)}</span>
        {usesVectors(profile) && (
          <span className="text-xs">
            {t("profiles.list.vectorsFrom", "vectors from {profile}", { profile: reference("embedding", embedding?.id ?? null) })}
          </span>
        )}
      </div>
    );
  }
  if (kind === "context") {
    return (
      <span className="text-xs">
        {t("profiles.list.readsWith", "reads with {profile}", { profile: reference("read", configuration.readProfileId) })}
      </span>
    );
  }
  if (kind === "answer") {
    const chatId = typeof configuration.providerConfigurationId === "string" ? configuration.providerConfigurationId : null;
    const chat = findProvider(wiring, chatId);
    return (
      <div className={CELL_STACK}>
        <span className="text-xs">
          {t("profiles.list.searchAndContext", "searches with {search} · context from {context}", {
            search: reference("search", configuration.searchProfileId),
            context: reference("context", configuration.contextProfileId),
          })}
        </span>
        <span className="text-xs text-secondary">
          {chat === null && chatId !== null
            ? t("profiles.list.chatHidden", "chat provider not visible")
            : answerWriter(wiring, profile)}
        </span>
      </div>
    );
  }
  return null;
}

/** "missing search profile" — one sentence per kind a profile may name. */
const MISSING_PROFILE: Record<ProfileKind, DeclaredText> = {
  processing: declareText("profiles.list.missing.processing", "missing processing profile"),
  embedding: declareText("profiles.list.missing.embedding", "missing embedding profile"),
  search: declareText("profiles.list.missing.search", "missing search profile"),
  read: declareText("profiles.list.missing.read", "missing read profile"),
  context: declareText("profiles.list.missing.context", "missing context profile"),
  answer: declareText("profiles.list.missing.answer", "missing answer profile"),
};
