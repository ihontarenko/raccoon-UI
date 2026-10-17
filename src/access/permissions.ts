// Raccoon's permissions by name — the interface's mirror of `security/Permissions.java` and
// `jmp/raccoon.jmp`. Naming them here lets the compiler catch a typo in a `Can` that would otherwise
// hide a control forever without any error.

export const PERMISSIONS = {
  workspaceAdministration: "workspace:admin",
  workspaceCreate: "workspace:create",
  workspaceRead: "workspace:read",
  workspaceWrite: "workspace:write",
  workspaceMembers: "workspace:members",
  automationRead: "automation:read",
  automationManage: "automation:manage",
  sourceRead: "source:read",
  sourceManage: "source:manage",
  documentRead: "document:read",
  documentWrite: "document:write",
  identityManage: "identity:manage",
  systemRead: "system:read",
  systemWrite: "system:write",
  jobRead: "job:read",
  jobWrite: "job:write",
  vaultRead: "vault:read",
  vaultWrite: "vault:write",
  vaultReveal: "vault:reveal",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
