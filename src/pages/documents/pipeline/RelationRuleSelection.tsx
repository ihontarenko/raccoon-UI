import { useState } from "react";
import { usePermissions } from "../../../access/PermissionsProvider";
import { PERMISSIONS } from "../../../access/permissions";
import { describeProblem } from "../../../application/problems";
import { useResource } from "../../../application/useResource";
import { ruleSetsApi } from "../../../lib/ruleSets";
import { useTranslation } from "../../../translations/TranslationProvider";
import { ProblemState, Waiting, useToaster } from "../../../ui/components";
import { Button, Checkbox } from "../../../ui/primitives";

/** Uses ordinary workspace rules. The example is created only after an explicit user action. */
export function RelationRuleSelection({
  workspaceId,
  selected,
  disabled,
  onChange,
}: {
  workspaceId: string;
  selected: string[];
  disabled: boolean;
  onChange: (identifiers: string[]) => void;
}) {
  const { t } = useTranslation();
  const { notify } = useToaster();
  const rules = useResource(() => ruleSetsApi.list(workspaceId), [workspaceId]);
  const mayCreate = usePermissions().may(PERMISSIONS.automationManage);
  const [creating, setCreating] = useState(false);
  const addExample = async () => {
    setCreating(true);
    try {
      const example = await ruleSetsApi.createFromPreset(
        workspaceId,
        "component-reference-candidates",
      );
      onChange([...selected, example.id]);
      rules.reload();
      notify({
        tone: "good",
        title: t("processing.ruleAdded", "Example rules created and selected"),
      });
    } catch (error) {
      const problem = describeProblem(error);
      notify({
        tone: "error",
        title: problem.title,
        description: problem.detail ?? problem.description,
      });
    } finally {
      setCreating(false);
    }
  };
  return (
    <section className="grid min-w-0 gap-3 border-t border-line pt-4">
      <h3 className="text-sm font-semibold">
        {t("processing.candidateRules", "Rules for relation candidates")}
      </h3>
      <p className="text-sm text-secondary">
        {t(
          "processing.candidateHelp",
          "For example, a mention of NE555 or LM358 suggests the matching jMX component. The result is CANDIDATE_FOR / MATCHED, with the rule as evidence. It is a suggestion, not a confirmed technical relationship.",
        )}
      </p>
      {rules.status === "loading" ? (
        <Waiting label={t("processing.loadingRules", "Loading workspace rules")} lines={2} />
      ) : rules.status === "failed" ? (
        <ProblemState layout="section" problem={rules.problem} />
      ) : (
        <div className="grid gap-2">
          {rules.data
            .filter(
              (rule) =>
                selected.includes(rule.id) ||
                rule.stages.some((stage) => ["SEMANTIC_EXTRACTION", "RELATIONS"].includes(stage)),
            )
            .map((rule) => (
              <Checkbox
                key={rule.id}
                label={rule.name}
                checked={selected.includes(rule.id)}
                disabled={disabled || creating}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selected, rule.id]
                      : selected.filter((identifier) => identifier !== rule.id),
                  )
                }
              />
            ))}
        </div>
      )}
      {mayCreate && (
        <Button
          variant="quiet"
          disabled={disabled || creating || selected.length >= 16}
          onClick={() => void addExample()}
        >
          {t("processing.addExample", "Create and use component candidate rules")}
        </Button>
      )}
    </section>
  );
}
