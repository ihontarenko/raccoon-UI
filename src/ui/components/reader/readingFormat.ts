import { declareText, translate, translateDeclared, type DeclaredText } from "../../../translations/translate";

// How an original is read: decided by its name first (source code is captured as plain text, so only the
// extension says it is Java) and by its media type for everything a name cannot settle.

/** The viewer an original is read in. */
export type ReadingKind = "markdown" | "code" | "text" | "pdf" | "book" | "image" | "audio" | "video" | "none";

export interface ReadingFormat {
  kind: ReadingKind;
  /** For code: the language name the highlighter is asked for; null reads as plain text. */
  language: string | null;
  /** What a reader is told the file is, in words. */
  description: string;
}

/** A language the code reader highlights. A language's own name is a string; a description in words is declared. */
interface CodeLanguage {
  language: string;
  description: string | DeclaredText;
}

function describeCodeLanguage(code: CodeLanguage): string {
  if (typeof code.description === "string") {
    return code.description;
  }
  return translateDeclared(code.description);
}

/** Extensions whose language the code reader highlights, with the name shown for it. */
const CODE_LANGUAGES: Record<string, CodeLanguage> = {
  java: { language: "java", description: "Java" },
  kt: { language: "kotlin", description: "Kotlin" },
  kts: { language: "kotlin", description: declareText("components.readingFormat.kotlinScript", "Kotlin script") },
  scala: { language: "scala", description: "Scala" },
  groovy: { language: "groovy", description: "Groovy" },
  gradle: { language: "groovy", description: declareText("components.readingFormat.gradleBuild", "Gradle build") },
  ts: { language: "typescript", description: "TypeScript" },
  tsx: { language: "tsx", description: declareText("components.readingFormat.typeScriptWithJsx", "TypeScript with JSX") },
  js: { language: "javascript", description: "JavaScript" },
  jsx: { language: "jsx", description: declareText("components.readingFormat.javaScriptWithJsx", "JavaScript with JSX") },
  mjs: { language: "javascript", description: declareText("components.readingFormat.javaScriptModule", "JavaScript module") },
  cjs: { language: "javascript", description: declareText("components.readingFormat.javaScriptModule", "JavaScript module") },
  py: { language: "python", description: "Python" },
  go: { language: "go", description: "Go" },
  rs: { language: "rust", description: "Rust" },
  c: { language: "c", description: "C" },
  h: { language: "c", description: declareText("components.readingFormat.cHeader", "C header") },
  cpp: { language: "cpp", description: "C++" },
  cc: { language: "cpp", description: "C++" },
  cxx: { language: "cpp", description: "C++" },
  hpp: { language: "cpp", description: declareText("components.readingFormat.cppHeader", "C++ header") },
  cs: { language: "csharp", description: "C#" },
  rb: { language: "ruby", description: "Ruby" },
  php: { language: "php", description: "PHP" },
  swift: { language: "swift", description: "Swift" },
  sql: { language: "sql", description: "SQL" },
  sh: { language: "shell", description: declareText("components.readingFormat.shellScript", "Shell script") },
  bash: { language: "shell", description: declareText("components.readingFormat.shellScript", "Shell script") },
  zsh: { language: "shell", description: declareText("components.readingFormat.shellScript", "Shell script") },
  ps1: { language: "powershell", description: "PowerShell" },
  bat: { language: "shell", description: declareText("components.readingFormat.batchScript", "Batch script") },
  json: { language: "json", description: "JSON" },
  yaml: { language: "yaml", description: "YAML" },
  yml: { language: "yaml", description: "YAML" },
  toml: { language: "toml", description: "TOML" },
  xml: { language: "xml", description: "XML" },
  html: { language: "html", description: declareText("components.readingFormat.htmlSource", "HTML source") },
  htm: { language: "html", description: declareText("components.readingFormat.htmlSource", "HTML source") },
  svg: { language: "xml", description: declareText("components.readingFormat.svgSource", "SVG source") },
  css: { language: "css", description: "CSS" },
  properties: { language: "properties", description: declareText("components.readingFormat.properties", "Properties") },
  ini: { language: "properties", description: declareText("components.readingFormat.iniSettings", "INI settings") },
  dockerfile: { language: "dockerfile", description: "Dockerfile" },
  lua: { language: "lua", description: "Lua" },
  s: { language: "assembly", description: declareText("components.readingFormat.assembly", "Assembly") },
  asm: { language: "assembly", description: declareText("components.readingFormat.assembly", "Assembly") },
  cmake: { language: "cmake", description: "CMake" },
  diff: { language: "diff", description: "Diff" },
  patch: { language: "diff", description: "Patch" },
  jms: { language: "jms", description: declareText("components.readingFormat.jmouseScript", "jMouse script") },
  jmp: { language: "jmp", description: declareText("components.readingFormat.jmousePolicy", "jMouse policy") },
};

/** Names with no extension that are still a known language. */
const CODE_FILE_NAMES: Record<string, CodeLanguage> = {
  dockerfile: { language: "dockerfile", description: "Dockerfile" },
  makefile: { language: "shell", description: "Makefile" },
  "cmakelists.txt": { language: "cmake", description: "CMake" },
};

/** Text with no language worth colouring, read with line numbers. */
const PLAIN_TEXT_EXTENSIONS = new Set(["txt", "text", "log", "csv", "tsv", "adoc", "asciidoc", "rst", "org", "lds", "ld", "gitignore", "dockerignore", "license"]);

const SHOWN_IMAGES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"]);

/** Media types outside `text/*` that are text all the same. */
const TEXT_MEDIA_TYPES = new Set(["application/json", "application/xml", "application/yaml", "application/toml", "application/xhtml+xml"]);

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot < 0) {
    return name.toLowerCase();
  }
  return name.slice(dot + 1).toLowerCase();
}

/** The viewer and the language for one original, from its file name and the type it is shown as. */
export function readingFormatOf(name: string, mediaType: string): ReadingFormat {
  const type = mediaType.split(";")[0]?.trim().toLowerCase() ?? "";
  const lowerName = name.toLowerCase();
  const extension = extensionOf(name);

  if (type === "text/markdown" || extension === "md" || extension === "markdown") {
    return { kind: "markdown", language: null, description: "Markdown" };
  }
  if (type === "application/pdf") {
    return { kind: "pdf", language: null, description: "PDF" };
  }
  // EPUB and FictionBook are formats' own names and read the same in every language.
  if (type === "application/epub+zip" || extension === "epub") {
    return { kind: "book", language: null, description: "EPUB" };
  }
  if (type === "application/x-fictionbook+xml" || extension === "fb2") {
    return { kind: "book", language: null, description: "FictionBook" };
  }
  if (SHOWN_IMAGES.has(type)) {
    return { kind: "image", language: null, description: type === "image/svg+xml" ? translate("reader.format.svgImage", "SVG image") : translate("reader.format.image", "Image") };
  }
  if (type.startsWith("audio/")) {
    return { kind: "audio", language: null, description: translate("reader.format.audio", "Audio") };
  }
  if (type.startsWith("video/")) {
    return { kind: "video", language: null, description: translate("reader.format.video", "Video") };
  }
  const namedCode = CODE_FILE_NAMES[lowerName] ?? CODE_LANGUAGES[extension];
  const readableAsText = type.startsWith("text/") || TEXT_MEDIA_TYPES.has(type) || PLAIN_TEXT_EXTENSIONS.has(extension);
  if (namedCode !== undefined && (readableAsText || type === "application/octet-stream" || type === "")) {
    return { kind: "code", language: namedCode.language, description: describeCodeLanguage(namedCode) };
  }
  if (readableAsText) {
    return { kind: "text", language: null, description: translate("reader.format.plainText", "Plain text") };
  }
  return { kind: "none", language: null, description: type || translate("reader.format.unknown", "Unknown type") };
}

/** Whether a reading kind is read from the original's text rather than shown from its bytes. */
export function isReadAsText(kind: ReadingKind): boolean {
  return kind === "markdown" || kind === "code" || kind === "text";
}

/** A range of lines to bring into view and mark, from a citation; both ends inclusive and 1-based. */
export interface LineRange {
  start: number;
  end: number;
}

/** Reads `12-30` or `12` from an address; anything else is no range. */
export function parseLineRange(value: string | undefined): LineRange | null {
  if (value === undefined) {
    return null;
  }
  const match = /^(\d+)(?:-(\d+))?$/.exec(value.trim());
  if (match === null) {
    return null;
  }
  const start = Number(match[1]);
  const end = match[2] === undefined ? start : Number(match[2]);
  if (start < 1 || end < start) {
    return null;
  }
  return { start, end };
}

export function formatLineRange(range: LineRange): string {
  return range.start === range.end ? String(range.start) : `${range.start}-${range.end}`;
}

/** The number of lines in a text, without the empty one after a final line break. */
export function countLines(text: string): number {
  if (text.length === 0) {
    return 0;
  }
  let count = 1;
  for (let index = text.indexOf("\n"); index >= 0; index = text.indexOf("\n", index + 1)) {
    count++;
  }
  return text.endsWith("\n") ? count - 1 : count;
}
