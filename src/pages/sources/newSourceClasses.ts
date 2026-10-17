/**
 * Making a source: the steps on the left, what they add up to on the right.
 *
 * ⚠️ IN ONE FILE BECAUSE THE PAGE AND ITS CONNECTION FIELD ARE ONE FORM — the field is a step of the
 * same sequence and wears the same step frame.
 */

/* The breadcrumb link reads as the eyebrow it sits in. */
export const CRUMB = "text-inherit no-underline hover:text-accent-text hover:underline";

export const LAYOUT = [
  "grid grid-cols-[minmax(0,1fr)_calc(320px*var(--ui-scale))] items-start gap-6",
  "max-[1100px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

export const STEPS = "grid min-w-0 gap-4";

export const STEP = [
  "m-0 grid min-w-0 gap-3 rounded-surface border border-line bg-surface",
  "[padding:var(--space-4)_var(--space-5)_var(--space-5)]",
  "max-[520px]:[padding:var(--space-3)_var(--space-4)_var(--space-4)]",
].join(" ");

/* ⚠️ FLOATED, AND THE NEXT LINE CLEARS IT. `float` is what takes a `<legend>` out of the fieldset's
   border so the step's heading sits inside the panel rather than cutting through its top edge. */
export const STEP_TITLE = [
  "float-left flex w-full items-center gap-2 mb-1 p-0 text-base font-semibold",
  "[&+*]:clear-both",
].join(" ");

export const STEP_NUMBER = [
  "grid size-[calc(22px*var(--ui-scale))] place-items-center rounded-[calc(3px*var(--ui-scale))]",
  "border border-line-strong text-xs text-secondary [font-variant-numeric:tabular-nums]",
].join(" ");

/* ── The kind of source: three options, then two, then one ───────────────────────────────────── */

export const KINDS = [
  "grid grid-cols-3 gap-2",
  "max-[700px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] max-[520px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

/*
 * ⚠️ THE WHOLE OPTION IS THE CONTROL, which is why every state is read off the radio INSIDE it with
 * `has-[…]` rather than set on the radio itself: the chosen option is a filled card, the focused one
 * wears the ring, and the radio draws neither — `[&_input:focus-visible]:outline-none` is what stops
 * a second ring appearing inside the first.
 */
const OPTION_INPUT = "[&_input]:m-0 [&_input]:accent-[var(--accent)] [&_input:focus-visible]:outline-none";

const OPTION_RING =
  "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-1 has-[input:focus-visible]:outline-accent-text";

export const KIND_OPTION = [
  "flex min-h-(--control) cursor-pointer items-center gap-2 rounded-control border border-line px-3 py-2",
  "transition-[background-color,border-color] duration-120 motion-reduce:transition-none",
  "hover:border-line-strong",
  "has-[input:checked]:border-accent-text has-[input:checked]:bg-accent-soft",
  OPTION_RING,
  OPTION_INPUT,
].join(" ");

/* The label over how its documents arrive, so a long label never squeezes the badge beside it. */
export const KIND_TEXT = "grid min-w-0 flex-1 justify-items-start gap-1";

/* ── What the steps add up to, kept in view while the steps scroll ───────────────────────────── */

export const SUMMARY = [
  "sticky top-[calc(52px*var(--ui-scale)+var(--space-4))] grid gap-4",
  "rounded-surface border border-line bg-surface",
  "[padding:var(--space-4)_var(--space-5)_var(--space-5)]",
  "max-[1100px]:static",
].join(" ");

export const SUMMARY_TITLE = "text-base";

export const SUMMARY_FACTS = [
  "m-0 grid gap-3",
  "[&>dt]:text-2xs [&>dt]:tracking-[0.06em] [&>dt]:text-muted [&>dt]:uppercase",
  "[&>dd]:mx-0 [&>dd]:mt-[calc(2px*var(--ui-scale))] [&>dd]:mb-0 [&>dd]:[overflow-wrap:anywhere]",
].join(" ");

export const SUMMARY_ACTIONS = "flex gap-2 border-t border-line pt-4";
