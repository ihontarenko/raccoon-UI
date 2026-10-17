import { Link, useParams, useSearch } from "@tanstack/react-router";
import { Can } from "../../access/Can";
import { PERMISSIONS } from "../../access/permissions";
import type { ChunkerTab } from "../../application/routeTabs";
import { useReadySession } from "../../application/session";
import { usePageTitle } from "../../application/usePageTitle";
import { useResource } from "../../application/useResource";
import { BLOCK_KIND } from "../../lib/blockKinds";
import { chunkersApi, type ChunkerOverview, LOGICAL_UNITS } from "../../lib/chunkers";
import { useTranslation } from "../../translations/TranslationProvider";
import { DetailList, DetailSection, DetailSurface, DetailTokens, EmptyState, PageHeader, ProblemState, TabPanel, Tabs, Waiting } from "../../ui/components";
import { Badge, Button } from "../../ui/primitives";
import { ChunkPreviewSection } from "./ChunkPreviewSection";
import { ProfileSettings } from "./ChunkProfileSettings";
import { CRUMB_LINK, PARSER_LINKS } from "./chunkingClasses";
import { profilesOf } from "./ChunkingPage";
import { useAddressChange } from "../../application/useAddressChange";
import { ProfileFields } from "../profiles/ProfileQuickSettings";
import { ProfileScopedPanel } from "../profiles/ProfileScopedPanel";
import { TextTransforms } from "../profiles/TextTransforms";
import { LogicalUnitsExample } from "./LogicalUnitsExample";

const SCOPED_HEADING = "m-0 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase";

/**
 * The profile fields a chunker's page edits: the chain it sits in, size and overlap — and, for the logical-unit chunker,
 * every setting that shapes units into chunks.
 */
function chunkPathsOf(chunkerId: string): string[] {
  return chunkerId !== LOGICAL_UNITS
    ? ["preparation.chunking.chunkerIds", "preparation.chunking.maximumCodePoints", "preparation.chunking.overlapCodePoints"]
    : [
        "preparation.chunking.chunkerIds",
        "preparation.chunking.unitMerging",
        "preparation.chunking.maximumCodePoints",
        "preparation.chunking.overlapCodePoints",
        "preparation.chunking.entryUnit",
        "preparation.chunking.tableUnit",
        "preparation.chunking.maximumTableRowsPerFragment",
      ];
}

type TabKey = "settings" | ChunkerTab;

/**
 * One chunker: what it reads boundaries from and which parsers emit those blocks, the processing profiles it cuts for
 * with their settings and what a change would cost, and a preview that stores nothing.
 */
export function ChunkerPage() {
  const { t, say } = useTranslation();
  const { workspace } = useReadySession();
  const workspaceId = workspace?.id ?? "";
  const { chunkerId } = useParams({ strict: false }) as { chunkerId: string };
  const search = useSearch({ strict: false }) as { tab?: ChunkerTab };
  const changeAddress = useAddressChange();
  const tab: TabKey = search.tab ?? "settings";
  const overview = useResource<ChunkerOverview>(() => chunkersApi.overview(workspaceId), [workspaceId]);
  const chunker = overview.status === "ready" ? (overview.data.chunkers.find((candidate) => candidate.identifier === chunkerId) ?? null) : null;
  usePageTitle(chunker?.descriptor.name ?? t("chunking.chunker", "Chunker"));

  const selectTab = (next: TabKey) => {
    void changeAddress({ to: "/chunking/$chunkerId", params: { chunkerId }, search: next === "settings" ? {} : { tab: next } });
  };

  if (overview.status === "loading") {
    return <Waiting label={t("chunking.loadingChunker", "Loading the chunker")} lines={6} />;
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
  if (chunker === null) {
    return (
      <EmptyState
        title={t("chunking.unknown", "No such chunker")}
        description={t("chunking.unknownText", "This installation has no chunker {identifier}.", { identifier: chunkerId })}
        action={
          <Button href="/chunking" variant="quiet">
            {t("chunking.all", "All chunkers")}
          </Button>
        }
      />
    );
  }
  const profiles = profilesOf(chunker, overview.data);

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Link to="/chunking" className={CRUMB_LINK}>{t("chunking.title", "Chunking")}</Link> / {chunker.descriptor.name}
          </>
        }
        title={chunker.descriptor.name}
        status={
          <Badge tone="neutral">
            {chunker.takesEverything
              ? t("chunking.chunker.takesAllLong", "Cuts any document — can end a chain")
              : t("chunking.chunker.passesSomeLong", "Cuts documents with logical units, passes the rest on")}
          </Badge>
        }
        lead={chunker.descriptor.summary}
        actions={
          <Button href="/profiles?kind=processing" icon="model">
            {t("chunking.action.profiles", "Processing profiles")}
          </Button>
        }
      />
      <Tabs<TabKey>
        label={t("chunking.chunker", "Chunker")}
        active={tab}
        onSelect={selectTab}
        items={[
          { key: "settings", label: t("chunking.tab.settings", "Settings") },
          { key: "profiles", label: t("chunking.tab.profiles", "Used by profiles"), count: profiles.length },
          { key: "preview", label: t("chunking.tab.preview", "Preview") },
        ]}
      />
      {tab === "settings" && (
        <TabPanel tabKey="settings">
          <DetailSurface>
            <DetailSection title={t("chunking.section.reads", "What it reads")}>
              <DetailList
                rows={[
                  [
                  t("chunking.fact.boundaries", "Boundaries from"),
                  <DetailTokens values={chunker.descriptor.takes.map((kind) => say(BLOCK_KIND[kind]))} />,
                ],
                  [
                    t("chunking.fact.parsers", "Parsers"),
                    chunker.parsers.length === 0 ? (
                      <span className="text-secondary">{t("chunking.chunker.noParsers", "None installed")}</span>
                    ) : (
                      <span className={PARSER_LINKS}>
                        {chunker.parsers.map((parser) => (
                          <Link key={parser} to="/parsers/$parserId" params={{ parserId: parser }} className="no-underline hover:[&>span]:border-accent">
                            <Badge>{parser}</Badge>
                          </Link>
                        ))}
                      </span>
                    ),
                  ],
                ]}
              />
            </DetailSection>
            {chunker.identifier === LOGICAL_UNITS && (
              <DetailSection title={t("chunking.section.howItCuts", "How it cuts")}>
                <LogicalUnitsExample />
              </DetailSection>
            )}
          </DetailSurface>
          <div className="mt-6">
            <ProfileScopedPanel
              kind="processing"
              profiles={profiles.map((profile) => ({ id: profile.profileId, name: profile.name, enabled: profile.enabled }))}
              storageKey={`raccoon.chunker.${chunker.identifier}.profile`}
              title={t("chunking.scoped.title", "As this profile runs it")}
              paths={chunkPathsOf(chunker.identifier)}
              emptyText={t("chunking.scoped.empty", "No processing profile chunks with it. Add the chunk step to a profile, or choose this strategy in one.")}
            >
              {(draft) => (
                <div className="grid gap-5">
                  <section className="grid gap-2">
                    <h3 className={SCOPED_HEADING}>{t("chunking.scoped.before", "Before chunking — text rewritten for the index")}</h3>
                    {draft.configuration !== null && <TextTransforms configuration={draft.configuration} stages={["BLOCKS"]} />}
                  </section>
                  <section className="grid gap-2">
                    <h3 className={SCOPED_HEADING}>{t("chunking.scoped.chunking", "Chunk settings")}</h3>
                    <ProfileFields draft={draft} kind="processing" paths={chunkPathsOf(chunker.identifier)} />
                  </section>
                </div>
              )}
            </ProfileScopedPanel>
          </div>
        </TabPanel>
      )}
      {tab === "profiles" && (
        <TabPanel tabKey="profiles">
          <ProfileSettings profiles={profiles} truncated={overview.data.profilesTruncated} />
        </TabPanel>
      )}
      {tab === "preview" && (
        <TabPanel tabKey="preview">
          <Can
            permission={PERMISSIONS.documentRead}
            fallback={<p className="text-xs text-muted">{t("chunking.previewNeedsDocuments", "A preview reads a document, which needs permission to read documents.")}</p>}
          >
            <ChunkPreviewSection workspaceId={workspaceId} overview={overview.data} />
          </Can>
        </TabPanel>
      )}
    </>
  );
}
