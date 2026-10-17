import type { ReactNode } from "react";

/**
 * The band above a tab's content: what the tab shows, said in a sentence, and the one control that narrows
 * it. Both halves of a document — the parsed text and the chunks cut from it — are read the same way, so
 * they are introduced the same way rather than by two components that happen to look alike.
 */
export function TabToolbar({ children, control }: { children: ReactNode; control?: ReactNode }) {
  // The band introducing a tab: a sentence on the left, the control that narrows the view on the right.
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <p className="m-0 min-w-0 flex-[1_1_calc(320px*var(--ui-scale))] text-xs text-secondary [overflow-wrap:anywhere]">
        {children}
      </p>
      {control !== undefined && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">{control}</div>
      )}
    </div>
  );
}
