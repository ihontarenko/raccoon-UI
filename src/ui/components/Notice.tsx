import type { ReactNode } from "react";
import { classNames } from "../../lib/classNames";

export type NoticeTone = "information" | "good" | "warn" | "error";

interface NoticeProperties {
  tone?: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  /** The one thing to do about it, set beside the text — a notice that only explains needs none. */
  action?: ReactNode;
}

const SHARED = classNames(
  "relative grid gap-1 overflow-hidden rounded-control text-sm",
  "[padding:var(--space-3)_var(--space-4)_var(--space-3)_calc(var(--space-4)+2px)]",
  'before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-(--leading-colour) before:content-[""]',
);

/* Each tone is a tint of its own colour over the surface rather than a colour of its own, so a
   notice sits on the page it is part of; the leading stripe is the full-strength one. */
const TONE_CLASS: Record<NoticeTone, string> = {
  information:
    "bg-[color-mix(in_srgb,var(--accent)_10%,var(--surface))] [--leading-colour:var(--accent-text)]",
  good: "bg-[color-mix(in_srgb,var(--good)_12%,var(--surface))] [--leading-colour:var(--good)]",
  warn: "bg-[color-mix(in_srgb,var(--warn)_12%,var(--surface))] [--leading-colour:var(--warn)]",
  error: "bg-[color-mix(in_srgb,var(--danger)_12%,var(--surface))] [--leading-colour:var(--danger)]",
};

/*
 * With an action, the text keeps the left column and the action sits on the right across every row;
 * a narrow notice puts the action under the text instead. ⚠️ The breakpoint is the notice's OWN
 * width, not the page's — `@container` plus `@max-[420px]:` — because the same notice is shown in a
 * full-width page band and in a 340px inspector, and the page width says nothing about which.
 */
const WITH_ACTION = "@container grid-cols-[minmax(0,1fr)_auto] gap-x-4";

const ACTION = classNames(
  "col-start-2 row-span-2 row-start-1 self-center",
  "@max-[420px]:col-start-1 @max-[420px]:row-auto @max-[420px]:justify-self-start",
);

// A callout with the leading-edge stripe. Errors are announced as alerts; every other tone is
// static context. The tone is always carried by words too, never by colour alone.
export function Notice({ tone = "information", title, children, action }: NoticeProperties) {
  return (
    <div
      className={classNames(SHARED, TONE_CLASS[tone], action !== undefined && WITH_ACTION)}
      role={tone === "error" ? "alert" : undefined}
    >
      {title !== undefined && <p className="col-start-1 font-semibold">{title}</p>}
      {children !== undefined && <div className="col-start-1 text-secondary">{children}</div>}
      {action !== undefined && <div className={ACTION}>{action}</div>}
    </div>
  );
}
