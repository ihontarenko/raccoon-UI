import { classNames } from "../../../lib/classNames";

// A single stroked line-icon set, ported from the approved Design prototype. Every glyph is drawn on
// the same 24×24 grid with `currentColor`, so an icon takes the colour of the text around it and is
// sized through CSS rather than width/height attributes.

const ICON_PATHS = {
  search: "M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  context: "M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h5",
  answers: "M4 4h16v13H9l-5 4z M8 8h8 M8 12h5",
  sources: "M3 7h6l2-3h10v16H3z",
  projects: "M3 5h18v15H3z M3 10h18 M9 10v10",
  documents: "M5 3h9l5 5v13H5z M14 3v6h5 M9 13h6 M9 17h6",
  jobs: "M12 3a9 9 0 1 1-9 9 M12 7v5l3 2 M3 3v5h5",
  access: "M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0v4",
  system: "M3 5h18v12H3z M8 21h8 M12 17v4",
  evaluation: "M4 18l5-5 4 2 7-10 M4 4v16h17",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  sun: "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1 1 M18 18l1 1 M5 19l1-1 M18 6l1-1",
  moon: "M20 15.5A9 9 0 0 1 8.5 4a9 9 0 1 0 11.5 11.5",
  close: "M6 6l12 12 M6 18L18 6",
  plus: "M12 5v14 M5 12h14",
  arrow: "M4 12h16 M14 6l6 6-6 6",
  code: "M8 6l-6 6 6 6 M16 6l6 6-6 6",
  check: "M5 12l4 4L19 6",
  signOut: "M9 21H5V3h4 M16 17l5-5-5-5 M21 12H9",
  chevron: "M9 6l6 6-6 6",
  "chevron-down": "M6 9l6 6 6-6",
  "chevron-up": "M6 15l6-6 6 6",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7 M20 4v7h-7",
  arrowUp: "M12 19V5 M6 11l6-6 6 6",
  arrowDown: "M12 5v14 M6 13l6 6 6-6",
  play: "M7 4l12 8-12 8z",
  folder: "M3 6h6l2 2h10v11H3z",
  key: "M15 3a6 6 0 1 1-5.6 8.2L3 17.6V21h3.4v-2.4h2.4v-2.4h2.4l1.2-1.2A6 6 0 0 1 15 3 M16.5 7.5h.01",
  model: "M7 7h10v10H7z M10 3v4 M14 3v4 M10 17v4 M14 17v4 M3 10h4 M3 14h4 M17 10h4 M17 14h4",
  layers: "M12 3l9 5-9 5-9-5z M3 13l9 5 9-5 M3 17l9 5 9-5",
  vectors: "M4 20L20 4 M4 20l5-11 M4 20l11-5 M20 4h-5 M20 4v5",
  chunks: "M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z",
  script: "M6 3h12v18H6z M9 8l-2 2 2 2 M15 8l2 2-2 2 M12 16h3",
  trash: "M4 7h16 M9 7V4h6v3 M6 7l1 14h10l1-14 M10 11v6 M14 11v6",
  edit: "M4 20h4L19 9l-4-4L4 16z M13 7l4 4",
  shield: "M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z M9 12l2 2 4-4",
  people: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M2 21v-1a7 7 0 0 1 14 0v1 M16 3.5a4 4 0 0 1 0 7 M19 21v-1a7 7 0 0 0-3-5.7",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12 M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6",
  agent: "M5 8h14v11H5z M12 4v4 M9 13h.01 M15 13h.01 M9 16h6 M2 12v3 M22 12v3",
  gauge: "M4 18a9 9 0 1 1 16 0 M12 14l4-5 M12 14h.01",
  pause: "M8 5v14 M16 5v14",
  stop: "M6 6h12v12H6z",
  link: "M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1 M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
  workspace: "M3 4h18v6H3z M3 14h8v6H3z M15 14h6v6h-6z",
  prompt: "M4 5h16v11H8l-4 4z M8 9l2 2-2 2 M12 13h4",
  download: "M12 4v12 M6 10l6 6 6-6 M4 20h16",
  upload: "M12 20V8 M6 14l6-6 6 6 M4 4h16",
  copy: "M9 9h11v11H9z M5 15H4V4h11v1",
  more: "M5 12h.01 M12 12h.01 M19 12h.01",
  information: "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18 M12 11v6 M12 7.5h.01",
  help: "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18 M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.7 M12 17h.01",
  previous: "M15 6l-6 6 6 6",
  image: "M3 4h18v16H3z M3 16l5-5 4 4 3-3 6 6 M15.5 8.5h.01",
  expand: "M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5",
  files: "M7 3h8l4 4v12H7z M15 3v4h4 M4 7v14h11",
  language:
    "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18 M3 12h18 M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9 M12 3c-2.4 2.5-3.6 5.5-3.6 9s1.2 6.5 3.6 9",
} as const;

export type IconName = keyof typeof ICON_PATHS;

/** Every glyph by name, for the UI Kit's catalogue. */
export const ICON_NAMES = Object.keys(ICON_PATHS) as IconName[];

export type IconSize = "small" | "medium" | "large";

interface IconProperties {
  name: IconName;
  size?: IconSize;
  /**
   * An accessible label. When provided the icon is exposed to assistive technology as an image with
   * this name; when omitted the icon is decorative and hidden, which is the common case for an icon
   * that sits beside a text label.
   */
  title?: string;
  className?: string;
}

const SIZE_CLASS: Record<IconSize, string> = {
  small: "size-[calc(14px*var(--ui-scale))]",
  medium: "size-[calc(18px*var(--ui-scale))]",
  large: "size-[calc(22px*var(--ui-scale))]",
};

export function Icon({ name, size = "medium", title, className }: IconProperties) {
  return (
    <svg
      className={classNames("block flex-none", SIZE_CLASS[size], className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title === undefined ? undefined : "img"}
      aria-hidden={title === undefined ? true : undefined}
      aria-label={title}
    >
      {title !== undefined && <title>{title}</title>}
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
