import { useSearch } from "@tanstack/react-router";
import { Can } from "../../access/Can";
import { PERMISSIONS } from "../../access/permissions";
import type { QualityTab } from "../../application/routeTabs";
import { useReadySession } from "../../application/session";
import { usePageTitle } from "../../application/usePageTitle";
import { useTranslation } from "../../translations/TranslationProvider";
import { PageHeader, TabPanel, Tabs } from "../../ui/components";
import { Button } from "../../ui/primitives";
import { EvaluationTab } from "./EvaluationTab";
import { RetrievalTab } from "./RetrievalTab";
import { useAddressChange } from "../../application/useAddressChange";

/** Whether search finds what it should: measured against known answers, and accounted query by query. */
export function QualityPage() {
  const { t } = useTranslation();
  usePageTitle(t("quality.title", "Quality"));
  const { workspace } = useReadySession();
  const workspaceId = workspace?.id ?? "";
  const search = useSearch({ strict: false }) as { tab?: QualityTab };
  const changeAddress = useAddressChange();
  const tab: QualityTab = search.tab ?? "evaluation";

  return (
    <>
      <PageHeader
        eyebrow={t("quality.eyebrow", "Pipeline")}
        title={t("quality.title", "Quality")}
        lead={
          <>
            <p>
              {t(
                "quality.lead",
                "Measure search against questions whose answers you know, and see how every real query was routed and what it cost.",
              )}
            </p>
            <p>
              {t(
                "quality.lead.numbers",
                "What the numbers mean. Hit rate: the share of questions for which at least one expected document is among the top hits. Recall: the share of all expected documents that were found — it differs from the hit rate only when a question expects several. Reciprocal rank: how high the first expected document ranks — 100 % at rank 1, 50 % at rank 2, 33 % at rank 3, 0 when it was not found — averaged over the questions. A profile passes when each number reaches the mark the suite sets.",
              )}
            </p>
          </>
        }
        actions={
          tab === "evaluation" && (
            <Can permission={PERMISSIONS.automationManage}>
              <Button variant="primary" icon="plus" href="/quality/suites/new">
                {t("quality.newSuite", "New suite")}
              </Button>
            </Can>
          )
        }
      />
      <Tabs<QualityTab>
        label={t("quality.title", "Quality")}
        active={tab}
        onSelect={(next) => {
          void changeAddress({ to: "/quality", search: { tab: next === "evaluation" ? undefined : next } });
        }}
        items={[
          { key: "evaluation", label: t("quality.tab.evaluation", "Evaluation") },
          { key: "retrieval", label: t("quality.tab.retrieval", "Retrieval") },
        ]}
      />
      <TabPanel tabKey={tab}>
        {tab === "evaluation" && <EvaluationTab workspaceId={workspaceId} />}
        {tab === "retrieval" && <RetrievalTab workspaceId={workspaceId} />}
      </TabPanel>
    </>
  );
}
