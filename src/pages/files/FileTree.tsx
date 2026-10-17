import { useEffect, useMemo, useRef, useState } from "react";
import { formatBytes } from "../../application/format";
import type { FolderNode, SourceTree } from "../../lib/files";
import { useTranslation } from "../../translations/TranslationProvider";
import { revealActiveItem } from "../../ui/components";
import { Icon } from "../../ui/primitives";
import { FolderMark } from "./FileMarks";
import { CHEVRON, CHEVRON_OPEN, CHEVRON_SPACE, RAIL, RAIL_COUNT, RAIL_GROUP, RAIL_HEAD, RAIL_LINE, RAIL_LIST, RAIL_NAME, RAIL_ROOT_LIST, RAIL_ROW } from "./filesClasses";

/** Where the file area is looking: the whole workspace, a whole source, or one folder of a source. */
export interface FilePlace {
  sourceId?: string;
  /** With a source: undefined is all of it, "" its top level, a path that folder. */
  folder?: string;
}

interface FileTreeProperties {
  trees: SourceTree[];
  place: FilePlace;
  onSelect: (place: FilePlace) => void;
}

const keyOf = (sourceId: string, folder: string) => `${sourceId}:${folder}`;

/**
 * The sources and the folders their file paths make. A branch opens with its chevron without being
 * selected; selecting a row opens it too, so the tree always shows where the list is. On a phone the
 * rail becomes one strip that keeps the current row in view.
 */
export function FileTree({ trees, place, onSelect }: FileTreeProperties) {
  const { t } = useTranslation();
  const strip = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  // The current folder and every folder above it are open, so a place reached by address is visible.
  useEffect(() => {
    if (place.sourceId === undefined) {
      return;
    }
    const sourceId = place.sourceId;
    setExpanded((current) => {
      const next = new Set(current);
      next.add(keyOf(sourceId, ""));
      let folder = place.folder ?? "";
      while (folder.length > 0) {
        next.add(keyOf(sourceId, folder));
        const separator = folder.lastIndexOf("/");
        folder = separator < 0 ? "" : folder.slice(0, separator);
      }
      return next;
    });
  }, [place.sourceId, place.folder]);

  // After the branches above the place have opened, or the current row is not there yet to reveal.
  useEffect(() => {
    revealActiveItem(strip.current, "[aria-current=page]");
  }, [place.sourceId, place.folder, expanded]);

  const toggle = (key: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const totalFiles = trees.reduce((sum, tree) => sum + tree.files, 0);

  return (
    <aside className={RAIL} aria-label={t("files.tree.label", "Sources and folders")} ref={strip}>
      <div className={RAIL_HEAD}>
        <span className="eyebrow">{t("files.tree.sources", "Sources")}</span>
        <span className="numeric text-xs text-muted">{trees.length}</span>
      </div>
      <ul className={RAIL_ROOT_LIST} role="list">
        <li>
          <button
            type="button"
            className={RAIL_ROW}
            aria-current={place.sourceId === undefined ? "page" : undefined}
            onClick={() => onSelect({})}
          >
            <span className={CHEVRON_SPACE} />
            <Icon name="files" size="small" />
            <span className={RAIL_NAME}>{t("files.allFiles", "All files")}</span>
            <span className={RAIL_COUNT}>{totalFiles}</span>
          </button>
        </li>
        {trees.map((tree) => (
          <SourceBranch key={tree.sourceId} tree={tree} place={place} expanded={expanded} onToggle={toggle} onSelect={onSelect} />
        ))}
      </ul>
    </aside>
  );
}

function SourceBranch({
  tree,
  place,
  expanded,
  onToggle,
  onSelect,
}: {
  tree: SourceTree;
  place: FilePlace;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  onSelect: (place: FilePlace) => void;
}) {
  const { plural } = useTranslation();
  const children = useMemo(() => childrenByParent(tree.folders), [tree.folders]);
  const key = keyOf(tree.sourceId, "");
  const open = expanded.has(key);
  const selected = place.sourceId === tree.sourceId && (place.folder === undefined || place.folder === "");
  const topFolders = children.get("") ?? [];

  return (
    <li className={RAIL_GROUP}>
      <div className={RAIL_LINE}>
        <ChevronButton show={topFolders.length > 0} open={open} label={tree.name} onToggle={() => onToggle(key)} />
        <button
          type="button"
          className={RAIL_ROW}
          aria-current={selected ? "page" : undefined}
          title={`${tree.name} · ${plural("files.count", tree.files, { one: "{count} file", other: "{count} files" })} · ${formatBytes(tree.bytes)}`}
          onClick={() => {
            onSelect({ sourceId: tree.sourceId, folder: "" });
            if (!open) {
              onToggle(key);
            }
          }}
        >
          <Icon name={tree.kind === "LOCAL_FOLDER" ? "folder" : "documents"} size="small" />
          <span className={RAIL_NAME}>{tree.name}</span>
          <span className={RAIL_COUNT}>{tree.files}</span>
        </button>
      </div>
      {open && topFolders.length > 0 && (
        <ul className={RAIL_LIST} role="list">
          {topFolders.map((folder) => (
            <FolderBranch
              key={folder.path}
              sourceId={tree.sourceId}
              folder={folder}
              childrenByParent={children}
              place={place}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function FolderBranch({
  sourceId,
  folder,
  childrenByParent,
  place,
  expanded,
  onToggle,
  onSelect,
}: {
  sourceId: string;
  folder: FolderNode;
  childrenByParent: Map<string, FolderNode[]>;
  place: FilePlace;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  onSelect: (place: FilePlace) => void;
}) {
  const { plural } = useTranslation();
  const key = keyOf(sourceId, folder.path);
  const open = expanded.has(key);
  const children = childrenByParent.get(folder.path) ?? [];
  const selected = place.sourceId === sourceId && place.folder === folder.path;

  return (
    <li>
      <div className={RAIL_LINE} style={{ paddingLeft: `calc(${(folder.depth + 1) * 12}px * var(--ui-scale))` }}>
        <ChevronButton show={children.length > 0} open={open} label={folder.name} onToggle={() => onToggle(key)} />
        <button
          type="button"
          className={RAIL_ROW}
          aria-current={selected ? "page" : undefined}
          title={`${folder.path} · ${plural("files.tree.under", folder.filesBelow, {
            one: "{count} file under it",
            other: "{count} files under it",
          })} · ${formatBytes(folder.bytesBelow)}`}
          onClick={() => {
            onSelect({ sourceId, folder: folder.path });
            if (!open) {
              onToggle(key);
            }
          }}
        >
          <FolderMark empty={folder.filesBelow === 0} />
          <span className={RAIL_NAME}>{folder.name}</span>
          <span className={RAIL_COUNT}>{folder.filesBelow}</span>
        </button>
      </div>
      {open && children.length > 0 && (
        <ul className={RAIL_LIST} role="list">
          {children.map((child) => (
            <FolderBranch
              key={child.path}
              sourceId={sourceId}
              folder={child}
              childrenByParent={childrenByParent}
              place={place}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Opens or closes a branch; outside the row, so it never selects. A leaf keeps the space, so names line up. */
function ChevronButton({ show, open, label, onToggle }: { show: boolean; open: boolean; label: string; onToggle: () => void }) {
  const { t } = useTranslation();
  if (!show) {
    return <span className={CHEVRON_SPACE} />;
  }
  return (
    <button
      type="button"
      className={CHEVRON}
      aria-expanded={open}
      aria-label={open ? t("files.tree.close", "Close {name}", { name: label }) : t("files.tree.open", "Open {name}", { name: label })}
      onClick={onToggle}
    >
      <span className={open ? CHEVRON_OPEN : undefined}>
        <Icon name="chevron" size="small" />
      </span>
    </button>
  );
}

export function childrenByParent(folders: FolderNode[]): Map<string, FolderNode[]> {
  const children = new Map<string, FolderNode[]>();
  for (const folder of folders) {
    children.set(folder.parent, [...(children.get(folder.parent) ?? []), folder]);
  }
  for (const list of children.values()) {
    list.sort((first, second) => first.name.localeCompare(second.name));
  }
  return children;
}
