import type { SourceTree } from "../../lib/files";
import { useTranslation } from "../../translations/TranslationProvider";
import { Select } from "../../ui/primitives";
import { childrenByParent, type FilePlace } from "./FileTree";

const SEPARATOR = "\u0000";

/**
 * The tree as one choice, for a screen too narrow for a tree: every source, and under it its folders indented by
 * depth. Where a tree would become a strip cut off at both ends, this stays one line that says where you are.
 */
export function PlacePicker({ trees, place, onSelect, className }: { trees: SourceTree[]; place: FilePlace; onSelect: (place: FilePlace) => void; className?: string }) {
  const { t } = useTranslation();
  const value = place.sourceId === undefined ? "" : `${place.sourceId}${SEPARATOR}${place.folder ?? ""}`;
  return (
    <label className={className}>
      <span className="sr-only">{t("files.place", "Place")}</span>
      <Select
        value={value}
        fullWidth
        onChange={(event) => {
          if (event.target.value === "") {
            onSelect({});
            return;
          }
          const [sourceId, folder] = event.target.value.split(SEPARATOR);
          onSelect({ sourceId, folder: folder ?? "" });
        }}
      >
        <option value="">{t("files.allFiles", "All files")}</option>
        {trees.map((tree) => (
          <optgroup key={tree.sourceId} label={tree.name}>
            <option value={`${tree.sourceId}${SEPARATOR}`}>
              {tree.name} · {tree.files}
            </option>
            {foldersInOrder(tree).map(({ path, name, depth, files }) => (
              <option key={path} value={`${tree.sourceId}${SEPARATOR}${path}`}>
                {"  ".repeat(depth)}— {name} · {files}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
    </label>
  );
}

/** The folders of a source depth-first, as a tree reads top to bottom. */
function foldersInOrder(tree: SourceTree): { path: string; name: string; depth: number; files: number }[] {
  const children = childrenByParent(tree.folders);
  const ordered: { path: string; name: string; depth: number; files: number }[] = [];
  const walk = (parent: string, depth: number) => {
    for (const folder of children.get(parent) ?? []) {
      ordered.push({ path: folder.path, name: folder.name, depth, files: folder.filesBelow });
      walk(folder.path, depth + 1);
    }
  };
  walk("", 1);
  return ordered;
}
