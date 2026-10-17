import { translate } from "../../translations/translate";

interface WaitingProperties {
  /** What is being loaded, read out to assistive technology. */
  label?: string;
  /** Number of placeholder lines; a rough match to the content keeps the layout stable. */
  lines?: number;
}

export function Waiting({ label, lines = 3 }: WaitingProperties) {
  const spoken = label ?? translate("common.loadingLabel", "Loading");
  return (
    <div className="grid gap-3 px-4 py-6" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{spoken}…</span>
      {Array.from({ length: lines }, (_unused, index) => (
        <span
          key={index}
          className="block h-[calc(12px*var(--ui-scale))] animate-waiting bg-line motion-reduce:animate-none"
          style={{ maxWidth: `${70 - (index % 3) * 15}%` }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
