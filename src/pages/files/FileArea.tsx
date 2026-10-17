import { Fragment, useEffect, useState, type ReactNode } from "react";
import { formatBytes, formatDateTime, formatElapsed } from "../../application/format";
import { readingFormatOf } from "../../ui/components/reader/readingFormat";
import { FileStatus } from "./FileStatus";
import { filesApi, lookOf, type FileEntry } from "../../lib/files";
import { useTranslation } from "../../translations/TranslationProvider";
import { Menu, type MenuItem } from "../../ui/components";
import { Table } from "../../ui/primitives";
import { FileMark, FolderMark } from "./FileMarks";
import { FILE_CELL, LIST_SURFACE, ROW_NAME, ROW_SELECTED, ROW_SUB, THUMBNAIL, THUMBNAIL_WAITING, TILE, TILE_GRID, TILE_MENU, TILE_META, TILE_NAME } from "./filesClasses";

/** A tile that opens a place: a source at the top of the workspace, or a folder inside a source. */
export interface FolderTile {
  key: string;
  name: string;
  files: number;
  bytes: number;
  onOpen: () => void;
}

export type FileView = "grid" | "list";

interface FileAreaProperties {
  workspaceId: string;
  view: FileView;
  folders: FolderTile[];
  files: FileEntry[];
  /** The file shown in the preview beside the list, if any. */
  selectedId: string | null;
  /** Whether a row also says where the file lies — when a search lists files from many folders. */
  showPaths: boolean;
  actionsOf: (file: FileEntry) => MenuItem[];
  onSelectFile: (file: FileEntry) => void;
  onOpenFile: (file: FileEntry) => void;
}

/**
 * The first click chooses a file and shows it beside the list; a click on the chosen one — a double click, or Enter
 * twice — opens it over the whole screen. One gesture for the mouse and the keyboard alike.
 */
function choose(file: FileEntry, selectedId: string | null, onSelectFile: (file: FileEntry) => void, onOpenFile: (file: FileEntry) => void) {
  if (selectedId === file.versionId) {
    onOpenFile(file);
  } else {
    onSelectFile(file);
  }
}

/** Thumbnails are fetched only for pictures this small; anything larger shows its mark. */
const LARGEST_THUMBNAIL_BYTES = 4 * 1024 * 1024;

export function FileArea({ workspaceId, view, folders, files, selectedId, showPaths, actionsOf, onSelectFile, onOpenFile }: FileAreaProperties) {
  const { t, plural } = useTranslation();
  if (view === "list") {
    return (
      <FileList
        folders={folders}
        files={files}
        selectedId={selectedId}
        showPaths={showPaths}
        actionsOf={actionsOf}
        onSelectFile={onSelectFile}
        onOpenFile={onOpenFile}
      />
    );
  }
  return (
    <ul className={TILE_GRID} role="list">
      {folders.map((folder) => (
        <li key={folder.key}>
          <button type="button" className={TILE} onClick={folder.onOpen} title={`${folder.name} · ${plural("files.count", folder.files, { one: "{count} file", other: "{count} files" })}`}>
            <FolderMark size="large" empty={folder.files === 0} />
            <span className={TILE_NAME}>{breakable(folder.name)}</span>
            <span className={`${TILE_META} numeric`}>
              {plural("files.count", folder.files, { one: "{count} file", other: "{count} files" })}
            </span>
          </button>
        </li>
      ))}
      {files.map((file) => (
        <li key={file.versionId} className={FILE_CELL} data-removed={file.removedAt !== null}>
          <button
            type="button"
            className={TILE}
            aria-pressed={selectedId === file.versionId}
            onClick={() => choose(file, selectedId, onSelectFile, onOpenFile)}
            title={file.path}
          >
            <FileThumbnail workspaceId={workspaceId} file={file} />
            <span className={TILE_NAME}>{breakable(file.name)}</span>
            <span className={`${TILE_META} numeric`}>
              {file.removedAt !== null ? t("documents.removed", "Removed") : formatBytes(file.sizeBytes)}
            </span>
          </button>
          {/* Positioned by its own wrapper: the menu sets 'relative' on itself, which would win over a passed 'absolute'. */}
          <span className={TILE_MENU}>
            <Menu label={t("files.actionsFor", "Actions for {name}", { name: file.name })} items={actionsOf(file)} alignEnd />
          </span>
        </li>
      ))}
    </ul>
  );
}

function FileList({
  folders,
  files,
  selectedId,
  showPaths,
  actionsOf,
  onSelectFile,
  onOpenFile,
}: Omit<FileAreaProperties, "workspaceId" | "view">) {
  const { t, plural, language } = useTranslation();
  return (
    <div className={LIST_SURFACE}>
      <Table>
        <thead>
          <tr>
            <th scope="col">{t("files.column.name", "Name")}</th>
            <th scope="col">{t("documents.fact.type", "Type")}</th>
            <th scope="col" className="numeric">
              {t("documents.fact.size", "Size")}
            </th>
            <th scope="col">{t("files.column.added", "Added")}</th>
            <th scope="col">{t("files.column.status", "Status")}</th>
            <th scope="col">
              <span className="sr-only">{t("common.actions", "Actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {folders.map((folder) => (
            <tr key={folder.key}>
              <td>
                <button type="button" className={ROW_NAME} onClick={folder.onOpen}>
                  <FolderMark empty={folder.files === 0} />
                  {folder.name}
                </button>
              </td>
              <td className="text-xs text-muted">{t("files.folder", "Folder")}</td>
              <td className="numeric text-xs">{formatBytes(folder.bytes)}</td>
              <td className="text-xs text-muted">{plural("files.count", folder.files, { one: "{count} file", other: "{count} files" })}</td>
              <td />
              <td />
            </tr>
          ))}
          {files.map((file) => (
            <tr key={file.versionId} data-removed={file.removedAt !== null} className={selectedId === file.versionId ? ROW_SELECTED : undefined}>
              <td>
                <button
                  type="button"
                  className={ROW_NAME}
                  aria-pressed={selectedId === file.versionId}
                  onClick={() => choose(file, selectedId, onSelectFile, onOpenFile)}
                  title={file.path}
                >
                  <FileMark look={lookOf(file)} name={file.name} />
                  <span>
                    {file.name}
                    {showPaths && file.folder !== "" && <span className={ROW_SUB}>{file.folder}</span>}
                  </span>
                </button>
              </td>
              <td className="text-xs" title={file.effectiveMediaType.split(";")[0]}>
                {readingFormatOf(file.name, file.effectiveMediaType).description}
              </td>
              <td className="numeric text-xs">{formatBytes(file.sizeBytes)}</td>
              <td className="text-xs text-muted" title={formatDateTime(file.capturedAt)}>
                {formatElapsed(file.capturedAt, language)}
              </td>
              <td>
                <FileStatus file={file} />
              </td>
              <td className="actions">
                <Menu label={t("files.actionsFor", "Actions for {name}", { name: file.name })} items={actionsOf(file)} alignEnd />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

/**
 * A file name with places to wrap after its separators — JMOUSE_AI_EMBEDDINGS.md breaks after an underscore, not in
 * the middle of a word. Nothing is inserted into the text itself; the breaks are only opportunities.
 */
function breakable(name: string): ReactNode {
  // The extension stays with the last word: «MODEL.md», never «MODEL.» and «md» on two lines.
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const parts = stem.split(/(?<=[_.\s-])/);
  if (dot > 0) {
    parts[parts.length - 1] += name.slice(dot);
  }
  return parts.map((part, index) => (
    <Fragment key={index}>
      {part}
      {index < parts.length - 1 && <wbr />}
    </Fragment>
  ));
}

/** A picture's own thumbnail, fetched with the session's token; every other file shows its mark. */
function FileThumbnail({ workspaceId, file }: { workspaceId: string; file: FileEntry }) {
  const look = lookOf(file);
  const wanted = look === "image" && file.sizeBytes <= LARGEST_THUMBNAIL_BYTES;
  const [address, setAddress] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!wanted) {
      return;
    }
    let current = true;
    let created: string | null = null;
    filesApi
      .content(workspaceId, file.versionId)
      .then((blob) => {
        if (current) {
          created = URL.createObjectURL(blob);
          setAddress(created);
        }
      })
      .catch(() => {
        if (current) {
          setFailed(true);
        }
      });
    return () => {
      current = false;
      if (created !== null) {
        URL.revokeObjectURL(created);
      }
    };
  }, [workspaceId, file.versionId, wanted]);

  if (!wanted || failed) {
    const extension = file.name.includes(".") ? file.name.split(".").pop() : undefined;
    return <FileMark size="large" look={look} extension={extension} />;
  }
  if (address === null) {
    return <span className={THUMBNAIL_WAITING} aria-hidden="true" />;
  }
  return <img className={THUMBNAIL} src={address} alt="" />;
}
