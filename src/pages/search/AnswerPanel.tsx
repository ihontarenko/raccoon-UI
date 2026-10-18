import { GraphOriginalLink } from "../indexing/GraphOriginalLink";
import { Link } from "@tanstack/react-router";
import { RETRIEVAL_MODES, RETRIEVAL_REASONS } from "../../application/codeLabels";
import { formatNumber, labelOfCode, type CodeLabels } from "../../application/format";
import type { AnswerReason, AnswerResponse } from "../../lib/answers";
import { declareText, type DeclaredText } from "../../translations/translate";
import { useTranslation } from "../../translations/TranslationProvider";
import { Badge, type BadgeTone } from "../../ui/primitives";

const ANSWER = "grid gap-3";

const ANSWER_HEAD = "flex flex-wrap items-baseline gap-3";

const USAGE = "ml-auto [font-variant-numeric:tabular-nums]";

/* The model's own words, marked as such by the accent rule on its leading edge and shown exactly as
   they were written. */
const GENERATED = [
  "rounded-surface border border-line border-l-[3px] border-l-accent bg-surface px-6 py-4",
  "text-base leading-[1.65] whitespace-pre-wrap",
].join(" ");

/* The fragments offered to the model, one line each: the passages themselves are the results below. */
const REFERENCES = "m-0 grid list-none gap-1 p-0";
const REFERENCE = "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs";

const REFERENCE_NUMBER = [
  "grid h-[calc(20px*var(--ui-scale))] min-w-[calc(20px*var(--ui-scale))] place-items-center",
  "rounded-[calc(3px*var(--ui-scale))] border border-line-strong text-2xs text-secondary",
  "data-[cited=true]:border-accent data-[cited=true]:text-accent-text",
  "[font-variant-numeric:tabular-nums]",
].join(" ");

const CITATION = "text-xs text-accent-text no-underline hover:underline";

const HOW_DISCLOSURE = [
  "rounded-surface border border-line bg-well px-4 py-3",
  "[&>summary]:cursor-pointer [&>summary]:font-semibold",
].join(" ");

const HOW_FACTS = [
  "mx-0 mt-3 mb-0 grid grid-cols-2 gap-3",
  "[&>dt]:text-2xs [&>dt]:tracking-[0.06em] [&>dt]:text-muted [&>dt]:uppercase",
  "[&>dd]:mx-0 [&>dd]:mt-[calc(2px*var(--ui-scale))] [&>dd]:mb-0",
  "max-[700px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

const EXCLUSIONS = "mx-0 mt-3 mb-0 pl-4 text-xs";

/** Why an entry was left out of an answer's context: `context/KnowledgeContext.ExclusionReason`. */
const EXCLUSION_REASONS: CodeLabels = {
  NOT_AVAILABLE: declareText("codes.exclusionReason.notAvailable", "Not available"),
  REVISION_CHANGED: declareText("codes.exclusionReason.revisionChanged", "Revision changed"),
  EDITORIAL_DISABLED: declareText("codes.exclusionReason.editorialDisabled", "Editorial disabled"),
  CANDIDATE_BUDGET: declareText("codes.exclusionReason.candidateBudget", "Candidate budget"),
  FRAGMENT_BUDGET: declareText("codes.exclusionReason.fragmentBudget", "Fragment budget"),
  CHARACTER_BUDGET: declareText("codes.exclusionReason.characterBudget", "Character budget"),
  ORIGINAL_UNAVAILABLE: declareText(
    "codes.exclusionReason.originalUnavailable",
    "Original unavailable",
  ),
};

const REASON: Record<
  AnswerReason,
  { label: DeclaredText; tone: BadgeTone; explanation: DeclaredText }
> = {
  GENERATED: {
    label: declareText("ask.reason.generated", "Answered"),
    tone: "good",
    explanation: declareText(
      "ask.reason.generated.explanation",
      "A model wrote the answer from the sources below.",
    ),
  },
  SOURCES_ONLY: {
    label: declareText("ask.reason.sourcesOnly", "Sources only"),
    tone: "neutral",
    explanation: declareText(
      "ask.reason.sourcesOnly.explanation",
      "This profile returns verified sources without asking a model.",
    ),
  },
  NO_MATCHES: {
    label: declareText("ask.reason.noMatches", "Nothing found"),
    tone: "warn",
    explanation: declareText(
      "ask.reason.noMatches.explanation",
      "Search found nothing. A search profile in the plain query mode needs every word; any-terms or web-search mode suits a question better.",
    ),
  },
  NO_CONTEXT: {
    label: declareText("ask.reason.noContext", "No usable context"),
    tone: "warn",
    explanation: declareText(
      "ask.reason.noContext.explanation",
      "Hits were found, but none survived verification into context.",
    ),
  },
  CHAT_UNAVAILABLE: {
    label: declareText("ask.reason.chatUnavailable", "Model unavailable"),
    tone: "error",
    explanation: declareText(
      "ask.reason.chatUnavailable.explanation",
      "The model could not be called; the sources are still shown.",
    ),
  },
  CALLS_DISABLED: {
    label: declareText("ask.reason.callsDisabled", "Model calls off"),
    tone: "deny",
    explanation: declareText(
      "ask.reason.callsDisabled.explanation",
      "Model calls are switched off; the sources are shown instead.",
    ),
  },
};

/** For each search entry the answer drew on: its reference number in the answer, and whether the answer cited it. */
export type AnswerReferences = Map<string, { number: number; cited: boolean }>;

export function referencesOf(answer: AnswerResponse): AnswerReferences {
  const references: AnswerReferences = new Map();
  answer.sources.forEach((source, index) => {
    const cited = answer.generated?.citedSourceIds.includes(source.id) ?? false;
    for (const entry of source.fragment?.entries ?? []) {
      references.set(entry.entryId, { number: index + 1, cited });
    }
  });
  return references;
}

/**
 * An answer, above the search results it rests on: why it is what it is, the model's text, the numbered fragments
 * it was given — cited ones marked — and how it was found. The passages themselves are the result list beneath,
 * where each carries the same number.
 */
export function AnswerPanel({ answer }: { answer: AnswerResponse }) {
  const { t, say, plural } = useTranslation();
  const reason = REASON[answer.reason];
  const usage =
    answer.usage.calls === 0
      ? t("ask.noModelCall", "No model call")
      : answer.usage.unknown
        ? t("ask.usageUnreported", "{input} in · {output} out · usage not reported", {
            input: formatNumber(answer.usage.inputTokens ?? 0),
            output: formatNumber(answer.usage.outputTokens ?? 0),
          })
        : t("ask.usage", "{input} in · {output} out", {
            input: formatNumber(answer.usage.inputTokens ?? 0),
            output: formatNumber(answer.usage.outputTokens ?? 0),
          });
  return (
    <section className={ANSWER} aria-label={t("ask.answer", "Answer")}>
      <header className={ANSWER_HEAD}>
        <Badge tone={reason.tone}>{say(reason.label)}</Badge>
        <span className="text-xs text-secondary">{say(reason.explanation)}</span>
        <span className={`text-xs text-muted ${USAGE}`}>{usage}</span>
      </header>
      {answer.generated !== null && <div className={GENERATED}>{answer.generated.text}</div>}

      {answer.sources.length > 0 && (
        <ol className={REFERENCES} aria-label={t("ask.sources", "Sources")}>
          {answer.sources.map((source, index) => {
            const citation = source.fragment?.citations[0];
            const graphEvidence = source.graphFragment?.root.evidence;
            const cited = answer.generated?.citedSourceIds.includes(source.id) ?? false;
            return (
              <li key={source.id} className={REFERENCE}>
                <span className={REFERENCE_NUMBER} data-cited={cited}>
                  {index + 1}
                </span>
                <strong className="font-semibold">
                  {source.fragment?.title ?? source.graphFragment?.root.qualifiedName}
                </strong>
                {cited && <Badge tone="good">{t("ask.cited", "Cited")}</Badge>}
                {source.fragment !== null && source.fragment.origin !== "DERIVED" && (
                  <Badge tone="active">{source.fragment.origin.toLowerCase()}</Badge>
                )}
                {source.graphFragment != null && (
                  <Badge tone="active">
                    {t("graph.semanticEvidence", "Semantic graph evidence")}
                  </Badge>
                )}
                {graphEvidence !== undefined && <GraphOriginalLink evidence={graphEvidence} />}
                {citation !== undefined && (
                  <Link
                    to="/documents/$documentId"
                    params={{ documentId: citation.documentId }}
                    search={{
                      version: citation.versionId,
                      lines: `${citation.startLine}-${citation.endLine}`,
                    }}
                    className={CITATION}
                  >
                    {t("ask.citationShort", "lines {start}–{end}", {
                      start: citation.startLine,
                      end: citation.endLine,
                    })}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <details className={HOW_DISCLOSURE}>
        <summary>{t("ask.howFound", "How this was found")}</summary>
        <dl className={HOW_FACTS}>
          {answer.search !== null && (
            <>
              <div>
                <dt>{t("ask.search", "Search")}</dt>
                <dd>
                  {t(
                    "ask.searchSummary",
                    "{mode} · {hits} · {keyword} keyword and {vector} vector candidates",
                    {
                      mode: labelOfCode(RETRIEVAL_MODES, answer.search.retrieval.effectiveMode),
                      hits: plural("ask.hitCount", answer.search.hits.length, {
                        one: "{count} hit",
                        other: "{count} hits",
                      }),
                      keyword: formatNumber(answer.search.retrieval.lexicalCandidates),
                      vector: formatNumber(answer.search.retrieval.semanticCandidates),
                    },
                  )}
                </dd>
              </div>
              <div>
                <dt>{t("ask.whyThatMode", "Why that mode")}</dt>
                <dd>{labelOfCode(RETRIEVAL_REASONS, answer.search.retrieval.reason)}</dd>
              </div>
            </>
          )}
          {answer.context !== null && (
            <div>
              <dt>{t("ask.context", "Context")}</dt>
              <dd>
                {plural("ask.fragmentCount", answer.context.fragments.length, {
                  one: "{count} fragment",
                  other: "{count} fragments",
                })}{" "}
                ·{" "}
                {plural("ask.characterCount", answer.context.returnedCodePoints, {
                  one: "{count} character",
                  other: "{count} characters",
                })}
                {answer.context.exclusions.length > 0 &&
                  t("ask.leftOutCount", " · {count} left out", {
                    count: formatNumber(answer.context.exclusions.length),
                  })}
              </dd>
            </div>
          )}
          <div>
            <dt>{t("ask.profile", "Profile")}</dt>
            <dd>
              {t("ask.revision", "revision {revision}", { revision: answer.profileRevision })}
            </dd>
          </div>
          <div>
            <dt>{t("ask.answer", "Answer")}</dt>
            <dd className="numeric text-xs">{answer.answerId}</dd>
          </div>
        </dl>
        {answer.context !== null && answer.context.exclusions.length > 0 && (
          <ul className={EXCLUSIONS}>
            {answer.context.exclusions.map((exclusion) => (
              <li key={exclusion.entryId}>
                {t("ask.exclusion", "{entry} left out: {reason}", {
                  entry: <span className="numeric text-xs">{exclusion.entryId.slice(0, 8)}</span>,
                  reason: labelOfCode(EXCLUSION_REASONS, exclusion.reason).toLowerCase(),
                })}
              </li>
            ))}
          </ul>
        )}
      </details>
    </section>
  );
}
