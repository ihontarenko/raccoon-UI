// A workspace's schedules: scans and vectorisations that fire by themselves, and what became of each
// firing. Mirrors `schedules/WorkspaceSchedules`; the trigger itself lives in jmouse-scheduler's store.

import { api, pageQuery, workspacePath, type PageRequest } from "./api";
import { declareText, translate, translatePlural, type DeclaredText } from "../translations/translate";
import type { JobStatus } from "./contracts";

export type ScheduleHandler = "scan-source" | "vectorise-waiting";
export type TimingKind = "CRON" | "INTERVAL";
export type OccurrenceOutcome = "FIRED" | "SKIPPED" | "REFUSED" | "FAILED";

export interface ScheduleTiming {
  kind: TimingKind;
  /** A five- or six-field cron expression, or a macro such as `@daily`. */
  expression: string | null;
  /** The time zone a cron expression is read in. */
  zone: string | null;
  /** An interval's period; intervals count from the epoch, so an hourly one fires on the hour. */
  periodSeconds: number | null;
}

export interface ScheduleOccurrence {
  scheduledAt: string;
  recordedAt: string;
  outcome: OccurrenceOutcome;
  /** How many occurrences the line stands for — a SKIPPED line covers every one missed. */
  count: number;
  /** The gate's refusal, the misfire range, or the work's own words when it failed. */
  reason: string | null;
  /** The job a fired occurrence queued, and what became of it. */
  jobId: string | null;
  jobStatus: JobStatus | null;
  jobFailureCode: string | null;
}

export interface ScheduleView {
  id: string;
  handler: ScheduleHandler;
  /** Null only when the trigger behind the schedule is missing; saving it again restores it. */
  timing: ScheduleTiming | null;
  parameters: Record<string, unknown>;
  sourceId: string | null;
  embeddingProfileId: string | null;
  /** The source scanned or the embedding profile vectorised with. */
  subject: string | null;
  enabled: boolean;
  nextFireAt: string | null;
  misfirePolicy: string | null;
  gate: string | null;
  lastOccurrence: ScheduleOccurrence | null;
  /** Whom a firing acts as: the person who last saved or resumed the schedule. */
  actorId: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface SaveSchedule {
  handler: ScheduleHandler;
  timing: ScheduleTiming;
  parameters: Record<string, unknown>;
  enabled: boolean;
}

const base = (workspaceId: string) => workspacePath(workspaceId, "/schedules");

export const schedulesApi = {
  list: (workspaceId: string, page: PageRequest, sourceId?: string) =>
    api.send<ScheduleView[]>(
      "GET",
      `${base(workspaceId)}?${pageQuery(page)}${sourceId === undefined ? "" : `&sourceId=${sourceId}`}`,
    ),
  history: (workspaceId: string, scheduleId: string, page: PageRequest) =>
    api.send<ScheduleOccurrence[]>("GET", `${base(workspaceId)}/${scheduleId}/history?${pageQuery(page)}`),
  create: (workspaceId: string, schedule: SaveSchedule) => api.send<ScheduleView>("POST", base(workspaceId), schedule),
  change: (workspaceId: string, current: ScheduleView, schedule: SaveSchedule) =>
    api.send<ScheduleView>("PUT", `${base(workspaceId)}/${current.id}`, { ...schedule, revision: current.revision }),
  changeEnabled: (workspaceId: string, current: ScheduleView, enabled: boolean) =>
    api.send<ScheduleView>("PUT", `${base(workspaceId)}/${current.id}/enabled`, { enabled, revision: current.revision }),
  remove: (workspaceId: string, current: ScheduleView) =>
    api.send<void>("DELETE", `${base(workspaceId)}/${current.id}?revision=${current.revision}`),
};

interface PeriodUnit {
  seconds: number;
  /** The unit's name in the editor's unit list. */
  label: DeclaredText;
  /** "every day" — a period of exactly one unit. */
  everyOne: () => string;
  /** "every 5 days" — a period of several units, in the viewer's language and its plural forms. */
  everyMany: (count: number) => string;
}

const UNITS: PeriodUnit[] = [
  {
    seconds: 86400,
    label: declareText("automation.schedules.unit.days", "days"),
    everyOne: () => translate("automation.schedules.timing.everyDay", "every day"),
    everyMany: (count) =>
      translatePlural("automation.schedules.timing.everyDays", count, { one: "every {count} day", other: "every {count} days" }),
  },
  {
    seconds: 3600,
    label: declareText("automation.schedules.unit.hours", "hours"),
    everyOne: () => translate("automation.schedules.timing.everyHour", "every hour"),
    everyMany: (count) =>
      translatePlural("automation.schedules.timing.everyHours", count, { one: "every {count} hour", other: "every {count} hours" }),
  },
  {
    seconds: 60,
    label: declareText("automation.schedules.unit.minutes", "minutes"),
    everyOne: () => translate("automation.schedules.timing.everyMinute", "every minute"),
    everyMany: (count) =>
      translatePlural("automation.schedules.timing.everyMinutes", count, { one: "every {count} minute", other: "every {count} minutes" }),
  },
];

const SECOND: PeriodUnit = {
  seconds: 1,
  label: declareText("automation.schedules.unit.seconds", "seconds"),
  everyOne: () => translate("automation.schedules.timing.everySecond", "every second"),
  everyMany: (count) =>
    translatePlural("automation.schedules.timing.everySeconds", count, { one: "every {count} second", other: "every {count} seconds" }),
};

/** "every 5 minutes", "every day", "cron 0 3 * * * (Europe/Kyiv)" — in the viewer's language, read at render time. */
export function describeTiming(timing: ScheduleTiming | null): string {
  if (timing === null) {
    return translate("automation.schedules.timing.none", "No timing");
  }
  if (timing.kind === "CRON") {
    const zone = timing.zone !== null && timing.zone !== "Z" && timing.zone !== "UTC" ? timing.zone : "UTC";
    return translate("automation.schedules.timing.cron", "cron {expression} ({zone})", { expression: timing.expression ?? "", zone });
  }
  const seconds = timing.periodSeconds ?? 0;
  const unit = UNITS.find((candidate) => seconds % candidate.seconds === 0) ?? SECOND;
  const count = seconds / unit.seconds;
  return count === 1 ? unit.everyOne() : unit.everyMany(count);
}

/** The largest whole unit a period is written in, for the editor. */
export function periodInUnits(seconds: number): { amount: number; unitSeconds: number } {
  const unit = UNITS.find((candidate) => seconds % candidate.seconds === 0) ?? UNITS[UNITS.length - 1];
  return { amount: seconds / unit.seconds, unitSeconds: unit.seconds };
}

export const PERIOD_UNITS = UNITS;
