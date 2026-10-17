// Connections: how every source type is configured. A connection is one configured instance of a type — this computer
// with its allowed folders, a git hosting and its token, web hosts with their limits, the push address, a knowledge
// base with its credential — set up once for the installation under system:read / system:write. A source names one
// and picks inside it. The shapes mirror the server's records field for field.

import type { SourceKind } from "./contracts";
import { api, pageQuery, workspacePath, type PageRequest } from "./api";

export type ConnectionHealthState = "HEALTHY" | "UNAUTHORISED" | "UNREACHABLE" | "NO_CREDENTIAL";

export interface ConnectionHealth {
  state: ConnectionHealthState;
  /** One sentence: what was found, or what to do. */
  sentence: string;
  visibleScopes: number | null;
  checkedAt: string;
}

export interface ConnectorSetting {
  key: string;
  label: string;
  description: string;
  type: "ADDRESS" | "TEXT";
  required: boolean;
  defaultValue: string | null;
}

/** An installed connector: what a connection to it takes, what its credential is, what it calls a scope. */
export interface ConnectorDescriptor {
  connector: string;
  displayName: string;
  description: string;
  addressDescription: string;
  addressExample: string;
  settings: ConnectorSetting[];
  credentialLabel: string;
  credentialDescription: string;
  scopeNoun: string;
}

/**
 * One entry of the flat list of connection types: a built-in kind (`type` is the kind) or an installed connector
 * (`type` is its name, `connector` its descriptor).
 */
export interface ConnectionTypeDescriptor {
  type: string;
  kind: SourceKind;
  displayName: string;
  description: string;
  takesCredential: boolean;
  credentialRequired: boolean;
  credentialLabel: string | null;
  credentialDescription: string | null;
  resourceNoun: string;
  connector: ConnectorDescriptor | null;
}

/** A local folder root: a folder, or the whole computer chosen explicitly. */
export type LocalRoot = { path: string } | { wholeComputer: true };

export interface LocalFolderBoundary {
  roots: LocalRoot[];
}

export type GitHosting = "GITHUB" | "GITLAB" | "OTHER";

export interface GitBoundary {
  hosting: GitHosting;
  /** A self-hosted GitLab, or the address repositories on another host start with. */
  baseAddress?: string;
  allowedOwners: string[];
}

export interface WebBoundary {
  allowedHosts: string[];
  pauseMilliseconds: number;
  maximumLinkDepth: number;
  maximumPages: number;
}

/** A connection as administration sees it. ⚠️ It never carries the credential — only whether one is stored. */
export interface ConnectionView {
  id: string;
  type: string;
  kind: SourceKind;
  /** The connector of a knowledge base; null for a built-in type. */
  connector: string | null;
  name: string;
  /** A knowledge base's address; null for a built-in type. */
  address: string | null;
  settings: Record<string, string>;
  /** What a built-in type offers: roots, a hosting, hosts and limits. */
  boundary: Record<string, unknown>;
  enabled: boolean;
  revision: number;
  credentialSet: boolean;
  credentialChangedAt: string | null;
  health: ConnectionHealth | null;
  createdAt: string;
  sourceCount: number;
}

/** A connection as a workspace choosing one for a source sees it: no address, no credential. */
export interface ConnectionChoice {
  id: string;
  name: string;
  type: string;
  kind: SourceKind;
  connector: string | null;
  connectorName: string;
  scopeNoun: string;
  health: ConnectionHealthState | null;
  healthSentence: string | null;
}

/** One thing a connection offers a source to pick: a root folder, a repository, a host, a section. */
export interface ConnectionResource {
  id: string;
  name: string;
  path: string[];
  detail: string | null;
  /** No boundary at all — the whole computer — and shown as a warning. */
  unbounded: boolean;
}

/** One scope a connection's credential may read — a Kiwi section — with its full path from the root. */
export interface RemoteScope {
  id: string;
  name: string;
  path: string[];
  pageCount: number | null;
}

/** A scope as a CONNECTED source stores it: its id, and its path when it was chosen. */
export interface ChosenScope {
  id: string;
  path: string[];
}

export interface ConnectedOptions {
  connectionId: string;
  scopes: ChosenScope[];
}

export interface ConnectionDraft {
  name: string;
  /** A knowledge base's address; null for a built-in type. */
  address: string | null;
  settings: Record<string, string>;
  /** A built-in type's boundary; empty for a knowledge base. */
  boundary: Record<string, unknown>;
  /** Empty keeps the stored one on a change; a new destination needs it again. */
  credential: string | null;
}

/** Whether a health state means the connection works: blue when it does, red when it does not. */
export function isHealthy(state: ConnectionHealthState | null | undefined): boolean {
  return state === "HEALTHY";
}

/** Whether a local-folder boundary opens the whole computer. */
export function opensWholeComputer(boundary: Record<string, unknown>): boolean {
  const roots = boundary.roots;
  return Array.isArray(roots) && roots.some((root) => typeof root === "object" && root !== null && (root as { wholeComputer?: unknown }).wholeComputer === true);
}

/** A CONNECTED source's options, read defensively from what the server stored. */
export function connectedOptionsOf(options: Record<string, unknown>): ConnectedOptions | null {
  const connectionId = options.connectionId;
  const scopes = options.scopes;
  if (typeof connectionId !== "string" || !Array.isArray(scopes)) {
    return null;
  }
  return {
    connectionId,
    scopes: scopes
      .filter((scope): scope is { id: string; path?: unknown } => typeof scope === "object" && scope !== null && typeof (scope as { id?: unknown }).id === "string")
      .map((scope) => ({ id: scope.id, path: Array.isArray(scope.path) ? scope.path.filter((name): name is string => typeof name === "string") : [] })),
  };
}

export function scopePathText(path: string[]): string {
  return path.join(" / ");
}

export const connectionsApi = {
  /** The flat list of types, for administration. */
  types: () => api.send<ConnectionTypeDescriptor[]>("GET", "/v1/connections/types"),
  list: (page: PageRequest) => api.send<ConnectionView[]>("GET", `/v1/connections?${pageQuery(page)}`),
  create: (type: string, draft: ConnectionDraft) => api.send<ConnectionView>("POST", "/v1/connections", { type, ...draft }),
  change: (connection: ConnectionView, draft: ConnectionDraft, enabled: boolean) =>
    api.send<ConnectionView>("PUT", `/v1/connections/${connection.id}`, { ...draft, enabled, revision: connection.revision }),
  check: (connectionId: string) => api.send<ConnectionView>("POST", `/v1/connections/${connectionId}/check`),
  remove: (connection: ConnectionView) =>
    api.send<void>("DELETE", `/v1/connections/${connection.id}?revision=${connection.revision}`),
  /** The flat list of types, for a workspace choosing a source's type. */
  workspaceTypes: (workspaceId: string) => api.send<ConnectionTypeDescriptor[]>("GET", workspacePath(workspaceId, "/connections/types")),
  /** The connections a workspace may read a source through. */
  choices: (workspaceId: string) => api.send<ConnectionChoice[]>("GET", workspacePath(workspaceId, "/connections")),
  /** What a connection offers a source to pick: roots, repositories, hosts, sections. */
  resources: (workspaceId: string, connectionId: string) =>
    api.send<ConnectionResource[]>("GET", workspacePath(workspaceId, `/connections/${connectionId}/resources`)),
  /** What the connection's credential may read now, as the knowledge base answers. */
  scopes: (workspaceId: string, connectionId: string) =>
    api.send<RemoteScope[]>("GET", workspacePath(workspaceId, `/connections/${connectionId}/scopes`)),
};
