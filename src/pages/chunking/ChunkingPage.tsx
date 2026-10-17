import { useState } from "react";
import { Can } from "../../access/Can";
import { PERMISSIONS } from "../../access/permissions";
import { useReadySession } from "../../application/session";
import { usePageTitle } from "../../application/usePageTitle";
import { useResource } from "../../application/useResource";
import { BLOCK_KIND } from "../../lib/blockKinds";
import { chunkersApi, type Chunker, type ChunkerOverview } from "../../lib/chunkers";
import { useTranslation } from "../../translations/TranslationProvider";
import {
  DetailTokens,
  EmptyState,
  Facts,
  Inspector,
  InspectorActions,
  InspectorSection,
  ListHead,
  PageHeader,
  ProblemState,
  RowName,
  StackedValues,
  Waiting,
  Workbench,
} from "../../ui/components";
import { Badge, Button, Table } from "../../ui/primitives";

/** The profiles whose chain of chunkers names this one. */
export function profilesOf(chunker: Chunker, overview: ChunkerOverview) {
  return overview.profiles.filter((profile) => profile.chunking?.chunkerIds.includes(chunker.identifier) ?? false);
}

/**
 * The second stage of preparation as a list: parsers hand over typed blocks, and a chunker cuts them into the pieces
 * search finds and vectors are made of. Open a chunker for what it reads, the profiles that use it and a preview.
 */
export function ChunkingPage() {
  const { t } = useTranslation();
  usePageTitle(t("chunking.title", "Chunking"));
  const { workspace } = useReadySession();
  const workspaceId = workspace?.id ?? "";
  const overview = useResource<ChunkerOverview>(() => chunkersApi.overview(workspaceId), [workspaceId]);

  return (
    <>
      <PageHeader
        eyebrow={t("chunking.eyebrow", "Pipeline")}
        title={t("chunking.title", "Chunking")}
        lead={t(
          "chunking.lead",
          "A parser hands over a document as typed blocks — lines and headings, or logical units such as declarations and entries. The chunk step cuts those blocks into chunks: what one search hit shows and one vector is made of. Settings live on the processing profiles; this page explains them, prices a change and previews it.",
        )}
        actions={
          <>
            <Button href="/parsers" icon="chunks">
              {t("chunking.action.parsers", "Parsers")}
            </Button>
            <Can permission={PERMISSIONS.automationRead}>
              <Button href="/profiles?kind=processing" icon="model">
                {t("chunking.action.profiles", "Processing profiles")}
              </Button>
            </Can>
          </>
        }
      />
      {overview.status === "loading" && <Waiting label={t("chunking.loading", "Loading the chunkers")} lines={8} />}
      {overview.status === "failed" && (
        <ProblemState
          layout="section"
          problem={overview.problem}
          actions={
            <Button icon="refresh" onClick={overview.reload}>
              {t("chunking.retry", "Try again")}
            </Button>
          }
        />
      )}
      {overview.status === "ready" && <ChunkerList overview={overview.data} />}
    </>
  );
}

function ChunkerList({ overview }: { overview: ChunkerOverview }) {
  const { t, say, plural } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (overview.chunkers.length === 0) {
    return <EmptyState title={t("chunking.empty", "No chunkers installed")} description={t("chunking.emptyText", "Nothing can be cut into chunks.")} />;
  }
  const selected = overview.chunkers.find((chunker) => chunker.identifier === selectedId) ?? overview.chunkers[0] ?? null;
  const roleOf = (chunker: Chunker) =>
    chunker.takesEverything
      ? t("chunking.role.window", "Cuts any document into windows; it can end a chain.")
      : t("chunking.role.passes", "Cuts the documents it accepts and passes the rest to the next chunker of the chain.");
  return (
    <Workbench>
      <section aria-label={t("chunking.chunkers.label", "Installed chunkers")}>
        <ListHead
          title={t("chunking.chunkers.heading", "Chunkers")}
          count={plural("chunking.count", overview.chunkers.length, { one: "{count} chunker", other: "{count} chunkers" })}
        />
        <Table>
          <thead>
            <tr>
              <th scope="col">{t("chunking.column.chunker", "Chunker")}</th>
              <th scope="col">{t("chunking.column.chosen", "Chosen")}</th>
              <th scope="col">{t("chunking.column.reads", "Reads boundaries from")}</th>
              <th scope="col" className="numeric">
                {t("chunking.column.profiles", "Profiles")}
              </th>
            </tr>
          </thead>
          <tbody>
            {overview.chunkers.map((chunker) => (
              <tr key={chunker.identifier} data-selected={chunker.identifier === selected?.identifier}>
                <td>
                  <RowName selected={chunker.identifier === selected?.identifier} onSelect={() => setSelectedId(chunker.identifier)}>
                    {chunker.descriptor.name}
                  </RowName>
                  <div className="text-xs text-muted numeric">{chunker.identifier}</div>
                </td>
                <td>
                  <Badge tone="neutral">
                    {chunker.takesEverything ? t("chunking.chunker.takesAll", "Takes everything") : t("chunking.chunker.passesSome", "Passes some on")}
                  </Badge>
                </td>
                <td className="wraps">
                  <DetailTokens values={chunker.descriptor.takes.map((kind) => say(BLOCK_KIND[kind]))} />
                </td>
                <td className="numeric">{profilesOf(chunker, overview).length}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>
      {selected !== null && (
        <Inspector label={t("chunking.selected", "Selected chunker")} eyebrow={selected.identifier} title={selected.descriptor.name}>
          <InspectorSection>
            <p className="text-xs text-secondary">{roleOf(selected)}</p>
            <Facts
              rows={[
                [
                  t("chunking.fact.fromParsers", "From parsers"),
                  <StackedValues values={selected.parsers} empty={t("chunking.chunker.noParsers", "None installed")} />,
                ],
                [
                  t("chunking.fact.profiles", "Used by"),
                  <StackedValues values={profilesOf(selected, overview).map((profile) => profile.name)} empty={t("chunking.unused", "No profile")} />,
                ],
              ]}
            />
            <InspectorActions>
              <Button variant="primary" icon="arrow" href={`/chunking/${encodeURIComponent(selected.identifier)}`}>
                {t("chunking.open", "Open chunker")}
              </Button>
            </InspectorActions>
          </InspectorSection>
        </Inspector>
      )}
    </Workbench>
  );
}
