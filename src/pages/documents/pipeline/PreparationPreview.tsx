import { useState } from "react";
import type { ProcessingPreview, PreviewSample } from "../../../lib/pipeline";
import type { GraphPreview } from "../../../lib/graph";
import { useTranslation } from "../../../translations/TranslationProvider";
import { Tabs, TabPanel } from "../../../ui/components";
import { Badge, Table } from "../../../ui/primitives";
import { GraphEvidenceTable } from "../../indexing/GraphEvidenceTable";

export function SampleNotice({ sample }: { sample: PreviewSample<unknown> }) {
  const { t } = useTranslation();
  return (
    <p className="text-xs text-secondary" role="status">
      {t("preparation.sample", "Showing {shown} of {total}", {
        shown: sample.items.length,
        total: sample.total,
      })}
      {sample.truncated
        ? ` · ${t("preparation.boundedSample", "Sample limited by response size")}`
        : ""}
    </p>
  );
}

export function GraphPreviewView({ result }: { result: GraphPreview }) {
  const { t } = useTranslation();
  return (
    <div className="grid min-w-0 gap-3">
      <p className="text-sm">
        {t(
          "preparation.graphCounts",
          "{entities} entities · {relations} relations · {resolved} resolved · {ambiguous} ambiguous · {unresolved} unresolved",
          {
            entities: result.definitions.total,
            relations: result.edges.total,
            resolved: result.resolved,
            ambiguous: result.ambiguous,
            unresolved: result.unresolved,
          },
        )}
      </p>
      <SampleNotice sample={result.definitions} />
      {result.definitions.items.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <th scope="col">{t("graph.entity", "Entity")}</th>
                <th scope="col">{t("graph.kind", "Kind")}</th>
              </tr>
            </thead>
            <tbody>
              {result.definitions.items.map((entity) => (
                <tr key={entity.id}>
                  <td className="break-all">{entity.qualifiedName || entity.name}</td>
                  <td>{entity.kind}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
      <SampleNotice sample={result.edges} />
      {result.edges.items.length > 0 && (
        <GraphEvidenceTable edges={result.edges.items} titles={new Map()} />
      )}
    </div>
  );
}

/** The result belongs to the current form, and is discarded as soon as any input changes. */
export function PreparationPreview({ result }: { result: ProcessingPreview }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState("text");
  return (
    <section
      className="grid min-w-0 gap-4 border-t border-line pt-5"
      aria-label={t("preparation.preview", "Preview before saving")}
    >
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-semibold">{t("preparation.preview", "Preview before saving")}</h3>
        <Badge tone="neutral">{t("preparation.unsaved", "Not saved")}</Badge>
      </div>
      <p className="text-sm text-secondary">
        {t(
          "preparation.previewSummary",
          "{parser} · {characters} characters · {blocks} blocks. Current rules and scripts applied; external lifecycle listeners are skipped.",
          { parser: result.parserId, characters: result.characters, blocks: result.blocks },
        )}
      </p>
      <Tabs
        label={t("preparation.outputs", "Prepared outputs")}
        active={tab}
        onSelect={setTab}
        items={[
          { key: "text", label: t("documents.tab.text", "Parsed text") },
          ...(result.preparation.steps.includes("chunk")
            ? [
                {
                  key: "chunks",
                  label: t("documents.tab.chunks", "Chunks"),
                  count: result.chunks.total,
                },
              ]
            : []),
          ...(result.preparation.steps.includes("lexical")
            ? [
                {
                  key: "lexical",
                  label: t("preparation.lexical", "Lexical index"),
                  count: result.lexical.total,
                },
              ]
            : []),
          ...(result.graph !== null
            ? [
                {
                  key: "graph",
                  label: t("preparation.relations", "Relations"),
                  count: result.graph.edges.total,
                },
              ]
            : []),
        ]}
      />
      <TabPanel tabKey={tab}>
        {tab === "text" && (
          <>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-sm">
              {result.text}
            </pre>
            {result.textTruncated && (
              <p>
                {t(
                  "preparation.textTruncated",
                  "The text sample is shortened. Counts cover the whole result.",
                )}
              </p>
            )}
          </>
        )}
        {tab === "chunks" && (
          <div className="grid gap-3">
            <SampleNotice sample={result.chunks} />
            {result.chunks.items.map((chunk) => (
              <details key={chunk.number} className="border-b border-line pb-3">
                <summary className="cursor-pointer text-sm font-semibold">
                  {t("documents.chunks.number", "Chunk {number}", { number: chunk.number })} ·{" "}
                  {chunk.startLine}–{chunk.endLine}
                </summary>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-sm">
                  {chunk.text}
                </pre>
                {chunk.indexedText !== chunk.text && (
                  <>
                    <p className="text-xs text-secondary">
                      {t("preparation.indexedText", "Text prepared for indexing")}
                    </p>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-sm">
                      {chunk.indexedText}
                    </pre>
                  </>
                )}
              </details>
            ))}
          </div>
        )}
        {tab === "lexical" && (
          <div className="grid gap-3">
            <SampleNotice sample={result.lexical} />
            {result.lexical.items.map((entry) => (
              <details key={entry.chunkNumber} className="border-b border-line pb-3">
                <summary className="cursor-pointer text-sm font-semibold">
                  {t("documents.chunks.number", "Chunk {number}", { number: entry.chunkNumber })}
                </summary>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-sm">
                  {entry.indexedText}
                </pre>
                <p className="text-xs text-secondary">
                  {t("preparation.searchVector", "Search vector")}
                </p>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">
                  {entry.searchVector}
                </pre>
              </details>
            ))}
          </div>
        )}
        {tab === "graph" && result.graph !== null && <GraphPreviewView result={result.graph} />}
      </TabPanel>
    </section>
  );
}
