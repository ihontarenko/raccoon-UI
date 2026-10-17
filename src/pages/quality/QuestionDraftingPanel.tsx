import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { formatNumber } from "../../application/format";
import { describeProblem, fieldRefusal, type Problem } from "../../application/problems";
import {
  evaluationApi,
  type DraftEstimate,
  type DraftingModel,
  type DraftLanguage,
  type QuestionDraft,
} from "../../lib/evaluation";
import { useTranslation } from "../../translations/TranslationProvider";
import { DocumentPicker, Notice, Segmented, type PickedDocument } from "../../ui/components";
import { Button, Checkbox, Field, Input, Select, TextArea } from "../../ui/primitives";
import { DRAFTING, DRAFTING_ACTION, DRAFTING_FORM, DRAFTING_SETTINGS, DRAFTS, DRAFT_BODY, DRAFT_ITEM, DRAFT_LIST, EXCERPT, FIELD_ERROR, NARROW_INPUT, SEGMENT_FIELD, SEGMENT_LABEL, SUBSECTION_TITLE, TOOLBAR } from "./qualityClasses";

const DEFAULT_COUNT = 5;
const MAXIMUM_COUNT = 20;
const MAXIMUM_DOCUMENTS = 5;
const ESTIMATE_DELAY_MILLISECONDS = 400;

/** A draft as the person reviews it: kept or not, and its wording as they edited it. */
interface ReviewedDraft {
  draft: QuestionDraft;
  text: string;
  kept: boolean;
}

interface QuestionDraftingPanelProperties {
  workspaceId: string;
  sources: { id: string; name: string }[];
  /** How many more questions the suite can take. */
  room: number;
  /** Adds the accepted drafts to the suite being edited; nothing is saved until the suite is. */
  onAccept: (accepted: { text: string; draft: QuestionDraft }[]) => void;
  onClose: () => void;
}

/**
 * Asks the chat model in force to propose questions a chosen document answers. The proposals come back as
 * drafts the person keeps, edits or drops one by one; only the kept ones join the suite, and only saving the
 * suite stores them. The predicted cost is shown before the single model call is made.
 */
export function QuestionDraftingPanel({ workspaceId, sources, room, onAccept, onClose }: QuestionDraftingPanelProperties) {
  const { t, plural, language } = useTranslation();
  const [models, setModels] = useState<DraftingModel[] | null>(null);
  const [modelsProblem, setModelsProblem] = useState<Problem | null>(null);
  const [answerProfileId, setAnswerProfileId] = useState("");
  const [documents, setDocuments] = useState<PickedDocument[]>([]);
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [draftLanguage, setDraftLanguage] = useState<DraftLanguage>(language === "uk" ? "UK" : "EN");
  const [estimate, setEstimate] = useState<DraftEstimate | null>(null);
  const [estimateRefusal, setEstimateRefusal] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [reviewed, setReviewed] = useState<ReviewedDraft[]>([]);
  const [spent, setSpent] = useState<{ input: number | null; output: number | null; discarded: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    evaluationApi
      .draftingModels(workspaceId)
      .then((available) => {
        if (!cancelled) {
          setModels(available);
          setAnswerProfileId(available[0]?.answerProfileId ?? "");
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setModelsProblem(describeProblem(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const countValid = Number.isInteger(count) && count >= 1 && count <= Math.min(MAXIMUM_COUNT, room);
  const ready = answerProfileId !== "" && documents.length > 0 && countValid;

  // The prediction follows every change of what would be sent, so the cost is known before the call.
  useEffect(() => {
    if (!ready) {
      setEstimate(null);
      setEstimateRefusal(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      evaluationApi
        .estimateDrafts(workspaceId, { answerProfileId, documentIds: documents.map((document) => document.id), count, language: draftLanguage })
        .then((predicted) => {
          if (!cancelled) {
            setEstimate(predicted);
            setEstimateRefusal(null);
          }
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setEstimate(null);
            const refusal = fieldRefusal(error);
            setEstimateRefusal(refusal?.sentence ?? describeProblem(error).detail ?? describeProblem(error).title);
          }
        });
    }, ESTIMATE_DELAY_MILLISECONDS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [workspaceId, answerProfileId, documents, count, draftLanguage, ready]);

  const draft = async () => {
    setDrafting(true);
    setProblem(null);
    try {
      const result = await evaluationApi.draftQuestions(workspaceId, {
        answerProfileId,
        documentIds: documents.map((document) => document.id),
        count,
        language: draftLanguage,
      });
      setReviewed(result.drafts.map((proposed) => ({ draft: proposed, text: proposed.text, kept: true })));
      setSpent({ input: result.inputTokens, output: result.outputTokens, discarded: result.discarded });
    } catch (error) {
      setProblem(describeProblem(error));
    } finally {
      setDrafting(false);
    }
  };

  const kept = reviewed.filter((item) => item.kept && item.text.trim() !== "");
  const accept = () => {
    onAccept(kept.slice(0, room).map((item) => ({ text: item.text.trim(), draft: item.draft })));
    setReviewed([]);
    setSpent(null);
  };

  const unavailable = models !== null && models.length === 0;

  return (
    <section className={DRAFTING} aria-labelledby="draft-questions-title">
      <div className={TOOLBAR}>
        <h3 id="draft-questions-title" className={SUBSECTION_TITLE}>
          {t("quality.drafting.title", "Draft questions from documents")}
        </h3>
        <Button variant="quiet" icon="close" onClick={onClose}>
          {t("quality.drafting.close", "Close")}
        </Button>
      </div>
      <p className="text-xs text-secondary">
        {t(
          "quality.drafting.lead",
          "The chat model reads the chosen documents and proposes questions they answer. You review each one; nothing joins the suite until you add it, and nothing is stored until you save the suite.",
        )}
      </p>
      {modelsProblem !== null && (
        <Notice tone="error" title={modelsProblem.title}>
          {modelsProblem.detail ?? modelsProblem.description}
        </Notice>
      )}
      {unavailable && (
        <Notice tone="warn" title={t("quality.drafting.unavailable", "No chat model is in force")}>
          {t(
            "quality.drafting.unavailableDescription",
            "Drafting uses the chat model of an enabled answer profile, and no answer profile has one that is active. Configure a chat provider in {providers}, then bind it to an answer profile.",
            {
              providers: (
                <Link to="/administration/$section" params={{ section: "providers" }}>
                  {t("navigation.section.providers.label", "AI providers")}
                </Link>
              ),
            },
          )}
        </Notice>
      )}
      <fieldset className={DRAFTING_FORM} disabled={unavailable || models === null || drafting}>
        <DocumentPicker
          workspaceId={workspaceId}
          label={t("quality.drafting.documents", "Documents")}
          chosen={documents}
          maximum={MAXIMUM_DOCUMENTS}
          sources={sources}
          stage="SEARCHABLE"
          hint={t("quality.drafting.documentsHint", "Up to 5 searchable documents. Each proposed question expects the document it came from.")}
          onPick={(document) => setDocuments((current) => [...current, document])}
          onRemove={(documentId) => setDocuments((current) => current.filter((document) => document.id !== documentId))}
          disabled={unavailable || models === null || drafting}
        />
        <div className={DRAFTING_SETTINGS}>
          <Field
            label={t("quality.drafting.count", "Questions")}
            error={countValid ? undefined : t("quality.drafting.countInvalid", "From 1 to {maximum}.", { maximum: Math.min(MAXIMUM_COUNT, room) })}
          >
            <Input
              type="number"
              className={`numeric ${NARROW_INPUT}`}
              min={1}
              max={Math.min(MAXIMUM_COUNT, room)}
              value={String(count)}
              onChange={(event) => setCount(Math.trunc(Number(event.target.value)))}
            />
          </Field>
          <div className={SEGMENT_FIELD}>
            <span className={SEGMENT_LABEL}>{t("quality.drafting.language", "Language of the questions")}</span>
            <Segmented<DraftLanguage>
              label={t("quality.drafting.language", "Language of the questions")}
              value={draftLanguage}
              onChange={setDraftLanguage}
              options={[
                { value: "UK", label: t("quality.drafting.ukrainian", "Ukrainian") },
                { value: "EN", label: t("quality.drafting.english", "English") },
              ]}
            />
          </div>
          {models !== null && models.length > 1 && (
            <Field label={t("quality.drafting.model", "Chat model")}>
              <Select value={answerProfileId} onChange={(event) => setAnswerProfileId(event.target.value)}>
                {models.map((model) => (
                  <option key={model.answerProfileId} value={model.answerProfileId}>
                    {model.model} · {model.answerProfileName}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        <div className={DRAFTING_ACTION}>
          <Button variant="primary" icon="prompt" disabled={!ready || estimate === null || drafting} onClick={() => void draft()}>
            {drafting
              ? t("quality.drafting.drafting", "Drafting…")
              : plural("quality.drafting.draft", count, { one: "Draft {count} question", other: "Draft {count} questions" })}
          </Button>
          <span className="text-xs text-secondary" aria-live="polite">
            {models !== null && models.length === 1 && (
              <>
                {t("quality.drafting.modelInForce", "{model} · answer profile {profile}", {
                  model: models[0].model,
                  profile: models[0].answerProfileName,
                })}
                {" · "}
              </>
            )}
            {estimate !== null &&
              t(
                "quality.drafting.estimate",
                "about {input} tokens in, up to {output} out — one call, journalled with the answer calls · {included} of {available} passages shown",
                {
                  input: formatNumber(estimate.estimatedInputTokens),
                  output: formatNumber(Math.min(estimate.maximumOutputTokens, estimate.estimatedOutputTokens)),
                  included: estimate.includedChunks,
                  available: estimate.availableChunks,
                },
              )}
            {estimate === null && estimateRefusal === null && ready && t("quality.drafting.estimating", "Predicting the cost…")}
          </span>
        </div>
        {estimateRefusal !== null && <p className={FIELD_ERROR}>{estimateRefusal}</p>}
      </fieldset>
      {problem !== null && (
        <Notice tone="error" title={problem.title}>
          {problem.detail ?? problem.description}
        </Notice>
      )}
      {spent !== null && (
        <div className={DRAFTS}>
          <p className="text-xs text-secondary">
            {t("quality.drafting.spent", "Used {input} tokens in and {output} out.", {
              input: spent.input === null ? "—" : formatNumber(spent.input),
              output: spent.output === null ? "—" : formatNumber(spent.output),
            })}
            {spent.discarded > 0 &&
              ` ${plural("quality.drafting.discarded", spent.discarded, {
                one: "{count} malformed proposal was dropped.",
                other: "{count} malformed proposals were dropped.",
              })}`}
          </p>
          {reviewed.length === 0 ? (
            <p className="text-xs text-muted">{t("quality.drafting.none", "The model proposed no usable question. Try other documents.")}</p>
          ) : (
            <ol className={DRAFT_LIST}>
              {reviewed.map((item, index) => (
                <li key={index} className={DRAFT_ITEM} data-kept={item.kept}>
                  <Checkbox
                    label={<span className="sr-only">{t("quality.drafting.keep", "Keep question {number}", { number: index + 1 })}</span>}
                    checked={item.kept}
                    onChange={(event) =>
                      setReviewed((current) => current.map((entry, position) => (position === index ? { ...entry, kept: event.target.checked } : entry)))
                    }
                  />
                  <div className={DRAFT_BODY}>
                    <TextArea
                      rows={2}
                      aria-label={t("quality.drafting.questionText", "Question {number}", { number: index + 1 })}
                      value={item.text}
                      onChange={(event) =>
                        setReviewed((current) => current.map((entry, position) => (position === index ? { ...entry, text: event.target.value } : entry)))
                      }
                    />
                    <p className="text-xs text-secondary">
                      {t("quality.drafting.expects", "Expects {document}", { document: <strong>{item.draft.documentTitle}</strong> })}
                      {item.draft.startPage !== null &&
                        ` · ${t("quality.drafting.pages", "pages {from}–{to}", { from: item.draft.startPage, to: item.draft.endPage ?? item.draft.startPage })}`}
                      {item.draft.startLine !== null &&
                        ` · ${t("quality.drafting.lines", "lines {from}–{to}", { from: item.draft.startLine, to: item.draft.endLine ?? item.draft.startLine })}`}
                    </p>
                    {item.draft.excerpt !== null && <blockquote className={EXCERPT}>{item.draft.excerpt}</blockquote>}
                  </div>
                </li>
              ))}
            </ol>
          )}
          <div className={DRAFTING_ACTION}>
            <Button variant="primary" icon="plus" disabled={kept.length === 0 || room === 0} onClick={accept}>
              {plural("quality.drafting.add", Math.min(kept.length, room), { one: "Add {count} question", other: "Add {count} questions" })}
            </Button>
            <Button
              variant="quiet"
              onClick={() => {
                setReviewed([]);
                setSpent(null);
              }}
            >
              {t("quality.drafting.discardAll", "Discard all")}
            </Button>
            {kept.length > room && (
              <span className="text-xs text-secondary">{t("quality.drafting.room", "The suite has room for {count} more.", { count: room })}</span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
