import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { usePermissions } from "../../access/PermissionsProvider";
import { PERMISSIONS } from "../../access/permissions";
import { plainExcerpt } from "../../application/format";
import { describeProblem } from "../../application/problems";
import { usePagedList } from "../../application/usePagedList";
import { useResource } from "../../application/useResource";
import { collectAllPages } from "../../lib/api";
import { pipelineApi, type EntryOrigin, type IndexEntry } from "../../lib/pipeline";
import { useTranslation } from "../../translations/TranslationProvider";
import { ConfirmDialog, EmptyState, ListFooter, ProblemState, Segmented, Waiting, useToaster } from "../../ui/components";
import { Badge, Button, Checkbox, Table } from "../../ui/primitives";
import { EntryDialog, type EntryEditing } from "./EntryDialog";
import { ENTRY_ORIGIN } from "./entryOrigin";
import { CLAMP_TWO_LINES, PAGE, ROW_LINK, TABLE_SURFACE, TOOLBAR, TOOLBAR_ACTIONS } from "./indexingClasses";

type Filter = "WRITTEN" | "ALL" | EntryOrigin;

type Pending = { kind: "remove" | "purge"; entry: IndexEntry } | { kind: "clear" };

/**
 * The entries people wrote — whole new ones, and replacements written over one chunk — first; the entries
 * documents produced are one filter away. Each entry says where it came from and links there, so an
 * entry is never just a loose piece of text.
 */
export function EntriesAdministrationTab({ workspaceId, titles, onChanged }: { workspaceId: string; titles: Map<string, string>; onChanged: () => void }) {
  const { t, plural } = useTranslation();
  const { notify } = useToaster();
  const mayManage = usePermissions().may(PERMISSIONS.automationManage);
  const [includeRemoved, setIncludeRemoved] = useState(false);
  const [filter, setFilter] = useState<Filter>("WRITTEN");
  const [editing, setEditing] = useState<EntryEditing | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const entries = usePagedList((page) => pipelineApi.indexEntries(workspaceId, null, includeRemoved, page), [workspaceId, includeRemoved]);
  // Which document each keyword generation was built from, so a derived entry can name its document.
  const generations = useResource(() => collectAllPages((page) => pipelineApi.indexGenerations(workspaceId, page)), [workspaceId]);
  const documentOf = useMemo(
    () => new Map(generations.status === "ready" ? generations.data.map((generation) => [generation.jobId, generation]) : []),
    [generations],
  );
  const loadedById = useMemo(() => new Map(entries.status === "ready" ? entries.items.map((entry) => [entry.id, entry]) : []), [entries]);

  const changed = () => {
    entries.reload();
    onChanged();
  };

  const confirm = async (action: Pending) => {
    try {
      if (action.kind === "clear") {
        const result = await pipelineApi.clearManualEntries(workspaceId);
        notify({
          tone: "good",
          title: plural("index.entries.clearedNotice", result.removedCount, {
            one: "{count} written entry removed",
            other: "{count} written entries removed",
          }),
        });
      } else if (action.kind === "remove") {
        await pipelineApi.removeEntry(workspaceId, action.entry);
        notify({ tone: "good", title: t("index.entries.removedNotice", "Entry removed from search") });
      } else {
        await pipelineApi.purgeEntry(workspaceId, action.entry);
        notify({ tone: "good", title: t("index.entries.purgedNotice", "Entry deleted for good") });
      }
      changed();
    } catch (error) {
      const problem = describeProblem(error);
      notify({ tone: "error", title: problem.title, description: problem.detail ?? problem.description });
    }
  };

  const matches = (entry: IndexEntry) => {
    if (filter === "ALL") {
      return true;
    }
    if (filter === "WRITTEN") {
      return entry.origin !== "DERIVED";
    }
    return entry.origin === filter;
  };
  const shown = entries.status === "ready" ? entries.items.filter(matches) : [];

  /** Where an entry came from: its document and chunk, the chunk it replaces, or nowhere — it was written. */
  const comesFrom = (entry: IndexEntry) => {
    const derived = entry.origin === "OVERRIDE" && entry.linkedEntryId !== null ? (loadedById.get(entry.linkedEntryId) ?? null) : entry;
    const generation = derived?.generationId === null || derived?.generationId === undefined ? undefined : documentOf.get(derived.generationId);
    if (entry.origin === "MANUAL") {
      return <span className="text-xs text-muted">{t("index.entries.fromNothing", "Nothing — written straight into the index")}</span>;
    }
    if (generation === undefined || derived === null) {
      return (
        <span className="text-xs text-muted">
          {entry.origin === "OVERRIDE"
            ? t("index.entries.aChunk", "A chunk of a document")
            : t("index.entries.aDocument", "A document")}
        </span>
      );
    }
    const documentLink = (
      <Link to="/documents/$documentId" params={{ documentId: generation.documentId }} search={{ version: generation.versionId, tab: "chunks" }} className={ROW_LINK}>
        {titles.get(generation.documentId) ?? t("index.entries.itsDocument", "its document")}
      </Link>
    );
    return (
      <span className="text-xs">
        {entry.origin === "OVERRIDE"
          ? t("index.entries.replacesChunkOf", "Replaces chunk {number} of {document}", {
              number: derived.chunkNumber,
              document: documentLink,
            })
          : t("index.entries.chunkOf", "chunk {number} of {document}", { number: derived.chunkNumber, document: documentLink })}
      </span>
    );
  };

  return (
    <div className={PAGE}>
      <div className={TOOLBAR}>
        <div className={TOOLBAR_ACTIONS}>
          <Segmented<Filter>
            label={t("index.entries.origin", "Origin")}
            value={filter}
            onChange={setFilter}
            options={[
              { value: "WRITTEN", label: t("index.entries.filterWritten", "Written by people") },
              { value: "MANUAL", label: t("index.entries.filterManual", "New entries") },
              { value: "OVERRIDE", label: t("index.entries.filterOverride", "Replacements") },
              { value: "DERIVED", label: t("index.entries.filterDerived", "From documents") },
              { value: "ALL", label: t("index.filter.all", "All") },
            ]}
          />
          <Checkbox
            label={t("index.entries.showRemoved", "Show removed")}
            checked={includeRemoved}
            onChange={(event) => {
              setIncludeRemoved(event.target.checked);
            }}
          />
        </div>
        {mayManage && (
          <div className={TOOLBAR_ACTIONS}>
            <Button
              variant="quiet"
              onClick={() => {
                setPending({ kind: "clear" });
              }}
            >
              {t("index.entries.removeAllWritten", "Remove all written")}
            </Button>
            <Button
              variant="primary"
              icon="plus"
              onClick={() => {
                setEditing({ mode: "create" });
              }}
            >
              {t("index.entries.write", "Write an entry")}
            </Button>
          </div>
        )}
      </div>
      {entries.status === "loading" && <Waiting label={t("index.entries.loading", "Loading entries")} lines={5} />}
      {entries.status === "failed" && (
        <ProblemState
          layout="section"
          problem={entries.problem}
          actions={
            <Button icon="refresh" onClick={entries.reload}>
              {t("common.tryAgain", "Try again")}
            </Button>
          }
        />
      )}
      {entries.status === "ready" &&
        (shown.length === 0 ? (
          <EmptyState
            title={t("index.entries.empty", "No entries here")}
            description={
              filter === "WRITTEN" || filter === "MANUAL"
                ? t(
                    "index.entries.emptyWritten",
                    "Nothing written yet. A written entry is found by search like any chunk — a definition, an answer, a correction.",
                  )
                : t("index.entries.emptyFilter", "Nothing matches this filter on the pages loaded.")
            }
          />
        ) : (
          <div className={TABLE_SURFACE}>
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t("index.entries.entry", "Entry")}</th>
                  <th scope="col">{t("index.entries.origin", "Origin")}</th>
                  <th scope="col">{t("index.entries.comesFrom", "Comes from")}</th>
                  <th scope="col">
                    <span className="sr-only">{t("common.actions", "Actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((entry) => (
                  <tr key={entry.id}>
                    <td className="wraps">
                      <strong>{entry.title}</strong>
                      <div className={`text-xs text-secondary ${CLAMP_TWO_LINES}`}>{plainExcerpt(entry.text)}</div>
                    </td>
                    <td>
                      <Badge tone={ENTRY_ORIGIN[entry.origin].tone}>{ENTRY_ORIGIN[entry.origin].label}</Badge>{" "}
                      {entry.removed && <Badge tone="deny">{t("index.totals.removed", "Out of search")}</Badge>}
                      <div className="text-xs text-muted">
                        {t("index.entries.analyzerWords", "{analyzer} words", { analyzer: entry.analyzer })}
                      </div>
                    </td>
                    <td>{comesFrom(entry)}</td>
                    <td className="actions">
                      {mayManage &&
                        (entry.removed ? (
                          <Button
                            variant="quiet"
                            onClick={() => {
                              setPending({ kind: "purge", entry });
                            }}
                          >
                            {t("index.entries.deleteForGood", "Delete for good")}
                          </Button>
                        ) : (
                          <>
                            {entry.origin === "DERIVED" ? (
                              <Button
                                variant="quiet"
                                onClick={() => {
                                  setEditing({ mode: "replace", entry });
                                }}
                              >
                                {t("index.entries.replace", "Replace")}
                              </Button>
                            ) : (
                              <Button
                                variant="quiet"
                                iconOnly
                                icon="edit"
                                aria-label={t("index.entries.editTitle", "Edit {title}", { title: entry.title })}
                                title={t("index.entries.edit", "Edit")}
                                onClick={() => {
                                  setEditing({ mode: "edit", entry });
                                }}
                              />
                            )}
                            <Button
                              variant="quiet"
                              iconOnly
                              icon="trash"
                              aria-label={t("index.entries.removeTitle", "Remove {title}", { title: entry.title })}
                              title={t("index.entries.removeFromSearch", "Remove from search")}
                              onClick={() => {
                                setPending({ kind: "remove", entry });
                              }}
                            />
                          </>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <ListFooter
              shown={entries.items.length}
              counted={plural("index.entries.count", entries.items.length, { one: "{count} entry", other: "{count} entries" })}
              hasMore={entries.hasMore}
              loadingMore={entries.loadingMore}
              moreProblem={entries.moreProblem}
              onLoadMore={entries.loadMore}
            />
          </div>
        ))}
      <EntryDialog
        editing={editing}
        workspaceId={workspaceId}
        onClose={() => {
          setEditing(null);
        }}
        onSaved={() => {
          setEditing(null);
          notify({ tone: "good", title: t("index.entries.savedNotice", "Index entry saved") });
          changed();
        }}
      />
      <ConfirmDialog
        open={pending !== null}
        title={
          pending?.kind === "clear"
            ? t("index.entries.clearTitle", "Remove every written entry")
            : pending?.kind === "purge"
              ? t("index.entries.purgeTitle", "Delete the entry for good")
              : t("index.entries.removeFromSearch", "Remove from search")
        }
        confirmLabel={pending?.kind === "purge" ? t("index.entries.delete", "Delete") : t("index.entries.remove", "Remove")}
        destructive
        onConfirm={() => {
          if (pending !== null) {
            const action = pending;
            setPending(null);
            void confirm(action);
          }
        }}
        onCancel={() => {
          setPending(null);
        }}
      >
        <p>
          {pending?.kind === "clear"
            ? t(
                "index.entries.clearDescription",
                "Every manual entry and every replacement stops being found. Entries derived from documents are not touched.",
              )
            : pending?.kind === "purge"
              ? t(
                  "index.entries.purgeDescription",
                  "The removed entry is deleted outright. This is refused while a vector still references it.",
                )
              : t(
                  "index.entries.removeDescription",
                  "The entry stops being found; it is kept, marked removed, and vectors built from it are withdrawn.",
                )}
        </p>
      </ConfirmDialog>
    </div>
  );
}
