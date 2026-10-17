import type { ReactNode } from "react";
import { classNames } from "../../../lib/classNames";

/**
 * `allow` and `deny` are verdicts — included or refused, permitted or forbidden — and stay blue and red
 * under every palette; `good` and `error` are outcomes of work that ran. `door` and `pipeline` are places, not
 * states: where a rule set rule runs, and so what runs it — a source at the door, a processing profile in the pipeline.
 */
export type BadgeTone =
  "neutral" | "active" | "good" | "warn" | "error" | "allow" | "deny" | "door" | "pipeline";

interface BadgeProperties {
  tone?: BadgeTone;
  children: ReactNode;
}

/*
 * The leading stripe is a straight rectangle clipped by the rounded host, never a curved border. The
 * host clips it with `overflow-hidden` and draws it with `before:`, so the corners stay square
 * against the badge's small radius.
 *
 * ⚠️ The edge is not decoration. A badge is dropped onto whatever surface its row has, and a
 * selected row is painted `--accent-soft` — the very colour the `active` tone fills with. Without an
 * edge of its own tone the badge dissolves into the row and only its stripe survives. Every tone
 * therefore carries a tinted border mixed from the same colour as its stripe.
 *
 * ⚠️ A badge keeps its own height whatever it is dropped beside. Put one in a flex row next to a
 * button — as the chunk list does — and the row's default `align-items: stretch` pulls it to the
 * control height, so a two-word label sits in a box the size of a button and reads as one.
 * `flex-none self-center` are ignored wherever the badge is not a flex item, and cost nothing there.
 */
const SHARED = classNames(
  "relative inline-flex flex-none items-center gap-[calc(5px*var(--ui-scale))] self-center overflow-hidden whitespace-nowrap",
  "rounded-[calc(4px*var(--ui-scale))] border border-[color-mix(in_srgb,var(--leading-colour)_55%,transparent)]",
  "[padding:calc(1px*var(--ui-scale))_calc(var(--space-2)-1px)_calc(1px*var(--ui-scale))_calc(var(--space-2)+1px)]",
  "text-2xs leading-[1.55] font-semibold",
  'before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-(--leading-colour) before:content-[""]',
);

/*
 * ⚠️ EVERY TONE DECLARES ALL THREE — fill, ink and `--leading-colour` — INCLUDING `neutral`. Nothing
 * here is merged (see `lib/classNames`), so a default written into `SHARED` and overridden per tone
 * would leave two declarations of one property on the element and let the stylesheet's own order
 * decide, which for two arbitrary properties is not something this file can predict.
 */
const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "bg-well text-secondary [--leading-colour:var(--line-strong)]",
  active: "bg-accent-soft text-accent-text [--leading-colour:var(--accent-text)]",
  good: "bg-good-soft text-good [--leading-colour:var(--good)]",
  warn: "bg-warn-soft text-warn [--leading-colour:var(--warn)]",
  error: "bg-danger-soft text-danger [--leading-colour:var(--danger)]",
  allow: "bg-allow-soft text-allow [--leading-colour:var(--allow)]",
  deny: "bg-deny-soft text-deny [--leading-colour:var(--deny)]",
  door: "bg-place-door-soft text-place-door [--leading-colour:var(--place-door)]",
  pipeline: "bg-place-pipeline-soft text-place-pipeline [--leading-colour:var(--place-pipeline)]",
};

export function Badge({ tone = "neutral", children }: BadgeProperties) {
  return <span className={classNames(SHARED, TONE_CLASS[tone])}>{children}</span>;
}
