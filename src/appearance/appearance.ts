// Independent appearance axes for the Raccoon interface, ported from the approved Design prototype
// as a typed, component-owned module. Each axis is a `data-*` attribute on the document element that
// the token stylesheet reads; the chosen values persist per browser in localStorage.
//
// The interface language is chosen in the same menu but is not an axis here: it is held by
// `translations/translate.ts`, because its texts come from the server.
//
// The axes are deliberately orthogonal: theme (light/dark), colour scheme (which accent triad),
// accent intensity (how loudly that triad speaks), interface size (scales type, spacing, controls and
// columns together), font family, and the mark the product signs with — the face beside the wordmark
// and in the browser tab. Scheme and intensity are two axes rather than eight schemes
// because they answer different questions — which colour means "active", and how much of it to use.

import { declareText, type DeclaredText } from "../translations/translate";
import { showMarkInTab } from "../ui/brand/brandFaces";

export const APPEARANCE_AXES = {
  theme: ["light", "dark"],
  palette: ["graphite", "forest", "terminal", "amber", "kurenai", "sakura", "fuji", "mizu", "matcha", "wakaba"],
  intensity: ["calm", "vivid"],
  scale: ["0.9", "1", "1.15", "1.3"],
  font: ["inter", "onest", "code", "hybrid"],
  mark: ["mask", "index", "prism", "tangram", "mosaic"],
} as const;

export type AppearanceAxis = keyof typeof APPEARANCE_AXES;
export type AppearanceValue<Axis extends AppearanceAxis> = (typeof APPEARANCE_AXES)[Axis][number];
export type AppearanceState = {
  [Axis in AppearanceAxis]: AppearanceValue<Axis>;
};

const DEFAULT_APPEARANCE: AppearanceState = {
  theme: "light",
  palette: "graphite",
  scale: "1",
  font: "inter",
  intensity: "calm",
  mark: "mask",
};

const STORAGE_PREFIX = "raccoon.appearance.";

/**
 * The schemes the vivid set brought. They exist at both intensities — one chosen here and then turned
 * calm stays the scheme it was, in its quiet voice — but they are only offered while vivid is on, and
 * whenever one of them is the scheme in force. The four before them are the approved set and are
 * always offered.
 */
export const VIVID_SCHEMES: readonly AppearanceValue<"palette">[] = [
  "kurenai",
  "sakura",
  "fuji",
  "mizu",
  "matcha",
  "wakaba",
];

// Declared, not rendered: the menu renders them in the viewer's language. Typeface names stay as they are.
export const APPEARANCE_LABELS: {
  [Axis in AppearanceAxis]: { legend: DeclaredText; options: Record<string, DeclaredText | string> };
} = {
  theme: {
    legend: declareText("appearance.theme", "Theme"),
    options: {
      light: declareText("appearance.theme.light", "Light"),
      dark: declareText("appearance.theme.dark", "Dark"),
    },
  },
  palette: {
    legend: declareText("appearance.palette", "Colour scheme"),
    options: {
      graphite: declareText("appearance.palette.graphite", "Graphite"),
      forest: declareText("appearance.palette.forest", "Forest"),
      terminal: declareText("appearance.palette.terminal", "Terminal"),
      amber: declareText("appearance.palette.amber", "Amber"),
      // The schemes the vivid set brought keep the names they were cut under, as typefaces do.
      kurenai: "Kurenai",
      sakura: "Sakura",
      fuji: "Fuji",
      mizu: "Mizu",
      matcha: "Matcha",
      wakaba: "Wakaba",
    },
  },
  scale: {
    legend: declareText("appearance.scale", "Interface size"),
    options: {
      "0.9": declareText("appearance.scale.compact", "Compact"),
      "1": declareText("appearance.scale.normal", "Normal"),
      "1.15": declareText("appearance.scale.comfortable", "Comfortable"),
      "1.3": declareText("appearance.scale.large", "Large"),
    },
  },
  intensity: {
    legend: declareText("appearance.intensity", "Accent intensity"),
    options: {
      calm: declareText("appearance.intensity.calm", "Calm"),
      vivid: declareText("appearance.intensity.vivid", "Vivid"),
    },
  },
  font: {
    legend: declareText("appearance.font", "Typeface"),
    options: {
      inter: "Inter",
      onest: "Onest",
      code: "JetBrains Mono",
      hybrid: "Code + Onest",
    },
  },
  mark: {
    legend: declareText("appearance.mark", "Logo"),
    // A face is named the way a typeface is: the name it was drawn under.
    options: {
      mask: "Mask",
      index: "Index",
      prism: "Prism",
      tangram: "Tangram",
      mosaic: "Mosaic",
    },
  },
};

function isAllowedValue<Axis extends AppearanceAxis>(
  axis: Axis,
  candidate: string | null,
): candidate is AppearanceValue<Axis> {
  if (candidate === null) {
    return false;
  }
  return (APPEARANCE_AXES[axis] as readonly string[]).includes(candidate);
}

function readStoredValue<Axis extends AppearanceAxis>(axis: Axis): AppearanceValue<Axis> {
  try {
    const stored = window.localStorage.getItem(`${STORAGE_PREFIX}${axis}`);
    if (isAllowedValue(axis, stored)) {
      return stored;
    }
  } catch {
    // A private window or blocked storage simply falls back to the default value.
  }
  return DEFAULT_APPEARANCE[axis];
}

function applyAxis(axis: AppearanceAxis, value: string): void {
  document.documentElement.dataset[axis] = value;
  if (axis === "mark") {
    showMarkInTab(value);
  }
}

/** Reads the stored appearance for every axis and applies it to the document element. */
export function loadAppearance(): AppearanceState {
  const state: AppearanceState = {
    theme: readStoredValue("theme"),
    palette: readStoredValue("palette"),
    scale: readStoredValue("scale"),
    font: readStoredValue("font"),
    intensity: readStoredValue("intensity"),
    mark: readStoredValue("mark"),
  };
  for (const axis of Object.keys(state) as AppearanceAxis[]) {
    applyAxis(axis, state[axis]);
  }
  return state;
}

/**
 * Validates, applies and persists one axis value, returning the updated appearance state. Values
 * arrive from the interface as plain strings, so an unknown value is ignored rather than trusted.
 */
export function changeAppearanceAxis(
  previous: AppearanceState,
  axis: AppearanceAxis,
  value: string,
): AppearanceState {
  if (!(APPEARANCE_AXES[axis] as readonly string[]).includes(value)) {
    return previous;
  }
  applyAxis(axis, value);
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${axis}`, value);
  } catch {
    // Persisting is best-effort; the applied value still holds for the current session.
  }
  return { ...previous, [axis]: value } as AppearanceState;
}
