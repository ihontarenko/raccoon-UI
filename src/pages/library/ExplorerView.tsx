import { useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatElapsed } from "../../application/format";
import { useAddressChange } from "../../application/useAddressChange";
import { usePageTitle } from "../../application/usePageTitle";
import { useReadySession } from "../../application/session";
import { useResource } from "../../application/useResource";
import { filesApi, lookOf, type FileEntry } from "../../lib/files";
import { useTranslation } from "../../translations/TranslationProvider";
import { PageHeader, ProblemState, Waiting } from "../../ui/components";
import { Button, Icon } from "../../ui/primitives";
import { FileMark } from "../files/FileMarks";
import type { FilePlace } from "../files/FileTree";
import { DocumentReading } from "./DocumentReading";
import { DESK, EXPLORER, KEY, SHELF_TOGGLE, QUICK_ITEM, QUICK_LIST, TAB, TAB_CLOSE, TAB_LABEL, TABS, WELCOME } from "./libraryClasses";
import { openTabsOf, type LibrarySearch } from "./librarySearch";
import { QuickOpen } from "./QuickOpen";
import { ReadingMode } from "./ReadingMode";
import { useReadingPreference } from "./readingPreference";
import { Shelf } from "./Shelf";

const MOST_TABS = 12;

/**
 * The Library for reading: a shelf to pick from, a desk that keeps several documents open as tabs, and each
 * document read as what it is with its outline and the documents that share its subject. Everything open is in
 * the address, so a reading session can be bookmarked or sent.
 */
export function ExplorerView({ modeSwitch }: { modeSwitch: ReactNode }) {
  const { t } = useTranslation();
  usePageTitle(t("library.title", "Library"));
  const { workspace } = useReadySession();
  const workspaceId = workspace?.id ?? "";
  const search = useSearch({ strict: false }) as LibrarySearch;
  const changeAddress = useAddressChange();
  const [quickOpen, setQuickOpen] = useState(false);
  const [readingPreferred] = useReadingPreference();
  // On a phone the shelf is a drawer: open while nothing is being read, folded away once a document is.
  const [shelfOpen, setShelfOpen] = useState(() => openTabsOf(search).length === 0);

  const place: FilePlace = search.source === undefined ? {} : { sourceId: search.source, folder: search.folder ?? "" };
  const openIds = openTabsOf(search);
  const activeId = search.active !== undefined && openIds.includes(search.active) ? search.active : (openIds[0] ?? null);

  const activeIdReference = useRef<string | null>(null);
  activeIdReference.current = activeId;
  const readReference = useRef(() => {});
  readReference.current = () => go({ read: true });

  const go = (next: Partial<LibrarySearch>) => {
    void changeAddress({ to: "/library", search: { ...search, ...next, mode: undefined } });
  };
  const openDocument = (versionId: string) => {
    const tabs = openIds.includes(versionId) ? openIds : [...openIds, versionId].slice(-MOST_TABS);
    // With reading mode chosen, a document opens to be read: the document alone, not a desk of panels.
    go({ open: tabs.join(","), active: versionId, read: readingPreferred ? true : search.read });
    setShelfOpen(false);
  };
  const closeDocument = (versionId: string) => {
    const index = openIds.indexOf(versionId);
    const tabs = openIds.filter((identifier) => identifier !== versionId);
    const nextActive = versionId === activeId ? (tabs[Math.min(index, tabs.length - 1)] ?? undefined) : (activeId ?? undefined);
    go({ open: tabs.length === 0 ? undefined : tabs.join(","), active: nextActive });
  };

  // Ctrl+K (⌘K) opens any document by name, from anywhere on the page.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setQuickOpen(true);
        return;
      }
      // R reads the document in front alone — unless a field is being typed in.
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target instanceof HTMLElement && event.target.isContentEditable);
      if (!typing && !event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === "r" && activeIdReference.current !== null) {
        event.preventDefault();
        readReference.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const trees = useResource(() => filesApi.tree(workspaceId, false), [workspaceId]);
  const shelfDocuments = useResource<FileEntry[]>(
    () =>
      place.sourceId === undefined
        ? Promise.resolve([])
        : filesApi.list(workspaceId, { sourceId: place.sourceId, folder: place.folder ?? "" }, { limit: 100, offset: 0 }),
    [workspaceId, place.sourceId, place.folder],
  );
  // The tabs need their names whichever place the shelf shows, so each open document is read on its own.
  const tabFiles = useResource<FileEntry[]>(
    () => Promise.all(openIds.map((identifier) => filesApi.file(workspaceId, identifier))),
    [workspaceId, search.open ?? ""],
  );

  if (trees.status === "loading") {
    return <Waiting label={t("files.loading", "Reading the files")} lines={6} />;
  }
  if (trees.status === "failed") {
    return <ProblemState problem={trees.problem} />;
  }
  const sourceNameOf = (sourceId: string) => trees.data.find((tree) => tree.sourceId === sourceId)?.name ?? null;
  const openFiles = tabFiles.status === "ready" ? tabFiles.data : [];
  const activeFile = openFiles.find((file) => file.versionId === activeId) ?? null;

  return (
    <>
      <PageHeader
        eyebrow={t("navigation.group.knowledge", "Knowledge")}
        title={t("library.title", "Library")}
        lead={t(
          "library.lead",
          "Read what the workspace holds. Pick a document from the shelf or press Ctrl+K; keep several open as tabs; follow the outline inside one and the related documents out of it.",
        )}
        actions={
          <>
            <Button variant="quiet" icon="search" onClick={() => setQuickOpen(true)} aria-label={t("library.quickOpen", "Open a document")}>
              <span className="max-[600px]:hidden">{t("library.quickOpenButton", "Open…")}</span>{" "}
              <kbd className={`${KEY} pointer-coarse:hidden`}>Ctrl K</kbd>
            </Button>
            {modeSwitch}
          </>
        }
      />
      <div className={SHELF_TOGGLE}>
        <Button variant="quiet" icon={shelfOpen ? "chevron-up" : "chevron-down"} aria-expanded={shelfOpen} aria-controls="library-shelf" onClick={() => setShelfOpen(!shelfOpen)}>
          {shelfOpen ? t("library.hideShelf", "Hide the shelf") : t("library.showShelf", "Shelf — sources and documents")}
        </Button>
      </div>
      <div className={EXPLORER}>
        <Shelf
          open={shelfOpen}
          problem={shelfDocuments.status === "failed" ? shelfDocuments.problem.title : null}
          trees={trees.data}
          place={place}
          documents={shelfDocuments.status === "ready" ? shelfDocuments.data : shelfDocuments.status === "failed" ? [] : null}
          openIds={openIds}
          activeId={activeId}
          onPlace={(next) => go({ source: next.sourceId, folder: next.sourceId === undefined || next.folder === "" ? undefined : next.folder })}
          onOpen={(file) => openDocument(file.versionId)}
        />
        <section className={DESK} aria-label={t("library.desk", "Reading desk")}>
          {openIds.length > 0 && (
            <div className={TABS} role="tablist" aria-label={t("library.openDocuments", "Open documents")}>
              {openIds.map((identifier) => {
                const file = openFiles.find((candidate) => candidate.versionId === identifier);
                const active = identifier === activeId;
                return (
                  <div key={identifier} className={TAB} data-active={active}>
                    {file !== undefined && <FileMark size="small" look={lookOf(file)} name={file.name} />}
                    <button
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={TAB_LABEL}
                      title={file?.path}
                      onClick={() => go({ active: identifier })}
                      onAuxClick={(event) => {
                        // A middle click closes a tab, as it does in every browser and editor.
                        if (event.button === 1) {
                          closeDocument(identifier);
                        }
                      }}
                    >
                      {file?.name ?? "…"}
                    </button>
                    <button
                      type="button"
                      className={TAB_CLOSE}
                      aria-label={t("library.closeTab", "Close {name}", { name: file?.name ?? "" })}
                      onClick={() => closeDocument(identifier)}
                    >
                      <Icon name="close" size="small" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {openIds.length === 0 ? (
            <Welcome workspaceId={workspaceId} onOpen={(file) => openDocument(file.versionId)} onQuickOpen={() => setQuickOpen(true)} />
          ) : tabFiles.status === "failed" ? (
            <ProblemState layout="section" problem={tabFiles.problem} />
          ) : activeFile === null ? (
            <Waiting label={t("library.opening", "Opening the document")} lines={6} />
          ) : (
            <DocumentReading
              key={activeFile.versionId}
              workspaceId={workspaceId}
              file={activeFile}
              sourceName={sourceNameOf(activeFile.sourceId)}
              onOpen={openDocument}
              onRead={() => go({ read: true })}
            />
          )}
        </section>
      </div>
      {search.read === true && activeFile !== null && (
        <ReadingMode
          workspaceId={workspaceId}
          file={activeFile}
          previous={openFiles[openFiles.indexOf(activeFile) - 1]}
          next={openFiles[openFiles.indexOf(activeFile) + 1]}
          onOpen={(file) => go({ active: file.versionId })}
          onExit={() => go({ read: undefined })}
        />
      )}
      <QuickOpen open={quickOpen} workspaceId={workspaceId} onClose={() => setQuickOpen(false)} onOpen={(file) => openDocument(file.versionId)} />
    </>
  );
}

/** An empty desk: how to start, and what arrived most recently — the likeliest thing to read next. */
function Welcome({ workspaceId, onOpen, onQuickOpen }: { workspaceId: string; onOpen: (file: FileEntry) => void; onQuickOpen: () => void }) {
  const { t, language } = useTranslation();
  const recent = useResource(() => filesApi.list(workspaceId, { order: "CAPTURED" }, { limit: 12, offset: 0 }), [workspaceId]);
  return (
    <div className={WELCOME}>
      <div className="grid gap-1">
        <h2 className="m-0 text-base font-semibold">{t("library.welcome", "Nothing open yet")}</h2>
        <p className="m-0 text-sm text-secondary">
          {t("library.welcomeText", "Pick a document from the shelf, or open one by name.")}{" "}
          <Button variant="quiet" flush onClick={onQuickOpen}>
            <kbd className={KEY}>Ctrl K</kbd>
          </Button>
        </p>
      </div>
      <section className="grid gap-2" aria-labelledby="library-recent">
        <h3 id="library-recent" className="m-0 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
          {t("library.recent", "Recently added")}
        </h3>
        {recent.status === "ready" && recent.data.length === 0 && <p className="m-0 text-xs text-muted">{t("library.recentNone", "Nothing has been added yet.")}</p>}
        {recent.status === "ready" && recent.data.length > 0 && (
          <ul className={`${QUICK_LIST} max-h-none`}>
            {recent.data.map((file) => (
              <li key={file.versionId}>
                <button type="button" className={QUICK_ITEM} onClick={() => onOpen(file)}>
                  <FileMark size="small" look={lookOf(file)} name={file.name} />
                  <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{file.name}</span>
                  <span className="text-xs text-muted">{formatElapsed(file.capturedAt, language)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
