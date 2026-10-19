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
}

export function openTabsOf(search: LibrarySearch): string[] {
  return search.open === undefined ? [] : search.open.split(",").filter((identifier) => identifier.length > 0);
}
