import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { usePermissions } from "../../access/PermissionsProvider";
import { PERMISSIONS } from "../../access/permissions";
import { formatBytes } from "../../application/format";
import { describeProblem } from "../../application/problems";
import { useReadySession } from "../../application/session";
import { usePageTitle } from "../../application/usePageTitle";
import { usePagedList } from "../../application/usePagedList";
import { useResource } from "../../application/useResource";
import { api } from "../../lib/api";
import { downloadFile, filesApi, type FileEntry, type FileOrder, type SourceTree } from "../../lib/files";
import { readingFormatOf, type ReadingKind } from "../../ui/components/reader/readingFormat";
import { declareText, type DeclaredText } from "../../translations/translate";
import { FilePreview } from "./FilePreview";
import { ReadingMode } from "../library/ReadingMode";
import type { LibrarySearch } from "../library/librarySearch";
import { useReadingPreference } from "../library/readingPreference";
import { useTranslation } from "../../translations/TranslationProvider";
import { ConfirmDialog, EmptyState, ListFooter, PageHeader, ProblemState, Segmented, Waiting, useToaster, type MenuItem } from "../../ui/components";
import { Button, Checkbox, Icon, Input, Select } from "../../ui/primitives";
import { FileArea, type FileView, type FolderTile } from "./FileArea";
import { FileTree, childrenByParent, type FilePlace } from "./FileTree";
import { FileViewer } from "./FileViewer";
import { PlacePicker } from "./PlacePicker";
import { AREA, BAND, BAND_END, BAND_FIELD, BAND_WORD, PLACE_NARROW, TREE_WIDE, CRUMB, CRUMBS, LAYOUT, LAYOUT_WITH_PREVIEW, NOTE, SEARCH } from "./filesClasses";

const KIND_WORDS: Record<ReadingKind, DeclaredText> = {
  markdown: declareText("files.kind.markdown", "Markdown"),
  text: declareText("files.kind.text", "Text"),
  code: declareText("files.kind.code", "Code"),
  pdf: declareText("files.kind.pdf", "PDF"),
  book: declareText("files.kind.book", "Books"),
  image: declareText("files.kind.image", "Images"),
  audio: declareText("files.kind.audio", "Audio"),
  video: declareText("files.kind.video", "Video"),
  none: declareText("files.kind.other", "Other"),
};
import { useAddressChange } from "../../application/useAddressChange";

export interface FilesSearch {
  source?: string;
  folder?: string;
  text?: string;
  view?: FileView;
  removed?: boolean;
  /** Open over the whole screen. */
  file?: string;
  /** Chosen, and shown in the preview beside the list. */
  pick?: string;
  order?: FileOrder;
  /** Only files of this reading kind — markdown, code, pdf, image… */
  kind?: ReadingKind;
}

/** The kinds a reader thinks in, in the order the filter offers them. */
const KIND_ORDER: ReadingKind[] = ["markdown", "text", "code", "pdf", "book", "image", "audio", "video", "none"];

/** The text a CUSTOM_TEXT source accepts from an upload; anything else is refused before it is read. */
const TEXT_UPLOAD = /\.(txt|md|markdown|text|csv|json|yaml|yml|xml|log)$/i;
const LARGEST_UPLOAD_CHARACTERS = 1_048_576;

/**
 * Every original the workspace captured, browsed as files: the sources, the folders their paths make,
 * and the files in each — opened over the whole screen, saved, or taken out of the corpus. Laid out
 * the way Kitsu lays out its cabinets: the tree on the left, the place's files on the right.
 */
export function FilesPage({ modeSwitch }: { modeSwitch?: ReactNode } = {}) {
  const { workspace } = useReadySession();
  const workspaceId = workspace?.id ?? "";
  const search = useSearch({ strict: false }) as FilesSearch;
  const navigate = useNavigate();
  const changeAddress = useAddressChange();
  const permissions = usePermissions();
  const { notify } = useToaster();
  const { t, plural, say } = useTranslation();
  const mayWriteDocuments = permissions.may(PERMISSIONS.documentWrite);
  const uploadInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [textDraft, setTextDraft] = useState(search.text ?? "");
  const [removing, setRemoving] = useState<FileEntry | null>(null);

  const includeRemoved = search.removed === true;
  const reading = (search as LibrarySearch).read === true;
  // With reading mode chosen, opening a file reads it: the document alone, not a viewer full of controls.
  const [readingPreferred] = useReadingPreference();
  const view: FileView = search.view ?? "grid";
  const place: FilePlace = search.source === undefined ? {} : { sourceId: search.source, folder: search.folder ?? "" };
  const text = search.text?.trim() ?? "";
  const order: FileOrder = search.order ?? "NAME";

  const go = (next: Partial<LibrarySearch>, replace = false) => {
    void changeAddress({ to: "/library", search: { ...search, ...next, mode: "files" } as LibrarySearch, replace });
  };
  const openPlace = (next: FilePlace) => {
    go({ source: next.sourceId, folder: next.sourceId === undefined || next.folder === "" ? undefined : next.folder, file: undefined, pick: undefined });
  };

  const trees = useResource(() => filesApi.tree(workspaceId, includeRemoved), [workspaceId, includeRemoved]);
  // At the top of the workspace only folders are shown, as a cabinet's top level is in Kitsu; a search
  // looks through every file instead.
  const listsFiles = place.sourceId !== undefined || text.length > 0;
  const files = usePagedList(
    (page) =>
      listsFiles
        ? filesApi.list(workspaceId, { sourceId: place.sourceId, folder: text.length > 0 ? undefined : place.folder, text, includeRemoved, order }, page)
        : Promise.resolve([]),
    [workspaceId, place.sourceId, place.folder, text, includeRemoved, listsFiles, order],
  );

  const tree = trees.status === "ready" ? (trees.data.find((candidate) => candidate.sourceId === place.sourceId) ?? null) : null;
  const folderNode = tree !== null && place.folder !== undefined && place.folder !== "" ? (tree.folders.find((folder) => folder.path === place.folder) ?? null) : null;
  const placeName = folderNode?.name ?? tree?.name ?? null;
  const heading = placeName ?? t("files.allFiles", "All files");
  usePageTitle(placeName ?? t("files.title", "Files"));

  const folderTiles = useMemo<FolderTile[]>(() => {
    if (trees.status !== "ready" || text.length > 0) {
      return [];
    }
    if (place.sourceId === undefined) {
      return trees.data.map((source) => ({
        key: source.sourceId,
        name: source.name,
        files: source.files,
        bytes: source.bytes,
        onOpen: () => openPlace({ sourceId: source.sourceId, folder: "" }),
      }));
    }
    if (tree === null) {
      return [];
    }
    return (childrenByParent(tree.folders).get(place.folder ?? "") ?? []).map((folder) => ({
      key: folder.path,
      name: folder.name,
      files: folder.filesBelow,
      bytes: folder.bytesBelow,
      onOpen: () => openPlace({ sourceId: tree.sourceId, folder: folder.path }),
    }));
    // openPlace closes over the current search, which every dependency below already follows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trees, tree, place.sourceId, place.folder, text]);

  // Names sort as people read them — ID-2 before ID-10 — within what has been loaded; size and date keep the server's order.
  const loadedFiles = useMemo(
    () =>
      files.status !== "ready"
        ? []
        : order === "NAME"
          ? [...files.items].sort((first, second) => first.path.localeCompare(second.path, undefined, { numeric: true }))
          : files.items,
    [files, order],
  );
  const kindsHere = useMemo(() => {
    const present = new Set(loadedFiles.map((entry) => readingFormatOf(entry.name, entry.effectiveMediaType).kind));
    return KIND_ORDER.filter((kind) => present.has(kind));
  }, [loadedFiles]);
  const shownFiles = useMemo(
    () => (search.kind === undefined ? loadedFiles : loadedFiles.filter((entry) => readingFormatOf(entry.name, entry.effectiveMediaType).kind === search.kind)),
    [loadedFiles, search.kind],
  );
  const openFile = shownFiles.find((file) => file.versionId === search.file) ?? null;
  const pickedFile = shownFiles.find((file) => file.versionId === search.pick) ?? null;
  const download = (target: FileEntry) =>
    void downloadFile(workspaceId, target).catch((error: unknown) => {
      const problem = describeProblem(error);
      notify({ tone: "error", title: problem.title, description: problem.detail ?? problem.description });
    });

  const refresh = () => {
    trees.reload();
    files.reload();
  };

  const actionsOf = (file: FileEntry): MenuItem[] => {
    const items: MenuItem[] = [
      { label: t("files.action.open", "Open"), icon: "eye", onSelect: () => go({ file: file.versionId }) },
      {
        label: t("files.action.download", "Download"),
        icon: "download",
        onSelect: () => download(file),
      },
      { label: t("files.action.openDocument", "Open its document"), icon: "documents", onSelect: () => void navigate({ to: "/documents/$documentId", params: { documentId: file.documentId } }) },
    ];
    if (mayWriteDocuments) {
      items.push(
        file.removedAt === null
          ? { label: t("files.action.remove", "Remove from the corpus"), icon: "trash", destructive: true, onSelect: () => setRemoving(file) }
          : { label: t("files.action.restore", "Restore"), icon: "refresh", onSelect: () => void restoreFile(file) },
      );
    }
    return items;
  };

  const removeFile = async (file: FileEntry) => {
    try {
      await api.removeDocument(workspaceId, { id: file.documentId, revision: file.versionNumber });
      notify({
        tone: "good",
        title: t("files.removedNotice", "{name} removed", { name: file.name }),
        description: t("files.removedDescription", "Search no longer finds it."),
      });
      refresh();
    } catch (error) {
      const problem = describeProblem(error);
      notify({ tone: "error", title: problem.title, description: problem.detail ?? problem.description });
    }
  };

  const restoreFile = async (file: FileEntry) => {
    try {
      await api.restoreDocument(workspaceId, file.documentId);
      notify({
        tone: "good",
        title: t("files.restoredNotice", "{name} restored", { name: file.name }),
        description: t("documents.removal.restoredDescription", "Process or publish it again to make it searchable."),
      });
      refresh();
    } catch (error) {
      const problem = describeProblem(error);
      notify({ tone: "error", title: problem.title, description: problem.detail ?? problem.description });
    }
  };

  const upload = async (picked: FileList | null) => {
    if (picked === null || tree === null) {
      return;
    }
    if (tree.kind === "MANAGED_FOLDER") {
      await uploadToManagedFolder([...picked], tree.sourceId);
      return;
    }
    setBusy(true);
    const refused: string[] = [];
    let captured = 0;
    for (const file of [...picked]) {
      if (!TEXT_UPLOAD.test(file.name)) {
        refused.push(t("files.upload.notText", "{name}: not a text file", { name: file.name }));
        continue;
      }
      const content = await file.text();
      if (content.trim().length === 0 || content.length > LARGEST_UPLOAD_CHARACTERS) {
        refused.push(t("files.upload.emptyOrLarge", "{name}: empty or larger than a million characters", { name: file.name }));
        continue;
      }
      const path = place.folder === undefined || place.folder === "" ? file.name : `${place.folder}/${file.name}`;
      const existing = shownFiles.find((candidate) => candidate.path === path);
      try {
        await api.captureText(workspaceId, tree.sourceId, { externalId: path, title: file.name, text: content, revision: existing?.versionNumber ?? 0 });
        captured += 1;
      } catch (error) {
        refused.push(t("files.upload.refused", "{name}: {reason}", { name: file.name, reason: describeProblem(error).title }));
      }
    }
    setBusy(false);
    if (uploadInput.current !== null) {
      uploadInput.current.value = "";
    }
    notify({
      tone: refused.length === 0 ? "good" : "error",
      title:
        captured === 0
          ? t("files.upload.nothingCaptured", "Nothing captured")
          : plural("files.upload.captured", captured, { one: "{count} file captured", other: "{count} files captured" }),
      description: refused.length === 0 ? undefined : refused.join(" · "),
    });
    refresh();
  };

  /** A managed folder takes the files as they are, into the folder open here; the server judges each one. */
  const uploadToManagedFolder = async (picked: File[], sourceId: string) => {
    setBusy(true);
    try {
      const outcomes = await api.uploadToManagedFolder(workspaceId, sourceId, picked, place.folder ?? "");
      const refused = outcomes.filter((outcome) => outcome.version === null);
      notify({
        tone: refused.length === 0 ? "good" : "error",
        title:
          refused.length === outcomes.length
            ? t("files.upload.nothingUploaded", "Nothing uploaded")
            : plural("files.upload.uploaded", outcomes.length - refused.length, {
                one: "{count} file uploaded",
                other: "{count} files uploaded",
              }),
        description: refused.length === 0 ? undefined : refused.map((outcome) => `${outcome.fileName}: ${outcome.refusal}`).join(" · "),
      });
    } catch (error) {
      const problem = describeProblem(error);
      notify({ tone: "error", title: problem.title, description: problem.detail ?? problem.description });
    } finally {
      setBusy(false);
      if (uploadInput.current !== null) {
        uploadInput.current.value = "";
      }
      refresh();
    }
  };

  if (trees.status === "loading") {
    return <Waiting label={t("files.loading", "Reading the files")} lines={6} />;
  }
  if (trees.status === "failed") {
    return <ProblemState problem={trees.problem} actions={<Button icon="refresh" variant="primary" onClick={trees.reload}>{t("common.tryAgain", "Try again")}</Button>} />;
  }

  const crumbs = crumbsOf(tree, place.folder);
  const fileCount = files.status === "ready" ? files.items.length : 0;
  const totals = placeTotals(trees.data, tree, folderNode);

  return (
    <>
      <PageHeader
        eyebrow={
          <span className={CRUMBS}>
            <button type="button" className={CRUMB} onClick={() => openPlace({})}>
              {t("files.title", "Files")}
            </button>
            {crumbs.map((crumb) => (
              <span key={crumb.folder ?? "source"}>
                {" / "}
                <button type="button" className={CRUMB} onClick={() => tree !== null && openPlace({ sourceId: tree.sourceId, folder: crumb.folder ?? "" })}>
                  {crumb.name}
                </button>
              </span>
            ))}
          </span>
        }
        title={heading}
        actions={modeSwitch}
        lead={
          <span className="numeric">
            {place.sourceId === undefined
              ? plural("files.sourceCount", folderTiles.length, { one: "{count} source", other: "{count} sources" })
              : plural("files.folderCount", folderTiles.length, { one: "{count} folder", other: "{count} folders" })}
            {listsFiles &&
              (files.status === "ready" && files.hasMore
                ? plural("files.hereMore", fileCount, { one: " · {count}+ file here", other: " · {count}+ files here" })
                : plural("files.here", fileCount, { one: " · {count} file here", other: " · {count} files here" }))}
            {plural(
              "files.inAll",
              totals.files,
              { one: " · {count} file in all · {size}", other: " · {count} files in all · {size}" },
              { size: formatBytes(totals.bytes) },
            )}
          </span>
        }
      />

      <div className={BAND}>
        <form
          role="search"
          className={SEARCH}
          onSubmit={(event) => {
            event.preventDefault();
            go({ text: textDraft.trim() === "" ? undefined : textDraft.trim(), file: undefined });
          }}
        >
          <Icon name="search" size="small" />
          <Input
            type="search"
            aria-label={t("files.find", "Find a file")}
            placeholder={t("files.findPlaceholder", "A file name or path…")}
            value={textDraft}
            onChange={(event) => {
              setTextDraft(event.target.value);
              if (event.target.value === "" && text !== "") {
                go({ text: undefined }, true);
              }
            }}
          />
        </form>
        <Segmented<FileView>
          label={t("files.view", "View")}
          value={view}
          onChange={(next) => go({ view: next === "grid" ? undefined : next }, true)}
          options={[
            { value: "grid", label: t("files.view.tiles", "Tiles") },
            { value: "list", label: t("files.view.list", "List") },
          ]}
        />
        {listsFiles && (
          <label className={BAND_FIELD}>
            <span className={BAND_WORD}>{t("files.order", "Sort")}</span>
            <Select value={order} onChange={(event) => go({ order: event.target.value === "NAME" ? undefined : (event.target.value as FileOrder) }, true)}>
              <option value="NAME">{t("files.order.name", "Name")}</option>
              <option value="CAPTURED">{t("files.order.captured", "Newest first")}</option>
              <option value="SIZE">{t("files.order.size", "Largest first")}</option>
            </Select>
          </label>
        )}
        {kindsHere.length > 1 && (
          <label className={BAND_FIELD}>
            <span className={BAND_WORD}>{t("files.kind", "Kind")}</span>
            <Select value={search.kind ?? ""} onChange={(event) => go({ kind: event.target.value === "" ? undefined : (event.target.value as ReadingKind), pick: undefined }, true)}>
              <option value="">{t("files.kind.all", "All kinds")}</option>
              {kindsHere.map((kind) => (
                <option key={kind} value={kind}>
                  {say(KIND_WORDS[kind])}
                </option>
              ))}
            </Select>
          </label>
        )}
        <Checkbox label={t("documents.entries.showRemoved", "Show removed")} checked={includeRemoved} onChange={(event) => go({ removed: event.target.checked ? true : undefined }, true)} />
        <div className={BAND_END}>
          {(tree?.kind === "CUSTOM_TEXT" || tree?.kind === "MANAGED_FOLDER") && mayWriteDocuments && (
            <>
              <input
                ref={uploadInput}
                type="file"
                multiple
                hidden
                accept={tree.kind === "CUSTOM_TEXT" ? ".txt,.md,.markdown,.text,.csv,.json,.yaml,.yml,.xml,.log,text/*" : undefined}
                onChange={(event) => void upload(event.target.files)}
              />
              <Button variant="primary" icon="upload" disabled={busy} onClick={() => uploadInput.current?.click()}>
                {busy
                  ? t("files.uploading", "Uploading…")
                  : tree.kind === "CUSTOM_TEXT"
                    ? t("files.uploadText", "Upload text")
                    : t("files.uploadFiles", "Upload files")}
              </Button>
            </>
          )}
        </div>
      </div>

      <PlacePicker className={PLACE_NARROW} trees={trees.data} place={place} onSelect={openPlace} />
      <div className={pickedFile === null ? LAYOUT : LAYOUT_WITH_PREVIEW}>
        <div className={TREE_WIDE}>
          <FileTree trees={trees.data} place={place} onSelect={openPlace} />
        </div>
        <section className={AREA} aria-label={t("files.filesIn", "Files in {place}", { place: heading })}>
          {files.status === "failed" && <ProblemState layout="section" problem={files.problem} actions={<Button icon="refresh" onClick={files.reload}>{t("common.tryAgain", "Try again")}</Button>} />}
          {files.status === "loading" && folderTiles.length === 0 && <p className="text-xs text-muted">{t("files.reading", "Reading…")}</p>}
          {files.status === "ready" && folderTiles.length === 0 && shownFiles.length === 0 ? (
            <EmptyHere text={text} sourceName={tree?.name ?? null} folder={place.folder} hasSources={trees.data.length > 0} />
          ) : (
            <FileArea
              workspaceId={workspaceId}
              view={view}
              folders={folderTiles}
              files={shownFiles}
              selectedId={pickedFile?.versionId ?? null}
              showPaths={text.length > 0}
              actionsOf={actionsOf}
              onSelectFile={(file) => go({ pick: file.versionId }, true)}
              onOpenFile={(file) => go({ file: file.versionId, pick: file.versionId })}
            />
          )}
          {files.status === "ready" && listsFiles && shownFiles.length > 0 && (
            <ListFooter
              shown={shownFiles.length}
              counted={plural("files.count", shownFiles.length, { one: "{count} file", other: "{count} files" })}
              hasMore={files.hasMore} loadingMore={files.loadingMore} moreProblem={files.moreProblem} onLoadMore={files.loadMore} />
          )}
          {place.sourceId !== undefined && text.length === 0 && (
            <p className={`eyebrow ${NOTE}`}>
              {t("files.folderNote", "A folder shows what is filed in it, not what is filed under it")}
            </p>
          )}
        </section>
        {pickedFile !== null && (
          <FilePreview
            workspaceId={workspaceId}
            file={pickedFile}
            sourceName={trees.data.find((source) => source.sourceId === pickedFile.sourceId)?.name ?? null}
            onOpenFull={() => go({ file: pickedFile.versionId })}
            onRead={() => go({ file: pickedFile.versionId, read: true })}
            onDownload={() => download(pickedFile)}
            actions={actionsOf(pickedFile)}
            onClose={() => go({ pick: undefined }, true)}
          />
        )}
      </div>

      <ConfirmDialog
        open={removing !== null}
        title={removing === null ? "" : t("files.removeTitle", "Remove {name}", { name: removing.name })}
        confirmLabel={t("files.action.remove", "Remove from the corpus")}
        destructive
        onConfirm={() => {
          if (removing !== null) {
            const target = removing;
            setRemoving(null);
            void removeFile(target);
          }
        }}
        onCancel={() => setRemoving(null)}
      >
        <p>
          {t(
            "files.removeEffectSearch",
            "Search, context and answers stop finding it, and every vector generation that holds it is withdrawn.",
          )}
        </p>
        <p>
          {t(
            "files.removeEffectScans",
            "Scans skip it from now on. Nothing is erased — it can be restored here or from its document.",
          )}
        </p>
      </ConfirmDialog>

      {openFile !== null && (reading || readingPreferred) && (
        <ReadingMode
          workspaceId={workspaceId}
          file={openFile}
          previous={shownFiles[shownFiles.indexOf(openFile) - 1]}
          next={shownFiles[shownFiles.indexOf(openFile) + 1]}
          onOpen={(next) => go({ file: next.versionId, pick: next.versionId }, true)}
          onExit={() => go({ file: undefined, read: undefined }, true)}
        />
      )}
      {openFile !== null && !reading && !readingPreferred && (
        <FileViewer
          workspaceId={workspaceId}
          files={shownFiles}
          file={openFile}
          sourceName={trees.data.find((source) => source.sourceId === openFile.sourceId)?.name ?? null}
          onOpen={(next) => go({ file: next.versionId }, true)}
          onClose={() => go({ file: undefined }, true)}
        />
      )}
    </>
  );
}

function crumbsOf(tree: SourceTree | null, folder: string | undefined): { name: string; folder?: string }[] {
  if (tree === null) {
    return [];
  }
  const crumbs: { name: string; folder?: string }[] = [{ name: tree.name }];
  if (folder === undefined || folder === "") {
    return crumbs;
  }
  const parts = folder.split("/");
  parts.forEach((part, index) => {
    crumbs.push({ name: part, folder: parts.slice(0, index + 1).join("/") });
  });
  return crumbs;
}

function placeTotals(trees: SourceTree[], tree: SourceTree | null, folder: { filesBelow: number; bytesBelow: number } | null) {
  if (folder !== null) {
    return { files: folder.filesBelow, bytes: folder.bytesBelow };
  }
  if (tree !== null) {
    return { files: tree.files, bytes: tree.bytes };
  }
  return trees.reduce((sum, source) => ({ files: sum.files + source.files, bytes: sum.bytes + source.bytes }), { files: 0, bytes: 0 });
}

function EmptyHere({ text, sourceName, folder, hasSources }: { text: string; sourceName: string | null; folder: string | undefined; hasSources: boolean }) {
  const { t } = useTranslation();
  if (text.length > 0) {
    return (
      <EmptyState
        title={t("files.empty.noMatch", "Nothing matched that search")}
        description={t("files.empty.noMatchDescription", "The search looks at every file's path and title in the workspace.")}
      />
    );
  }
  if (!hasSources) {
    return (
      <EmptyState
        title={t("files.empty.noSource", "No source yet")}
        description={t("files.empty.noSourceDescription", "Add a source; the files it captures are listed here, folder by folder.")}
      />
    );
  }
  if (sourceName !== null && (folder === undefined || folder === "")) {
    return (
      <EmptyState
        title={t("files.empty.sourceEmpty", "{source} has nothing in it yet", { source: sourceName })}
        description={t("files.empty.sourceEmptyDescription", "A scan or a capture files what it takes here.")}
      />
    );
  }
  return (
    <EmptyState
      title={t("files.empty.folder", "This folder is empty")}
      description={t("files.empty.folderDescription", "Nothing was captured under this path.")}
    />
  );
}
