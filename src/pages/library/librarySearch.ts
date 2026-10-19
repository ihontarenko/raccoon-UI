import type { FileFamily } from "@jmouse/file-handling";

/**
 * The Library's address: the place being looked at, and the documents open for reading.
 *
 * Everything is in it, so a place or a reading session can be bookmarked or sent, and Back leaves reading mode.
 */
export interface LibrarySearch {
  /** The source being looked at; absent is the workspace's top, where the sources are. */
  source?: string;
  /** A folder path inside the source; absent is the source's own top. */
  folder?: string;
  /** Version ids of the open documents, comma-separated, in tab order. */
  open?: string;
  /** The version id of the document in front; absent shows the place. */
  active?: string;
  /** Reading mode: the document alone, over everything. */
  read?: true;
  /** The file families the listing is narrowed to, comma-separated; absent shows every file. */
  types?: string;
  /** Removed documents are listed too, marked, to be restored. */
  removed?: true;
}

export function openTabsOf(search: LibrarySearch): string[] {
  return search.open === undefined ? [] : search.open.split(",").filter((identifier) => identifier.length > 0);
}

const FAMILIES: readonly FileFamily[] = ["document", "code", "data", "sheet", "image", "audio", "video", "archive", "file"];

/** The families the address names, the unknown ones dropped — a mistyped link narrows nothing rather than everything. */
export function familiesOf(search: LibrarySearch): FileFamily[] {
  if (search.types === undefined) {
    return [];
  }
  return search.types.split(",").filter((family): family is FileFamily => (FAMILIES as readonly string[]).includes(family));
}
