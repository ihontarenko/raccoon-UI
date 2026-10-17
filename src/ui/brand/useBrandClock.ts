import { useEffect, useRef, useState, type RefObject } from "react";

/** Draws one frame at a point of the brand timeline; `animated` is false for the still frame. */
export type BrandFrame = (timeMilliseconds: number, animated: boolean) => void;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Whether brand motion may play: on by default, off while the person asks for reduced motion. */
export function useBrandMotionAllowed(): boolean {
  const [allowed, setAllowed] = useState(() => !prefersReducedMotion());
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => {
      setAllowed(!query.matches);
    };
    query.addEventListener("change", handleChange);
    return () => {
      query.removeEventListener("change", handleChange);
    };
  }, []);
  return allowed;
}

/**
 * The one clock every brand animation runs on. It draws the still frame first, then advances only
 * while playing, while the target is on screen and while the tab is visible — a logo nobody can see
 * costs nothing. `frame` is read through a reference, so a caller may hand a fresh function every
 * render without restarting the clock.
 */
export function useBrandClock(target: RefObject<Element | null>, playing: boolean, frame: BrandFrame | null): void {
  const frameReference = useRef(frame);
  frameReference.current = frame;
  const ready = frame !== null;

  useEffect(() => {
    const element = target.current;
    if (element === null || !ready) {
      return;
    }
    let frameId: number | null = null;
    let elapsedMilliseconds = 0;
    let previousTimestamp: number | null = null;
    let visible = true;

    const draw = (timeMilliseconds: number, animated: boolean) => {
      frameReference.current?.(timeMilliseconds, animated);
    };

    const tick = (timestamp: number) => {
      frameId = null;
      if (!playing || !visible || document.hidden) {
        return;
      }
      elapsedMilliseconds += previousTimestamp === null ? 0 : Math.min(100, timestamp - previousTimestamp);
      previousTimestamp = timestamp;
      draw(elapsedMilliseconds, true);
      frameId = requestAnimationFrame(tick);
    };

    const start = () => {
      if (frameId === null && playing && visible && !document.hidden) {
        previousTimestamp = null;
        frameId = requestAnimationFrame(tick);
      }
    };
    const stop = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) {
        start();
      } else {
        stop();
      }
    });
    observer.observe(element);

    draw(0, false);
    start();

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
      observer.disconnect();
    };
  }, [target, playing, ready]);
}
