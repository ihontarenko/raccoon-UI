import { Link } from "@tanstack/react-router";
import type { WorkspaceJob } from "../../lib/workspaceJobs";

/* The name of the thing a job was run on, which is also the way to it. */
const ROW_LINK = "font-[550] text-ink hover:text-accent-text";

/** The thing a job works on, linked to where it is managed. */
export function JobSubjectLink({ job }: { job: WorkspaceJob }) {
  if (job.work === "SCAN" && job.sourceId !== null) {
    return (
      <Link
        to="/sources/$sourceId"
        params={{ sourceId: job.sourceId }}
        search={{ tab: "scans" }}
        className={ROW_LINK}
      >
        {job.subject}
      </Link>
    );
  }
  if (job.work === "PROCESSING" && job.documentId !== null) {
    return (
      <Link
        to="/documents/$documentId"
        params={{ documentId: job.documentId }}
        className={ROW_LINK}
      >
        {job.subject}
      </Link>
    );
  }
  if (job.work === "VECTORS") {
    return (
      <Link to="/index" search={{ tab: "vectors", vector: job.id }} className={ROW_LINK}>
        {job.subject}
      </Link>
    );
  }
  if (job.work === "GRAPH") {
    return (
      <Link to="/index" search={{ tab: "graph" }} className={ROW_LINK}>
        {job.subject}
      </Link>
    );
  }
  return <span>{job.subject}</span>;
}
