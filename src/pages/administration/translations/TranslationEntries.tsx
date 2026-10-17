import { useMemo, useState, type KeyboardEvent } from "react";
import { useResource } from "../../../application/useResource";
import { translations, type LanguageProgress, type TranslationEntry } from "../../../lib/translations";
import { useTranslation } from "../../../translations/TranslationProvider";
import { EmptyState, ProblemState, Waiting } from "../../../ui/components";
import { Badge, Button, Checkbox, Field, Input, Select, Table, TextArea } from "../../../ui/primitives";
import { TranslationProgress } from "./TranslationProgress";
import { ANYWHERE_CELL, EDITING_ROW, EDITOR_ACTIONS, EDIT_LABEL, ENTRIES_TABLE, ENTRY_KEY, ENTRY_TEXT, FILTERS, FILTER_CHECK, MORE_ROW, SECTION_HEADER, SECTION_TITLE, TABLE_FRAME, TRANSLATION_CELL, WARNING } from "./translationsClasses";

// Rows are drawn a page at a time: the catalogue runs to well over a thousand keys, and mounting every one of them
// on each keystroke of the search is the first thing an administrator would notice on this screen.
const PAGE_SIZE = 150;

/** The `{name}` placeholders of a text, which a translation must keep for the screen to fill them. */
function placeholdersOf(text: string): string[] {
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? ""))].sort();
}

/** Placeholders the English source has and the translation lost, or the translation invented. */
function placeholderMismatch(source: string, text: string): string[] {
  const expected = placeholdersOf(source);
  const actual = placeholdersOf(text);
  return [
    ...expected.filter((name) => !actual.includes(name)),
    ...actual.filter((name) => !expected.includes(name)),
  ].map((name) => `{${name}}`);
}

interface TranslationEntriesProperties {
  language: LanguageProgress;
  languages: LanguageProgress[];
  writable: boolean;
  onSelectLanguage: (code: string) => void;
  /** A text was written; the panel refreshes progress and the interface's own texts. */
  onWritten: () => void;
  onFailed: (error: unknown) => void;
}

export function TranslationEntries({
  language,
  languages,
  writable,
  onSelectLanguage,
  onWritten,
  onFailed,
}: TranslationEntriesProperties) {
  const { t, plural } = useTranslation();
  const entries = useResource(() => translations.entries(language.code), [language.code]);
  const [query, setQuery] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [shownCount, setShownCount] = useState(PAGE_SIZE);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const matching = useMemo(() => {
    if (entries.status !== "ready") {
      return [];
    }
    const needle = query.trim().toLowerCase();
    return entries.data.filter(
      (entry) =>
        (!missingOnly || entry.state === "MISSING") &&
        (needle.length === 0 ||
          entry.key.toLowerCase().includes(needle) ||
          entry.source.toLowerCase().includes(needle) ||
          (entry.text ?? "").toLowerCase().includes(needle)),
    );
  }, [entries, query, missingOnly]);

  const replaceEntry = (saved: TranslationEntry) => {
    if (entries.status === "ready") {
      entries.replace(entries.data.map((entry) => (entry.key === saved.key ? saved : entry)));
    }
  };

  const missingCount = language.catalogueSize - language.translated;

  return (
    <>
      <div className={SECTION_HEADER}>
        <h2 id="translation-texts" className={SECTION_TITLE}>
          {t("translations.texts", "Texts")}
        </h2>
        <TranslationProgress translated={language.translated} total={language.catalogueSize} />
      </div>
      <div className={FILTERS}>
        <Field label={t("translations.language", "Language")}>
          <Select
            value={language.code}
            onChange={(event) => {
              onSelectLanguage(event.target.value);
            }}
          >
            {languages.map((candidate) => (
              <option key={candidate.code} value={candidate.code}>
                {candidate.nativeName} ({candidate.code})
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("translations.search", "Search")}>
          <Input
            type="search"
            value={query}
            placeholder={t("translations.searchPlaceholder", "Key, English or translation")}
            onChange={(event) => {
              setQuery(event.target.value);
              setShownCount(PAGE_SIZE);
            }}
          />
        </Field>
        <div className={FILTER_CHECK}>
          <Checkbox
            label={t("translations.missingOnly", "Missing only")}
            hint={plural("translations.missingCount", missingCount, {
              one: "{count} text has no translation",
              other: "{count} texts have no translation",
            })}
            checked={missingOnly}
            onChange={(event) => {
              setMissingOnly(event.target.checked);
              setShownCount(PAGE_SIZE);
            }}
          />
        </div>
      </div>

      {entries.status === "loading" && <Waiting label={t("translations.loadingTexts", "Loading texts")} lines={8} />}
      {entries.status === "failed" && (
        <ProblemState
          layout="section"
          problem={entries.problem}
          actions={
            <Button icon="refresh" onClick={entries.reload}>
              {t("common.tryAgain", "Try again")}
            </Button>
          }
        />
      )}
      {entries.status === "ready" && matching.length === 0 && (
        <EmptyState
          title={
            missingOnly && query.trim().length === 0
              ? t("translations.nothingMissing", "Nothing is missing")
              : t("translations.noMatch", "No text matches")
          }
          description={
            missingOnly && query.trim().length === 0
              ? t("translations.nothingMissingDescription", "Every text the interface uses has a translation.")
              : t("translations.noMatchDescription", "Try part of a key, such as “search.” or a word on the screen.")
          }
        />
      )}
      {entries.status === "ready" && matching.length > 0 && (
        <>
          <p className="text-xs text-secondary" aria-live="polite">
            {t("translations.shownOf", "{shown} of {total} texts", {
              shown: Math.min(shownCount, matching.length),
              total: matching.length,
            })}
          </p>
          <div className={TABLE_FRAME}>
            <Table className={ENTRIES_TABLE}>
              <thead>
                <tr>
                  <th scope="col">{t("translations.english", "English")}</th>
                  <th scope="col" lang={language.code}>
                    {language.nativeName}
                  </th>
                  <th scope="col">
                    <span className="sr-only">{t("common.actions", "Actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {matching.slice(0, shownCount).map((entry) =>
                  editingKey === entry.key ? (
                    <EntryEditor
                      key={entry.key}
                      entry={entry}
                      languageCode={language.code}
                      onClose={() => {
                        setEditingKey(null);
                      }}
                      onSaved={(saved) => {
                        replaceEntry(saved);
                        setEditingKey(null);
                        onWritten();
                      }}
                      onFailed={onFailed}
                    />
                  ) : (
                    <EntryRow
                      key={entry.key}
                      entry={entry}
                      languageCode={language.code}
                      writable={writable}
                      onEdit={() => {
                        setEditingKey(entry.key);
                      }}
                    />
                  ),
                )}
              </tbody>
            </Table>
          </div>
          {matching.length > shownCount && (
            <div className={MORE_ROW}>
              <Button
                onClick={() => {
                  setShownCount((current) => current + PAGE_SIZE);
                }}
              >
                {t("translations.showMore", "Show {count} more", {
                  count: Math.min(PAGE_SIZE, matching.length - shownCount),
                })}
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function EntryRow({
  entry,
  languageCode,
  writable,
  onEdit,
}: {
  entry: TranslationEntry;
  languageCode: string;
  writable: boolean;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const mismatch = entry.text === null ? [] : placeholderMismatch(entry.source, entry.text);
  return (
    <tr>
      <td className={ANYWHERE_CELL}>
        <span className={ENTRY_KEY}>{entry.key}</span>
        <span className={ENTRY_TEXT}>{entry.source}</span>
      </td>
      <td className={TRANSLATION_CELL}>
        {entry.text === null ? (
          <Badge tone="warn">{t("translations.missing", "Missing")}</Badge>
        ) : (
          <>
            <span className={ENTRY_TEXT} lang={languageCode}>
              {entry.text}
            </span>
            <span className="mt-1 flex flex-wrap gap-1">
              {entry.state === "EDITED" && <Badge tone="active">{t("translations.editedBadge", "Edited")}</Badge>}
              {mismatch.length > 0 && (
                <Badge tone="deny">
                  {t("translations.placeholderMismatch", "Placeholders differ: {names}", { names: mismatch.join(" ") })}
                </Badge>
              )}
            </span>
          </>
        )}
      </td>
      <td className="numeric">
        {writable && (
          <Button
            variant="quiet"
            icon="edit"
            aria-label={t("translations.editKey", "Edit {key}", { key: entry.key })}
            onClick={onEdit}
          >
            <span className={EDIT_LABEL}>{t("translations.edit", "Edit")}</span>
          </Button>
        )}
      </td>
    </tr>
  );
}

function EntryEditor({
  entry,
  languageCode,
  onClose,
  onSaved,
  onFailed,
}: {
  entry: TranslationEntry;
  languageCode: string;
  onClose: () => void;
  onSaved: (saved: TranslationEntry) => void;
  onFailed: (error: unknown) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(entry.text ?? "");
  const [saving, setSaving] = useState(false);
  const mismatch = draft.trim().length === 0 ? [] : placeholderMismatch(entry.source, draft);
  const editorId = `translation-${entry.key}`;

  const save = async (text: string) => {
    setSaving(true);
    try {
      onSaved(await translations.writeEntry(languageCode, entry.key, text));
    } catch (error: unknown) {
      onFailed(error);
      setSaving(false);
    }
  };

  const handleKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void save(draft);
    }
  };

  return (
    <tr className={EDITING_ROW}>
      <td className={ANYWHERE_CELL}>
        <span className={ENTRY_KEY}>{entry.key}</span>
        <span className={ENTRY_TEXT}>{entry.source}</span>
        {entry.shipped !== null && entry.state === "EDITED" && (
          <span className="text-xs text-secondary">
            {t("translations.shippedText", "Shipped: {text}", { text: entry.shipped })}
          </span>
        )}
      </td>
      <td className={TRANSLATION_CELL} colSpan={2}>
        <label className="sr-only" htmlFor={editorId}>
          {t("translations.translationOf", "Translation of {key}", { key: entry.key })}
        </label>
        <TextArea
          id={editorId}
          lang={languageCode}
          value={draft}
          rows={Math.min(6, Math.max(2, Math.ceil(entry.source.length / 60)))}
          autoFocus
          disabled={saving}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={handleKey}
        />
        {mismatch.length > 0 && (
          <p className={WARNING} role="status">
            {t(
              "translations.placeholderWarning",
              "Keep the placeholders of the English text — the screen fills them in. Differs: {names}",
              { names: mismatch.join(" ") },
            )}
          </p>
        )}
        <div className={EDITOR_ACTIONS}>
          <Button variant="primary" disabled={saving || draft.trim().length === 0} onClick={() => void save(draft)}>
            {saving ? t("common.saving", "Saving…") : t("common.save", "Save")}
          </Button>
          <Button variant="quiet" disabled={saving} onClick={onClose}>
            {t("common.cancel", "Cancel")}
          </Button>
          {entry.state === "EDITED" && (
            <Button variant="quiet" disabled={saving} onClick={() => void save("")}>
              {entry.shipped === null
                ? t("translations.clear", "Clear the translation")
                : t("translations.resetToShipped", "Back to the shipped text")}
            </Button>
          )}
          <span className="text-xs text-secondary">{t("translations.editorKeys", "Ctrl+Enter saves · Esc cancels")}</span>
        </div>
      </td>
    </tr>
  );
}
