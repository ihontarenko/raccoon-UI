import { useEffect, useState, type FormEvent } from "react";
import { describeProblem, type Problem } from "../../../application/problems";
import { translations, type LanguageProgress } from "../../../lib/translations";
import { useTranslation } from "../../../translations/TranslationProvider";
import { Notice } from "../../../ui/components";
import { Button, Dialog, Field, Input } from "../../../ui/primitives";
import { FORM } from "./translationsClasses";

const LANGUAGE_CODE = /^[a-z]{2,3}(-[A-Z][A-Za-z0-9]{1,7})?$/;

interface AddLanguageDialogProperties {
  open: boolean;
  onClose: () => void;
  onAdded: (language: LanguageProgress) => void;
}

/** A new language starts enabled and empty: every screen shows English until its texts are written. */
export function AddLanguageDialog({ open, onClose, onAdded }: AddLanguageDialogProperties) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [nativeName, setNativeName] = useState("");
  const [englishName, setEnglishName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  useEffect(() => {
    if (open) {
      setCode("");
      setNativeName("");
      setEnglishName("");
      setSubmitted(false);
      setSaving(false);
      setProblem(null);
    }
  }, [open]);

  const codeError = LANGUAGE_CODE.test(code.trim())
    ? undefined
    : t("translations.codeError", "A short lower-case code such as pl, de or pt-BR.");
  const nativeNameError =
    nativeName.trim().length > 0 ? undefined : t("translations.nativeNameError", "Enter the language's own name.");
  const englishNameError =
    englishName.trim().length > 0 ? undefined : t("translations.englishNameError", "Enter its English name.");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (codeError !== undefined || nativeNameError !== undefined || englishNameError !== undefined) {
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      onAdded(
        await translations.addLanguage({
          code: code.trim(),
          nativeName: nativeName.trim(),
          englishName: englishName.trim(),
        }),
      );
    } catch (error: unknown) {
      setProblem(describeProblem(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("translations.addLanguage", "Add a language")}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={saving}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button variant="primary" type="submit" form="add-language" disabled={saving}>
            {saving ? t("common.saving", "Saving…") : t("translations.addLanguageConfirm", "Add the language")}
          </Button>
        </>
      }
    >
      <form id="add-language" className={FORM} noValidate onSubmit={(event) => void handleSubmit(event)}>
        {problem !== null && (
          <Notice tone="error" title={problem.title}>
            {problem.detail ?? problem.description}
          </Notice>
        )}
        <Field
          label={t("translations.code", "Code")}
          required
          hint={t("translations.codeHint", "The language tag browsers use: pl, de, pt-BR.")}
          error={submitted ? codeError : undefined}
        >
          <Input
            value={code}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => {
              setCode(event.target.value);
            }}
          />
        </Field>
        <Field
          label={t("translations.nativeName", "Own name")}
          required
          hint={t("translations.nativeNameHint", "What the language calls itself — what a viewer recognises: Polski.")}
          error={submitted ? nativeNameError : undefined}
        >
          <Input
            value={nativeName}
            onChange={(event) => {
              setNativeName(event.target.value);
            }}
          />
        </Field>
        <Field
          label={t("translations.englishName", "English name")}
          required
          error={submitted ? englishNameError : undefined}
        >
          <Input
            value={englishName}
            onChange={(event) => {
              setEnglishName(event.target.value);
            }}
          />
        </Field>
      </form>
    </Dialog>
  );
}
