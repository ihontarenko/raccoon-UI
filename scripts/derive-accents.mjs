/*
 * Prints the accent tokens for the colour-scheme and intensity axes, so the numbers in
 * `src/styles/tokens.css` are reproducible rather than picked by eye.
 *
 *   node scripts/derive-accents.mjs
 *
 * ── What the two axes mean ───────────────────────────────────────────────────────────────────────
 *
 * A scheme is a hue. The intensity is how loudly that hue speaks, and it NEVER changes which hue it
 * is: graphite is blue at both intensities, terminal is the same teal, only brighter. A scheme that
 * changed hue with its intensity would be a different scheme, not a louder one.
 *
 * Vivid also brings schemes of its own — Kitsu's set, less the two left out (`ao`, `sumi`) and less
 * `ember`, which is the hue amber already is and so is amber's loud voice rather than a tenth option.
 * They carry a calm triad as well, so turning the intensity down on one keeps the scheme instead of
 * taking it away.
 *
 * ── What is derived ──────────────────────────────────────────────────────────────────────────────
 *
 * Each hue is moved along itself until it clears its bar against this interface's own grounds:
 *
 *   --accent-text   4.5:1 on the page and on a surface   (it is read)
 *   --accent        3:1 on the page and on a surface     (it is a mark, not text)
 *   --accent-soft   a wash of the hue on the theme's surface
 *
 * ⚠️ The calm triads of graphite, forest, terminal and amber are NOT printed: they were hand-tuned
 * with the Design prototype and are the approved look. Their calm light accent is the hue everything
 * else about them is derived from, which is why it is named here.
 */

const GROUND = {
  light: { page: "#eef1f5", surface: "#ffffff", toward: "#000000" },
  dark: { page: "#141b21", surface: "#1a232b", toward: "#ffffff" },
};

/**
 * The four approved schemes. `calm` is the light accent already in the stylesheet, which the vivid hue
 * is derived from; `swatch` is their hand-tuned dark accent, which the menu paints their option in. Both
 * are quoted from the approved triads above rather than computed, because those triads are not ours.
 */
const APPROVED = [
  { name: "graphite", calm: "#1d6c97", swatch: "#91b8cc" },
  { name: "forest", calm: "#4b7a17", swatch: "#c1d28b" },
  { name: "terminal", calm: "#0b8670", swatch: "#7fd5bd" },
  // ⚠️ Amber's loud voice is Kitsu's ember rather than a brightening of its own hue. They are the same
  // orange a step apart, so giving ember a tenth option would have put two of it in the row.
  { name: "amber", calm: "#b06405", vivid: "#ff641b", swatch: "#e8bf85" },
];

/** Kitsu's set, less `ao` and `sumi` (left out) and less `ember` (amber's vivid above). */
const ADDED = [
  { name: "kurenai", vivid: "#d92b36" },
  { name: "sakura", vivid: "#e62d72" },
  { name: "fuji", vivid: "#8b5cf6" },
  { name: "mizu", vivid: "#0e8b96" },
  { name: "matcha", vivid: "#2d9459" },
  { name: "wakaba", vivid: "#7da818" },
];

const parse = (hex) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
const format = (channels) =>
  "#" + channels.map((channel) => Math.round(Math.min(255, Math.max(0, channel))).toString(16).padStart(2, "0")).join("");

function toHueSaturationLightness([red, green, blue]) {
  const [r, g, b] = [red / 255, green / 255, blue / 255];
  const high = Math.max(r, g, b);
  const low = Math.min(r, g, b);
  const lightness = (high + low) / 2;
  if (high === low) {
    return { hue: 0, saturation: 0, lightness };
  }
  const span = high - low;
  const saturation = lightness > 0.5 ? span / (2 - high - low) : span / (high + low);
  let hue;
  if (high === r) {
    hue = ((g - b) / span + (g < b ? 6 : 0)) / 6;
  } else if (high === g) {
    hue = ((b - r) / span + 2) / 6;
  } else {
    hue = ((r - g) / span + 4) / 6;
  }
  return { hue, saturation, lightness };
}

function fromHueSaturationLightness({ hue, saturation, lightness }) {
  if (saturation === 0) {
    const flat = lightness * 255;
    return [flat, flat, flat];
  }
  const second = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const first = 2 * lightness - second;
  const channel = (offset) => {
    let position = hue + offset;
    if (position < 0) {
      position += 1;
    }
    if (position > 1) {
      position -= 1;
    }
    if (position < 1 / 6) {
      return first + (second - first) * 6 * position;
    }
    if (position < 1 / 2) {
      return second;
    }
    if (position < 2 / 3) {
      return first + (second - first) * (2 / 3 - position) * 6;
    }
    return first;
  };
  return [channel(1 / 3) * 255, channel(0) * 255, channel(-1 / 3) * 255];
}

/** The same hue, said louder: as saturated as it goes, and lifted out of its own shadow. */
function louder(hex) {
  const parts = toHueSaturationLightness(parse(hex));
  return format(
    fromHueSaturationLightness({
      hue: parts.hue,
      saturation: Math.min(0.88, Math.max(parts.saturation, 0.8)),
      lightness: Math.min(0.56, Math.max(parts.lightness * 1.3, 0.4)),
    }),
  );
}

/** The same hue, said quietly: the instrument's voice for a scheme that arrived with the loud set. */
function quieter(hex) {
  const parts = toHueSaturationLightness(parse(hex));
  return format(
    fromHueSaturationLightness({
      hue: parts.hue,
      saturation: parts.saturation * 0.72,
      lightness: parts.lightness * 0.78,
    }),
  );
}

const channelLuminance = (value) => {
  const share = value / 255;
  return share <= 0.04045 ? share / 12.92 : Math.pow((share + 0.055) / 1.055, 2.4);
};
const luminance = (channels) =>
  0.2126 * channelLuminance(channels[0]) + 0.7152 * channelLuminance(channels[1]) + 0.0722 * channelLuminance(channels[2]);
const contrast = (first, second) => {
  const [brighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (brighter + 0.05) / (darker + 0.05);
};
const blend = (first, second, amount) => first.map((channel, index) => channel * (1 - amount) + second[index] * amount);

/** Moves the hue toward the theme's extreme until it clears `bar` on both the page and a surface. */
function clearing(hue, theme, bar) {
  const ground = GROUND[theme];
  const toward = parse(ground.toward);
  for (let step = 0; step <= 100; step += 1) {
    const candidate = blend(hue, toward, step / 100);
    if (contrast(candidate, parse(ground.page)) >= bar && contrast(candidate, parse(ground.surface)) >= bar) {
      return candidate;
    }
  }
  return toward;
}

function triad(hex, theme) {
  const hue = parse(hex);
  const ground = GROUND[theme];
  return {
    accent: format(clearing(hue, theme, 3)),
    text: format(clearing(hue, theme, 4.5)),
    soft: format(theme === "light" ? blend(hue, parse("#ffffff"), 0.86) : blend(hue, parse(ground.surface), 0.8)),
  };
}

function block(selector, hex, theme) {
  const values = triad(hex, theme);
  const ground = GROUND[theme];
  return [
    `${selector} {`,
    `  --accent: ${values.accent};`,
    `  --accent-text: ${values.text};`,
    `  --accent-soft: ${values.soft};`,
    `} /* ${hex} · mark ${contrast(parse(values.accent), parse(ground.page)).toFixed(2)}:1 on the page` +
      ` · text ${contrast(parse(values.text), parse(ground.surface)).toFixed(2)}:1 on a surface */`,
  ].join("\n");
}

const schemes = [
  ...APPROVED.map((scheme) => ({ name: scheme.name, vivid: scheme.vivid ?? louder(scheme.calm), calm: null, swatch: scheme.swatch })),
  ...ADDED.map((scheme) => ({ name: scheme.name, vivid: scheme.vivid, calm: quieter(scheme.vivid), swatch: null })),
];

const lines = [];
lines.push("/* ── calm, for the schemes that arrived with the vivid set ──────────────────────────────── */");
for (const scheme of schemes.filter((candidate) => candidate.calm !== null)) {
  lines.push(block(`[data-palette="${scheme.name}"]`, scheme.calm, "light"));
}
lines.push("");
for (const scheme of schemes.filter((candidate) => candidate.calm !== null)) {
  lines.push(block(`[data-theme="dark"][data-palette="${scheme.name}"]`, scheme.calm, "dark"));
}
lines.push("");
lines.push("/* ── vivid: every scheme, its own hue said louder ───────────────────────────────────────── */");
for (const scheme of schemes) {
  lines.push(block(`[data-intensity="vivid"][data-palette="${scheme.name}"]`, scheme.vivid, "light"));
}
lines.push("");
for (const scheme of schemes) {
  lines.push(block(`[data-theme="dark"][data-intensity="vivid"][data-palette="${scheme.name}"]`, scheme.vivid, "dark"));
}
lines.push("");
lines.push("/* ── the swatch each option is painted in: that scheme's mark in the dark theme ─────────── */");
lines.push(":root {");
for (const scheme of schemes) {
  lines.push(`  --swatch-${scheme.name}: ${scheme.swatch ?? triad(scheme.calm, "dark").accent};`);
}
lines.push("}");
lines.push('[data-intensity="vivid"] {');
for (const scheme of schemes) {
  lines.push(`  --swatch-${scheme.name}: ${triad(scheme.vivid, "dark").accent};`);
}
lines.push("}");

process.stdout.write(lines.join("\n") + "\n");
