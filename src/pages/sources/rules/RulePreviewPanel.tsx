import { useMemo, useState } from "react";
import { formatNumber } from "../../../application/format";
import type { Problem } from "../../../application/problems";
import type { ItemOutcome, RulePreview } from "../../../lib/sourceContracts";
import { EmptyState, ProblemState, Segmented, Waiting } from "../../../ui/components";
import { Badge, Button } from "../../../ui/primitives";
import { OUTCOMES, outcomeOf } from "../scanOutcomes";
import { useTranslation } from "../../../translations/TranslationProvider";
import {
  PREVIEW,
  PREVIEW_HEAD,
  PREVIEW_ITEM,
  PREVIEW_ITEMS,
  PREVIEW_PATH,
  PREVIEW_SUMMARY,
  PREVIEW_TITLE,
  PREVIEW_WHY,
  STALE_NOTE,
} from "./rulesClasses";

type PreviewState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; preview: RulePreview; stale: boolean }
  | { status: "failed"; problem: Problem };

interface RulePreviewPanelProperties {
  state: PreviewState;
  onRun: () => void;
}

export type { PreviewState };

/** What the rules being edited would do to the folder, file by file, before anything is saved. */
export function RulePreviewPanel({ state, onRun }: RulePreviewPanelProperties) {
  const { t, plural } = useTranslation();
  const [filter, setFilter] = useState<ItemOutcome | "ALL">("ALL");

  const preview = state.status === "done" ? state.preview : null;
  const options = useMemo(() => {
    if (preview === null) {
      return [];
    }
    const present = Object.entries(preview.outcomes) as [ItemOutcome, number][];
    return [
      {
        value: "ALL" as const,
        label: t("sourceRules.preview.all", "All"),
        count: preview.discovered,
      },
      ...present.map(([outcome, count]) => ({
        value: outcome,
        label: outcomeOf(outcome).label,
        count,
      })),
    ];
  }, [preview, t]);

  const items =
    preview === null
      ? []
      : preview.items.filter((item) => filter === "ALL" || item.outcome === filter);

  return (
    <section className={PREVIEW} aria-labelledby="rule-preview-title">
      <header className={PREVIEW_HEAD}>
        <div>
          <h2 id="rule-preview-title" className={PREVIEW_TITLE}>
            {t("sourceRules.preview.title", "Try it on the folder")}
          </h2>
          <p className="text-xs text-muted">
            {t(
              "sourceRules.preview.lead",
              "Walks the folder with these rules — nothing is captured or saved.",
            )}
          </p>
        </div>
        <Button icon="play" onClick={onRun} disabled={state.status === "running"}>
          {state.status === "done"
            ? t("sourceRules.preview.runAgain", "Run again")
            : t("sourceRules.preview.run", "Preview")}
        </Button>
      </header>

      {state.status === "idle" && (
        <EmptyState
          title={t("sourceRules.preview.idle.title", "See what a scan would take")}
          description={t(
            "sourceRules.preview.idle.description",
            "Preview runs every rule, rule scripts included, over the real folder and shows the decision for each file.",
          )}
        />
      )}
      {state.status === "running" && (
        <Waiting label={t("sourceRules.preview.running", "Walking the folder")} lines={6} />
      )}
      {state.status === "failed" && <ProblemState layout="section" problem={state.problem} />}
      {preview !== null && (
        <>
          {state.status === "done" && state.stale && (
            <p className={STALE_NOTE} role="status">
              {t(
                "sourceRules.preview.stale",
                "The rules changed since this preview. Run it again to see their effect.",
              )}
            </p>
          )}
          <p className={PREVIEW_SUMMARY}>
            {t("sourceRules.preview.summary", "{taken} of {discovered} entries would be taken.", {
              taken: (
                <strong className="numeric">{formatNumber(preview.outcomes.INCLUDE ?? 0)}</strong>
              ),
              discovered: <span className="numeric">{formatNumber(preview.discovered)}</span>,
            })}
          </p>
          <Segmented
            label={t("sourceRules.preview.show", "Show")}
            options={options}
            value={filter}
            onChange={(value) => {
              setFilter(value);
            }}
          />
          {items.length === 0 ? (
            <p className="text-xs text-muted">
              {t("sourceRules.preview.nothing", "Nothing here.")}
            </p>
          ) : (
            <ul className={PREVIEW_ITEMS}>
              {items.map((item) => {
                const outcome = outcomeOf(item.outcome);
                return (
                  <li key={item.path} className={PREVIEW_ITEM}>
                    <span className={`${PREVIEW_PATH} numeric`} title={item.path}>
                      {item.path}
                    </span>
                    <Badge tone={outcome.tone}>{outcome.label}</Badge>
                    <span className={PREVIEW_WHY}>
                      {item.decidedBy !== null ? (
                        <>
                          {t("sourceRules.preview.decidedBy", "by {rule}", {
                            rule: <strong>{item.decidedBy}</strong>,
                          })}
                          {item.reason !== null ? ` — ${item.reason}` : ""}
                        </>
                      ) : (
                        (item.reason ?? OUTCOMES[item.outcome as ItemOutcome]?.meaning ?? "")
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {preview.items.length < preview.discovered && filter === "ALL" && (
            <p className="text-xs text-muted">
              {plural("sourceRules.preview.firstEntries", preview.items.length, {
                one: "Showing the first {count} entry; the counts cover all of them.",
                other: "Showing the first {count} entries; the counts cover all of them.",
              })}
            </p>
          )}
        </>
      )}
    </section>
  );
}
