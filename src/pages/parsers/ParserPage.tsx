import { Link, useParams, useSearch } from "@tanstack/react-router";
import { ProfileScopedPanel } from "../profiles/ProfileScopedPanel";
import { ParserSettingsSection } from "../profiles/ParserSettingsSection";
import { formatDateTime, formatNumber } from "../../application/format";
import type { ParserTab } from "../../application/routeTabs";
import { useReadySession } from "../../application/session";
import { usePageTitle } from "../../application/usePageTitle";
import { useResource } from "../../application/useResource";
import { BLOCK_KIND } from "../../lib/blockKinds";
import { describeOptionValue, isDefaultValue, parsersApi, type Parser, type ParserOverview } from "../../lib/parsers";
import { useTranslation } from "../../translations/TranslationProvider";
import {
  DetailList,
  DetailSection,
  DetailSurface,
  DetailTokens,
  EmptyState,
  Notice,
  PageHeader,
  ProblemState,
  RowLink,
  TabPanel,
  Tabs,
  Waiting,
  Workbench,
} from "../../ui/components";
import { Badge, Button, Table } from "../../ui/primitives";
import { CRUMB_LINK, DETAIL, OPTION_VALUES } from "./parsersClasses";
import { documentsRead } from "./ParsersPage";
import { useAddressChange } from "../../application/useAddressChange";

type TabKey = "settings" | ParserTab;

/**
 * One parser: what it reads, hands the chunk step, indexes and keeps for reading, its options and their defaults —
 * and the processing profiles that send documents to it, at which settings revision and with which options in force.
 * Options are changed on the profile, never here.
 */
export function ParserPage() {
  const { t } = useTranslation();
  const { workspace } = useReadySession();
  const workspaceId = workspace?.id ?? "";
  const { parserId } = useParams({ strict: false }) as { parserId: string };
  const search = useSearch({ strict: false }) as { tab?: ParserTab };
  const changeAddress = useAddressChange();
  const tab: TabKey = search.tab ?? "settings";
  const overview = useResource<ParserOverview>(() => parsersApi.overview(workspaceId), [workspaceId]);
  const parser = overview.status === "ready" ? (overview.data.parsers.find((candidate) => candidate.identifier === parserId) ?? null) : null;
  usePageTitle(parser?.descriptor.name ?? t("parsers.parser", "Parser"));

  const selectTab = (next: TabKey) => {
    void changeAddress({ to: "/parsers/$parserId", params: { parserId }, search: next === "settings" ? {} : { tab: next } });
  };

  if (overview.status === "loading") {
    return <Waiting label={t("parsers.loadingParser", "Loading the parser")} lines={6} />;
  }
  if (overview.status === "failed") {
    return (
      <ProblemState
        problem={overview.problem}
        actions={
          <Button icon="refresh" variant="primary" onClick={overview.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }
  if (parser === null) {
    return (
      <EmptyState
        title={t("parsers.unknown", "No such parser")}
        description={t("parsers.unknownText", "This installation has no parser {identifier}.", { identifier: parserId })}
        action={
          <Button href="/parsers" variant="quiet">
            {t("parsers.all", "All parsers")}
          </Button>
        }
      />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Link to="/parsers" className={CRUMB_LINK}>{t("parsers.title", "Parsers")}</Link> / {parser.descriptor.name}
          </>
        }
        title={parser.descriptor.name}
        status={
          parser.availability.available ? (
            <Badge tone="allow">{t("parsers.ready", "Ready")}</Badge>
          ) : (
            <Badge tone="deny">{t("parsers.cannotRun", "Cannot run here")}</Badge>
          )
        }
        lead={parser.descriptor.summary}
        actions={
          <Button href="/profiles?kind=processing" icon="model">
            {t("parsers.profiles", "Processing profiles")}
          </Button>
        }
      />
      <Tabs<TabKey>
        label={t("parsers.parser", "Parser")}
        active={tab}
        onSelect={selectTab}
        items={[
          { key: "settings", label: t("parsers.tab.settings", "Settings") },
          { key: "profiles", label: t("parsers.tab.profiles", "Used by profiles"), count: parser.profiles.length },
        ]}
      />
      {tab === "settings" && (
        <TabPanel tabKey="settings">
          <ParserSettings parser={parser} />
          <div className="mt-6">
            <ProfileScopedPanel
              kind="processing"
              profiles={parser.profiles.map((profile) => ({ id: profile.profileId, name: profile.name, enabled: profile.enabled }))}
              storageKey={`raccoon.parser.${parser.identifier}.profile`}
              title={t("parsers.scoped.title", "As this profile runs it")}
              paths={[]}
              emptyText={t("parsers.noProfilesText", "A profile sends documents here by naming it, or by listing it in its automatic order.")}
            >
              {(draft) =>
                draft.configuration !== null && (
                  <ParserSettingsSection
                    workspaceId={workspaceId}
                    configuration={draft.configuration}
                    onChange={draft.change}
                    disabled={!draft.mayEdit || draft.saving}
                    onlyParser={parser.identifier}
                  />
                )
              }
            </ProfileScopedPanel>
          </div>
        </TabPanel>
      )}
      {tab === "profiles" && (
        <TabPanel tabKey="profiles">
          <ParserProfiles parser={parser} />
        </TabPanel>
      )}
    </>
  );
}

function ParserSettings({ parser }: { parser: Parser }) {
  const { t, say } = useTranslation();
  const { descriptor, availability } = parser;
  const latest = parser.reads.latest;
  return (
    <div className={DETAIL}>
      {!availability.available && (
        <Notice tone="error" title={t("parsers.notInstalled", "Not installed on this machine")}>
          {availability.detail}
        </Notice>
      )}
      <DetailSurface>
        <DetailSection title={t("parsers.section.reads", "What it reads")}>
          <DetailList
            rows={[
              [t("parsers.fact.mediaTypes", "Media types"), descriptor.mediaTypes.length === 0 ? "—" : <DetailTokens values={descriptor.mediaTypes} />],
              [t("parsers.fact.extensions", "Extensions"), descriptor.extensions.length === 0 ? "—" : <DetailTokens values={descriptor.extensions} />],
              [t("parsers.fact.handsOn", "Hands on"), descriptor.blockKinds.map((kind) => say(BLOCK_KIND[kind])).join(", ")],
            ]}
          />
        </DetailSection>
        <DetailSection title={t("parsers.section.index", "What is indexed")}>
          <DetailList
            rows={[
              [t("parsers.fact.indexed", "Indexed"), descriptor.indexed],
              [
                t("parsers.fact.kept", "Kept for reading only"),
                descriptor.keptForReading === "" ? (
                  <span className="text-secondary">{t("parsers.keptNothing", "Nothing — every part it reads is indexed.")}</span>
                ) : (
                  descriptor.keptForReading
                ),
              ],
            ]}
          />
        </DetailSection>
        <DetailSection title={t("parsers.options", "Options")}>
          {descriptor.options.length === 0 ? (
            <p className="text-secondary">{t("parsers.noOptionsLine", "None — it reads the same way under every profile.")}</p>
          ) : (
            <DetailList
              rows={descriptor.options.map((option) => [
                option.label,
                <>
                  <span>
                    {t("parsers.optionDefault", "default {value}", { value: describeOptionValue(option.defaultValue) })}
                    {option.minimum !== null && option.maximum !== null && (
                      <span className="text-secondary numeric"> · {option.minimum}–{option.maximum}</span>
                    )}
                  </span>
                  <span className="text-xs text-secondary">{option.description}</span>
                </>,
              ])}
            />
          )}
        </DetailSection>
        <DetailSection title={t("parsers.section.workspace", "In this workspace")}>
          <DetailList
            rows={[
              [
                t("parsers.fact.read", "Versions read"),
                <span>
                  <span className="numeric">{formatNumber(documentsRead(parser))}</span>
                  {latest !== null && <span className="text-secondary"> · {t("parsers.readLatestAt", "latest {time}", { time: formatDateTime(latest) })}</span>}
                </span>,
              ],
              [t("parsers.fact.profiles", "Used by"), parser.profiles.length === 0 ? t("parsers.unused", "No profile") : parser.profiles.map((use) => use.name).join(", ")],
            ]}
          />
        </DetailSection>
      </DetailSurface>
    </div>
  );
}

function ParserProfiles({ parser }: { parser: Parser }) {
  const { t } = useTranslation();
  const { descriptor } = parser;
  if (parser.profiles.length === 0) {
    return (
      <EmptyState
        title={t("parsers.noProfiles", "No processing profile uses it")}
        description={t("parsers.noProfilesText", "A profile sends documents here by naming it, or by listing it in its automatic order.")}
      />
    );
  }
  return (
    <Workbench>
      <Table>
        <thead>
          <tr>
            <th scope="col">{t("parsers.column.profile", "Profile")}</th>
            {descriptor.options.length > 0 && <th scope="col">{t("parsers.column.changedOptions", "Options changed from the default")}</th>}
          </tr>
        </thead>
        <tbody>
          {parser.profiles.map((use) => {
            const changed = descriptor.options.filter((option) => !isDefaultValue(option, use.options[option.name]));
            return (
              <tr key={use.profileId}>
                <td>
                  <RowLink href={`/profiles/processing/${use.profileId}`}>{use.name}</RowLink>
                  {!use.enabled && (
                    <>
                      {" "}
                      <Badge tone="deny">{t("parsers.disabled", "Disabled")}</Badge>
                    </>
                  )}
                  <div className="text-xs text-muted">
                    {t("parsers.settingsRevision", "Settings revision {revision}", { revision: use.revision })} ·{" "}
                    {use.automaticPosition === null
                      ? t("parsers.everyDocument", "Every document")
                      : t("parsers.automaticChoice", "Automatic, choice {position}", { position: use.automaticPosition })}
                  </div>
                </td>
                {descriptor.options.length > 0 && (
                  <td className="wraps text-xs">
                    {changed.length === 0 ? (
                      <span className="text-muted">{t("parsers.allDefaults", "All defaults")}</span>
                    ) : (
                      <ul className={OPTION_VALUES}>
                        {changed.map((option) => (
                          <li key={option.name}>
                            {option.label}: <strong>{describeOptionValue(use.options[option.name])}</strong>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Workbench>
  );
}
