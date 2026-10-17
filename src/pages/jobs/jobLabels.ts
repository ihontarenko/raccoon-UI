import type { CodeLabels } from "../../application/format";
import { declareText } from "../../translations/translate";

// The words a background job's codes are shown with, shared by the workspace's Jobs page and Administration › Jobs.
// The codes mirror the server's `jobs/JobStatus`, `jobs/JobKinds` and the failure codes `jobs/Jobs` writes.

export const JOB_STATUSES: CodeLabels = {
  QUEUED: declareText("jobs.status.queued", "Queued"),
  RUNNING: declareText("jobs.status.running", "Running"),
  SUCCEEDED: declareText("jobs.status.succeeded", "Succeeded"),
  FAILED: declareText("jobs.status.failed", "Failed"),
  CANCELLED: declareText("jobs.status.cancelled", "Cancelled"),
};

export const JOB_KINDS: CodeLabels = {
  STORAGE_VERIFICATION: declareText("jobs.kind.storageVerification", "Storage verification"),
  LOCAL_FOLDER_IMPORT: declareText("jobs.kind.localFolderImport", "Local folder import"),
  DOCUMENT_PARSE: declareText("jobs.kind.documentParse", "Document parse"),
  VECTOR_INDEX: declareText("jobs.kind.vectorIndex", "Vector index"),
  "scan-source": declareText("jobs.kind.scanSource", "Scheduled scan"),
  "vectorise-waiting": declareText("jobs.kind.vectoriseWaiting", "Scheduled vectorisation"),
};

/** How one attempt at a job ended. */
export const JOB_ATTEMPT_OUTCOMES: CodeLabels = {
  SUCCEEDED: declareText("jobs.attemptOutcome.succeeded", "Succeeded"),
  FAILED: declareText("jobs.attemptOutcome.failed", "Failed"),
  CANCELLED: declareText("jobs.attemptOutcome.cancelled", "Cancelled"),
  LEASE_EXPIRED: declareText("jobs.attemptOutcome.leaseExpired", "Lease expired"),
};

/** Why a job failed: its kind's own failure, a policy refusal, or a worker that stopped answering. */
export const JOB_FAILURES: CodeLabels = {
  STORAGE_VERIFICATION_FAILED: declareText("jobs.failure.storageVerification", "Storage verification failed"),
  LOCAL_FOLDER_IMPORT_FAILED: declareText("jobs.failure.localFolderImport", "Local folder import failed"),
  DOCUMENT_PARSE_FAILED: declareText("jobs.failure.documentParse", "Document parse failed"),
  VECTOR_INDEX_FAILED: declareText("jobs.failure.vectorIndex", "Vector index failed"),
  "scan-source_FAILED": declareText("jobs.failure.scanSource", "Scheduled scan failed"),
  "vectorise-waiting_FAILED": declareText("jobs.failure.vectoriseWaiting", "Scheduled vectorisation failed"),
  JOB_POLICY_REFUSED: declareText("jobs.failure.policyRefused", "Refused by the job's policy"),
  LEASE_EXPIRED: declareText("jobs.failure.leaseExpired", "The worker's lease expired"),
};

/** The three kinds of work a workspace's list reads as one, from `jobs/WorkspaceJobs.Work`. */
export const JOB_WORK: CodeLabels = {
  SCAN: declareText("jobs.work.scan", "Scan"),
  PROCESSING: declareText("jobs.work.processing", "Processing"),
  VECTORS: declareText("jobs.work.vectors", "Vectors"),
};
