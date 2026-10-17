import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { describeProblem, type Problem } from "../../application/problems";
import { useReadySession } from "../../application/session";
import { useResource } from "../../application/useResource";
import { workspaceLockApi } from "../../lib/workspaceLocks";
import { useTranslation } from "../../translations/TranslationProvider";
import { Notice } from "../components";
import { Button, Field, Icon, Input } from "../primitives";

/* One quiet panel in the middle of the page — the workspace's name, the PIN field, the button. Nothing behind it
   renders, so nothing of the workspace is fetched before the PIN is given. */
const GATE = "mx-auto mt-16 grid w-[min(calc(380px*var(--ui-scale)),100%)] gap-4 rounded-surface border border-line bg-surface p-6";

const HEAD = "flex items-center gap-3 [&_h1]:m-0 [&_h1]:text-lg";

const PIN = "font-mono tracking-[0.4em]";

/** A strip above an open locked workspace: it is open in this browser, until when, and the way to shut it now. */
const OPEN_STRIP = "flex flex-wrap items-center gap-3 border-b border-line bg-well px-8 py-2 text-xs text-secondary";

/**
 * Stands in front of a PIN-locked workspace: until the PIN is given in this browser, the page behind it is not
 * rendered at all. Once open, a thin strip says so and offers to lock it again.
 */
export function WorkspaceLockGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { workspace } = useReadySession();
  const locked = workspace?.locked === true;
  const state = useResource(async () => (locked && workspace !== null ? workspaceLockApi.state(workspace.id) : null), [workspace?.id, locked]);
  const [pin, setPin] = useState("");
  const [opening, setOpening] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  useEffect(() => {
    setPin("");
    setProblem(null);
  }, [workspace?.id]);

  if (!locked || workspace === null) {
    return <>{children}</>;
  }
  if (state.status !== "ready") {
    return null;
  }
  const open = state.data !== null && state.data.openUntil !== null;

  if (open) {
    return (
      <>
        <div className={OPEN_STRIP} role="status">
          <Icon name="access" size="small" />
          <span>
            {t("lock.openUntil", "{workspace} is open in this browser until {time}.", {
              workspace: workspace.name,
              time: new Date(state.data!.openUntil!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            })}
          </span>
          <Button
            variant="quiet"
            onClick={() => {
              void workspaceLockApi.close(workspace.id).then(() => state.reload());
            }}
          >
            {t("lock.closeNow", "Lock now")}
          </Button>
        </div>
        {children}
      </>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setOpening(true);
    setProblem(null);
    try {
      await workspaceLockApi.open(workspace.id, pin);
      setPin("");
      state.reload();
    } catch (error) {
      setProblem(describeProblem(error));
    } finally {
      setOpening(false);
    }
  };

  return (
    <form className={GATE} onSubmit={(event) => void submit(event)} aria-labelledby="lock-title">
      <div className={HEAD}>
        <Icon name="access" />
        <h1 id="lock-title">{workspace.name}</h1>
      </div>
      <p className="m-0 text-sm text-secondary">
        {t("lock.lead", "This workspace is locked with a PIN. It opens in this browser for fifteen minutes.")}
      </p>
      <Field label={t("lock.pin", "PIN")}>
        <Input
          className={PIN}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          maxLength={12}
          fullWidth
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
        />
      </Field>
      {problem !== null && (
        <Notice tone="error" title={problem.title}>
          {problem.detail ?? problem.description}
        </Notice>
      )}
      <Button type="submit" variant="primary" disabled={pin.length < 4 || opening}>
        {opening ? t("lock.opening", "Opening…") : t("lock.open", "Open")}
      </Button>
    </form>
  );
}
