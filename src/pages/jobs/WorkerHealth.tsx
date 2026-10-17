import { formatElapsed } from "../../application/format";
import type { WorkspaceActivity } from "../../lib/workspaceJobs";
import { useTranslation } from "../../translations/TranslationProvider";
import { Badge } from "../../ui/primitives";

const LIST = "m-0 grid list-none gap-1 p-0";
const ROW = "flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs";
const START_COMMAND = "./jm.sh up raccoon:worker";

/**
 * Whether anything is there to carry out the queue: each worker by its heartbeat — alive or silent, when it last
 * answered, how many jobs it holds — and, when none answers, the one command that starts it. Shared by the header's
 * activity panel and the Jobs page, so both say the same thing in the same words.
 */
export function WorkerHealth({ activity }: { activity: WorkspaceActivity }) {
  const { t, plural, language } = useTranslation();
  if (activity.workers.length === 0) {
    return (
      <p className="m-0 text-xs text-warn">
        {t("workers.none", "No worker has ever run here, so nothing queued is processed. Start one:")}{" "}
        <code className="numeric">{START_COMMAND}</code>
      </p>
    );
  }
  const heartbeatSeconds = Math.round(activity.heartbeatMilliseconds / 1000);
  return (
    <div className="grid gap-1.5">
      <ul className={LIST} aria-label={t("workers.label", "Workers")}>
        {activity.workers.map((worker) => (
          <li key={worker.identifier} className={ROW}>
            {worker.alive ? (
              <Badge tone="good">{t("workers.alive", "Alive")}</Badge>
            ) : (
              <Badge tone="error">{t("workers.silent", "Not answering")}</Badge>
            )}
            <span className="numeric font-semibold text-ink">{worker.identifier}</span>
            <span className="text-muted">
              {t("workers.lastSeen", "heartbeat {elapsed}", { elapsed: formatElapsed(worker.lastSeenAt, language) })}
            </span>
            {worker.alive && (
              <span className="text-secondary">
                {worker.runningJobs === 0
                  ? t("workers.idle", "idle")
                  : plural("workers.running", worker.runningJobs, { one: "running {count} job", other: "running {count} jobs" })}
              </span>
            )}
          </li>
        ))}
      </ul>
      {activity.workerAlive ? (
        <p className="m-0 text-[11px] text-muted">
          {t("workers.aliveHint", "A worker beats every {seconds} s and takes new work the moment it is queued.", { seconds: heartbeatSeconds })}
        </p>
      ) : (
        <p className="m-0 text-xs text-warn">
          {t("workers.silentHint", "Nothing queued is processed until a worker is started:")}{" "}
          <code className="numeric">{START_COMMAND}</code>
        </p>
      )}
    </div>
  );
}
