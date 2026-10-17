import type { Ref, TextareaHTMLAttributes } from "react";
import { classNames } from "../../../lib/classNames";

interface TextAreaProperties extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> {
  invalid?: boolean;
  /** Monospaced, tab-friendly and unwrapped — for code such as a jMS script. */
  code?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
}

const FIELD = [
  "w-full resize-y rounded-control border border-line-strong bg-surface px-3 py-2 text-ink leading-[1.55]",
  "not-disabled:not-aria-invalid:hover:border-accent-text aria-invalid:border-danger",
].join(" ");

/* Height comes from `rows`: a one-line JSON value and a script are both code, at very different
   sizes. The fill stays the same surface as every other field — a well reads as disabled in the
   light theme. */
const CODE = "min-h-0 font-mono text-xs whitespace-pre [tab-size:4]";

export function TextArea({ invalid, code = false, ref: reference, ...rest }: TextAreaProperties) {
  return (
    <textarea
      ref={reference}
      className={classNames(FIELD, code ? CODE : "min-h-[calc(96px*var(--ui-scale))]")}
      aria-invalid={invalid === true ? true : undefined}
      spellCheck={code ? false : undefined}
      {...rest}
    />
  );
}
