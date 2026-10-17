// Presentation formatting shared by every page, so a date, a size or an identifier reads the same
// wherever it appears. Dates and numbers follow the viewer's interface language; the formatters are
// built once per locale and rebuilt only when the language changes.

import { currentLocale, translate, translateDeclared, type DeclaredText } from "../translations/translate";

interface LocaleFormatters {
  locale: string;
  dateTime: Intl.DateTimeFormat;
  wholeNumber: Intl.NumberFormat;
}

let formatters: LocaleFormatters | null = null;

function formattersForCurrentLocale(): LocaleFormatters {
  const locale = currentLocale();
  if (formatters === null || formatters.locale !== locale) {
    formatters = {
      locale,
      dateTime: new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
      wholeNumber: new Intl.NumberFormat(locale),
    };
  }
  return formatters;
}

export function formatDateTime(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : formattersForCurrentLocale().dateTime.format(date);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }
  return formattersForCurrentLocale().wholeNumber.format(value);
}

export function formatBytes(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }
  const units = [
    translate("common.units.bytes", "B"),
    translate("common.units.kilobytes", "KB"),
    translate("common.units.megabytes", "MB"),
    translate("common.units.gigabytes", "GB"),
    translate("common.units.terabytes", "TB"),
  ];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const digits = unitIndex === 0 || size >= 10 ? 0 : 1;
  const number = new Intl.NumberFormat(currentLocale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(size);
  return `${number} ${units[unitIndex]}`;
}

/** The first block of a UUID: enough to tell records apart at a glance; the full value stays copyable. */
export function shortIdentifier(identifier: string): string {
  return identifier.split("-")[0] ?? identifier;
}

/** `DOCUMENT_PARSE` → `Document parse`, for enum values shown as labels. */
export function humanizeConstant(value: string): string {
  const words = value
    .toLowerCase()
    .split(/[_.-]+/)
    .filter((word) => word.length > 0);
  const sentence = words.join(" ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/**
 * A server code's words, one table per enum: `{ QUEUED: declareText("jobs.status.queued", "Queued"), … }`. A table
 * is declared at module level, so it holds keys rather than words, and the words are read in the viewer's language
 * at the moment of rendering.
 */
export type CodeLabels = Readonly<Record<string, DeclaredText>>;

/**
 * The label a code is shown with. A code the table does not list yet — the server learned a new one before the
 * interface did — is still readable, humanized from the constant, rather than missing.
 */
export function labelOfCode(labels: CodeLabels, code: string): string {
  const declared = labels[code];
  if (declared === undefined) {
    return humanizeConstant(code);
  }
  return translateDeclared(declared);
}

/**
 * `1 account`, `3 accounts` — a count with the English noun that agrees with it. English rules only: a translated
 * screen counts with `plural(…)` from `useTranslation`, which picks the form by the viewer's language.
 */
export function countOf(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

/**
 * Indexed text as a one-paragraph preview: Markdown markers removed, links reduced to their words,
 * whitespace collapsed. A chunk window may begin inside a word, so a leading fragment — text that
 * starts in lower case — is dropped up to the next space and the cut is marked with an ellipsis.
 */
export function plainExcerpt(text: string): string {
  const plain = text
    .replace(/```[^\n]*\n?/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/gm, "")
    .replace(/(\*\*|__|\*|`|~~)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/^\p{Ll}/u.test(plain)) {
    const firstSpace = plain.indexOf(" ");
    return firstSpace === -1 ? plain : `…${plain.slice(firstSpace + 1)}`;
  }
  return plain;
}

const ELAPSED_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
  ["second", 1_000],
];

/** "3 minutes ago", in the interface's language; empty for no moment at all. */
export function formatElapsed(value: string | null | undefined, language: string): string {
  if (value === null || value === undefined) {
    return "";
  }
  const milliseconds = Date.now() - new Date(value).getTime();
  const format = new Intl.RelativeTimeFormat(language, { numeric: "auto" });
  for (const [unit, size] of ELAPSED_UNITS) {
    if (Math.abs(milliseconds) >= size || unit === "second") {
      return format.format(-Math.round(milliseconds / size), unit);
    }
  }
  return "";
}
