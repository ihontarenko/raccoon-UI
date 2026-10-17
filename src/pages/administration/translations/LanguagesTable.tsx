import { useRef, useState, type ChangeEvent } from "react";
import { translations, type LanguageProgress } from "../../../lib/translations";
import { useTranslation } from "../../../translations/TranslationProvider";
import { ConfirmDialog, Menu, useToaster, type MenuItem } from "../../../ui/components";
import { Badge, Table } from "../../../ui/primitives";
import { TranslationProgress } from "./TranslationProgress";
import { BADGES, HIDDEN_INPUT, LANGUAGES_TABLE, LANGUAGE_NAME, TABLE_FRAME } from "./translationsClasses";

interface LanguagesTableProperties {
  languages: LanguageProgress[];
  writable: boolean;
  /** A language changed; the panel reloads the list and the interface's own texts. */
  onChanged: (changed: LanguageProgress | null) => void;
  onImported: () => void;
  onFailed: (error: unknown) => void;
  onSelect: (code: string) => void;
}

/** Saves a document the browser offers to download, from bytes already in hand. */
function offerDownload(fileName: string, content: string): void {
  const address = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = address;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(address);
  }, 0);
}

export function LanguagesTable({ languages, writable, onChanged, onImported, onFailed, onSelect }: LanguagesTableProperties) {
  const { t, plural } = useTranslation();
  const { notify } = useToaster();
  const importInput = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState<LanguageProgress | null>(null);
  const [removing, setRemoving] = useState<LanguageProgress | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
    } catch (error: unknown) {
      onFailed(error);
    } finally {
      setBusy(false);
    }
  };

  const toggle = (language: LanguageProgress) =>
    run(async () => {
      const changed = await translations.changeLanguage(language.code, {
        nativeName: language.nativeName,
        englishName: language.englishName,
        enabled: !language.enabled,
        revision: language.revision,
      });
      notify({
        tone: "good",
        title: changed.enabled
          ? t("translations.enabledNotice", "{name} can be chosen again", { name: changed.nativeName })
          : t("translations.disabledNotice", "{name} can no longer be chosen", { name: changed.nativeName }),
      });
      onChanged(changed);
    });

  const makeDefault = (language: LanguageProgress) =>
    run(async () => {
      const changed = await translations.makeDefault(language.code);
      notify({
        tone: "good",
        title: t("translations.defaultNotice", "{name} is now the default language", { name: changed.nativeName }),
      });
      onChanged(changed);
    });

  const exportTexts = (language: LanguageProgress) =>
    run(async () => {
      const texts = await translations.export(language.code);
      offerDownload(`raccoon-${language.code}.json`, `${JSON.stringify(texts, null, 2)}\n`);
    });

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const language = importing;
    event.target.value = "";
    if (file === undefined || language === null) {
      return;
    }
    await run(async () => {
      let texts: Record<string, string>;
      try {
        const parsed: unknown = JSON.parse(await file.text());
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("not an object");
        }
        texts = Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        );
      } catch {
        notify({
          tone: "error",
          title: t("translations.importUnreadable", "The file is not a translation document"),
          description: t(
            "translations.importShape",
            "Expected one JSON object of text keys and texts, as an export writes it.",
          ),
        });
        return;
      }
      const outcome = await translations.importTexts(language.code, texts);
      notify({
        tone: outcome.unknownCount > 0 ? "neutral" : "good",
        title: t("translations.importedNotice", "{name}: {changed} changed, {unchanged} already the same", {
          name: language.nativeName,
          changed: outcome.changed,
          unchanged: outcome.unchanged,
        }),
        description:
          outcome.unknownCount > 0
            ? plural(
                "translations.importUnknown",
                outcome.unknownCount,
                {
                  one: "{count} key the interface does not use was skipped: {keys}",
                  other: "{count} keys the interface does not use were skipped: {keys}",
                },
                { keys: outcome.unknownKeys.slice(0, 5).join(", ") },
              )
            : undefined,
      });
      onImported();
    });
  };

  const actionsFor = (language: LanguageProgress): MenuItem[] => {
    const items: MenuItem[] = [
      {
        label: t("translations.editTexts", "Edit texts"),
        onSelect: () => {
          onSelect(language.code);
        },
      },
      {
        label: t("translations.export", "Export as JSON"),
        onSelect: () => {
          void exportTexts(language);
        },
      },
    ];
    if (!writable) {
      return items;
    }
    items.push({
      label: t("translations.import", "Import JSON…"),
      onSelect: () => {
        setImporting(language);
        importInput.current?.click();
      },
    });
    if (!language.primary && language.enabled) {
      items.push({
        label: t("translations.makeDefault", "Make default"),
        onSelect: () => {
          void makeDefault(language);
        },
      });
    }
    if (!language.primary && language.code !== "en") {
      items.push({
        label: language.enabled ? t("translations.disable", "Disable") : t("translations.enable", "Enable"),
        onSelect: () => {
          void toggle(language);
        },
      });
    }
    if (!language.primary && !language.shipped) {
      items.push({
        label: t("translations.remove", "Remove…"),
        destructive: true,
        onSelect: () => {
          setRemoving(language);
        },
      });
    }
    return items;
  };

  return (
    <>
      <div className={TABLE_FRAME}>
        <Table className={LANGUAGES_TABLE}>
          <thead>
            <tr>
              <th scope="col">{t("translations.language", "Language")}</th>
              <th scope="col">{t("translations.status", "Status")}</th>
              <th scope="col">{t("translations.progress", "Translated")}</th>
              <th scope="col" className="numeric">
                {t("translations.edited", "Edited here")}
              </th>
              <th scope="col">
                <span className="sr-only">{t("common.actions", "Actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {languages.map((language) => (
              <tr key={language.code}>
                <td>
                  <div className={LANGUAGE_NAME}>
                    <strong lang={language.code}>{language.nativeName}</strong>
                    <span className="text-xs text-secondary">
                      {language.englishName} · <span className="numeric">{language.code}</span>
                    </span>
                  </div>
                </td>
                <td>
                  <div className={BADGES}>
                    {language.primary && <Badge tone="active">{t("translations.default", "Default")}</Badge>}
                    {language.code === "en" && <Badge>{t("translations.source", "Source")}</Badge>}
                    {language.enabled ? (
                      <Badge tone="good">{t("translations.enabled", "Enabled")}</Badge>
                    ) : (
                      <Badge tone="warn">{t("translations.disabled", "Disabled")}</Badge>
                    )}
                  </div>
                </td>
                <td>
                  <TranslationProgress translated={language.translated} total={language.catalogueSize} />
                </td>
                <td className="numeric">{language.edited}</td>
                <td className="numeric">
                  <Menu
                    label={t("translations.actionsFor", "Actions for {name}", { name: language.englishName })}
                    items={actionsFor(language).map((item) => ({ ...item, disabled: busy }))}
                    alignEnd
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      <input
        ref={importInput}
        type="file"
        accept="application/json,.json"
        className={HIDDEN_INPUT}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          void importFile(event);
        }}
      />
      <ConfirmDialog
        open={removing !== null}
        title={t("translations.removeTitle", "Remove {name}?", { name: removing?.englishName ?? "" })}
        confirmLabel={t("translations.removeConfirm", "Remove the language")}
        destructive
        busy={busy}
        onCancel={() => {
          setRemoving(null);
        }}
        onConfirm={() => {
          const language = removing;
          if (language === null) {
            return;
          }
          void run(async () => {
            await translations.removeLanguage(language.code);
            setRemoving(null);
            notify({ tone: "good", title: t("translations.removedNotice", "{name} removed", { name: language.englishName }) });
            onChanged(null);
          });
        }}
      >
        <p>
          {t(
            "translations.removeDescription",
            "Every text written for this language goes with it. Viewers who chose it are spoken to in the default language.",
          )}
        </p>
      </ConfirmDialog>
    </>
  );
}
