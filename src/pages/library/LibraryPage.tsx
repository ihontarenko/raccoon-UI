import { Explorer, type ExplorerEntry, type ExplorerLabels, type ExplorerLocation } from "@jmouse/explorer";
import { Button as KitButton, IconButton as KitIconButton } from "@jmouse/ui-kit";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePermissions } from "../../access/PermissionsProvider";
import { PERMISSIONS } from "../../access/permissions";
import { useReadySession } from "../../application/session";
import { useAddressChange } from "../../application/useAddressChange";
import { usePageTitle } from "../../application/usePageTitle";
import { useResource } from "../../application/useResource";
import type { FileEntry } from "../../lib/files";
import { useTranslation, type Translation } from "../../translations/TranslationProvider";
import { ProblemState, Waiting } from "../../ui/components";
import { usePageTrail } from "../../ui/shell/shellTrail";
import { DocumentReading } from "./DocumentReading";
import { folderEntryId, LibraryFiles, placeOf } from "./LibraryFiles";
import { LIBRARY_PAGE } from "./libraryClasses";
import { familiesOf, openTabsOf, type LibrarySearch } from "./librarySearch";
import { QuickOpen } from "./QuickOpen";
import { ReadingMode } from "./ReadingMode";
import { useReadingPreference } from "./readingPreference";

const MOST_TABS = 12;

/**
 * The Library: the workspace's material, browsed and read in one place.
 *
 * The explorer is `@jmouse/explorer` over {@link LibraryFiles} — the sources as the top of the tree, their folders,
 * their files — and a document opened from it is read where it was opened, as a tab, with its outline and the
 * documents that share its subject. The place and every open document are in the address, so a reading session can be
 * bookmarked or sent; reading mode takes the document alone over the whole screen.
 */
export function LibraryPage() {
  const translation = useTranslation();
  const { t } = translation;
  usePageTitle(t("library.title", "Library"));
  const { workspace } = useReadySession();
  const workspaceId = workspace?.id ?? "";
  const permissions = usePermissions();
  const mayWriteDocuments = permissions.may(PERMISSIONS.documentWrite);
  const search = useSearch({ strict: false }) as LibrarySearch;
  const changeAddress = useAddressChange();
  const navigate = useNavigate();
  const [quickOpen, setQuickOpen] = useState(false);
  const [readingPreferred] = useReadingPreference();
  const includeRemoved = search.removed === true;
  const families = familiesOf(search);
  const [location, setLocation] = useState<ExplorerLocation | null>(null);

  const library = useMemo(
    () =>
      new LibraryFiles({
        workspaceId,
        mayWriteDocuments,
        includeRemoved,
        readingLinkOf: (file) => readingLinkOf(file),
        words: {
          notText: (name) => t("files.upload.notText", "{name}: not a text file", { name }),
          emptyOrLarge: (name) => t("files.upload.emptyOrLarge", "{name}: empty or larger than a million characters", { name }),
        },
      }),
    [workspaceId, mayWriteDocuments, includeRemoved, t],
  );

  const folderId = search.source === undefined ? null : folderEntryId({ sourceId: search.source, folder: search.folder ?? "" });
  const openIds = openTabsOf(search);
  const activeId = search.active !== undefined && openIds.includes(search.active) ? search.active : undefined;

  // ⚠️ ONE ADDRESS CHANGE PER MOMENT. Going to a folder tells the host twice — the folder, and that the document in
  // front steps back — and two navigations built from the same address would each undo the other's half. Every change
  // made in one turn of the event loop is merged and written once.
  const pendingAddress = useRef<Partial<LibrarySearch> | null>(null);
  const changeLibraryAddress = (next: Partial<LibrarySearch>) => {
    if (pendingAddress.current !== null) {
      Object.assign(pendingAddress.current, next);
      return;
    }
    pendingAddress.current = { ...next };
    queueMicrotask(() => {
      const merged = pendingAddress.current ?? {};
      pendingAddress.current = null;
      void changeAddress({ to: "/library", search: { ...search, ...merged } });
    });
  };

  const showFolder = (nextFolderId: string | null) => {
    const place = nextFolderId === null ? undefined : placeOf(nextFolderId);
    changeLibraryAddress({ source: place?.sourceId, folder: place === undefined || place.folder === "" ? undefined : place.folder });
  };
  const showOpenFiles = (nextOpenIds: string[], nextActiveId: string | undefined) => {
    changeLibraryAddress({
      open: nextOpenIds.length === 0 ? undefined : nextOpenIds.slice(-MOST_TABS).join(","),
      active: nextActiveId,
      // A document newly put in front is read alone when reading mode is the reader's choice.
      read: nextActiveId !== undefined && nextActiveId !== activeId && readingPreferred ? true : search.read,
    });
  };
  const openDocument = (versionId: string) => showOpenFiles(openIds.includes(versionId) ? openIds : [...openIds, versionId], versionId);

  // Ctrl+K (⌘K) opens any document by name, from anywhere on the page.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setQuickOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const labels = useMemo(() => explorerLabelsOf(translation), [translation]);

  // ONE BREADCRUMB: the topbar already names Knowledge › Library, and the Library hands it the rest of the way —
  // the source, the folders, the document in front — with the count folded into the same line.
  const showPlace = (nextFolderId: string | null) => {
    const place = nextFolderId === null ? undefined : placeOf(nextFolderId);
    changeLibraryAddress({ source: place?.sourceId, folder: place === undefined || place.folder === "" ? undefined : place.folder, active: undefined });
  };
  const reading = location?.activeFile;
  usePageTrail(
    location === null
      ? null
      : {
          onRoot: () => showPlace(null),
          steps: [
            ...location.trail.map((folder, index) => ({
              label: folder.name,
              onSelect: reading === undefined && index === location.trail.length - 1 ? undefined : () => showPlace(folder.id),
            })),
            ...(reading === undefined ? [] : [{ label: reading.name }]),
          ],
          note:
            reading !== undefined
              ? undefined
              : location.shown < location.total
                ? t("library.count.narrowed", "{shown} of {total}", { shown: String(location.shown), total: String(location.total) })
                : labels.itemCount?.(location.total),
        },
  );

  const quickOpenControl = (
    <span className="flex items-center gap-1 px-1">
      <span className="max-[600px]:hidden">
        <KitButton size="small" variant="quiet" icon="search" shortcut="Ctrl+K" onClick={() => setQuickOpen(true)}>
          {t("library.quickOpenButton", "Open…")}
        </KitButton>
      </span>
      <span className="hidden max-[600px]:inline-flex">
        <KitIconButton size="small" icon="search" label={t("library.quickOpen", "Open a document")} onClick={() => setQuickOpen(true)} />
      </span>
    </span>
  );

  return (
    <div className={LIBRARY_PAGE} data-page-flush="">
      <h1 className="sr-only" tabIndex={-1} data-page-title="">
        {t("library.title", "Library")}
      </h1>
      <Explorer
          adapter={library}
          presentation="page"
          className="h-full"
          onLocationChange={setLocation}
          tabsEnd={quickOpenControl}
          families={families}
          onFamiliesChange={(next) => changeLibraryAddress({ types: next.length === 0 ? undefined : next.join(",") })}
          toggles={[
            {
              id: "removed",
              label: t("library.showRemoved", "Show removed"),
              icon: "trash",
              pressed: includeRemoved,
              onPressedChange: (pressed) => changeLibraryAddress({ removed: pressed ? true : undefined }),
            },
          ]}
          folderId={folderId}
          onFolderChange={showFolder}
          openFileIds={openIds}
          activeFileId={activeId}
          onOpenFilesChange={showOpenFiles}
          labels={labels}
          formatDate={(iso) => new Date(iso).toLocaleDateString(translation.language, { day: "2-digit", month: "2-digit", year: "numeric" })}
          defaultView="list"
          storageKey="raccoon.library.folders"
          key={includeRemoved ? "with-removed" : "present"}
          extraActions={(entry) =>
            entry.kind === "file"
              ? [
                  {
                    label: t("files.action.openDocument", "Open its document"),
                    icon: "external",
                    onSelect: () => {
                      void library.fileOf(entry.id).then((file) => navigate({ to: "/documents/$documentId", params: { documentId: file.documentId } }));
                    },
                  },
                ]
              : []
          }
          renderFile={(entry) => (
            <LibraryReading
              library={library}
              entry={entry}
              onOpen={openDocument}
              onRead={() => changeLibraryAddress({ read: true })}
              onShowPlace={(file) => {
                showFolder(folderEntryId({ sourceId: file.sourceId, folder: file.folder }));
                showOpenFiles(openIds, undefined);
              }}
            />
          )}
        />
      {search.read === true && activeId !== undefined && (
        <LibraryReadingMode library={library} openIds={openIds} activeId={activeId} onOpen={openDocument} onExit={() => changeLibraryAddress({ read: undefined })} />
      )}
      <QuickOpen open={quickOpen} workspaceId={workspaceId} onClose={() => setQuickOpen(false)} onOpen={(file) => openDocument(file.versionId)} />
    </div>
  );
}

/** An absolute link that opens one document for reading, in its folder. */
function readingLinkOf(file: FileEntry): string {
  const parameters = new URLSearchParams({ source: file.sourceId, open: file.versionId, active: file.versionId });
  if (file.folder !== "") {
    parameters.set("folder", file.folder);
  }
  return `${window.location.origin}/library?${parameters.toString()}`;
}

interface LibraryReadingProperties {
  library: LibraryFiles;
  entry: ExplorerEntry;
  onOpen: (versionId: string) => void;
  onRead: () => void;
  onShowPlace: (file: FileEntry) => void;
}

/** A document open as a tab: Raccoon's own reader, over the file as Raccoon describes it. */
function LibraryReading({ library, entry, onOpen, onRead, onShowPlace }: LibraryReadingProperties) {
  const { t } = useTranslation();
  const file = useResource(() => library.fileOf(entry.id), [library, entry.id]);
  const trees = useResource(() => library.sourceTrees(), [library]);
  if (file.status === "loading") {
    return <Waiting label={t("library.opening", "Opening the document")} lines={6} />;
  }
  if (file.status === "failed") {
    return <ProblemState layout="section" problem={file.problem} />;
  }
  const sourceName = trees.status === "ready" ? (trees.data.find((tree) => tree.sourceId === file.data.sourceId)?.name ?? null) : null;
  return (
    <DocumentReading
      key={file.data.versionId}
      workspaceId={library.workspaceId}
      file={file.data}
      sourceName={sourceName}
      onOpen={onOpen}
      onRead={onRead}
      onShowPlace={() => onShowPlace(file.data)}
    />
  );
}

interface LibraryReadingModeProperties {
  library: LibraryFiles;
  openIds: string[];
  activeId: string;
  onOpen: (versionId: string) => void;
  onExit: () => void;
}

/** Reading mode over the open documents: the one in front alone, with the tabs on either side a step away. */
function LibraryReadingMode({ library, openIds, activeId, onOpen, onExit }: LibraryReadingModeProperties) {
  const files = useResource(() => Promise.all(openIds.map((versionId) => library.fileOf(versionId))), [library, openIds.join(",")]);
  if (files.status !== "ready") {
    return null;
  }
  const index = files.data.findIndex((file) => file.versionId === activeId);
  if (index < 0) {
    return null;
  }
  return (
    <ReadingMode
      workspaceId={library.workspaceId}
      file={files.data[index]!}
      previous={files.data[index - 1]}
      next={files.data[index + 1]}
      onOpen={(file) => onOpen(file.versionId)}
      onExit={onExit}
    />
  );
}

/**
 * The explorer's words, in the reader's language — every one of them, the acts this Library does not offer included, so
 * nothing the explorer can ever say arrives in English.
 *
 * ⚠️ A sentence with a name or a reason in it is one catalogue entry with placeholders, so a translation decides where
 * the name and the reason go. The reason is the server's own words, bracketed when there are any.
 */
function explorerLabelsOf({ t, plural }: Translation): Partial<ExplorerLabels> {
  const reasonOf = (reason: string) => (reason === "" ? "" : ` (${reason})`);
  return {
    // the workspace's frame
    folders: t("library.explorer.folders", "Folders"),
    files: t("library.explorer.files", "Files"),
    root: t("library.explorer.root", "All sources"),
    path: t("library.explorer.path", "Where you are"),
    up: t("library.explorer.up", "Up one level"),
    showFolders: t("library.explorer.showFolders", "Show folders"),
    hideFolders: t("library.explorer.hideFolders", "Hide folders"),
    search: t("library.explorer.search", "Filter this folder"),
    view: t("library.explorer.view", "View"),
    tiles: t("library.explorer.tiles", "Tiles"),
    list: t("library.explorer.list", "List"),
    sort: t("library.explorer.sort", "Sort"),
    name: t("library.explorer.name", "Name"),
    size: t("library.explorer.size", "Size"),
    modified: t("library.explorer.captured", "Captured"),
    ascending: t("library.explorer.ascending", "Name: A–Z"),
    descending: t("library.explorer.descending", "Name: Z–A"),
    folder: t("library.explorer.folder", "Folder"),
    empty: t("library.explorer.empty", "Nothing is filed here"),
    emptyDescription: t("library.explorer.emptyDescription", "Choose another folder, or capture documents into this one."),
    noResults: t("library.explorer.noResults", "Nothing here matches"),
    clearSearch: t("library.explorer.clearSearch", "Clear the filter"),
    loading: t("library.explorer.loading", "Reading the folder"),
    unavailable: t("library.explorer.unavailable", "This folder is not there any more"),
    unavailableDescription: t("library.explorer.unavailableDescription", "Its documents may have been removed, or the source changed."),
    preview: t("library.explorer.preview", "Document"),
    close: t("library.explorer.close", "Close"),
    options: t("library.explorer.options", "Actions"),
    itemCount: (count) => plural("library.explorer.itemCount", count, { one: "{count} item", other: "{count} items" }),
    dropFiles: t("library.explorer.dropFiles", "Drop files to capture them into this folder"),
    // the type filter, and what was removed
    type: t("library.explorer.type", "Type"),
    allTypes: t("library.explorer.allTypes", "All"),
    familyNames: {
      document: t("library.explorer.family.document", "Documents"),
      code: t("library.explorer.family.code", "Code"),
      data: t("library.explorer.family.data", "Data"),
      sheet: t("library.explorer.family.sheet", "Sheets"),
      image: t("library.explorer.family.image", "Images"),
      audio: t("library.explorer.family.audio", "Audio"),
      video: t("library.explorer.family.video", "Video"),
      archive: t("library.explorer.family.archive", "Archives"),
      file: t("library.explorer.family.file", "Other"),
    },
    noneOfTypes: t("library.explorer.noneOfTypes", "Nothing here is of the chosen types"),
    showAllTypes: t("library.explorer.showAllTypes", "Show every type"),
    removed: t("library.explorer.removed", "Removed"),
    // the acts
    upload: t("library.explorer.upload", "Capture files"),
    newFolder: t("library.explorer.newFolder", "New folder"),
    folderName: t("library.explorer.folderName", "Folder name"),
    createFolder: t("library.explorer.createFolder", "Create folder"),
    renameTitle: t("library.explorer.renameTitle", "Rename"),
    newName: t("library.explorer.newName", "New name"),
    saveName: t("library.explorer.saveName", "Rename"),
    open: t("library.explorer.open", "Open"),
    download: t("library.explorer.download", "Download"),
    copyLink: t("library.explorer.copyLink", "Copy a link to read it"),
    rename: t("library.explorer.rename", "Rename"),
    move: t("library.explorer.move", "Move to…"),
    moveTitle: (name) => t("library.explorer.moveTitle", "Move “{name}”", { name }),
    moveDescription: t("library.explorer.moveDescription", "Choose the folder it goes into."),
    moveHere: t("library.explorer.moveHere", "Move here"),
    remove: t("library.explorer.remove", "Remove from the corpus"),
    restore: t("library.explorer.restore", "Restore to the corpus"),
    removeTitle: (name) => t("library.explorer.removeTitle", "Remove “{name}” from the corpus", { name }),
    removeFileDescription: t("library.explorer.removeFileDescription", "Search no longer finds it. The original is kept, and it can be restored."),
    removeFolderDescription: t("library.explorer.removeFolderDescription", "A folder that still holds something is refused rather than emptied."),
    nameRequired: t("library.explorer.nameRequired", "A name is required."),
    nameInvalid: t("library.explorer.nameInvalid", "A name cannot contain / or \\."),
    nameTaken: t("library.explorer.nameTaken", "Something in this folder already has that name."),
    cancel: t("library.explorer.cancel", "Cancel"),
    dismiss: t("library.explorer.dismiss", "Dismiss"),
    uploading: (done, total) => t("library.explorer.uploading", "Capturing {done} of {total}", { done: String(done), total: String(total) }),
    // what went wrong
    unreadable: (reason) => t("library.explorer.unreadable", "The folder could not be read{reason}.", { reason: reasonOf(reason) }),
    shapeUnreadable: (reason) => t("library.explorer.shapeUnreadable", "The sources could not be read{reason}.", { reason: reasonOf(reason) }),
    createFailed: (name, reason) => t("library.explorer.createFailed", "The folder “{name}” was not created{reason}.", { name, reason: reasonOf(reason) }),
    renameFailed: (name, reason) => t("library.explorer.renameFailed", "“{name}” was not renamed{reason}.", { name, reason: reasonOf(reason) }),
    moveFailed: (name, reason) => t("library.explorer.moveFailed", "“{name}” was not moved{reason}.", { name, reason: reasonOf(reason) }),
    uploadFailed: (name, reason) => t("library.explorer.uploadFailed", "“{name}” was not captured{reason}.", { name, reason: reasonOf(reason) }),
    removeFailed: (name, reason) => t("library.explorer.removeFailed", "“{name}” was not removed{reason}.", { name, reason: reasonOf(reason) }),
    restoreFailed: (name, reason) => t("library.explorer.restoreFailed", "“{name}” was not restored{reason}.", { name, reason: reasonOf(reason) }),
    downloadFailed: (name, reason) => t("library.explorer.downloadFailed", "“{name}” could not be downloaded{reason}.", { name, reason: reasonOf(reason) }),
    copyFailed: (name, reason) => t("library.explorer.copyFailed", "The link to “{name}” could not be copied{reason}.", { name, reason: reasonOf(reason) }),
    // the plain viewer, should a file ever be shown without Raccoon's own reader
    reading: t("library.explorer.reading", "Reading the file"),
    readFailed: (name, reason) => t("library.explorer.readFailed", "“{name}” could not be read{reason}.", { name, reason: reasonOf(reason) }),
    notShowable: t("library.explorer.notShowable", "This file cannot be shown here"),
    notShowableDescription: t("library.explorer.notShowableDescription", "Download it to open it with an application."),
    needsConverting: t("library.explorer.needsConverting", "This document needs converting before it can be shown."),
    noBytes: t("library.explorer.noBytes", "This place does not offer the file's contents."),
    notOpenable: t("library.explorer.notOpenable", "This document cannot be opened here"),
  };
}
