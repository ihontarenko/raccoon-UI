// The vault: every secret Raccoon uses, by name, and the structured credentials built from them. The shapes mirror
// jmouse-vault-management's views field for field. No answer here carries a value except `reveal`, which is its own
// permission (vault:reveal) and is written into the audit trail before it is answered.

import { api } from "./api";

export interface VaultOverview {
  /** The sources in the order they are asked: the first that holds a name answers. */
  sources: string[];
  /** The one source the application can change, or null when nothing here is editable. */
  writableSource: string | null;
  /** How an environment variable is spelled here, e.g. "environment (RACCOON_SECRET_EXAMPLE__API_KEY)". */
  environmentExample: string | null;
}

export interface VaultEntry {
  source: string;
  /** Where in that source: an environment variable's name, a property key, or the table. */
  location: string | null;
  /** First 12 hex of SHA-256 of the value — tells keys apart without showing one. */
  fingerprint: string;
  description: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface VaultSecret {
  name: string;
  resolved: VaultEntry;
  /** Later sources holding the same name — present, never used. */
  shadowed: VaultEntry[];
  editable: boolean;
  /** The credential this secret is a field of, or null. */
  credential: string | null;
}

export interface CredentialKindField {
  name: string;
  title: string;
  secret: boolean;
  required: boolean;
  hint: string | null;
}

export interface CredentialKind {
  name: string;
  title: string;
  description: string;
  fields: CredentialKindField[];
  openEnded: boolean;
}

export interface VaultCredential {
  name: string;
  kind: string;
  description: string | null;
  source: string;
  editable: boolean;
  /** Plain fields — a URL, a client id — shown as they are. */
  fields: Record<string, string>;
  /** Secret field → where it resolves from, or null when nothing holds it. */
  secrets: Record<string, VaultEntry | null>;
  secretFields: string[];
  /** Required fields with no value: the credential fails at its first use. */
  missing: string[];
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface CredentialDraft {
  kind: string;
  description: string | null;
  fields: Record<string, string>;
  /** A blank value keeps what is stored. */
  secrets: Record<string, string>;
  /** For an open-ended kind, every field that is secret. */
  secretFields: string[];
}

export type VaultAuditAction =
  | "SECRET_SET"
  | "SECRET_DESCRIBED"
  | "SECRET_REMOVED"
  | "SECRET_REVEALED"
  | "CREDENTIAL_SAVED"
  | "CREDENTIAL_REMOVED"
  | "RESEALED";

export interface VaultAuditEvent {
  occurredAt: string;
  actor: string | null;
  action: VaultAuditAction;
  subject: string;
  source: string | null;
}

export interface RevealedSecret {
  name: string;
  value: string;
  source: string;
}

const BASE = "/v1/vault";

function named(path: string, name: string): string {
  return `${BASE}${path}?name=${encodeURIComponent(name)}`;
}

export const vaultApi = {
  overview: () => api.send<VaultOverview>("GET", BASE),
  secrets: () => api.send<VaultSecret[]>("GET", `${BASE}/secrets`),
  credentials: () => api.send<VaultCredential[]>("GET", `${BASE}/credentials`),
  kinds: () => api.send<CredentialKind[]>("GET", `${BASE}/kinds`),
  audit: (limit = 50) => api.send<VaultAuditEvent[]>("GET", `${BASE}/audit?limit=${limit}`),
  setSecret: (name: string, value: string, description: string | null) =>
    api.send<VaultSecret>("PUT", named("/secrets", name), { value, description }),
  removeSecret: (name: string) => api.send<void>("DELETE", named("/secrets", name)),
  reveal: (name: string) => api.send<RevealedSecret>("POST", named("/secrets/reveal", name)),
  saveCredential: (name: string, draft: CredentialDraft) =>
    api.send<VaultCredential>("PUT", named("/credentials", name), draft),
  removeCredential: (name: string) => api.send<void>("DELETE", named("/credentials", name)),
};

/** The grammar the server enforces: kebab-case segments joined by "/". */
export const SECRET_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)*$/;
