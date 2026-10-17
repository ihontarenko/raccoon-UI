import type { ReactNode } from "react";
import { classNames } from "../../lib/classNames";

export interface SegmentOption<Value extends string> {
  value: Value;
  label: ReactNode;
  count?: number;
  /** An option that exists but cannot be chosen here; say why in `title`. */
  disabled?: boolean;
  title?: string;
}

interface SegmentedProperties<Value extends string> {
  label: string;
  options: SegmentOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
}

/** The strip itself. In a grid or column it keeps to its buttons instead of stretching into an
    empty frame. */
export const SEGMENTED_STRIP = classNames(
  "inline-flex max-w-full flex-wrap gap-[calc(3px*var(--ui-scale))] self-start justify-self-start",
  "rounded-control border border-line-strong bg-well p-[calc(3px*var(--ui-scale))]",
);

/**
 * An option inside the strip, not a control of its own: it measures itself against
 * `--control-option` so a strip of five stays one control's worth of height. Taking the full control
 * height here is what made a wrapped strip of filters taller than the panel it filters.
 *
 * ⚠️ EXPORTED, AND THAT IS THE POINT. The strip has two correct markups — a group of buttons where a
 * press is a filter, and a fieldset of radios where the choice is a setting being saved — and both
 * wear this one look. The appearance menu once kept a copy of these rules and drifted into a taller
 * strip of its own; the shared constant is what stops that happening again. A disabled option is
 * muted and struck through, so it reads as refused rather than missing.
 */
export const SEGMENT = classNames(
  "inline-flex min-h-(--control-option) items-center gap-2 whitespace-nowrap",
  "[padding:calc(3px*var(--ui-scale))_var(--space-2)] rounded-[calc(4px*var(--ui-scale))] border-0 bg-transparent",
  "text-xs font-semibold text-secondary not-disabled:hover:text-ink",
  "disabled:cursor-not-allowed disabled:text-muted disabled:line-through disabled:opacity-60",
);

/** The chosen option, when the strip is a group of buttons and the press is the state. */
export const SEGMENT_PRESSED =
  "aria-pressed:bg-accent-soft aria-pressed:text-ink aria-pressed:shadow-[inset_0_0_0_1px_var(--accent-line)]";

/**
 * The chosen option, when the strip is a fieldset of radios: the state lives on the input, so the
 * label reads it as its peer. The focus ring moves across the same way — the input itself is
 * visually hidden, and a ring nobody can see is a keyboard user with no idea where they are.
 */
export const SEGMENT_PRESSED_BY_PEER = classNames(
  "peer-checked:bg-accent-soft peer-checked:text-ink peer-checked:shadow-[inset_0_0_0_1px_var(--accent-line)]",
  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-text",
);

/** The count beside an option's label — a quieter figure, never a second label. */
export const SEGMENT_COUNT = "font-medium text-muted";

/** A row of mutually exclusive filter buttons; the pressed one is announced as pressed. */
export function Segmented<Value extends string>({ label, options, value, onChange }: SegmentedProperties<Value>) {
  return (
    <div className={SEGMENTED_STRIP} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={classNames(SEGMENT, SEGMENT_PRESSED)}
          aria-pressed={option.value === value}
          disabled={option.disabled}
          title={option.title}
          onClick={() => {
            onChange(option.value);
          }}
        >
          {option.label}
          {option.count !== undefined && (
            <span className={classNames(SEGMENT_COUNT, "numeric")}>{option.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
