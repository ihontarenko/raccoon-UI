import type { ReactNode } from "react";

interface EmptyStateProperties {
  title: ReactNode;
  description?: ReactNode;
  /** The next useful step, typically one button or link. */
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProperties) {
  return (
    <div className="grid justify-items-center gap-3 px-6 py-12 text-center">
      <h2 className="text-base">{title}</h2>
      {description !== undefined && <p className="max-w-[48ch] text-secondary">{description}</p>}
      {action !== undefined && (
        <div className="flex flex-wrap justify-center gap-2">{action}</div>
      )}
    </div>
  );
}
