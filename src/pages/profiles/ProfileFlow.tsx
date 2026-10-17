import { Link } from "@tanstack/react-router";
import { Fragment } from "react";
import { useReadySession } from "../../application/session";
import { useResource } from "../../application/useResource";
import type { Profile } from "../../lib/profiles";
import { Badge, Button, Icon, type BadgeTone } from "../../ui/primitives";
import { planAnswerFlow, planSearchFlow, type FlowMode, type ProfileFlowPlan, type StageState } from "./flowPlanning";
import { findProfile, loadProfileWiring, type ProfileWiring } from "./profileWiring";
import { useTranslation } from "../../translations/TranslationProvider";
import { declareText, type DeclaredText } from "../../translations/translate";

/* What a profile will do — stages in a row on a wide screen, a column on a phone. */

const FLOW = "grid min-w-0 gap-3 rounded-surface border border-line bg-surface p-4";

const FLOW_HEAD = "flex items-center gap-3";

const FLOW_TITLE = "text-base";

const FLOW_SUMMARY = "m-0 text-sm font-[550]";

/* Stage cards with arrows between them. They wrap rather than scroll, so the last stage — the result
   — is never hidden behind a scroll in a narrow column. */
const STAGES = [
  "m-0 flex list-none flex-wrap items-stretch gap-x-1 gap-y-2 p-0",
  "max-[900px]:flex-col max-[900px]:flex-nowrap",
].join(" ");

/*
 * ⚠️ A STAGE SAYS ITS STATE THREE WAYS: the rule across its top, a tint, and the words inside it.
 * `group` is what carries that state to the stage's name, which fades when the stage is off — a
 * child cannot read its own parent's attribute without it.
 */
const STAGE = [
  "group flex min-w-0 flex-[1_1_calc(150px*var(--ui-scale))] flex-col gap-2",
  "rounded-control border border-line bg-surface p-3 shadow-[inset_0_3px_0_var(--line-strong)]",
  "data-[state=runs]:shadow-[inset_0_3px_0_var(--allow)]",
  "data-[state=falls-back]:bg-[color-mix(in_srgb,var(--warn-soft)_45%,var(--surface))]",
  "data-[state=falls-back]:shadow-[inset_0_3px_0_var(--warn)]",
  "data-[state=cannot-run]:bg-[color-mix(in_srgb,var(--deny-soft)_45%,var(--surface))]",
  "data-[state=cannot-run]:shadow-[inset_0_3px_0_var(--deny)]",
  "data-[state=off]:bg-well",
].join(" ");

const STAGE_HEAD = "flex flex-wrap items-center justify-between gap-x-2 gap-y-1";

const STAGE_NAME = "text-sm font-[650] group-data-[state=off]:text-muted";

const DECIDED_BY = "m-0 text-xs text-secondary [overflow-wrap:anywhere]";

const CONSEQUENCE = "m-0 text-xs font-semibold";

/* The fix sits at the foot of its card and may wrap — its label is the instruction. */
const FIX = "mt-auto [&>*]:h-auto [&>*]:min-h-(--control) [&>*]:text-left [&>*]:whitespace-normal";

const ARROW = "grid flex-none place-items-center text-muted max-[900px]:rotate-90";

/*
 * ── The strip ───────────────────────────────────────────────────────────────────────────────────
 *
 * Two rows: the stages with the verdict and the link on the first, the summary on a full-width row of
 * its own. ⚠️ ONE ROW DID NOT WORK, TWICE: as a wrapping flex row the parts competed and the link fell
 * to a line of its own; as a three-column grid the stages took their natural width and left the
 * summary a ribbon of seven lines at the far end. The summary is a sentence — it gets a line.
 *
 * ⚠️ It sits on `bg-well` rather than `bg-surface`, because it reports on the form above it and must
 * read as quieter than it, not as a second panel of the same weight.
 */
const STRIP = [
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5",
  "min-h-[calc(34px*var(--ui-scale))] rounded-control border border-line bg-well px-3 py-2 text-xs",
  "data-[outcome=works]:shadow-[inset_3px_0_0_var(--allow)]",
  "data-[outcome=degraded]:shadow-[inset_3px_0_0_var(--warn)]",
  "data-[outcome=fails]:shadow-[inset_3px_0_0_var(--deny)]",
].join(" ");

const STRIP_STAGES = "m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0";

const STRIP_STAGE = [
  "group inline-flex items-center gap-1 whitespace-nowrap text-secondary",
  "data-[state=off]:text-muted",
].join(" ");

const GLYPH = [
  "text-2xs leading-none",
  "group-data-[state=runs]:text-allow group-data-[state=falls-back]:text-warn",
  "group-data-[state=cannot-run]:text-deny",
].join(" ");

const STRIP_VERDICT = "flex items-center gap-3 justify-self-end";

const STRIP_SUMMARY = "col-span-full m-0 min-w-0 text-ink";

const STRIP_DETAILS = "font-[550] whitespace-nowrap text-accent-text";

// What a profile will do, drawn stage by stage: blue runs, amber falls back to something smaller, red
// cannot run and fails the request, grey is left out by the configuration. The colour is never the only
// signal — every stage also says its state in a word and names the setting that decides it.

const STAGE_TONE: Record<StageState, BadgeTone> = { runs: "allow", "falls-back": "warn", "cannot-run": "deny", off: "neutral" };

/** A glyph per state, so the strip reads without colour: filled runs, half falls back, cross fails, ring is off. */
const STAGE_GLYPH: Record<StageState, string> = { runs: "●", "falls-back": "◐", "cannot-run": "✕", off: "○" };

const OUTCOME: Record<ProfileFlowPlan["outcome"], { tone: BadgeTone; word: DeclaredText }> = {
  works: { tone: "allow", word: declareText("profiles.flow.outcome.works", "Works") },
  degraded: { tone: "warn", word: declareText("profiles.flow.outcome.degraded", "Works with less") },
  fails: { tone: "deny", word: declareText("profiles.flow.outcome.fails", "Fails") },
  disabled: { tone: "neutral", word: declareText("profiles.flow.outcome.disabled", "Disabled") },
};

export function planFor(wiring: ProfileWiring, kind: "search" | "answer", profile: Profile, mode?: FlowMode): ProfileFlowPlan {
  return kind === "search" ? planSearchFlow(wiring, profile, mode) : planAnswerFlow(wiring, profile);
}

interface ProfileFlowProperties {
  plan: ProfileFlowPlan;
  /** Says the flow is computed from unsaved edits, or from the saved revision. */
  note?: string;
  headingLevel?: 2 | 3;
  /** The heading; where a chooser already says what this is, it names the profile instead. */
  title?: string;
}

/** The full flow: a one-sentence summary, then every stage with its state, the deciding setting and a fix. */
export function ProfileFlow({ plan, note, headingLevel = 2, title }: ProfileFlowProperties) {
  const { t, say } = useTranslation();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const outcome = OUTCOME[plan.outcome];
  const heading = title ?? t("profiles.flow.title", "What it will do");
  return (
    <section className={FLOW} aria-label={heading}>
      <div className={FLOW_HEAD}>
        <Heading className={FLOW_TITLE}>{heading}</Heading>
        <Badge tone={outcome.tone}>{say(outcome.word)}</Badge>
      </div>
      <p className={FLOW_SUMMARY}>{plan.summary}</p>
      {note !== undefined && <p className="text-xs text-muted">{note}</p>}
      <ol className={STAGES}>
        {plan.stages.map((entry, index) => (
          <Fragment key={entry.key}>
            <li className={STAGE} data-state={entry.state}>
              <div className={STAGE_HEAD}>
                <span className={STAGE_NAME}>{entry.name}</span>
                <Badge tone={STAGE_TONE[entry.state]}>{entry.word}</Badge>
              </div>
              <p className={DECIDED_BY}>{entry.decidedBy}</p>
              {entry.consequence !== undefined && <p className={CONSEQUENCE}>{entry.consequence}</p>}
              {entry.fix !== undefined && (
                <span className={FIX}>
                  <Button href={entry.fix.href} variant="quiet" icon="arrow" flush>
                    {entry.fix.label}
                  </Button>
                </span>
              )}
            </li>
            {index < plan.stages.length - 1 && (
              <li className={ARROW} aria-hidden="true">
                <Icon name="chevron" size="small" />
              </li>
            )}
          </Fragment>
        ))}
      </ol>
    </section>
  );
}

interface ProfileFlowStripViewProperties {
  plan: ProfileFlowPlan;
  /** The profile whose editor "Details" opens — it shows the full flow. */
  details?: { kind: "search" | "answer"; profileId: string };
}

/** The flow in brief, for the places a profile is used: each stage as a glyph and a word, the verdict, the summary. */
export function ProfileFlowStripView({ plan, details }: ProfileFlowStripViewProperties) {
  const { t, say } = useTranslation();
  const outcome = OUTCOME[plan.outcome];
  return (
    <div className={STRIP} data-outcome={plan.outcome}>
      <ol className={STRIP_STAGES} aria-label={t("profiles.flow.stripLabel", "What this profile will do")}>
        {plan.stages
          .filter((entry) => entry.key !== "question" && entry.key !== "result")
          .map((entry) => (
            <li key={entry.key} className={STRIP_STAGE} data-state={entry.state} title={`${entry.decidedBy}${entry.consequence === undefined ? "" : ` — ${entry.consequence}`}`}>
              <span className={GLYPH} aria-hidden="true">
                {STAGE_GLYPH[entry.state]}
              </span>
              <span>{entry.name}</span>
              <span className="sr-only">: {entry.word}</span>
            </li>
          ))}
      </ol>
      <span className={STRIP_VERDICT}>
        <Badge tone={outcome.tone}>{say(outcome.word)}</Badge>
        {details !== undefined && (
          <Link to="/profiles/$kind/$profileId" params={details} className={STRIP_DETAILS}>
            {t("profiles.flow.details", "Details")}
          </Link>
        )}
      </span>
      <p className={STRIP_SUMMARY}>{plan.summary}</p>
    </div>
  );
}

interface ProfileFlowStripProperties {
  /** The search or answer profile chosen where the strip is shown; nothing is drawn without one. */
  kind: "search" | "answer";
  profileId: string | null;
  /** A search mode the person chose for this request, when the profile allows overrides. */
  mode?: FlowMode;
}

/**
 * Self-loading strip for Search and Ask: give it the chosen profile and it reads the workspace's profiles,
 * providers, vectors and settings, and says what the next request will do. While it loads it keeps its
 * height, so the page does not move.
 */
export function ProfileFlowStrip({ kind, profileId, mode }: ProfileFlowStripProperties) {
  // The plan's words are written while planning, so a change of language must plan again.
  useTranslation();
  const { workspace } = useReadySession();
  const workspaceId = workspace?.id ?? "";
  const wiring = useResource(() => loadProfileWiring(workspaceId), [workspaceId]);
  if (profileId === null) {
    return null;
  }
  if (wiring.status !== "ready") {
    return <div className={STRIP} aria-busy="true" />;
  }
  const profile = findProfile(wiring.data, kind, profileId);
  if (profile === null) {
    return null;
  }
  return <ProfileFlowStripView plan={planFor(wiring.data, kind, profile, mode)} details={{ kind, profileId: profile.id }} />;
}
