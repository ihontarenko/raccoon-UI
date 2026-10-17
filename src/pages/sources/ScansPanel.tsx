import { useMemo, useState } from "react";
import {
  formatBytes,
  formatDateTime,
  formatNumber,
  labelOfCode,
  shortIdentifier,
  type CodeLabels,
} from "../../application/format";
import { usePagedList } from "../../application/usePagedList";
import { usePolling } from "../../application/usePolling";
import { useResource } from "../../application/useResource";
import { api } from "../../lib/api";
import type { ItemOutcome, ScannerRunView } from "../../lib/sourceContracts";
import { declareText, translate, translatePlural } from "../../translations/translate";
import { useTranslation } from "../../translations/TranslationProvider";
import { EmptyState, ListFooter, ProblemState, RowName, Segmented, Waiting } from "../../ui/components";
import { Badge, Button, Table, type BadgeTone } from "../../ui/primitives";
import { OUTCOMES, SCAN_STATES, outcomeOf } from "./scanOutcomes";
import { PATH_CELL, POSITION_CELL, SCANS, SCAN_FILES, SCAN_FILES_HEAD, SCRIPT_VARIABLES, SECTION_TITLE, TABLE_SURFACE } from "./sourcePageClasses";

const RUNNING = new Set(["QUEUED", "RUNNING"]);

const STATUS_TONE: Record<string, BadgeTone> = {
  QUEUED: "neutral",
  RUNNING: "active",
  SUCCEEDED: "good",
  FAILED: "error",
  CANCELLED: "warn",
};

/** Why a scan's job stopped, when the worker recorded no reason of its own. */
const SCAN_FAILURES: CodeLabels = {
  LOCAL_FOLDER_IMPORT_FAILED: declareText("sources.scanFailure.importFailed", "The scan failed"),
  LEASE_EXPIRED: declareText("sources.scanFailure.leaseExpired", "The worker stopped answering"),
  JOB_POLICY_REFUSED: declareText("sources.scanFailure.policyRefused", "The job policy refused it"),
};

const ITEM_FILTERS: (ItemOutcome | "ALL")[] = ["ALL", "INCLUDE", "SKIP", "EXCLUDED_FOLDER", "REVIEW", "DEPTH_LIMIT", "FILE_BYTE_LIMIT"];

interface ScansPanelProperties {
  workspaceId: string;
  sourceId: string;
  /** Bumped by the page when it starts a scan, so the list picks it up at once. */
  refreshKey: number;
}

export function ScansPanel({ workspaceId, sourceId, refreshKey }: ScansPanelProperties) {
  const { t } = useTranslation();
  const scans = useResource(() => api.scansOfSource(workspaceId, sourceId, { limit: 25, offset: 0 }), [workspaceId, sourceId, refreshKey]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // While a scan is queued or running, the list refreshes itself; it stops the moment none is.
  const anyRunning = scans.status === "ready" && scans.data.some((scan) => RUNNING.has(scan.job.status));
  usePolling(anyRunning, scans.reload, scans.status === "ready" ? scans.data : null);

  if (scans.status === "loading") {
    return <Waiting label={t("sources.scans.loading", "Loading scans")} lines={4} />;
  }
  if (scans.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={scans.problem}
        actions={
          <Button icon="refresh" onClick={scans.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }
  if (scans.data.length === 0) {
    return (
      <EmptyState
        title={t("sources.scans.never", "Never scanned")}
        description={t(
          "sources.scans.neverDescription",
          "A scan walks the folder, judges every file by the source's rules and captures what they take.",
        )}
      />
    );
  }

  const selected = scans.data.find((scan) => scan.job.id === selectedId) ?? scans.data[0];

  return (
    <div className={SCANS}>
      <div className={TABLE_SURFACE}>
        <Table>
          <thead>
            <tr>
              <th scope="col">{t("sources.scans.scan", "Scan")}</th>
              <th scope="col">{t("sources.scans.status", "Status")}</th>
              <th scope="col" className="numeric">
                {t("sources.scans.found", "Found")}
              </th>
              <th scope="col" className="numeric">
                {t("sources.scans.taken", "Taken")}
              </th>
              <th scope="col" className="numeric">
                {t("sources.scans.leftOut", "Left out")}
              </th>
              <th scope="col" className="numeric">
                {t("sources.scans.captured", "Captured")}
              </th>
            </tr>
          </thead>
          <tbody>
            {scans.data.map((scan) => (
              <tr key={scan.job.id} data-selected={scan.job.id === selected.job.id}>
                <td>
                  <RowName
                    selected={scan.job.id === selected.job.id}
                    onSelect={() => {
                      setSelectedId(scan.job.id);
                    }}
                  >
                    {formatDateTime(scan.job.createdAt)}
                  </RowName>
                  <div className="numeric text-muted">{shortIdentifier(scan.job.id)}</div>
                  {scan.snapshotRevision !== null && <div className="text-xs text-muted">{snapshotLabel(scan)}</div>}
                  {snapshotFailureOf(scan) !== null && <div className="text-xs text-secondary wraps">{snapshotFailureOf(scan)}</div>}
                </td>
                <td>
                  <Badge tone={STATUS_TONE[scan.job.status] ?? "neutral"}>{labelOfCode(SCAN_STATES, scan.job.status)}</Badge>
                </td>
                <td className="numeric">{scan.discoveredCount === null ? "…" : formatNumber(scan.discoveredCount)}</td>
                <td className="numeric">{formatNumber(scan.includedCount)}</td>
                <td className="numeric">{formatNumber(scan.skippedCount)}</td>
                <td className="numeric">{formatBytes(scan.totalBytes)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      <ScanFiles key={selected.job.id} workspaceId={workspaceId} scan={selected} />
    </div>
  );
}

/** What a git, web or knowledge-base scan read: the commit, the pages fetched, or the pages listed. */
function snapshotLabel(scan: ScannerRunView): string {
  const detail = scan.snapshotDetail ?? {};
  if (typeof detail.commit === "string") {
    return translate("sources.scans.snapshot.commit", "commit {commit}", { commit: detail.commit.slice(0, 12) });
  }
  // A knowledge base: how many pages its connector listed, how many of the source's documents were gone there.
  if (typeof detail.listed === "number") {
    const deletions = Number(detail.deletions ?? 0);
    const listed = translatePlural("sources.scans.snapshot.listed", detail.listed, {
      one: "{count} page listed",
      other: "{count} pages listed",
    });
    const deleted =
      deletions > 0
        ? `, ${translatePlural("sources.scans.snapshot.deletions", deletions, { one: "{count} deletion", other: "{count} deletions" })}`
        : "";
    const changes = translate("sources.scans.snapshot.changesUpTo", "changes up to {revision}", {
      revision: String(scan.snapshotRevision).replace("T", " "),
    });
    return `${listed}${deleted} · ${changes}`;
  }
  return translatePlural(
    "sources.scans.snapshot.fetched",
    Number(detail.fetched ?? 0),
    { one: "{count} page fetched, {refused} refused", other: "{count} pages fetched, {refused} refused" },
    { refused: formatNumber(Number(detail.refused ?? 0)) },
  );
}

/** Why a git or web scan could not make its snapshot, as the worker recorded it; null when it did. */
function snapshotFailureOf(scan: ScannerRunView): string | null {
  const reason = scan.snapshotDetail?.failureReason;
  return typeof reason === "string" ? reason : null;
}

/** The files one scan judged, filtered by what happened to them. */
function ScanFiles({ workspaceId, scan }: { workspaceId: string; scan: ScannerRunView }) {
  const { t, plural } = useTranslation();
  const [filter, setFilter] = useState<ItemOutcome | "ALL">("ALL");
  const items = usePagedList(
    (page) => api.scanItems(workspaceId, scan.job.id, filter === "ALL" ? null : filter, page),
    [workspaceId, scan.job.id, filter, scan.cursor],
  );
  const running = RUNNING.has(scan.job.status);
  const variables = useMemo(() => Object.values(scan.ruleVariables ?? {}).flatMap((values) => Object.entries(values)), [scan]);

  const describeProgress = (): string => {
    if (scan.job.status === "QUEUED") {
      return t("sources.scans.queuedNote", "Queued — a worker picks it up on its next round.");
    }
    if (running) {
      return t("sources.scans.judgedSoFar", "Judged {judged} of {found} so far.", {
        judged: formatNumber(scan.cursor),
        found: scan.discoveredCount === null ? "…" : formatNumber(scan.discoveredCount),
      });
    }
    if (scan.job.failureCode !== null) {
      return t("sources.scans.stopped", "Stopped: {reason}", {
        reason: snapshotFailureOf(scan) ?? `${labelOfCode(SCAN_FAILURES, scan.job.failureCode)}.`,
      });
    }
    return t("sources.scans.finished", "Finished {time}.", { time: formatDateTime(scan.job.updatedAt) });
  };

  return (
    <section className={SCAN_FILES} aria-labelledby="scan-files-title">
      <header className={SCAN_FILES_HEAD}>
        <div>
          <h2 id="scan-files-title" className={SECTION_TITLE}>
            {t("sources.scans.filesTitle", "Files in this scan")}
          </h2>
          <p className="text-xs text-muted">{describeProgress()}</p>
        </div>
        {variables.length > 0 && (
          <dl className={SCRIPT_VARIABLES} aria-label={t("sources.scans.variables", "What the rule scripts remembered")}>
            {variables.map(([name, value]) => (
              <div key={name}>
                <dt className="numeric">{name}</dt>
                <dd className="numeric">{String(value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </header>
      <Segmented
        label={t("sources.scans.show", "Show")}
        options={ITEM_FILTERS.map((value) => ({
          value,
          label: value === "ALL" ? t("sources.scans.all", "All") : OUTCOMES[value].label,
        }))}
        value={filter}
        onChange={setFilter}
      />
      {items.status === "loading" && <Waiting label={t("sources.scans.loadingFiles", "Loading files")} lines={4} />}
      {items.status === "failed" && <ProblemState layout="section" problem={items.problem} />}
      {items.status === "ready" &&
        (items.items.length === 0 ? (
          <p className="text-xs text-muted">
            {running ? t("sources.scans.nothingYet", "Nothing yet.") : t("sources.scans.noFile", "No file here.")}
          </p>
        ) : (
          <div className={TABLE_SURFACE}>
            <Table>
              <thead>
                <tr>
                  <th scope="col" className={`numeric ${POSITION_CELL}`}>
                    #
                  </th>
                  <th scope="col">{t("sources.scans.path", "Path")}</th>
                  <th scope="col">{t("sources.scans.outcome", "Outcome")}</th>
                </tr>
              </thead>
              <tbody>
                {items.items.map((item) => {
                  const outcome = outcomeOf(item.outcome);
                  return (
                    <tr key={item.number}>
                      <td className="numeric text-muted">{item.number + 1}</td>
                      <td className={PATH_CELL} title={item.path}>
                        {item.path}
                      </td>
                      <td>
                        <Badge tone={outcome.tone}>{outcome.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <ListFooter
              shown={items.items.length}
              counted={plural("sources.scans.fileCount", items.items.length, { one: "{count} file", other: "{count} files" })}
              hasMore={items.hasMore}
              loadingMore={items.loadingMore}
              moreProblem={items.moreProblem}
              onLoadMore={items.loadMore}
            />
          </div>
        ))}
    </section>
  );
}
