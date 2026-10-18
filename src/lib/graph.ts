import { api, pageQuery, workspacePath, type PageRequest } from "./api";
import type { JobView } from "./contracts";

export interface GraphGeneration {
  id: string;
  job: JobView;
  state: "BUILDING" | "PUBLISHED" | "WITHDRAWN";
  revision: number;
  manifestDigest: string;
  analysisComplete: boolean;
}

export interface GraphCandidate {
  jobId: string;
  documentId: string;
  versionId: string;
  sourceId: string;
  title: string;
  providers: string[];
  declarations: number;
  references: number;
}

export interface GraphEvidence {
  documentId: string;
  versionId: string;
  parseJobId: string;
  selectionJobId: string;
  contributionId: string;
  factId: string;
  providerId: string;
  location: SemanticLocation;
  attributes: Record<string, string>;
}

export interface GraphDefinition {
  id: string;
  group: string;
  entityId: string;
  namespace: string;
  key: string;
  name: string;
  qualifiedName: string;
  kind: string;
  description: string;
  reliable: boolean;
  evidence: GraphEvidence;
}

export interface GraphEdge {
  id: string;
  sourceDefinitionId: string | null;
  ownerKey: string | null;
  targetDefinitionId: string | null;
  candidates: string[];
  role: string;
  origin: string;
  factOrigin: "ASSERTED" | "MATCHED";
  status: "RESOLVED" | "AMBIGUOUS" | "UNRESOLVED" | "LOCAL" | "TYPE_VARIABLE";
  reliable: boolean;
  writtenTarget: string;
  reason: string | null;
  evidence: GraphEvidence;
}

export interface GraphCoverage {
  visibleFiles: number;
  partialFiles: number;
  relationFiles: number;
  analysisComplete: boolean;
  stale: boolean;
}

export interface GraphContextSelection {
  generationId: string;
  definitionIds: string[];
}

export interface GraphContextFragment {
  generationId: string;
  root: GraphDefinition;
  definitions: GraphDefinition[];
  edges: GraphEdge[];
  coverage: GraphCoverage;
  text: string;
  truncated: boolean;
}

export interface GraphResult<T> {
  generationId: string;
  coverage: GraphCoverage;
  items: T[];
  hasMore: boolean;
  truncation: string | null;
}

export interface GraphRequest {
  groups: { name: string; relationJobIds: string[] }[];
}

export interface GraphPreview {
  definitions: import("./pipeline").PreviewSample<GraphDefinition>;
  edges: import("./pipeline").PreviewSample<GraphEdge>;
  resolved: number;
  ambiguous: number;
  unresolved: number;
  persisted: false;
}

export interface GraphForecast {
  files: number;
  originalBytes: number;
  references: number;
  maximumFiles: number;
  maximumBytes: number;
  maximumReferences: number;
  analysisComplete: boolean;
  manifestDigest: string;
}

const base = (workspaceId: string) => workspacePath(workspaceId, "/graphs");
const generationPath = (workspaceId: string, generationId: string) =>
  `${base(workspaceId)}/generations/${generationId}`;

export const graphApi = {
  candidates: (workspaceId: string, page: PageRequest) =>
    api.send<GraphCandidate[]>("GET", `${base(workspaceId)}/candidates?${pageQuery(page)}`),
  generation: (workspaceId: string, generationId: string) =>
    api.send<GraphGeneration>("GET", generationPath(workspaceId, generationId)),
  generations: (workspaceId: string, page: PageRequest) =>
    api.send<GraphGeneration[]>("GET", `${base(workspaceId)}/generations?${pageQuery(page)}`),
  preview: (workspaceId: string, request: GraphRequest) =>
    api.send<GraphPreview>("POST", `${base(workspaceId)}/generations/preview`, request),
  documentRelations: (
    workspaceId: string,
    generationId: string,
    documentId: string,
    page: PageRequest,
  ) =>
    api.send<GraphResult<GraphEdge>>(
      "GET",
      `${generationPath(workspaceId, generationId)}/documents/${documentId}/relations?${pageQuery(page)}`,
    ),
  forecast: (workspaceId: string, request: GraphRequest) =>
    api.send<GraphForecast>("POST", `${base(workspaceId)}/generations/forecast`, request),
  submit: (workspaceId: string, request: GraphRequest, key: string) =>
    api.send<GraphGeneration>("POST", `${base(workspaceId)}/generations`, request, {
      "Idempotency-Key": key,
    }),
  change: (
    workspaceId: string,
    generation: GraphGeneration,
    action: "cancel" | "retry" | "withdraw",
  ) =>
    api.send<GraphGeneration>(
      "POST",
      `${generationPath(workspaceId, generation.id)}/${action}?revision=${generation.revision}`,
    ),
  entities: (workspaceId: string, generationId: string, query: string, page: PageRequest) =>
    api.send<GraphResult<GraphDefinition>>(
      "GET",
      `${generationPath(workspaceId, generationId)}/entities?query=${encodeURIComponent(query)}&${pageQuery(page)}`,
    ),
  edges: (
    workspaceId: string,
    generationId: string,
    definitionId: string,
    direction: "references" | "dependencies",
    includeUncertain: boolean,
    page: PageRequest,
  ) =>
    api.send<GraphResult<GraphEdge>>(
      "GET",
      `${generationPath(workspaceId, generationId)}/entities/${definitionId}/${direction}?includeUncertain=${includeUncertain}&${pageQuery(page)}`,
    ),
};

/** An address may locate text, a page region, an anchor or a structured-data path. */
export interface SemanticLocation {
  kind: string;
  startOffset: number | null;
  endOffset: number | null;
  startLine: number | null;
  endLine: number | null;
  page: number | null;
  anchor: string | null;
  path: string | null;
  region: Record<string, number>;
}
