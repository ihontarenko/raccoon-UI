import type { ReactNode } from "react";
import { classNames } from "../../lib/classNames";
import { Button } from "../primitives";

/* The card is a `group` so its own switched-off state reaches the name and the summary inside it:
   an item turned off keeps its place and its settings, and stops asking for attention. */
const CARD = [
  "group grid min-w-0 gap-2 rounded-surface border border-line bg-surface p-3",
  "data-[resting=true]:bg-well",
].join(" ");

/* The stripe says what the item does to what it matches; the word beside it says the same thing. */
const TONE_EDGE: Record<"neutral" | "allow" | "deny" | "warn", string> = {
  neutral: "shadow-[inset_3px_0_0_var(--line-strong)]",
  allow: "shadow-[inset_3px_0_0_var(--allow)]",
  deny: "shadow-[inset_3px_0_0_var(--deny)]",
  warn: "shadow-[inset_3px_0_0_var(--warn)]",
};

/* A grid rather than a wrapping flex row: the ordinal, the switch and the actions keep their own
   columns at every width, so the names of ten cards start on one vertical line instead of each
   starting wherever its own badges happened to end. */
const HEAD = [
  "grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] items-center gap-2",
  "max-[720px]:grid-cols-[auto_auto_minmax(0,1fr)_auto]",
].join(" ");

/* The summary and the wrapped badge row both start where the name starts, under the ordinal rather
   than under the page edge. ⚠️ WRITTEN OUT TWICE ON PURPOSE: Tailwind finds its classes by reading
   this file as text, so a class assembled at runtime from a constant is a class it never generates
   and a rule that silently does not exist. */
const SUMMARY = [
  "col-span-full m-0 pl-[calc(18px*var(--ui-scale)+var(--space-2))] text-xs text-secondary",
  "[overflow-wrap:anywhere] group-data-[resting=true]:text-muted",
].join(" ");

/* One column on a phone: two halves of a field editor are unreadable at that width, not merely tight. */
const FIELDS = [
  "grid min-w-0 grid-cols-2 items-start gap-x-6 gap-y-3",
  "max-[720px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

// One frame for the ordered, named, condition → action items the product edits in a list: a source's scan
// rules and a processing profile's content steps. They are the same shape — a position, a name, a one-line
// summary of what it does, somewhere to move it and somewhere to remove it, and a body that edits it — and
// they were drawn by two unrelated components with different alignment, control widths and label treatment.
// The frame is what makes the two screens read as one product rather than two.

/** Moving an item within its list, and taking it out; every list that orders items needs exactly these. */
export interface EditorCardActions {
  moveUp: { label: string; disabled: boolean; onClick: () => void };
  moveDown: { label: string; disabled: boolean; onClick: () => void };
  remove: { label: string; onClick: () => void };
}

interface EditorCardProperties {
  /** Shown as written: the position in the list, counted from one by the caller. */
  ordinal: number;
  /** A switch before the name, where an item can be turned off without being removed. */
  toggle?: ReactNode;
  /** Badges beside the name: the kind, the verdict, the stage. */
  marks?: ReactNode;
  /** The name — an input where it is edited in place, a disclosure button where the body opens it. */
  title: ReactNode;
  /** What the item does, in one line: «holds pokemon → drop». */
  summary?: ReactNode;
  actions: EditorCardActions;
  /**
   * The colour of the left stripe, which says what the item does to what it matches. `neutral` is the
   * absence of a verdict, not a quiet one.
   */
  tone?: "neutral" | "allow" | "deny" | "warn";
  /** An item switched off keeps its place and its settings, and reads as resting. */
  resting?: boolean;
  /** The editor. Absent while the card is collapsed. */
  children?: ReactNode;
}

/** One item of an ordered list, with its editor under it. */
export function EditorCard({
  ordinal,
  toggle,
  marks,
  title,
  summary,
  actions,
  tone = "neutral",
  resting = false,
  children,
}: EditorCardProperties) {
  return (
    <li className={classNames(CARD, TONE_EDGE[tone])} data-tone={tone} data-resting={resting}>
      <div className={HEAD}>
        <span
          className="numeric min-w-[calc(18px*var(--ui-scale))] text-right text-xs text-muted"
          aria-hidden="true"
        >
          {ordinal}
        </span>
        {/* ⚠️ THE SWITCH'S CELL IS ALWAYS THERE, EMPTY WHEN THERE IS NO SWITCH. The head is a grid of declared
            columns, and leaving the cell out shifted the name into the switch's column and everything after it one
            place left — on a phone the name sat in a narrow auto column and the ordinal drifted to the middle. */}
        <span className="inline-flex items-center">{toggle}</span>
        <span className="min-w-0 font-semibold group-data-[resting=true]:text-muted">{title}</span>
        {marks !== undefined && (
          <span className="inline-flex flex-wrap gap-1 max-[720px]:col-span-full max-[720px]:pl-[calc(18px*var(--ui-scale)+var(--space-2))]">
            {marks}
          </span>
        )}
        {/* Pinned to the first row on a phone: the marks span a row of their own there, and an unpinned cell
            would fall under them into the ordinal's column and widen it. */}
        <span className="inline-flex gap-0 max-[720px]:col-start-4 max-[720px]:row-start-1">
          <Button
            variant="quiet"
            iconOnly
            icon="arrowUp"
            aria-label={actions.moveUp.label}
            title={actions.moveUp.label}
            disabled={actions.moveUp.disabled}
            onClick={actions.moveUp.onClick}
          />
          <Button
            variant="quiet"
            iconOnly
            icon="arrowDown"
            aria-label={actions.moveDown.label}
            title={actions.moveDown.label}
            disabled={actions.moveDown.disabled}
            onClick={actions.moveDown.onClick}
          />
          <Button
            variant="quiet"
            iconOnly
            icon="close"
            aria-label={actions.remove.label}
            title={actions.remove.label}
            onClick={actions.remove.onClick}
          />
        </span>
      </div>
      {summary !== undefined && <p className={SUMMARY}>{summary}</p>}
      {children !== undefined && (
        <div className="grid min-w-0 gap-4 border-t border-line pt-3">{children}</div>
      )}
    </li>
  );
}

/** The list the cards sit in: they carry their own borders, so it only sets the rhythm between them. */
export function EditorCardList({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ol className="m-0 grid list-none gap-2 p-0" aria-label={label}>
      {children}
    </ol>
  );
}

/**
 * The grid an editor's fields sit on: two equal columns at every level of the card, so a chooser, the
 * values it takes and the name above them all line up on the same two edges.
 *
 * ⚠️ A field that must span both columns says so with {@link EditorCardWide}, rather than happening to be
 * wide because of what is in it.
 */
export function EditorCardFields({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className={FIELDS} role={label === undefined ? undefined : "group"} aria-label={label}>
      {children}
    </div>
  );
}

/** A field that takes the whole width of {@link EditorCardFields}. */
export function EditorCardWide({ children }: { children: ReactNode }) {
  return <div className="col-span-full min-w-0">{children}</div>;
}
