import type { FileLook } from "../../lib/files";

/**
 * What family a file belongs to, for its mark: the extension decides, the media type stands in when there is none.
 * A family is a colour and a glyph — enough to tell code from a page from a picture at a glance, without a logo.
 */
export type FileFamily = "document" | "pdf" | "book" | "sheet" | "code" | "data" | "markup" | "image" | "media" | "archive" | "text" | "other";

const BY_EXTENSION: Record<string, FileFamily> = {};
const add = (family: FileFamily, extensions: string) => {
  for (const extension of extensions.split(" ")) {
    BY_EXTENSION[extension] = family;
  }
};
add("document", "doc docx odt rtf pages ppt pptx odp key");
add("pdf", "pdf");
add("book", "epub fb2 fb3 mobi azw azw3 djvu");
add("sheet", "xls xlsx ods csv tsv numbers");
add("code", "java kt kts ts tsx js jsx mjs cjs py go rs c h cpp hpp cc cs rb php swift scala groovy gradle sh bash ps1 bat sql lua dart r vue svelte");
add("data", "json jsonl xml yaml yml toml ini properties env conf cfg jmp jms jmq");
add("markup", "md markdown html htm xhtml css scss sass less rst adoc tex");
add("image", "png jpg jpeg gif webp svg bmp tif tiff ico heic avif");
add("media", "mp3 wav ogg flac m4a aac mp4 mkv webm mov avi m4v");
add("archive", "zip tar gz tgz bz2 xz 7z rar jar war");
add("text", "txt log text nfo");

export function extensionOf(name: string): string | undefined {
  const dot = name.lastIndexOf(".");
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : undefined;
}

export function familyOf(name: string | undefined, look: FileLook): FileFamily {
  const extension = name === undefined ? undefined : extensionOf(name);
  const known = extension === undefined ? undefined : BY_EXTENSION[extension];
  if (known !== undefined) {
    return known;
  }
  switch (look) {
    case "image":
      return "image";
    case "pdf":
      return "pdf";
    case "audio":
    case "video":
      return "media";
    case "text":
      return "text";
    default:
      return "other";
  }
}

/** The band colour of each family, as a fill utility over its token. */
export const FAMILY_FILL: Record<FileFamily, string> = {
  document: "fill-(--file-document)",
  pdf: "fill-(--file-pdf)",
  book: "fill-(--file-book)",
  sheet: "fill-(--file-sheet)",
  code: "fill-(--file-code)",
  data: "fill-(--file-data)",
  markup: "fill-(--file-markup)",
  image: "fill-(--file-image)",
  media: "fill-(--file-media)",
  archive: "fill-(--file-archive)",
  text: "fill-(--file-text)",
  other: "fill-(--file-other)",
};

/** The same colour as a stroke, for the glyph drawn above the band. */
export const FAMILY_STROKE: Record<FileFamily, string> = {
  document: "stroke-(--file-document)",
  pdf: "stroke-(--file-pdf)",
  book: "stroke-(--file-book)",
  sheet: "stroke-(--file-sheet)",
  code: "stroke-(--file-code)",
  data: "stroke-(--file-data)",
  markup: "stroke-(--file-markup)",
  image: "stroke-(--file-image)",
  media: "stroke-(--file-media)",
  archive: "stroke-(--file-archive)",
  text: "stroke-(--file-text)",
  other: "stroke-(--file-other)",
};
