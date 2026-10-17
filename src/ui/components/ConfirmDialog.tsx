import type { ReactNode } from "react";
import { useTranslation } from "../../translations/TranslationProvider";
import { Button, Dialog } from "../primitives";

interface ConfirmDialogProperties {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  /** Destructive confirmations use the danger button so the consequence is visible on the control. */
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProperties) {
  const { t } = useTranslation();
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="quiet" onClick={onCancel} disabled={busy}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
