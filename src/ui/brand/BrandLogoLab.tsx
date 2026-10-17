import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../primitives";
import { type BrandFace, loadBrandFaces } from "./brandFaces";
import { type BrandTheme, type FaceRenderer, buildBurstSequence, createFaceRenderer } from "./brandMotion";
import { useBrandClock, useBrandMotionAllowed, type BrandFrame } from "./useBrandClock";

const GALLERY = "grid grid-cols-[repeat(auto-fill,minmax(calc(132px*var(--ui-scale)),1fr))] gap-4";

const SPECIMEN = "m-0 grid justify-items-center gap-3 rounded-surface border border-line bg-surface p-4";

const NOTE = "m-0 max-w-[60ch] text-xs text-muted";

interface BrandLogoLabProperties {
  /** The active theme; the engine re-tints the pixel faces whenever it changes. */
  theme: BrandTheme;
}

function captionFor(face: BrandFace): string {
  if (face.type === "segmented") {
    return "Segmented · colour cycle";
  }
  return `Pixel · ${face.grid}×${face.grid}`;
}

export function BrandLogoLab({ theme }: BrandLogoLabProperties) {
  const [faces, setFaces] = useState<BrandFace[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const motionAllowed = useBrandMotionAllowed();
  const [paused, setPaused] = useState(false);
  const playing = motionAllowed && !paused;
  const galleryReference = useRef<HTMLDivElement>(null);
  const canvasReferences = useRef(new Map<string, HTMLCanvasElement>());
  const sequence = useMemo(() => buildBurstSequence(), []);
  const [renderers, setRenderers] = useState<FaceRenderer[] | null>(null);

  useEffect(() => {
    let current = true;
    loadBrandFaces()
      .then((loaded) => {
        if (current) {
          setFaces(loaded);
        }
      })
      .catch((error: unknown) => {
        if (current) {
          setLoadError(true);
          console.error("Failed to load brand faces", error);
        }
      });
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => {
    if (faces === null) {
      return;
    }
    const built = faces
      .map((face) => {
        const context = canvasReferences.current.get(face.id)?.getContext("2d") ?? null;
        return context === null ? null : createFaceRenderer(face, context, theme, sequence);
      })
      .filter((renderer): renderer is FaceRenderer => renderer !== null);
    // A paused gallery still shows the new theme at once, not on the next play.
    built.forEach((renderer) => {
      renderer.draw(0, false);
    });
    setRenderers(built);
  }, [faces, theme, sequence]);

  const frame: BrandFrame | null =
    renderers === null
      ? null
      : (timeMilliseconds, animated) => {
          renderers.forEach((renderer) => {
            renderer.draw(timeMilliseconds, animated);
          });
        };
  useBrandClock(galleryReference, playing, frame);

  if (loadError) {
    return <p className={NOTE}>The brand specimens could not be loaded.</p>;
  }

  return (
    <div className="grid gap-6">
      <div className={GALLERY} ref={galleryReference}>
        {faces === null
          ? null
          : faces.map((face) => (
              <figure key={face.id} className={SPECIMEN}>
                <canvas
                  className="size-[calc(112px*var(--ui-scale))] [image-rendering:pixelated]"
                  width={256}
                  height={256}
                  ref={(element) => {
                    if (element === null) {
                      canvasReferences.current.delete(face.id);
                    } else {
                      canvasReferences.current.set(face.id, element);
                    }
                  }}
                  role="img"
                  aria-label={`Raccoon logo — ${face.name}`}
                />
                <figcaption className="grid justify-items-center gap-[calc(2px*var(--ui-scale))] text-center">
                  <span className="text-sm font-semibold">{face.name}</span>
                  <span className="text-2xs text-muted">{captionFor(face)}</span>
                </figcaption>
              </figure>
            ))}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button
          variant="quiet"
          icon={playing ? "jobs" : "play"}
          aria-pressed={paused}
          disabled={!motionAllowed}
          onClick={() => {
            setPaused((current) => !current);
          }}
        >
          {playing ? "Pause animation" : "Play animation"}
        </Button>
        <p className={NOTE}>
          The product signs with the face chosen under Appearance (Mask by default) and the lowercase wordmark, which glitch together on
          the same timeline. Every animation pauses off screen and stays still under reduced motion.
        </p>
      </div>
    </div>
  );
}
