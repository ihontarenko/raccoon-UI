// The interface's words as the server holds them. Reading is public — the sign-in page speaks the viewer's
// language before anybody is signed in. Administration needs `system:read`, and changes `system:write`.
// Mirrors `translations/Translations` and `translations/TranslationAdministration` field for field.

import { api } from "./api";

export interface LanguageChoice {
  code: string;
  /** What the language calls itself — "Українська". What a chooser shows. */
  nativeName: string;
  englishName: string;
  /** Changes whenever the language's dictionary does; the dictionary is cached against it. */
  version: string;
}

export interface LanguageChoices {
  defaultLanguage: string;
  languages: LanguageChoice[];
}

export interface Dictionary {
  language: string;
  version: string;
  /** Only what the language HAS: a key absent here is shown in the English the code carries. */
  texts: Record<string, string>;
}

export interface LanguageProgress {
  code: string;
  nativeName: string;
  englishName: string;
  enabled: boolean;
  /** The installation's default. */
  primary: boolean;
  /** Arrives with the release, and so cannot be removed — only disabled. */
  shipped: boolean;
  revision: number;
  catalogueSize: number;
  translated: number;
  edited: number;
  version: string;
}

export type EntryState = "SHIPPED" | "EDITED" | "MISSING";

export interface TranslationEntry {
  key: string;
  /** English — the catalogue's wording, and what every screen shows in a gap. */
  source: string;
  text: string | null;
  /** What the release ships for this key in this language — what clearing an edit goes back to. */
  shipped: string | null;
  state: EntryState;
}

export interface MissingEntry {
  key: string;
  source: string;
}

export interface ImportOutcome {
  changed: number;
  unchanged: number;
  skipped: number;
  unknownCount: number;
  unknownKeys: string[];
}

const ADMINISTRATION = "/v1/administration/translations";

function languagePath(code: string, suffix = ""): string {
  return `${ADMINISTRATION}/languages/${encodeURIComponent(code)}${suffix}`;
}

export const translations = {
  choices: () => api.send<LanguageChoices>("GET", "/v1/translations/languages"),

  /** Asked with the version the listing named, so the browser may keep it for as long as the version holds. */
  dictionary: (code: string, version: string) =>
    api.send<Dictionary>(
      "GET",
      `/v1/translations/languages/${encodeURIComponent(code)}/dictionary?version=${encodeURIComponent(version)}`,
    ),

  languages: () => api.send<LanguageProgress[]>("GET", `${ADMINISTRATION}/languages`),

  addLanguage: (language: { code: string; nativeName: string; englishName: string }) =>
    api.send<LanguageProgress>("POST", `${ADMINISTRATION}/languages`, language),

  changeLanguage: (
    code: string,
    change: { nativeName: string; englishName: string; enabled: boolean; revision: number },
  ) => api.send<LanguageProgress>("PUT", languagePath(code), change),

  makeDefault: (code: string) => api.send<LanguageProgress>("PUT", `${ADMINISTRATION}/default`, { code }),

  removeLanguage: (code: string) => api.send<void>("DELETE", languagePath(code)),

  entries: (code: string) => api.send<TranslationEntry[]>("GET", languagePath(code, "/entries")),

  missing: (code: string) => api.send<MissingEntry[]>("GET", languagePath(code, "/missing")),

  /** A blank text clears the edit back to what the release ships. */
  writeEntry: (code: string, key: string, text: string) =>
    api.send<TranslationEntry>("PUT", languagePath(code, `/entries/${encodeURIComponent(key)}`), { text }),

  export: (code: string) => api.send<Record<string, string>>("GET", languagePath(code, "/export")),

  importTexts: (code: string, texts: Record<string, string>) =>
    api.send<ImportOutcome>("POST", languagePath(code, "/import"), texts),
};
