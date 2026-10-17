import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { LanguageChoice } from "../lib/translations";
import {
  chooseLanguage,
  currentLocale,
  heldTranslations,
  holdsNodes,
  loadTranslations,
  subscribeToTranslations,
  translate,
  translateDeclared,
  translateNodes,
  translatePlural,
  type DeclaredText,
  type PluralForms,
  type TextValue,
} from "./translate";

// The interface's language, held for every screen.
//
// The first paint waits, briefly: drawing at once would show every screen in English and repaint it a moment later
// in Ukrainian, which is the flash a viewer who chose Ukrainian notices on every reload. The tree is held until the
// first answer, but never longer than `LONGEST_WAIT` — a server that is down must still let the problem page say so,
// and English is always underneath.

const LONGEST_WAIT = 1_500;

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    const giveUp = window.setTimeout(() => {
      setReady(true);
    }, LONGEST_WAIT);
    void loadTranslations().finally(() => {
      if (live) {
        setReady(true);
      }
    });
    return () => {
      live = false;
      window.clearTimeout(giveUp);
    };
  }, []);

  if (!ready) {
    return null;
  }
  return children;
}

/** Fills a text's placeholders; with a React node among the values, answers a node. */
export interface Translate {
  (key: string, fallback: string, values?: Record<string, TextValue>): string;
  (key: string, fallback: string, values: Record<string, ReactNode>): ReactNode;
}

export interface Translation {
  /** `t("area.name", "English", { name })` — the English is the fallback AND the catalogue. */
  t: Translate;
  /** `plural("area.documents", count, { one: "{count} document", other: "{count} documents" })`. */
  plural: (key: string, count: number, forms: PluralForms, values?: Record<string, TextValue>) => string;
  /** A text declared up front with `declareText(…)`. */
  say: (declared: DeclaredText, values?: Record<string, TextValue>) => string;
  /** The language the texts are in — `uk`, `en`. */
  language: string;
  /** The locale numbers and dates are formatted in. */
  locale: string;
  /** The languages a viewer may choose. */
  choices: LanguageChoice[];
  /** Switches this viewer's language and remembers it in this browser. */
  choose: (code: string) => Promise<void>;
}

/**
 * The texts, and a re-render whenever they change. The functions change identity with the language on purpose, so
 * a memo or an effect that depends on `t` recomputes instead of holding a label in the old language.
 */
export function useTranslation(): Translation {
  const held = useSyncExternalStore(subscribeToTranslations, heldTranslations);

  return useMemo(() => {
    const t = ((key: string, fallback: string, values?: Record<string, TextValue | ReactNode>) =>
      holdsNodes(values)
        ? translateNodes(key, fallback, values)
        : translate(key, fallback, values as Record<string, TextValue> | undefined)) as Translate;

    return {
      t,
      plural: (key, count, forms, values) => translatePlural(key, count, forms, values),
      say: (declared, values) => translateDeclared(declared, values),
      language: held.language,
      locale: currentLocale(),
      choices: held.choices,
      choose: chooseLanguage,
    };
  }, [held]);
}
