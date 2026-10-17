import { useTranslation } from "../../translations/TranslationProvider";
import { Button } from "../primitives";
import { useToaster } from "./Toaster";

/**
 * A command or snippet somebody is meant to run elsewhere: labelled, wrapped, and copied in one click.
 * Shared because an example that cannot be copied gets retyped, and a retyped credential gets truncated.
 */
export function CopyableExample({ label, example }: { label: string; example: string }) {
  const { t } = useTranslation();
  const { notify } = useToaster();
  const copy = () => {
    void navigator.clipboard
      .writeText(example)
      .then(() => notify({ tone: "good", title: t("example.copied", "Copied") }));
  };
  return (
    <div className="grid min-w-0 gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs">{label}</span>
        <Button variant="quiet" icon="copy" onClick={copy}>
          {t("example.copy", "Copy")}
        </Button>
      </div>
      <pre className="m-0 rounded-control border border-line bg-well p-3 font-mono text-2xs leading-[1.6] whitespace-pre-wrap [overflow-wrap:anywhere]">
        {example}
      </pre>
    </div>
  );
}
