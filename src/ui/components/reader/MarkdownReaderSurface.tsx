import { codeHighlightPlugin, gfmPlugin, MarkdownRenderer, type MarkdownPlugin } from "@jmouse/markdown";
import "@jmouse/markdown/styles.css";
import "../code/codeSurface.css";
import { READING_HIGHLIGHTER } from "./codeLanguages";
import { translate } from "../../../translations/translate";

/** Whether a destination leaves the interface — those open in a new tab and never hand the opener over. */
function isExternal(destination: string): boolean {
  return /^(https?:|mailto:)/i.test(destination);
}

/**
 * Links and pictures in a captured document. Raw HTML is never rendered — the renderer has no raw-HTML
 * step — and this decides the two elements that still reach outside the page:
 *
 * - a link to the web opens in a new tab; an in-page anchor stays; a link relative to the original's own
 *   folder names a file of the source, which this page cannot open, so it reads as text with its target;
 * - a picture is never fetched: a relative one would ask this interface for a path it does not serve, and
 *   a remote one would tell a third party the document was read. Its description and address are shown.
 */
const CAPTURED_DOCUMENT_PLUGIN: MarkdownPlugin<unknown> = {
  name: "captured-document",
  prose: {
    components: {
      a: ({ node: _node, href, title, children }) => {
        const destination = href ?? "";
        if (isExternal(destination)) {
          return (
            <a href={destination} title={title} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          );
        }
        if (destination.startsWith("#")) {
          return (
            <a href={destination} title={title}>
              {children}
            </a>
          );
        }
        return (
          <span className="text-secondary underline [text-decoration-style:dotted] [text-underline-offset:2px]" title={destination === "" ? undefined : translate("reader.markdown.relativeLink", "Links to {target} in the source", { target: destination })}>
            {children}
          </span>
        );
      },
      img: ({ node: _node, src, alt }) => {
        const address = typeof src === "string" ? src : "";
        return (
          <span className="inline-grid gap-[2px] rounded-control border border-dashed border-line-strong px-3 py-2 text-sm text-secondary">
            <span>
              {alt !== undefined && alt !== ""
                ? translate("reader.markdown.imageNamed", "Image: {description}", { description: alt })
                : translate("reader.format.image", "Image")}
            </span>
            {address !== "" && <span className="numeric text-xs text-muted">{address}</span>}
          </span>
        );
      },
    },
  },
};

// Built once: the renderer memoises on the list, and a list rebuilt per render would re-parse every time.
const PLUGINS: MarkdownPlugin<unknown>[] = [
  gfmPlugin(),
  codeHighlightPlugin({ highlight: (language, code) => READING_HIGHLIGHTER.highlightFencedCode(language, code) }),
  CAPTURED_DOCUMENT_PLUGIN,
];

/**
 * A Markdown original rendered for reading: CommonMark with tables, task lists and coloured fenced code,
 * through the shared jMouse renderer.
 *
 * Loaded lazily through `MarkdownReader`, so the renderer is fetched only by a page that renders.
 */
export default function MarkdownReaderSurface({ markdown }: { markdown: string }) {
  return <MarkdownRenderer markdown={markdown} plugins={PLUGINS} context={undefined} className="rc-prose" />;
}
