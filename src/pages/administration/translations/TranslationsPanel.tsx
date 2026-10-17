import { useState } from "react";
import { Can } from "../../../access/Can";
import { PERMISSIONS } from "../../../access/permissions";
import { usePermissions } from "../../../access/PermissionsProvider";
import { describeProblem } from "../../../application/problems";
import { useResource } from "../../../application/useResource";
import { translations, type LanguageProgress } from "../../../lib/translations";
import { loadTranslations } from "../../../translations/translate";
import { useTranslation } from "../../../translations/TranslationProvider";
import { ProblemState, Waiting, useToaster } from "../../../ui/components";
import { Button } from "../../../ui/primitives";
import { AddLanguageDialog } from "./AddLanguageDialog";
import { LanguagesTable } from "./LanguagesTable";
import { TranslationEntries } from "./TranslationEntries";
import { PANEL, SECTION, SECTION_HEADER, SECTION_TITLE } from "./translationsClasses";

// The languages the interface speaks and what it says in each. English is the catalogue — generated from the
// interface's own code — so a row exists exactly when some screen asks for that text. An edit is laid over what the
// release ships and can be cleared back to it; a gap is said, not filled, because a translator must tell a missing
// text from one that happens to read the same in English.

export function TranslationsPanel() {
  const { t } = useTranslation();
  const { notify } = useToaster();
  const permissions = usePermissions();
  const writable = permissions.may(PERMISSIONS.systemWrite);
  const languages = useResource(() => translations.languages(), []);
  const [adding, setAdding] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [entriesGeneration, setEntriesGeneration] = useState(0);

  if (languages.status === "loading") {
    return <Waiting label={t("translations.loading", "Loading languages")} lines={5} />;
  }
  if (languages.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={languages.problem}
        actions={
          <Button icon="refresh" onClick={languages.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }

  const translatable = languages.data.filter((language) => language.code !== "en");
  const selected =
    languages.data.find((language) => language.code === selectedCode) ?? translatable[0] ?? languages.data[0];

  /** Choosers everywhere ask again, and the screen around the administrator speaks any change at once. */
  const languagesChanged = (changed: LanguageProgress | null) => {
    if (changed !== null) {
      languages.replace(
        languages.data.some((language) => language.code === changed.code)
          ? languages.data.map((language) =>
              language.code === changed.code ? changed : language.primary && changed.primary ? { ...language, primary: false } : language,
            )
          : [...languages.data, changed],
      );
    }
    languages.reload();
    void loadTranslations();
  };

  const failed = (error: unknown) => {
    const problem = describeProblem(error);
    notify({ tone: "error", title: problem.title, description: problem.detail ?? problem.description });
  };

  return (
    <div className={PANEL}>
      <section aria-labelledby="translation-languages" className={SECTION}>
        <div className={SECTION_HEADER}>
          <h2 id="translation-languages" className={SECTION_TITLE}>
            {t("translations.languages", "Languages")}
          </h2>
          <Can permission={PERMISSIONS.systemWrite}>
            <Button
              icon="plus"
              onClick={() => {
                setAdding(true);
              }}
            >
              {t("translations.addLanguage", "Add a language")}
            </Button>
          </Can>
        </div>
        <LanguagesTable
          languages={languages.data}
          writable={writable}
          onChanged={languagesChanged}
          onImported={() => {
            setEntriesGeneration((current) => current + 1);
            languagesChanged(null);
          }}
          onFailed={failed}
          onSelect={(code) => {
            setSelectedCode(code);
            document.getElementById("translation-texts")?.scrollIntoView({ block: "start" });
          }}
        />
      </section>

      {selected !== undefined && (
        <section aria-labelledby="translation-texts" className={SECTION}>
          <TranslationEntries
            key={`${selected.code}-${entriesGeneration}`}
            language={selected}
            languages={languages.data}
            writable={writable}
            onSelectLanguage={setSelectedCode}
            onWritten={() => {
              languages.reload();
              void loadTranslations();
            }}
            onFailed={failed}
          />
        </section>
      )}

      <AddLanguageDialog
        open={adding}
        onClose={() => {
          setAdding(false);
        }}
        onAdded={(added) => {
          setAdding(false);
          setSelectedCode(added.code);
          notify({
            tone: "good",
            title: t("translations.languageAdded", "{name} added", { name: added.nativeName }),
          });
          languagesChanged(added);
        }}
      />
    </div>
  );
}
