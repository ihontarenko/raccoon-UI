// A workspace's PIN: where it stands for this browser, set or change it, take it away, open it here, shut it here.
import { api, workspacePath } from "./api";
import type { WorkspaceLockState } from "./contracts";

export const workspaceLockApi = {
  state: (workspaceId: string) => api.send<WorkspaceLockState>("GET", workspacePath(workspaceId, "/lock")),
  lock: (workspaceId: string, pin: string, keepChannelsOut: boolean) =>
    api.send<WorkspaceLockState>("PUT", workspacePath(workspaceId, "/lock"), { pin, keepChannelsOut }),
  remove: (workspaceId: string, pin: string) =>
    api.send<WorkspaceLockState>("POST", workspacePath(workspaceId, "/lock/removal"), { pin }),
  open: (workspaceId: string, pin: string) =>
    api.send<WorkspaceLockState>("POST", workspacePath(workspaceId, "/lock/opening"), { pin }),
  close: (workspaceId: string) => api.send<WorkspaceLockState>("DELETE", workspacePath(workspaceId, "/lock/opening")),
};
