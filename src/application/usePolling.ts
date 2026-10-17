import { useEffect, useRef } from "react";

const DEFAULT_INTERVAL_MILLISECONDS = 2000;

/**
 * Reloads every interval while something is still moving — a queued scan, a running job — and stops the
 * moment it is not.
 *
 * ⚠️ THE TIMER DOES NOT WAIT FOR THE DATA TO CHANGE. It used to schedule each tick off `settledOn`, the value
 * the last load produced — which only worked because every reload emptied the screen and so changed it. Reloads
 * are quiet now (they swap rows in place), and a job whose numbers did not move between two reads would have
 * stopped the polling for good. `settledOn` restarts the interval when it changes, nothing more.
 *
 * `reload` is read through a reference: a caller passing a fresh function every render must not restart the
 * timer on every render, or a page that re-renders often would never poll at all.
 */
export function usePolling(active: boolean, reload: () => void, settledOn: unknown, intervalMilliseconds = DEFAULT_INTERVAL_MILLISECONDS): void {
  const reloadReference = useRef(reload);
  reloadReference.current = reload;

  useEffect(() => {
    if (!active) {
      return;
    }
    const timer = window.setInterval(() => {
      // A hidden tab has nobody reading it; the next visible tick catches up.
      if (document.visibilityState === "visible") {
        reloadReference.current();
      }
    }, intervalMilliseconds);
    return () => {
      window.clearInterval(timer);
    };
  }, [active, settledOn, intervalMilliseconds]);
}
