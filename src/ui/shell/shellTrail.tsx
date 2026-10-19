import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The way further in, past the page the topbar names: a page that has places of its own — the Library's sources,
 * folders and the document open in it — hands them to the topbar, so the frame draws ONE breadcrumb instead of the
 * page drawing a second one under it.
 *
 * ⚠️ THE PAGE OWNS IT FOR AS LONG AS IT IS SHOWN and takes it back when it goes, so a trail never outlives the page
 * that drew it.
 */

export interface TrailStep {
  label: string;
  /** Goes to this step; absent on the last one, which is where the reader already is. */
  onSelect?: () => void;
}

export interface PageTrail {
  /** Goes to the page's own top — the topbar's page name becomes the first step's way back. */
  onRoot: () => void;
  steps: TrailStep[];
  /** Quiet words at the line's end — how many items the place holds. */
  note?: string;
}

interface TrailContextValue {
  trail: PageTrail | null;
  setTrail: (trail: PageTrail | null) => void;
}

const TrailContext = createContext<TrailContextValue>({ trail: null, setTrail: () => undefined });

export function ShellTrailProvider({ children }: { children: ReactNode }) {
  const [trail, setTrail] = useState<PageTrail | null>(null);
  return <TrailContext.Provider value={{ trail, setTrail }}>{children}</TrailContext.Provider>;
}

/** The trail the page in front has handed over, for the topbar. */
export function useShellTrail(): PageTrail | null {
  return useContext(TrailContext).trail;
}

/**
 * Hands this page's trail to the topbar while the page is shown.
 *
 * ⚠️ KEYED ON THE WORDS, not on the object: a page builds a fresh trail every render, and handing each one over would
 * render the topbar, which renders nothing here, but would still be a state change per render for nothing. The steps'
 * callbacks are read through a reference, so the newest ones run.
 */
export function usePageTrail(trail: PageTrail | null): void {
  const { setTrail } = useContext(TrailContext);
  const latest = useRef(trail);
  latest.current = trail;
  const key = trail === null ? "" : [...trail.steps.map((step) => step.label), trail.note ?? ""].join("\u0000");

  useEffect(() => {
    const current = latest.current;
    if (current === null) {
      setTrail(null);
      return;
    }
    setTrail({
      onRoot: () => latest.current?.onRoot(),
      steps: current.steps.map((step, index) => ({
        label: step.label,
        onSelect: step.onSelect === undefined ? undefined : () => latest.current?.steps[index]?.onSelect?.(),
      })),
      note: current.note,
    });
  }, [key, trail === null, setTrail]); // eslint-disable-line react-hooks/exhaustive-deps -- the words are the trail's identity

  useEffect(() => () => setTrail(null), [setTrail]);
}
