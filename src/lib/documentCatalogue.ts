// The document catalogue as the Documents page reads it — one page at a time, narrowed on the server, with the
// stage counts as a separate aggregate. Mirrors `documents/DocumentCatalogue` on the server.

import { api, ApiError, workspacePath, type PageRequest } from "./api";

/** How far a document got. REMOVED: taken out of the corpus, by itself or with its source. */
export type CatalogueStage = "CAPTURED" | "PROCESSED" | "SEARCHABLE" | "VECTORISED" | "OUTDATED" | "REMOVED";

/** The stage buttons — each the server's own set of stages. */
export type StageGroup = "SEARCHABLE" | "WAITING" | "NOT_PROCESSED" | "REMOVED";

export const STAGE_GROUPS: readonly StageGroup[] = ["SEARCHABLE", "WAITING", "NOT_PROCESSED", "REMOVED"];

/** Which stages each button gathers — the same sets the server filters by. */
export const STAGES_OF_GROUP: Record<StageGroup, readonly CatalogueStage[]> = {
  SEARCHABLE: ["SEARCHABLE", "VECTORISED"],
  WAITING: ["PROCESSED", "OUTDATED"],
  NOT_PROCESSED: ["CAPTURED"],
  REMOVED: ["REMOVED"],
};

export type CatalogueOrder = "PATH" | "TITLE" | "CHANGED" | "SIZE";

export const CATALOGUE_ORDERS: readonly CatalogueOrder[] = ["PATH", "TITLE", "CHANGED", "SIZE"];

export interface CatalogueDocument {
  id: string;
  sourceId: string;
  sourceName: string;
  externalId: string;
  title: string;
  latestVersionId: string;
  revision: number;
  mediaType: string;
  /** The parser that read the latest version, when it has been processed. */
  parser: string | null;
  sizeBytes: number;
  capturedAt: string;
  changedAt: string;
  removedAt: string | null;
  /** Absent for a reader who may not read automation. */
  stage: CatalogueStage | null;
}

export interface CataloguePage {
  items: CatalogueDocument[];
  total: number;
  limit: number;
  offset: number;
}

export interface StageCounts {
  current: number;
  removed: number;
  /** Absent for a reader who may not read automation. */
  stages: Partial<Record<CatalogueStage, number>> | null;
}

export interface Facet {
  value: string;
  documents: number;
}

export interface CatalogueFacets {
  mediaTypes: Facet[];
  parsers: Facet[];
}

/** What the list is narrowed to; every part optional. Dates are ISO days, `capturedUntil` inclusive. */
export interface CatalogueFilter {
  stage?: StageGroup;
  sourceId?: string;
  mediaType?: string;
  parser?: string;
  text?: string;
  capturedFrom?: string;
  capturedUntil?: string;
  /** A jMQ condition over the `documents` source. */
  query?: string;
}

function filterQuery(filter: CatalogueFilter): URLSearchParams {
  const parameters = new URLSearchParams();
  for (const [name, value] of Object.entries(filter)) {
    if (typeof value === "string" && value.trim() !== "") {
      parameters.set(name, value.trim());
    }
  }
  return parameters;
}

const base = (workspaceId: string) => workspacePath(workspaceId, "/documents/catalogue");

export const documentCatalogueApi = {
  page: (workspaceId: string, filter: CatalogueFilter, order: CatalogueOrder, page: PageRequest) => {
    const parameters = filterQuery(filter);
    parameters.set("order", order);
    parameters.set("limit", String(page.limit));
    parameters.set("offset", String(page.offset));
    return api.send<CataloguePage>("GET", `${base(workspaceId)}?${parameters.toString()}`);
  },
  stages: (workspaceId: string, filter: Omit<CatalogueFilter, "stage">) =>
    api.send<StageCounts>("GET", `${base(workspaceId)}/stages?${filterQuery(filter).toString()}`),
  facets: (workspaceId: string) => api.send<CatalogueFacets>("GET", `${base(workspaceId)}/facets`),
};

/**
 * The server's sentence when it refused the typed jMQ query — shown at the query field — or null when the
 * failure is anything else and belongs to the page.
 */
export function queryRefusal(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.status !== 400) {
    return null;
  }
  const detail = error.detail;
  if (detail !== null && typeof detail === "object" && (detail as Record<string, unknown>).field === "query") {
    const sentence = (detail as Record<string, unknown>).detail;
    return typeof sentence === "string" ? sentence : error.message;
  }
  return null;
}

/** The Documents page's address: every filter lives here, so a filtered view can be shared as a link. */
export interface DocumentsSearch {
  stage?: StageGroup;
  source?: string;
  type?: string;
  parser?: string;
  text?: string;
  from?: string;
  until?: string;
  query?: string;
  order?: CatalogueOrder;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function textOf(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function dayOf(value: unknown): string | undefined {
  return typeof value === "string" && ISO_DAY.test(value) ? value : undefined;
}

/** Reads the address leniently: anything unknown is dropped rather than refused. */
export function readDocumentsSearch(search: Record<string, unknown>): DocumentsSearch {
  return {
    stage: STAGE_GROUPS.find((group) => group === search.stage),
    source: textOf(search.source),
    type: textOf(search.type),
    parser: textOf(search.parser),
    text: textOf(search.text),
    from: dayOf(search.from),
    until: dayOf(search.until),
    query: textOf(search.query),
    order: CATALOGUE_ORDERS.find((order) => order === search.order),
  };
}

/** The server's filter for an address. */
export function filterOf(search: DocumentsSearch): CatalogueFilter {
  return {
    stage: search.stage,
    sourceId: search.source,
    mediaType: search.type,
    parser: search.parser,
    text: search.text,
    capturedFrom: search.from,
    capturedUntil: search.until,
    query: search.query,
  };
}
