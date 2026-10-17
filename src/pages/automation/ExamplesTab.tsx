import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Can } from "../../access/Can";
import { PERMISSIONS } from "../../access/permissions";
import { useResource } from "../../application/useResource";
import { automationApi, type ShippedScript } from "../../lib/automation";
import { useTranslation } from "../../translations/TranslationProvider";
import { EmptyState, HighlightedScript, ProblemState, Waiting } from "../../ui/components";
import { Button, Dialog } from "../../ui/primitives";
import { CARD, CARD_ACTIONS, EXAMPLE_LIST, STACK } from "./automationClasses";

/** The scripts raccoon ships as worked examples, to read and to start a new script from. */
export function ExamplesTab({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const examples = useResource(() => automationApi.shipped(workspaceId), [workspaceId]);
  const [viewing, setViewing] = useState<ShippedScript | null>(null);
  const source = useResource(
    () => (viewing === null ? Promise.resolve(null) : automationApi.shippedSource(workspaceId, viewing.name)),
    [workspaceId, viewing?.name],
  );

  if (examples.status === "loading") {
    return <Waiting label={t("automation.examples.loading", "Loading examples")} lines={4} />;
  }
  if (examples.status === "failed") {
    return <ProblemState layout="section" problem={examples.problem} />;
  }
  if (examples.data.length === 0) {
    return (
      <EmptyState
        title={t("automation.examples.empty", "No examples shipped")}
        description={t("automation.examples.emptyDescription", "This build carries no example scripts.")}
      />
    );
  }

  return (
    <div className={STACK}>
      <ul className={EXAMPLE_LIST}>
        {examples.data.map((example) => (
          <li key={example.name} className={CARD}>
            <div>
              <strong className="numeric">{example.name}</strong>
              <div className="text-xs text-muted numeric">{example.stage}</div>
            </div>
            <p className="text-xs text-secondary">{example.description}</p>
            <div className={CARD_ACTIONS}>
              <Button variant="quiet" icon="eye" onClick={() => setViewing(example)}>
                {t("automation.examples.read", "Read")}
              </Button>
              <Can permission={PERMISSIONS.automationManage}>
                <Button
                  variant="quiet"
                  icon="plus"
                  onClick={() => {
                    void navigate({ to: "/automation/scripts/$scriptId", params: { scriptId: "new" }, search: { example: example.name } });
                  }}
                >
                  {t("automation.examples.startFrom", "Start from it")}
                </Button>
              </Can>
            </div>
          </li>
        ))}
      </ul>
      <Dialog open={viewing !== null} onClose={() => setViewing(null)} title={viewing?.name ?? ""} size="wide">
        {source.status === "ready" && source.data !== null ? (
          <HighlightedScript code={source.data.source} />
        ) : (
          <Waiting label={t("automation.examples.loadingOne", "Loading the example")} lines={6} />
        )}
      </Dialog>
    </div>
  );
}
