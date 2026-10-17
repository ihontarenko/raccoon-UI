import { useSearch } from "@tanstack/react-router";
import { useMemo } from "react";
import type { IndexTab } from "../../application/routeTabs";
import { formatBytes, formatNumber } from "../../application/format";
import { useReadySession } from "../../application/session";
import { usePageTitle } from "../../application/usePageTitle";
import { useResource } from "../../application/useResource";
import { api, collectAllPages } from "../../lib/api";
import { indexOverviewApi } from "../../lib/indexOverview";
import { pipelineApi } from "../../lib/pipeline";
import { declareText, type DeclaredText } from "../../translations/translate";
import { useTranslation } from "../../translations/TranslationProvider";
import { PageHeader, Statistics, TabPanel, Tabs } from "../../ui/components";
import { Button } from "../../ui/primitives";
import { EmbeddingJournalTab } from "./EmbeddingJournalTab";
import { EntriesAdministrationTab } from "./EntriesAdministrationTab";
import { IndexChain } from "./IndexChain";
import { IndexedDocumentsTab } from "./IndexedDocumentsTab";
import { KeywordGenerationsTab } from "./KeywordGenerationsTab";
import { PreflightsTab } from "./PreflightsTab";
import { VectorGenerationsTab } from "./VectorGenerationsTab";
import { PAGE, TAB_LEAD_LINE, TOTALS } from "./indexingClasses";
import { useAddressChange } from "../../application/useAddressChange";

/** What each tab is for, in one line — said under the tab strip, so a tab is never just a name. */
const TAB_LEAD: Record<IndexTab, DeclaredText> = {
  documents: declareText(
    "index.lead.documents",
    "Every document and how far it got. Open one to see its chunks, its entries and its vectors side by side.",
  ),
  entries: declareText(
    "index.lead.entries",
    "Entries people wrote: new ones, and replacements written over a chunk. Entries made from documents are one filter away.",
  ),
  history: declareText(
    "index.lead.history",
    "Every processing run's keyword entries, newest first. Only one per document is published — the one search reads.",
  ),
  vectors: declareText(
    "index.lead.vectors",
    "Each vector generation embedded published entries with one AI model. Search reads the published one for its model.",
  ),
  preflights: declareText(
    "index.lead.preflights",
    "What vectorising would cost — tokens and money — worked out before any model is called.",
  ),
  journal: declareText("index.lead.journal", "Every step of every forecast and vectorisation, with the scripts that ran on it."),
};

/**
 * The index of the workspace as a chain: documents are cut into chunks, each chunk becomes one keyword
 * entry, publishing makes the entries searchable, and vectors are embedded from published entries. The
 * strip shows how far everything got; each tab is the detail of one link of the chain.
 */
export function IndexPage() {
  const { t, say } = useTranslation();
  usePageTitle(t("index.title", "Index"));
  const { workspace } = useReadySession();
  const workspaceId = workspace?.id ?? "";
  const search = useSearch({ strict: false }) as { tab?: IndexTab; vector?: string };
  const changeAddress = useAddressChange();
  const tab: IndexTab = search.tab ?? "documents";

  const chain = useResource(() => indexOverviewApi.chain(workspaceId), [workspaceId]);
  const statistics = useResource(
    () => Promise.all([pipelineApi.indexStatistics(workspaceId), pipelineApi.vectorStatistics(workspaceId)]),
    [workspaceId],
  );
  const documents = useResource(() => collectAllPages((page) => api.listDocuments(workspaceId, page)), [workspaceId]);
  const titles = useMemo(
    () => new Map(documents.status === "ready" ? documents.data.map((document) => [document.id, document.title]) : []),
    [documents],
  );

  const refresh = () => {
    chain.reload();
    statistics.reload();
  };

  const select = (next: IndexTab, vector?: string) => {
    void changeAddress({ to: "/index", search: { tab: next === "documents" ? undefined : next, vector } });
  };

  return (
    <>
      <PageHeader
        eyebrow={t("index.eyebrow", "Pipeline")}
        title={t("index.title", "Index")}
        lead={t("index.lead", "What search can read, and how each document got there.")}
        actions={
          <Button variant="quiet" icon="refresh" onClick={refresh}>
            {t("index.refresh", "Refresh")}
          </Button>
        }
      />
      <div className={PAGE}>
        <IndexChain chain={chain.status === "ready" ? chain.data : null} />

        <details className={TOTALS}>
          <summary>{t("index.totals.summary", "Every count, including what search does not read")}</summary>
          <Statistics
            label={t("index.totals", "Totals")}
            loading={statistics.status !== "ready"}
            items={
              statistics.status === "ready"
                ? [
                    { label: t("index.totals.runs", "Processing runs"), value: formatNumber(statistics.data[0].generations) },
                    { label: t("index.totals.chunks", "Chunks, all runs"), value: formatNumber(statistics.data[0].chunks) },
                    { label: t("index.totals.entries", "Entries, all runs"), value: formatNumber(statistics.data[0].entries) },
                    { label: t("index.totals.removed", "Out of search"), value: formatNumber(statistics.data[0].removedEntries) },
                    {
                      label: t("index.totals.text", "Indexed text"),
                      value: t("index.totals.characters", "{count} characters", {
                        count: formatNumber(statistics.data[0].textCharacters),
                      }),
                    },
                    {
                      label: t("index.totals.vectorGenerations", "Vector generations"),
                      value: t("index.totals.publishedOf", "{published} of {total} published", {
                        published: formatNumber(statistics.data[1].publishedGenerations),
                        total: formatNumber(statistics.data[1].generations),
                      }),
                    },
                    { label: t("index.totals.vectors", "Vectors, all generations"), value: formatNumber(statistics.data[1].records) },
                    {
                      label: t("index.totals.calls", "Model calls"),
                      value:
                        statistics.data[1].unresolvedCalls > 0
                          ? t("index.totals.callsUnresolved", "{calls} · {unresolved} unresolved", {
                              calls: formatNumber(statistics.data[1].calls),
                              unresolved: formatNumber(statistics.data[1].unresolvedCalls),
                            })
                          : formatNumber(statistics.data[1].calls),
                      tone: statistics.data[1].unresolvedCalls > 0 ? "warn" : undefined,
                    },
                    {
                      label: t("index.totals.storage", "Vector storage"),
                      value: formatBytes(statistics.data[1].cachedVectorBytes + statistics.data[1].manualVectorBytes),
                    },
                  ]
                : []
            }
          />
        </details>

        <div>
          <Tabs<IndexTab>
            label={t("index.title", "Index")}
            active={tab}
            onSelect={(next) => {
              select(next);
            }}
            items={[
              { key: "documents", label: t("index.tab.documents", "Documents") },
              { key: "entries", label: t("index.tab.entries", "Written entries") },
              { key: "history", label: t("index.totals.runs", "Processing runs") },
              { key: "vectors", label: t("index.totals.vectorGenerations", "Vector generations") },
              { key: "preflights", label: t("index.tab.preflights", "Cost forecasts") },
              { key: "journal", label: t("index.tab.journal", "Embedding journal") },
            ]}
          />
          <TabPanel tabKey={tab}>
            <p className={TAB_LEAD_LINE}>{say(TAB_LEAD[tab])}</p>
            {tab === "documents" && <IndexedDocumentsTab workspaceId={workspaceId} onChanged={refresh} />}
            {tab === "entries" && <EntriesAdministrationTab workspaceId={workspaceId} titles={titles} onChanged={refresh} />}
            {tab === "history" && <KeywordGenerationsTab workspaceId={workspaceId} titles={titles} onChanged={refresh} />}
            {tab === "vectors" && (
              <VectorGenerationsTab
                workspaceId={workspaceId}
                titles={titles}
                selectedId={search.vector ?? null}
                onSelect={(jobId) => {
                  select("vectors", jobId ?? undefined);
                }}
                onChanged={refresh}
              />
            )}
            {tab === "preflights" && <PreflightsTab workspaceId={workspaceId} />}
            {tab === "journal" && <EmbeddingJournalTab workspaceId={workspaceId} />}
          </TabPanel>
        </div>
      </div>
    </>
  );
}
