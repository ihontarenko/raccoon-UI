import { useParams } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { AdministrationSectionKey } from "../../ui/shell/navigation";
import { AccessPanel } from "./access/AccessPanel";
import { AccountsPanel } from "./AccountsPanel";
import { AgentsPanel } from "./ai/AgentsPanel";
import { PromptsPanel } from "./ai/PromptsPanel";
import { ProvidersPanel } from "./ai/ProvidersPanel";
import { ConnectionsPanel } from "./connections/ConnectionsPanel";
import { ToolsPanel } from "./ai/ToolsPanel";
import { JobsPanel } from "./JobsPanel";
import { MembersPanel } from "./MembersPanel";
import { SystemSettingsPanel } from "./SystemSettingsPanel";
import { TelegramPanel } from "./TelegramPanel";
import { VaultPanel } from "./vault/VaultPanel";
import { TranslationsPanel } from "./translations/TranslationsPanel";
import { WorkspacesPanel } from "./WorkspacesPanel";

// One route for every administration section, dispatching on its key. The frame around it has
// already refused an unknown key or a section the caller may not open.
const PANELS: Record<AdministrationSectionKey, () => ReactNode> = {
  jobs: () => <JobsPanel />,
  accounts: () => <AccountsPanel />,
  members: () => <MembersPanel />,
  access: () => <AccessPanel />,
  workspaces: () => <WorkspacesPanel />,
  agents: () => <AgentsPanel />,
  providers: () => <ProvidersPanel />,
  prompts: () => <PromptsPanel />,
  tools: () => <ToolsPanel />,
  connections: () => <ConnectionsPanel />,
  settings: () => <SystemSettingsPanel />,
  translations: () => <TranslationsPanel />,
  telegram: () => <TelegramPanel />,
  vault: () => <VaultPanel />,
};

export function AdministrationSectionPage() {
  const { section } = useParams({ strict: false }) as { section?: string };
  const panel = section === undefined ? undefined : PANELS[section as AdministrationSectionKey];
  return <>{panel === undefined ? null : panel()}</>;
}
