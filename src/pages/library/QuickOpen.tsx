import { useEffect, useState, type KeyboardEvent } from "react";
import { filesApi, lookOf, type FileEntry } from "../../lib/files";
import { useTranslation } from "../../translations/TranslationProvider";
import { Dialog, Input } from "../../ui/primitives";
import { FileMark } from "../files/FileMarks";
import { QUICK_ITEM, QUICK_LIST } from "./libraryClasses";

const MOST_SHOWN = 20;
const PAUSE_MILLISECONDS = 180;

interface QuickOpenProperties {
  open: boolean;
  workspaceId: string;
  onClose: () => void;
  onOpen: (file: FileEntry) => void;
}

/**
 * Ctrl+K: type part of a name or a path, arrows to choose, Enter to open on the desk. It looks through every source
 * of the workspace, so a document is reached without knowing where it is filed.
 */
export function QuickOpen({ open, workspaceId, onClose, onOpen }: QuickOpenProperties) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [found, setFound] = useState<FileEntry[]>([]);
  const [chosen, setChosen] = useState(0);

  useEffect(() => {
    if (!open) {
      setText("");
      setFound([]);
      return;
    }
    const word = text.trim();
    let current = true;
    const timer = window.setTimeout(() => {
      filesApi
        .list(workspaceId, { text: word.length === 0 ? undefined : word, order: word.length === 0 ? "CAPTURED" : undefined }, { limit: MOST_SHOWN, offset: 0 })
        .then((files) => {
          if (current) {
            setFound(files);
            setChosen(0);
          }
        }, () => {});
    }, PAUSE_MILLISECONDS);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [open, text, workspaceId]);

  const choose = (file: FileEntry | undefined) => {
    if (file !== undefined) {
      onOpen(file);
      onClose();
    }
  };

  const move = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setChosen((index) => Math.min(index + 1, found.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setChosen((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(found[chosen]);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={t("library.quickOpen", "Open a document")}>
      <div className="grid gap-2">
        <Input
          autoFocus
          aria-label={t("library.quickOpenLabel", "Name or path")}
          aria-controls="quick-open-list"
          placeholder={t("library.quickOpenPlaceholder", "Part of a name or a path…")}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={move}
        />
        <p className="m-0 text-[11px] text-muted">
          {text.trim().length === 0 ? t("library.quickOpenRecent", "Recently added") : t("library.quickOpenHint", "↑ ↓ to choose · Enter to open")}
        </p>
        <ul id="quick-open-list" className={QUICK_LIST} role="listbox" aria-label={t("library.quickOpen", "Open a document")}>
          {found.map((file, index) => (
            <li key={file.versionId} role="option" aria-selected={index === chosen}>
              <button type="button" className={QUICK_ITEM} aria-selected={index === chosen} onClick={() => choose(file)} onMouseEnter={() => setChosen(index)}>
                <FileMark size="small" look={lookOf(file)} name={file.name} />
                <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{file.name}</span>
                <span className="numeric max-w-[45%] overflow-hidden text-xs text-ellipsis whitespace-nowrap text-muted">{file.folder}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}
