import { useEffect, useState } from "react";

/**
 * Whether the window matches a media query — the workbench's room for an inspector, a phone's width —
 * and follows resizing.
 *
 * For a layout decision that has to be taken in JavaScript because it changes what is rendered rather
 * than how it is painted: a control that becomes icon-only, a row that opens a page instead of an
 * inspector. A difference that CSS can express belongs in CSS, not here.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const follow = () => setMatches(media.matches);
    follow();
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, [query]);
  return matches;
}
