import { Link } from "@tanstack/react-router";
import { formatDateTime } from "../../application/format";
import { useResource } from "../../application/useResource";
import { describeTiming, schedulesApi, type ScheduleView } from "../../lib/schedules";
import { useTranslation } from "../../translations/TranslationProvider";
import { SCAN_LINE } from "./sourcePageClasses";

/**
 * "Scheduled: every 6 hours · next 14:00" — the schedules that scan this source, linked to where they are
 * managed. Nothing at all when none does; a failed read stays quiet, since the scan itself is unaffected.
 */
export function ScanSchedule({ workspaceId, sourceId }: { workspaceId: string; sourceId: string }) {
  const { t } = useTranslation();
  const schedules = useResource<ScheduleView[]>(
    () => schedulesApi.list(workspaceId, { limit: 10, offset: 0 }, sourceId),
    [workspaceId, sourceId],
  );
  if (schedules.status !== "ready" || schedules.data.length === 0) {
    return null;
  }
  return (
    <p className={SCAN_LINE}>
      {schedules.data.map((schedule) => (
        <span key={schedule.id} className="text-xs text-secondary">
          {schedule.enabled
            ? t("sources.schedule.active", "Scheduled: {timing} · next {next}", {
                timing: describeTiming(schedule.timing),
                next: formatDateTime(schedule.nextFireAt),
              })
            : t("sources.schedule.paused", "Scheduled: {timing} · paused", { timing: describeTiming(schedule.timing) })}
        </span>
      ))}
      <Link to="/automation" search={{ tab: "schedules" }} className="text-xs">
        {t("sources.schedule.link", "Schedules")}
      </Link>
    </p>
  );
}
