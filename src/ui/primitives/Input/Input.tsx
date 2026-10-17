import type { InputHTMLAttributes, Ref } from "react";
import { classNames } from "../../../lib/classNames";

interface InputProperties extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  invalid?: boolean;
  fullWidth?: boolean;
  className?: string;
  ref?: Ref<HTMLInputElement>;
}

/*
 * ⚠️ `not-disabled:not-aria-invalid:hover:` RATHER THAN A PLAIN `hover:`, because an invalid field
 * already owns its border colour: without the two exclusions, pointing at a field the server has
 * just refused repaints its red edge accent-blue and the refusal disappears under the cursor.
 */
const FIELD = [
  "max-w-full min-h-(--control) rounded-control border border-line-strong bg-surface text-ink",
  "[padding:calc(5px*var(--ui-scale))_calc(9px*var(--ui-scale))]",
  "placeholder:text-muted",
  "not-disabled:not-aria-invalid:hover:border-accent-text",
  "aria-invalid:border-danger disabled:opacity-55",
].join(" ");

export function Input({ invalid, fullWidth, className, ref: reference, ...rest }: InputProperties) {
  return (
    <input
      ref={reference}
      className={classNames(FIELD, fullWidth && "w-full", className)}
      aria-invalid={invalid === true ? true : undefined}
      {...rest}
    />
  );
}
