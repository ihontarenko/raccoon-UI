import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useTranslation } from "../../translations/TranslationProvider";
import { Button, Input } from "../primitives";

/* A label above a trigger drawn like a select, and a panel under it: the usual periods, then two
   typed days. The trigger is a `group` so the value inside can read whether a period was chosen —
   an unchosen one reads "Any time" in the quieter ink of a placeholder. */
const TRIGGER = [
  "group field-chevron flex min-h-(--control) min-w-0 items-center rounded-control border border-line-strong",
  "[padding:calc(5px*var(--ui-scale))_calc(30px*var(--ui-scale))_calc(5px*var(--ui-scale))_calc(9px*var(--ui-scale))]",
  "bg-surface text-left text-ink hover:border-accent-text",
].join(" ");

const VALUE = [
  "overflow-hidden text-ellipsis whitespace-nowrap [font-variant-numeric:tabular-nums]",
  "group-data-[chosen=false]:text-secondary",
].join(" ");

const PANEL = [
  "absolute top-[calc(100%+4px)] left-0 z-30 grid w-max gap-3 p-3",
  "max-w-[min(calc(360px*var(--ui-scale)),calc(100vw-2*var(--space-4)))]",
  "rounded-control border border-line-strong bg-surface",
].join(" ");

interface DateRangeFieldProperties {
  /** The visible label above the control; it also names the trigger and the panel. */
  label: string;
  /** ISO days (`2026-10-05`); `until` is inclusive. */
  from?: string;
  until?: string;
  onChange: (range: { from?: string; until?: string }) => void;
}

/** A day written in the interface's own order and separator — `05.10.2026` in Ukrainian. */
interface DayFormat {
  order: ("day" | "month" | "year")[];
  separator: string;
}

function dayFormatOf(locale: string): DayFormat {
  const parts = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(
    new Date(2026, 9, 5),
  );
  const order = parts
    .map((part) => part.type)
    .filter((type): type is "day" | "month" | "year" => type === "day" || type === "month" || type === "year");
  const separator = parts.find((part) => part.type === "literal")?.value.trim() || ".";
  return { order: order.length === 3 ? order : ["day", "month", "year"], separator };
}

function writeDay(isoDay: string | undefined, format: DayFormat): string {
  if (isoDay === undefined) {
    return "";
  }
  const [year, month, day] = isoDay.split("-");
  const values = { day, month, year };
  return format.order.map((part) => values[part]).join(format.separator);
}

/** The typed day as ISO, or null when it is not a real day in this format. Blank is `undefined`. */
function readDay(typed: string, format: DayFormat): string | undefined | null {
  const trimmed = typed.trim();
  if (trimmed === "") {
    return undefined;
  }
  const pieces = trimmed.split(/[^0-9]+/).filter((piece) => piece !== "");
  if (pieces.length !== 3) {
    return null;
  }
  const values: Record<"day" | "month" | "year", number> = { day: 0, month: 0, year: 0 };
  format.order.forEach((part, index) => {
    values[part] = Number(pieces[index]);
  });
  const date = new Date(Date.UTC(values.year, values.month - 1, values.day));
  if (values.year < 1000 || date.getUTCFullYear() !== values.year || date.getUTCMonth() !== values.month - 1 || date.getUTCDate() !== values.day) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function isoDayBefore(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * A period of days as one control: the trigger reads the chosen period in the interface's own date format, and a
 * small panel offers the usual periods and two typed days. Native date inputs are not used because they draw the
 * browser's format — `mm/dd/yyyy` inside a Ukrainian interface. Escape and a click outside close the panel and
 * return focus to the trigger.
 */
export function DateRangeField({ label, from, until, onChange }: DateRangeFieldProperties) {
  const { t, locale } = useTranslation();
  const format = dayFormatOf(locale);
  const placeholder = format.order
    .map((part) =>
      part === "day"
        ? t("components.dateRange.dayLetters", "dd")
        : part === "month"
          ? t("components.dateRange.monthLetters", "mm")
          : t("components.dateRange.yearLetters", "yyyy"),
    )
    .join(format.separator);
  const [open, setOpen] = useState(false);
  const [fromDraft, setFromDraft] = useState("");
  const [untilDraft, setUntilDraft] = useState("");
  const [invalid, setInvalid] = useState<"from" | "until" | "order" | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const labelId = useId();
  const errorId = useId();

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    setFromDraft(writeDay(from, format));
    setUntilDraft(writeDay(until, format));
    setInvalid(null);
    const closeOutside = (event: PointerEvent) => {
      if (container.current !== null && !container.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    container.current?.querySelector<HTMLElement>("[data-first]")?.focus();
    return () => document.removeEventListener("pointerdown", closeOutside);
    // The drafts start from the chosen period each time the panel opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const choose = (range: { from?: string; until?: string }) => {
    onChange(range);
    close();
  };
  const apply = (event: FormEvent) => {
    event.preventDefault();
    const chosenFrom = readDay(fromDraft, format);
    const chosenUntil = readDay(untilDraft, format);
    if (chosenFrom === null) {
      setInvalid("from");
      return;
    }
    if (chosenUntil === null) {
      setInvalid("until");
      return;
    }
    if (chosenFrom !== undefined && chosenUntil !== undefined && chosenUntil < chosenFrom) {
      setInvalid("order");
      return;
    }
    choose({ from: chosenFrom, until: chosenUntil });
  };
  const closeOnEscape = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  };

  // An open end reads as a word rather than an ellipsis, so the period fits a narrow control: "from 06.09.2026".
  const chosen =
    from === undefined && until === undefined
      ? t("components.dateRange.anyTime", "Any time")
      : until === undefined
        ? t("components.dateRange.since", "from {day}", { day: writeDay(from, format) })
        : from === undefined
          ? t("components.dateRange.till", "until {day}", { day: writeDay(until, format) })
          : `${writeDay(from, format)} – ${writeDay(until, format)}`;
  const problem =
    invalid === "order"
      ? t("components.dateRange.orderProblem", "The period ends before it starts.")
      : invalid === null
        ? null
        : t("components.dateRange.dayProblem", "Write the day as {pattern}.", { pattern: placeholder });

  return (
    <div className="relative grid min-w-0 gap-1" ref={container} onKeyDown={closeOnEscape}>
      <span id={labelId} className="text-xs text-secondary">
        {label}
      </span>
      <button
        ref={trigger}
        type="button"
        className={TRIGGER}
        aria-labelledby={`${labelId} ${panelId}-value`}
        aria-expanded={open}
        aria-controls={panelId}
        data-chosen={from !== undefined || until !== undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <span id={`${panelId}-value`} className={VALUE}>
          {chosen}
        </span>
      </button>
      {open && (
        <div id={panelId} className={PANEL} role="group" aria-labelledby={labelId}>
          <div className="flex flex-wrap gap-1 border-b border-line pb-2">
            <Button variant="quiet" data-first onClick={() => choose({ from: isoDayBefore(0), until: undefined })}>
              {t("components.dateRange.today", "Today")}
            </Button>
            <Button variant="quiet" onClick={() => choose({ from: isoDayBefore(6), until: undefined })}>
              {t("components.dateRange.lastWeek", "Last 7 days")}
            </Button>
            <Button variant="quiet" onClick={() => choose({ from: isoDayBefore(29), until: undefined })}>
              {t("components.dateRange.lastMonth", "Last 30 days")}
            </Button>
            <Button variant="quiet" onClick={() => choose({})}>
              {t("components.dateRange.anyTime", "Any time")}
            </Button>
          </div>
          <form
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2"
            onSubmit={apply}
            noValidate
          >
            <label className="grid min-w-0 gap-1">
              <span className="text-xs text-secondary">{t("components.dateRange.from", "From")}</span>
              <Input
                className="numeric"
                fullWidth
                inputMode="numeric"
                placeholder={placeholder}
                value={fromDraft}
                invalid={invalid === "from" || invalid === "order"}
                aria-describedby={problem === null ? undefined : errorId}
                onChange={(event) => setFromDraft(event.target.value)}
              />
            </label>
            <label className="grid min-w-0 gap-1">
              <span className="text-xs text-secondary">{t("components.dateRange.until", "To")}</span>
              <Input
                className="numeric"
                fullWidth
                inputMode="numeric"
                placeholder={placeholder}
                value={untilDraft}
                invalid={invalid === "until" || invalid === "order"}
                aria-describedby={problem === null ? undefined : errorId}
                onChange={(event) => setUntilDraft(event.target.value)}
              />
            </label>
            <Button type="submit" variant="primary">
              {t("components.dateRange.apply", "Apply")}
            </Button>
            {problem !== null && (
              <p id={errorId} className="col-span-full m-0 text-xs text-danger" role="alert">
                {problem}
              </p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
