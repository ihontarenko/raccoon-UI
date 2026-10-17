import { useCallback, useEffect, useState, type DependencyList } from "react";
import { describeProblem, type Problem } from "./problems";

// Server state for one screen: load on mount and whenever the dependencies change, keep the last
// good data visible while reloading, and describe a failure as a Problem the page can render.
//
// ⚠️ A FAILED RELOAD KEEPS THE DATA. Only a screen with nothing to show turns into its problem; one that
// polls must not swap its whole page for an error panel over one dropped request, and back again.

export type Resource<T> =
  | { status: "loading"; reload: () => void }
  | { status: "failed"; problem: Problem; reload: () => void }
  | {
      status: "ready";
      data: T;
      reloading: boolean;
      reload: () => void;
      replace: (data: T) => void;
    };

export function useResource<T>(load: () => Promise<T>, dependencies: DependencyList): Resource<T> {
  const [data, setData] = useState<{ value: T } | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [pending, setPending] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setPending(true);
    load()
      .then((value) => {
        if (!cancelled) {
          setData({ value });
          setProblem(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setProblem(describeProblem(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPending(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // The loader is recreated every render; the caller's dependencies decide when to reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, attempt]);

  const reload = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  const replace = useCallback((value: T) => {
    setData({ value });
  }, []);

  if (problem !== null && !pending && data === null) {
    return { status: "failed", problem, reload };
  }
  if (data === null) {
    return { status: "loading", reload };
  }
  return { status: "ready", data: data.value, reloading: pending, reload, replace };
}
