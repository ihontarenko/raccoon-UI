import type { ReactNode } from "react";
import type { Permission } from "./permissions";
import { usePermissions } from "./PermissionsProvider";

// Two components because there are two questions:
//   <Can>  — "may I do this at all, here in this workspace?"  free, read from the shell's answer
//   <MayI> — "may I do this in THAT workspace?"               asks the server, batched
// Hidden, not disabled, is the default: a control that exists, responds and refuses teaches the
// person the product is broken. `fallback` is for the rare absence that needs a sentence.

interface CanProperties {
  /** One permission, or several of which any one is enough. */
  permission: Permission | readonly Permission[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function Can({ permission, children, fallback = null }: CanProperties) {
  const permissions = usePermissions();
  // Nothing while the answer is in flight — never the fallback, which would flash a refusal.
  if (permissions.loading) {
    return null;
  }
  const allowed =
    typeof permission === "string" ? permissions.may(permission) : permissions.mayAny(permission);
  return <>{allowed ? children : fallback}</>;
}
