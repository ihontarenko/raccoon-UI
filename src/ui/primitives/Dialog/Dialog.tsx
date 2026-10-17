import { translate } from "../../../translations/translate";
import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from "react";
import { Button } from "../Button/Button";
import { classNames } from "../../../lib/classNames";

interface DialogProperties {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** Optional action row pinned to the bottom of the dialog, typically a pair of buttons. */
  footer?: ReactNode;
  /** `wide` for a dialog holding a table or a report; the regular width suits a short form. */
  size?: "regular" | "wide";
}

// Built on the native <dialog> element, which traps focus while open, restores focus to the trigger
// on close, and handles Escape through its own cancel/close events. React only drives the open state
// and the backdrop-click convenience.
/* The dialog takes the focus when it opens so no control inside is pre-ringed, and it is not itself
   a control: its own border and backdrop already say where the focus went, and a ring around the
   whole panel only reads as an error. Every control inside keeps its ring. */
/*
 * ⚠️ `m-auto` IS WHAT CENTRES IT, AND IT HAS TO BE SAID. A modal `<dialog>` is centred by the
 * browser's own `margin: auto`, and Tailwind's preflight resets `margin` to zero on every element —
 * so every dialog in the product sat in the top-left corner until this was put back. Nothing in the
 * component says "centre"; the one word is the whole of it.
 */
const SHELL = classNames(
  "m-auto max-h-[90dvh] overflow-hidden rounded-dialog border border-line-strong bg-surface p-0 text-ink shadow-dialog",
  "backdrop:bg-scrim focus:outline-none focus-visible:outline-none",
);

const WIDTH: Record<NonNullable<DialogProperties["size"]>, string> = {
  regular: "w-[min(calc(580px*var(--ui-scale)),calc(100vw-var(--space-6)))]",
  wide: "w-[min(calc(860px*var(--ui-scale)),calc(100vw-var(--space-6)))]",
};

export function Dialog({ open, onClose, title, children, footer, size = "regular" }: DialogProperties) {
  const dialogReference = useRef<HTMLDialogElement>(null);
  const requestedOpenReference = useRef(open);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogReference.current;
    requestedOpenReference.current = open;
    if (dialog === null) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
      // `showModal` hands the focus to the first control inside, which is the close button, and marks
      // it focus-visible however the dialog was opened — so opening one by tapping drew a focus ring
      // around a dismiss button nobody was aiming at. The dialog itself takes the focus instead: it
      // is still inside the trap, a screen reader still announces the dialog and its title, and the
      // first Tab reaches the same control it always did.
      dialog.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogReference.current;
    if (dialog === null) {
      return;
    }
    // The native close event also fires when the parent closes the dialog itself; only a close the
    // person caused (Escape) while the parent still wants it open is reported back.
    const handleClose = () => {
      if (requestedOpenReference.current) {
        onClose();
      }
    };
    dialog.addEventListener("close", handleClose);
    return () => {
      dialog.removeEventListener("close", handleClose);
    };
  }, [onClose]);

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogReference.current) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogReference}
      className={classNames(SHELL, WIDTH[size])}
      data-size={size}
      /* Focusable only on purpose: it is where the focus is put when the dialog opens, never a stop
         on the way through with Tab. */
      tabIndex={-1}
      aria-labelledby={titleId}
      onClick={handleBackdropClick}
    >
      <div className="flex max-h-[90dvh] flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
          <h2 id={titleId} className="[overflow-wrap:anywhere]">
            {title}
          </h2>
          <Button variant="quiet" iconOnly icon="close" aria-label={translate("common.close", "Close")} onClick={onClose} />
        </header>
        <div className="overflow-auto p-6">{children}</div>
        {footer !== undefined && (
          <footer className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</footer>
        )}
      </div>
    </dialog>
  );
}
