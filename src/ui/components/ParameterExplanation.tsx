import { useState } from "react";
import { createPortal } from "react-dom";
import { declareText, type DeclaredText } from "../../translations/translate";
import { useTranslation } from "../../translations/TranslationProvider";
import { classNames } from "../../lib/classNames";
import { Badge, Dialog, Icon } from "../primitives";

/* The trigger sits in a label line, so it is sized to the text, not to a control row.

   ⚠️ THE INK IS CHOSEN IN TYPESCRIPT RATHER THAN BY A `hover:` VARIANT, because a trigger carrying a
   finding must KEEP its warning colour while pointed at — the fill changes, the colour does not. Two
   variants setting one property would leave that to whichever Tailwind emitted last. */
const TRIGGER = [
  "inline-flex size-[calc(20px*var(--ui-scale))] flex-none cursor-pointer items-center justify-center",
  "rounded-[calc(4px*var(--ui-scale))] border border-transparent bg-transparent p-0 align-middle hover:bg-well",
].join(" ");

const TRIGGER_INK: Record<"warn" | "deny" | "none", string> = {
  warn: "text-warn",
  deny: "text-deny",
  none: "text-muted hover:text-accent-text",
};

const SECTION = "grid min-w-0 gap-1";

const HEADING = "text-2xs font-[650] tracking-[0.06em] text-muted uppercase";

const EXTREME = [
  "grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] gap-3 border-b border-line py-2",
  "[&>dt]:font-semibold [&>dt]:[font-variant-numeric:tabular-nums] [&>dd]:m-0",
  "data-[trap=true]:[&>dd]:text-ink",
  "max-[560px]:grid-cols-[minmax(0,1fr)] max-[560px]:gap-1",
].join(" ");

const FACTS = [
  "grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs",
  "[&>div]:contents [&>div>dt]:text-muted",
  "[&>div>dd]:m-0 [&>div>dd]:[overflow-wrap:anywhere] [&>div>dd]:[font-variant-numeric:tabular-nums]",
].join(" ");

/* The verdict word keeps its width; the sentence beside it wraps. */
const FINDING = [
  "flex items-baseline gap-2 border-l-2 border-l-warn pl-2 text-xs text-secondary",
  "[&>:first-child]:flex-none data-[tone=deny]:border-l-deny",
].join(" ");

/**
 * A text of an explanation: declared in the catalogue and said in the viewer's language, or a plain string —
 * a number, an identifier, or a description the server or the screen already wrote.
 */
export type ExplanationText = DeclaredText | string;

/** One value range and what it does — `trap` marks a value that looks harmless and silently stops work. */
export interface ExplanationExtreme {
  when: ExplanationText;
  then: ExplanationText;
  trap?: boolean;
}

/** What a configuration parameter is, written for the person who has to choose its value. */
export interface ParameterExplanationContent {
  title: ExplanationText;
  what: ExplanationText;
  /** Which stage it acts on, which cost it bounds, which result it changes. */
  affects: ExplanationText;
  safeValue: ExplanationText;
  extremes: ExplanationExtreme[];
  example: ExplanationText;
}

/** A judgement on the value as it stands now, together with the values around it. */
export interface ParameterFinding {
  tone: "deny" | "warn";
  text: string;
}

export interface ParameterFact {
  label: string;
  value: string;
}

interface ExplainParameterProperties {
  /** The parameter as the person reads it beside the control; the button is named "About <name>". */
  name: string;
  explanation: ParameterExplanationContent;
  /** The technical identifier — a configuration path or a setting key — shown small for reference. */
  identifier?: string;
  /** What the server declares about it: bounds, unit, when a change takes effect, its own description. */
  facts?: ParameterFact[];
  findings?: ParameterFinding[];
}

const FINDING_WORD: Record<ParameterFinding["tone"], DeclaredText> = {
  deny: declareText("explanations.finding.deny", "Blocks work"),
  warn: declareText("explanations.finding.warn", "Check"),
};

/** Says an explanation's text in the viewer's language; a plain string is shown as it is. */
function useExplanationText(): (text: ExplanationText) => string {
  const { say } = useTranslation();
  return (text) => (typeof text === "string" ? text : say(text));
}

/**
 * An information button beside a parameter's label, opening a dialog that says what the parameter is,
 * what it affects, its safe value, what its extremes do and an example. The native dialog traps focus,
 * closes on Escape and returns focus to this button.
 */
export function ExplainParameter({
  name,
  explanation,
  identifier,
  facts = [],
  findings = [],
}: ExplainParameterProperties) {
  const { t } = useTranslation();
  const explanationText = useExplanationText();
  const [open, setOpen] = useState(false);
  // The dialog is created on first use and then kept, so closing it goes through the native close and
  // focus returns to this button; a page with fifty parameters does not carry fifty idle dialogs.
  const [used, setUsed] = useState(false);
  const worst = findings.some((finding) => finding.tone === "deny")
    ? "deny"
    : findings.length > 0
      ? "warn"
      : undefined;
  const about = t("explanations.dialog.about", "About {name}", { name });

  return (
    <>
      <button
        type="button"
        className={classNames(TRIGGER, TRIGGER_INK[worst ?? "none"])}
        data-finding={worst}
        aria-label={about}
        aria-haspopup="dialog"
        title={about}
        onClick={(event) => {
          // A trigger inside a label must not also toggle or focus the control that label names.
          event.preventDefault();
          event.stopPropagation();
          setUsed(true);
          setOpen(true);
        }}
      >
        <Icon name="information" size="small" />
      </button>
      {/* Portalled to the body: a parameter may sit in a disabled fieldset, which would otherwise disable the
          dialog's own controls, or in a form, which a click inside the dialog must never reach. */}
      {used &&
        createPortal(
          <div
            /* Holds only the native dialog, which renders in the top layer; it takes no room in the page. */
            className="contents"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <Dialog
              open={open}
              onClose={() => {
                setOpen(false);
              }}
              title={explanationText(explanation.title)}
            >
              <ParameterExplanationBody
                explanation={explanation}
                identifier={identifier}
                facts={facts}
                findings={findings}
              />
            </Dialog>
          </div>,
          document.body,
        )}
    </>
  );
}

function ParameterExplanationBody({
  explanation,
  identifier,
  facts,
  findings,
}: {
  explanation: ParameterExplanationContent;
  identifier: string | undefined;
  facts: ParameterFact[];
  findings: ParameterFinding[];
}) {
  const { t } = useTranslation();
  const explanationText = useExplanationText();
  const inThisConfiguration = t("explanations.dialog.inThisConfiguration", "In this configuration");

  return (
    <div className="grid gap-4 text-sm leading-[1.5]">
      {identifier !== undefined && (
        <p className="numeric text-xs text-muted [overflow-wrap:anywhere]">{identifier}</p>
      )}
      {findings.length > 0 && (
        <section className={SECTION} aria-label={inThisConfiguration}>
          <h3 className={HEADING}>{inThisConfiguration}</h3>
          <ParameterFindings findings={findings} />
        </section>
      )}
      <section className={SECTION}>
        <h3 className={HEADING}>{t("explanations.dialog.what", "What it is")}</h3>
        <p>{explanationText(explanation.what)}</p>
      </section>
      <section className={SECTION}>
        <h3 className={HEADING}>{t("explanations.dialog.affects", "What it affects")}</h3>
        <p>{explanationText(explanation.affects)}</p>
      </section>
      <section className={SECTION}>
        <h3 className={HEADING}>{t("explanations.dialog.safeValue", "Safe value")}</h3>
        <p>{explanationText(explanation.safeValue)}</p>
      </section>
      {explanation.extremes.length > 0 && (
        <section className={SECTION}>
          <h3 className={HEADING}>{t("explanations.dialog.extremes", "At the extremes")}</h3>
          <dl className="grid border-t border-line">
            {explanation.extremes.map((extreme, index) => (
              <div key={index} className={EXTREME} data-trap={extreme.trap === true}>
                <dt>
                  {explanationText(extreme.when)}
                  {extreme.trap === true && (
                    <>
                      {" "}
                      <Badge tone="deny">{t("explanations.dialog.trap", "Trap")}</Badge>
                    </>
                  )}
                </dt>
                <dd>{explanationText(extreme.then)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <section className={SECTION}>
        <h3 className={HEADING}>{t("explanations.dialog.example", "Example")}</h3>
        <p>{explanationText(explanation.example)}</p>
      </section>
      {facts.length > 0 && (
        <section className={SECTION}>
          <h3 className={HEADING}>
            {t("explanations.dialog.declaredByServer", "Declared by the server")}
          </h3>
          <dl className={FACTS}>
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}

/** Findings shown in line under a field: red when the value stops work, amber when it deserves a look. */
export function ParameterFindings({ findings, id }: { findings: ParameterFinding[]; id?: string }) {
  const { say } = useTranslation();
  if (findings.length === 0) {
    return null;
  }
  return (
    <ul id={id} className="m-0 grid list-none gap-1 p-0">
      {findings.map((finding) => (
        <li key={finding.text} className={FINDING} data-tone={finding.tone}>
          <Badge tone={finding.tone}>{say(FINDING_WORD[finding.tone])}</Badge>
          <span>{finding.text}</span>
        </li>
      ))}
    </ul>
  );
}
