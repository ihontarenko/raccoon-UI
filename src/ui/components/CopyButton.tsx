import { useState } from "react";
import { useTranslation } from "../../translations/TranslationProvider";
import { Button } from "../primitives";

interface CopyButtonProperties {
  /** What is copied. */
  value: string;
  /** What it is, for the accessible name: "Copy SHA-256". */
  label: string;
}

/** A small icon button beside an identifier or a hash that puts the whole value on the clipboard. */
export function CopyButton({ value, label }: CopyButtonProperties) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Button
      variant="quiet"
      icon={copied ? "check" : "copy"}
      iconOnly
      aria-label={copied ? t("components.copy.copied", "Copied") : label}
      title={copied ? t("components.copy.copied", "Copied") : label}
      onClick={() => void copy()}
    />
  );
}
