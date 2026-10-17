import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { pipelineApi, type Figure, type IndexGeneration } from "../../../lib/pipeline";
import { useTranslation } from "../../../translations/TranslationProvider";
import { Notice, ProblemState, Waiting } from "../../../ui/components";
import { Button } from "../../../ui/primitives";
import { droppedBlockIndexes, useParsedOriginal } from "./parsedOriginal";
import type { ReadingViewProperties } from "./readingViews";
import { rebuildDocument, type RebuiltCell, type RebuiltList, type RebuiltNode, type RebuiltTable } from "./rebuiltDocument";

/*
 * The rebuilt document: a dense reading column on the reader's surface. Type carries the hierarchy;
 * rules mark pages; tables and figures take the column's full width. Colours are the interface's
 * tokens, so both themes follow.
 */

const FRAME = [
  "min-w-0 rounded-control border border-line bg-surface",
  "[padding:var(--space-5)_var(--space-6)] max-[640px]:p-3",
].join(" ");

const DOCUMENT = [
  "[display:flow-root] max-w-[96ch] min-w-0 text-base leading-[1.6] text-ink",
  "[overflow-wrap:anywhere]",
].join(" ");

const IDENTITY = [
  "mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b-2 border-b-ink pb-3",
].join(" ");

const PART = "font-heading text-xl font-bold tracking-[-0.01em]";

const DESCRIPTION = "text-md text-secondary";

const MAKER =
  "ml-auto text-xs text-muted [font-variant-numeric:tabular-nums] max-[640px]:ml-0";

/*
 * ── Pages ────────────────────────────────────────────────────────────────────────────────────
 *
 * A rule with the page number, the citation back into the original beside it. ⚠️ The rule is the
 * `after` pseudo-element and the three parts are ORDERED rather than laid out in source order: the
 * number, then the rule filling the line, then the link at the end.
 */
const PAGE_RULE = [
  "mx-0 mt-6 mb-3 flex items-center gap-2 text-2xs tracking-[0.06em] text-muted uppercase",
  "first-of-type:mt-0",
  'after:order-1 after:flex-[1_1_auto] after:border-t after:border-line after:content-[""]',
].join(" ");

const PAGE_NUMBER = "font-semibold";

/* The citation into the original: a link, in ordinary case and tracking, whatever band it sits in. */
const PAGE_LINK = [
  "order-2 cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-xs text-accent-text",
  "tracking-normal normal-case underline [text-decoration-color:var(--line-strong)]",
  "[text-underline-offset:2px] hover:[text-decoration-color:currentColor]",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text",
].join(" ");

/* ── Text ───────────────────────────────────────────────────────────────────────────────────── */

/*
 * ⚠️ THE SIZE IS CHOSEN BY THE CALLER, from the level it is rendering — `h2.heading` and
 * `h3.heading` were element-plus-class selectors, and a utility cannot read the element it is on.
 * `target:` is the deep-link highlight: a citation lands on a heading and the heading says so.
 */
const HEADING = [
  "mx-0 mt-4 mb-2 font-heading leading-[1.3] scroll-mt-8",
  "target:bg-accent-soft",
].join(" ");

const HEADING_SIZE: Record<"h2" | "h3" | "h4" | "h5" | "h6", string> = {
  h2: "text-lg",
  h3: "text-md",
  h4: "text-base",
  h5: "text-base",
  h6: "text-base",
};

const PERMALINK = "ml-2 font-normal text-muted no-underline hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text";

const PARAGRAPH = "mx-0 mt-0 mb-3 target:bg-accent-soft";

const CAPTION = "mx-0 mt-3 mb-2 text-sm font-semibold text-secondary";

const QUOTE = "mx-0 mt-0 mb-3 border-l-[3px] border-l-line-strong px-4 py-1 text-secondary";

const CODE = [
  "mx-0 mt-0 mb-3 overflow-x-auto rounded-control border border-line bg-well px-3 py-2",
  "font-mono text-xs leading-[1.6] whitespace-pre",
].join(" ");

/*
 * ⚠️ A LIST STYLES ITS OWN NESTED LISTS. `.list .list` was a descendant rule; here the outer list
 * tightens any `ul`/`ol` inside it and gives an inner unordered one the hollow marker, which is what
 * tells two levels apart when both are bullets.
 */
const LIST = [
  "mx-0 mt-0 mb-3 pl-6",
  "[&_li+li]:mt-1 [&_li]:target:bg-accent-soft",
  "[&_ul]:mx-0 [&_ul]:mt-1 [&_ul]:mb-0 [&_ol]:mx-0 [&_ol]:mt-1 [&_ol]:mb-0",
  "[&_ul]:[list-style-type:circle]",
].join(" ");

/* The table of contents: two columns while there is room for two. */
const CONTENTS = [
  "mx-0 mt-0 mb-4 rounded-control border border-line bg-well px-4 py-3 text-sm",
  "[&_ol]:m-0 [&_ol]:list-none [&_ol]:p-0 [&_ol]:[columns:2_22ch] [&_ol]:[column-gap:var(--space-6)]",
  "[&_li]:py-[1px] [&_li]:[break-inside:avoid]",
  "max-[640px]:[&_ol]:[columns:1]",
].join(" ");

/* ── Tables ─────────────────────────────────────────────────────────────────────────────────── */

const TABLE_FRAME = "mx-0 mt-0 mb-4 overflow-x-auto";

/*
 * ⚠️ `overflow-wrap: normal` IS DELIBERATE AND LOCAL. The reading column breaks anywhere, because a
 * captured path is one long word; a table must not — a narrow screen scrolls it sideways rather than
 * breaking «Analog» into «Ana log».
 */
const TABLE_SHARED = [
  "w-full border-collapse [overflow-wrap:normal] leading-[1.45]",
  "[font-variant-numeric:tabular-nums]",
  "[&_th]:border [&_th]:border-line [&_th]:px-2 [&_th]:py-[3px] [&_th]:text-left [&_th]:align-top",
  "[&_td]:border [&_td]:border-line [&_td]:px-2 [&_td]:py-[3px] [&_td]:text-left [&_td]:align-top",
  "[&_th]:bg-well [&_th]:text-xs [&_th]:font-semibold [&_th]:text-secondary",
  "[&_tr]:target:bg-accent-soft",
].join(" ");

const TABLE = `${TABLE_SHARED} text-sm`;

/* A table inside a cell: the same rules, a step smaller and pulled tight. */
const INNER_TABLE = `${TABLE_SHARED} my-[2px] text-xs`;

/* ⚠️ A CAPTION MUST STAY A TABLE CAPTION to sit above the table, so its parts are laid out INSIDE
   it rather than by making the caption itself a flex row. */
const TABLE_CAPTION = [
  "[caption-side:top] pb-1 text-left text-sm font-semibold text-secondary",
  "[&_button]:ml-auto [&_button]:font-normal",
].join(" ");

const TABLE_CAPTION_LINE = "flex items-baseline gap-3";

/* Values filled down from a merged cell read quieter than one of their own, and several values in one
   cell are separated by a mark rather than by a space nobody typed. */
const CELL_VALUE = "not-first:before:text-muted not-first:before:content-['_›_']";

const FILLED_VALUE = `${CELL_VALUE} text-muted italic`;

/* ── Figures ────────────────────────────────────────────────────────────────────────────────── */

/* ⚠️ The drawing is a piece of the page, printed black on white: it stays on paper in the dark theme
   too, which is why the two figure colours are literals rather than tokens. */
const FIGURE = [
  "my-4 scroll-mt-8 target:bg-accent-soft",
  "[--figure-paper:#ffffff] [--figure-ink:#536170]",
].join(" ");

const FIGURE_STAGE = [
  "grid w-full place-items-center overflow-hidden rounded-control border border-line",
  "bg-(--figure-paper)",
  "[&_img]:block [&_img]:h-full [&_img]:w-full [&_img]:object-contain",
].join(" ");

const FIGURE_PENDING = "p-4 text-xs text-(--figure-ink)";

const FIGURE_CAPTION = [
  "mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-secondary",
  "[&_button]:ml-auto",
].join(" ");

const FIGURE_NUMBER = "font-semibold text-ink";

/* The labels a drawing is indexed by, closed by default: a reference, not part of the reading. */
const LABELS = [
  "mt-1 text-xs",
  "[&_summary]:w-fit [&_summary]:cursor-pointer [&_summary]:text-muted",
  "[&_summary:focus-visible]:outline-2 [&_summary:focus-visible]:outline-offset-2",
  "[&_summary:focus-visible]:outline-accent-text",
  "[&_ul]:mx-0 [&_ul]:mt-2 [&_ul]:mb-0 [&_ul]:flex [&_ul]:list-none [&_ul]:flex-wrap [&_ul]:gap-1 [&_ul]:p-0",
  "[&_li]:rounded-[3px] [&_li]:border [&_li]:border-line [&_li]:bg-well [&_li]:px-2 [&_li]:py-[1px]",
  "[&_li]:font-mono",
].join(" ");

const MORE_ROW = "mt-6 flex justify-center";

/** Pages drawn at once; a long manual is drawn on as the reader asks, not all in one go. */
const PAGES_SHOWN = 24;

/**
 * A PDF rebuilt as a clean document from what the parser understood and the content pipeline kept: headings, paragraphs,
 * lists, tables with their header and merged cells filled down — a table drawn inside a cell nested in it — and figures
 * with the image of the drawing and the labels found on it. Every element is drawn from the block model; nothing of the
 * original is injected as markup. Page markers open the original at that page.
 */
export function RebuiltView({ workspaceId, documentId, generation, onShowPage }: ReadingViewProperties) {
  const { t } = useTranslation();
  const parsed = useParsedOriginal(workspaceId, documentId, generation);
  const [pagesShown, setPagesShown] = useState(PAGES_SHOWN);

  const nodes = useMemo(
    () => (parsed.status === "ready" ? rebuildDocument(parsed.data.document, droppedBlockIndexes(parsed.data.outcome)) : []),
    [parsed],
  );

  if (parsed.status === "loading") {
    return <Waiting label={t("documents.rebuilt.loading", "Rebuilding the document from its parse")} lines={8} />;
  }
  if (parsed.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={parsed.problem}
        actions={
          <Button icon="refresh" onClick={parsed.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }
  if (nodes.length === 0) {
    return (
      <Notice title={t("documents.rebuilt.empty", "Nothing to rebuild")}>
        {t("documents.rebuilt.emptyDescription", "The parse kept no text: the original may be scanned, or the pipeline dropped everything.")}
      </Notice>
    );
  }

  const identity = parsed.data.document.identity;
  const pageCount = nodes.filter((node) => node.kind === "page").length;
  const shown = cutAtPage(nodes, pagesShown);
  return (
    <div className={FRAME}>
      <article className={DOCUMENT} aria-label={t("documents.rebuilt.label", "Rebuilt document")}>
        {identity !== undefined && identity !== null && (identity.part !== null || identity.description !== null) && (
          <header className={IDENTITY}>
            {identity.part !== null && <span className={PART}>{identity.part}</span>}
            {identity.description !== null && <span className={DESCRIPTION}>{identity.description}</span>}
            {(identity.manufacturer !== null || identity.revision !== null) && (
              <span className={MAKER}>{[identity.manufacturer, identity.revision].filter((part) => part !== null).join(" · ")}</span>
            )}
          </header>
        )}
        {renderNodes(shown, { workspaceId, documentId, generation, onShowPage })}
        {shown.length < nodes.length && (
          <div className={MORE_ROW}>
            <Button onClick={() => setPagesShown((current) => current + PAGES_SHOWN)}>
              {t("documents.rebuilt.showMore", "Show the next {count} pages", { count: Math.min(PAGES_SHOWN, pageCount - pagesShown) })}
            </Button>
          </div>
        )}
      </article>
    </div>
  );
}

interface DrawContext {
  workspaceId: string;
  documentId: string;
  generation: IndexGeneration;
  onShowPage: (page: number) => void;
}

/** The nodes up to the start of a page past the limit. */
function cutAtPage(nodes: RebuiltNode[], pages: number): RebuiltNode[] {
  let seen = 0;
  for (let position = 0; position < nodes.length; position++) {
    if (nodes[position]?.kind === "page") {
      seen++;
      if (seen > pages) {
        return nodes.slice(0, position);
      }
    }
  }
  return nodes;
}

const anchorOf = (index: number) => `block-${index}`;

function renderNodes(nodes: RebuiltNode[], context: DrawContext): ReactNode[] {
  return nodes.map((node) => {
    switch (node.kind) {
      case "page":
        return <PageMarker key={`page-${node.page}`} page={node.page} onShowPage={context.onShowPage} />;
      case "heading":
        return <Heading key={node.index} level={node.level} index={node.index} text={node.text} />;
      case "paragraph":
        return (
          <p key={node.index} id={anchorOf(node.index)} className={PARAGRAPH}>
            {node.text}
          </p>
        );
      case "caption":
        return (
          <p key={node.index} id={anchorOf(node.index)} className={CAPTION}>
            {node.text}
          </p>
        );
      case "quote":
        return (
          <blockquote key={node.index} id={anchorOf(node.index)} className={QUOTE}>
            {node.text}
          </blockquote>
        );
      case "code":
        return (
          <pre key={node.index} id={anchorOf(node.index)} className={CODE}>
            {node.text}
          </pre>
        );
      case "list":
        return <RebuiltListView key={node.index} list={node} />;
      case "contents":
        return <Contents key={node.index} index={node.index} items={node.items.map((item) => item.text)} />;
      case "table":
        return <RebuiltTableView key={node.index} index={node.index} table={node.table} onShowPage={context.onShowPage} />;
      case "figure":
        return <FigureView key={node.index} index={node.index} figure={node.figure} context={context} />;
    }
  });
}

function PageMarker({ page, onShowPage }: { page: number; onShowPage: (page: number) => void }) {
  const { t } = useTranslation();
  return (
    <div className={PAGE_RULE} id={`page-${page}`}>
      <span className={`${PAGE_NUMBER} numeric`}>{t("documents.rebuilt.page", "Page {page}", { page })}</span>
      <button type="button" className={PAGE_LINK} onClick={() => onShowPage(page)}>
        {t("documents.rebuilt.openPage", "Open in the original")}
      </button>
    </div>
  );
}

/** A heading one level below the page's own: the document's first level is an h2. */
function Heading({ level, index, text }: { level: number; index: number; text: string }) {
  const { t } = useTranslation();
  const Tag = `h${Math.min(6, level + 1)}` as "h2" | "h3" | "h4" | "h5" | "h6";
  return (
    <Tag id={anchorOf(index)} className={`${HEADING} ${HEADING_SIZE[Tag]}`}>
      {text}
      <a className={PERMALINK} href={`#${anchorOf(index)}`} aria-label={t("documents.rebuilt.linkTo", "Link to {heading}", { heading: text })}>
        #
      </a>
    </Tag>
  );
}

/** A list and the lists nested under its items, `<ul>` or `<ol>` by how its items are marked. */
function RebuiltListView({ list }: { list: RebuiltList }) {
  const items = list.items.map((item) => (
    <li key={item.index} id={anchorOf(item.index)}>
      {item.text}
      {item.children?.map((child) => <RebuiltListView key={child.index} list={child} />)}
    </li>
  ));
  return list.ordered ? <ol className={LIST}>{items}</ol> : <ul className={LIST}>{items}</ul>;
}

function Contents({ index, items }: { index: number; items: string[] }) {
  const { t } = useTranslation();
  return (
    <nav id={anchorOf(index)} className={CONTENTS} aria-label={t("documents.rebuilt.contents", "Contents")}>
      <ol>
        {items.map((item, position) => (
          <li key={position}>{item}</li>
        ))}
      </ol>
    </nav>
  );
}

function RebuiltTableView({ index, table, onShowPage }: { index: number; table: RebuiltTable; onShowPage: (page: number) => void }) {
  const { t } = useTranslation();
  const columnCount = Math.max(1, table.columns.length, ...table.rows.map((row) => row.cells.reduce((sum, cell) => sum + cell.span, 0)));
  return (
    <div id={anchorOf(index)} className={TABLE_FRAME}>
      <table className={TABLE}>
        {(table.title !== null || table.page > 0) && (
          <caption className={TABLE_CAPTION}>
            <span className={TABLE_CAPTION_LINE}>
              {table.title !== null && <span>{table.title}</span>}
              {table.page > 0 && (
                <button type="button" className={PAGE_LINK} onClick={() => onShowPage(table.page)}>
                  {t("documents.rebuilt.pageShort", "p. {page}", { page: table.page })}
                </button>
              )}
            </span>
          </caption>
        )}
        {table.columns.length > 0 && (
          <thead>
            <tr>
              {table.columns.map((column, position) => (
                <th key={position} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.index} id={anchorOf(row.index)}>
              {row.cells.map((cell, position) => (
                <td key={position} colSpan={cell.span === table.columns.length && table.columns.length > 0 ? columnCount : cell.span}>
                  <CellContent cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A cell's values: a value filled down from a merged cell above is set apart; a table drawn in the cell is nested. */
function CellContent({ cell }: { cell: RebuiltCell }) {
  const { t } = useTranslation();
  return (
    <>
      {cell.values.map((value, position) => {
        if (value.inner !== undefined) {
          return (
            <table key={position} className={INNER_TABLE}>
              {value.inner.header.length > 0 && (
                <thead>
                  <tr>
                    {value.inner.header.map((header, column) => (
                      <th key={column} scope="col">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {value.inner.rows.map((innerRow, rowPosition) => (
                  <tr key={rowPosition}>
                    {innerRow.map((innerValue, column) => (
                      <td key={column}>{innerValue}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }
        if (value.value.trim() === "") {
          return null;
        }
        return value.filledDown ? (
          <span key={position} className={FILLED_VALUE} title={t("documents.rebuilt.filledDown", "Filled down from the merged cell above")}>
            {value.value}
          </span>
        ) : (
          <span key={position} className={CELL_VALUE}>
            {value.value}
          </span>
        );
      })}
    </>
  );
}

/** A figure: the image of the drawing, fetched when it scrolls near, its caption, and the labels found on it. */
function FigureView({ index, figure, context }: { index: number; figure: Figure; context: DrawContext }) {
  const { t, plural } = useTranslation();
  const frame = useRef<HTMLElement>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [near, setNear] = useState(false);
  const { workspaceId, documentId, generation } = context;

  useEffect(() => {
    const element = frame.current;
    if (element === null || near) {
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
        }
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [near]);

  useEffect(() => {
    if (!near || !figure.image) {
      return undefined;
    }
    let cancelled = false;
    let created: string | null = null;
    pipelineApi
      .figureImage(workspaceId, documentId, generation.versionId, generation.jobId, figure.number)
      .then((blob) => {
        if (!cancelled) {
          created = URL.createObjectURL(blob);
          setAddress(created);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
      if (created !== null) {
        URL.revokeObjectURL(created);
      }
    };
  }, [near, figure.image, figure.number, workspaceId, documentId, generation.versionId, generation.jobId]);

  const width = Math.max(1, figure.bounds.right - figure.bounds.left);
  const height = Math.max(1, figure.bounds.bottom - figure.bounds.top);
  const caption = figure.caption ?? t("documents.rebuilt.figureOnPage", "Figure on page {page}", { page: figure.page });
  return (
    <figure ref={frame} id={anchorOf(index)} className={FIGURE}>
      <div className={FIGURE_STAGE} style={{ aspectRatio: `${width} / ${height}`, maxWidth: `${Math.min(width * 1.4, 960)}px` }}>
        {address !== null ? (
          <img src={address} alt={caption} />
        ) : (
          <span className={FIGURE_PENDING}>
            {failed || !figure.image ? t("documents.rebuilt.figureNoImage", "No image was drawn for this figure") : t("documents.rebuilt.figureLoading", "Loading the figure…")}
          </span>
        )}
      </div>
      <figcaption className={FIGURE_CAPTION}>
        <span className={FIGURE_NUMBER}>{t("documents.rebuilt.figureNumber", "Figure {number}", { number: figure.number })}</span>
        <span>{caption}</span>
        <button type="button" className={PAGE_LINK} onClick={() => context.onShowPage(figure.page)}>
          {t("documents.rebuilt.pageShort", "p. {page}", { page: figure.page })}
        </button>
      </figcaption>
      {figure.labels.length > 0 && (
        <details className={LABELS}>
          <summary>
            {plural("documents.rebuilt.figureLabels", figure.labels.length, {
              one: "{count} label indexed as the figure's keywords",
              other: "{count} labels indexed as the figure's keywords",
            })}
          </summary>
          <ul>
            {figure.labels.map((label, position) => (
              <li key={position}>{label}</li>
            ))}
          </ul>
        </details>
      )}
    </figure>
  );
}
