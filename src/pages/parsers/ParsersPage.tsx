import { useState } from "react";
import { Can } from "../../access/Can";
import { PERMISSIONS } from "../../access/permissions";
import { formatNumber } from "../../application/format";
import { useReadySession } from "../../application/session";
import { usePageTitle } from "../../application/usePageTitle";
import { useResource } from "../../application/useResource";
import { parsersApi, type Parser, type ParserOverview } from "../../lib/parsers";
import { useTranslation } from "../../translations/TranslationProvider";
import {
  DetailTokens,
  EmptyState,
  Facts,
  Inspector,
  InspectorActions,
  InspectorSection,
  ListHead,
  Notice,
  PageHeader,
  ProblemState,
  RowName,
  StackedValues,
  Waiting,
  Workbench,
} from "../../ui/components";
import { Badge, Button, Table } from "../../ui/primitives";
import { ORDER_LIST, ORDER_ROW, PAGE } from "./parsersClasses";

/** How many documents a parser has read in the workspace. */
export function documentsRead(parser: Parser): number {
  return parser.reads.versions;
}

/**
 * The installed parsers as a list: what each reads, whether it can run here and how many processing profiles send
 * documents to it. Open one for its settings and the profiles that use it.
 */
export function ParsersPage() {
  const { t } = useTranslation();
  usePageTitle(t("parsers.title", "Parsers"));
  const { workspace } = useReadySession();
  const workspaceId = workspace?.id ?? "";
  const overview = useResource<ParserOverview>(() => parsersApi.overview(workspaceId), [workspaceId]);

  return (
    <>
      <PageHeader
        eyebrow={t("parsers.eyebrow", "Pipeline")}
        title={t("parsers.title", "Parsers")}
        lead={
          <>
            <p>{t("parsers.lead", "What reads each kind of document, what it puts into keyword entries and vectors, and what it only keeps for reading. Chunks always stay exact slices of what was read; options decide only what is indexed, and live on the processing profiles.")}</p>
            <p>
              {t(
                "parsers.selection.text",
                "A processing profile either sends every document to one parser, or chooses automatically: the first parser in its list that accepts the document's media type — or, failing that, its name's extension — reads it. A document no parser in the list accepts is refused with that reason.",
              )}
            </p>
          </>
        }
        actions={
          <Can permission={PERMISSIONS.automationRead}>
            <Button href="/profiles?kind=processing" icon="model">
              {t("parsers.profiles", "Processing profiles")}
            </Button>
          </Can>
        }
      />
      {overview.status === "loading" && <Waiting label={t("parsers.loading", "Loading the parsers")} lines={8} />}
      {overview.status === "failed" && (
        <ProblemState
          layout="section"
          problem={overview.problem}
          actions={
            <Button icon="refresh" onClick={overview.reload}>
              {t("common.tryAgain", "Try again")}
            </Button>
          }
        />
      )}
      {overview.status === "ready" && <ParserList overview={overview.data} />}
    </>
  );
}

function ParserList({ overview }: { overview: ParserOverview }) {
  const { t, plural } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (overview.parsers.length === 0) {
    return (
      <EmptyState
        title={t("parsers.empty", "No parsers installed")}
        description={t("parsers.emptyText", "This installation has no document parser, so nothing can be processed.")}
      />
    );
  }
  const names = new Map(overview.parsers.map((parser) => [parser.identifier, parser.descriptor.name]));
  const selected = overview.parsers.find((parser) => parser.identifier === selectedId) ?? overview.parsers[0] ?? null;
  return (
    <div className={PAGE}>
      <p className={ORDER_ROW}>
        <span className="text-xs text-muted">{t("parsers.selection.default", "Default automatic order")}</span>
        <span className={ORDER_LIST}>
          {overview.defaultAutomaticOrder.map((identifier, index) => (
            <Badge key={identifier}>
              <span className="numeric">{index + 1}</span> {names.get(identifier) ?? identifier}
            </Badge>
          ))}
        </span>
      </p>
      {overview.profilesTruncated && (
        <Notice tone="information" title={t("parsers.truncated", "Only the first 100 profiles are counted")}>
          {t("parsers.truncatedText", "This workspace has more processing profiles; their use of each parser is not counted here.")}
        </Notice>
      )}
      <Workbench>
        <section aria-label={t("parsers.installed", "Installed parsers")}>
          <ListHead
            title={t("parsers.installed", "Installed parsers")}
            count={plural("parsers.count", overview.parsers.length, { one: "{count} parser", other: "{count} parsers" })}
          />
          <Table>
            <thead>
              <tr>
                <th scope="col">{t("parsers.column.parser", "Parser")}</th>
                <th scope="col">{t("parsers.column.reads", "Reads")}</th>
                <th scope="col">{t("parsers.column.state", "State")}</th>
                <th scope="col" className="numeric">
                  {t("parsers.column.profiles", "Profiles")}
                </th>
              </tr>
            </thead>
            <tbody>
              {overview.parsers.map((parser) => (
                <tr key={parser.identifier} data-selected={parser.identifier === selected?.identifier}>
                  <td>
                    <RowName selected={parser.identifier === selected?.identifier} onSelect={() => setSelectedId(parser.identifier)}>
                      {parser.descriptor.name}
                    </RowName>
                    <div className="text-xs text-muted numeric">{parser.identifier}</div>
                  </td>
                  <td className="wraps">
                    <DetailTokens
                      values={parser.descriptor.extensions.length > 0 ? parser.descriptor.extensions : parser.descriptor.mediaTypes}
                    />
                  </td>
                  <td>
                    {parser.availability.available ? (
                      <Badge tone="allow">{t("parsers.ready", "Ready")}</Badge>
                    ) : (
                      <Badge tone="deny">{t("parsers.cannotRun", "Cannot run here")}</Badge>
                    )}
                  </td>
                  <td className="numeric">{parser.profiles.length}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
        {selected !== null && (
          <Inspector label={t("parsers.selected", "Selected parser")} eyebrow={selected.identifier} title={selected.descriptor.name}>
            <InspectorSection>
              <Facts
                rows={[
                  [
                    t("parsers.fact.options", "Options"),
                    <StackedValues values={selected.descriptor.options.map((option) => option.label)} empty={t("parsers.noOptions", "None")} />,
                  ],
                  [
                    t("parsers.fact.profiles", "Used by"),
                    <StackedValues values={selected.profiles.map((use) => use.name)} empty={t("parsers.unused", "No profile")} />,
                  ],
                  [t("parsers.fact.read", "Versions read"), <span className="numeric">{formatNumber(documentsRead(selected))}</span>],
                ]}
              />
              <InspectorActions>
                <Button variant="primary" icon="arrow" href={`/parsers/${encodeURIComponent(selected.identifier)}`}>
                  {t("parsers.open", "Open parser")}
                </Button>
              </InspectorActions>
            </InspectorSection>
          </Inspector>
        )}
      </Workbench>
    </div>
  );
}
