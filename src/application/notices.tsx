import { useEffect } from "react";
import { api } from "../lib/api";
import { useToaster } from "../ui/components";
import { useSession } from "./session";

/* Notices for the signed-in account, shown as toasts.

   The server keeps them in memory for a few minutes and hands each one to each browser once — this browser
   names itself with a random id it keeps, so two open windows both show a notice instead of one swallowing
   it. A failure to ask is silent: the next look tries again, and a toast about toasts would be noise. */

const POLL_MILLISECONDS = 15_000;
const CLIENT_KEY = "raccoon.notices.client";

function clientIdentifier(): string {
  try {
    const kept = window.localStorage.getItem(CLIENT_KEY);
    if (kept) {
      return kept;
    }
    const fresh = crypto.randomUUID();
    window.localStorage.setItem(CLIENT_KEY, fresh);
    return fresh;
  } catch {
    // Private windows and blocked storage: a per-load id still shows each notice once on this page.
    return crypto.randomUUID();
  }
}

export function NoticePoller() {
  const { state } = useSession();
  const { notify } = useToaster();
  const signedIn = state.status === "ready";

  useEffect(() => {
    if (!signedIn) {
      return;
    }

    const client = clientIdentifier();
    let stopped = false;

    async function look() {
      try {
        const arrived = await api.notices(client);
        if (stopped) {
          return;
        }
        for (const notice of arrived) {
          notify({
            tone: notice.level === "info" ? "neutral" : "error",
            title: notice.title ?? notice.from,
            description: notice.title ? `${notice.body} — ${notice.from}` : notice.body,
          });
        }
      } catch {
        // Silent on purpose — see the note above.
      }
    }

    void look();
    const timer = window.setInterval(() => void look(), POLL_MILLISECONDS);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [signedIn, notify]);

  return null;
}
