import { useEffect } from "react";

/** Names the browser tab after the current page: "Sources · Raccoon". */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · Raccoon`;
  }, [title]);
}
