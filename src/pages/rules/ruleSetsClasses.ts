/**
 * Rule sets: the list of every rule set, one rule set's page, the one rule editor, and the binding list a source and a
 * processing profile both draw.
 *
 * ⚠️ IN ONE FILE BECAUSE THEY ARE ONE VOCABULARY. A rule reads the same on its rule set, inside the source that binds it
 * and inside the profile that binds it; the frame it is read in must not change between them.
 */

export const PAGE = "grid min-w-0 gap-6";

export const SECTION = "grid min-w-0 gap-3";

export const TABLE_SURFACE = "overflow-x-auto rounded-surface border border-line bg-surface";

/** What a rule set is bound to, one per line: a short list read down rather than along. */
export const BOUND_LIST = "m-0 grid list-none gap-1 p-0 text-xs";

/** Badges in a row — the stages a rule set runs at, a rule's verdict. */
export const BADGES = "inline-flex flex-wrap gap-1";

/** The breadcrumb link reads as the eyebrow it sits in, as on a source's page. */
export const CRUMB_LINK = "text-inherit no-underline hover:text-accent-text hover:underline";

/* ── One rule set's rules ─────────────────────────────────────────────────────────────────────── */

/** The rules editor's own frame — the same surface a profile's settings sit on, so the two read as one product. */
export const EDITOR_FRAME = [
  "m-0 grid min-w-0 gap-5 rounded-surface border border-line bg-surface",
  "[padding:var(--space-4)_var(--space-5)_var(--space-5)]",
  "max-[720px]:[padding:var(--space-3)_var(--space-4)_var(--space-4)]",
].join(" ");

/**
 * The name field's own track. ⚠️ THE WIDTH LIVES HERE, NOT ON THE INPUT: a flex item is sized by what is inside it, and an
 * input's intrinsic width is about twenty characters, so a cap on the control only ever capped a box that had collapsed.
 */
export const NAME_FIELD = "min-w-0 max-w-[48ch]";

/** A stage's rules under its heading, the same grouping a document meets them in. */
export const STAGE_GROUP =
  "grid min-w-0 gap-2 border-t border-line pt-4 first-of-type:border-t-0 first-of-type:pt-0";

/** The stage's name, where it runs, and the control that adds to it, on one line: an empty stage is a row, not a block. */
export const STAGE_HEAD =
  "flex min-h-(--control) flex-wrap items-center justify-between gap-x-3 gap-y-1";

export const STAGE_TITLE = "m-0 flex flex-wrap items-center gap-2 text-sm font-[650]";

export const STAGE_PURPOSE = "m-0 max-w-[90ch] text-xs text-secondary";

/** The bar that reports before it offers. */
export const SAVE_BAR = [
  "flex flex-wrap items-center justify-between gap-x-4 gap-y-2",
  "rounded-surface border border-line bg-well p-3",
  "data-[dirty=true]:border-warn data-[dirty=true]:shadow-[inset_3px_0_0_var(--warn)]",
].join(" ");

export const SAVE_ACTIONS = "flex flex-wrap items-center gap-2";

/* The rule's name is what opens its editor: a disclosure drawn as the name rather than as a control. */
export const ROW_DISCLOSURE = [
  "block max-w-full min-w-0 cursor-pointer overflow-hidden border-0 bg-transparent p-0 text-left",
  "font-[inherit] text-ellipsis whitespace-nowrap text-inherit",
  "transition-[color] duration-120 hover:text-accent-text motion-reduce:transition-none",
].join(" ");

/* ── The rule editor ────────────────────────────────────────────────────────────────────────── */

/* «When» and «Then» breathe more than the fields inside them, so they read as two things. It carries no surface of its
   own: it sits in the body of an `EditorCard`, which already draws the rule and the padding. */
export const RULE_EDITOR = "grid min-w-0 gap-5";

/** One pair of equal columns for the whole editor, at every level of nesting — what makes it read as a grid. */
export const ROW = [
  "grid min-w-0 grid-cols-2 items-start gap-x-6 gap-y-3",
  "max-[720px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

export const PART = "m-0 grid min-w-0 gap-2 border-0 p-0";

export const PART_TITLE = "p-0 text-xs font-semibold tracking-[0.04em] text-secondary uppercase";

/*
 * ⚠️ THE SAME TWO COLUMNS AS `ROW`. The chooser takes the first, everything it asks for sits in the second, so the name and
 * stage above and every condition below line up on the same two edges.
 */
export const CONDITION = [
  "grid min-w-0 grid-cols-2 items-start gap-x-6 gap-y-3",
  "[&>:not(:first-child)]:col-start-2",
  "max-[720px]:grid-cols-[minmax(0,1fr)] max-[720px]:[&>:not(:first-child)]:col-start-1",
].join(" ");

export const FIELD = "grid min-w-0 content-start gap-1";

export const LABEL = "text-xs font-semibold";

export const HINT = "text-xs text-muted";

/** A fact, how it compares and with what — three controls that read as one sentence. */
export const COMPARISON =
  "grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 max-[720px]:grid-cols-[minmax(0,1fr)]";

export const NESTED = "grid gap-2 border-l-2 border-l-line pl-3";

export const NESTED_ITEM = "flex items-start gap-2 [&>:first-child]:flex-1";

/** A warning about the rule as it stands — a script that does not exist, one never activated. */
export const WARNING = "m-0 text-xs text-warn";

/* A group of checkboxes — normalisations, block kinds. Columns of a fixed minimum keep them a grid at every width. */
export const CHECKBOX_GRID =
  "grid grid-cols-[repeat(auto-fit,minmax(calc(190px*var(--ui-scale)),1fr))] gap-x-4 gap-y-1";

export const SCRIPT_ROW = [
  "flex flex-wrap items-end gap-2 [&>:first-child]:min-w-[16rem] [&>:first-child]:flex-1",
  // On a phone the chooser takes the whole row and the buttons wrap under it, rather than overlap it.
  "max-[720px]:[&>:first-child]:min-w-0 max-[720px]:[&>:first-child]:basis-full",
].join(" ");

export const SCRIPT_FORM = "grid min-w-0 gap-4";

export const SCRIPT_VARIABLES = [
  "m-0 grid gap-1 rounded-control border border-line bg-well p-3 text-xs",
  "[&>div]:grid [&>div]:grid-cols-[10rem_minmax(0,1fr)] [&>div]:gap-3 [&_dd]:m-0 [&_dd]:text-secondary",
  "max-[720px]:[&>div]:grid-cols-[minmax(0,1fr)] max-[720px]:[&>div]:gap-0",
].join(" ");

/* ── Tables of what a rule set did ────────────────────────────────────────────────────────────── */

/* Long cells wrap, so the reason stays in view beside the text. */
export const EXCERPT =
  "min-w-[14rem] text-xs whitespace-normal text-secondary [overflow-wrap:anywhere]";

export const REASON = "min-w-[14rem] whitespace-normal";

/* ── The binding list ──────────────────────────────────────────────────────────────────────── */

/** A holder's rule sets in the order their rules run, then the control that adds one. */
export const BINDING = "grid min-w-0 gap-3";

export const BINDING_ADD = [
  "flex flex-wrap items-end gap-2 [&>:first-child]:min-w-[16rem] [&>:first-child]:flex-1",
  // On a phone the chooser takes the whole row and the buttons wrap under it, rather than overlap it.
  "max-[720px]:[&>:first-child]:min-w-0 max-[720px]:[&>:first-child]:basis-full",
].join(" ");
export const PATTERNS = "grid min-w-0 gap-2";
