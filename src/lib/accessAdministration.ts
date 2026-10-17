// The access administration: the permission catalogue, every rule by slice, and the personal exceptions written by
// form. The server writes the same rows a jMP grant is, so a rule made here and one made by hand are one fact.
import { api } from "./api";

export interface PermissionDeclaration {
  name: string;
  /** The part before the colon: channel, parser, document, … */
  namespace: string;
  description: string | null;
}

export interface RoleDeclaration {
  name: string;
  assignableAt: string;
  permissions: string[];
}

export interface AccessCatalogue {
  permissions: PermissionDeclaration[];
  roles: RoleDeclaration[];
}

export type RuleKind = "ROLE" | "ALLOW" | "DENY";

/** Stored rules are written here; policy-file rules are seeded from jmp/raccoon.jmp and read-only. */
export type RuleOrigin = "STORED" | "POLICY_FILE";

export interface AccessRule {
  kind: RuleKind;
  subjectId: string;
  /** The role, or the permission. */
  name: string;
  /** The workspace it applies in; null for every workspace and the installation. */
  workspaceId: string | null;
  origin: RuleOrigin;
  grantedBy: string | null;
  reason: string | null;
  since: string | null;
  condition: string | null;
}

export interface RuleSlice {
  subjectId?: string;
  workspaceId?: string;
  permission?: string;
}

const BASE = "/v1/access/administration";

function query(values: Record<string, string | undefined>): string {
  const filled = Object.entries(values).filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== "");
  return filled.length === 0 ? "" : `?${new URLSearchParams(filled).toString()}`;
}

export const accessAdministrationApi = {
  catalogue: () => api.send<AccessCatalogue>("GET", `${BASE}/catalogue`),
  rules: (slice: RuleSlice) =>
    api.send<AccessRule[]>("GET", `${BASE}/rules${query({ subjectId: slice.subjectId, workspaceId: slice.workspaceId, permission: slice.permission })}`),
  write: (rule: { subjectId: string; permission: string; workspaceId: string | null; kind: "ALLOW" | "DENY"; reason: string | null }) =>
    api.send<AccessRule>("PUT", `${BASE}/rules`, rule),
  remove: (rule: { subjectId: string; permission: string; workspaceId: string | null }) =>
    api.send<void>("DELETE", `${BASE}/rules${query({ subjectId: rule.subjectId, permission: rule.permission, workspaceId: rule.workspaceId ?? undefined })}`),
  effective: (subjectId: string, workspaceId: string | null) =>
    api.send<string[]>("GET", `${BASE}/effective${query({ subjectId, workspaceId: workspaceId ?? undefined })}`),
};

/**
 * The rule as the jMP line it means — what a person writing the policy by hand would write for the same fact.
 * ⚠️ A parser permission is shown as declared, with underscores: the jMP parser reads a hyphen as a minus.
 */
export function jmpLineOf(rule: { kind: RuleKind; subjectId: string; name: string; workspaceId: string | null }): string {
  const scope = rule.workspaceId === null ? "@GLOBAL" : `@WORKSPACE:${rule.workspaceId}`;
  const body = rule.kind === "ROLE" ? `grants ${rule.name} ${scope}` : `${scope} ${rule.name}${rule.kind === "DENY" ? " deny" : ""}`;
  return `subject '${rule.subjectId}' { ${body} }`;
}
