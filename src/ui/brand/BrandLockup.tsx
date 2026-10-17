import { useEffect, useMemo, useRef, useState } from "react";
import { useAppearance } from "../../appearance/AppearanceProvider";
import { loadBrandFaces, stillMarkAddress, type BrandFace } from "./brandFaces";
import { buildBurstSequence, createFaceRenderer, wordmarkGlitchAt, type FaceRenderer } from "./brandMotion";
import { useBrandClock, useBrandMotionAllowed, type BrandFrame } from "./useBrandClock";

/* The two sizes are the same lockup at two scales, so both the gap and the two sizes it drives are
   set here rather than by a second component. */
const LOCKUP = [
  "group inline-flex items-center gap-[calc(10px*var(--ui-scale))]",
  "[--mark-size:calc(34px*var(--ui-scale))] [--word-size:var(--text-xl)]",
  "data-[size=display]:gap-[calc(16px*var(--ui-scale))]",
  "data-[size=display]:[--mark-size:calc(64px*var(--ui-scale))]",
  "data-[size=display]:[--word-size:calc(40px*var(--ui-scale))]",
].join(" ");

/* The face is drawn into a 256px square and shown smaller, so its cells stay crisp at any scale. It
   covers 160 of those 256px, and scaling by 256/160 makes it fill the slot exactly as the still does. */
const LAYER = "absolute inset-0 h-full w-full [image-rendering:pixelated]";
const CANVAS = `${LAYER} scale-[1.6] data-[ready=false]:invisible`;

/*
 * A burst: one band of the word slides sideways over a patch of the background, split in colour. The
 * band, the shift and the chroma arrive as custom properties written by the clock, so the animation
 * never re-renders React — see `paintWordmark`.
 *
 * ⚠️ The patch is painted in the ground the lockup SITS on — the rail side panel, or the page itself
 * on the sign-in sign — which is why it reads the lockup own size rather than carrying one value.
 */
const WORDMARK_CLASS = [
  "relative font-mono [font-size:var(--word-size)] leading-none font-bold tracking-[-0.04em] text-ink",
  "before:absolute before:inset-0 before:hidden before:bg-side before:text-ink",
  "before:content-[attr(data-text)]",
  "before:[clip-path:inset(var(--glitch-top)_0_var(--glitch-bottom)_0)]",
  "before:[transform:translateX(var(--glitch-shift))]",
  "before:[text-shadow:calc(var(--glitch-chroma)*-1)_0_#77d9cc,var(--glitch-chroma)_0_#bca2ef]",
  "group-data-[size=display]:before:bg-bg",
  "data-[glitch=true]:before:block",
  "motion-reduce:before:hidden!",
].join(" ");

const WORDMARK = "raccoon";
const CANVAS_SIZE = 256;

interface BrandLockupProperties {
  /** `rail` sits in the navigation; `display` is the large sign on the sign-in page. */
  size?: "rail" | "display";
}

/**
 * The product's signature: the face chosen under Appearance — the grey Mask unless changed — beside the lowercase wordmark. Both run on one
 * clock, so a burst that slides rows of the mask slides a band of the word in the same frames.
 * Until the face has loaded, its still image holds its place, so nothing shifts when it starts.
 */
export function BrandLockup({ size = "rail" }: BrandLockupProperties) {
  const { appearance } = useAppearance();
  const motionAllowed = useBrandMotionAllowed();
  const [face, setFace] = useState<BrandFace | null>(null);
  const lockupReference = useRef<HTMLSpanElement>(null);
  const canvasReference = useRef<HTMLCanvasElement>(null);
  const wordmarkReference = useRef<HTMLSpanElement>(null);
  const sequence = useMemo(() => buildBurstSequence(), []);
  const [renderer, setRenderer] = useState<FaceRenderer | null>(null);

  useEffect(() => {
    let current = true;
    loadBrandFaces()
      .then((faces) => {
        if (current) {
          setFace(faces.find((candidate) => candidate.id === appearance.mark) ?? null);
        }
      })
      .catch(() => {
        // The still image stays; a logo that cannot animate is not an error worth showing.
      });
    return () => {
      current = false;
    };
  }, [appearance.mark]);

  useEffect(() => {
    const context = canvasReference.current?.getContext("2d") ?? null;
    if (face === null || context === null) {
      setRenderer(null);
      return;
    }
    setRenderer(createFaceRenderer(face, context, appearance.theme, sequence));
  }, [face, appearance.theme, sequence]);

  const frame: BrandFrame | null =
    renderer === null
      ? null
      : (timeMilliseconds, animated) => {
          renderer.draw(timeMilliseconds, animated);
          paintWordmark(wordmarkReference.current, animated ? wordmarkGlitchAt(sequence, timeMilliseconds) : null);
        };
  useBrandClock(lockupReference, motionAllowed, frame);

  return (
    <span ref={lockupReference} className={LOCKUP} data-size={size}>
      <span className="relative size-(--mark-size) flex-none" aria-hidden="true">
        {renderer === null && <img src={stillMarkAddress(appearance.mark)} alt="" className={LAYER} />}
        <canvas
          ref={canvasReference}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className={CANVAS}
          data-ready={renderer !== null}
        />
      </span>
      <span ref={wordmarkReference} className={WORDMARK_CLASS} data-text={WORDMARK}>
        {WORDMARK}
      </span>
    </span>
  );
}

/** Writes one frame of the glitch as custom properties, so the clock never re-renders React. */
function paintWordmark(element: HTMLSpanElement | null, glitch: ReturnType<typeof wordmarkGlitchAt>): void {
  if (element === null) {
    return;
  }
  if (glitch === null) {
    if (element.dataset.glitch === "true") {
      element.dataset.glitch = "false";
    }
    return;
  }
  element.dataset.glitch = "true";
  element.style.setProperty("--glitch-shift", `${glitch.shift}em`);
  element.style.setProperty("--glitch-top", `${glitch.bandTop * 100}%`);
  element.style.setProperty("--glitch-bottom", `${(1 - glitch.bandBottom) * 100}%`);
  element.style.setProperty("--glitch-chroma", `${glitch.chroma}em`);
}
