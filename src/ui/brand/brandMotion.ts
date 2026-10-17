// Brand motion engine, ported from the approved Design prototype into a typed, framework-free module.
//
// Pixel faces animate as a sequence of horizontal row "bursts" — bands of rows slide sideways for a
// few frames, optionally with a cyan/magenta chromatic split, then settle. Segmented faces animate
// as a smooth palette cycle over eight seconds. A single shared burst sequence drives every pixel
// face so the specimens burst in unison; the React layer owns the clock, visibility and play state.

import type { BrandFace, PixelBrandFace, SegmentedBrandFace } from "./brandFaces";

export type BrandTheme = "light" | "dark";

const CANVAS_SIZE = 256;
const DEFAULT_EXTENT = 160;
const POLYGON_ORIGIN = 48;
const PALETTE_CYCLE_MILLISECONDS = 8000;
const BURST_FRAME_MILLISECONDS = 42;
const INDEX_FACE_COLOUR: Record<BrandTheme, string> = {
  light: "#647e38",
  dark: "#e4e985",
};
const CHROMA_CYAN = "#77d9cc";
const CHROMA_MAGENTA = "#bca2ef";

const BURST_PROFILES = {
  mild: { bands: 2, shift: 8, height: 2, duration: 220, chroma: 0 },
  medium: { bands: 4, shift: 18, height: 3, duration: 430, chroma: 3 },
  strong: { bands: 6, shift: 34, height: 5, duration: 680, chroma: 6 },
} as const;

type BurstKind = keyof typeof BURST_PROFILES;

interface BurstBand {
  start: number;
  height: number;
  shift: number;
}

interface NormalPhase {
  kind: "normal";
  duration: number;
}

interface BurstPhase {
  kind: BurstKind;
  duration: number;
  seed: number;
  chroma: number;
  bands: BurstBand[];
}

type SequencePhase = NormalPhase | BurstPhase;

export interface BurstSequence {
  phases: SequencePhase[];
  totalDuration: number;
}

interface ActivePhase {
  phase: SequencePhase;
  localTime: number;
}

/** A linear congruential generator seeded per burst so bursts are deterministic yet varied. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function mixColour(first: string, second: string, fraction: number): string {
  const parseChannels = (colour: string) =>
    [1, 3, 5].map((offset) => parseInt(colour.slice(offset, offset + 2), 16));
  const start = parseChannels(first);
  const end = parseChannels(second);
  const channels = start.map((channel, index) =>
    Math.round(channel + (end[index] - channel) * fraction)
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${channels.join("")}`;
}

function createBurstEvent(kind: BurstKind, seed: number): BurstPhase {
  const profile = BURST_PROFILES[kind];
  const random = createRandom(seed);
  const bands = Array.from({ length: profile.bands }, (_unused, index) => {
    const start = Math.max(
      16,
      Math.min(
        50,
        Math.round(19 + index * (29 / Math.max(1, profile.bands - 1)) + (random() - 0.5) * 16.8),
      ),
    );
    const height = Math.max(1, Math.round(profile.height * (1 + (random() - 0.5) * 0.84)));
    const magnitude = Math.max(
      4,
      Math.round((profile.shift * (1 + (random() - 0.5) * 0.56)) / 4) * 4,
    );
    const shift = magnitude * (random() < 0.5 ? -1 : 1);
    return { start, height, shift };
  });
  return { kind, duration: profile.duration, seed, chroma: profile.chroma, bands };
}

/**
 * Builds the shared timeline: a long calm opening, three mild / two medium / two strong bursts each
 * separated by a calm gap, and a long calm tail — the same rhythm as the approved prototype.
 */
export function buildBurstSequence(): BurstSequence {
  const phases: SequencePhase[] = [{ kind: "normal", duration: 1200 }];
  const pattern: BurstKind[] = ["mild", "mild", "mild", "medium", "medium", "strong", "strong"];
  pattern.forEach((kind, index) => {
    phases.push(createBurstEvent(kind, 19 + index * 193));
    if (index < pattern.length - 1) {
      phases.push({ kind: "normal", duration: 1800 });
    }
  });
  phases.push({ kind: "normal", duration: 4500 });
  const totalDuration = phases.reduce((sum, phase) => sum + phase.duration, 0);
  return { phases, totalDuration };
}

function phaseAt(sequence: BurstSequence, timeMilliseconds: number): ActivePhase {
  let cursor = timeMilliseconds % sequence.totalDuration;
  for (const phase of sequence.phases) {
    if (cursor < phase.duration) {
      return { phase, localTime: cursor };
    }
    cursor -= phase.duration;
  }
  return { phase: sequence.phases[0], localTime: 0 };
}

/** Rasterises one pixel face into an offscreen canvas, optionally tinted a single flat colour. */
function createPixelSource(
  face: PixelBrandFace,
  theme: BrandTheme,
  tint?: string,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const context = canvas.getContext("2d");
  if (context === null) {
    return canvas;
  }
  const extent = face.extent ?? DEFAULT_EXTENT;
  const quantum = extent / face.grid;
  const padding = (CANVAS_SIZE - extent) / 2;
  for (const [column, row, paletteIndex] of face.pixels) {
    let colour: string;
    if (tint !== undefined) {
      colour = tint;
    } else if (face.palette !== undefined) {
      colour = face.palette[paletteIndex ?? 0];
    } else {
      colour = INDEX_FACE_COLOUR[theme];
    }
    context.fillStyle = colour;
    context.fillRect(padding + column * quantum, padding + row * quantum, quantum, quantum);
  }
  return canvas;
}

function paintPolygons(
  context: CanvasRenderingContext2D,
  face: SegmentedBrandFace,
  timeMilliseconds: number,
  animated: boolean,
): void {
  context.save();
  context.translate(POLYGON_ORIGIN, POLYGON_ORIGIN);
  face.polygons.forEach((polygon, index) => {
    let colour = polygon.color;
    if (animated) {
      const cycle = [
        polygon.color,
        ...face.palette.map(
          (_unused, offset) => face.palette[(index + offset) % face.palette.length],
        ),
        polygon.color,
      ];
      const progress =
        ((timeMilliseconds % PALETTE_CYCLE_MILLISECONDS) / PALETTE_CYCLE_MILLISECONDS) *
        (cycle.length - 1);
      const current = Math.floor(progress);
      const fraction = progress - current;
      const eased = fraction * fraction * (3 - 2 * fraction);
      colour = mixColour(cycle[current], cycle[current + 1], eased);
    }
    context.fillStyle = colour;
    context.beginPath();
    polygon.points.forEach(([x, y], pointIndex) => {
      if (pointIndex === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });
    context.closePath();
    context.fill();
  });
  context.restore();
}

export interface FaceRenderer {
  draw(timeMilliseconds: number, animated: boolean): void;
  retint(theme: BrandTheme): void;
}

export function createFaceRenderer(
  face: BrandFace,
  context: CanvasRenderingContext2D,
  theme: BrandTheme,
  sequence: BurstSequence,
): FaceRenderer {
  if (face.type === "segmented") {
    return {
      draw(timeMilliseconds, animated) {
        context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        context.imageSmoothingEnabled = false;
        paintPolygons(context, face, timeMilliseconds, animated);
      },
      retint() {
        // Segmented faces cycle their own palette and do not depend on the theme.
      },
    };
  }

  const extent = face.extent ?? DEFAULT_EXTENT;
  const quantum = extent / face.grid;
  const cyan = createPixelSource(face, theme, CHROMA_CYAN);
  const magenta = createPixelSource(face, theme, CHROMA_MAGENTA);
  let base = createPixelSource(face, theme);

  const computeOffsets = (active: ActivePhase): number[] => {
    const offsets = new Array<number>(Math.ceil(CANVAS_SIZE / quantum)).fill(0);
    const withinBurstWindow = active.localTime / active.phase.duration <= 0.92;
    if (active.phase.kind === "normal" || !withinBurstWindow) {
      return offsets;
    }
    const burst = active.phase;
    const burstFrame = Math.floor(active.localTime / BURST_FRAME_MILLISECONDS);
    const isStrongGlitchGap = burst.kind === "strong" && (burstFrame === 4 || burstFrame === 10);
    if (isStrongGlitchGap) {
      return offsets;
    }
    const random = createRandom(burst.seed + burstFrame * 193);
    const refinement = Math.pow(quantum / 8, 0.35);
    burst.bands.forEach((band, index) => {
      const direction = (burstFrame + index) % 4 === 2 ? -1 : 1;
      const shift =
        Math.round(((band.shift * direction + (random() - 0.5) * 8.4) * refinement) / quantum) *
        quantum;
      const start = Math.max(0, Math.round((band.start * 4 + (random() - 0.5) * 11.2) / quantum));
      const height = Math.max(1, Math.round((band.height * 4 * refinement) / quantum));
      for (let row = start; row < Math.min(offsets.length, start + height); row += 1) {
        offsets[row] = shift;
      }
    });
    return offsets;
  };

  return {
    retint(nextTheme) {
      base = createPixelSource(face, nextTheme);
    },
    draw(timeMilliseconds, animated) {
      context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      context.imageSmoothingEnabled = false;
      const active = animated ? phaseAt(sequence, timeMilliseconds) : null;
      const offsets =
        active === null
          ? new Array<number>(Math.ceil(CANVAS_SIZE / quantum)).fill(0)
          : computeOffsets(active);
      const burst = active !== null && active.phase.kind !== "normal" ? active.phase : null;
      offsets.forEach((shift, row) => {
        const y = row * quantum;
        const height = Math.min(quantum, CANVAS_SIZE - y);
        if (shift !== 0 && burst !== null && burst.chroma > 0) {
          const separation = Math.max(
            quantum,
            Math.round((burst.chroma * Math.pow(quantum / 8, 0.35)) / quantum) * quantum,
          );
          context.globalAlpha = burst.kind === "medium" ? 0.35 : 0.66;
          context.drawImage(
            cyan,
            0,
            y,
            CANVAS_SIZE,
            height,
            shift - separation,
            y,
            CANVAS_SIZE,
            height,
          );
          context.drawImage(
            magenta,
            0,
            y,
            CANVAS_SIZE,
            height,
            shift + separation,
            y,
            CANVAS_SIZE,
            height,
          );
          context.globalAlpha = 1;
        }
        context.drawImage(base, 0, y, CANVAS_SIZE, height, shift, y, CANVAS_SIZE, height);
      });
    },
  };
}

/** How the wordmark is disturbed at one instant: a band of the text slid sideways, split in colour. */
export interface WordmarkGlitch {
  /** Horizontal slide of the band, in em, signed. */
  shift: number;
  /** Top and bottom of the band, as fractions of the text height. */
  bandTop: number;
  bandBottom: number;
  /** Separation of the cyan and magenta ghosts, in em; zero for a mild burst. */
  chroma: number;
}

const WORDMARK_SHIFT_EM: Record<BurstKind, number> = { mild: 0.05, medium: 0.09, strong: 0.14 };
const WORDMARK_CHROMA_EM: Record<BurstKind, number> = { mild: 0, medium: 0.03, strong: 0.05 };

/**
 * The wordmark's share of the burst timeline. It reads the same phases the pixel faces do, so the
 * text glitches in the very frames the mark does, and is calm whenever the mark is.
 */
export function wordmarkGlitchAt(sequence: BurstSequence, timeMilliseconds: number): WordmarkGlitch | null {
  const active = phaseAt(sequence, timeMilliseconds);
  if (active.phase.kind === "normal" || active.localTime / active.phase.duration > 0.92) {
    return null;
  }
  const burst = active.phase;
  const burstFrame = Math.floor(active.localTime / BURST_FRAME_MILLISECONDS);
  if (burst.kind === "strong" && (burstFrame === 4 || burstFrame === 10)) {
    return null;
  }
  const random = createRandom(burst.seed + burstFrame * 193);
  const bandTop = 0.12 + random() * 0.5;
  const bandHeight = 0.18 + random() * 0.3;
  const direction = burstFrame % 4 === 2 ? -1 : 1;
  return {
    shift: WORDMARK_SHIFT_EM[burst.kind] * direction * (0.6 + random() * 0.8),
    bandTop,
    bandBottom: Math.min(0.95, bandTop + bandHeight),
    chroma: WORDMARK_CHROMA_EM[burst.kind],
  };
}

export const CHROMA_COLOURS = { cyan: CHROMA_CYAN, magenta: CHROMA_MAGENTA } as const;
