import type { ReactNode, Ref, SelectHTMLAttributes } from "react";
import { classNames } from "../../../lib/classNames";

interface SelectProperties extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> {
  invalid?: boolean;
  fullWidth?: boolean;
  className?: string;
  ref?: Ref<HTMLSelectElement>;
  children: ReactNode;
}

/*
 * ⚠️ `bg-surface` IS NOT INTERCHANGEABLE WITH A WELL HERE. A native <select> paints its own popup
 * list from the control background, so a translucent or tinted token leaves the open list unreadable
 * on some platforms. The fill has to be an opaque surface token.
 */
const FIELD = [
  "field-chevron appearance-none max-w-full min-h-(--control) rounded-control border border-line-strong bg-surface text-ink",
  "[padding:calc(5px*var(--ui-scale))_calc(30px*var(--ui-scale))_calc(5px*var(--ui-scale))_calc(9px*var(--ui-scale))]",
  "not-disabled:not-aria-invalid:hover:border-accent-text",
  "aria-invalid:border-danger disabled:opacity-55",
].join(" ");

export function Select({
  invalid,
  fullWidth,
  className,
  ref: reference,
  children,
  ...rest
}: SelectProperties) {
  return (
    <select
      ref={reference}
      className={classNames(FIELD, fullWidth && "w-full", className)}
      aria-invalid={invalid === true ? true : undefined}
      {...rest}
    >
      {children}
    </select>
  );
}
