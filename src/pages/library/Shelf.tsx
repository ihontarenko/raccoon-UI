import { useMemo, useState } from "react";
import { lookOf, type FileEntry, type SourceTree } from "../../lib/files";
import { useTranslation } from "../../translations/TranslationProvider";
import { Icon, Input } from "../../ui/primitives";
import { FileMark } from "../files/FileMarks";
import { FileTree, type FilePlace } from "../files/FileTree";
import { PlacePicker } from "../files/PlacePicker";
import { TREE_WIDE } from "../files/filesClasses";
import { OPEN_DOT, SHELF, SHELF_DOCUMENTS, SHELF_FILTER, SHELF_HEADING, SHELF_ITEM, SHELF_NAME } from "./libraryClasses";

interface ShelfProperties {
  /** On a phone the shelf folds away while a document is read; on a wide screen it is always there. */
  open: boolean;
  /** Why the documents of the place could not be read, if they could not. */
  problem: string | null;
  trees: SourceTree[];
  place: FilePlace;
  /** The documents filed in the place, or null while they are read. */
  documents: FileEntry[] | null;
  openIds: string[];
  activeId: string | null;
  onPlace: (place: FilePlace) => void;
  onOpen: (file: FileEntry) => void;
}

/**
 * Where documents are picked from: the sources and folders, and the documents of the place chosen — filtered by a
 * word as you type. A document already on the desk carries a dot; the one in front carries the accent.
 */
export function Shelf({ open, problem, trees, place, documents, openIds, activeId, onPlace, onOpen }: ShelfProperties) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState("");
  const shown = useMemo(() => {
    const word = filter.trim().toLowerCase();
    return (documents ?? []).filter((document) => word.length === 0 || document.name.toLowerCase().includes(word));
  }, [documents, filter]);

  return (
    <nav id="library-shelf" className={SHELF} data-open={open} aria-label={t("library.shelf", "Shelf")}>
      <div className={TREE_WIDE}>
        <FileTree trees={trees} place={place} onSelect={onPlace} />
      </div>
      <PlacePicker className="hidden max-[800px]:block" trees={trees} place={place} onSelect={onPlace} />
      <div className={SHELF_FILTER}>
        <Icon name="search" size="small" />
        <Input
          type="search"
          aria-label={t("library.filter", "Filter documents here")}
          placeholder={t("library.filterPlaceholder", "Filter by name…")}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      </div>
      <ul className={SHELF_DOCUMENTS} aria-label={t("library.documentsHere", "Documents here")}>
        <li className={SHELF_HEADING}>{t("library.documentsHere", "Documents here")}</li>
        {documents === null && <li className="px-2 text-xs text-muted">{t("files.reading", "Reading…")}</li>}
        {problem !== null && <li className="px-2 text-xs text-danger">{problem}</li>}
        {documents !== null && place.sourceId === undefined && (
          <li className="px-2 text-xs text-muted">{t("library.pickPlace", "Choose a source or a folder above.")}</li>
        )}
        {documents !== null && problem === null && place.sourceId !== undefined && shown.length === 0 && (
          <li className="px-2 text-xs text-muted">{t("library.nothingHere", "No document here.")}</li>
        )}
        {shown.map((document) => (
          <li key={document.versionId}>
            <button
              type="button"
              className={SHELF_ITEM}
              aria-current={document.versionId === activeId}
              title={document.path}
              onClick={() => onOpen(document)}
            >
              <FileMark size="small" look={lookOf(document)} name={document.name} />
              <span className={SHELF_NAME}>{document.name}</span>
              {openIds.includes(document.versionId) && document.versionId !== activeId && (
                <span className={OPEN_DOT} aria-label={t("library.isOpen", "open")} />
              )}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
