import type { JobStatus } from "../../lib/contracts";
import { labelOfCode } from "../../application/format";
import { Badge, type BadgeTone } from "../../ui/primitives";
import { JOB_STATUSES } from "./jobLabels";

const TONES: Record<JobStatus, BadgeTone> = {
  QUEUED: "neutral",
  RUNNING: "active",
  SUCCEEDED: "good",
  FAILED: "error",
  CANCELLED: "warn",
};

export function JobState({ status }: { status: JobStatus }) {
  return <Badge tone={TONES[status]}>{labelOfCode(JOB_STATUSES, status)}</Badge>;
}
