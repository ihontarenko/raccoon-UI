// The workspace's captured originals, browsed as files. Raccoon keeps no folders of its own: a file is the
// current version of a document, its folder is the directory part of the path it was captured under, and
// each source is the top of a tree. Shapes mirror `files/WorkspaceFiles` field for field.

import { api, pageQuery, workspacePath, type PageRequest } from "./api";
import type { SourceKind } from "./contracts";

export interface FileEntry {
  documentId: string;
  versionId: string;
  sourceId: string;
  /** The path it was captured under, relative to its source, with `/` separators. */
  path: string;
  /** The directory part of the path; empty at the top of the source. */
  folder: string;
  name: string;
  title: string;
  /** As recorded at capture. */
  mediaType: string;
  /** As shown: originals recorded before types were recognised are typed by their name. */
  effectiveMediaType: string;
  sizeBytes: number;
  sha256: string;
  versionNumber: number;
  capturedAt: string;
  removedAt: string | null;
  /** Whether search can find it — its document has a published index generation. */
  published: boolean;
}

export interface FolderNode {
  path: string;
  name: string;
  parent: string;
  depth: number;
  /** Files filed directly in it. */
  files: number;
  /** Files anywhere under it. */
  filesBelow: number;
  bytesBelow: number;
}

export interface SourceTree {
  sourceId: string;
  name: string;
  kind: SourceKind;
  files: number;
  bytes: number;
  folders: FolderNode[];
}

export type FileOrder = "NAME" | "SIZE" | "CAPTURED";

export interface FileQuery {
  sourceId?: string;
  /** With a source: undefined lists all of it, "" its top level, a path that folder. */
  folder?: string;
  text?: string;
  includeRemoved?: boolean;
  order?: FileOrder;
}

const base = (workspaceId: string) => workspacePath(workspaceId, "/files");

function queryOf(query: FileQuery, page: PageRequest): string {
  const parameters = new URLSearchParams();
  if (query.sourceId !== undefined) {
    parameters.set("sourceId", query.sourceId);
  }
  if (query.folder !== undefined) {
    parameters.set("folder", query.folder);
  }
  if (query.text !== undefined && query.text.trim().length > 0) {
    parameters.set("text", query.text.trim());
  }
  if (query.includeRemoved === true) {
    parameters.set("includeRemoved", "true");
  }
  if (query.order !== undefined) {
    parameters.set("order", query.order);
  }
  return `${parameters.toString()}&${pageQuery(page)}`;
}

export const filesApi = {
  tree: (workspaceId: string, includeRemoved: boolean) =>
    api.send<SourceTree[]>("GET", `${base(workspaceId)}/tree${includeRemoved ? "?includeRemoved=true" : ""}`),
  list: (workspaceId: string, query: FileQuery, page: PageRequest) =>
    api.send<FileEntry[]>("GET", `${base(workspaceId)}?${queryOf(query, page)}`),
  file: (workspaceId: string, versionId: string) => api.send<FileEntry>("GET", `${base(workspaceId)}/${versionId}`),
  /** The original's bytes. Text arrives as UTF-8 text; anything that could run in a page arrives as an attachment. */
  content: (workspaceId: string, versionId: string) => api.fetchBytes(`${base(workspaceId)}/${versionId}/content`),
};

/** How a file can be shown in place, decided by its effective type. */
export type FileLook = "image" | "pdf" | "text" | "audio" | "video" | "none";

const SHOWN_IMAGES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

export function lookOf(file: Pick<FileEntry, "effectiveMediaType">): FileLook {
  const type = file.effectiveMediaType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (SHOWN_IMAGES.has(type)) {
    return "image";
  }
  if (type === "application/pdf") {
    return "pdf";
  }
  if (type.startsWith("text/")) {
    return "text";
  }
  if (type.startsWith("audio/")) {
    return "audio";
  }
  if (type.startsWith("video/")) {
    return "video";
  }
  return "none";
}

/** An original as the reader holds it: its text, or its bytes behind an object URL the holder revokes. */
export type OriginalContent =
  | { form: "text"; text: string; cut: boolean; totalCharacters: number }
  | { form: "bytes"; address: string };

/** Text past this many characters is cut in the reader; a download is always whole. */
export const LARGEST_TEXT_READ = 2_000_000;

/** Text larger than this is not fetched for reading at all: decoding it would stall the page. */
export const LARGEST_TEXT_FETCHED_BYTES = 24 * 1024 * 1024;

/**
 * Fetches an original for reading, with the session's token. Text is decoded and cut at
 * {@link LARGEST_TEXT_READ}; anything else is retyped as `shownAs` — the server sends what could run in a
 * page, such as SVG, as plain bytes — and handed back behind an object URL the caller must revoke.
 */
export async function readOriginal(workspaceId: string, versionId: string, asText: boolean, shownAs: string): Promise<OriginalContent> {
  const blob = await filesApi.content(workspaceId, versionId);
  if (asText) {
    const text = await blob.text();
    const cut = text.length > LARGEST_TEXT_READ;
    return { form: "text", text: cut ? text.slice(0, LARGEST_TEXT_READ) : text, cut, totalCharacters: text.length };
  }
  const typed = blob.type === shownAs ? blob : new Blob([blob], { type: shownAs });
  return { form: "bytes", address: URL.createObjectURL(typed) };
}

/** Saves an original under its own name, through an object URL, since a link cannot carry the token. */
export async function downloadFile(workspaceId: string, file: FileEntry): Promise<void> {
  const blob = await filesApi.content(workspaceId, file.versionId);
  const address = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = address;
  anchor.download = file.name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(address), 10000);
}
