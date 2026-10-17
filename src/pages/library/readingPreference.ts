import { useSyncExternalStore } from "react";
import { useMediaQuery } from "../../application/useMediaQuery";

const KEY = "raccoon.library.reading";
const listeners = new Set<() => void>();

function storedChoice(): "on" | "off" | null {
  try {
    const stored = window.localStorage.getItem(KEY);
    return stored === "on" || stored === "off" ? stored : null;
  } catch {
    return null;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Whether documents in the Library open in reading mode — a choice the viewer turns on and off and this browser
 * remembers. Until it has been chosen once, a phone reads and a wider screen does not. Leaving one document's
 * reading does not change the choice; only the switch does. Shared by every screen that opens a document, so the
 * switch in the reading bar and the Library behind it never disagree.
 */
export function useReadingPreference(): [boolean, (next: boolean) => void] {
  const narrow = useMediaQuery("(max-width: 800px)");
  const choice = useSyncExternalStore(subscribe, storedChoice);
  const choose = (next: boolean) => {
    try {
      window.localStorage.setItem(KEY, next ? "on" : "off");
    } catch {
      // A browser that refuses storage cannot remember the choice; the default stands.
    }
    listeners.forEach((listener) => listener());
  };
  return [choice === null ? narrow : choice === "on", choose];
}
