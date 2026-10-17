import { api, collectAllPages } from "../../lib/api";
import type { DocumentVersionView, DocumentView } from "../../lib/contracts";
import { pipelineApi, type IndexGeneration, type ProcessingProfile, type VectorGeneration } from "../../lib/pipeline";

// Where one document stands in the pipeline, read from the separate lists the backend keeps: its
// versions, the lexical generations built from them, and the vector generations built on those.

/** A vector generation is looked for among the newest ones; older history stays on the Index page. */
const VECTOR_GENERATIONS_EXAMINED = 100;
const RECORDS_EXAMINED = 100;

export interface DocumentPipeline {
  document: DocumentView;
  /** Newest first. */
  versions: DocumentVersionView[];
  /** Every lexical generation of this document, newest first. */
  generations: IndexGeneration[];
  /** Vector generations holding at least one record of this document, newest first. */
  vectorGenerations: VectorGeneration[];
  processingProfiles: ProcessingProfile[];
}

export async function loadDocumentPipeline(workspaceId: string, documentId: string, mayReadAutomation: boolean): Promise<DocumentPipeline> {
  const [document, versions] = await Promise.all([
    api.getDocument(workspaceId, documentId),
    collectAllPages((page) => api.listDocumentVersions(workspaceId, documentId, page)),
  ]);
  if (!mayReadAutomation) {
    return { document, versions: newestFirst(versions), generations: [], vectorGenerations: [], processingProfiles: [] };
  }
  const [generations, vectorGenerations, processingProfiles] = await Promise.all([
    collectAllPages((page) => pipelineApi.indexGenerations(workspaceId, page)),
    vectorGenerationsOfDocument(workspaceId, documentId),
    collectAllPages((page) => pipelineApi.processingProfiles(workspaceId, page)),
  ]);
  return {
    document,
    versions: newestFirst(versions),
    generations: generations.filter((generation) => generation.documentId === documentId),
    vectorGenerations,
    processingProfiles,
  };
}

function newestFirst(versions: DocumentVersionView[]): DocumentVersionView[] {
  return [...versions].sort((first, second) => second.versionNumber - first.versionNumber);
}

/**
 * The vector generations that reached this document. The backend lists generations without the
 * documents they cover, so each recent one is asked for a page of its records.
 */
async function vectorGenerationsOfDocument(workspaceId: string, documentId: string): Promise<VectorGeneration[]> {
  const generations = await pipelineApi.vectorGenerations(workspaceId, { limit: VECTOR_GENERATIONS_EXAMINED, offset: 0 });
  const live = generations.filter((generation) => generation.state !== "PURGED");
  const covering = await Promise.all(
    live.map(async (generation) => {
      const records = await pipelineApi.vectorRecords(workspaceId, generation.jobId, { limit: RECORDS_EXAMINED, offset: 0 });
      return records.some((record) => record.documentId === documentId) ? generation : null;
    }),
  );
  return covering.filter((generation): generation is VectorGeneration => generation !== null);
}

/** The generation that speaks for a version: the published one, otherwise the newest. */
export function generationOfVersion(generations: IndexGeneration[], versionId: string): IndexGeneration | null {
  const ofVersion = generations.filter((generation) => generation.versionId === versionId);
  return ofVersion.find((generation) => generation.state === "PUBLISHED") ?? ofVersion[0] ?? null;
}

/** A processing profile that produces chunks and an index, which is what the pipeline is for. */
export function indexesDocuments(profile: ProcessingProfile): boolean {
  const steps = profile.configuration.preparation?.steps ?? ["parse"];
  return profile.configuration.enabled !== false && steps.includes("chunk") && steps.includes("lexical");
}

export function describeSteps(profile: ProcessingProfile): string {
  const preparation = profile.configuration.preparation;
  const steps = preparation?.steps ?? ["parse"];
  const parts = [steps.join(" → ")];
  if (preparation?.chunking !== null && preparation?.chunking !== undefined) {
    parts.push(`chunks of ${preparation.chunking.maximumCodePoints} with ${preparation.chunking.overlapCodePoints} overlap`);
  }
  if (preparation?.indexing !== null && preparation?.indexing !== undefined) {
    parts.push(`${preparation.indexing.analyzer} analyzer, ${preparation.indexing.publishAutomatically ? "publishes itself" : "published by hand"}`);
  }
  return parts.join(" · ");
}
