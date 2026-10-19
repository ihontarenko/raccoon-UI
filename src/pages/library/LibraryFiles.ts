import type { ExplorerAction, ExplorerAdapter, ExplorerEntry, ExplorerTarget } from "@jmouse/explorer";
import { api } from "../../lib/api";
import type { SourceKind } from "../../lib/contracts";
import { filesApi, type FileEntry, type SourceTree } from "../../lib/files";

/**
 * The workspace's captured originals, as `@jmouse/explorer` reads them.
 *
 * Raccoon keeps no folders of its own (lib/files.ts): each source is the top of a tree, a folder is the directory
 * part of a captured path, and a file is the current version of a document. This adapter is that mapping and nothing
 * more — which acts are offered follows from the methods it has and from what {@link LibraryFiles.permits} answers.
 *
 * ⚠️ AN ENTRY'S ID SAYS WHAT IT IS. A source is `source:<sourceId>`, a folder `folder:<sourceId>:<path>`, a file its
 * version ID — the same ID the Library's address keeps for an open document, so a link to a reading opens it here.
 *
 * ⚠️ NO FOLDER ACTS. Folders are made by the paths documents are captured under, so there is nothing to create, rename
 * or move; those methods are absent rather than refusing, and the explorer offers none of them.
 */

/** The words the adapter's own refusals carry — the server's are passed on as they are. */
export interface LibraryFilesWords {
  notText(name: string): string;
  emptyOrLarge(name: string): string;
}

export interface LibraryFilesSettings {
  workspaceId: string;
  /** The reader may capture into, remove from and restore to the corpus (`document:write`). */
  mayWriteDocuments: boolean;
  /** Removed documents are listed too, marked, and can be restored. */
  includeRemoved: boolean;
  /** An absolute link that opens one file for reading in the Library. */
  readingLinkOf(file: FileEntry): string;
  words: LibraryFilesWords;
}

/** Sources that take files from this screen, and how. */
const UPLOADING_KINDS: ReadonlySet<SourceKind> = new Set<SourceKind>(["MANAGED_FOLDER", "CUSTOM_TEXT"]);

/** The text a CUSTOM_TEXT source accepts; anything else is refused before it is read. */
const TEXT_UPLOAD = /\.(txt|md|markdown|text|csv|json|yaml|yml|xml|log)$/i;
const LARGEST_UPLOAD_CHARACTERS = 1_048_576;

const PAGE_SIZE = 100;

/** A place in a source: its top (`""`) or a folder path. */
interface SourcePlace {
  sourceId: string;
  folder: string;
}

export function sourceEntryId(sourceId: string): string {
  return `source:${sourceId}`;
}

export function folderEntryId(place: SourcePlace): string {
  return place.folder === "" ? sourceEntryId(place.sourceId) : `folder:${place.sourceId}:${place.folder}`;
}

/** The place a source or folder ID names; undefined for a file's ID. */
export function placeOf(entryId: string): SourcePlace | undefined {
  if (entryId.startsWith("source:")) {
    return { sourceId: entryId.slice("source:".length), folder: "" };
  }
  if (entryId.startsWith("folder:")) {
    const rest = entryId.slice("folder:".length);
    const separator = rest.indexOf(":");
    return { sourceId: rest.slice(0, separator), folder: rest.slice(separator + 1) };
  }
  return undefined;
}

function fileEntryOf(file: FileEntry): ExplorerEntry {
  return {
    id: file.versionId,
    parentId: folderEntryId({ sourceId: file.sourceId, folder: file.folder }),
    name: file.name,
    kind: "file",
    mediaType: file.effectiveMediaType,
    size: file.sizeBytes,
    modified: file.capturedAt,
    removed: file.removedAt !== null,
  };
}

function foldersOf(tree: SourceTree): ExplorerEntry[] {
  return [
    // A source and a folder are sized by everything filed under them — what a listing of places is read for.
    { id: sourceEntryId(tree.sourceId), parentId: null, name: tree.name, kind: "folder", size: tree.bytes },
    ...tree.folders.map(
      (folder): ExplorerEntry => ({
        id: folderEntryId({ sourceId: tree.sourceId, folder: folder.path }),
        parentId: folderEntryId({ sourceId: tree.sourceId, folder: folder.parent }),
        name: folder.name,
        kind: "folder",
        size: folder.bytesBelow,
      }),
    ),
  ];
}

export class LibraryFiles implements ExplorerAdapter {
  private readonly settings: LibraryFilesSettings;
  private trees: Promise<SourceTree[]> | undefined;
  /** Every file this adapter has handed out, by version ID — what the reader and the acts need beyond an entry. */
  private readonly files = new Map<string, FileEntry>();
  /** Each source's kind, noted as the trees arrive — what decides whether a place takes files. */
  private readonly sourceKinds = new Map<string, SourceKind>();

  constructor(settings: LibraryFilesSettings) {
    this.settings = settings;
  }

  get workspaceId(): string {
    return this.settings.workspaceId;
  }

  /** The sources and their folders, read once per adapter. */
  sourceTrees(): Promise<SourceTree[]> {
    this.trees ??= filesApi.tree(this.settings.workspaceId, this.settings.includeRemoved).then((trees) => {
      for (const tree of trees) {
        this.sourceKinds.set(tree.sourceId, tree.kind);
      }
      return trees;
    });
    return this.trees;
  }

  /** One file as Raccoon describes it — from what was listed, or asked for. */
  async fileOf(versionId: string): Promise<FileEntry> {
    const known = this.files.get(versionId);
    if (known !== undefined) {
      return known;
    }
    return this.remember(await filesApi.file(this.settings.workspaceId, versionId));
  }

  async list(folderId: string | null): Promise<ExplorerEntry[]> {
    const trees = await this.sourceTrees();
    if (folderId === null) {
      return trees.map((tree) => foldersOf(tree)[0]!);
    }
    const place = placeOf(folderId);
    const tree = place === undefined ? undefined : trees.find((candidate) => candidate.sourceId === place.sourceId);
    if (place === undefined || tree === undefined) {
      // Answered the way the server answers a place that is not there, so the explorer shows it as gone.
      throw Object.assign(new Error(folderId), { response: { status: 404 } });
    }
    const subfolders = foldersOf(tree).filter((entry) => entry.parentId === folderId);
    return [...subfolders, ...(await this.filesIn(place)).map(fileEntryOf)];
  }

  async folders(): Promise<ExplorerEntry[]> {
    return (await this.sourceTrees()).flatMap(foldersOf);
  }

  async find(entryId: string): Promise<ExplorerEntry> {
    return fileEntryOf(await this.fileOf(entryId));
  }

  async read(file: ExplorerEntry): Promise<Blob> {
    return filesApi.content(this.settings.workspaceId, file.id);
  }

  async upload(folderId: string | null, file: File): Promise<ExplorerEntry> {
    const place = folderId === null ? undefined : placeOf(folderId);
    const tree = place === undefined ? undefined : (await this.sourceTrees()).find((candidate) => candidate.sourceId === place.sourceId);
    if (place === undefined || tree === undefined) {
      throw new Error(folderId ?? "");
    }
    const versionId = tree.kind === "MANAGED_FOLDER" ? await this.uploadToManagedFolder(place, file) : await this.captureText(place, file);
    return fileEntryOf(this.remember(await filesApi.file(this.settings.workspaceId, versionId)));
  }

  /** Takes the document out of the corpus; search no longer finds it, and it can be restored — here, or on its page. */
  async remove(entry: ExplorerEntry): Promise<ExplorerEntry | void> {
    const file = await this.fileOf(entry.id);
    await api.removeDocument(this.settings.workspaceId, { id: file.documentId, revision: file.versionNumber });
    this.files.delete(entry.id);
    // Shown with the removed ones, it stays where it was — marked, and a click away from being restored.
    if (this.settings.includeRemoved) {
      return fileEntryOf(this.remember(await filesApi.file(this.settings.workspaceId, entry.id)));
    }
  }

  /** Puts a removed document back into the corpus — the same act its document page offers. */
  async restore(entry: ExplorerEntry): Promise<ExplorerEntry> {
    const file = await this.fileOf(entry.id);
    await api.restoreDocument(this.settings.workspaceId, file.documentId);
    this.files.delete(entry.id);
    return fileEntryOf(this.remember(await filesApi.file(this.settings.workspaceId, entry.id)));
  }

  shareUrl(entry: ExplorerEntry): string | null {
    const file = this.files.get(entry.id);
    return file === undefined ? null : this.settings.readingLinkOf(file);
  }

  /**
   * Capture needs `document:write` and a source that takes files here; removing a file needs `document:write`. A source's
   * own top is a place like any folder in it — only the workspace's top, where the sources are, takes nothing.
   */
  permits(action: ExplorerAction, target: ExplorerTarget): boolean {
    if (action === "upload") {
      return this.settings.mayWriteDocuments && "place" in target && target.place !== null && this.takesUploads(target.place);
    }
    if (action === "restore") {
      return this.settings.mayWriteDocuments;
    }
    if (action === "remove") {
      // A folder is the paths of the documents in it; there is nothing of its own to remove.
      return this.settings.mayWriteDocuments && "entry" in target && target.entry.kind === "file";
    }
    return true;
  }

  private takesUploads(folderId: string): boolean {
    const place = placeOf(folderId);
    // ⚠️ Decided from the trees already read: `permits` answers synchronously, and the folder being shown was
    // listed through them, so they are in hand by the time anybody can drop a file.
    const kind = place === undefined ? undefined : this.sourceKinds.get(place.sourceId);
    return kind !== undefined && UPLOADING_KINDS.has(kind);
  }

  private remember(file: FileEntry): FileEntry {
    this.files.set(file.versionId, file);
    return file;
  }

  /** Every file filed directly in one place, page by page. */
  private async filesIn(place: SourcePlace): Promise<FileEntry[]> {
    const collected: FileEntry[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const page = await filesApi.list(
        this.settings.workspaceId,
        { sourceId: place.sourceId, folder: place.folder, includeRemoved: this.settings.includeRemoved },
        { limit: PAGE_SIZE, offset },
      );
      for (const file of page) {
        collected.push(this.remember(file));
      }
      if (page.length < PAGE_SIZE) {
        return collected;
      }
    }
  }

  /** A managed folder takes the file as it is, into the folder open here; the server judges it. */
  private async uploadToManagedFolder(place: SourcePlace, file: File): Promise<string> {
    const [outcome] = await api.uploadToManagedFolder(this.settings.workspaceId, place.sourceId, [file], place.folder);
    if (outcome === undefined || outcome.version === null) {
      throw new Error(outcome?.refusal ?? file.name);
    }
    return outcome.version.id;
  }

  /** A text source takes text alone, captured under the path it would have here. */
  private async captureText(place: SourcePlace, file: File): Promise<string> {
    if (!TEXT_UPLOAD.test(file.name)) {
      throw new Error(this.settings.words.notText(file.name));
    }
    const content = await file.text();
    if (content.trim().length === 0 || content.length > LARGEST_UPLOAD_CHARACTERS) {
      throw new Error(this.settings.words.emptyOrLarge(file.name));
    }
    const path = place.folder === "" ? file.name : `${place.folder}/${file.name}`;
    const existing = Array.from(this.files.values()).find((candidate) => candidate.sourceId === place.sourceId && candidate.path === path);
    const version = await api.captureText(this.settings.workspaceId, place.sourceId, {
      externalId: path,
      title: file.name,
      text: content,
      revision: existing?.versionNumber ?? 0,
    });
    return version.id;
  }
}
