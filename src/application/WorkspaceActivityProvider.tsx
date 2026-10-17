import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PERMISSIONS } from "../access/permissions";
import { usePermissions } from "../access/PermissionsProvider";
import { api } from "../lib/api";
import { workspaceJobsApi, type WorkspaceActivity } from "../lib/workspaceJobs";
import { useTranslation } from "../translations/TranslationProvider";
import { useToaster } from "../ui/components";
import { usePolling } from "./usePolling";

/* While something moves the header follows it closely; at rest it only has to notice new work or a worker
   that went away, which is not worth a request every two seconds from every open tab. */
const MOVING_INTERVAL_MILLISECONDS = 2000;
const RESTING_INTERVAL_MILLISECONDS = 10000;
/* A save that changes several things at once is one burst of requests; one read after it is enough. */
const MUTATION_SETTLE_MILLISECONDS = 300;

interface WorkspaceActivityValue {
  /** Null until the first read, and for a viewer who may not read the workspace's jobs. */
  activity: WorkspaceActivity | null;
  /** Read again now — after a page queued work, so the header does not wait out its interval. */
  refresh: () => void;
}

const WorkspaceActivityContext = createContext<WorkspaceActivityValue>({ activity: null, refresh: () => {} });

function waitingOf(activity: WorkspaceActivity): number {
  return activity.totals.queued + activity.totals.awaitingSubmission;
}

/**
 * One reader of the workspace's background work for the whole shell: the header's indicator and any page that
 * wants to know whether its document is queued and whether a worker is there to take it ask this, not the server.
 *
 * It also says out loud, once, the two things nobody should have to open a panel to learn: that something was just
 * run while no worker is there to take it, and that the worker stopped answering or came back.
 */
export function WorkspaceActivityProvider({ workspaceId, children }: { workspaceId: string | null; children: ReactNode }) {
  const permissions = usePermissions();
  const { notify } = useToaster();
  const { t, plural } = useTranslation();
  const mayRead = workspaceId !== null && !permissions.loading && permissions.may(PERMISSIONS.automationRead);
  const [activity, setActivity] = useState<WorkspaceActivity | null>(null);
  const previous = useRef<WorkspaceActivity | null>(null);

  const refresh = useCallback(() => {
    if (!mayRead || workspaceId === null) {
      return;
    }
    workspaceJobsApi.activity(workspaceId).then(setActivity, () => {
      // A failed read keeps the last answer: the indicator is a report, and a blip must not blank it.
    });
  }, [mayRead, workspaceId]);

  useEffect(() => {
    previous.current = null;
    setActivity(null);
    refresh();
  }, [refresh]);

  // Whatever a page just did may have queued work; read now rather than at the next interval.
  useEffect(() => {
    let timer: number | undefined;
    api.onMutation(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(refresh, MUTATION_SETTLE_MILLISECONDS);
    });
    return () => {
      window.clearTimeout(timer);
      api.onMutation(null);
    };
  }, [refresh]);

  useEffect(() => {
    const before = previous.current;
    previous.current = activity;
    if (activity === null || before === null) {
      return;
    }
    if (before.workerAlive && !activity.workerAlive) {
      notify({
        tone: "error",
        title: t("backgroundWork.notice.workerStopped", "The worker stopped answering"),
        description: t("backgroundWork.notice.workerStoppedDescription", "Queued work waits until it is started again: ./jm.sh up raccoon:worker"),
      });
      return;
    }
    if (!before.workerAlive && activity.workerAlive) {
      notify({
        tone: "good",
        title: t("backgroundWork.notice.workerBack", "The worker is running again"),
        description: plural("backgroundWork.notice.workerBackDescription", waitingOf(activity), {
          one: "It is taking the {count} waiting job.",
          other: "It is taking the {count} waiting jobs.",
        }),
      });
      return;
    }
    if (!activity.workerAlive && waitingOf(activity) > waitingOf(before)) {
      notify({
        tone: "error",
        title: t("backgroundWork.notice.queuedWithoutWorker", "Queued, but the worker is not running"),
        description: plural("backgroundWork.notice.queuedWithoutWorkerDescription", waitingOf(activity), {
          one: "{count} job waits until it starts: ./jm.sh up raccoon:worker",
          other: "{count} jobs wait until it starts: ./jm.sh up raccoon:worker",
        }),
      });
    }
    // Only a new answer is news; the translation functions change with the language and must not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity]);

  const moving = activity !== null && activity.workerAlive && activity.totals.running + waitingOf(activity) > 0;
  usePolling(mayRead, refresh, moving, moving ? MOVING_INTERVAL_MILLISECONDS : RESTING_INTERVAL_MILLISECONDS);

  const value = useMemo(() => ({ activity: mayRead ? activity : null, refresh }), [activity, mayRead, refresh]);
  return <WorkspaceActivityContext.Provider value={value}>{children}</WorkspaceActivityContext.Provider>;
}

export function useWorkspaceActivity(): WorkspaceActivityValue {
  return useContext(WorkspaceActivityContext);
}
