import { createElement, type ReactNode } from "react";
import { anchorOf, resolve } from "./bookContainers";

/** The elements a book's markup may become; anything else is read through to its children. */
const ALLOWED = new Set([
  "p", "div", "section", "article", "h1", "h2", "h3", "h4", "h5", "h6", "em", "i", "strong", "b", "u", "s", "sub", "sup", "small",
  "br", "hr", "blockquote", "ul", "ol", "li", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "pre", "code", "figure",
  "figcaption", "dl", "dt", "dd", "span", "img", "a",
]);

/** Elements whose content is never shown: styling, scripts, metadata. */
const DROPPED = new Set(["head", "script", "style", "link", "meta", "title", "template", "iframe", "object", "embed", "form", "input", "button", "nav"]);

/** The classes a book's markup may keep: the ones the reader styles. Everything a publisher named for its own CSS is left behind. */
const KEPT_CLASSES = new Set(["epigraph", "poem", "stanza", "text-author", "subtitle", "title", "empty-line", "note-reference"]);

export interface BookMarkupContext {
  /** Where the chapter's references resolve from. */
  base: string;
  /** Whether the chapter is an EPUB's, whose element ids are unique only within their document. */
  scopedAnchors: boolean;
  /** The document the chapter came from, for its anchors. */
  path: string;
  pictures: Map<string, string>;
  /** Follows a link inside the book. */
  onFollow: (anchor: string) => void;
}

/**
 * A chapter's markup as React elements, through an allow-list: known tags only, no attributes but an image's address and
 * its alternative text, an element's id and the few classes the reader styles. A link inside the book is followed by the
 * reader; a link out of it opens in a new tab and carries nothing of this page.
 */
export function renderBookMarkup(parent: Element, context: BookMarkupContext): ReactNode[] {
  return Array.from(parent.childNodes).map((node, index) => renderNode(node, context, index));
}

function renderNode(node: Node, context: BookMarkupContext, key: number): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.replace(/­/g, "") ?? "";
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }
  const element = node as Element;
  const tag = element.localName.toLowerCase();
  if (DROPPED.has(tag)) {
    return null;
  }
  if (tag === "svg") {
    // An SVG in a book is almost always a wrapper round one picture — a cover — and is read as that picture.
    const picture = Array.from(element.getElementsByTagNameNS("*", "image"))[0];
    return picture === undefined ? null : renderPicture(hrefOf(picture), "", context, key);
  }
  if (tag === "image") {
    return renderPicture(hrefOf(element), element.getAttribute("alt") ?? element.getAttribute("title") ?? "", context, key);
  }
  const children = renderBookMarkup(element, context);
  if (!ALLOWED.has(tag)) {
    return <span key={key}>{children}</span>;
  }
  if (tag === "img") {
    return renderPicture(element.getAttribute("src") ?? "", element.getAttribute("alt") ?? "", context, key);
  }
  const properties: Record<string, unknown> = { key };
  const identifier = element.getAttribute("id");
  if (identifier !== null && identifier !== "") {
    properties.id = domIdOf(context.scopedAnchors ? anchorOf(context.path, identifier) : identifier);
  }
  const classes = (element.getAttribute("class") ?? "").split(/\s+/).filter((name) => KEPT_CLASSES.has(name));
  if (classes.length > 0) {
    properties.className = classes.map((name) => `book-${name}`).join(" ");
  }
  if (tag === "a") {
    return renderLink(element, children, properties, context);
  }
  if (tag === "td" || tag === "th") {
    const span = Number(element.getAttribute("colspan"));
    if (Number.isInteger(span) && span > 1 && span < 100) {
      properties.colSpan = span;
    }
  }
  if (tag === "br" || tag === "hr") {
    return createElement(tag, properties);
  }
  return createElement(tag, properties, ...children);
}

function renderPicture(reference: string, alternative: string, context: BookMarkupContext, key: number): ReactNode {
  const address = context.pictures.get(context.scopedAnchors ? resolve(context.base, reference) : reference.replace(/^#/, ""));
  if (address === undefined) {
    return null;
  }
  return <img key={key} src={address} alt={alternative} loading="lazy" className="book-picture" />;
}

function renderLink(element: Element, children: ReactNode[], properties: Record<string, unknown>, context: BookMarkupContext): ReactNode {
  const href = hrefOf(element);
  if (/^https?:\/\//i.test(href)) {
    return (
      <a {...properties} href={href} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    );
  }
  if (href === "") {
    return <span {...properties}>{children}</span>;
  }
  const anchor = targetOf(href, context);
  return (
    <a
      {...properties}
      href={`#${domIdOf(anchor)}`}
      onClick={(event) => {
        event.preventDefault();
        context.onFollow(anchor);
      }}
    >
      {children}
    </a>
  );
}

/** Where a link inside the book points, as the book's anchors are keyed. */
function targetOf(href: string, context: BookMarkupContext): string {
  if (!context.scopedAnchors) {
    return href.replace(/^#/, "");
  }
  const [path, fragment] = href.split("#");
  const document = path === undefined || path === "" ? context.path : resolve(context.base, path);
  return fragment === undefined || fragment === "" ? document : anchorOf(document, fragment);
}

function hrefOf(element: Element): string {
  for (const attribute of Array.from(element.attributes)) {
    if (attribute.localName === "href") {
      return attribute.value;
    }
  }
  return "";
}

/** An anchor as an element id on this page: prefixed, so a book's ids can never collide with the application's. */
export function domIdOf(anchor: string): string {
  return `book-${anchor.replace(/[^\w-]/g, "_")}`;
}
