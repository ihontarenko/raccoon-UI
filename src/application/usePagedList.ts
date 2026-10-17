import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";
import type { PageRequest } from "../lib/api";
import { describeProblem, type Problem } from "./problems";

// A list the server serves in pages: the first page loads with the screen, further pages are asked
// for explicitly. A change of the caller's dependencies starts from the top again; a reload does not.
//
// ⚠️ A RELOAD IS QUIET. It re-reads as many rows as are on screen and swaps them in place — no loading
// state, no remount, the scroll position and the pages already loaded all kept. It used to empty the list
// first, so every poll of a live screen (jobs, scans) collapsed the page to a placeholder and threw the
// reader back to the top every two seconds. A reload that fails keeps the rows it had. Most list routes return no total, so whether
// more exists is inferred from a full page; a route that does count (the document catalogue) answers
// `{ items, total }` and the total decides instead.

/** Rows per page on browsable lists — small enough to stay quick, large enough to scan. */
export const LIST_PAGE_SIZE = 50;

/** One page as a route answers it: the rows alone, or the rows and how many match in all. */
export type LoadedPage<T> = T[] | { items: T[]; total: number };

function itemsOf<T>(page: LoadedPage<T>): T[] {
  return Array.isArray(page) ? page : page.items;
}

function totalOf<T>(page: LoadedPage<T>): number | null {
  return Array.isArray(page) ? null : page.total;
}

export type PagedList<T> =
  | { status: "loading"; reload: () => void }
  | { status: "failed"; problem: Problem; reload: () => void }
  | {
      status: "ready";
      items: T[];
      /** How many match in all, when the route counts them. */
      total: number | null;
      hasMore: boolean;
      loadingMore: boolean;
      /** A failure while fetching a further page; the rows already shown stay. */
      moreProblem: Problem | null;
      loadMore: () => void;
      reload: () => void;
      replaceItem: (matches: (item: T) => boolean, next: T) => void;
    };

export function usePagedList<T>(
  loadPage: (page: PageRequest) => Promise<LoadedPage<T>>,
  dependencies: DependencyList,
): PagedList<T> {
  const [items, setItems] = useState<T[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [moreProblem, setMoreProblem] = useState<Problem | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadPageReference = useRef(loadPage);
  loadPageReference.current = loadPage;
  const generation = useRef(0);
  const shownReference = useRef(0);
  shownReference.current = items?.length ?? 0;

  useEffect(() => {
    generation.current += 1;
    const current = generation.current;
    setItems(null);
    setProblem(null);
    setMoreProblem(null);
    loadPageReference
      .current({ limit: LIST_PAGE_SIZE, offset: 0 })
      .then((page) => {
        if (generation.current === current) {
          const rows = itemsOf(page);
          const counted = totalOf(page);
          setItems(rows);
          setTotal(counted);
          setHasMore(counted === null ? rows.length === LIST_PAGE_SIZE : rows.length < counted);
        }
      })
      .catch((error: unknown) => {
        if (generation.current === current) {
          setProblem(describeProblem(error));
        }
      });
    // The caller's dependencies decide when the list starts again from the first page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  const reload = useCallback(() => {
    const current = generation.current;
    const shown = shownReference.current;
    if (shown === 0) {
      // Nothing on screen yet — a first load that failed, or an empty list: read it afresh.
      setProblem(null);
    }
    const limit = Math.max(LIST_PAGE_SIZE, shown);
    loadPageReference
      .current({ limit, offset: 0 })
      .then((page) => {
        if (generation.current === current) {
          const rows = itemsOf(page);
          const counted = totalOf(page);
          setItems(rows);
          setTotal(counted);
          setHasMore(counted === null ? rows.length === limit : rows.length < counted);
          setProblem(null);
        }
      })
      .catch((error: unknown) => {
        if (generation.current === current && shownReference.current === 0) {
          setProblem(describeProblem(error));
        }
      });
  }, []);

  const loadMore = useCallback(() => {
    if (items === null || loadingMore) {
      return;
    }
    const current = generation.current;
    setLoadingMore(true);
    setMoreProblem(null);
    loadPageReference
      .current({ limit: LIST_PAGE_SIZE, offset: items.length })
      .then((page) => {
        if (generation.current === current) {
          const rows = itemsOf(page);
          const counted = totalOf(page);
          setItems((previous) => [...(previous ?? []), ...rows]);
          setTotal(counted);
          setHasMore(counted === null ? rows.length === LIST_PAGE_SIZE : items.length + rows.length < counted);
        }
      })
      .catch((error: unknown) => {
        if (generation.current === current) {
          setMoreProblem(describeProblem(error));
        }
      })
      .finally(() => {
        if (generation.current === current) {
          setLoadingMore(false);
        }
      });
  }, [items, loadingMore]);

  const replaceItem = useCallback((matches: (item: T) => boolean, next: T) => {
    setItems((previous) => previous?.map((item) => (matches(item) ? next : item)) ?? previous);
  }, []);

  if (problem !== null) {
    return { status: "failed", problem, reload };
  }
  if (items === null) {
    return { status: "loading", reload };
  }
  return {
    status: "ready",
    items,
    total,
    hasMore,
    loadingMore,
    moreProblem,
    loadMore,
    reload,
    replaceItem,
  };
}
