// The installation overview: process health, background work, unsettled paid calls, corpus size and
// people, counted across every workspace. Mirrors `administration/InstallationOverview` field for field.

import { api } from "./api";

export interface WorkerPresence {
  identifier: string;
  lastSeenAt: string;
  /** Seen within three heartbeat intervals. */
  alive: boolean;
}

export interface JobCounts {
  queued: number;
  running: number;
  failed: number;
  failedLastDay: number;
  succeededLastDay: number;
  oldestQueuedAt: string | null;
  failedByKindLastDay: Record<string, number>;
}

export interface StorageVerificationRun {
  jobId: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  startedAt: string;
  updatedAt: string;
}

/** Paid calls whose cost is not settled: unknown, or a reservation whose process died mid-call. */
export interface UnresolvedCalls {
  queryEmbedding: number;
  answer: number;
  vector: number;
}

export interface CorpusCounts {
  workspaces: number;
  sources: number;
  disabledSources: number;
  documents: number;
  removedDocuments: number;
  searchableDocuments: number;
  readyGenerations: number;
  publishedVectorGenerations: number;
  withdrawnVectorGenerations: number;
  buildingVectorGenerations: number;
}

export interface PeopleCounts {
  accounts: number;
  enabledAccounts: number;
  activeCredentials: number;
  /** Credentials held by clients — sign-in sessions are counted apart. */
  credentialsExpiringThisWeek: number;
  /** Credentials password logins issued: sign-in sessions, short-lived by design. */
  activeSessions: number;
}

export interface InstallationOverview {
  readAt: string;
  heartbeatMilliseconds: number;
  workers: WorkerPresence[];
  jobs: JobCounts;
  storageVerification: StorageVerificationRun | null;
  unresolvedCalls: UnresolvedCalls;
  corpus: CorpusCounts;
  people: PeopleCounts;
}

export const administrationApi = {
  overview: () => api.send<InstallationOverview>("GET", "/v1/administration/overview"),
};
