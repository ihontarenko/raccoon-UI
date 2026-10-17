import { useSearch } from "@tanstack/react-router";
import { Can } from "../../access/Can";
import { PERMISSIONS } from "../../access/permissions";
import type { AutomationTab } from "../../application/routeTabs";
import { useReadySession } from "../../application/session";
import { usePageTitle } from "../../application/usePageTitle";
import { useTranslation } from "../../translations/TranslationProvider";
import { PageHeader, TabPanel, Tabs } from "../../ui/components";
import { Button } from "../../ui/primitives";
import { EvaluationsTab } from "./EvaluationsTab";
import { ExamplesTab } from "./ExamplesTab";
import { GroupsTab } from "./GroupsTab";
import { LogTab } from "./LogTab";
import { SchedulesTab } from "./SchedulesTab";
import { ScriptsTab } from "./ScriptsTab";
import { useAddressChange } from "../../application/useAddressChange";

/**
 * Everything that decides by script: the jMS scripts, the groups binding their published versions to
 * the pipeline's events, the rule sets sources judge files with, and the journals of what they decided.
 */
export function AutomationPage() {
  const { t } = useTranslation();
  usePageTitle(t("automation.title", "Automation"));
  const { workspace } = useReadySession();
  const workspaceId = workspace?.id ?? "";
  const search = useSearch({ strict: false }) as { tab?: AutomationTab };
  const changeAddress = useAddressChange();
  const tab: AutomationTab = search.tab ?? "scripts";

  return (
    <>
      <PageHeader
        eyebrow={t("automation.eyebrow", "Pipeline")}
        title={t("automation.title", "Automation")}
        lead={t(
          "automation.lead",
          "Scripts react to what the pipeline does: they can refuse a file, narrow a budget or simply record. A script runs only once it is published and bound.",
        )}
        actions={
          <Can permission={PERMISSIONS.automationManage}>
            <Button variant="primary" icon="plus" href="/automation/scripts/new">
              {t("automation.newScript", "New script")}
            </Button>
          </Can>
        }
      />
      <Tabs<AutomationTab>
        label={t("automation.title", "Automation")}
        active={tab}
        onSelect={(next) => {
          void changeAddress({
            to: "/automation",
            search: { tab: next === "scripts" ? undefined : next },
          });
        }}
        items={[
          { key: "scripts", label: t("automation.tab.scripts", "Scripts") },
          { key: "groups", label: t("automation.tab.groups", "Groups") },
          { key: "schedules", label: t("automation.tab.schedules", "Schedules") },
          { key: "evaluations", label: t("automation.tab.decisions", "Decisions") },
          { key: "log", label: t("automation.tab.log", "Log") },
          { key: "examples", label: t("automation.tab.examples", "Examples") },
        ]}
      />
      <TabPanel tabKey={tab}>
        {tab === "scripts" && <ScriptsTab workspaceId={workspaceId} />}
        {tab === "groups" && <GroupsTab workspaceId={workspaceId} />}
        {tab === "schedules" && <SchedulesTab workspaceId={workspaceId} />}
        {tab === "evaluations" && <EvaluationsTab workspaceId={workspaceId} />}
        {tab === "log" && <LogTab workspaceId={workspaceId} />}
        {tab === "examples" && <ExamplesTab workspaceId={workspaceId} />}
      </TabPanel>
    </>
  );
}
