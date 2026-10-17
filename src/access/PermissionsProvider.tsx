import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { forgetScopedAnswers } from "./MayI";
import type { Permission } from "./permissions";

// What the signed-in caller holds installation-wide and in the active workspace, asked once per
// workspace. `Can` reads it for free; it decides what to DRAW. The routes on the server enforce
// independently and are the only thing between anybody and the data.

interface PermissionsValue {
  loading: boolean;
  may: (permission: Permission) => boolean;
  mayAny: (permissions: readonly Permission[]) => boolean;
}

const PermissionsContext = createContext<PermissionsValue | null>(null);

export function PermissionsProvider({
  workspaceId,
  children,
}: {
  workspaceId: string | null;
  children: ReactNode;
}) {
  const [held, setHeld] = useState<ReadonlySet<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHeld(null);
    forgetScopedAnswers();
    api
      .myPermissions(workspaceId)
      .then((permissions) => {
        if (!cancelled) {
          setHeld(new Set(permissions));
        }
      })
      .catch(() => {
        // An unanswered question reads as "nothing held": every control stays hidden rather than
        // drawn and then refused. The pages themselves report the server being unreachable.
        if (!cancelled) {
          setHeld(new Set());
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const value = useMemo<PermissionsValue>(
    () => ({
      loading: held === null,
      may: (permission) => held?.has(permission) ?? false,
      mayAny: (permissions) => permissions.some((permission) => held?.has(permission) ?? false),
    }),
    [held],
  );

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions(): PermissionsValue {
  const value = useContext(PermissionsContext);
  if (value === null) {
    throw new Error("usePermissions must be used inside PermissionsProvider.");
  }
  return value;
}
