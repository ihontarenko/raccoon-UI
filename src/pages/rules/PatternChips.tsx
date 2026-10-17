import { useId } from "react";
import { ChipInput } from "../../ui/components";
import { useTranslation } from "../../translations/TranslationProvider";
import { PATTERNS } from "./ruleSetsClasses";

interface PatternChipsProperties {
  patterns: string[];
  onChange: (patterns: string[]) => void;
}

/** Globs over the path inside a source, with the three forms a person needs explained beside them. */
export function PatternChips({ patterns, onChange }: PatternChipsProperties) {
  const { t } = useTranslation();
  const helpId = useId();
  return (
    <div className={PATTERNS}>
      <span className="text-xs text-secondary" id={helpId}>
        {t(
          "sourceRules.patterns.help",
          "Matches the path inside the source. {markdown} is any Markdown file at any depth; {docs} is everything under docs; {folder} is that folder anywhere.",
          {
            markdown: <code>*.md</code>,
            docs: <code>docs/**</code>,
            folder: <code>node_modules/</code>,
          },
        )}
      </span>
      <ChipInput
        values={patterns}
        onChange={onChange}
        listLabel={t("sourceRules.patterns.list", "Patterns")}
        addLabel={t("sourceRules.patterns.add", "Add a pattern")}
        removeLabel={(value) =>
          t("sourceRules.patterns.remove", "Remove pattern {value}", { value })
        }
        placeholder="*.md, docs/**, node_modules/"
        code
        aria-describedby={helpId}
      />
    </div>
  );
}
