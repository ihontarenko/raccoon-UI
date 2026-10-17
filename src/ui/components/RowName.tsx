import type { ReactNode } from "react";

interface RowNameProperties {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}

/**
 * The look a list row's name wears, whether it selects the row or opens it.
 *
 * ⚠️ EXPORTED FOR `RowLink`, which is the same name drawn as a link. Two copies of this string is how
 * a table of names ends up with two weights of ink depending on which component a page reached for.
 */
export const ROW_NAME = [
  "border-0 bg-transparent p-0 text-left font-[550] text-ink [overflow-wrap:anywhere]",
  "hover:text-accent-text aria-pressed:text-accent-text",
  "pointer-coarse:min-h-[44px]",
].join(" ");

/** A list row's name, which selects the row for the inspector beside the list. */
export function RowName({ selected, onSelect, children }: RowNameProperties) {
  return (
    <button type="button" className={ROW_NAME} aria-pressed={selected} onClick={onSelect}>
      {children}
    </button>
  );
}
