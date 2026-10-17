import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Can } from "../../access/Can";
import { usePermissions } from "../../access/PermissionsProvider";
import { PERMISSIONS } from "../../access/permissions";
import { formatBytes, formatDateTime, formatNumber, labelOfCode } from "../../application/format";
import { describeProblem } from "../../application/problems";
import { useReadySession } from "../../application/session";
import { usePageTitle } from "../../application/usePageTitle";
import { useResource } from "../../application/useResource";
import { api } from "../../lib/api";
import type { SourceView } from "../../lib/contracts";
import type { ListedRuleSet } from "../../lib/ruleSets";
import type { ScannerRunView, ScannerView } from "../../lib/sourceContracts";
import { useTranslation } from "../../translations/TranslationProvider";
import {
  ConfirmDialog,
  Facts,
  Notice,
  PageHeader,
  PathText,
  ProblemState,
  TabPanel,
  Tabs,
  Waiting,
  useToaster,
} from "../../ui/components";
import { Badge, Button, Icon } from "../../ui/primitives";
import { SourceRuleSets } from "./rules/SourceRuleSets";
import { SourceDocumentsPanel } from "./documents/SourceDocumentsPanel";
import { SourceIndexingPanel } from "./indexing/SourceIndexingPanel";
import { RemoveSourceDialog, describeSourceRemoval } from "./RemoveSourceDialog";
import { SCAN_STATES } from "./scanOutcomes";
import { ScanningSettings } from "./ScanningSettings";
import { ScanSchedule } from "./ScanSchedule";
import { ScansPanel } from "./ScansPanel";
import { SourceFormDialog } from "./SourceFormDialog";
import { SOURCE_KINDS, isScanned } from "./sourceKinds";
import { SourceArrival } from "./SourceArrival";
import { SourceConnectionSetting } from "./SourceConnectionSetting";
import {
  DEFAULT_SCAN_DEPTH,
  ruleSetsOfSource,
  scannerOfSource,
  startScan,
} from "./sourceOperations";
import {
  BLOCK,
  BLOCK_HEAD,
  CARD_ACTIONS,
  COUNTERS,
  CRUMB_LINK,
  LOCATION,
  OVERVIEW,
  REMOVAL_NOTICE,
  RULE_SUMMARY,
  SCAN_LINE,
  SECTION_TITLE,
} from "./sourcePageClasses";
import { useAddressChange } from "../../application/useAddressChange";

type TabKey = "overview" | "documents" | "rules" | "scans" | "indexing";

interface SourceDetail {
  source: SourceView;
  scanner: ScannerView | null;
  ruleSets: ListedRuleSet[];
  latestScan: ScannerRunView | null;
}

export function SourcePage() {
  const { t } = useTranslation();
  const { workspace } = useReadySession();
  const workspaceId = workspace?.id ?? "";
  const { sourceId } = useParams({ strict: false }) as { sourceId: string };
  const search = useSearch({ strict: false }) as { tab?: string };
  const navigate = useNavigate();
  const changeAddress = useAddressChange();
  const permissions = usePermissions();
  const { notify } = useToaster();
  const tab: TabKey =
    search.tab === "rules" ||
    search.tab === "scans" ||
    search.tab === "indexing" ||
    search.tab === "documents"
      ? search.tab
      : "overview";
  const [refreshKey, setRefreshKey] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [removingSource, setRemovingSource] = useState(false);
  // Asking to write a document from outside the Documents tab: the tab opens and the writer with it.
  // A counter rather than a flag, so asking again while the tab is already open opens it again.
  const [writeRequests, setWriteRequests] = useState(0);

  // Read once the permissions are known, so a first render before they arrive does not settle on "no rules".
  const mayReadAutomation = permissions.may(PERMISSIONS.automationRead);
  const detail = useResource<SourceDetail>(async () => {
    const [source, scanner, ruleSets, scans] = await Promise.all([
      api.getSource(workspaceId, sourceId),
      scannerOfSource(workspaceId, sourceId),
      mayReadAutomation ? ruleSetsOfSource(workspaceId, sourceId) : Promise.resolve([]),
      mayReadAutomation
        ? api.scansOfSource(workspaceId, sourceId, { limit: 1, offset: 0 })
        : Promise.resolve([]),
    ]);
    return { source, scanner, ruleSets, latestScan: scans[0] ?? null };
  }, [workspaceId, sourceId, refreshKey, mayReadAutomation]);

  usePageTitle(detail.status === "ready" ? detail.data.source.name : t("sources.source", "Source"));

  const selectTab = (next: TabKey) => {
    void changeAddress({
      to: "/sources/$sourceId",
      params: { sourceId },
      search: next === "overview" ? {} : { tab: next },
    });
  };

  if (detail.status === "loading") {
    return <Waiting label={t("sources.loadingSource", "Loading the source")} lines={6} />;
  }
  if (detail.status === "failed") {
    return (
      <ProblemState
        problem={detail.problem}
        actions={
          <>
            <Button icon="refresh" variant="primary" onClick={detail.reload}>
              {t("common.tryAgain", "Try again")}
            </Button>
            <Button href="/sources" variant="quiet">
              {t("sources.allSources", "All sources")}
            </Button>
          </>
        }
      />
    );
  }

  const { source, scanner, ruleSets, latestScan } = detail.data;
  const kind = SOURCE_KINDS[source.kind];
  const scannable = isScanned(source.kind);
  const removed = source.removedAt !== null;
  // A source nobody scans is filled by hand, so adding a document is this page's primary action — where
  // "Scan now" stands on a scanned one. Without it the only way in was the Documents tab.
  const writable =
    (source.kind === "CUSTOM_TEXT" || source.kind === "MANAGED_FOLDER") &&
    source.enabled &&
    !removed;
  const requestWriting = () => {
    setWriteRequests((requests) => requests + 1);
    selectTab("documents");
  };

  const scanNow = async () => {
    setScanning(true);
    try {
      await startScan(workspaceId, source.id);
      notify({
        tone: "good",
        title: t("sources.scanStarted", "Scan started"),
        description: source.name,
      });
      setRefreshKey((current) => current + 1);
      selectTab("scans");
    } catch (error) {
      const problem = describeProblem(error);
      notify({
        tone: "error",
        title: t("sources.scanNotStarted", "The scan did not start"),
        description: problem.detail ?? problem.description,
      });
    } finally {
      setScanning(false);
    }
  };

  const setEnabled = async (enabled: boolean) => {
    try {
      await api.changeSource(workspaceId, source.id, {
        name: source.name,
        enabled,
        revision: source.revision,
      });
      notify({
        tone: "good",
        title: enabled
          ? t("sources.enabledToast", "{name} enabled", { name: source.name })
          : t("sources.disabledToast", "{name} disabled", { name: source.name }),
      });
      setRefreshKey((current) => current + 1);
    } catch (error) {
      const problem = describeProblem(error);
      notify({
        tone: "error",
        title: problem.title,
        description: problem.detail ?? problem.description,
      });
    } finally {
      setDisabling(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Link to="/sources" className={CRUMB_LINK}>
              {t("sources.title", "Sources")}
            </Link>{" "}
            / {kind.label}
          </>
        }
        title={source.name}
        status={
          removed ? (
            <Badge tone="deny">{t("sources.removed", "Removed")}</Badge>
          ) : (
            <Badge tone={source.enabled ? "allow" : "deny"}>
              {source.enabled ? t("sources.enabled", "Enabled") : t("sources.disabled", "Disabled")}
            </Badge>
          )
        }
        lead={
          source.location !== null && (
            <span className={LOCATION}>
              <Icon name={source.kind === "LOCAL_FOLDER" ? "folder" : "link"} size="small" />
              <PathText path={source.location} fit="end" />
            </span>
          )
        }
        actions={
          !removed && (
            <>
              <Can permission={PERMISSIONS.documentWrite}>
                {writable && (
                  <Button variant="primary" icon="plus" onClick={requestWriting}>
                    {t("sources.documents.add", "Add a document")}
                  </Button>
                )}
              </Can>
              <Can permission={PERMISSIONS.sourceManage}>
                <Button
                  onClick={() => {
                    setRenaming(true);
                  }}
                >
                  {t("sources.rename", "Rename")}
                </Button>
                {source.enabled ? (
                  <Button
                    variant="danger"
                    onClick={() => {
                      setDisabling(true);
                    }}
                  >
                    {t("sources.disable", "Disable")}
                  </Button>
                ) : (
                  <Button onClick={() => void setEnabled(true)}>
                    {t("sources.enable", "Enable")}
                  </Button>
                )}
                {scannable && (
                  <Button
                    variant="primary"
                    icon="play"
                    disabled={!source.enabled || scanning}
                    title={
                      source.enabled
                        ? undefined
                        : t("sources.enableToScan", "Enable the source to scan it")
                    }
                    onClick={() => void scanNow()}
                  >
                    {scanning
                      ? t("sources.starting", "Starting…")
                      : t("sources.scanNow", "Scan now")}
                  </Button>
                )}
                <Button variant="danger" icon="trash" onClick={() => setRemovingSource(true)}>
                  {t("sources.remove", "Remove")}
                </Button>
              </Can>
            </>
          )
        }
      />

      {removed && (
        <div className={REMOVAL_NOTICE}>
          <Notice
            tone="warn"
            title={t("sources.removedAt", "Removed {time}", {
              time: formatDateTime(source.removedAt ?? ""),
            })}
          >
            {t(
              "sources.removedNotice",
              "This source and every document in it are out of the corpus. Nothing it captured was erased: its documents and their history can still be opened by address.",
            )}
          </Notice>
        </div>
      )}

      <Tabs<TabKey>
        label={t("sources.source", "Source")}
        active={tab}
        onSelect={selectTab}
        items={[
          { key: "overview", label: t("sources.tab.overview", "Overview") },
          { key: "documents", label: t("sources.tab.documents", "Documents") },
          ...(permissions.may(PERMISSIONS.automationRead)
            ? [
                {
                  key: "rules" as const,
                  label: t("sources.tab.rules", "Rules"),
                  count: ruleSets.length,
                },
                { key: "scans" as const, label: t("sources.tab.scans", "Scans") },
                { key: "indexing" as const, label: t("sources.tab.indexing", "Indexing") },
              ]
            : []),
        ]}
      />

      {tab === "overview" && (
        <TabPanel tabKey="overview">
          <Overview
            source={source}
            ruleSets={ruleSets}
            latestScan={latestScan}
            onOpen={selectTab}
            onWrite={writable ? requestWriting : undefined}
            onChanged={() => setRefreshKey((current) => current + 1)}
          />
          <SourceArrival
            workspaceId={workspaceId}
            source={source}
            latestScan={latestScan}
            onChanged={() => setRefreshKey((current) => current + 1)}
          />
          {scannable && (
            <ScanningSettings
              workspaceId={workspaceId}
              source={source}
              onChanged={() => setRefreshKey((current) => current + 1)}
            />
          )}
        </TabPanel>
      )}
      {tab === "rules" && (
        <TabPanel tabKey="rules">
          <SourceRuleSets
            workspaceId={workspaceId}
            source={source}
            maximumDepth={scanner?.maximumDepth ?? DEFAULT_SCAN_DEPTH}
            onSaved={() => setRefreshKey((current) => current + 1)}
          />
        </TabPanel>
      )}
      {tab === "scans" && (
        <TabPanel tabKey="scans">
          <ScansPanel workspaceId={workspaceId} sourceId={source.id} refreshKey={refreshKey} />
        </TabPanel>
      )}

      {tab === "documents" && (
        <TabPanel tabKey="documents">
          <SourceDocumentsPanel
            workspaceId={workspaceId}
            source={source}
            writeRequests={writeRequests}
          />
        </TabPanel>
      )}
      {tab === "indexing" && (
        <TabPanel tabKey="indexing">
          <SourceIndexingPanel
            workspaceId={workspaceId}
            sourceId={source.id}
            sourceName={source.name}
          />
        </TabPanel>
      )}

      <SourceFormDialog
        open={renaming}
        workspaceId={workspaceId}
        source={source}
        onClose={() => {
          setRenaming(false);
        }}
        onSaved={(saved) => {
          setRenaming(false);
          notify({
            tone: "good",
            title: t("sources.savedToast", "{name} saved", { name: saved.name }),
          });
          setRefreshKey((current) => current + 1);
        }}
      />
      <RemoveSourceDialog
        open={removingSource}
        workspaceId={workspaceId}
        source={source}
        onClose={() => setRemovingSource(false)}
        onRemoved={(removal) => {
          setRemovingSource(false);
          notify({
            tone: "good",
            title: t("sources.removedToast", "{name} removed", { name: source.name }),
            description: describeSourceRemoval(removal),
          });
          void navigate({ to: "/sources" });
        }}
      />
      <ConfirmDialog
        open={disabling}
        title={t("sources.disableSource", "Disable source")}
        confirmLabel={t("sources.disableSource", "Disable source")}
        destructive
        onConfirm={() => void setEnabled(false)}
        onCancel={() => {
          setDisabling(false);
        }}
      >
        <p>
          {t(
            "sources.disableConfirmation",
            "{name} stops being scanned. Its documents stay, and it can be enabled again later.",
            { name: <strong>{source.name}</strong> },
          )}
        </p>
      </ConfirmDialog>
    </>
  );
}

/** What the last scan of a scanned source found, took and left out. */
function LatestScan({
  source,
  latestScan,
  onOpen,
}: {
  source: SourceView;
  latestScan: ScannerRunView | null;
  onOpen: (tab: TabKey) => void;
}) {
  const { t } = useTranslation();
  return (
    <section className={BLOCK} aria-labelledby="overview-scan">
      <div className={BLOCK_HEAD}>
        <h2 id="overview-scan" className={SECTION_TITLE}>
          {t("sources.latestScan", "Latest scan")}
        </h2>
        {latestScan !== null && (
          <Button variant="quiet" icon="arrow" onClick={() => onOpen("scans")}>
            {t("sources.allScans", "All scans")}
          </Button>
        )}
      </div>
      <Can permission={PERMISSIONS.automationRead}>
        <ScanSchedule workspaceId={source.workspaceId} sourceId={source.id} />
      </Can>
      {latestScan === null ? (
        <p className="text-secondary">
          {t("sources.neverScanned", "Never scanned. Scan now to capture what the rules take.")}
        </p>
      ) : (
        <>
          <p className={SCAN_LINE}>
            <Badge
              tone={
                latestScan.job.status === "SUCCEEDED"
                  ? "good"
                  : latestScan.job.status === "FAILED"
                    ? "error"
                    : "active"
              }
            >
              {labelOfCode(SCAN_STATES, latestScan.job.status)}
            </Badge>
            <span className="text-xs text-secondary">
              {formatDateTime(latestScan.job.updatedAt)}
            </span>
          </p>
          <dl className={COUNTERS}>
            <div>
              <dt>{t("sources.scans.found", "Found")}</dt>
              <dd className="numeric">
                {latestScan.discoveredCount === null
                  ? "…"
                  : formatNumber(latestScan.discoveredCount)}
              </dd>
            </div>
            <div>
              <dt>{t("sources.scans.taken", "Taken")}</dt>
              <dd className="numeric">{formatNumber(latestScan.includedCount)}</dd>
            </div>
            <div>
              <dt>
                {source.kind === "CONNECTED"
                  ? t("sources.scans.unchangedOrLeftOut", "Unchanged or left out")
                  : t("sources.scans.leftOut", "Left out")}
              </dt>
              <dd className="numeric">{formatNumber(latestScan.skippedCount)}</dd>
            </div>
            <div>
              <dt>{t("sources.scans.captured", "Captured")}</dt>
              <dd className="numeric">{formatBytes(latestScan.totalBytes)}</dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );
}

interface OverviewProperties {
  source: SourceView;
  ruleSets: ListedRuleSet[];
  latestScan: ScannerRunView | null;
  onOpen: (tab: TabKey) => void;
  /** Given for a source written in by hand: the card then offers the writer, not only the way to the list. */
  onWrite?: () => void;
  onChanged: () => void;
}

function Overview({
  source,
  ruleSets,
  latestScan,
  onOpen,
  onWrite,
  onChanged,
}: OverviewProperties) {
  const { t, plural } = useTranslation();
  return (
    <div className={OVERVIEW}>
      <section className={BLOCK} aria-labelledby="overview-connection">
        <div className={BLOCK_HEAD}>
          <h2 id="overview-connection" className={SECTION_TITLE}>
            {t("sources.connection", "Connection")}
          </h2>
        </div>
        <Facts
          rows={[
            [t("sources.kind", "Kind"), SOURCE_KINDS[source.kind].label],
            // A knowledge base has no location; its connection and sections are shown under "Knowledge base".
            ...(source.kind === "CONNECTED"
              ? []
              : [
                  [
                    SOURCE_KINDS[source.kind].locationLabel ??
                      t("sources.column.location", "Location"),
                    source.location === null ? (
                      isScanned(source.kind) ? (
                        t("sources.locationNone", "None")
                      ) : (
                        t("sources.locationInRaccoon", "None — documents are added in Raccoon")
                      )
                    ) : (
                      <PathText path={source.location} />
                    ),
                  ] as [string, ReactNode],
                ]),
            [t("sources.column.created", "Created"), formatDateTime(source.createdAt)],
          ]}
        />
        {isScanned(source.kind) && source.removedAt === null && (
          <SourceConnectionSetting
            workspaceId={source.workspaceId}
            source={source}
            onChanged={onChanged}
          />
        )}
      </section>

      {isScanned(source.kind) ? (
        <LatestScan source={source} latestScan={latestScan} onOpen={onOpen} />
      ) : (
        <section className={BLOCK} aria-labelledby="overview-arrival">
          <div className={BLOCK_HEAD}>
            <h2 id="overview-arrival" className={SECTION_TITLE}>
              {t("sources.tab.documents", "Documents")}
            </h2>
            <div className={CARD_ACTIONS}>
              {onWrite !== undefined && (
                <Can permission={PERMISSIONS.documentWrite}>
                  <Button variant="primary" icon="plus" onClick={onWrite}>
                    {t("sources.documents.add", "Add a document")}
                  </Button>
                </Can>
              )}
              <Button variant="quiet" icon="arrow" onClick={() => onOpen("documents")}>
                {t("sources.allDocuments", "All documents")}
              </Button>
            </div>
          </div>
          <p className="text-secondary">
            {t("sources.notScanned", "{explanation} Nothing is scanned.", {
              explanation: SOURCE_KINDS[source.kind].explanation,
            })}
          </p>
        </section>
      )}

      <section className={BLOCK} aria-labelledby="overview-rules">
        <div className={BLOCK_HEAD}>
          <h2 id="overview-rules" className={SECTION_TITLE}>
            {t("sources.tab.rules", "Rules")}
          </h2>
          <Button variant="quiet" icon="arrow" onClick={() => onOpen("rules")}>
            {ruleSets.length === 0
              ? t("sources.addRules", "Add rules")
              : t("sources.editBinding", "Change what it binds")}
          </Button>
        </div>
        {ruleSets.length === 0 ? (
          <p className="text-secondary">
            {t("sources.noRuleSets", "No rule set bound — every file is taken.")}
          </p>
        ) : (
          <ol className={RULE_SUMMARY}>
            {ruleSets.map((ruleSet) => (
              <li key={ruleSet.id}>
                <Link to="/rules/$ruleSetId" params={{ ruleSetId: ruleSet.id }}>
                  {ruleSet.name}
                </Link>
                <span className="text-xs text-muted">
                  {ruleSet.stages.includes("MATERIAL")
                    ? plural("sources.policyRules", ruleSet.rules, {
                        one: "{count} rule",
                        other: "{count} rules",
                      })
                    : t("sources.policyNoDoorRules", "no rules at the door")}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
