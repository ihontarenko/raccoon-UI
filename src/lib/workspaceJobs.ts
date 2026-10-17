// One workspace's background work: the scans of its sources, the processing runs of its documents and its
// vector generations, read as one list. Mirrors `jobs/WorkspaceJobs`; the installation-wide queue is
// administration's (`api.listJobs`).

import { api, pageQuery, workspacePath, type PageRequest } from "./api";
import type { JobStatus } from "./contracts";

export type WorkspaceWork = "SCAN" | "PROCESSING" | "VECTORS";
export type WorkspaceJobFilter = "ALL" | "UNFINISHED" | "FAILED";

export interface WorkspaceJob {
  id: string;
  kind: string;
  work: WorkspaceWork;
  status: JobStatus;
  sourceId: string | null;
  /** The source scanned, the document version processed, or "Vector generation". */
  subject: string;
  documentId: string | null;
  /** Files of a scan or vectors of a generation; a processing run has no countable progress. */
  done: number | null;
  total: number | null;
  attemptCount: number;
  attemptLimit: number;
  failureCode: string | null;
  /** One sentence the worker composed about what went wrong; the code alone names only the job. */
  failureDetail: string | null;
  /** The step a processing run is on — parse, chunk, lexical; null for other work and once it has ended. */
  currentStep: string | null;
  /** The worker that holds or last held it; null for a job no worker has taken yet. */
  workerId: string | null;
  createdAt: string;
  updatedAt: string;
}

const base = (workspaceId: string) => workspacePath(workspaceId, "/jobs");

export const workspaceJobsApi = {
  list: (workspaceId: string, filter: WorkspaceJobFilter, page: PageRequest) =>
    api.send<WorkspaceJob[]>("GET", `${base(workspaceId)}?filter=${filter}&${pageQuery(page)}`),
  cancel: (workspaceId: string, jobId: string) => api.send<WorkspaceJob>("POST", `${base(workspaceId)}/${jobId}/cancel`),
  retry: (workspaceId: string, jobId: string) => api.send<WorkspaceJob>("POST", `${base(workspaceId)}/${jobId}/retry`),
  activity: (workspaceId: string) => api.send<WorkspaceActivity>("GET", `${base(workspaceId)}/activity`),
};

/** One worker as its heartbeat reports it; `runningJobs` counts across the installation and names none. */
export interface WorkerHealth {
  identifier: string;
  lastSeenAt: string;
  alive: boolean;
  runningJobs: number;
}

/**
 * What the header's activity indicator reads from any page (`WorkspaceJobs.Activity`): whether a worker is there
 * to take the queue, and the running, queued and recently failed work — each list at most ten, the totals true.
 */
export interface WorkspaceActivity {
  workerAlive: boolean;
  /** Null when no worker has ever beaten in this installation. */
  workerLastSeenAt: string | null;
  heartbeatMilliseconds: number;
  /** Every worker that ever beat, most recently seen first. */
  workers: WorkerHealth[];
  totals: {
    running: number;
    queued: number;
    failedLastDay: number;
    /** Documents a source asked to prepare that the worker has not turned into jobs yet. */
    awaitingSubmission: number;
  };
  running: WorkspaceJob[];
  queued: WorkspaceJob[];
  /** Failed within the last day, newest first. */
  failed: WorkspaceJob[];
}
