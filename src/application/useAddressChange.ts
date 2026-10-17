import { useMemo } from "react";
import { useNavigate, type UseNavigateResult } from "@tanstack/react-router";

/**
 * Navigation for a control whose choice lives in the address — a tab, a view switch, a filter — as
 * opposed to going somewhere else.
 *
 * Two things separate it from an ordinary navigation, and both are the whole reason it exists:
 *
 *  - it replaces the history entry, so Back leaves the page rather than walking every tab the reader
 *    pressed on the way in;
 *  - it leaves the scroll where it was. The router takes a navigation to the top of the page, which
 *    is right for a new page and wrong for a tab: a page's tabs are usually below the fold, so
 *    pressing one threw the reader back to the page header, away from what they had just reached.
 *
 * A page that switches tabs with a plain `useNavigate` gets the second defect back, which is why the
 * policy lives here rather than in ten call sites.
 *
 * It takes exactly what `useNavigate` takes, so a call site keeps the router's own checking of `to`,
 * `params` and `search` against the route tree. Holding on to that inference is what the one cast
 * below buys: the options are rebuilt here, where the concrete route is no longer known, and only the
 * two fields this hook decides are added to them.
 */
export function useAddressChange(): UseNavigateResult<string> {
  const navigate = useNavigate();
  return useMemo(() => {
    const changeAddress: UseNavigateResult<string> = (options) =>
      navigate({ replace: true, resetScroll: false, ...options } as Parameters<typeof navigate>[0]);
    return changeAddress;
  }, [navigate]);
}
