/**
 * A source's Rules tab: the bound rule sets beside the preview of what they take at the door.
 */

export const LAYOUT = [
  "grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,calc(360px*var(--ui-scale)))] items-start gap-6",
  "max-[1100px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

export const EDITOR = "m-0 grid min-w-0 gap-4 border-0 p-0";

export const EDITOR_INTRO = "grid min-w-0 max-w-[80ch] gap-3";

/*
 * The save bar reports before it offers: whether there is anything to save, then the two ways to
 * settle it. ⚠️ It stays at the foot of the editor rather than floating, because saving rules is not
 * an urgent act — and it marks unsaved work with the same amber edge the rest of the product uses.
 */
export const SAVE_BAR = [
  "flex flex-wrap items-center justify-between gap-x-4 gap-y-2",
  "rounded-surface border border-line bg-well p-3",
  "data-[dirty=true]:border-warn data-[dirty=true]:shadow-[inset_3px_0_0_var(--warn)]",
].join(" ");

export const SAVE_ACTIONS = "flex flex-wrap items-center gap-2";

/* ── The preview beside the rules ───────────────────────────────────────────────────────────── */

export const PREVIEW =
  "grid min-w-0 gap-3 self-start rounded-surface border border-line bg-surface p-4";

export const PREVIEW_HEAD = "flex flex-wrap items-center justify-between gap-2";

export const PREVIEW_TITLE = "m-0 text-base font-[650]";

export const PREVIEW_SUMMARY = "m-0 text-xs text-secondary";

/* A preview computed from rules that have since changed says so rather than being quietly wrong. */
export const STALE_NOTE = [
  "m-0 border-l-2 border-l-warn px-2 py-1 text-xs",
  "bg-[color-mix(in_srgb,var(--warn-soft)_55%,transparent)]",
].join(" ");

export const PREVIEW_ITEMS =
  "m-0 grid max-h-[calc(360px*var(--ui-scale))] list-none gap-1 overflow-auto p-0";

export const PREVIEW_ITEM = [
  "grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2 border-b border-line",
  "py-[calc(3px*var(--ui-scale))]",
].join(" ");

export const PREVIEW_PATH = "min-w-0 overflow-hidden text-xs text-ellipsis whitespace-nowrap";

export const PREVIEW_WHY = "text-2xs whitespace-nowrap text-secondary";

/* In place of the folder preview for a source with no folder: where the rules show their effect. */
export const PREVIEW_ELSEWHERE = "self-start rounded-surface border border-line bg-surface p-4";
