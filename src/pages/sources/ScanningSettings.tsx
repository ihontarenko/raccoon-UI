import { useState } from "react";
import { usePermissions } from "../../access/PermissionsProvider";
import { PERMISSIONS } from "../../access/permissions";
import { explainParameter } from "../../application/parameterExplanations";
import { describeProblem, type Problem } from "../../application/problems";
import { useResource } from "../../application/useResource";
import { api, collectAllPages, workspacePath } from "../../lib/api";
import type { SourceView } from "../../lib/contracts";
import type { ScannerBindingView } from "../../lib/sourceContracts";
import { ExplainParameter, Notice, ParameterFindings, useToaster } from "../../ui/components";
import { useTranslation } from "../../translations/TranslationProvider";
import { Button, Checkbox, Dialog, Field, Input } from "../../ui/primitives";
import { DIALOG_BODY, SCANNING_ACTIONS, SCANNING_FACTS, SCANNING_STRIP, SCANNING_SWITCH } from "./sourcePageClasses";

/** The scanner accepts depths from 0 — only the files in the folder itself — to 32. */
const DEPTH_LIMIT = 32;

interface ScanningSettingsProperties {
  workspaceId: string;
  source: SourceView;
  onChanged: () => void;
}

/**
 * How this source is scanned: the scanner it is bound to, how deep that scanner walks, and whether the
 * binding allows scanning at all. A scanner is shared by every source bound to it, and the depth dialog
 * names them before anything is changed.
 */
export function ScanningSettings({ workspaceId, source, onChanged }: ScanningSettingsProperties) {
  const { t, plural } = useTranslation();
  const { notify } = useToaster();
  const mayManage = usePermissions().may(PERMISSIONS.sourceManage);
  const loaded = useResource(async () => {
    const [binding] = await api.scannerBindingsOfSource(workspaceId, source.id);
    if (binding === undefined) {
      return null;
    }
    const [scanners, sources] = await Promise.all([
      collectAllPages((page) => api.listScanners(workspaceId, page)),
      collectAllPages((page) => api.listSources(workspaceId, page)),
    ]);
    const scanner = scanners.find((candidate) => candidate.id === binding.scannerId) ?? null;
    const sharing = await Promise.all(
      sources
        .filter((candidate) => candidate.id !== source.id)
        .map(async (candidate) =>
          (await api.scannerBindingsOfSource(workspaceId, candidate.id)).some(
            (other) => other.scannerId === binding.scannerId,
          )
            ? candidate
            : null,
        ),
    );
    return {
      binding,
      scanner,
      sharedWith: sharing.filter((candidate): candidate is SourceView => candidate !== null),
    };
  }, [workspaceId, source.id]);
  const [editingDepth, setEditingDepth] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loaded.status !== "ready") {
    return null;
  }
  if (loaded.data === null) {
    return (
      <section className={SCANNING_STRIP} aria-label={t("sources.scanning", "Scanning")}>
        <span className="text-xs text-secondary">
          {t("sources.scanning.notBound", "Not bound to a scanner yet — the first scan binds the workspace's scanner.")}
        </span>
      </section>
    );
  }
  const { binding, scanner, sharedWith } = loaded.data;

  const setAllowed = async (enabled: boolean) => {
    setBusy(true);
    try {
      await api.send<ScannerBindingView>(
        "PUT",
        workspacePath(workspaceId, `/scanner-bindings/${binding.id}`),
        { enabled, revision: binding.revision },
      );
      notify({
        tone: "good",
        title: enabled
          ? t("sources.scanning.allowed", "Scanning allowed")
          : t("sources.scanning.paused", "Scanning paused for this source"),
      });
      loaded.reload();
      onChanged();
    } catch (error) {
      const problem = describeProblem(error);
      notify({
        tone: "error",
        title: problem.title,
        description: problem.detail ?? problem.description,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={SCANNING_STRIP} aria-label={t("sources.scanning", "Scanning")}>
      <div className={SCANNING_FACTS}>
        <span className="eyebrow">{t("sources.scanning", "Scanning")}</span>
        <span>
          <strong>{scanner?.name ?? t("sources.scanning.unknownScanner", "Unknown scanner")}</strong>
          {foldersCount(source) && (
            <>
              {" · "}
              {scanner === null
                ? t("sources.scanning.depthUnknown", "up to ? folders deep")
                : plural("sources.scanning.depth", scanner.maximumDepth, {
                    one: "up to {count} folder deep",
                    other: "up to {count} folders deep",
                  })}
            </>
          )}
          {sharedWith.length > 0 && (
            <span className="text-xs text-muted">
              {" · "}
              {sharedWith.length === 1
                ? t("sources.scanning.sharedWithOne", "shared with {name}", { name: sharedWith[0]?.name ?? "" })
                : plural("sources.scanning.sharedWithMany", sharedWith.length, {
                    one: "shared with {count} source",
                    other: "shared with {count} sources",
                  })}
            </span>
          )}
        </span>
      </div>
      {mayManage && (
        <div className={SCANNING_ACTIONS}>
          <span className={SCANNING_SWITCH}>
            <Checkbox
              label={t("sources.scanning.allowed", "Scanning allowed")}
              checked={binding.enabled}
              disabled={busy}
              onChange={(event) => void setAllowed(event.target.checked)}
            />
            <ExplainParameter
              name={t("sources.scanning.allowed", "Scanning allowed")}
              identifier="enabled"
              explanation={explainParameter("scanning", "enabled", { title: t("sources.scanning.allowed", "Scanning allowed") })}
            />
          </span>
          {scanner !== null && foldersCount(source) && (
            <Button variant="quiet" icon="edit" onClick={() => setEditingDepth(true)}>
              {t("sources.scanning.changeDepth", "Change depth")}
            </Button>
          )}
        </div>
      )}
      {scanner !== null && (
        <DepthDialog
          open={editingDepth}
          workspaceId={workspaceId}
          scanner={scanner}
          sharedWith={sharedWith}
          onClose={() => setEditingDepth(false)}
          onSaved={(depth) => {
            setEditingDepth(false);
            notify({
              tone: "good",
              title: plural("sources.scanning.depthSaved", depth, {
                one: "Scans now go {count} folder deep",
                other: "Scans now go {count} folders deep",
              }),
            });
            loaded.reload();
            onChanged();
          }}
        />
      )}
    </section>
  );
}

/**
 * Whether the scanner's depth limits this source: it counts folders. A web source keeps its crawl mode and
 * link depth in its own options, and its snapshot is walked whole; a knowledge base has sections, not folders,
 * and every one under a chosen section is read.
 */
function foldersCount(source: SourceView): boolean {
  return source.kind !== "WEB" && source.kind !== "CONNECTED";
}

function DepthDialog({
  open,
  workspaceId,
  scanner,
  sharedWith,
  onClose,
  onSaved,
}: {
  open: boolean;
  workspaceId: string;
  scanner: { id: string; name: string; enabled: boolean; maximumDepth: number; revision: number };
  sharedWith: SourceView[];
  onClose: () => void;
  onSaved: (depth: number) => void;
}) {
  const { t } = useTranslation();
  const [depth, setDepth] = useState(String(scanner.maximumDepth));
  // A web source sharing the scanner is not limited by its folder depth, so it is not named as affected.
  const affected = sharedWith.filter(foldersCount);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [saving, setSaving] = useState(false);
  const depthFindings =
    depth.trim() === "0"
      ? [
          {
            tone: "warn" as const,
            text: t("sources.depth.zeroFinding", "0 takes only the files in the source folder itself; every subfolder is skipped."),
          },
        ]
      : [];

  const save = async () => {
    const value = Math.trunc(Number(depth));
    if (!Number.isInteger(value) || value < 0 || value > DEPTH_LIMIT) {
      setProblem({
        kind: "invalid",
        title: t("sources.depth.range", "A depth from 0 to {limit}", { limit: DEPTH_LIMIT }),
        description: t("sources.depth.rangeDescription", "How many folders below the source a scan may go."),
        detail: null,
        status: null,
      });
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      await api.changeScanner(workspaceId, scanner, value);
      onSaved(value);
    } catch (error) {
      setProblem(describeProblem(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("sources.depth.title", "Scan depth · {scanner}", { scanner: scanner.name })}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={saving}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button variant="primary" disabled={saving} onClick={() => void save()}>
            {saving ? t("common.saving", "Saving…") : t("sources.depth.save", "Save depth")}
          </Button>
        </>
      }
    >
      <div className={DIALOG_BODY}>
        {problem !== null && (
          <Notice tone={problem.kind === "invalid" ? "warn" : "error"} title={problem.title}>
            {problem.detail ?? problem.description}
          </Notice>
        )}
        {affected.length > 0 && (
          <Notice tone="information" title={t("sources.depth.shared", "This scanner is shared")}>
            {t("sources.depth.sharedDescription", "The new depth also applies to {sources}.", {
              sources: affected.map((other) => other.name).join(", "),
            })}
          </Notice>
        )}
        <Field
          label={t("sources.depth.label", "Folders deep")}
          labelAside={
            <ExplainParameter
              name={t("sources.depth.label", "Folders deep")}
              identifier="maximumDepth"
              explanation={explainParameter("scanning", "maximumDepth", { title: t("sources.depth.label", "Folders deep") })}
              findings={depthFindings}
            />
          }
          hint={
            <>
              {t(
                "sources.depth.hint",
                "0 takes only the files in the folder itself; folders past the depth are reported, not opened.",
              )}
              <ParameterFindings findings={depthFindings} />
            </>
          }
        >
          <Input
            type="number"
            className="numeric"
            min={0}
            max={DEPTH_LIMIT}
            value={depth}
            onChange={(event) => setDepth(event.target.value)}
          />
        </Field>
      </div>
    </Dialog>
  );
}
