import { useState, type FormEvent } from "react";
import { usePermissions } from "../../access/PermissionsProvider";
import { PERMISSIONS } from "../../access/permissions";
import { formatBytes, labelOfCode, shortIdentifier } from "../../application/format";
import { describeProblem, type Problem } from "../../application/problems";
import { usePagedList } from "../../application/usePagedList";
import { useResource } from "../../application/useResource";
import { api, collectAllPages } from "../../lib/api";
import { automationApi, type DryRunResult, type Outcome, type Trace } from "../../lib/automation";
import type { BoundRuleSets } from "../../lib/ruleSets";
import { useTranslation } from "../../translations/TranslationProvider";
import { EmptyState, ListFooter, Notice, ProblemState, Waiting } from "../../ui/components";
import {
  Badge,
  Button,
  Field,
  Input,
  Select,
  Table,
  TextArea,
  type BadgeTone,
} from "../../ui/primitives";
import { SCAN_OUTCOMES, TRACE_OUTCOMES, TRACE_STEPS } from "./automationLabels";
import {
  DRY_RUN,
  DRY_RUN_RESULT,
  EXECUTIONS,
  PANEL,
  SECTION_TITLE,
  STACK,
  TABLE_SURFACE,
  TRACE,
  TRACE_CELL,
} from "./automationClasses";

const OUTCOME_TONE: Record<Outcome, BadgeTone> = {
  INCLUDE: "good",
  SKIP: "neutral",
  REVIEW: "warn",
  ERROR: "error",
};

/** Every file a scan judged, the plan it was judged by, and each rule and script on the way. */
export function EvaluationsTab({ workspaceId }: { workspaceId: string }) {
  const { t, plural } = useTranslation();
  const evaluations = usePagedList(
    (page) => automationApi.evaluations(workspaceId, page),
    [workspaceId],
  );
  const [openedId, setOpenedId] = useState<string | null>(null);

  return (
    <div className={STACK}>
      <DryRunPanel workspaceId={workspaceId} />
      <h2 className={SECTION_TITLE}>{t("automation.evaluations.title", "Decided by scans")}</h2>
      {evaluations.status === "loading" && (
        <Waiting label={t("automation.evaluations.loading", "Loading decisions")} lines={5} />
      )}
      {evaluations.status === "failed" && (
        <ProblemState layout="section" problem={evaluations.problem} />
      )}
      {evaluations.status === "ready" &&
        (evaluations.items.length === 0 ? (
          <EmptyState
            title={t("automation.evaluations.empty", "No decisions yet")}
            description={t(
              "automation.evaluations.emptyDescription",
              "Each file a scan judges is recorded here with the rules and scripts that decided it.",
            )}
          />
        ) : (
          <div className={TABLE_SURFACE}>
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t("automation.evaluations.column.file", "File")}</th>
                  <th scope="col">{t("automation.evaluations.column.outcome", "Outcome")}</th>
                  <th scope="col">{t("automation.evaluations.column.plan", "Plan")}</th>
                  <th scope="col">
                    <span className="sr-only">
                      {t("automation.evaluations.column.trace", "Trace")}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {evaluations.items.map((evaluation) => (
                  <EvaluationRow
                    key={evaluation.id}
                    workspaceId={workspaceId}
                    evaluationId={evaluation.id}
                    path={evaluation.candidate.externalId}
                    detail={`${evaluation.candidate.mediaType} · ${formatBytes(evaluation.candidate.sizeBytes)}`}
                    outcome={evaluation.outcome}
                    plan={plural(
                      "automation.evaluations.planRuleSets",
                      evaluation.snapshot.groups.length,
                      { one: "{ruleSets} · {count} group", other: "{ruleSets} · {count} groups" },
                      { ruleSets: ruleSetsRan(evaluation.snapshot.ruleSets, t) },
                    )}
                    trace={evaluation.trace}
                    opened={openedId === evaluation.id}
                    onToggle={() => setOpenedId(openedId === evaluation.id ? null : evaluation.id)}
                  />
                ))}
              </tbody>
            </Table>
            <ListFooter
              shown={evaluations.items.length}
              counted={plural("automation.evaluations.count", evaluations.items.length, {
                one: "{count} decision",
                other: "{count} decisions",
              })}
              hasMore={evaluations.hasMore}
              loadingMore={evaluations.loadingMore}
              moreProblem={evaluations.moreProblem}
              onLoadMore={evaluations.loadMore}
            />
          </div>
        ))}
    </div>
  );
}

function EvaluationRow({
  workspaceId,
  evaluationId,
  path,
  detail,
  outcome,
  plan,
  trace,
  opened,
  onToggle,
}: {
  workspaceId: string;
  evaluationId: string;
  path: string;
  detail: string;
  outcome: Outcome;
  plan: string;
  trace: Trace[];
  opened: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <tr>
        <td>
          <span className="numeric text-xs">{path}</span>
          <div className="text-xs text-muted">{detail}</div>
        </td>
        <td>
          <Badge tone={OUTCOME_TONE[outcome]}>{labelOfCode(SCAN_OUTCOMES, outcome)}</Badge>
        </td>
        <td className="text-xs text-secondary">{plan}</td>
        <td className="actions">
          <Button variant="quiet" aria-expanded={opened} onClick={onToggle}>
            {opened
              ? t("automation.evaluations.hide", "Hide")
              : t("automation.evaluations.why", "Why")}
          </Button>
        </td>
      </tr>
      {opened && (
        <tr>
          <td colSpan={4} className={TRACE_CELL}>
            <TraceList trace={trace} />
            <Executions workspaceId={workspaceId} evaluationId={evaluationId} />
          </td>
        </tr>
      )}
    </>
  );
}

function TraceList({ trace }: { trace: Trace[] }) {
  return (
    <ol className={TRACE}>
      {trace.map((step, index) => (
        <li key={index}>
          <span className="numeric text-xs text-muted">{labelOfCode(TRACE_STEPS, step.type)}</span>
          <strong>{step.reference ?? "—"}</strong>
          <Badge
            tone={
              /INCLUDE|PASSED|EXECUTED/.test(step.outcome)
                ? "good"
                : /SKIP|REFUSED|ERROR/.test(step.outcome)
                  ? "warn"
                  : "neutral"
            }
          >
            {labelOfCode(TRACE_OUTCOMES, step.outcome)}
          </Badge>
          {step.reason !== null && <span className="text-xs text-secondary">{step.reason}</span>}
        </li>
      ))}
    </ol>
  );
}

function Executions({ workspaceId, evaluationId }: { workspaceId: string; evaluationId: string }) {
  const { t } = useTranslation();
  const executions = useResource(
    () => automationApi.evaluationScripts(workspaceId, evaluationId),
    [workspaceId, evaluationId],
  );
  if (executions.status !== "ready" || executions.data.length === 0) {
    return null;
  }
  return (
    <div className={EXECUTIONS}>
      <span className="eyebrow">
        {t("automation.evaluations.scriptsThatRan", "Scripts that ran")}
      </span>
      {executions.data.map((execution, index) => (
        <div key={index} className="text-xs">
          {t("automation.evaluations.execution", "{stage} · version {version} · {outcome}", {
            stage: <span className="numeric">{execution.stage}</span>,
            version: <span className="numeric">{shortIdentifier(execution.scriptVersionId)}</span>,
            outcome: labelOfCode(TRACE_OUTCOMES, execution.outcome),
          })}
          {execution.reason !== null ? ` — ${execution.reason}` : ""}
        </div>
      ))}
    </div>
  );
}

/** Asks how a source would judge a file that does not exist, without capturing or journaling anything. */
function DryRunPanel({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const mayTry = usePermissions().may(PERMISSIONS.documentWrite);
  const sources = useResource(
    () => collectAllPages((page) => api.listSources(workspaceId, page)),
    [workspaceId],
  );
  const [sourceId, setSourceId] = useState("");
  const [externalId, setExternalId] = useState("docs/guide.md");
  const [mediaType, setMediaType] = useState("text/markdown");
  const [sizeBytes, setSizeBytes] = useState("4096");
  const [text, setText] = useState("");
  const [result, setResult] = useState<DryRunResult | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [running, setRunning] = useState(false);

  if (!mayTry || sources.status !== "ready" || sources.data.length === 0) {
    return null;
  }
  const chosen = sourceId === "" ? (sources.data[0]?.id ?? "") : sourceId;

  const run = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRunning(true);
    setProblem(null);
    try {
      const size = Math.max(1, Math.trunc(Number(sizeBytes)));
      setResult(
        await automationApi.dryRun(workspaceId, chosen, {
          externalId: externalId.trim(),
          title: externalId.trim().split("/").at(-1) ?? externalId.trim(),
          mediaType: mediaType.trim(),
          sizeBytes: size,
          textCharacters: size,
          text: text.trim() === "" ? undefined : text,
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
    <section className={PANEL} aria-labelledby="dry-run">
      <h2 id="dry-run" className={SECTION_TITLE}>
        {t("automation.dryRun.title", "Try a file")}
      </h2>
      <p className="text-xs text-secondary">
        {t(
          "automation.dryRun.lead",
          "How would a source judge this file today? Its rules and scripts run; nothing is captured or recorded.",
        )}
      </p>
      <form className={DRY_RUN} onSubmit={(event) => void run(event)}>
        <Field label={t("automation.dryRun.source", "Source")}>
          <Select value={chosen} fullWidth onChange={(event) => setSourceId(event.target.value)}>
            {sources.data.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("automation.dryRun.path", "Path inside the source")}>
          <Input
            fullWidth
            className="numeric"
            value={externalId}
            onChange={(event) => setExternalId(event.target.value)}
          />
        </Field>
        <Field label={t("automation.dryRun.mediaType", "Media type")}>
          <Input
            fullWidth
            className="numeric"
            value={mediaType}
            onChange={(event) => setMediaType(event.target.value)}
          />
        </Field>
        <Field label={t("automation.dryRun.size", "Size, bytes")}>
          <Input
            fullWidth
            type="number"
            min={1}
            className="numeric"
            value={sizeBytes}
            onChange={(event) => setSizeBytes(event.target.value)}
          />
        </Field>
        <div className="full">
        <Field
          label={t("automation.dryRun.text", "Text of the file")}
          hint={t(
            "automation.dryRun.textHint",
            "Only what a condition over the file's text reads. Leave it empty to try the file as one with no text, such as a PDF.",
          )}
        >
          <TextArea rows={4} value={text} onChange={(event) => setText(event.target.value)} />
        </Field>
        </div>
        <div className="full">
        <Button
          type="submit"
          variant="primary"
          icon="play"
          disabled={running || externalId.trim() === ""}
        >
          {running
            ? t("automation.dryRun.judging", "Judging…")
            : t("automation.dryRun.judge", "Judge it")}
        </Button>
        </div>
      </form>
      {problem !== null && (
        <Notice tone="error" title={problem.title}>
          {problem.detail ?? problem.description}
        </Notice>
      )}
      {result !== null && (
        <div className={DRY_RUN_RESULT}>
          <span>
            {t("automation.dryRun.outcome", "Outcome {outcome} {revision}", {
              outcome: (
                <Badge tone={OUTCOME_TONE[result.outcome]}>
                  {labelOfCode(SCAN_OUTCOMES, result.outcome)}
                </Badge>
              ),
              revision: (
                <span className="text-xs text-muted">
                  {ruleSetsRan(result.snapshot.ruleSets, t)}
                </span>
              ),
            })}
          </span>
          <TraceList trace={result.trace} />
        </div>
      )}
    </section>
  );
}

/** The rule sets a material was judged by, each at the revision it ran — or that none was bound. */
function ruleSetsRan(
  bound: BoundRuleSets | undefined,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const ruleSets = bound?.ruleSets ?? [];
  if (ruleSets.length === 0) {
    return t("automation.evaluations.noRuleSets", "no rule set bound");
  }
  return ruleSets.map((ruleSet) => `${ruleSet.name} r${ruleSet.revision}`).join(", ");
}
