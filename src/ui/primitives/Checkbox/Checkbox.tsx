import type { InputHTMLAttributes, ReactNode } from "react";
import { classNames } from "../../../lib/classNames";

interface CheckboxProperties extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> {
  label: ReactNode;
  /** A quieter second line under the label, explaining what ticking it means. */
  hint?: ReactNode;
}

/* A finger is not a cursor: on a touch screen the whole line is a target of its own height, and the
   label is centred in it rather than hung from the top of a box twice the text. */
const LABEL = classNames(
  "inline-flex cursor-pointer items-start gap-2 text-sm text-ink",
  "pointer-coarse:min-h-[44px] pointer-coarse:items-center",
);

/* `peer` is what carries the disabled look across to the text: a disabled box fades its own label
   rather than leaving a full-strength line next to a greyed control. */
const BOX =
  "peer mt-[calc(2px*var(--ui-scale))] size-[calc(16px*var(--ui-scale))] flex-none cursor-pointer accent-[var(--accent-text)] disabled:cursor-default disabled:opacity-55";

const TEXT =
  "grid gap-[calc(2px*var(--ui-scale))] peer-disabled:cursor-default peer-disabled:opacity-55";

/** A native checkbox with its label as the click target, so the whole line toggles it. */
export function Checkbox({ label, hint, ...rest }: CheckboxProperties) {
  return (
    <label className={LABEL}>
      <input type="checkbox" className={BOX} {...rest} />
      <span className={TEXT}>
        <span>{label}</span>
        {hint !== undefined && <span className="text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}
