import { useState, type ReactNode } from "react";
import { useTranslation } from "../../translations/TranslationProvider";
import { Dialog, Icon } from "../primitives";

const HEAD = [
  "mb-6 flex items-start justify-between gap-6",
  // Stretched, so a long title wraps at the screen edge instead of widening the page.
  "max-[700px]:flex-col max-[700px]:items-stretch max-[700px]:gap-4",
].join(" ");

// Stacked under the title, a leading quiet button would sit its padding in from the text edge.
const ACTIONS = [
  "flex flex-none flex-wrap items-center gap-2",
  "max-[700px]:[&>[data-variant=quiet]:first-child]:[margin-left:calc(-12px*var(--ui-scale)-1px)]",
].join(" ");

/* Sits in the title line and is sized to it, quiet until pointed at. ⚠️ The rule is `--line`: this
   read `var(--border)` until the Tailwind migration, a name nothing in this interface declares
   except the code surface bridge — so the button wore a muted border on pages holding an editor and
   a currentColor one everywhere else. */
const HELP_BUTTON = [
  "inline-flex size-[calc(28px*var(--ui-scale))] flex-none cursor-pointer items-center justify-center",
  "rounded-[calc(4px*var(--ui-scale))] border border-line bg-transparent p-0 text-muted",
  "hover:bg-well hover:text-accent-text",
].join(" ");

interface PageHeaderProperties {
  title: ReactNode;
  /**
   * What the page is for and how it works. It is not printed under the title: a help button beside the
   * title opens it in a dialog, so the page starts with its content instead of a paragraph.
   */
  lead?: ReactNode;
  /** Small context line above the title, such as the area the page belongs to. */
  eyebrow?: ReactNode;
  /** A short state beside the title, such as an enabled badge; it reads as part of the name. */
  status?: ReactNode;
  actions?: ReactNode;
}

// The page's single h1. It is programmatically focusable so the shell can move focus to it after a
// route change, which tells assistive technology that the page changed.
export function PageHeader({ title, lead, eyebrow, status, actions }: PageHeaderProperties) {
  return (
    <header className={HEAD}>
      <div className="grid min-w-0 gap-2">
        {eyebrow !== undefined && <p className="eyebrow">{eyebrow}</p>}
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 tabIndex={-1} data-page-title="" className="focus:outline-none">
            {title}
          </h1>
          {lead !== undefined && <PageHelp title={title} help={lead} />}
          {status}
        </div>
      </div>
      {actions !== undefined && <div className={ACTIONS}>{actions}</div>}
    </header>
  );
}

/**
 * The help button beside a page title and the dialog it opens. The native dialog traps focus, closes on
 * Escape and returns focus to this button.
 */
export function PageHelp({ title, help }: { title: ReactNode; help: ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const about =
    typeof title === "string"
      ? t("pageHeader.help.about", "About {name}", { name: title })
      : t("pageHeader.help.aboutThisPage", "About this page");

  return (
    <>
      <button
        type="button"
        className={HELP_BUTTON}
        aria-label={about}
        aria-haspopup="dialog"
        title={about}
        onClick={() => {
          setOpen(true);
        }}
      >
        <Icon name="help" />
      </button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        title={title}
      >
        <div className="grid max-w-[70ch] gap-3 text-secondary">{help}</div>
      </Dialog>
    </>
  );
}
