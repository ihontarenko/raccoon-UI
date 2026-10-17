/*
 * A book read in the prose column (`rc-prose`), with what a book has that documentation does not: epigraphs set to the
 * right, poems indented stanza by stanza, a text's author under its passage, pictures centred, note references raised.
 * The classes are the reader's own — `BookMarkup` keeps a publisher's markup only through them — so a book's CSS never
 * reaches this page.
 */
export const BOOK = [
  /* A book is read in the middle of its frame, at a measure a little wider than documentation's: long runs of prose. */
  "[--prose-measure:96ch] [&>article]:mx-auto [&>header]:mx-auto [&>header]:max-w-[96ch] [&>nav:last-child]:mx-auto [&>nav:last-child]:max-w-[96ch]",
  "[&_.book-epigraph]:ml-auto [&_.book-epigraph]:max-w-[min(100%,46ch)] [&_.book-epigraph]:border-l-0 [&_.book-epigraph]:text-secondary [&_.book-epigraph]:italic",
  "[&_.book-poem]:my-4 [&_.book-poem]:pl-[3ch] [&_.book-stanza]:mb-3 [&_.book-stanza>p]:my-0",
  "[&_.book-text-author]:text-right [&_.book-text-author]:text-secondary [&_.book-text-author]:italic",
  "[&_.book-empty-line]:my-0 [&_.book-empty-line]:h-[0.6em]",
  "[&_.book-picture]:mx-auto [&_.book-picture]:my-5 [&_.book-picture]:block [&_.book-picture]:h-auto [&_.book-picture]:max-h-[80dvh] [&_.book-picture]:max-w-full",
  "[&_.book-note-reference]:align-super [&_.book-note-reference]:text-[0.75em] [&_.book-note-reference]:leading-none",
  "[&_.book-subtitle]:text-center [&_.book-subtitle]:font-semibold",
  "[&_.book-title]:mt-10 [&_.book-title]:mb-6 [&_.book-title]:text-center [&_.book-title]:text-xl [&_.book-title]:font-semibold [&_.book-title]:text-ink [&_.book-title>p]:my-1",
].join(" ");

/*
 * The contents and the step to either chapter, held at the top of the frame while the chapter scrolls under it. The bar
 * spans the whole frame, opaque, so nothing of the text shows beside it; its row lines up with the text column.
 *
 * ⚠️ THE ROW IS MEASURED IN THE TEXT'S OWN `ch`. A `ch` is the width of a character in the element's own font size, so a
 * row in the bar's smaller type at 96ch is narrower than the column at 96ch; the row takes the column's size and sets
 * its controls' sizes on them.
 */
/* ⚠️ A sticky element sticks inside its scroller's padding, so text scrolled up shows in the padding above it. The bar
   reaches up into that padding — the frame's top padding is space-5 — and sticks to the frame's very edge. */
export const BOOK_NAVIGATION = [
  "sticky top-[calc(-1*var(--space-5))] z-[1] -mt-[var(--space-5)] mb-4 border-b border-line bg-surface",
  "[padding:calc(var(--space-5)+var(--space-2))_0_var(--space-2)]",
].join(" ");

export const BOOK_NAVIGATION_ROW = [
  "mx-auto flex w-full max-w-[96ch] min-w-0 items-center gap-2 text-(length:--text-base)",
  "[&>select]:min-w-0 [&>select]:flex-1 [&>select]:max-w-[60ch] [&>select]:text-sm",
].join(" ");

export const BOOK_POSITION = "ml-auto text-xs text-muted tabular-nums whitespace-nowrap max-[600px]:hidden";

export const BOOK_HEADER = "mb-8 grid justify-items-center gap-1 border-b border-line pb-6 text-center text-secondary [&>p]:m-0";

export const BOOK_FOOTER = "mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4";
