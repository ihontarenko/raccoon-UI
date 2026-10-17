// Automation: jMS scripts that react to the pipeline's events, the groups that bind their published
// versions to stages, and the journals of what all of it
// decided. Shapes mirror the backend; see `.scratch/ui-contracts-admin.md` §7.

import { api, pageQuery, workspacePath, type PageRequest } from "./api";
import type { BoundRuleSets } from "./ruleSets";
import type { ScriptView } from "./sourceContracts";

export type StageTiming = "DECISION" | "OBSERVATION";

export interface StageView {
  name: string;
  timing: StageTiming;
  description: string;
  variables: string[];
}

export interface ScriptLogLine {
  at: string;
  level: "INFO" | "WARN";
  rule: string;
  stage: string;
  message: string;
}

export type FailurePolicy = "STOP" | "IGNORE";

export interface ScriptBinding {
  scriptVersionId: string;
  stage: string;
  order: number;
  enabled: boolean;
  failurePolicy: FailurePolicy;
}

export interface ScriptGroup {
  id: string;
  name: string;
  revision: number;
  configuration: { bindings: ScriptBinding[] };
}

export interface ShippedScript {
  name: string;
  stage: string;
  description: string;
}

export type Outcome = "INCLUDE" | "SKIP" | "REVIEW" | "ERROR";

export interface Candidate {
  workspaceId: string;
  sourceId: string;
  sourceKind: string;
  externalId: string;
  title: string;
  mediaType: string;
  sizeBytes: number;
}

export interface Trace {
  type: "RULE_RESULT" | "RULE" | "SCRIPT" | "PIPELINE";
  reference: string | null;
  outcome: string;
  reason: string | null;
}

export interface FrozenPlan {
  sourceRevision: number;
  sourceBindingRevision: number;
  /** The rule sets the source bound when the material was judged, each at the revision then. */
  ruleSets: BoundRuleSets;
  ruleScripts: Record<string, string>;
  groups: ScriptGroup[];
  settings: Record<string, number>;
}

export interface MaterialEvaluation {
  id: string;
  sourceId: string;
  outcome: Outcome;
  candidate: Candidate;
  snapshot: FrozenPlan;
  trace: Trace[];
}

export interface DryRunResult {
  evaluationId: string | null;
  outcome: Outcome;
  snapshot: FrozenPlan;
  trace: Trace[];
}

export interface DryRunMaterial {
  externalId: string;
  title: string;
  mediaType: string;
  sizeBytes: number;
  textCharacters: number;
  /** What a condition over the file's text reads; left out, the trial file has no text, as a PDF has none. */
  text?: string;
}

export interface ScriptExecution {
  scriptVersionId: string;
  groupId: string | null;
  groupRevision: number | null;
  ruleSetId: string | null;
  ruleSetRevision: number | null;
  stage: string;
  outcome: "EXECUTED" | "GUARD_NOT_MATCHED" | "REFUSED" | "ERROR" | "PASSED";
  reason: string | null;
}

/** What a script did when it was run once against facts a person wrote; nothing of it was applied. */
export type ScriptDryRunOutcome = "NOT_MATCHED" | "ALLOWED" | "REFUSED" | "TUNES" | "FAILED";

export interface ScriptDryRunResult {
  outcome: ScriptDryRunOutcome;
  /** The refusal's reason, the tuning it reached, or the failure. */
  message: string | null;
  /** Whether its stage may stop what it runs on. */
  decision: boolean;
  log: ScriptLogLine[];
}

/** Which scripts a listing holds: every one, the event scripts groups bind, or the rule scripts sources name. */
export type ListedScriptKind = "ALL" | "EVENT" | "RULE";

export const automationApi = {
  /* scripts */
  scripts: (workspaceId: string, page: PageRequest, kind: ListedScriptKind = "ALL") =>
    api.send<ScriptView[]>(
      "GET",
      workspacePath(workspaceId, `/scripts?kind=${kind}&${pageQuery(page)}`),
    ),
  script: (workspaceId: string, scriptId: string) =>
    api.send<ScriptView>("GET", workspacePath(workspaceId, `/scripts/${scriptId}`)),
  createScript: (workspaceId: string, title: string, stage: string, source: string) =>
    api.send<ScriptView>("POST", workspacePath(workspaceId, "/scripts"), { title, stage, source }),
  rewriteScript: (workspaceId: string, script: ScriptView, title: string, source: string) =>
    api.send<ScriptView>("PUT", workspacePath(workspaceId, `/scripts/${script.id}`), {
      title,
      source,
      revision: script.revision,
    }),
  /** Runs the script once — the draft source when given — and applies nothing. */
  dryRunScript: (
    workspaceId: string,
    scriptId: string,
    request: { source: string; facts: Record<string, string>; materialText: string | null },
  ) => api.send<ScriptDryRunResult>("POST", workspacePath(workspaceId, `/scripts/${scriptId}/dry-run`), request),
  activateScript: (workspaceId: string, script: ScriptView) =>
    api.send<ScriptView>("POST", workspacePath(workspaceId, `/scripts/${script.id}/activate`), {
      revision: script.revision,
    }),
  stages: (workspaceId: string) =>
    api.send<StageView[]>("GET", workspacePath(workspaceId, "/scripts/stages")),
  template: (workspaceId: string) =>
    api.send<{ stage: string; source: string }>(
      "GET",
      workspacePath(workspaceId, "/scripts/template"),
    ),
  log: (workspaceId: string) =>
    api.send<ScriptLogLine[]>("GET", workspacePath(workspaceId, "/scripts/log")),
  shipped: (workspaceId: string) =>
    api.send<ShippedScript[]>("GET", workspacePath(workspaceId, "/automation/shipped-scripts")),
  shippedSource: (workspaceId: string, name: string) =>
    api.send<{ name: string; source: string }>(
      "GET",
      workspacePath(workspaceId, `/automation/shipped-scripts/${encodeURIComponent(name)}`),
    ),

  /* groups */
  groups: (workspaceId: string, page: PageRequest) =>
    api.send<ScriptGroup[]>("GET", workspacePath(workspaceId, `/script-groups?${pageQuery(page)}`)),
  createGroup: (workspaceId: string, name: string, bindings: ScriptBinding[]) =>
    api.send<ScriptGroup>("POST", workspacePath(workspaceId, "/script-groups"), {
      name,
      revision: 0,
      configuration: { bindings },
    }),
  saveGroup: (workspaceId: string, group: ScriptGroup, name: string, bindings: ScriptBinding[]) =>
    api.send<ScriptGroup>("PUT", workspacePath(workspaceId, `/script-groups/${group.id}`), {
      name,
      revision: group.revision,
      configuration: { bindings },
    }),

  /* journals */
  evaluations: (workspaceId: string, page: PageRequest) =>
    api.send<MaterialEvaluation[]>(
      "GET",
      workspacePath(workspaceId, `/processing/evaluations?${pageQuery(page)}`),
    ),
  evaluationScripts: (workspaceId: string, evaluationId: string) =>
    api.send<ScriptExecution[]>(
      "GET",
      workspacePath(workspaceId, `/processing/evaluations/${evaluationId}/scripts`),
    ),
  dryRun: (workspaceId: string, sourceId: string, material: DryRunMaterial) =>
    api.send<DryRunResult>(
      "POST",
      workspacePath(workspaceId, `/sources/${sourceId}/processing/dry-run`),
      material,
    ),
};
