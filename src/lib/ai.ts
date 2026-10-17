// The jMouse AI management routes, mounted by the library under `/jmouse-ai`. Raccoon writes none of
// these controllers: it gates them (reads need `system:read`, writes `system:write`) and draws them.
// The shapes mirror the library's records field for field.

import { api } from "./api";

const PREFIX = "/jmouse-ai";

export type AiCapability = "CHAT" | "EMBEDDINGS" | "RERANK";

/** One stored provider configuration. ⚠️ It never carries a key — only whether one is stored. */
export interface ProviderConfiguration {
  id: string;
  provider: string;
  model: string;
  apiUrl: string | null;
  maximumTokens: number;
  active: boolean;
  keyConfigured: boolean;
  createdAt: string;
  updatedAt: string;
  purpose: string | null;
  capabilities: AiCapability[];
  revision: number;
  /** The vault credential the address and key come from: ai/providers/<id> when typed here, or a shared one. */
  credentialName: string | null;
}

export interface SupportedProvider {
  name: string;
  defaultApiUrl: string | null;
  requiresKey: boolean;
  note: string | null;
  capabilities: AiCapability[];
}

export interface StoredConfigurations {
  supportedProviders: string[];
  providers: SupportedProvider[];
  configurations: ProviderConfiguration[];
}

/** What a form sends. A blank `apiKey` on a change keeps the stored key; it never clears it. */
export interface ProviderConfigurationDraft {
  provider: string;
  model: string;
  apiKey: string | null;
  apiUrl: string | null;
  maximumTokens: number;
  purpose: string | null;
  capabilities: AiCapability[];
  /** A shared vault credential to take the address and key from; null keeps them with this configuration. */
  credentialName: string | null;
}

export interface ActiveProvider {
  providerName: string;
  model: string;
  apiUrl: string | null;
  maximumTokens: number;
  keyConfigured: boolean;
  usable: boolean;
}

export interface AiOverview {
  activeProvider: ActiveProvider | null;
  assistantAvailable: boolean;
  trailRecorded: boolean;
  publishedActions: number;
  publishedTools: number;
}

export interface PreferenceValue {
  id: string;
  label: string;
  value: string;
  inForce: boolean;
  shippedKey: string | null;
  asShipped: boolean;
  createdAt: string;
  changedAt: string;
}

export interface PreferenceSetting {
  name: string;
  title: string;
  description: string;
  multiline: boolean;
  values: PreferenceValue[];
}

export interface UsageTotal {
  callerId: string;
  qualifiedName: string;
  outcome: string;
  calls: number;
  tokens: number;
  lastCalledAt: string | null;
}

export interface ToolCall {
  operationId: string;
  callerId: string;
  actingSubject: string;
  qualifiedName: string;
  scopeId: string | null;
  scopeLabel: string | null;
  outcome: string;
  affectedCount: number;
  at: string;
}

export interface PublishedTool {
  publishedName: string;
  qualifiedName: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  requiredPermission: string | null;
  readOnly: boolean;
  destructive: boolean;
  scopeConfined: boolean;
  origin: "LOCAL" | "REMOTE";
}

export type AgentAuthority = "INHERITED" | "RESTRICTED";

export interface AgentConnection {
  id: string;
  agentId: string;
  clientName: string;
  clientId: string | null;
  issuedAt: string;
  refreshExpiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface AgentView {
  id: string;
  ownerReference: string;
  name: string;
  authority: AgentAuthority;
  enabled: boolean;
  createdAt: string;
  lastActiveAt: string | null;
  connectionCount: number;
  connections: AgentConnection[];
}

/** The library bounds every listing itself; this asks for its ceiling. */
const LISTING_LIMIT = 200;

export const aiApi = {
  overview: () => api.send<AiOverview>("GET", `${PREFIX}/overview`),

  configurations: () => api.send<StoredConfigurations>("GET", `${PREFIX}/configurations`),
  addConfiguration: (draft: ProviderConfigurationDraft) =>
    api.send<ProviderConfiguration>("POST", `${PREFIX}/configurations`, draft),
  changeConfiguration: (id: string, draft: ProviderConfigurationDraft) =>
    api.send<ProviderConfiguration>("PUT", `${PREFIX}/configurations/${id}`, draft),
  putInForce: (id: string) => api.send<ProviderConfiguration>("PATCH", `${PREFIX}/configurations/${id}/in-force`),
  takeOutOfForce: (id: string) =>
    api.send<ProviderConfiguration>("DELETE", `${PREFIX}/configurations/${id}/in-force`),
  discardConfiguration: (id: string) => api.send<void>("DELETE", `${PREFIX}/configurations/${id}`),

  preferences: () => api.send<PreferenceSetting[]>("GET", `${PREFIX}/preferences`),
  addPreferenceValue: (name: string, label: string, value: string) =>
    api.send<PreferenceValue>("POST", `${PREFIX}/preferences/${encodeURIComponent(name)}`, { label, value }),
  changePreferenceValue: (id: string, label: string, value: string) =>
    api.send<PreferenceValue>("PUT", `${PREFIX}/preferences/values/${id}`, { label, value }),
  putPreferenceInForce: (id: string) =>
    api.send<PreferenceValue>("PATCH", `${PREFIX}/preferences/values/${id}/in-force`),
  restoreShippedPreference: (id: string) =>
    api.send<PreferenceValue>("POST", `${PREFIX}/preferences/values/${id}/shipped`),
  discardPreferenceValue: (id: string) => api.send<void>("DELETE", `${PREFIX}/preferences/values/${id}`),

  usage: () => api.send<UsageTotal[]>("GET", `${PREFIX}/usage`),
  calls: () => api.send<ToolCall[]>("GET", `${PREFIX}/calls?limit=${LISTING_LIMIT}`),
  tools: () => api.send<PublishedTool[]>("GET", `${PREFIX}/tools`),

  agents: () => api.send<AgentView[]>("GET", `${PREFIX}/agents?limit=${LISTING_LIMIT}`),
  renameAgent: (id: string, name: string) => api.send<AgentView>("PATCH", `${PREFIX}/agents/${id}/name`, { name }),
  setAgentEnabled: (id: string, enabled: boolean) =>
    api.send<AgentView>("PATCH", `${PREFIX}/agents/${id}/enabled?enabled=${enabled}`),
  setAgentAuthority: (id: string, authority: AgentAuthority) =>
    api.send<AgentView>("PATCH", `${PREFIX}/agents/${id}/authority`, { authority }),
  revokeAgentConnection: (agentId: string, connectionId: string) =>
    api.send<AgentView>("DELETE", `${PREFIX}/agents/${agentId}/connections/${connectionId}`),
  revokeAgentConnections: (agentId: string) =>
    api.send<AgentView>("DELETE", `${PREFIX}/agents/${agentId}/connections`),
};
