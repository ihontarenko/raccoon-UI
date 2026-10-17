import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useResource } from "../../../application/useResource";
import {
  pipelineApi,
  type ContentOutcome,
  type IndexGeneration,
  type StructuredBlock,
  type StructuredDocument,
} from "../../../lib/pipeline";
import { useTranslation } from "../../../translations/TranslationProvider";
import { EmptyState, ProblemState, TabToolbar, Waiting } from "../../../ui/components";
import { Badge, Button, Checkbox } from "../../../ui/primitives";
import { PairsView } from "./IndexedLine";

/* Parsed text: a dense reading of the original, page by page, each block as what the parser took it
   for. */

const READING = "grid gap-3";

const QUIET = "text-muted";

const STEP_COUNTS = "m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs";

/* A step's count stands apart from its name, so «… contents 1 332» never reads as two numbers. */
const STEP_COUNT = "ml-1 border-l border-l-line-strong px-1 font-semibold text-ink";

/* One page: a header that stays in view while its blocks scroll, under the application's top bar. */
const PAGE_PANEL = "rounded-surface border border-line bg-surface";

const PAGE_HEADER = [
  "sticky top-[calc(52px*var(--ui-scale))] z-1 m-0 border-b border-line px-3 py-1",
  "rounded-t-surface bg-well text-xs font-semibold tracking-[0.02em] text-secondary",
].join(" ");

/* ⚠️ `group-open/run:` IS THE OLD `.droppedRun[open] > .rows` RULE: the rows of a dropped run grow a
   rule above them only once the run is opened. Outside a dropped run there is no `group/run`
   ancestor, so the variant simply never matches. */
const ROWS = "m-0 list-none p-0 group-open/run:border-t group-open/run:border-line";

/* Where it is, what it is, then the block itself. Height follows the content. On a phone the first
   two columns collapse and the block takes the whole width under them. */
const ROW_GRID = [
  "grid grid-cols-[calc(64px*var(--ui-scale))_calc(124px*var(--ui-scale))_minmax(0,1fr)]",
  "items-baseline gap-x-3 gap-y-0 px-3 py-[calc(5px*var(--ui-scale))]",
  "max-[640px]:grid-cols-[auto_minmax(0,1fr)]",
  "max-[640px]:gap-x-2 max-[640px]:gap-y-[calc(2px*var(--ui-scale))]",
].join(" ");

/*
 * ⚠️ `group/row` CARRIES THE DROPPED STATE INTO THE BLOCK. A block a step dropped is struck through
 * and muted whatever kind it is, and the kind is drawn by four different constants below — the state
 * belongs to the row, so the row is the group.
 *
 * `not-first:border-t` is the old four-selector rule (`.row + .row`, `.row + .dropped`, and both the
 * other ways round): the rows list holds nothing but rows and dropped runs, so every one but the
 * first takes a rule above it.
 */
const ROW = `group/row ${ROW_GRID} not-first:border-t not-first:border-line`;

const LINE_NUMBER = "text-2xs whitespace-nowrap text-muted";

const KIND_CELL = "min-w-0";

const BODY_CELL = "min-w-0 max-[640px]:col-span-full";

const DROPPED_INK =
  "group-data-[dropped=true]/row:text-muted group-data-[dropped=true]/row:line-through group-data-[dropped=true]/row:[text-decoration-color:var(--line-strong)]";

const TEXT_BLOCK = `m-0 text-sm leading-[1.5] whitespace-pre-line [overflow-wrap:anywhere] ${DROPPED_INK}`;

const HEADING_BLOCK = [
  "m-0 font-heading leading-[1.3] font-[650] text-ink [overflow-wrap:anywhere]",
  "data-[level=1]:text-lg data-[level=2]:text-md data-[level=3]:text-base data-[level=4]:text-sm",
  DROPPED_INK,
].join(" ");

const TABLE_HEADER_BLOCK = `m-0 text-xs font-semibold text-secondary [overflow-wrap:anywhere] ${DROPPED_INK}`;

const LIST_ITEM_BLOCK = [
  "m-0 flex gap-2 text-sm leading-[1.5] [overflow-wrap:anywhere]",
  "data-[level=2]:ps-6 data-[level=3]:ps-12",
  "data-[level=4]:ps-18 data-[level=5]:ps-18 data-[level=6]:ps-18",
  DROPPED_INK,
].join(" ");

const LIST_MARKER = "min-w-[1.2em] flex-none text-muted [font-variant-numeric:tabular-nums]";

const CODE_BLOCK = "m-0 bg-well p-2 font-mono text-xs whitespace-pre-wrap [overflow-wrap:anywhere]";

const FIGURE = "grid gap-[calc(2px*var(--ui-scale))]";

const FIGURE_LABELS = "m-0 text-xs text-secondary [overflow-wrap:anywhere]";

/* A run one step dropped: one quiet row; its blocks open beneath it, struck through. */
const DROPPED = "bg-well not-first:border-t not-first:border-line";

const DROPPED_RUN = "group/run";

const DROPPED_SUMMARY = [
  "group/summary cursor-pointer list-none [&::-webkit-details-marker]:hidden",
  ROW_GRID,
].join(" ");

const DROPPED_TEXT =
  "min-w-0 text-xs text-secondary [overflow-wrap:anywhere] max-[640px]:col-span-full";

const DISCLOSURE_HINT = [
  "ml-2 text-accent-text underline [text-underline-offset:2px]",
  "group-hover/summary:text-ink",
].join(" ");

/* The two words of the disclosure — "show" and "hide" — swap with the run's own open state. */
const WHEN_OPEN = "hidden group-open/run:inline";

const WHEN_CLOSED = "group-open/run:hidden";

/* Lined up under the block column rather than under the row, so the reason reads as part of what was
   dropped. On a phone there is no such column to line up with. */
const DROPPED_REASON = [
  "m-0 text-2xs text-muted",
  "[padding:0_var(--space-3)_var(--space-1)_calc(var(--space-3)*3+188px*var(--ui-scale))]",
  "max-[640px]:pl-3",
].join(" ");

/** Blocks shown at once, and how many more each «Show more» adds; a long original is paged rather than freezing the page. */
const BLOCKS_SHOWN = 400;

/** Figure labels listed before the rest are counted. */
const FIGURE_LABELS_SHOWN = 12;

type Translate = ReturnType<typeof useTranslation>["t"];
type Plural = ReturnType<typeof useTranslation>["plural"];

interface Parsed {
  document: StructuredDocument;
  outcome: ContentOutcome;
}

/** A dropped block: the step that dropped it, and why. */
interface Drop {
  step: string;
  reason: string;
}

interface Placed {
  block: StructuredBlock;
  index: number;
  drop: Drop | undefined;
}

/** A row of the reading: one kept block, or a run of consecutive blocks one step dropped. */
type Row = { kind: "kept"; placed: Placed } | { kind: "dropped"; step: string; blocks: Placed[] };

interface PageGroup {
  page: number | null;
  rows: Row[];
}

/**
 * The original as the parser understood it, page by page: headings as headings, paragraphs as text, table rows as
 * «Header: value» pairs, list items indented under their marker, figures with their caption and labels. What the
 * profile's content pipeline dropped is off by default; shown, each run one step dropped is one row that opens on its
 * blocks, so a table of contents reads as one line rather than as forty.
 */
export function ParsedTextTab({
  workspaceId,
  documentId,
  generation,
}: {
  workspaceId: string;
  documentId: string;
  generation: IndexGeneration | null;
}) {
  const { t, plural, locale } = useTranslation();
  const parsed = useResource<Parsed | null>(async () => {
    if (generation === null || generation.state === "PURGED") {
      return null;
    }
    const [document, outcome] = await Promise.all([
      pipelineApi.processingResult(workspaceId, documentId, generation.versionId, generation.jobId),
      pipelineApi.contentOutcome(workspaceId, documentId, generation.versionId, generation.jobId),
    ]);
    return { document, outcome };
  }, [workspaceId, documentId, generation?.jobId]);
  const [shown, setShown] = useState(BLOCKS_SHOWN);
  const [showDropped, setShowDropped] = useState(false);

  const drops = useMemo(() => {
    const byIndex = new Map<number, Drop>();
    for (const dropped of parsed.status === "ready" && parsed.data !== null
      ? parsed.data.outcome.droppedBlocks
      : []) {
      byIndex.set(dropped.blockIndex, { step: dropped.step, reason: dropped.reason });
    }
    return byIndex;
  }, [parsed]);

  if (generation === null) {
    return (
      <EmptyState
        title={t("documents.parsed.notYet", "Not parsed yet")}
        description={t(
          "documents.parsed.notYetDescription",
          "Process this version to see how its text was read.",
        )}
      />
    );
  }
  if (parsed.status === "loading") {
    return <Waiting label={t("documents.parsed.loading", "Loading the parsed text")} lines={6} />;
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
  if (parsed.data === null) {
    return (
      <EmptyState
        title={t("documents.parsed.purged", "Parsed text purged")}
        description={t(
          "documents.parsed.purgedDescription",
          "Process the version again to read it.",
        )}
      />
    );
  }

  const { document, outcome } = parsed.data;
  const { sourceText, blocks } = document;
  const visible = blocks
    .map((block, index): Placed => ({ block, index, drop: drops.get(index) }))
    .filter((placed) => showDropped || placed.drop === undefined);
  const groups = pageGroups(visible.slice(0, shown), document);
  const droppingSteps = outcome.steps.filter((step) => step.dropped > 0);
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const identity = document.identity;
  const identityLine =
    identity === undefined
      ? null
      : [identity.part, identity.manufacturer, identity.description, identity.revision]
          .filter((part) => part !== null)
          .join(" · ");

  return (
    <div className={READING}>
      <TabToolbar
        control={
          droppingSteps.length === 0 ? undefined : (
            <>
              <Checkbox
                label={t("documents.parsed.showDropped", "Show dropped")}
                checked={showDropped}
                onChange={(event) => {
                  setShowDropped(event.target.checked);
                }}
              />
              <ul
                className={STEP_COUNTS}
                aria-label={t("documents.parsed.stepsLabel", "Dropped blocks by step")}
              >
                {droppingSteps.map((step) => (
                  <li key={`${step.ruleSetId}-${step.step}`}>
                    {/* The rule that dropped them is a way to the rule set it belongs to — where it is changed. */}
                    {step.ruleSetId === undefined ? (
                      <span className={QUIET}>{step.step}</span>
                    ) : (
                      <Link
                        to="/rules/$ruleSetId"
                        params={{ ruleSetId: step.ruleSetId }}
                        className={QUIET}
                      >
                        {step.step}
                      </Link>
                    )}
                    <span className={`${STEP_COUNT} numeric`}>{number(step.dropped)}</span>
                  </li>
                ))}
              </ul>
            </>
          )
        }
      >
        {t(
          "documents.parsed.explanation",
          "The parser read this version as the blocks below — each shown as what it took it for, in the order it found them.",
        )}{" "}
        {plural("documents.parsed.blocks", blocks.length, {
          one: "{count} block",
          other: "{count} blocks",
        })}{" "}
        ·{" "}
        {plural("documents.parsed.characters", sourceText.length, {
          one: "{count} character",
          other: "{count} characters",
        })}
        {identityLine !== null && identityLine !== "" && (
          <>
            {" · "}
            <span className={QUIET}>
              {t("documents.parsed.identity", "The document says it is")}
            </span>{" "}
            {identityLine}
          </>
        )}
      </TabToolbar>

      {groups.map((group) => (
        <section
          key={group.page ?? "unpaged"}
          className={PAGE_PANEL}
          aria-labelledby={group.page === null ? undefined : `parsed-page-${group.page}`}
        >
          {group.page !== null && (
            <h3 id={`parsed-page-${group.page}`} className={PAGE_HEADER}>
              {t("documents.parsed.pageHeading", "Page {page}", { page: group.page })}
            </h3>
          )}
          <ol className={ROWS}>
            {group.rows.map((row) =>
              row.kind === "kept" ? (
                <BlockRow key={row.placed.index} placed={row.placed} document={document} t={t} />
              ) : (
                <DroppedRun
                  key={row.blocks[0].index}
                  step={row.step}
                  blocks={row.blocks}
                  document={document}
                  t={t}
                  plural={plural}
                />
              ),
            )}
          </ol>
        </section>
      ))}

      {visible.length > shown && (
        <div>
          <Button
            variant="quiet"
            onClick={() => {
              setShown(shown + BLOCKS_SHOWN);
            }}
          >
            {t("documents.parsed.showMore", "Show {count} more of {remaining}", {
              count: number(Math.min(BLOCKS_SHOWN, visible.length - shown)),
              remaining: number(visible.length - shown),
            })}
          </Button>
        </div>
      )}
    </div>
  );
}

/** The one-based page a block starts on, or null for an unpaged original. */
function pageOf(block: StructuredBlock, document: StructuredDocument): number | null {
  const page = document.pages?.find(
    (candidate) =>
      block.startOffset >= candidate.startOffset && block.startOffset < candidate.endOffset,
  );
  return page === undefined ? null : page.number;
}

/** Blocks grouped by page, each run of consecutive blocks one step dropped folded into one row. */
function pageGroups(placed: Placed[], document: StructuredDocument): PageGroup[] {
  const groups: PageGroup[] = [];
  for (const entry of placed) {
    const page = pageOf(entry.block, document);
    let group = groups[groups.length - 1];
    if (group === undefined || group.page !== page) {
      group = { page, rows: [] };
      groups.push(group);
    }
    const previous = group.rows[group.rows.length - 1];
    if (entry.drop === undefined) {
      group.rows.push({ kind: "kept", placed: entry });
    } else if (
      previous !== undefined &&
      previous.kind === "dropped" &&
      previous.step === entry.drop.step
    ) {
      previous.blocks.push(entry);
    } else {
      group.rows.push({ kind: "dropped", step: entry.drop.step, blocks: [entry] });
    }
  }
  return groups;
}

function kindLabel(block: StructuredBlock, t: Translate): string {
  switch (block.kind) {
    case "HEADING":
      return t("documents.parsed.kindName.heading", "Heading {level}", {
        level: block.headingLevel,
      });
    case "PARAGRAPH":
      return t("documents.parsed.kindName.paragraph", "Paragraph");
    case "LIST_ITEM":
      return t("documents.parsed.kindName.listItem", "List item");
    case "TABLE_ROW":
      return block.table?.headerRow
        ? t("documents.parsed.kindName.tableHeader", "Table header")
        : t("documents.parsed.kindName.tableRow", "Table row");
    case "PAGE_FURNITURE":
      return t("documents.parsed.kindName.pageFurniture", "Page edge");
    case "TABLE_OF_CONTENTS":
      return t("documents.parsed.kindName.contents", "Contents");
    case "FIGURE":
      return t("documents.parsed.kindName.figure", "Figure");
    case "CAPTION":
      return t("documents.parsed.kindName.caption", "Caption");
    case "CODE":
      return t("documents.parsed.kindName.code", "Code");
    case "QUOTE":
      return t("documents.parsed.kindName.quote", "Quote");
    case "ENTRY":
      return t("documents.parsed.kindName.entry", "Entry");
    case "DECLARATION":
      return t("documents.parsed.kindName.declaration", "Declaration");
    default:
      return t("documents.parsed.kindName.text", "Text");
  }
}

/** A table of contents' dot leaders, «Introduction ........ 7», shortened to «Introduction … 7». */
function withoutDotLeaders(text: string): string {
  return text.replace(/\s*(?:\.\s?){4,}\s*/g, " … ");
}

function lineRange(placed: Placed[]): string {
  const first = placed[0].block.startLine;
  const last = placed[placed.length - 1].block.endLine;
  return first === last ? String(first) : `${first}–${last}`;
}

function BlockRow({
  placed,
  document,
  t,
  dropped = false,
}: {
  placed: Placed;
  document: StructuredDocument;
  t: Translate;
  dropped?: boolean;
}) {
  const { block } = placed;
  return (
    <li className={ROW} data-kind={block.kind} data-dropped={dropped}>
      <span className={`${LINE_NUMBER} numeric`}>{lineRange([placed])}</span>
      <span className={KIND_CELL}>
        <Badge tone="neutral">{kindLabel(block, t)}</Badge>
      </span>
      <div className={BODY_CELL}>
        <BlockContent block={block} document={document} t={t} />
      </div>
    </li>
  );
}

/** A block rendered as what it is. */
function BlockContent({
  block,
  document,
  t,
}: {
  block: StructuredBlock;
  document: StructuredDocument;
  t: Translate;
}) {
  const slice = document.sourceText.slice(block.startOffset, block.endOffset);
  switch (block.kind) {
    case "HEADING":
      return (
        <p className={HEADING_BLOCK} data-level={Math.min(block.headingLevel, 4)}>
          {withoutDotLeaders(slice.replace(/^#{1,6}\s*/, "").replace(/\n[=-]+\s*$/, ""))}
        </p>
      );
    case "CODE":
      return <pre className={CODE_BLOCK}>{slice}</pre>;
    case "TABLE_ROW": {
      const table = block.table;
      if (table === undefined) {
        return <p className={TEXT_BLOCK}>{slice}</p>;
      }
      if (table.headerRow) {
        return <p className={TABLE_HEADER_BLOCK}>{table.header.join(" · ") || slice}</p>;
      }
      const pairs = table.cells
        .filter((cell) => cell.value.trim() !== "")
        .map((cell) => ({ header: cell.header ?? "", value: cell.value }));
      return (
        <p className={TEXT_BLOCK}>
          <PairsView pairs={pairs} />
        </p>
      );
    }
    case "LIST_ITEM": {
      const list = block.list;
      const marker =
        list === undefined ? null : list.marker === "BULLET" ? "•" : (list.label ?? "•");
      return (
        <p className={LIST_ITEM_BLOCK} data-level={Math.min(list?.level ?? 1, 6)}>
          {marker !== null && (
            <span className={LIST_MARKER} aria-hidden="true">
              {marker}
            </span>
          )}
          <span>{slice.replace(/\s*\n\s*/g, " ")}</span>
        </p>
      );
    }
    case "FIGURE": {
      const figure = block.figure;
      if (figure === undefined) {
        return <p className={TEXT_BLOCK}>{slice}</p>;
      }
      const labels = figure.labels.slice(0, FIGURE_LABELS_SHOWN);
      const more = figure.labels.length - labels.length;
      return (
        <div className={FIGURE}>
          <p className={TEXT_BLOCK}>
            {figure.caption ??
              t("documents.parsed.figureUntitled", "Figure on page {page}", { page: figure.page })}
          </p>
          {labels.length > 0 && (
            <p className={FIGURE_LABELS}>
              <span className={QUIET}>{t("documents.parsed.figureLabels", "Labels")}</span>{" "}
              {labels.join(" · ")}
              {more > 0
                ? ` · ${t("documents.parsed.figureMore", "+{count} more", { count: more })}`
                : ""}
            </p>
          )}
        </div>
      );
    }
    default:
      return <p className={TEXT_BLOCK}>{withoutDotLeaders(block.content ?? slice)}</p>;
  }
}

/** A run of consecutive blocks one step dropped: one row naming the step, opening on the blocks. */
function DroppedRun({
  step,
  blocks,
  document,
  t,
  plural,
}: {
  step: string;
  blocks: Placed[];
  document: StructuredDocument;
  t: Translate;
  plural: Plural;
}) {
  const kinds = new Set(blocks.map((placed) => kindLabel(placed.block, t)));
  const reasons = [...new Set(blocks.map((placed) => placed.drop?.reason ?? ""))].filter(
    (reason) => reason !== "",
  );
  return (
    <li className={DROPPED}>
      <details className={DROPPED_RUN}>
        <summary className={DROPPED_SUMMARY}>
          <span className={`${LINE_NUMBER} numeric`}>{lineRange(blocks)}</span>
          <span className={KIND_CELL}>
            <Badge tone="neutral">
              {kinds.size === 1 ? [...kinds][0] : t("documents.parsed.kindName.mixed", "Mixed")}
            </Badge>
          </span>
          <span className={DROPPED_TEXT}>
            {t("documents.parsed.droppedRun", "{blocks} — dropped by «{step}»", {
              blocks: plural("documents.parsed.droppedRunBlocks", blocks.length, {
                one: "{count} block",
                other: "{count} blocks",
              }),
              step,
            })}
            <span className={DISCLOSURE_HINT}>
              <span className={WHEN_CLOSED}>{t("documents.parsed.reveal", "show")}</span>
              <span className={WHEN_OPEN}>{t("documents.parsed.conceal", "hide")}</span>
            </span>
          </span>
        </summary>
        {reasons.length === 1 && <p className={DROPPED_REASON}>{reasons[0]}</p>}
        <ol className={ROWS}>
          {blocks.map((placed) => (
            <BlockRow key={placed.index} placed={placed} document={document} t={t} dropped />
          ))}
        </ol>
      </details>
    </li>
  );
}
