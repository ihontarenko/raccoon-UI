import { useState, type FormEvent } from "react";
import { describeProblem, type Problem } from "../../application/problems";
import { automationApi, type ScriptDryRunOutcome, type ScriptDryRunResult } from "../../lib/automation";
import { RULE_SCRIPT_STAGE } from "../../lib/sourceContracts";
import { useTranslation } from "../../translations/TranslationProvider";
import { Notice } from "../../ui/components";
import { Badge, Button, Field, Input, TextArea, type BadgeTone } from "../../ui/primitives";
import { PANEL } from "./automationClasses";

/* The facts as a form: one field per variable the stage binds, two to a row, so a stage of eight reads in four. */
const FACTS = [
  "grid grid-cols-[repeat(auto-fill,minmax(calc(220px*var(--ui-scale)),1fr))] gap-3",
].join(" ");

const HEAD = "flex flex-wrap items-baseline justify-between gap-2 [&>h2]:m-0 [&>h2]:text-base";

/* The verdict, its explanation, then the log — read top to bottom like the run itself. */
const RESULT = "grid gap-2 rounded-control border border-line bg-well p-3";

const VERDICT = "flex flex-wrap items-center gap-2 text-sm";

const LOG = [
  "m-0 grid list-none gap-1 p-0 font-mono text-xs",
  "[&>li]:grid [&>li]:grid-cols-[auto_minmax(0,1fr)] [&>li]:gap-2",
].join(" ");

const OUTCOME_TONE: Record<ScriptDryRunOutcome, BadgeTone> = {
  NOT_MATCHED: "neutral",
  ALLOWED: "allow",
  REFUSED: "deny",
  TUNES: "warn",
  FAILED: "error",
};

interface ScriptDryRunPanelProperties {
  workspaceId: string;
  scriptId: string;
  stage: string;
  /** The source in the editor — saved or not; the run uses what is on screen. */
  source: string;
  variables: readonly string[];
}

/**
 * Runs the script on screen once against facts written here, and says what it would have done: whether its guard
 * matched, whether it would refuse and why, what it would tune, and what it logged. Nothing is applied — no material is
 * refused, no step is tuned, and the log lines stay out of the workspace's log.
 */
export function ScriptDryRunPanel({ workspaceId, scriptId, stage, source, variables }: ScriptDryRunPanelProperties) {
  const { t } = useTranslation();
  const [facts, setFacts] = useState<Record<string, string>>({});
  const [materialText, setMaterialText] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ScriptDryRunResult | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const readsMaterial = stage === RULE_SCRIPT_STAGE;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setRunning(true);
    setProblem(null);
    try {
      const filled = Object.fromEntries(variables.map((variable) => [variable, facts[variable] ?? ""]));
      setResult(
        await automationApi.dryRunScript(workspaceId, scriptId, {
          source,
          facts: filled,
          materialText: readsMaterial && materialText !== "" ? materialText : null,
        }),
      );
    } catch (error) {
      setResult(null);
      setProblem(describeProblem(error));
    } finally {
      setRunning(false);
    }
  };

  return (
    <form className={PANEL} aria-labelledby="script-dry-run" onSubmit={(event) => void submit(event)}>
      <div className={HEAD}>
        <h2 id="script-dry-run">{t("automation.scriptTrial.title", "Try it")}</h2>
        <span className="text-xs text-muted">
          {t("automation.scriptTrial.lead", "Runs the source on screen once, against the facts below. Nothing is applied.")}
        </span>
      </div>
      {variables.length > 0 && (
        <div className={FACTS}>
          {variables.map((variable) => (
            <Field key={variable} label={<code>{variable}</code>}>
              <Input
                value={facts[variable] ?? ""}
                fullWidth
                onChange={(event) => setFacts((current) => ({ ...current, [variable]: event.target.value }))}
              />
            </Field>
          ))}
        </div>
      )}
      {readsMaterial && (
        <Field
          label={t("automation.scriptTrial.materialText", "The file's text")}
          hint={t("automation.scriptTrial.materialTextHint", "What @material.text() returns. Leave empty for a file with no readable text.")}
        >
          <TextArea rows={4} value={materialText} onChange={(event) => setMaterialText(event.target.value)} />
        </Field>
      )}
      <p className="m-0 text-xs text-muted">
        {t("automation.scriptTrial.typing", "Whole numbers and true or false are passed as such; anything else as text.")}
      </p>
      <div>
        <Button type="submit" icon="play" disabled={running}>
          {running ? t("automation.scriptTrial.running", "Running…") : t("automation.scriptTrial.run", "Run without applying")}
        </Button>
      </div>
      {problem !== null && (
        <Notice tone="error" title={problem.title}>
          {problem.detail ?? problem.description}
        </Notice>
      )}
      {result !== null && <DryRunResult result={result} />}
    </form>
  );
}

function DryRunResult({ result }: { result: ScriptDryRunResult }) {
  const { t } = useTranslation();
  const verdict: Record<ScriptDryRunOutcome, { word: string; meaning: string }> = {
    NOT_MATCHED: {
      word: t("automation.scriptTrial.outcome.notMatched", "Did not match"),
      meaning: t("automation.scriptTrial.meaning.notMatched", "Its guard is false for these facts, so nothing in it ran."),
    },
    ALLOWED: {
      word: t("automation.scriptTrial.outcome.allowed", "Lets it through"),
      meaning: t("automation.scriptTrial.meaning.allowed", "It ran to the end without refusing."),
    },
    REFUSED: {
      word: t("automation.scriptTrial.outcome.refused", "Refuses"),
      meaning: result.decision
        ? t("automation.scriptTrial.meaning.refused", "In a real run the work would stop here, with this reason:")
        : t("automation.scriptTrial.meaning.refusedObservation", "It refuses, but this stage only observes — nothing would stop:"),
    },
    TUNES: {
      word: t("automation.scriptTrial.outcome.tunes", "Tunes a setting"),
      meaning: t("automation.scriptTrial.meaning.tunes", "It reached a call that narrows the step it runs before. A real run applies it; here it stops at that call:"),
    },
    FAILED: {
      word: t("automation.scriptTrial.outcome.failed", "Fails"),
      meaning: t("automation.scriptTrial.meaning.failed", "The script could not finish:"),
    },
  };
  const said = verdict[result.outcome];
  return (
    <section className={RESULT} aria-live="polite" aria-label={t("automation.scriptTrial.result", "What it would do")}>
      <div className={VERDICT}>
        <Badge tone={OUTCOME_TONE[result.outcome]}>{said.word}</Badge>
        <span className="text-secondary">{said.meaning}</span>
      </div>
      {result.message !== null && <p className="m-0 font-mono text-xs">{result.message}</p>}
      {result.log.length === 0 ? (
        <p className="m-0 text-xs text-muted">{t("automation.scriptTrial.noLog", "It wrote nothing to the log.")}</p>
      ) : (
        <ul className={LOG} aria-label={t("automation.scriptTrial.log", "What it logged")}>
          {result.log.map((line, index) => (
            <li key={`${line.at}-${index}`}>
              <Badge tone={line.level === "WARN" ? "warn" : "neutral"}>{line.level}</Badge>
              <span>{line.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
