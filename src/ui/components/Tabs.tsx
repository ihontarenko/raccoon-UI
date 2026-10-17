import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { useTranslation } from "../../translations/TranslationProvider";
import { classNames } from "../../lib/classNames";
import { revealActiveItem } from "./revealActiveItem";

const STRIP = "mb-6 flex gap-6 overflow-x-auto overflow-y-hidden border-b border-line";

const TAB = [
  "-mb-px inline-flex items-center gap-2 border-b-2 border-b-transparent bg-transparent px-0 pt-0 pb-3",
  "font-medium whitespace-nowrap text-secondary hover:text-ink",
  "aria-selected:border-b-accent aria-selected:font-semibold aria-selected:text-ink",
  "pointer-coarse:min-h-[44px]",
].join(" ");

const TAB_COUNT = "rounded-[calc(3px*var(--ui-scale))] bg-well px-1 text-2xs text-muted";

/* Unsaved changes: a round accent dot. A value that cannot be saved: a red square, so the two differ
   by shape as well as by colour. */
const MARKER: Record<TabMarker, string> = {
  changed: "size-[7px] flex-none rounded-full bg-accent",
  invalid: "size-[7px] flex-none rounded-none bg-deny",
};

/**
 * How long the strip is held in place after a tab is chosen.
 *
 * The panel behind a tab usually loads: it is replaced by a short waiting state, the document drops
 * to one screen, and the browser clamps the scroll to the top of a page that is briefly that tall.
 * By the time the content arrives the position is gone, so holding has to outlast the fetch rather
 * than only the render.
 */
const HOLD_MILLISECONDS = 2000;

export interface TabItem<Key extends string> {
  key: Key;
  label: ReactNode;
  /** A small count beside the label, such as how many rules a tab holds. */
  count?: number;
  /**
   * A dot after the label for what the tab holds that is not on screen: unsaved changes, or a value that cannot be
   * saved. The dot carries its meaning in words for assistive technology, and its shape differs, never only colour.
   */
  marker?: TabMarker;
}

export type TabMarker = "changed" | "invalid";

interface TabsProperties<Key extends string> {
  label: string;
  items: TabItem<Key>[];
  active: Key;
  onSelect: (key: Key) => void;
}

/**
 * A tab list over panels the caller renders. Arrow keys move between tabs and Home/End jump to the
 * ends, as the tabs pattern expects; only the active tab is in the tab order.
 */
export function Tabs<Key extends string>({ label, items, active, onSelect }: TabsProperties<Key>) {
  const { t } = useTranslation();
  const listReference = useRef<HTMLDivElement>(null);
  // Where the strip sat on screen when the tab was chosen. Null while nothing is being held.
  const heldTop = useRef<number | null>(null);

  // Choosing a tab must not move the page: the reader asked for another view of what they were
  // already looking at, and the tabs are usually well below the fold. Keeping the strip at the same
  // place on screen is what keeps the page still — the scroll position itself cannot be kept,
  // because a panel that is still loading makes the document too short to hold it.
  const choose = (key: Key) => {
    heldTop.current = listReference.current?.getBoundingClientRect().top ?? null;
    onSelect(key);
  };

  useLayoutEffect(() => {
    const strip = listReference.current;
    const top = heldTop.current;
    if (strip === null || top === null) {
      return;
    }
    const hold = () => {
      const drift = strip.getBoundingClientRect().top - top;
      if (Math.abs(drift) > 1) {
        window.scrollBy(0, drift);
      }
    };
    // The panel changes height twice: once when it is replaced by its waiting state and again when
    // the content arrives. Both move the strip, so both are followed.
    const observer = new ResizeObserver(hold);
    observer.observe(document.body);

    let stopHolding = 0;
    const stopWatching = () => {
      observer.disconnect();
      window.clearTimeout(stopHolding);
      window.removeEventListener("wheel", release);
      window.removeEventListener("touchstart", release);
      window.removeEventListener("keydown", release);
    };
    // A reader who starts scrolling has taken the page back; holding it after that would fight them.
    function release() {
      stopWatching();
      heldTop.current = null;
    }
    window.addEventListener("wheel", release, { passive: true });
    window.addEventListener("touchstart", release, { passive: true });
    window.addEventListener("keydown", release);
    stopHolding = window.setTimeout(release, HOLD_MILLISECONDS);
    hold();
    // ⚠️ Only the watching is torn down here, never the held position. React runs this cleanup after
    // the click handler has already recorded where the strip was and before the effect for the new
    // tab runs, so clearing the position here threw away the one thing the next run needs.
    return stopWatching;
  }, [active]);

  // Also on every resize of the strip: a lazily loaded page lays its tabs out after the first effect,
  // and fonts arriving late change every tab's width.
  useEffect(() => {
    const strip = listReference.current;
    if (strip === null) {
      return;
    }
    const reveal = () => revealActiveItem(strip, "[aria-selected=true]");
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [active]);

  const focusTab = (index: number) => {
    const count = items.length;
    const next = items[(index + count) % count];
    choose(next.key);
    const buttons = listReference.current?.querySelectorAll<HTMLButtonElement>("[role=tab]");
    buttons?.[(index + count) % count]?.focus();
  };

  const handleKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusTab(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusTab(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusTab(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusTab(items.length - 1);
    }
  };

  return (
    <div className={STRIP} role="tablist" aria-label={label} ref={listReference}>
      {items.map((item, index) => {
        const selected = item.key === active;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={`tab-${item.key}`}
            aria-selected={selected}
            aria-controls={`panel-${item.key}`}
            tabIndex={selected ? 0 : -1}
            className={TAB}
            onClick={() => {
              choose(item.key);
            }}
            onKeyDown={(event) => {
              handleKey(event, index);
            }}
          >
            {item.label}
            {item.count !== undefined && (
              <span className={classNames(TAB_COUNT, "numeric")}>{item.count}</span>
            )}
            {item.marker !== undefined && (
              <span className={MARKER[item.marker]} data-marker={item.marker}>
                <span className="sr-only">
                  {item.marker === "invalid"
                    ? t("tabs.marker.invalid", "holds a value that cannot be saved")
                    : t("tabs.marker.changed", "holds unsaved changes")}
                </span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** The panel a tab controls; give it the same key. */
export function TabPanel({ tabKey, children }: { tabKey: string; children: ReactNode }) {
  return (
    <div
      role="tabpanel"
      id={`panel-${tabKey}`}
      aria-labelledby={`tab-${tabKey}`}
      className="focus-visible:outline-offset-[6px]"
    >
      {children}
    </div>
  );
}
