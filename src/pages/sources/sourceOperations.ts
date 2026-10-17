import { api, collectAllPages } from "../../lib/api";
import type { SourceView } from "../../lib/contracts";
import { ruleSetsApi, type ListedRuleSet, type RuleSetPreset } from "../../lib/ruleSets";
import { ruleNamesOf } from "../rules/presetCatalogue";
import type { ScannerBindingView, ScannerView } from "../../lib/sourceContracts";

// The steps the backend models separately — scanner, binding, rule set, rule set binding — composed
// into the few actions a person thinks in: "scan this source", "give it these rules".

const DEFAULT_SCANNER_NAME = "Folder scan";
export const DEFAULT_SCAN_DEPTH = 8;

/** The scanner a source is scanned with, binding the workspace's scanner to it the first time. */
export async function ensureScannerBinding(
  workspaceId: string,
  sourceId: string,
): Promise<ScannerBindingView> {
  const [existing] = await api.scannerBindingsOfSource(workspaceId, sourceId);
  if (existing !== undefined) {
    return existing;
  }
  // A web source keeps its own crawl mode and link depth in its options, so it shares the workspace's
  // scanner like every other scanned source; the scanner's folder depth does not limit its pages.
  const scanner = await ensureScanner(workspaceId);
  return api.bindScanner(workspaceId, scanner.id, sourceId);
}

async function ensureScanner(workspaceId: string): Promise<ScannerView> {
  const scanners = await collectAllPages((page) => api.listScanners(workspaceId, page));
  const usable = scanners.find((scanner) => scanner.enabled);
  return usable ?? api.createScanner(workspaceId, DEFAULT_SCANNER_NAME, DEFAULT_SCAN_DEPTH);
}

export async function startScan(workspaceId: string, sourceId: string): Promise<string> {
  const binding = await ensureScannerBinding(workspaceId, sourceId);
  const job = await api.startScan(workspaceId, binding.id, `scan-${sourceId}-${Date.now()}`);
  return job.id;
}

/** The scanner bound to a source, or null when it has never been scanned. */
export async function scannerOfSource(
  workspaceId: string,
  sourceId: string,
): Promise<ScannerView | null> {
  const [binding] = await api.scannerBindingsOfSource(workspaceId, sourceId);
  if (binding === undefined) {
    return null;
  }
  const scanners = await collectAllPages((page) => api.listScanners(workspaceId, page));
  return scanners.find((scanner) => scanner.id === binding.scannerId) ?? null;
}

/** The rule sets a source binds, in the order their rules run; none means every material is taken. */
export async function ruleSetsOfSource(
  workspaceId: string,
  sourceId: string,
): Promise<ListedRuleSet[]> {
  const [binding, ruleSets] = await Promise.all([
    ruleSetsApi.sourceBinding(workspaceId, sourceId),
    ruleSetsApi.list(workspaceId),
  ]);
  return binding.ruleSetIds.flatMap((identifier) =>
    ruleSets.filter((ruleSet) => ruleSet.id === identifier),
  );
}

/** Gives a new source its first rules: a rule set of its own, made from a ready one of the catalogue, bound to it. */
export async function bindNewRuleSet(
  workspaceId: string,
  source: SourceView,
  name: string,
  preset: RuleSetPreset,
): Promise<void> {
  const created = await ruleSetsApi.createFromPreset(workspaceId, preset.key, { name, ruleNames: ruleNamesOf(preset) });
  const binding = await ruleSetsApi.sourceBinding(workspaceId, source.id);
  await ruleSetsApi.bindSource(workspaceId, {
    ...binding,
    ruleSetIds: [...binding.ruleSetIds, created.id],
  });
}
