import { api, collectAllPages } from "../../../lib/api";
import type { DocumentView } from "../../../lib/contracts";
import { pipelineApi, type IndexGeneration } from "../../../lib/pipeline";

// Where a source's documents stand in the pipeline, read in bulk: the documents the source holds and
// the index generation that speaks for each one's current version.

export interface DocumentStanding {
  document: DocumentView;
  /** The generation of the current version: the published one, else the newest; null when unprocessed. */
  generation: IndexGeneration | null;
}

export interface SourceStanding {
  documents: DocumentStanding[];
  unprocessed: number;
  published: number;
  /** Built but not searchable: ready, or withdrawn. */
  unpublished: number;
}

export async function loadSourceStanding(workspaceId: string, sourceId: string): Promise<SourceStanding> {
  const [documents, generations] = await Promise.all([
    collectAllPages((page) => api.listDocuments(workspaceId, page)),
    collectAllPages((page) => pipelineApi.indexGenerations(workspaceId, page)),
  ]);
  const ofSource = documents.filter((document) => document.sourceId === sourceId);
  const standings = ofSource.map((document) => {
    const current = generations.filter((generation) => generation.versionId === document.latestVersionId && generation.state !== "PURGED");
    return { document, generation: current.find((generation) => generation.state === "PUBLISHED") ?? current[0] ?? null };
  });
  return {
    documents: standings,
    unprocessed: standings.filter((standing) => standing.generation === null).length,
    published: standings.filter((standing) => standing.generation?.state === "PUBLISHED").length,
    unpublished: standings.filter((standing) => standing.generation !== null && standing.generation.state !== "PUBLISHED").length,
  };
}

/** The backend admits at most this many generations into one preflight and one vector job. */
export const VECTOR_BATCH = 100;
