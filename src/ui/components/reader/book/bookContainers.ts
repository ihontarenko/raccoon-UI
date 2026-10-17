import { unzipSync } from "fflate";

/**
 * A book opened in the browser for reading: its chapters as documents to render one at a time, its table of contents,
 * and its pictures as object URLs. EPUB and FictionBook are opened into this one shape, so the reader knows nothing of
 * either container.
 *
 * ⚠️ The chapters hold the book's own markup, untrusted. Nothing here renders it: `BookMarkup` reads it through an
 * allow-list into React elements, and no string of it ever reaches `innerHTML`.
 */
export interface Book {
  title: string | null;
  authors: string[];
  chapters: BookChapter[];
  contents: ContentsEntry[];
  /** Object URLs of the pictures by their reference — a path in an EPUB, a binary's id in a FictionBook. */
  pictures: Map<string, string>;
  /** Which chapter holds an element id, so a note reference or a contents entry can be followed. */
  anchors: Map<string, number>;
}

export interface BookChapter {
  title: string;
  /** The document it came from inside an EPUB, which its anchors are scoped to; empty in a FictionBook. */
  path: string;
  /** The chapter's content: an element whose children are rendered. */
  body: Element;
  /** Where the chapter's own references resolve from: its directory in an EPUB, nothing in a FictionBook. */
  base: string;
}

export interface ContentsEntry {
  title: string;
  /** One-based depth: a part above its chapters. */
  depth: number;
  chapter: number;
  /** The element it points at, or null for the chapter's start. */
  anchor: string | null;
}

/** What a closed book is opened from. */
export type BookFormat = "epub" | "fb2";

export function bookFormatOf(name: string, mediaType: string): BookFormat | null {
  const lower = name.toLowerCase();
  const type = mediaType.split(";")[0]?.trim().toLowerCase();
  if (lower.endsWith(".epub") || type === "application/epub+zip") {
    return "epub";
  }
  if (lower.endsWith(".fb2") || type === "application/x-fictionbook+xml") {
    return "fb2";
  }
  return null;
}

export function openBook(format: BookFormat, bytes: Uint8Array): Book {
  return format === "epub" ? openEpub(bytes) : openFictionBook(bytes);
}

/** Revokes the pictures' object URLs; a book that is closed holds no memory. */
export function closeBook(book: Book): void {
  for (const address of book.pictures.values()) {
    URL.revokeObjectURL(address);
  }
}

// ── EPUB ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const PICTURE_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
};

function openEpub(bytes: Uint8Array): Book {
  // Fonts are never unpacked: they are the largest files in a book and the reader sets its own type.
  const files = unzipSync(bytes, { filter: (file) => !/\.(otf|ttf|woff2?)$/i.test(file.name) });
  const text = (path: string): string | null => (files[path] === undefined ? null : new TextDecoder("utf-8").decode(files[path]));
  const container = text("META-INF/container.xml");
  const packagePath = container === null ? null : parseXml(container).querySelector("rootfile")?.getAttribute("full-path") ?? null;
  const packageText = packagePath === null ? null : text(packagePath);
  if (packagePath === null || packageText === null) {
    throw new Error("This EPUB has no package document.");
  }
  const opf = parseXml(packageText);
  const base = directoryOf(packagePath);
  const manifest = new Map<string, { path: string; type: string; properties: string[] }>();
  for (const item of Array.from(opf.getElementsByTagNameNS("*", "item"))) {
    manifest.set(item.getAttribute("id") ?? "", {
      path: resolve(base, item.getAttribute("href") ?? ""),
      type: item.getAttribute("media-type") ?? "",
      properties: (item.getAttribute("properties") ?? "").split(/\s+/),
    });
  }

  const pictures = new Map<string, string>();
  for (const [path, content] of Object.entries(files)) {
    const type = PICTURE_TYPES[extensionOf(path)];
    if (type !== undefined) {
      pictures.set(path, URL.createObjectURL(new Blob([content as BlobPart], { type })));
    }
  }

  const chapters: BookChapter[] = [];
  const anchors = new Map<string, number>();
  const chapterOfPath = new Map<string, number>();
  for (const reference of Array.from(opf.getElementsByTagNameNS("*", "itemref"))) {
    const item = manifest.get(reference.getAttribute("idref") ?? "");
    if (item === undefined || item.properties.includes("nav")) {
      continue;
    }
    const markup = text(item.path);
    if (markup === null) {
      continue;
    }
    const document = parseMarkup(markup);
    const body = document.querySelector("body") ?? document.documentElement;
    const index = chapters.length;
    chapterOfPath.set(item.path, index);
    anchors.set(item.path, index);
    for (const identified of Array.from(body.querySelectorAll("[id]"))) {
      anchors.set(anchorOf(item.path, identified.getAttribute("id") ?? ""), index);
    }
    chapters.push({ title: firstHeading(body) ?? "", path: item.path, body, base: directoryOf(item.path) });
  }

  const contents = epubContents(opf, manifest, text, chapterOfPath);
  // A chapter is called by the first contents entry that opens it, else by its own first heading.
  for (const entry of contents) {
    const chapter = chapters[entry.chapter];
    if (chapter !== undefined && entry.anchor === null && chapter.title === "") {
      chapter.title = entry.title;
    }
  }
  for (const entry of contents) {
    const chapter = chapters[entry.chapter];
    if (chapter !== undefined && chapter.title === "") {
      chapter.title = entry.title;
    }
  }

  const metadata = opf.getElementsByTagNameNS("*", "metadata")[0];
  const read = (name: string) => Array.from(metadata?.getElementsByTagNameNS("*", name) ?? []).map((element) => clean(element.textContent));
  return { title: read("title")[0] || null, authors: read("creator").filter((author) => author !== ""), chapters, contents, pictures, anchors };
}

function epubContents(
  opf: Document,
  manifest: Map<string, { path: string; type: string; properties: string[] }>,
  text: (path: string) => string | null,
  chapterOfPath: Map<string, number>,
): ContentsEntry[] {
  const entries: ContentsEntry[] = [];
  const add = (base: string, href: string, title: string, depth: number) => {
    const [path, anchor] = href.split("#");
    const chapter = chapterOfPath.get(resolve(base, path ?? ""));
    if (chapter !== undefined && clean(title) !== "") {
      entries.push({ title: clean(title), depth, chapter, anchor: anchor === undefined || anchor === "" ? null : anchorOf(resolve(base, path ?? ""), anchor) });
    }
  };
  const navigation = Array.from(manifest.values()).find((item) => item.properties.includes("nav"));
  const navigationText = navigation === undefined ? null : text(navigation.path);
  if (navigation !== undefined && navigationText !== null) {
    const document = parseMarkup(navigationText);
    const toc = Array.from(document.getElementsByTagName("nav")).find((nav) => (nav.getAttribute("epub:type") ?? "").includes("toc")) ?? document.querySelector("nav");
    const walk = (list: Element, depth: number) => {
      for (const item of Array.from(list.children).filter((child) => child.localName === "li")) {
        const link = Array.from(item.children).find((child) => child.localName === "a");
        if (link !== undefined) {
          add(directoryOf(navigation.path), link.getAttribute("href") ?? "", link.textContent ?? "", depth);
        }
        for (const nested of Array.from(item.children).filter((child) => child.localName === "ol")) {
          walk(nested, depth + 1);
        }
      }
    };
    const top = toc === null || toc === undefined ? null : Array.from(toc.children).find((child) => child.localName === "ol");
    if (top !== undefined && top !== null) {
      walk(top, 1);
    }
  }
  if (entries.length === 0) {
    const spine = opf.getElementsByTagNameNS("*", "spine")[0];
    const ncx = manifest.get(spine?.getAttribute("toc") ?? "") ?? Array.from(manifest.values()).find((item) => item.type === "application/x-dtbncx+xml");
    const ncxText = ncx === undefined ? null : text(ncx.path);
    if (ncx !== undefined && ncxText !== null) {
      const walk = (parent: Element, depth: number) => {
        for (const point of Array.from(parent.children).filter((child) => child.localName === "navPoint")) {
          const label = point.getElementsByTagNameNS("*", "text")[0]?.textContent ?? "";
          const source = Array.from(point.children).find((child) => child.localName === "content")?.getAttribute("src") ?? "";
          add(directoryOf(ncx.path), source, label, depth);
          walk(point, depth + 1);
        }
      };
      const map = parseXml(ncxText).getElementsByTagNameNS("*", "navMap")[0];
      if (map !== undefined) {
        walk(map, 1);
      }
    }
  }
  return entries;
}

// ── FictionBook ───────────────────────────────────────────────────────────────────────────────────────────────────

/** FictionBook elements read as HTML: the reader renders HTML, so a FictionBook is translated once, here. */
const FICTION_BOOK_TAGS: Record<string, string> = {
  p: "p",
  v: "p",
  emphasis: "em",
  strong: "strong",
  strikethrough: "s",
  sub: "sub",
  sup: "sup",
  code: "code",
  cite: "blockquote",
  epigraph: "blockquote",
  poem: "div",
  stanza: "div",
  annotation: "blockquote",
  table: "table",
  tr: "tr",
  td: "td",
  th: "th",
  a: "a",
  section: "section",
};

function openFictionBook(bytes: Uint8Array): Book {
  const declared = /encoding=["']([\w-]+)["']/i.exec(new TextDecoder("ascii").decode(bytes.slice(0, 200)))?.[1] ?? "utf-8";
  let source: string;
  try {
    source = new TextDecoder(declared).decode(bytes);
  } catch {
    source = new TextDecoder("utf-8").decode(bytes);
  }
  const fictionBook = parseXml(source);
  if (fictionBook.getElementsByTagNameNS("*", "FictionBook").length === 0) {
    throw new Error("This is not a FictionBook.");
  }

  const pictures = new Map<string, string>();
  for (const binary of Array.from(fictionBook.getElementsByTagNameNS("*", "binary"))) {
    try {
      const raw = atob((binary.textContent ?? "").replace(/\s+/g, ""));
      const content = new Uint8Array(raw.length);
      for (let index = 0; index < raw.length; index++) {
        content[index] = raw.charCodeAt(index);
      }
      pictures.set(binary.getAttribute("id") ?? "", URL.createObjectURL(new Blob([content], { type: binary.getAttribute("content-type") ?? "image/jpeg" })));
    } catch {
      // A damaged picture is left out; its place reads as nothing.
    }
  }

  const titleInfo = fictionBook.getElementsByTagNameNS("*", "title-info")[0];
  const firstOf = (parent: Element | undefined, name: string) => (parent === undefined ? undefined : Array.from(parent.children).find((child) => child.localName === name));
  const authors = Array.from(titleInfo?.children ?? [])
    .filter((child) => child.localName === "author")
    .map((author) => ["first-name", "middle-name", "last-name"].map((part) => clean(firstOf(author, part)?.textContent)).filter((part) => part !== "").join(" ") || clean(firstOf(author, "nickname")?.textContent))
    .filter((author) => author !== "");
  const title = clean(firstOf(titleInfo, "book-title")?.textContent) || null;

  const html = document.implementation.createHTMLDocument("");
  const chapters: BookChapter[] = [];
  const contents: ContentsEntry[] = [];
  const anchors = new Map<string, number>();
  let sectionCounter = 0;

  /** Translates one FictionBook node into HTML, giving every section an anchor the contents can point at. */
  const translateNode = (node: Node, level: number, chapter: number, depth: number): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      return html.createTextNode(node.textContent ?? "");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }
    const element = node as Element;
    const name = element.localName;
    if (name === "title") {
      const heading = html.createElement(`h${Math.min(6, level)}`);
      heading.textContent = Array.from(element.children).map((part) => clean(part.textContent)).filter((part) => part !== "").join(". ");
      return heading;
    }
    if (name === "subtitle") {
      const heading = html.createElement(`h${Math.min(6, level + 1)}`);
      appendTranslated(heading, element, level, chapter, depth);
      return heading;
    }
    if (name === "empty-line") {
      const spacer = html.createElement("p");
      spacer.setAttribute("class", "empty-line");
      return spacer;
    }
    if (name === "image") {
      const picture = html.createElement("img");
      picture.setAttribute("src", referenceOf(element));
      picture.setAttribute("alt", element.getAttribute("title") ?? element.getAttribute("alt") ?? "");
      return picture;
    }
    if (name === "text-author") {
      const author = html.createElement("p");
      author.setAttribute("class", "text-author");
      appendTranslated(author, element, level, chapter, depth);
      return author;
    }
    if (name === "section") {
      const section = html.createElement("section");
      const anchor = element.getAttribute("id") ?? `section-${++sectionCounter}`;
      section.setAttribute("id", anchor);
      anchors.set(anchor, chapter);
      const sectionTitle = Array.from(element.children).find((child) => child.localName === "title");
      if (sectionTitle !== undefined && depth <= 3) {
        contents.push({ title: Array.from(sectionTitle.children).map((part) => clean(part.textContent)).filter((part) => part !== "").join(". "), depth, chapter, anchor });
      }
      for (const child of Array.from(element.childNodes)) {
        const translated = translateNode(child, level + 1, chapter, depth + 1);
        if (translated !== null) {
          section.appendChild(translated);
        }
      }
      return section;
    }
    const tag = FICTION_BOOK_TAGS[name] ?? "span";
    const translated = html.createElement(tag);
    if (name === "a") {
      translated.setAttribute("href", referenceOf(element, false));
      if (element.getAttribute("type") === "note") {
        translated.setAttribute("class", "note-reference");
      }
    }
    if (name === "epigraph" || name === "poem" || name === "stanza") {
      translated.setAttribute("class", name);
    }
    const identifier = element.getAttribute("id");
    if (identifier !== null) {
      translated.setAttribute("id", identifier);
      anchors.set(identifier, chapter);
    }
    appendTranslated(translated, element, level, chapter, depth);
    return translated;
  };
  const appendTranslated = (target: Element, source: Element, level: number, chapter: number, depth: number) => {
    for (const child of Array.from(source.childNodes)) {
      const translated = translateNode(child, level, chapter, depth);
      if (translated !== null) {
        target.appendChild(translated);
      }
    }
  };

  // Each top section of a body is a chapter; what a body holds before its first section opens it as one more.
  for (const body of Array.from(fictionBook.getElementsByTagNameNS("*", "body"))) {
    const notes = /notes|comments|footnotes/i.test(body.getAttribute("name") ?? "");
    const bodyTitle = Array.from(body.children).find((child) => child.localName === "title");
    const bodyTitleText = bodyTitle === undefined ? "" : Array.from(bodyTitle.children).map((part) => clean(part.textContent)).filter((part) => part !== "").join(". ");
    if (notes) {
      const chapter = chapters.length;
      const container = html.createElement("div");
      for (const child of Array.from(body.childNodes)) {
        const translated = translateNode(child, 2, chapter, 9);
        if (translated !== null) {
          container.appendChild(translated);
        }
      }
      chapters.push({ title: bodyTitleText || "Notes", path: "", body: container, base: "" });
      contents.push({ title: bodyTitleText || "Notes", depth: 1, chapter, anchor: null });
      continue;
    }
    let opening: Element | null = null;
    for (const child of Array.from(body.childNodes)) {
      // A section with no title — a cover, a title page, a dedication — is part of the opening, not a chapter of its own.
      const titled = child.nodeType === Node.ELEMENT_NODE && Array.from((child as Element).children).some((part) => part.localName === "title");
      if (child.nodeType === Node.ELEMENT_NODE && (child as Element).localName === "section" && titled) {
        if (opening !== null && opening.childNodes.length > 0) {
          chapters.push({ title: bodyTitleText || title || "", path: "", body: opening, base: "" });
          opening = null;
        }
        const chapter = chapters.length;
        const container = html.createElement("div");
        const translated = translateNode(child, 2, chapter, 1);
        if (translated !== null) {
          container.appendChild(translated);
        }
        const heading = container.querySelector("h1, h2, h3, h4, h5, h6");
        chapters.push({ title: clean(heading?.textContent) || `${chapter + 1}`, path: "", body: container, base: "" });
        continue;
      }
      if (opening === null) {
        opening = html.createElement("div");
      }
      const translated = translateNode(child, 1, chapters.length, 1);
      if (translated !== null) {
        opening.appendChild(translated);
      }
    }
    if (opening !== null && opening.childNodes.length > 0) {
      chapters.push({ title: bodyTitleText || title || "", path: "", body: opening, base: "" });
    }
  }
  return { title, authors, chapters, contents, pictures, anchors };
}

/** The id an `image` or a link points at, from whichever namespace prefix names its href: `#cover.jpg` → `cover.jpg`. */
function referenceOf(element: Element, stripHash = true): string {
  for (const attribute of Array.from(element.attributes)) {
    if (attribute.localName === "href") {
      return stripHash && attribute.value.startsWith("#") ? attribute.value.slice(1) : attribute.value;
    }
  }
  return "";
}

// ── Shared ────────────────────────────────────────────────────────────────────────────────────────────────────────

function parseXml(source: string): Document {
  return new DOMParser().parseFromString(source, "application/xml");
}

/** XHTML as XML when it is well-formed, as HTML when it is not — a book is often almost XML. */
function parseMarkup(source: string): Document {
  const strict = new DOMParser().parseFromString(source, "application/xhtml+xml");
  if (strict.getElementsByTagName("parsererror").length === 0) {
    return strict;
  }
  return new DOMParser().parseFromString(source, "text/html");
}

function firstHeading(body: Element): string | null {
  const heading = body.querySelector("h1, h2, h3, h4, h5, h6, .title");
  const text = clean(heading?.textContent);
  return text === "" ? null : text;
}

/** An element id inside an EPUB is only unique within its document, so the document is part of the anchor. */
export function anchorOf(path: string, identifier: string): string {
  return `${path}#${identifier}`;
}

export function directoryOf(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash < 0 ? "" : path.slice(0, slash + 1);
}

/** A reference written in a document, as a path inside the archive: `../images/a.jpg` from `OPS/text/` is `OPS/images/a.jpg`. */
export function resolve(base: string, reference: string): string {
  let decoded = reference;
  try {
    decoded = decodeURIComponent(reference);
  } catch {
    // An address that is not percent-encoded correctly is taken as written.
  }
  const parts: string[] = [];
  for (const part of (decoded.startsWith("/") ? decoded.slice(1) : base + decoded).split("/")) {
    if (part === "" || part === ".") {
      continue;
    }
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join("/");
}

function extensionOf(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot < 0 ? "" : path.slice(dot + 1).toLowerCase();
}

/** Text as it is read: soft hyphens gone, whitespace one space. */
function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/[­​‌‍⁠﻿]/g, "").replace(/\s+/g, " ").trim();
}
