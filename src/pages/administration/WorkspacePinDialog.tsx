import { useEffect, useState, type FormEvent } from "react";
import { describeProblem, type Problem } from "../../application/problems";
import type { WorkspaceView } from "../../lib/contracts";
import { workspaceLockApi } from "../../lib/workspaceLocks";
import { useTranslation } from "../../translations/TranslationProvider";
import { Notice } from "../../ui/components";
import { Button, Checkbox, Dialog, Field, Input } from "../../ui/primitives";

const PIN = "font-mono tracking-[0.4em]";

/**
 * Sets, changes or removes a workspace's PIN. Locking may also write the jMP denials that keep agents and the Telegram
 * bot out — the PIN guards the interface, the rules guard the channels, and both are shown where they belong.
 */
export function WorkspacePinDialog({ workspace, onClose, onSaved }: { workspace: WorkspaceView | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [pin, setPin] = useState("");
  const [repeat, setRepeat] = useState("");
  const [keepChannelsOut, setKeepChannelsOut] = useState(true);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  useEffect(() => {
    setPin("");
    setRepeat("");
    setKeepChannelsOut(true);
    setProblem(null);
  }, [workspace?.id]);

  if (workspace === null) {
    return null;
  }
  const removing = workspace.locked;
  const mismatch = !removing && repeat !== "" && repeat !== pin;
  const ready = pin.length >= 4 && (removing || repeat === pin);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready) {
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      if (removing) {
        await workspaceLockApi.remove(workspace.id, pin);
      } else {
        await workspaceLockApi.lock(workspace.id, pin, keepChannelsOut);
      }
      onSaved();
    } catch (error) {
      setProblem(describeProblem(error));
    } finally {
      setSaving(false);
    }
  };

  const digits = (value: string) => value.replace(/\D/g, "").slice(0, 12);

  return (
    <Dialog
      open
      onClose={onClose}
      title={removing ? t("pin.removeTitle", "Remove the PIN of {name}", { name: workspace.name }) : t("pin.setTitle", "Lock {name} with a PIN", { name: workspace.name })}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={saving}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="submit" form="workspace-pin" variant={removing ? "danger" : "primary"} disabled={!ready || saving}>
            {removing ? t("pin.remove", "Remove the PIN") : t("pin.set", "Lock")}
          </Button>
        </>
      }
    >
      <form id="workspace-pin" className="grid gap-4" onSubmit={(event) => void submit(event)}>
        <p className="m-0 text-sm text-secondary">
          {removing
            ? t("pin.removeLead", "Give the current PIN. The workspace opens for everybody who may read it; any rules keeping agents or Telegram out stay until removed on the access screen.")
            : t("pin.setLead", "Everyone who opens this workspace in the interface is asked for the PIN; it then stays open in that browser for fifteen minutes.")}
        </p>
        <Field label={removing ? t("pin.current", "Current PIN") : t("pin.new", "PIN — 4 to 12 digits")}>
          <Input className={PIN} type="password" inputMode="numeric" autoComplete="off" fullWidth value={pin} onChange={(event) => setPin(digits(event.target.value))} />
        </Field>
        {!removing && (
          <>
            <Field label={t("pin.repeat", "The PIN again")} error={mismatch ? t("pin.mismatch", "The two PINs differ.") : undefined}>
              <Input className={PIN} type="password" inputMode="numeric" autoComplete="off" fullWidth value={repeat} onChange={(event) => setRepeat(digits(event.target.value))} />
            </Field>
            <Checkbox
              checked={keepChannelsOut}
              onChange={(event) => setKeepChannelsOut(event.target.checked)}
              label={t("pin.keepChannelsOut", "Also keep agents (MCP) and the Telegram bot out — written as jMP denials for everybody")}
            />
          </>
        )}
        {problem !== null && (
          <Notice tone="error" title={problem.title}>
            {problem.detail ?? problem.description}
          </Notice>
        )}
      </form>
    </Dialog>
  );
}
