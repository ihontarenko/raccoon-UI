import type { ReactNode } from "react";
import type { FileLook } from "../../lib/files";
import { FAMILY_FILL, FAMILY_STROKE, extensionOf, familyOf, type FileFamily } from "./fileFamilies";
import { declareText, type DeclaredText } from "../../translations/translate";
import { useTranslation } from "../../translations/TranslationProvider";
import { FILE_CORNER, FILE_GLYPH, FILE_PAGE, FILE_STAMP, MARK, MARK_SIZE } from "./filesClasses";

type MarkSize = "small" | "large";

/** The stamp a file without an extension wears. PDF is a format's own name and reads the same in every language. */
const LOOK_STAMP: Record<FileLook, DeclaredText | string> = {
  image: declareText("fileMarks.stamp.image", "IMG"),
  pdf: "PDF",
  text: declareText("fileMarks.stamp.text", "TXT"),
  audio: declareText("fileMarks.stamp.audio", "AUD"),
  video: declareText("fileMarks.stamp.video", "VID"),
  none: "",
};

/** The glyph each family wears above its band — drawn in the family's colour, at the large size only. */
const GLYPH: Record<FileFamily, ReactNode> = {
  document: <path d="M8 6.8h5M8 9.2h8M8 11.6h8" />,
  text: <path d="M8 6.8h5M8 9.2h8M8 11.6h6" />,
  pdf: <path d="M8 6.8h5M8 9.2h8M8 11.6h8" />,
  book: <path d="M12 7.4c-1.3-.9-2.8-1.1-4.4-.6v5.4c1.6-.5 3.1-.3 4.4.6 1.3-.9 2.8-1.1 4.4-.6V6.8c-1.6-.5-3.1-.3-4.4.6zM12 7.4v5.4" />,
  other: null,
  sheet: <path d="M7.5 6.3h9v6h-9zM10.5 6.3v6M13.5 6.3v6M7.5 9.3h9" />,
  code: <path d="M10 7.2l-2.4 2.4 2.4 2.4M14 7.2l2.4 2.4-2.4 2.4M12.8 6.6l-1.6 6" />,
  data: <path d="M10.2 6.4c-.9 0-1.3.4-1.3 1.2v1c0 .7-.4 1.1-1.1 1.1.7 0 1.1.4 1.1 1.1v1c0 .8.4 1.2 1.3 1.2M13.8 6.4c.9 0 1.3.4 1.3 1.2v1c0 .7.4 1.1 1.1 1.1-.7 0-1.1.4-1.1 1.1v1c0 .8-.4 1.2-1.3 1.2" />,
  markup: <path d="M10.4 6.4l-.8 6.4M13.8 6.4l-.8 6.4M8.4 8.4h6.6M8 10.8h6.6" />,
  image: <path d="M7.4 12.6l2.9-3.1 2 2 1.5-1.5 2.4 2.6M14.6 7.4a.9.9 0 1 0 .01 0" />,
  media: <path d="M10.2 6.8v5.4l4.4-2.7z" />,
  archive: <path d="M12 2.8v1.4M12 5.4v1.4M12 8v1.4M10.9 10.6h2.2v2h-2.2z" />,
};

/**
 * A page with a folded corner, its family told twice — a coloured band and, at the large size, a glyph — and its
 * extension stamped in the band, so a kind is read by shape and word, never by colour alone.
 */
export function FileMark({ size = "small", look = "none", extension, name }: { size?: MarkSize; look?: FileLook; extension?: string; name?: string }) {
  const { say } = useTranslation();
  const family = familyOf(name ?? (extension === undefined ? undefined : `file.${extension}`), look);
  const lookStamp = LOOK_STAMP[look];
  const stamp = (extension ?? (name === undefined ? undefined : extensionOf(name)) ?? (typeof lookStamp === "string" ? lookStamp : say(lookStamp))).slice(0, 4).toUpperCase();
  return (
    <svg viewBox="0 0 24 24" className={`${MARK} ${MARK_SIZE[size]}`} aria-hidden="true">
      <path className={FILE_PAGE} d="M5 2.5h9.5L19.5 7.5V21a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5z" />
      <path className={FILE_CORNER} d="M14.5 2.5v4.5a.5.5 0 0 0 .5.5h4.5z" />
      {size === "large" && GLYPH[family] !== null && (
        <g className={`${FILE_GLYPH} ${family === "media" ? FAMILY_FILL[family] : "fill-none"} ${FAMILY_STROKE[family]}`}>{GLYPH[family]}</g>
      )}
      <path className={FAMILY_FILL[family]} d={size === "large" ? "M4.5 14.2h15V21a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5z" : "M4.5 15.5h15V21a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5z"} />
      {size === "large" && stamp.length > 0 && (
        <text x="12" y="19.4" textAnchor="middle" className={FILE_STAMP}>
          {stamp}
        </text>
      )}
    </svg>
  );
}
