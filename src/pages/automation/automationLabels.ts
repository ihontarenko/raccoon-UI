import type { CodeLabels } from "../../application/format";
import { declareText } from "../../translations/translate";

// The words automation's codes are shown with, shared by the Automation tabs. The codes mirror the server's
// `automation/ScanRules`, `automation/ScanRuleEvaluator` and `automation/ProcessingPipeline`.

/** How a scan judged a file — a rule's action, a rule set's default, an evaluation's outcome (`ScanRules.Outcome`). */
export const SCAN_OUTCOMES: CodeLabels = {
  INCLUDE: declareText("automation.scanOutcome.include", "Include"),
  SKIP: declareText("automation.scanOutcome.skip", "Skip"),
  REVIEW: declareText("automation.scanOutcome.review", "Review"),
  ERROR: declareText("automation.scanOutcome.error", "Error"),
};

/** The three kinds of scan rule. */
export const RULE_KINDS: CodeLabels = {
  PATTERN: declareText("automation.ruleKind.pattern", "Pattern"),
  CONDITION: declareText("automation.ruleKind.condition", "Condition"),
  SCRIPT: declareText("automation.ruleKind.script", "Script"),
};

/** What one step of a decision's trace came to: a scan outcome, or how a rule or script ran. */
export const TRACE_OUTCOMES: CodeLabels = {
  ...SCAN_OUTCOMES,
  NO_MATCH: declareText("automation.traceOutcome.noMatch", "No match"),
  NOT_RUN: declareText("automation.traceOutcome.notRun", "Not run"),
  PASSED: declareText("automation.traceOutcome.passed", "Passed"),
  EXECUTED: declareText("automation.traceOutcome.executed", "Executed"),
  GUARD_NOT_MATCHED: declareText("automation.traceOutcome.guardNotMatched", "Guard not matched"),
  REFUSED: declareText("automation.traceOutcome.refused", "Refused"),
  KEEP: declareText("automation.traceOutcome.keep", "Keeps"),
  DROP: declareText("automation.traceOutcome.drop", "Drops"),
  REWROTE: declareText("automation.traceOutcome.rewrote", "Rewrote"),
  UNCHANGED: declareText("automation.traceOutcome.unchanged", "Matched, changed nothing"),
  FAILED: declareText("automation.traceOutcome.failed", "Failed"),
};

/** What kind of step a trace line records. */
export const TRACE_STEPS: CodeLabels = {
  RULE_RESULT: declareText("automation.traceStep.ruleResult", "rule result"),
  RULE: declareText("automation.traceStep.rule", "rule"),
  SCRIPT: declareText("automation.traceStep.script", "script"),
  PIPELINE: declareText("automation.traceStep.pipeline", "pipeline"),
};
