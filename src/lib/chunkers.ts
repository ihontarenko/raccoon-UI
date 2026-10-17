// The chunk step as a workspace sees it — the installed chunkers and the block kinds each reads, the processing
// profiles' chunk settings with what changing them would cost, and a preview of one document's chunks. Mirrors
// `processing/ChunkerOverview`. Settings are changed on the processing profiles, never here.

import { api, workspacePath } from "./api";
import type { BlockKind } from "./pipeline";

/** The chunker that takes the documents whose parser emitted logical units and passes the rest down its chain. */
export const LOGICAL_UNITS = "logical-units";

export interface ChunkSettings {
  /** The chain that cuts: the first chunker that accepts a document cuts it; the last takes everything. */
  chunkerIds: string[];
  maximumCodePoints: number;
  overlapCodePoints: number;
  /** AS_PARSED: every unit the parser emitted is one chunk; MERGE_SMALL: small neighbours share one up to the size. */
  unitMerging: UnitMerging;
  /** How many JSON or XML values share a chunk when units are merged. */
  entryUnit: EntryUnit;
  /** How big a table chunk is when units are merged. */
  tableUnit: TableUnit;
  maximumTableRowsPerFragment: number;
}

export type UnitMerging = "AS_PARSED" | "MERGE_SMALL";
export type EntryUnit = "VALUE" | "OBJECT" | "GROUP";
export type TableUnit = "TABLE" | "ROW_GROUP" | "ROW" | "CELL";

export interface ChunkerDescriptor {
  name: string;
  summary: string;
  /** The block kinds it reads boundaries from. */
  takes: BlockKind[];
}

/** A chain as a reader says it: «Logical units → Section window». */
export function describeChain(chunkerIds: string[], chunkers: Chunker[]): string {
  return chunkerIds.map((identifier) => chunkers.find((chunker) => chunker.identifier === identifier)?.descriptor.name ?? identifier).join(" → ");
}

/** The chains worth offering: each window chunker alone, and each behind logical units. */
export function chainChoices(chunkers: Chunker[]): string[][] {
  const windows = chunkers.filter((chunker) => chunker.takesEverything).map((chunker) => chunker.identifier);
  const units = chunkers.some((chunker) => chunker.identifier === LOGICAL_UNITS);
  return windows.flatMap((window) => (units ? [[LOGICAL_UNITS, window], [window]] : [[window]]));
}

export interface Chunker {
  identifier: string;
  /** Whether a profile chooses it; the logical-unit chunker is used by structure instead. */
  /** Whether it cuts every document — a window chunker, which may end a chain — or passes some on. */
  takesEverything: boolean;
  descriptor: ChunkerDescriptor;
  /** Installed parsers emitting blocks it reads. */
  parsers: string[];
}

export interface VectorImpact {
  embeddingProfileId: string;
  embeddingProfileName: string;
  vectors: number;
  /** Estimated, never counted: code points divided by the embedding profile's calibration. */
  estimatedTokens: number;
  codePointsPerToken: number;
}

export interface ChunkImpact {
  documents: number;
  chunks: number;
  codePoints: number;
  vectors: VectorImpact[];
}

export interface ProfileChunking {
  profileId: string;
  name: string;
  revision: number;
  enabled: boolean;
  /** Null for a profile without a chunk step. */
  chunking: ChunkSettings | null;
  impact: ChunkImpact;
}

export interface ChunkerOverview {
  chunkers: Chunker[];
  profiles: ProfileChunking[];
  profilesTruncated: boolean;
}

export interface PreviewRequest {
  documentId: string;
  versionId?: string | null;
  profileId: string;
  chunking?: ChunkSettings | null;
}

export interface PreviewChunk {
  number: number;
  startLine: number;
  endLine: number;
  startPage: number | null;
  codePoints: number;
  indexedCodePoints: number;
  symbolKind: string | null;
  symbolId: string | null;
  signature: string | null;
  part: number;
  parts: number;
  excerpt: string;
  excerptTruncated: boolean;
}

export interface ChunkPreview {
  versionId: string;
  parserId: string;
  chunker: string;
  chunking: ChunkSettings;
  structureFallback: { reason: string; detail: string | null } | null;
  blockCount: number;
  chunkCount: number;
  sizes: { smallest: number; median: number; largest: number; total: number };
  /** Chunks the document has in search now; null when it is not searchable. */
  currentChunkCount: number | null;
  chunks: PreviewChunk[];
  chunksTruncated: boolean;
}

export const chunkersApi = {
  overview: (workspaceId: string) => api.send<ChunkerOverview>("GET", workspacePath(workspaceId, "/chunkers")),
  preview: (workspaceId: string, request: PreviewRequest) =>
    api.send<ChunkPreview>("POST", workspacePath(workspaceId, "/chunkers/preview"), request),
};

/** The tokens re-vectorising a profile's documents would take, summed over embedding profiles. */
export function estimatedTokens(impact: ChunkImpact): number {
  return impact.vectors.reduce((total, vector) => total + vector.estimatedTokens, 0);
}
