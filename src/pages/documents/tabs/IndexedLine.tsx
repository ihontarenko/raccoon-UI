/*
 * Structured text read back into its shape: references quiet, values carrying the ink.
 *
 * ⚠️ `[[data-line=text]+&]:mt-2!` IS THE OLD `.text + .text` RULE, and it needs both the attribute
 * and the important marker. A run of prose lines is spaced further apart than a run of path/value
 * lines, which is a rule about the PREVIOUS sibling — something no component can know about itself,
 * so the lines carry `data-line` for each other to read. The marker is because the base 2px margin
 * and this 8px one are selectors of equal weight.
 */
const LINE = "[overflow-wrap:anywhere] not-first:mt-[calc(2px*var(--ui-scale))]";

/* A path is the reference a value is found by: quiet, in the code face. */
const REFERENCE = "font-mono text-xs text-muted";

const TEXT_AFTER_TEXT = "[[data-line=text]+&]:mt-2!";


/** One line of structured text, by the shape its parser gave it. */
export type IndexedLine =
  | { kind: "path"; path: string; value: string }
  | { kind: "group"; path: string }
  | { kind: "pairs"; pairs: { header: string; value: string }[] }
  | { kind: "trail"; parents: string[]; item: string }
  | { kind: "text"; text: string };

const PATH_LINE = /^([/$][^\s=]*) =(?: (.*))?$/;
const GROUP_LINE = /^[/$][^\s=]*$/;
const PAIR = /^([^:·]{1,80}): (.+)$/;
const TRAIL_SEPARATOR = " › ";

/**
 * Reads a line of indexed text back into its shape: `/project/version = 0.1.0` a path and its value, a line of
 * «Header: value» pairs a table row, «Parent › item» a list item under its parents. Anything else is text.
 */
export function indexedLineOf(line: string): IndexedLine {
  const path = PATH_LINE.exec(line);
  if (path !== null) {
    return { kind: "path", path: path[1], value: path[2] ?? "" };
  }
  if (GROUP_LINE.test(line)) {
    return { kind: "group", path: line };
  }
  const pieces = line.split(" · ");
  if (pieces.length > 1) {
    const pairs = pieces.map((piece) => PAIR.exec(piece));
    if (pairs.every((pair) => pair !== null)) {
      return { kind: "pairs", pairs: pairs.map((pair) => ({ header: pair![1], value: pair![2] })) };
    }
  }
  if (line.includes(TRAIL_SEPARATOR)) {
    const parts = line.split(TRAIL_SEPARATOR);
    return { kind: "trail", parents: parts.slice(0, -1), item: parts[parts.length - 1] };
  }
  return { kind: "text", text: line };
}

/** «Header: value» pairs, the header quiet and the value carrying the ink. */
export function PairsView({ pairs }: { pairs: { header: string; value: string }[] }) {
  return (
    <span className="inline-flex flex-wrap gap-x-4 gap-y-0">
      {pairs.map((pair, index) => (
        <span key={index} className="min-w-0">
          {pair.header !== "" && <span className="text-muted">{pair.header}:</span>} <span className="text-ink">{pair.value}</span>
        </span>
      ))}
    </span>
  );
}

/** One line of structured text: a path as a quiet reference beside its value, pairs, a list item under its parents, or text. */
export function IndexedLineView({ line }: { line: IndexedLine }) {
  switch (line.kind) {
    case "path":
      return (
        <div className={LINE}>
          <span className={REFERENCE}>{line.path}</span>
          <span className="mx-1 text-muted" aria-hidden="true">
            =
          </span>
          <span className="text-ink">{line.value === "" ? "—" : line.value}</span>
        </div>
      );
    case "group":
      return <div className={`${LINE} ${REFERENCE} mt-1`}>{line.path}</div>;
    case "pairs":
      return (
        <div className={`${LINE} border-b border-line py-[calc(2px*var(--ui-scale))] last:border-b-0`}>
          <PairsView pairs={line.pairs} />
        </div>
      );
    case "trail":
      return (
        <div className={LINE}>
          <span className="text-muted">{line.parents.join(TRAIL_SEPARATOR)} ›</span>{" "}
          <span className="text-ink">{line.item}</span>
        </div>
      );
    case "text":
      return (
        <div className={`${LINE} ${TEXT_AFTER_TEXT}`} data-line="text">
          {line.text}
        </div>
      );
  }
}
