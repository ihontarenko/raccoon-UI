import { useEffect, useState } from "react";
import { describeProblem, type Problem } from "../../application/problems";
import { api } from "../../lib/api";
import type { SourceFolderListing, SourceLocationRoot } from "../../lib/contracts";
import { Waiting } from "../../ui/components";
import { Badge, Button, Icon } from "../../ui/primitives";
import { useTranslation } from "../../translations/TranslationProvider";

/* ⚠️ The second control in the bar is the way back up the tree, and it is the SAME arrow glyph
   turned around — there is no separate up-arrow in the icon set. */
const BAR = "flex items-center gap-1 border-b border-line bg-well px-2 py-1 [&>:nth-child(2)_svg]:rotate-180";

/* Before a folder is chosen the box names what it lists, in words that wrap rather than a path cut
   at the start. */
const ROOTS_LABEL = "min-w-0 flex-1 px-2 text-xs text-secondary";

/* The chosen folder, cut from the START so its end — the part that tells two paths apart — stays. */
const CURRENT_PATH = [
  "min-w-0 flex-1 overflow-hidden px-2 font-mono text-xs text-ellipsis whitespace-nowrap text-secondary",
  "[direction:rtl] text-left",
].join(" ");

const FOLDER_ROW = [
  "flex min-h-(--control) w-full items-center gap-2 border-0 bg-transparent px-3 py-1 text-left text-ink",
  "[&_svg]:text-accent-text not-disabled:hover:bg-well disabled:opacity-60",
].join(" ");

const MESSAGE = "m-0 grid justify-items-start gap-2 p-4 text-sm text-secondary";

interface FolderPickerProperties {
  workspaceId: string;
  /** The folder currently chosen; browsing starts there when it is inside a root. */
  value: string;
  onChoose: (path: string) => void;
  /** The local-folder connection whose roots browsing stays inside; the machine's own roots without one. */
  connectionId?: string;
}

type View =
  | { kind: "roots"; roots: SourceLocationRoot[] }
  | { kind: "folder"; listing: SourceFolderListing }
  | { kind: "loading" }
  | { kind: "failed"; problem: Problem; retry: () => void };

// Browses only the folders the deployment may read, so a person picks a source folder instead of
// guessing a path the scanner would refuse. The list keeps a fixed height, so moving between folders
// never shifts the dialog around it.
export function FolderPicker({ workspaceId, value, onChoose, connectionId }: FolderPickerProperties) {
  const { t } = useTranslation();
  const [view, setView] = useState<View>({ kind: "loading" });

  const showRoots = () => {
    setView({ kind: "loading" });
    api
      .sourceLocationRoots(workspaceId, connectionId)
      .then((roots) => {
        setView({ kind: "roots", roots });
      })
      .catch((error: unknown) => {
        setView({ kind: "failed", problem: describeProblem(error), retry: showRoots });
      });
  };

  const open = (path: string) => {
    setView({ kind: "loading" });
    api
      .sourceLocationFolders(workspaceId, path, connectionId)
      .then((listing) => {
        setView({ kind: "folder", listing });
      })
      .catch((error: unknown) => {
        setView({
          kind: "failed",
          problem: describeProblem(error),
          retry: () => {
            open(path);
          },
        });
      });
  };

  // Start where the chosen folder is, or at the roots; a folder that cannot be opened falls back.
  useEffect(() => {
    if (value.trim().length === 0) {
      showRoots();
      return;
    }
    api
      .sourceLocationFolders(workspaceId, value.trim(), connectionId)
      .then((listing) => {
        setView({ kind: "folder", listing });
      })
      .catch(() => {
        showRoots();
      });
    // Only the first opening follows the value; afterwards the person drives the browser.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, connectionId]);

  const current = view.kind === "folder" ? view.listing : null;

  return (
    <div className="overflow-hidden rounded-control border border-line-strong bg-surface">
      <div className={BAR}>
        <Button
          variant="quiet"
          iconOnly
          icon="sources"
          aria-label={t("sourceSetup.folderPicker.showRoots", "Show the top-level folders")}
          title={t("sourceSetup.folderPicker.roots", "Top-level folders")}
          disabled={view.kind === "roots"}
          onClick={showRoots}
        />
        <Button
          variant="quiet"
          iconOnly
          icon="arrow"
          aria-label={t("sourceSetup.folderPicker.openParent", "Open the parent folder")}
          title={t("sourceSetup.folderPicker.parent", "Parent folder")}
          disabled={current === null || current.parent === null}
          onClick={() => {
            if (current !== null && current.parent !== null) {
              open(current.parent);
            }
          }}
        />
        <span className={current === null ? ROOTS_LABEL : CURRENT_PATH} title={current?.path}>
          {current === null ? t("sourceSetup.folderPicker.readable", "Folders this deployment may read") : current.path}
        </span>
        <Button
          variant="primary"
          disabled={current === null}
          onClick={() => {
            if (current !== null) {
              onChoose(current.path);
            }
          }}
        >
          {t("sourceSetup.folderPicker.use", "Use this folder")}
        </Button>
      </div>
      <div className="h-[calc(240px*var(--ui-scale))] overflow-y-auto" aria-live="polite">
        {view.kind === "loading" && <Waiting label={t("sourceSetup.folderPicker.reading", "Reading folders")} lines={4} />}
        {view.kind === "failed" && (
          <div className={MESSAGE}>
            <p>{view.problem.detail ?? view.problem.description}</p>
            <Button variant="quiet" icon="refresh" onClick={view.retry}>
              {t("common.tryAgain", "Try again")}
            </Button>
          </div>
        )}
        {view.kind === "roots" &&
          (view.roots.length === 0 ? (
            <p className={MESSAGE}>
              {t("sourceSetup.folderPicker.noRoots", "This deployment is not configured to read any folders.")}
            </p>
          ) : (
            <ul className="m-0 list-none px-0 py-1">
              {view.roots.map((root) => (
                <li key={root.path}>
                  <button
                    type="button"
                    className={FOLDER_ROW}
                    disabled={!root.available}
                    onClick={() => {
                      open(root.path);
                    }}
                  >
                    <Icon name="sources" size="small" />
                    <span className="numeric">{root.path}</span>
                    {!root.available && <Badge tone="warn">{t("sourceSetup.folderPicker.notMounted", "Not mounted")}</Badge>}
                  </button>
                </li>
              ))}
            </ul>
          ))}
        {view.kind === "folder" &&
          (view.listing.folders.length === 0 ? (
            <p className={MESSAGE}>{t("sourceSetup.folderPicker.empty", "No folders inside. Use this folder, or go up.")}</p>
          ) : (
            <ul className="m-0 list-none px-0 py-1">
              {view.listing.folders.map((folder) => (
                <li key={folder.path}>
                  <button
                    type="button"
                    className={FOLDER_ROW}
                    onClick={() => {
                      open(folder.path);
                    }}
                  >
                    <Icon name="folder" size="small" />
                    <span>{folder.name}</span>
                  </button>
                </li>
              ))}
              {view.listing.truncated && (
                <li className="px-3 py-2 text-xs text-muted">
                  {t("sourceSetup.folderPicker.truncated", "Only the first folders are listed — type the path to go deeper.")}
                </li>
              )}
            </ul>
          ))}
      </div>
    </div>
  );
}
