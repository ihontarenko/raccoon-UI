import type { FilesSearch } from "../files/FilesPage";

/** Which way the Library shows the workspace's material: as files, or opened for reading. */
export type LibraryMode = "files" | "explorer";

/**
 * The Library's address. Both modes share the place — `source` and `folder` — so switching between them keeps where
 * you are; the explorer adds the documents open for reading, in tab order, and the one in front.
 */
export interface LibrarySearch extends FilesSearch {
  /** Absent means the explorer: the Library opens for reading. */
  mode?: "files";
  /** Version ids of the open documents, comma-separated, in tab order. */
  open?: string;
  /** The version id of the document in front. */
  active?: string;
  /** Reading mode: the document alone, over everything. In the address, so Back leaves it. */
  read?: true;
}

export function openTabsOf(search: LibrarySearch): string[] {
  return search.open === undefined ? [] : search.open.split(",").filter((identifier) => identifier.length > 0);
}
