/**
 * Quality: the suites, a run's report, and the editor that builds a suite.
 *
 * ⚠️ IN ONE FILE BECAUSE FOUR SCREENS ARE ONE SUBJECT — a suite is written, run, and then read as a
 * report, and the metric bar in the report has to be the same object each time it is met.
 */

/* The breadcrumb link reads as the eyebrow it sits in. */
export const CRUMB = "text-inherit no-underline hover:text-accent-text hover:underline";

export const STACK = "grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4";

export const SECTION_TITLE = "mx-0 mt-0 mb-3 text-base";

/* ⚠️ A HEADING INSIDE A TOOLBAR OR THE GUIDE LOSES ITS BOTTOM MARGIN, because there the heading
   shares a line with the controls beside it rather than standing over a block. */
export const TOOLBAR = [
  "flex flex-wrap items-center justify-between gap-3",
  "[&_h2]:m-0 [&_h3]:m-0",
].join(" ");

export const TOOLBAR_ACTIONS = "flex min-w-0 flex-wrap gap-2";

export const TABLE_SURFACE = "overflow-x-auto rounded-surface border border-line bg-surface";

export const ROW_LINK = "font-semibold text-ink no-underline hover:text-accent-text hover:underline";

export const SUMMARY_TOGGLE = "my-2 cursor-pointer text-xs font-semibold text-secondary";

/* What the tab is for, in one line under the tabs. */
export const INTRO = "m-0 max-w-[90ch] text-sm text-secondary";

/* The guided start: three numbered steps and the one action that begins them. */
export const GUIDE = [
  "grid gap-4 rounded-surface border border-line bg-surface p-6",
  "[&_h2]:m-0 [&_h3]:m-0",
  "max-[700px]:p-3",
].join(" ");

export const STEPS = [
  "m-0 grid list-none grid-cols-3 gap-4 p-0",
  "max-[1100px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

export const STEP = [
  "grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-t-2 border-t-line-strong pt-3",
  "[&_p]:mx-0 [&_p]:mt-1 [&_p]:mb-0",
].join(" ");

/* Square, not round: a step of an instrument rather than a bullet. */
export const STEP_NUMBER = [
  "inline-grid size-[calc(24px*var(--ui-scale))] place-items-center border border-accent-text",
  "text-xs font-bold text-accent-text [font-variant-numeric:tabular-nums]",
].join(" ");

export const STEP_TITLE = "m-0 text-sm";

/* The selected suite's runs inside the inspector. */
export const HISTORY = "m-0 grid list-none p-0";

export const HISTORY_ROW = [
  "flex w-full items-center justify-between gap-2 border-0 border-b border-line bg-transparent p-2",
  "cursor-pointer text-left text-ink",
  "transition-[background-color] duration-120 motion-reduce:transition-none hover:bg-well",
  "aria-pressed:bg-accent-soft aria-pressed:shadow-[inset_2px_0_0_var(--accent)]",
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-line",
].join(" ");

/* ── The run report ─────────────────────────────────────────────────────────────────────────── */

export const REPORT = [
  "grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 rounded-surface border border-line bg-surface",
  "[padding:var(--space-4)_var(--space-5)_var(--space-5)] max-[700px]:p-3",
].join(" ");

export const REPORT_HEAD =
  "flex flex-wrap items-start justify-between gap-3 [&_p]:m-0";

export const REPORT_TITLE = "mx-0 my-1 text-md";

export const PROFILE_GRID = [
  "grid gap-3 grid-cols-[repeat(auto-fill,minmax(calc(340px*var(--ui-scale)),1fr))]",
  "max-[700px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

export const PROFILE_SCORE =
  "grid gap-2 rounded-control border border-line bg-well px-4 py-3";

export const PROFILE_HEAD =
  "mb-1 flex items-start justify-between gap-3 [&_p]:m-0";

export const PROFILE_NAME = "m-0 text-sm";

/*
 * ⚠️ `group` CARRIES THE VERDICT TO THE BAR AND TO THE WORD. Whether a metric met its mark is one
 * fact, said by the fill's colour and by the word beside it; reading it off the row is what keeps the
 * two from ever disagreeing. On a phone the bar drops to a line of its own under the label.
 */
export const METRIC = [
  "group grid items-center gap-3 text-xs",
  "grid-cols-[calc(130px*var(--ui-scale))_minmax(calc(60px*var(--ui-scale)),1fr)_auto]",
  "max-[700px]:grid-cols-[minmax(0,1fr)_auto]",
].join(" ");

export const METRIC_LABEL = "text-secondary";

export const METRIC_TRACK = [
  "relative h-[calc(8px*var(--ui-scale))] bg-line",
  "max-[700px]:col-span-full max-[700px]:row-start-2",
].join(" ");

export const METRIC_FILL = [
  "absolute inset-y-0 left-0 bg-muted",
  "group-data-[tone=meets]:bg-good group-data-[tone=misses]:bg-danger",
].join(" ");

/* The mark the value had to reach: a tick taller than the bar, in ink so it reads on either fill. */
export const METRIC_MARK = [
  "absolute top-[calc(-3px*var(--ui-scale))] bottom-[calc(-3px*var(--ui-scale))]",
  "-ml-[1px] w-[2px] bg-ink",
].join(" ");

export const METRIC_VALUE = [
  "flex min-w-[calc(150px*var(--ui-scale))] items-baseline justify-end gap-1",
  "max-[700px]:min-w-0",
].join(" ");

export const METRIC_WORD = [
  "min-w-[7ch] text-right font-semibold",
  "group-data-[tone=meets]:text-good group-data-[tone=misses]:text-danger",
].join(" ");

export const QUESTION_CELL =
  "align-top min-w-[calc(200px*var(--ui-scale))] max-w-[calc(420px*var(--ui-scale))]";

/* A fixed width, so a long path is cut in its middle by PathText instead of widening the table. */
export const DOCUMENT_CELL = [
  "align-top w-[calc(300px*var(--ui-scale))] min-w-[calc(220px*var(--ui-scale))]",
  "max-w-[calc(300px*var(--ui-scale))]",
].join(" ");

export const DOCUMENT_NAME = [
  "grid min-w-0 grid-cols-[minmax(0,1fr)] overflow-hidden",
  "[&>span]:block [&>span]:min-w-0 [&>span]:overflow-hidden",
].join(" ");

export const OUTCOME = "grid gap-[calc(2px*var(--ui-scale))]";

export const OUTCOME_FOUND = "text-xs font-semibold text-good";

export const OUTCOME_MISSED = "text-xs font-semibold text-danger";

export const INSTEAD = "m-0 grid grid-cols-[minmax(0,1fr)] gap-1 pl-4";

export const JOURNAL = "border-t border-line pt-2";

/* ── Suite editor ───────────────────────────────────────────────────────────────────────────── */

export const EDITOR = "m-0 grid min-w-0 gap-4 border-0 p-0";

export const PANEL = [
  "grid min-w-0 gap-3 rounded-surface border border-line bg-surface",
  "[padding:var(--space-4)_var(--space-5)_var(--space-5)]",
].join(" ");

export const QUESTIONS = "m-0 grid list-none gap-3 p-0";

export const QUESTION =
  "grid gap-2 rounded-control border border-line bg-well p-3";

/*
 * ⚠️ ON A PHONE THE FOUR COLUMNS BECOME THREE AND TWO OF THE PARTS SWAP PLACES: the identifier drops
 * to a second line spanning the width, and the control that was fourth takes the place it left. Said
 * as two `nth-child` rules because the head's children are written in reading order, not in this one.
 */
export const QUESTION_HEAD = [
  "grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2",
  "max-[700px]:grid-cols-[auto_minmax(0,1fr)_auto]",
  "max-[700px]:[&>:nth-child(3)]:col-[2_/_-1] max-[700px]:[&>:nth-child(3)]:row-start-2",
  "max-[700px]:[&>:nth-child(4)]:col-start-3 max-[700px]:[&>:nth-child(4)]:row-start-1",
].join(" ");

export const QUESTION_ID = "max-w-[calc(240px*var(--ui-scale))]";

export const QUESTION_NUMBER = [
  "min-w-[2ch] text-right text-xs font-semibold text-muted",
  "[font-variant-numeric:tabular-nums]",
].join(" ");

/* The suite row: name, read profile, scope, top-N and the enabled switch on one baseline. */
export const SETTINGS_ROW = [
  "grid items-start gap-x-4 gap-y-3",
  "grid-cols-[minmax(calc(200px*var(--ui-scale)),1.4fr)_minmax(calc(170px*var(--ui-scale)),1fr)_minmax(calc(170px*var(--ui-scale)),1fr)_calc(128px*var(--ui-scale))_auto]",
  "max-[1100px]:grid-cols-2 max-[700px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

/* ⚠️ The checkbox sits on the CONTROLS' line, not the labels': the label row above it is empty, so it
   is pushed down by exactly one label's height. Once the row stacks there is no label row to clear. */
export const ENABLED_CELL = [
  "flex min-h-(--control) items-center",
  "mt-[calc(var(--text-xs)*1.5+6px*var(--ui-scale))] max-[700px]:mt-0",
].join(" ");

export const UNIT_INPUT = [
  "flex min-w-0 items-center gap-2",
  "[&_input]:w-[calc(96px*var(--ui-scale))] [&_input]:min-w-0",
  "max-[700px]:[&_input]:w-[calc(80px*var(--ui-scale))]",
].join(" ");

export const UNIT = "text-xs whitespace-nowrap text-muted";

export const NARROW_INPUT = "w-[calc(80px*var(--ui-scale))]";

export const GROUPS = "grid grid-cols-2 gap-4 max-[1100px]:grid-cols-[minmax(0,1fr)]";

export const NUMBER_GRID = "grid grid-cols-2 gap-x-4 gap-y-3";

export const COMPARISONS = "m-0 grid list-none gap-2 p-0";

export const COMPARISON = [
  "grid justify-start gap-2",
  "grid-cols-[minmax(0,calc(360px*var(--ui-scale)))_calc(160px*var(--ui-scale))_auto]",
  "max-[700px]:grid-cols-[minmax(0,1fr)_auto] max-[700px]:[&>:first-child]:col-span-full",
].join(" ");

export const FIELD_ERROR = "m-0 text-xs text-danger";

export const MISSING = "font-[550] text-danger";

/* ── Drafting questions from documents ──────────────────────────────────────────────────────── */

export const DRAFTING = [
  "grid min-w-0 gap-3 rounded-control border border-line border-l-2 border-l-accent bg-well",
  "[padding:var(--space-3)_var(--space-4)_var(--space-4)] [&_p]:m-0",
].join(" ");

export const SUBSECTION_TITLE = "m-0 text-sm";

export const DRAFTING_FORM = "m-0 grid min-w-0 gap-3 border-0 p-0";

export const DRAFTING_SETTINGS = "flex flex-wrap items-start gap-x-6 gap-y-3";

export const SEGMENT_FIELD = "grid gap-[calc(6px*var(--ui-scale))]";

export const SEGMENT_LABEL = "text-xs font-[550] text-secondary";

export const DRAFTING_ACTION = "flex flex-wrap items-center gap-x-3 gap-y-2";

export const DRAFTS = "grid gap-3 border-t border-line pt-3";

export const DRAFT_LIST = "m-0 grid list-none gap-2 p-0";

/* A draft that will not be kept stays in the list and stops asking to be read. */
export const DRAFT_ITEM = [
  "grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 rounded-control border border-line",
  "bg-surface px-3 py-2 data-[kept=false]:opacity-60",
].join(" ");

export const DRAFT_BODY = "grid min-w-0 gap-1";

export const EXCERPT = "m-0 border-l-2 border-l-line-strong pl-2 text-xs text-muted";

/* ⚠️ The save bar is always marked, because the editor is only ever shown with something to save. */
export const SAVE_BAR = [
  "sticky bottom-0 z-5 flex items-center justify-between gap-3",
  "rounded-surface border border-accent-text bg-surface px-4 py-3",
  "shadow-[inset_2px_0_0_var(--accent)]",
].join(" ");
