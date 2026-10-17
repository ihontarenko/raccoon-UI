/**
 * The framed section a processing profile's settings are edited in — shared by the parser settings
 * and the content pipeline, because the two are read one under the other on the same screen and a
 * difference between them would read as a difference in kind.
 */

export const SECTION = [
  "m-0 grid min-w-0 gap-3 rounded-surface border border-line bg-surface",
  "[padding:var(--space-4)_var(--space-5)_var(--space-5)] [&>p]:m-0",
  "max-[720px]:[padding:var(--space-3)_var(--space-4)_var(--space-4)]",
].join(" ");

/*
 * ⚠️ FLOATED, AND THE NEXT ELEMENT CLEARS IT. A `<legend>` in a `<fieldset>` whose layout is a grid
 * is placed by the browser outside the grid's flow; floating it and clearing the element after is
 * what puts the heading on its own line in every engine. `[&+*]:clear-both` compiles to
 * "the element after this one", which is exactly what the rule needs to say.
 */
export const SECTION_TITLE = "float-left w-full p-0 text-base font-[650] [&+*]:clear-both";

export const SECTION_LINK = "text-accent-text";

/** A row of controls for something the profile is not using — the offer to start using it. */
export const UNUSED_ROW = "flex flex-wrap items-center gap-2";
