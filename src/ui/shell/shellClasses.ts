/**
 * The frame's own looks, in one file because three components wear them.
 *
 * ⚠️ THEY ARE HERE RATHER THAN INLINE FOR ONE REASON: `AppShell`, `Rail` and `Topbar` are three files
 * drawing ONE frame, and the public frame reuses the signed-in frame's topbar and brand. The CSS
 * Module these replace said that with `composes:`; a shared constant is how it is said now. Anything
 * only one of the three uses stays in that file, where it is read next to its markup.
 *
 * ⚠️ 1000px IS THE DRAWER THRESHOLD and it is named in four places below — the shell's columns, the
 * rail's position, the menu button and the scrim. They are one decision and have to move together.
 */

/** The two columns of the signed-in frame; below the drawer threshold, the rail leaves the grid. */
export const SHELL = [
  "grid min-h-[100dvh] grid-cols-[var(--rail)_minmax(0,1fr)]",
  "max-[1000px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

/** The frame of a public page for a visitor without a session: no rail, the brand and a way in. */
export const PUBLIC_FRAME = "grid min-h-[100dvh] grid-rows-[auto_1fr]";

/** Parked off the top of the window until it takes the focus, which is the whole mechanism. */
export const SKIP_LINK = [
  "fixed top-[calc(-60px*var(--ui-scale))] left-4 z-60 rounded-control border border-line-strong",
  "bg-surface p-3 focus:top-2",
].join(" ");

/*
 * The rail is a column on a wide screen and a drawer on a narrow one. ⚠️ `invisible` as well as the
 * transform: a drawer that is only moved out of view is still in the tab order, so a keyboard would
 * walk into a navigation nobody can see.
 */
export const RAIL = [
  "sticky top-0 flex h-[100dvh] flex-col gap-6 overflow-y-auto border-r border-line bg-side",
  "[padding:var(--space-5)_var(--space-3)_var(--space-3)]",
  "max-[1000px]:fixed max-[1000px]:inset-y-0 max-[1000px]:left-0 max-[1000px]:z-50",
  "max-[1000px]:w-[min(calc(280px*var(--ui-scale)),86vw)]",
  "max-[1000px]:invisible max-[1000px]:-translate-x-full",
  "max-[1000px]:transition-[transform,visibility] max-[1000px]:duration-120",
  "max-[1000px]:data-[open=true]:visible max-[1000px]:data-[open=true]:translate-x-0",
].join(" ");

/** The scrim behind the open drawer. It exists only below the threshold. */
export const SCRIM = [
  "hidden",
  "max-[1000px]:fixed max-[1000px]:inset-0 max-[1000px]:z-45 max-[1000px]:block",
  "max-[1000px]:border-0 max-[1000px]:bg-scrim",
].join(" ");

/** The mark and the wordmark. The padding belongs to the place it sits in, not to the lockup. */
export const BRAND = "flex items-center gap-[calc(10px*var(--ui-scale))] text-ink no-underline";

export const COLUMN = "flex min-w-0 flex-col";

export const TOPBAR = [
  "sticky top-0 z-20 flex h-[calc(52px*var(--ui-scale))] items-center justify-between gap-3",
  "border-b border-line bg-surface px-8",
  "max-[1200px]:px-6 max-[700px]:px-4",
].join(" ");

export const TOPBAR_SIDE = "flex min-w-0 items-center gap-2";

/*
 * ⚠️ 1680px IS A MEASURE, NOT A MAXIMUM FOR ITS OWN SAKE. The product is read as tables and
 * inspectors; past this width a row's first and last cell stop being one glance apart.
 */
export const MAIN = [
  "mx-auto w-full max-w-[calc(1680px*var(--ui-scale))] flex-1 p-8 focus:outline-none",
  "max-[1200px]:p-6 max-[700px]:[padding:var(--space-5)_var(--space-4)]",
  /* A page that IS its workspace (the Library) takes the whole column: no margin, no measure, no frame around it. */
  "has-[[data-page-flush]]:max-w-none has-[[data-page-flush]]:p-0!",
].join(" ");

/** One centred panel on an otherwise empty page: restoring a session, or failing to. */
export const STANDALONE = [
  "grid min-h-[100dvh] content-center justify-items-center",
  "[padding:var(--space-5)_var(--space-4)] [&>*]:w-[min(640px,100%)]",
].join(" ");
