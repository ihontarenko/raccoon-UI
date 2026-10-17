import { Fragment, createElement, isValidElement, type ReactNode } from "react";
import { translations, type LanguageChoice } from "../lib/translations";

// What the interface says, in the language the viewer chose.
//
// Every text is written `t("area.name", "English")`, and the English is not decoration: it is what shows for a
// key the chosen language has no text for, and in the moment before the server has answered. It is also the
// catalogue — `npm run texts:extract` reads these calls and writes the server's `translations/en/interface.json`,
// so a key and its English are written in exactly one place, the call. That is why a key is always a literal: a
// text chosen by a value is declared up front with `declareText("key", "English")` and rendered with `say(…)`.
//
// The state is module-level, not only in a context: a toast, a problem description and a formatter are not
// components, and they read the same held texts through `translate`. Components read them through
// `useTranslation`, which re-renders them when the language changes.

/** The language this interface is written in, and the one it falls back to. */
export const SOURCE_LANGUAGE = "en";

const STORAGE_KEY = "raccoon.language";

export type TextValue = string | number;

/** A text declared before it can be rendered — a navigation label, a kind's name in a table. */
export interface DeclaredText {
  readonly key: string;
  readonly fallback: string;
}

/** English needs `one` and `other`; the other forms a language needs come from the server. */
export interface PluralForms {
  one: string;
  other: string;
}

export interface HeldTranslations {
  /** The language the texts are in — what dates, numbers and plurals are formatted by. */
  language: string;
  texts: Record<string, string>;
  /** The languages a viewer may choose; empty until the server has answered. */
  choices: LanguageChoice[];
}

let held: HeldTranslations = { language: SOURCE_LANGUAGE, texts: {}, choices: [] };
const listeners = new Set<() => void>();

/**
 * Declares a text without rendering it, for a module-level table. Rendering it there would fix it in whatever
 * language was held when the module loaded.
 */
export function declareText(key: string, fallback: string): DeclaredText {
  return { key, fallback };
}

export function currentLanguage(): string {
  return held.language;
}

/** The locale numbers and dates are formatted in. English keeps the day-month order the interface was drawn with. */
export function currentLocale(): string {
  return held.language === SOURCE_LANGUAGE ? "en-GB" : held.language;
}

/** A plain text with its placeholders filled. For code outside a component — a toast, a problem description. */
export function translate(key: string, fallback: string, values?: Record<string, TextValue>): string {
  return fill(held.texts[key] ?? fallback, values);
}

export function translateDeclared(declared: DeclaredText, values?: Record<string, TextValue>): string {
  return translate(declared.key, declared.fallback, values);
}

/**
 * A counted text; `{count}` is filled with the count formatted in the held language.
 *
 * The form is chosen by the language the text is in: Ukrainian picks among one, few, many and other, English among
 * one and other. When the held language has no text for the key, the English fallback is chosen by English rules.
 */
export function translatePlural(
  key: string,
  count: number,
  forms: PluralForms,
  values?: Record<string, TextValue>,
): string {
  const filled = { ...values, count: new Intl.NumberFormat(currentLocale()).format(count) };
  const category = new Intl.PluralRules(held.language).select(count);
  const own = held.texts[`${key}.${category}`] ?? held.texts[`${key}.other`];
  if (own !== undefined) {
    return fill(own, filled);
  }
  const englishCategory = new Intl.PluralRules(SOURCE_LANGUAGE).select(count);
  return fill(englishCategory === "one" ? forms.one : forms.other, filled);
}

/**
 * A text with React nodes in its placeholders — a sentence with a link or a code element in the middle. The node
 * goes where the TRANSLATION puts `{name}`, because word order is the first thing that changes between languages.
 */
export function translateNodes(key: string, fallback: string, values: Record<string, ReactNode>): ReactNode {
  const template = held.texts[key] ?? fallback;
  const pieces = template.split(/(\{\w+\})/);
  return createElement(
    Fragment,
    null,
    ...pieces.map((piece, index) => {
      const name = /^\{(\w+)\}$/.exec(piece)?.[1];
      const value = name !== undefined && name in values ? values[name] : piece;
      return createElement(Fragment, { key: index }, value);
    }),
  );
}

export function holdsNodes(values: Record<string, unknown> | undefined): values is Record<string, ReactNode> {
  if (values === undefined) {
    return false;
  }
  return Object.values(values).some((value) => isValidElement(value) || Array.isArray(value));
}

function fill(template: string, values: Record<string, TextValue> | undefined): string {
  if (values === undefined) {
    return template;
  }
  // An unknown placeholder is left as it is: a translator who wrote `{name}` where the screen sends `{title}`
  // should see the mistake on the screen rather than have it vanish.
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in values ? String(values[name]) : placeholder,
  );
}

/* ── Holding and loading ──────────────────────────────────────────────── */

export function subscribeToTranslations(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function heldTranslations(): HeldTranslations {
  return held;
}

function adopt(next: HeldTranslations): void {
  held = next;
  document.documentElement.lang = next.language;
  listeners.forEach((listener) => {
    listener();
  });
}

function storedLanguage(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeLanguage(code: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Remembering is best-effort; the choice still holds for this page.
  }
}

let generation = 0;

/**
 * Asks which languages exist, picks the viewer's choice (else the installation's default), and holds its texts.
 *
 * A failure keeps what is held: English is always underneath, so a server that did not answer leaves the screen
 * readable rather than blank. Two loads can finish in either order, and the older answer never wins.
 */
export async function loadTranslations(preferred?: string): Promise<void> {
  const mine = ++generation;
  try {
    const choices = await translations.choices();
    const wanted = preferred ?? storedLanguage();
    const choice =
      choices.languages.find((language) => language.code === wanted) ??
      choices.languages.find((language) => language.code === choices.defaultLanguage);
    if (choice === undefined) {
      if (mine === generation) {
        adopt({ language: SOURCE_LANGUAGE, texts: {}, choices: choices.languages });
      }
      return;
    }
    const dictionary = await translations.dictionary(choice.code, choice.version);
    if (mine === generation) {
      adopt({ language: dictionary.language, texts: dictionary.texts, choices: choices.languages });
    }
  } catch {
    // Held texts stay; English is underneath them.
  }
}

/** Switches this viewer's language and remembers it in this browser. */
export async function chooseLanguage(code: string): Promise<void> {
  storeLanguage(code);
  await loadTranslations(code);
}
