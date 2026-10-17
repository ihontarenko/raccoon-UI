import { useEffect, useRef, type ReactNode } from "react";
import { classNames } from "../../../lib/classNames";

interface TableProperties {
  /** Native table content: thead / tbody with th[scope] and td, so semantics stay with the caller. */
  children: ReactNode;
  className?: string;
}

/**
 * A frame narrower than this cannot hold a table of three or more columns: the columns stop scanning
 * and start wrapping one word to a line, which is how a six-column table becomes a 300px-tall row.
 * Below it the same table is drawn as one card per row instead. A phone's page frame is about 356px
 * wide and an inspector about 340px, so both stack; a tablet's 718px does not.
 */
const STACK_BELOW = 560;

/**
 * What each part of the table must be announced as while it is stacked.
 *
 * Laying the rows out as blocks is not only a change of paint: a browser drops a table's implicit
 * roles the moment its parts stop being `display: table-*`, so a stacked table would be announced as
 * a pile of anonymous boxes. Naming the roles puts the structure back, and the association between a
 * value and its column — which is positional either way — survives the change of width.
 */
const STACKED_ROLES: readonly [selector: string, role: string][] = [
  ["thead, tbody", "rowgroup"],
  ["tr", "row"],
  ["thead th", "columnheader"],
  ["tbody td", "cell"],
];

function announceAs(table: HTMLTableElement, stacked: boolean): void {
  const apply = (element: Element, role: string) => {
    if (stacked) {
      if (element.getAttribute("role") !== role) {
        element.setAttribute("role", role);
      }
    } else if (element.hasAttribute("role")) {
      element.removeAttribute("role");
    }
  };
  apply(table, "table");
  for (const [selector, role] of STACKED_ROLES) {
    for (const element of table.querySelectorAll(selector)) {
      apply(element, role);
    }
  }
}

// A styled data table with two layouts over the same markup.
//
// Wide enough, it is a table: columns scan, and a table wider than its frame scrolls sideways with a
// shade on the edge that hides columns — on a phone the status and action columns are usually the
// hidden ones, and a scroll nobody can see is a column nobody reaches.
//
// Too narrow for columns, each row becomes a card: the first cell is its heading and every other cell
// is labelled with its column, read from the header the caller already wrote. Laying the rows out as
// blocks costs the table its implicit roles, so they are named again — see `announceAs` — and the
// structure a screen reader is given is the same at either width.
//
// Numeric columns right-align when their cells carry the global `numeric` class, which also applies
// tabular figures from the token stylesheet.
export function Table({ children, className }: TableProperties) {
  const frame = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frameElement = frame.current;
    const scrollerElement = scroller.current;
    if (frameElement === null || scrollerElement === null) {
      return;
    }
    const table = scrollerElement.querySelector("table");

    const markHiddenEdges = () => {
      const hiddenBefore = scrollerElement.scrollLeft > 1;
      const hiddenAfter = scrollerElement.scrollLeft + scrollerElement.clientWidth < scrollerElement.scrollWidth - 1;
      frameElement.dataset.hiddenBefore = String(hiddenBefore);
      frameElement.dataset.hiddenAfter = String(hiddenAfter);
    };

    const chooseLayout = () => {
      const columns = table?.querySelectorAll("thead th").length ?? 0;
      const stacked = columns > 2 && frameElement.clientWidth > 0 && frameElement.clientWidth < STACK_BELOW;
      frameElement.dataset.layout = stacked ? "stacked" : "columns";
      if (table !== null) {
        announceAs(table, stacked);
      }
    };

    const measure = () => {
      chooseLayout();
      markHiddenEdges();
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frameElement);
    observer.observe(scrollerElement);
    if (table !== null) {
      observer.observe(table);
    }
    scrollerElement.addEventListener("scroll", markHiddenEdges, { passive: true });
    return () => {
      observer.disconnect();
      scrollerElement.removeEventListener("scroll", markHiddenEdges);
    };
  }, []);

  // The column labels a stacked row shows beside each value. They are read from the table's own
  // header rather than asked of the caller: the header already states them, and a second place to
  // write them is a second place for them to go stale. Runs after every render because a column may
  // be drawn only for some callers, and then the cell at an index is a different column.
  useEffect(() => {
    const table = scroller.current?.querySelector("table");
    if (!table) {
      return;
    }
    const headings = [...table.querySelectorAll<HTMLTableCellElement>("thead tr:last-of-type th")].map((heading) =>
      (heading.textContent ?? "").trim(),
    );
    for (const cell of table.querySelectorAll<HTMLTableCellElement>("tbody td")) {
      // A cell spanning the row is a message, not a value: it carries no column and takes no label.
      const label = cell.colSpan > 1 ? "" : (headings[cell.cellIndex] ?? "");
      if (cell.dataset.column !== label) {
        cell.dataset.column = label;
      }
    }
    // Rows that arrive with the data are new elements, so they need the roles the layout already chose.
    announceAs(table, frame.current?.dataset.layout === "stacked");
  });

  // ⚠️ The three `rc-table-*` classes are component CSS rather than utilities, and deliberately so:
  // the padding, the rules, the hover, the selected row and the whole stacked card layout style
  // cells this component does not render. See `styles/components.css`.
  return (
    <div ref={frame} className="rc-table-frame">
      <div ref={scroller} className="rc-table-scroll">
        <table className={classNames("rc-table", className)}>{children}</table>
      </div>
    </div>
  );
}
