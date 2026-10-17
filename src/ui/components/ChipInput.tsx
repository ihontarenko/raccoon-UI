import { useState, type KeyboardEvent } from "react";
import { useTranslation } from "../../translations/TranslationProvider";
import { classNames } from "../../lib/classNames";
import { Button, Icon } from "../primitives";

/* The field draws the border and carries the focus ring for the bare input inside it, so the two
   never ring separately. */
const FIELD = [
  "flex min-h-(--control) flex-wrap items-center gap-1 rounded-control border border-line-strong bg-surface",
  "[padding:calc(3px*var(--ui-scale))_var(--space-2)] focus-within:border-accent-text",
  "data-[disabled=true]:bg-well data-[disabled=true]:text-muted",
].join(" ");

/* `contents`: the chips are a list for a screen reader and no box for the layout, so each chip is a
   flex item of the field itself and wraps with the add field rather than beside it. */
const CHIPS = "m-0 list-none contents p-0";

const CHIP = [
  "inline-flex items-center gap-[calc(2px*var(--ui-scale))] rounded-[calc(4px*var(--ui-scale))]",
  "[padding:calc(1px*var(--ui-scale))_calc(2px*var(--ui-scale))_calc(1px*var(--ui-scale))_var(--space-2)]",
  "bg-accent-soft text-xs text-accent-text",
].join(" ");

const REMOVE = [
  "grid size-[calc(20px*var(--ui-scale))] place-items-center rounded-[calc(3px*var(--ui-scale))]",
  "border-0 bg-transparent p-0 text-inherit hover:bg-[color-mix(in_srgb,var(--accent)_18%,transparent)]",
].join(" ");

const DRAFT_INPUT = [
  "h-[calc(26px*var(--ui-scale))] min-w-[calc(140px*var(--ui-scale))] flex-1 border-0 bg-transparent px-1",
  "text-xs text-ink focus-visible:outline-none",
].join(" ");

interface ChipInputProperties {
  values: string[];
  onChange: (values: string[]) => void;
  /** The list's accessible name, already worded in the viewer's language: "Patterns". */
  listLabel?: string;
  /** The add field's accessible name, and its placeholder once a value exists: "Add a pattern". */
  addLabel?: string;
  /** Each remove button's accessible name: `(value) => t("…", "Remove pattern {value}", { value })`. */
  removeLabel?: (value: string) => string;
  /**
   * What one value is called, composed into English labels: "pattern", "stop word". Kept for screens that are not
   * translated yet; a translated screen passes the three labels above instead.
   */
  noun?: string;
  placeholder?: string;
  /** Monospaced values, for globs, identifiers and code. */
  code?: boolean;
  id?: string;
  "aria-describedby"?: string;
  disabled?: boolean;
}

/**
 * A list of short values as removable chips, with a field that adds them. Enter or a comma adds what
 * was typed; a pasted list is split on commas and new lines; Backspace in an empty field removes the
 * last chip.
 */
export function ChipInput({
  values,
  onChange,
  listLabel,
  addLabel,
  removeLabel,
  noun,
  placeholder,
  code = false,
  id,
  "aria-describedby": describedBy,
  disabled = false,
}: ChipInputProperties) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");

  const listName = listLabel ?? (noun === undefined ? t("chipInput.values", "Values") : `${noun}s`);
  const addName = addLabel ?? (noun === undefined ? t("chipInput.add", "Add a value") : `Add a ${noun}`);
  const removeNameOf = (value: string): string => {
    if (removeLabel !== undefined) {
      return removeLabel(value);
    }
    if (noun !== undefined) {
      return `Remove ${noun} ${value}`;
    }
    return t("chipInput.remove", "Remove {value}", { value });
  };

  const add = (text: string) => {
    const additions = text
      .split(/[,\n]/)
      .map((value) => value.trim())
      .filter((value, index, all) => value.length > 0 && !values.includes(value) && all.indexOf(value) === index);
    if (additions.length > 0) {
      onChange([...values, ...additions]);
    }
    setDraft("");
  };

  const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Backspace" && draft === "" && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  return (
    <div className={FIELD} data-disabled={disabled}>
      <ul className={CHIPS} aria-label={listName}>
        {values.map((value) => (
          <li key={value} className={CHIP}>
            <span className={code ? "numeric" : undefined}>{value}</span>
            <button
              type="button"
              className={REMOVE}
              aria-label={removeNameOf(value)}
              disabled={disabled}
              onClick={() => {
                onChange(values.filter((candidate) => candidate !== value));
              }}
            >
              <Icon name="close" size="small" />
            </button>
          </li>
        ))}
      </ul>
      <input
        id={id}
        className={classNames(DRAFT_INPUT, code && "numeric")}
        value={draft}
        placeholder={values.length === 0 ? placeholder : addName}
        aria-label={addName}
        aria-describedby={describedBy}
        disabled={disabled}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onKeyDown={handleKey}
        onBlur={() => {
          add(draft);
        }}
        onPaste={(event) => {
          const pasted = event.clipboardData.getData("text");
          if (/[,\n]/.test(pasted)) {
            event.preventDefault();
            add(pasted);
          }
        }}
      />
      {draft.trim().length > 0 && (
        <Button
          variant="quiet"
          onClick={() => {
            add(draft);
          }}
        >
          {t("chipInput.addButton", "Add")}
        </Button>
      )}
    </div>
  );
}
