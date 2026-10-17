import { useState } from "react";

/**
 * A per-viewer choice remembered in this browser — a view picked, a panel folded. Never anything that must persist
 * reliably or be shared: storage may be cleared, blocked or absent, and then the choice simply starts from its
 * default.
 *
 * @param allowed the values a stored choice may take; anything else stored there is ignored
 */
export function useStoredChoice<T extends string>(key: string, initial: T, allowed: readonly T[]): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored !== null && (allowed as readonly string[]).includes(stored) ? (stored as T) : initial;
    } catch {
      return initial;
    }
  });
  const choose = (next: T) => {
    setValue(next);
    try {
      window.localStorage.setItem(key, next);
    } catch {
      // A browser that refuses storage keeps the choice for this visit only.
    }
  };
  return [value, choose];
}
