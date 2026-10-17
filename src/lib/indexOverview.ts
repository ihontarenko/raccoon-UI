// The index read the way a person asks about it: how far each document got along the chain, and inside one
// processing run which chunks search can find and which have vectors. Mirrors `indexing/IndexOverview`.
//
// The chain: a document VERSION is processed into CHUNKS → each chunk becomes one KEYWORD ENTRY → publishing
// the run's generation makes the entries SEARCHABLE → a vector generation embeds published entries into VECTORS.

import { api, pageQuery, workspacePath, type PageRequest } from "./api";
import type { ChunkStanding, IndexEntry, LexicalGenerationState } from "./pipeline";

export interface IndexChain {
  documents: number;
  processedDocuments: number;
  /** Chunks of published generations — the pieces search reads. */
  chunks: number;
  searchableEntries: number;
  searchableDocuments: number;
  /** Entries written by hand and replacements, not removed. */
  writtenEntries: number;
  searchableVectors: number;
  vectorisedDocuments: number;
}

/** How far a document got. OUTDATED: search still reads an older version while the latest is not published. */
export type DocumentStage = "CAPTURED" | "PROCESSED" | "SEARCHABLE" | "VECTORISED" | "OUTDATED";

export interface DocumentStanding {
  documentId: string;
  sourceId: string;
  sourceName: string;
  versionId: string;
  versionNumber: number;
  title: string;
  stage: DocumentStage;
  /** The keyword generation of the latest version — the published one when there is one. */
  generation: { jobId: string; state: LexicalGenerationState; revision: number; entryCount: number } | null;
  publishedGenerationId: string | null;
  searchableEntries: number;
  searchableVectors: number;
}

export interface ChunkCoverage {
  chunkNumber: number;
  entryId: string | null;
  entryRemoved: boolean;
  /** Whether the run's generation is the one search reads for its document. */
  published: boolean;
  /** A written entry standing in for this chunk's own entry. */
  replacementId: string | null;
  searchableVectors: number;
  vectors: number;
  /** The keyword entry made from the chunk; null when none was. */
  entry: IndexEntry | null;
  /** The written entry standing in for it; null when none does. */
  replacement: IndexEntry | null;
}

const base = (workspaceId: string) => workspacePath(workspaceId, "/indexes");

export const indexOverviewApi = {
  chain: (workspaceId: string) => api.send<IndexChain>("GET", `${base(workspaceId)}/chain`),
  documents: (workspaceId: string, page: PageRequest) =>
    api.send<DocumentStanding[]>("GET", `${base(workspaceId)}/documents?${pageQuery(page)}`),
  /** Publishes a document's keyword generation — what makes the document searchable. */
  publish: (workspaceId: string, generation: { jobId: string; revision: number }) =>
    api.send<unknown>("PUT", `${base(workspaceId)}/generations/${generation.jobId}/publication`, { published: true, revision: generation.revision }),
  coverage: (workspaceId: string, jobId: string, standing: ChunkStanding, page: PageRequest) =>
    api.send<ChunkCoverage[]>("GET", `${base(workspaceId)}/generations/${jobId}/coverage?standing=${standing}&${pageQuery(page)}`),
};

/** Whether search finds a chunk, in the words the interface uses. */
export type ChunkReach = "searchable" | "replaced" | "removed" | "not-published" | "no-entry";

export function reachOf(coverage: ChunkCoverage): ChunkReach {
  if (coverage.entryId === null) {
    return "no-entry";
  }
  // Replacing a derived entry removes it, so a written replacement is asked for before removal.
  if (coverage.replacementId !== null) {
    return "replaced";
  }
  if (coverage.entryRemoved) {
    return "removed";
  }
  return coverage.published ? "searchable" : "not-published";
}
