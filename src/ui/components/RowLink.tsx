import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { classNames } from "../../lib/classNames";
import { ROW_NAME } from "./RowName";

/**
 * A list row's name that opens the item: drawn like {@link RowName}, and stretched over its row so the whole row is
 * the link. Another link or button in the row stays clickable above it.
 *
 * ⚠️ `rc-row-link` is component CSS rather than a utility — see `styles/components.css`. It has to
 * be, because the rules it carries style the `<tr>` around this link and every other control inside
 * that row, and a page writes those, not this component.
 */
export function RowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link to={href} className={classNames(ROW_NAME, "rc-row-link no-underline")}>
      {children}
    </Link>
  );
}
