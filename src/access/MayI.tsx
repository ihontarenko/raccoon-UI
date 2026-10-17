import { useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import type { AccessQuestion } from "../lib/contracts";
import type { Permission } from "./permissions";

// "May I do this in that workspace?" — asked of the server, because the shell's answer only covers
// the active workspace. Every question raised in one render is sent as one request, and answers are
// kept until the session or workspace changes.

interface MayIProperties {
  permission: Permission;
  /** Omitted asks about the installation. */
  workspaceId?: string | null;
  /** A render function receives the answer, for a control that should be disabled rather than absent. */
  children: ReactNode | ((allowed: boolean) => ReactNode);
  fallback?: ReactNode;
}

export function MayI({
  permission,
  workspaceId = null,
  children,
  fallback = null,
}: MayIProperties) {
  const allowed = useMayI({ permission, workspaceId });
  if (typeof children === "function") {
    // `false` while in flight, so a render function draws a disabled control, never one that will refuse.
    return <>{children(allowed === true)}</>;
  }
  if (allowed === null) {
    return null;
  }
  return <>{allowed ? children : fallback}</>;
}

/** @returns `null` until the server has answered, then true or false. */
export function useMayI(question: {
  permission: Permission;
  workspaceId?: string | null;
}): boolean | null {
  const key = keyOf(question);
  const [allowed, setAllowed] = useState<boolean | null>(() => answered.get(key) ?? null);

  useEffect(() => {
    const known = answered.get(key);
    if (known !== undefined) {
      setAllowed(known);
      return;
    }
    let live = true;
    void ask({ permission: question.permission, workspaceId: question.workspaceId ?? null }).then(
      (answer) => {
        if (live) {
          setAllowed(answer);
        }
      },
    );
    return () => {
      live = false;
    };
    // The key already captures the whole question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return allowed;
}

const answered = new Map<string, boolean>();

let pending: Map<string, { question: AccessQuestion; settle: (allowed: boolean) => void }> | null =
  null;

function keyOf(question: AccessQuestion): string {
  return `${question.permission}@${question.workspaceId ?? ""}`;
}

function ask(question: AccessQuestion): Promise<boolean> {
  const key = keyOf(question);
  return new Promise<boolean>((resolve) => {
    if (pending === null) {
      pending = new Map();
      // A microtask, not a timer: everything rendered in this pass has asked by the time it runs.
      queueMicrotask(() => {
        void flush();
      });
    }
    const waiting = pending.get(key);
    if (waiting !== undefined) {
      const previousSettle = waiting.settle;
      waiting.settle = (allowed) => {
        previousSettle(allowed);
        resolve(allowed);
      };
      return;
    }
    pending.set(key, { question, settle: resolve });
  });
}

async function flush(): Promise<void> {
  const batch = pending;
  pending = null;
  if (batch === null || batch.size === 0) {
    return;
  }
  try {
    const answers = await api.may([...batch.values()].map((entry) => entry.question));
    // Matched by the question the server echoes back, never by position.
    for (const answer of answers) {
      answered.set(keyOf(answer), answer.allowed);
    }
    for (const [key, entry] of batch) {
      entry.settle(answered.get(key) ?? false);
    }
  } catch {
    // A failed request reads as "no" and is NOT remembered, so the next mount asks again.
    for (const entry of batch.values()) {
      entry.settle(false);
    }
  }
}

/** Called when the session or the active workspace changes. */
export function forgetScopedAnswers(): void {
  answered.clear();
}
