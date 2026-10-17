import { useState } from "react";
import { usePermissions } from "../../../access/PermissionsProvider";
import { PERMISSIONS } from "../../../access/permissions";
import { formatNumber } from "../../../application/format";
import { describeProblem } from "../../../application/problems";
import { usePagedList } from "../../../application/usePagedList";
import { indexOverviewApi, reachOf, type ChunkCoverage, type ChunkReach } from "../../../lib/indexOverview";
import {
  pipelineApi,
  type Chunk,
  type ChunkStanding,
  type ChunkSymbol,
  type ChunkSymbolKind,
  type IndexEntry,
  type IndexGeneration,
} from "../../../lib/pipeline";
import { useTranslation } from "../../../translations/TranslationProvider";
import { ConfirmDialog, EmptyState, ListFooter, ProblemState, TabToolbar, Waiting, useToaster } from "../../../ui/components";
import { Badge, Button, Select, type BadgeTone } from "../../../ui/primitives";
import { modulePathOf, scriptSymbolLabel } from "../../../ui/components/reader/scriptDoc";
import { EntryDialog, type EntryEditing } from "../../indexing/EntryDialog";
import { CHUNK, CHUNKS, CHUNK_FACTS, CHUNK_FILTER, CHUNK_HEAD, CHUNK_REPLACEMENT, CHUNK_REPLACEMENT_TEXT, CHUNK_SIGNATURE, CHUNK_SYMBOL, CHUNK_SYMBOL_ID, CHUNK_TEXT, STACK } from "../documentPageClasses";
import { ChunkIndexingView } from "./ChunkIndexingView";

type Translate = ReturnType<typeof useTranslation>["t"];

/** Whether search finds a chunk, as a word and a colour: blue it does, red it was taken out. */
function reachBadge(reach: ChunkReach, t: Translate): { label: string; tone: BadgeTone } {
  switch (reach) {
    case "searchable":
      return { label: t("documents.chunks.reach.searchable", "Search finds it"), tone: "allow" };
    case "replaced":
      return { label: t("documents.chunks.reach.replaced", "Edited by hand"), tone: "warn" };
    case "removed":
      return { label: t("documents.chunks.reach.removed", "Removed from search"), tone: "deny" };
    case "not-published":
      return { label: t("documents.chunks.reach.notPublished", "Not published"), tone: "neutral" };
    case "no-entry":
      return { label: t("documents.chunks.reach.noEntry", "No entry"), tone: "neutral" };
  }
}

function vectorBadge(coverage: ChunkCoverage, t: Translate, plural: ReturnType<typeof useTranslation>["plural"]): { label: string; tone: BadgeTone } {
  if (coverage.searchableVectors > 0) {
    return {
      label: plural("documents.chunks.vectors", coverage.searchableVectors, { one: "Has a vector", other: "{count} vectors" }),
      tone: "allow",
    };
  }
  if (coverage.vectors > 0) {
    return { label: t("documents.chunks.vectorUnused", "Vector not in use"), tone: "neutral" };
  }
  return { label: t("documents.chunks.noVector", "No vector"), tone: "neutral" };
}

/** What each logical-unit chunk kind holds, in words. */
const SYMBOL_KIND: Record<ChunkSymbolKind, string> = {
  FILE: "Package and imports",
  TYPE: "Type header",
  MEMBER: "Member",
  MEMBERS: "Fields",
  DECLARATION: "Declaration",
  DECLARATIONS: "Declarations",
  ENTRY: "Entry",
  ENTRIES: "Entries",
};

/** The heading of a chunk without a signature: the package for Java, the imports for a module, the parent's path for data. */
function symbolHeading(symbol: ChunkSymbol): string | null {
  if (symbol.signature !== null) {
    return symbol.signature;
  }
  if (symbol.kind === "FILE") {
    return symbol.language === "java" ? `package ${symbol.packageName || "(default)"}` : "imports";
  }
  return symbol.typeName;
}

/**
 * The unit a chunk belongs to — a declaration of source code or an entry of structured data: its kind, its
 * signature or path as written and its symbol id — the exact tokens keyword search also matches — and, for a
 * member or an entry, what it is declared in.
 */
function ChunkSymbolLine({ symbol, modulePath }: { symbol: ChunkSymbol; modulePath: string | null }) {
  const heading = symbolHeading(symbol);
  return (
    <div className={CHUNK_SYMBOL}>
      <Badge tone="neutral">{SYMBOL_KIND[symbol.kind]}</Badge>
      {heading !== null && <code className={CHUNK_SIGNATURE}>{heading}</code>}
      {symbol.parts > 1 && (
        <span className="text-xs text-muted numeric">
          part {symbol.part} of {symbol.parts}
        </span>
      )}
      {(symbol.kind === "MEMBERS" || symbol.kind === "DECLARATIONS" || symbol.kind === "ENTRIES") && (
        <span className="text-xs text-muted">{symbol.members.map((member) => member.name).join(", ")}</span>
      )}
      {symbol.traits !== undefined && (
        <span className="text-xs text-muted">
          {symbol.traits.role.toLowerCase()} · {symbol.traits.exported ? "exported" : "internal"}
          {symbol.traits.deprecated ? " · deprecated" : ""}
          {symbol.traits.propsType !== undefined ? ` · properties ${symbol.traits.propsType}` : ""}
        </span>
      )}
      {symbol.symbolId !== null && (
        <span className={`text-xs text-muted ${CHUNK_SYMBOL_ID}`}>{symbol.traits !== undefined ? scriptSymbolLabel(modulePath, symbol) : symbol.symbolId}</span>
      )}
      {symbol.enclosingSignature !== null && <span className="text-xs text-muted">in {symbol.enclosingSignature}</span>}
    </div>
  );
}

interface CoveredChunk {
  chunk: Chunk;
  coverage: ChunkCoverage | null;
}

/** The written entry a person can edit for a chunk: its replacement when one stands in, otherwise its own entry to replace. */
function editingOf({ chunk, coverage }: CoveredChunk): EntryEditing | null {
  if (coverage === null || coverage.entry === null) {
    return null;
  }
  if (coverage.replacement !== null) {
    return { mode: "edit", entry: coverage.replacement };
  }
  if (coverage.entry.removed) {
    return null;
  }
  // A replacement starts from what is indexed, not from the raw slice.
  return { mode: "replace", entry: { ...coverage.entry, text: chunk.indexedText ?? coverage.entry.text } };
}

/**
 * The pieces processing cut this version into, each as it is indexed. Each chunk became one keyword entry; the badges
 * say whether search finds it and whether it has a vector, so chunk, entry and vector are three facts about one piece
 * rather than three lists. A person who may manage the index edits what a chunk is indexed as — a written entry then
 * stands in for it — or takes it out of search, in place; the filter narrows to the chunks somebody did that to.
 */
export function ChunksTab({
  workspaceId,
  generation,
  documentPath,
  onChanged,
}: {
  workspaceId: string;
  generation: IndexGeneration | null;
  documentPath: string | null;
  onChanged: () => void;
}) {
  const { t, plural } = useTranslation();
  const { notify } = useToaster();
  const mayManage = usePermissions().may(PERMISSIONS.automationManage);
  const modulePath = modulePathOf(documentPath);
  const [standing, setStanding] = useState<ChunkStanding>("ALL");
  const [editing, setEditing] = useState<EntryEditing | null>(null);
  const [removing, setRemoving] = useState<{ entry: IndexEntry; chunkNumber: number } | null>(null);
  const chunks = usePagedList<CoveredChunk>(
    async (page) => {
      if (generation === null) {
        return [];
      }
      const [pieces, coverage] = await Promise.all([
        pipelineApi.generationChunks(workspaceId, generation.jobId, page, standing),
        indexOverviewApi.coverage(workspaceId, generation.jobId, standing, page),
      ]);
      const byNumber = new Map(coverage.map((entry) => [entry.chunkNumber, entry]));
      return pieces.map((chunk) => ({ chunk, coverage: byNumber.get(chunk.number) ?? null }));
    },
    [workspaceId, generation?.jobId, standing],
  );

  if (generation === null) {
    return (
      <EmptyState
        title={t("documents.chunks.notYet", "Not cut into chunks yet")}
        description={t("documents.chunks.notYetDescription", "Process this version: it is read, cut into chunks, and each chunk becomes one searchable entry.")}
      />
    );
  }
  if (generation.state === "PURGED") {
    return (
      <EmptyState
        title={t("documents.chunks.purged", "Chunks purged")}
        description={t("documents.chunks.purgedDescription", "This generation was purged; process the version again to rebuild its chunks.")}
      />
    );
  }

  const remove = async (entry: IndexEntry) => {
    try {
      await pipelineApi.removeEntry(workspaceId, entry);
      notify({
        tone: "good",
        title: t("documents.chunks.removed", "Removed from search"),
        description: t("documents.chunks.removedDescription", "Vectors built from it are withdrawn."),
      });
      chunks.reload();
      onChanged();
    } catch (error) {
      const problem = describeProblem(error);
      notify({ tone: "error", title: problem.title, description: problem.detail ?? problem.description });
    }
  };

  return (
    <div className={STACK}>
      <TabToolbar
        control={
          <label className={CHUNK_FILTER}>
            <span className="text-xs text-secondary">{t("documents.chunks.filter", "Show")}</span>
            <Select
              value={standing}
              onChange={(event) => {
                setStanding(event.target.value as ChunkStanding);
              }}
            >
              <option value="ALL">{t("documents.chunks.filterAll", "All chunks")}</option>
              <option value="EDITED">{t("documents.chunks.filterEdited", "Edited by hand")}</option>
              <option value="REMOVED">{t("documents.chunks.filterRemoved", "Removed from search")}</option>
            </Select>
          </label>
        }
      >
        {t(
          "documents.chunks.explanation",
          "Processing cut this version into the pieces below. Each piece is shown as it is indexed — what keyword search matches and what its vector is built from.",
        )}
      </TabToolbar>

      {chunks.status === "loading" && <Waiting label={t("documents.chunks.loading", "Loading chunks")} lines={4} />}
      {chunks.status === "failed" && (
        <ProblemState
          layout="section"
          problem={chunks.problem}
          actions={
            <Button icon="refresh" onClick={chunks.reload}>
              {t("common.tryAgain", "Try again")}
            </Button>
          }
        />
      )}
      {chunks.status === "ready" &&
        (chunks.items.length === 0 ? (
          standing === "ALL" ? (
            <EmptyState
              title={t("documents.chunks.none", "No chunks")}
              description={t("documents.chunks.noneDescription", "The processor produced no text worth indexing from this version.")}
            />
          ) : (
            <EmptyState
              title={t("documents.chunks.noneByHand", "Nothing here was changed by hand")}
              description={t("documents.chunks.noneByHandDescription", "No chunk of this version was edited or removed from search.")}
            />
          )
        ) : (
          <>
            <ol className={CHUNKS}>
              {chunks.items.map((covered) => {
                const { chunk, coverage } = covered;
                const reach = coverage === null ? null : reachBadge(reachOf(coverage), t);
                const vectors = coverage === null ? null : vectorBadge(coverage, t, plural);
                const chunkEditing = editingOf(covered);
                // What search reads for the chunk: the written replacement when one stands in, otherwise its own entry.
                const entry = coverage?.replacement ?? coverage?.entry ?? null;
                return (
                  <li key={chunk.number} className={CHUNK}>
                    <div className={CHUNK_HEAD}>
                      <span className="numeric">
                        <strong>{t("documents.chunks.number", "Chunk {number}", { number: chunk.number })}</strong>
                      </span>
                      <span className="text-xs text-muted numeric">
                        {chunk.startPage !== null &&
                          chunk.endPage !== null &&
                          (chunk.startPage === chunk.endPage
                            ? `${t("documents.chunks.page", "page {page}", { page: chunk.startPage })} · `
                            : `${t("documents.chunks.pages", "pages {start}–{end}", { start: chunk.startPage, end: chunk.endPage })} · `)}
                        {t("documents.chunks.coordinates", "lines {start}–{end} · characters {from}–{to}", {
                          start: chunk.startLine,
                          end: chunk.endLine,
                          from: formatNumber(chunk.startOffset),
                          to: formatNumber(chunk.endOffset),
                        })}
                      </span>
                      <span className={CHUNK_FACTS}>
                        {reach !== null && <Badge tone={reach.tone}>{reach.label}</Badge>}
                        {vectors !== null && <Badge tone={vectors.tone}>{vectors.label}</Badge>}
                        {mayManage && chunkEditing !== null && entry !== null && (
                          <>
                            <Button
                              variant="quiet"
                              icon="edit"
                              onClick={() => {
                                setEditing(chunkEditing);
                              }}
                            >
                              {t("documents.chunks.edit", "Edit")}
                            </Button>
                            <Button
                              variant="quiet"
                              icon="trash"
                              aria-label={t("documents.chunks.removeNamed", "Remove chunk {number} from the index", { number: chunk.number })}
                              onClick={() => {
                                setRemoving({ entry, chunkNumber: chunk.number });
                              }}
                            >
                              {t("documents.chunks.remove", "Remove from index")}
                            </Button>
                          </>
                        )}
                      </span>
                    </div>
                    {chunk.symbol !== null && <ChunkSymbolLine symbol={chunk.symbol} modulePath={modulePath} />}
                    {coverage?.replacement != null && (
                      <div className={CHUNK_REPLACEMENT}>
                        <span className="text-xs text-secondary">{t("documents.chunks.replacedBy", "Indexed instead, as written by hand")}</span>
                        <p className={CHUNK_REPLACEMENT_TEXT}>{coverage.replacement.text}</p>
                      </div>
                    )}
                    <ChunkIndexingView chunk={chunk} textClassName={CHUNK_TEXT} />
                  </li>
                );
              })}
            </ol>
            <ListFooter
              shown={chunks.items.length}
              counted={plural("documents.chunks.count", chunks.items.length, { one: "{count} chunk", other: "{count} chunks" })}
              hasMore={chunks.hasMore}
              loadingMore={chunks.loadingMore}
              moreProblem={chunks.moreProblem}
              onLoadMore={chunks.loadMore}
            />
          </>
        ))}

      <EntryDialog
        editing={editing}
        workspaceId={workspaceId}
        onClose={() => {
          setEditing(null);
        }}
        onSaved={() => {
          setEditing(null);
          notify({ tone: "good", title: t("documents.chunks.saved", "Indexed text saved") });
          chunks.reload();
          onChanged();
        }}
      />
      <ConfirmDialog
        open={removing !== null}
        title={t("documents.chunks.removeTitle", "Remove from index")}
        confirmLabel={t("documents.removal.remove", "Remove")}
        destructive
        onConfirm={() => {
          if (removing !== null) {
            const target = removing;
            setRemoving(null);
            void remove(target.entry);
          }
        }}
        onCancel={() => {
          setRemoving(null);
        }}
      >
        <p>
          {t(
            "documents.chunks.removeExplanation",
            "Chunk {number} stops being found. It is kept, marked removed, and vectors built from it are withdrawn.",
            { number: <strong>{removing?.chunkNumber}</strong> },
          )}
        </p>
      </ConfirmDialog>
    </div>
  );
}
