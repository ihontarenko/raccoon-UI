import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { usePermissions } from "../../access/PermissionsProvider";
import { PERMISSIONS } from "../../access/permissions";
import { RETRIEVAL_MODES } from "../../application/codeLabels";
import { labelOfCode } from "../../application/format";
import { explainParameter } from "../../application/parameterExplanations";
import { describeProblem, fieldRefusal, type Problem } from "../../application/problems";
import { useReadySession } from "../../application/session";
import { usePageTitle } from "../../application/usePageTitle";
import { useResource } from "../../application/useResource";
import { api, collectAllPages } from "../../lib/api";
import type { RetrievalMode, SourceView } from "../../lib/contracts";
import { documentCatalogueApi } from "../../lib/documentCatalogue";
import { evaluationApi, type EvaluationQuestion, type EvaluationSelection, type Suite, type SuiteConfiguration } from "../../lib/evaluation";
import { profilesApi, type Profile } from "../../lib/profiles";
import { useTranslation, type Translation } from "../../translations/TranslationProvider";
import { ChipInput, DocumentPicker, ExplainParameter, Notice, PageHeader, ProblemState, Waiting, pickedOf, useToaster, type PickedDocument } from "../../ui/components";
import { Badge, Button, Checkbox, Field, Input, Select, TextArea } from "../../ui/primitives";
import { METRIC_LABELS } from "./metrics";
import { QuestionDraftingPanel } from "./QuestionDraftingPanel";
import { COMPARISON, COMPARISONS, CRUMB, EDITOR, ENABLED_CELL, FIELD_ERROR, GROUPS, MISSING, NUMBER_GRID, PANEL, QUESTION, QUESTIONS, QUESTION_HEAD, QUESTION_ID, QUESTION_NUMBER, SAVE_BAR, SECTION_TITLE, SETTINGS_ROW, TOOLBAR, TOOLBAR_ACTIONS, UNIT, UNIT_INPUT } from "./qualityClasses";

const NEW_SUITE = "new";
const MODES: RetrievalMode[] = ["LEXICAL", "SEMANTIC", "HYBRID", "AUTO"];
const MAXIMUM_QUESTIONS = 100;
const MAXIMUM_SELECTIONS = 10;
const IDENTIFIER_SHAPE = /^[a-z0-9][a-z0-9_-]{0,79}$/;
/** How many documents one catalogue query resolves by identifier. */
const RESOLVE_BATCH = 40;

interface Loaded {
  suite: Suite | null;
  sources: SourceView[];
  searchProfiles: Profile[];
  readProfiles: Profile[];
  /** The documents the suite already expects, by identifier, so each is shown by its title and path. */
  expected: Map<string, PickedDocument>;
}

/** A refusal per configuration path — `name`, `cutoff`, `questions[2].text` — in the viewer's language. */
type FieldErrors = Record<string, string>;

function startingConfiguration(loaded: Loaded): SuiteConfiguration {
  return {
    questions: [],
    selections: loaded.searchProfiles.slice(0, 1).map((profile) => ({ profileId: profile.id, mode: "LEXICAL" as RetrievalMode })),
    sourceId: null,
    readProfileId: loaded.readProfiles[0]?.id ?? "",
    cutoff: 10,
    maximumSearches: 100,
    maximumEmbeddingCalls: 0,
    maximumEmbeddingTokens: 0,
    maximumDurationMilliseconds: 60000,
    thresholds: { hitRate: 0.8, recall: 0.6, meanReciprocalRank: 0.5, maximumUnexpectedResponseRate: 0.2 },
    scriptGroupIds: [],
    enabled: true,
  };
}

/** The documents a suite expects, resolved through the catalogue a few dozen at a time. */
async function resolveExpected(workspaceId: string, suite: Suite | null): Promise<Map<string, PickedDocument>> {
  const resolved = new Map<string, PickedDocument>();
  if (suite === null) {
    return resolved;
  }
  const identifiers = [...new Set(suite.configuration.questions.flatMap((question) => question.relevant.map((target) => target.documentId)))];
  for (let start = 0; start < identifiers.length; start += RESOLVE_BATCH) {
    const batch = identifiers.slice(start, start + RESOLVE_BATCH);
    const query = `document.id in [${batch.map((identifier) => `'${identifier}'`).join(", ")}]`;
    const page = await documentCatalogueApi.page(workspaceId, { query }, "TITLE", { limit: RESOLVE_BATCH, offset: 0 });
    page.items.forEach((document) => resolved.set(document.id, pickedOf(document)));
  }
  return resolved;
}

/** Every rule the server enforces on a suite, checked before sending so each refusal lands on its field. */
function validateSuite(name: string, configuration: SuiteConfiguration, t: Translation["t"]): FieldErrors {
  const errors: FieldErrors = {};
  const between = (minimum: number, maximum: number) => t("quality.validation.between", "From {minimum} to {maximum}.", { minimum, maximum });
  if (name.trim() === "") {
    errors.name = t("quality.validation.name", "Name the suite; runs are listed under it.");
  }
  if (configuration.questions.length === 0) {
    errors.questions = t("quality.validation.noQuestions", "Add at least one question.");
  }
  const identifiers = new Set<string>();
  configuration.questions.forEach((question, position) => {
    const path = `questions[${position}]`;
    if (!IDENTIFIER_SHAPE.test(question.id)) {
      errors[`${path}.id`] = t("quality.validation.identifier", "Lowercase letters, digits, hyphens; up to 80.");
    } else if (identifiers.has(question.id)) {
      errors[`${path}.id`] = t("quality.validation.identifierTaken", "Another question has this identifier.");
    }
    identifiers.add(question.id);
    if (question.text.trim() === "") {
      errors[`${path}.text`] = t("quality.validation.questionText", "Write the question.");
    } else if (question.text.length > 4096) {
      errors[`${path}.text`] = t("quality.validation.questionLength", "At most 4096 characters.");
    }
    if (question.expectation === "RELEVANT" && question.relevant.length === 0) {
      errors[`${path}.relevant`] = t("quality.validation.expected", "Add the document this question should find.");
    }
  });
  if (configuration.selections.length === 0) {
    errors.selections = t("quality.validation.selections", "Compare at least one search profile.");
  } else if (new Set(configuration.selections.map((selection) => `${selection.profileId}:${selection.mode}`)).size !== configuration.selections.length) {
    errors.selections = t("quality.validation.selectionsTwice", "The same profile and mode are compared twice.");
  } else if (configuration.selections.some((selection) => selection.profileId === "")) {
    errors.selections = t("quality.validation.selectionProfile", "Choose a search profile for each comparison.");
  }
  if (configuration.readProfileId === "") {
    errors.readProfileId = t("quality.validation.readProfile", "Choose the read profile that verifies citations.");
  }
  const integerIn = (key: keyof SuiteConfiguration, minimum: number, maximum: number) => {
    const value = configuration[key] as number;
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      errors[key] = between(minimum, maximum);
    }
  };
  integerIn("cutoff", 1, 100);
  integerIn("maximumSearches", 1, 1000);
  integerIn("maximumEmbeddingCalls", 0, 1000);
  integerIn("maximumEmbeddingTokens", 0, 1000000);
  integerIn("maximumDurationMilliseconds", 10, 600000);
  for (const [key, value] of Object.entries(configuration.thresholds)) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      errors[`thresholds.${key}`] = between(0, 100);
    }
  }
  return errors;
}

/** Writes an evaluation suite at `/quality/suites/$suiteId`, or a new one at `.../new`. */
export function SuiteEditorPage() {
  const { t } = useTranslation();
  const { suiteId } = useParams({ strict: false }) as { suiteId: string };
  const { workspace } = useReadySession();
  const workspaceId = workspace?.id ?? "";
  const loaded = useResource<Loaded>(async () => {
    const [suite, sources, searchProfiles, readProfiles] = await Promise.all([
      suiteId === NEW_SUITE ? Promise.resolve(null) : evaluationApi.suite(workspaceId, suiteId),
      collectAllPages((page) => api.listSources(workspaceId, page)),
      collectAllPages((page) => profilesApi.list(workspaceId, "search", page)),
      collectAllPages((page) => profilesApi.list(workspaceId, "read", page)),
    ]);
    const expected = await resolveExpected(workspaceId, suite);
    return { suite, sources, searchProfiles, readProfiles, expected };
  }, [workspaceId, suiteId]);

  if (loaded.status === "loading") {
    return <Waiting label={t("quality.editor.loading", "Loading the suite")} lines={8} />;
  }
  if (loaded.status === "failed") {
    return (
      <ProblemState
        problem={loaded.problem}
        actions={
          <Button href="/quality" variant="quiet">
            {t("quality.editor.allSuites", "All suites")}
          </Button>
        }
      />
    );
  }
  return <SuiteEditor key={`${suiteId}:${loaded.data.suite?.revision ?? 0}`} workspaceId={workspaceId} loaded={loaded.data} onSaved={loaded.reload} />;
}

/** A number field with its unit beside the value, so the label stays one short line. */
function UnitInput({
  unit,
  value,
  onValue,
  minimum,
  maximum,
  id,
  invalid,
  "aria-describedby": describedBy,
}: {
  unit?: string;
  value: number;
  onValue: (value: number) => void;
  minimum: number;
  maximum: number;
  id?: string;
  invalid?: boolean;
  "aria-describedby"?: string;
}) {
  return (
    <span className={UNIT_INPUT}>
      <Input
        id={id}
        invalid={invalid}
        aria-describedby={describedBy}
        type="number"
        className="numeric"
        min={minimum}
        max={maximum}
        value={Number.isFinite(value) ? String(value) : ""}
        onChange={(event) => onValue(event.target.value === "" ? Number.NaN : Number(event.target.value))}
      />
      {unit !== undefined && (
        <span className={UNIT} aria-hidden="true">
          {unit}
        </span>
      )}
    </span>
  );
}

function SuiteEditor({ workspaceId, loaded, onSaved }: { workspaceId: string; loaded: Loaded; onSaved: () => void }) {
  const { t, say } = useTranslation();
  const { suite, sources, searchProfiles, readProfiles } = loaded;
  const navigate = useNavigate();
  const { notify } = useToaster();
  const mayManage = usePermissions().may(PERMISSIONS.automationManage);
  const [name, setName] = useState(suite?.name ?? "");
  const [configuration, setConfiguration] = useState<SuiteConfiguration>(suite?.configuration ?? startingConfiguration(loaded));
  const [known, setKnown] = useState<Map<string, PickedDocument>>(loaded.expected);
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<Problem | null>(null);
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const newSuiteTitle = t("quality.newSuite", "New suite");
  usePageTitle(suite === null ? newSuiteTitle : suite.name);

  const clientErrors = validateSuite(name, configuration, t);
  // Field errors show once a save was tried; the save bar names what is missing from the start.
  const errors: FieldErrors = attempted ? { ...serverErrors, ...clientErrors } : serverErrors;
  const blocking = Object.keys(clientErrors).length > 0;

  const update = (patch: Partial<SuiteConfiguration>) => {
    setConfiguration((current) => ({ ...current, ...patch }));
    setServerErrors({});
  };
  const setQuestion = (index: number, patch: Partial<EvaluationQuestion>) =>
    update({ questions: configuration.questions.map((question, position) => (position === index ? { ...question, ...patch } : question)) });
  const setSelection = (index: number, patch: Partial<EvaluationSelection>) =>
    update({ selections: configuration.selections.map((selection, position) => (position === index ? { ...selection, ...patch } : selection)) });

  const freeIdentifier = (taken: Set<string>) => {
    let number = configuration.questions.length + 1;
    while (taken.has(`question-${number}`)) {
      number += 1;
    }
    taken.add(`question-${number}`);
    return `question-${number}`;
  };

  const addQuestion = () => {
    const taken = new Set(configuration.questions.map((question) => question.id));
    update({ questions: [...configuration.questions, { id: freeIdentifier(taken), text: "", tags: [], expectation: "RELEVANT", relevant: [] }] });
  };

  const pickedFor = (documentId: string): PickedDocument =>
    known.get(documentId) ?? { id: documentId, title: documentId.slice(0, 8), externalId: "", sourceName: "", latestVersionId: "" };

  const remember = (document: PickedDocument) => setKnown((current) => new Map(current).set(document.id, document));

  /** The person's first problem in reading order, for the save bar. */
  const firstMissing = (): string | null => {
    const order = ["name", "readProfileId", "cutoff", "questions"];
    for (const key of order) {
      if (clientErrors[key] !== undefined) {
        return clientErrors[key];
      }
    }
    const first = Object.keys(clientErrors)[0];
    if (first === undefined) {
      return null;
    }
    const questionMatch = /^questions\[(\d+)\]/.exec(first);
    if (questionMatch !== null) {
      return t("quality.validation.questionNumber", "Question {number}: {problem}", {
        number: Number(questionMatch[1]) + 1,
        problem: clientErrors[first],
      });
    }
    return clientErrors[first];
  };

  const save = async () => {
    setAttempted(true);
    if (blocking) {
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      const saved = suite === null ? await evaluationApi.createSuite(workspaceId, name.trim(), configuration) : await evaluationApi.saveSuite(workspaceId, suite, name.trim(), configuration);
      notify({
        tone: "good",
        title: t("quality.editor.saved", "{name} saved", { name: saved.name }),
        description: t("quality.editor.revision", "Revision {revision}", { revision: saved.revision }),
      });
      if (suite === null) {
        void navigate({ to: "/quality/suites/$suiteId", params: { suiteId: saved.id }, replace: true });
      } else {
        onSaved();
      }
    } catch (error) {
      const refusal = fieldRefusal(error);
      if (refusal !== null) {
        setServerErrors({ [refusal.field]: refusal.sentence });
      } else {
        setProblem(describeProblem(error));
      }
      setSaving(false);
    }
  };

  const explain = (path: string, title: string) => (
    <ExplainParameter name={title} identifier={path} explanation={explainParameter("evaluation", path, { title })} />
  );

  const percentField = (key: keyof SuiteConfiguration["thresholds"], label: string) => (
    <Field label={label} labelAside={explain(`thresholds.${key}`, label)} error={errors[`thresholds.${key}`]}>
      <UnitInput
        unit="%"
        minimum={0}
        maximum={100}
        value={Math.round(configuration.thresholds[key] * 100)}
        onValue={(value) => update({ thresholds: { ...configuration.thresholds, [key]: value / 100 } })}
      />
    </Field>
  );

  const limitField = (key: "maximumSearches" | "maximumEmbeddingCalls" | "maximumEmbeddingTokens" | "maximumDurationMilliseconds", label: string, minimum: number, maximum: number, unit?: string) => (
    <Field label={label} labelAside={explain(key, label)} error={errors[key]}>
      <UnitInput unit={unit} minimum={minimum} maximum={maximum} value={configuration[key]} onValue={(value) => update({ [key]: value })} />
    </Field>
  );

  const sectionError = (key: string): ReactNode =>
    errors[key] === undefined ? null : (
      <p className={FIELD_ERROR} role="alert">
        {errors[key]}
      </p>
    );

  const missing = firstMissing();
  const room = MAXIMUM_QUESTIONS - configuration.questions.length;

  return (
    <>
      <PageHeader
        eyebrow={t("quality.editor.eyebrow", "{quality} / Evaluation suite", {
          quality: (
            <Link to="/quality" className={CRUMB}>
              {t("quality.title", "Quality")}
            </Link>
          ),
        })}
        title={suite === null ? newSuiteTitle : suite.name}
        status={
          suite === null ? undefined : (
            <Badge tone="neutral">{t("quality.editor.revision", "Revision {revision}", { revision: suite.revision })}</Badge>
          )
        }
        lead={t(
          "quality.editor.lead",
          "Questions with the documents that should answer them. A run searches each with every profile compared and scores what came back.",
        )}
      />
      <fieldset className={EDITOR} disabled={!mayManage}>
        {problem !== null && (
          <Notice tone="error" title={problem.title}>
            {problem.detail ?? problem.description}
          </Notice>
        )}
        <section className={PANEL} aria-label={t("quality.editor.settings", "Suite")}>
          <div className={SETTINGS_ROW}>
            <Field label={t("quality.editor.name", "Name")} required error={errors.name}>
              <Input value={name} maxLength={160} fullWidth onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field
              label={t("quality.editor.readProfile", "Read profile")}
              labelAside={explain("readProfileId", t("quality.editor.readProfile", "Read profile"))}
              error={errors.readProfileId}
            >
              <Select value={configuration.readProfileId} fullWidth onChange={(event) => update({ readProfileId: event.target.value })}>
                {readProfiles.length === 0 && <option value="">{t("quality.editor.noReadProfile", "No read profile yet")}</option>}
                {readProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("quality.editor.onlySearch", "Only search")} labelAside={explain("sourceId", t("quality.editor.onlySearch", "Only search"))}>
              <Select value={configuration.sourceId ?? ""} fullWidth onChange={(event) => update({ sourceId: event.target.value === "" ? null : event.target.value })}>
                <option value="">{t("quality.editor.everySource", "Every source")}</option>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("quality.editor.top", "Top")} labelAside={explain("cutoff", t("quality.editor.top", "Top"))} error={errors.cutoff}>
              <UnitInput
                unit={t("quality.editor.hits", "hits")}
                minimum={1}
                maximum={100}
                value={configuration.cutoff}
                onValue={(value) => update({ cutoff: value })}
              />
            </Field>
            <div className={ENABLED_CELL}>
              <Checkbox
                label={t("quality.editor.enabled", "Enabled")}
                title={t("quality.editor.enabledHint", "A disabled suite keeps its runs but cannot be run.")}
                checked={configuration.enabled}
                onChange={(event) => update({ enabled: event.target.checked })}
              />
            </div>
          </div>
        </section>

        <section className={PANEL} aria-labelledby="suite-questions">
          <div className={TOOLBAR}>
            <h2 id="suite-questions" className={SECTION_TITLE}>
              {t("quality.editor.questions", "Questions · {count}", { count: configuration.questions.length })}
            </h2>
            <div className={TOOLBAR_ACTIONS}>
              {!drafting && (
                <Button variant="quiet" icon="prompt" onClick={() => setDrafting(true)} disabled={room === 0}>
                  {t("quality.editor.draftQuestions", "Draft from documents")}
                </Button>
              )}
              <Button variant="quiet" icon="plus" onClick={addQuestion} disabled={room === 0}>
                {t("quality.editor.addQuestion", "Add a question")}
              </Button>
            </div>
          </div>
          {sectionError("questions")}
          {drafting && (
            <QuestionDraftingPanel
              workspaceId={workspaceId}
              sources={sources}
              room={room}
              onClose={() => setDrafting(false)}
              onAccept={(accepted) => {
                const taken = new Set(configuration.questions.map((question) => question.id));
                accepted.forEach(({ draft }) =>
                  remember({ id: draft.documentId, title: draft.documentTitle, externalId: known.get(draft.documentId)?.externalId ?? "", sourceName: known.get(draft.documentId)?.sourceName ?? "", latestVersionId: draft.versionId }),
                );
                update({
                  questions: [
                    ...configuration.questions,
                    ...accepted.map(({ text, draft }) => ({
                      id: freeIdentifier(taken),
                      text,
                      tags: ["drafted"],
                      expectation: "RELEVANT" as const,
                      relevant: [{ documentId: draft.documentId, versionId: draft.versionId }],
                    })),
                  ],
                });
                notify({
                  tone: "good",
                  title: t("quality.drafting.added", "Questions added"),
                  description: t("quality.drafting.addedDescription", "Review them below, then save the suite."),
                });
              }}
            />
          )}
          {configuration.questions.length === 0 && !drafting && (
            <p className="text-xs text-muted">
              {t("quality.editor.noQuestions", "Add the questions people really ask, and say which documents should answer each.")}
            </p>
          )}
          <ol className={QUESTIONS}>
            {configuration.questions.map((question, index) => {
              const path = `questions[${index}]`;
              return (
                <li key={index} className={QUESTION}>
                  <div className={QUESTION_HEAD}>
                    <span className={QUESTION_NUMBER}>{index + 1}</span>
                    <Input
                      className={`numeric ${QUESTION_ID}`}
                      aria-label={t("quality.editor.questionIdentifier", "Question identifier")}
                      invalid={errors[`${path}.id`] !== undefined}
                      value={question.id}
                      onChange={(event) => setQuestion(index, { id: event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "-") })}
                    />
                    <Select
                      aria-label={t("quality.editor.expectation", "Expectation")}
                      value={question.expectation}
                      onChange={(event) => {
                        const expectation = event.target.value as EvaluationQuestion["expectation"];
                        setQuestion(index, { expectation, relevant: expectation === "EMPTY" ? [] : question.relevant });
                      }}
                    >
                      <option value="RELEVANT">{t("quality.editor.shouldFindDocuments", "Should find documents")}</option>
                      <option value="EMPTY">{t("quality.editor.shouldFindNothing", "Should find nothing")}</option>
                    </Select>
                    <Button
                      variant="quiet"
                      iconOnly
                      icon="trash"
                      aria-label={t("quality.editor.removeQuestion", "Remove {identifier}", { identifier: question.id })}
                      onClick={() => update({ questions: configuration.questions.filter((_unused, position) => position !== index) })}
                    />
                  </div>
                  {sectionError(`${path}.id`)}
                  <Field label={<span className="sr-only">{t("quality.editor.questionText", "Question text")}</span>} error={errors[`${path}.text`]}>
                    <TextArea
                      rows={2}
                      value={question.text}
                      placeholder={t("quality.editor.questionPlaceholder", "What would a person type?")}
                      onChange={(event) => setQuestion(index, { text: event.target.value })}
                    />
                  </Field>
                  {question.expectation === "RELEVANT" && (
                    <DocumentPicker
                      workspaceId={workspaceId}
                      label={t("quality.editor.shouldFind", "Should find")}
                      chosen={question.relevant.map((target) => pickedFor(target.documentId))}
                      sources={sources}
                      error={errors[`${path}.relevant`]}
                      disabled={!mayManage}
                      onPick={(document) => {
                        remember(document);
                        setQuestion(index, { relevant: [...question.relevant, { documentId: document.id, versionId: document.latestVersionId }] });
                      }}
                      onRemove={(documentId) => setQuestion(index, { relevant: question.relevant.filter((candidate) => candidate.documentId !== documentId) })}
                    />
                  )}
                  <ChipInput
                    values={question.tags}
                    onChange={(tags) => setQuestion(index, { tags })}
                    noun="tag"
                    placeholder={t("quality.editor.tagsPlaceholder", "Tags, for grouping results")}
                  />
                  {sectionError(`${path}.tags`)}
                </li>
              );
            })}
          </ol>
        </section>

        <section className={PANEL} aria-labelledby="suite-selections">
          <div className={TOOLBAR}>
            <h2 id="suite-selections" className={SECTION_TITLE}>
              {t("quality.editor.compared", "Compared · {count}", { count: configuration.selections.length })}
            </h2>
            <Button
              variant="quiet"
              icon="plus"
              disabled={searchProfiles.length === 0 || configuration.selections.length >= MAXIMUM_SELECTIONS}
              onClick={() => update({ selections: [...configuration.selections, { profileId: searchProfiles[0]?.id ?? "", mode: "LEXICAL" }] })}
            >
              {t("quality.editor.compareAnother", "Compare another")}
            </Button>
          </div>
          {sectionError("selections")}
          <ul className={COMPARISONS}>
            {configuration.selections.map((selection, index) => (
              <li key={index} className={COMPARISON}>
                <Select
                  aria-label={t("quality.detail.profile", "Search profile")}
                  value={selection.profileId}
                  onChange={(event) => setSelection(index, { profileId: event.target.value })}
                >
                  {searchProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </Select>
                <Select
                  aria-label={t("quality.detail.mode", "Mode")}
                  value={selection.mode}
                  onChange={(event) => setSelection(index, { mode: event.target.value as RetrievalMode })}
                >
                  {MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {labelOfCode(RETRIEVAL_MODES, mode)}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="quiet"
                  iconOnly
                  icon="trash"
                  aria-label={t("quality.editor.stopComparing", "Stop comparing this")}
                  onClick={() => update({ selections: configuration.selections.filter((_unused, position) => position !== index) })}
                />
              </li>
            ))}
          </ul>
        </section>

        <div className={GROUPS}>
          <section className={PANEL} aria-labelledby="suite-thresholds">
            <h2 id="suite-thresholds" className={SECTION_TITLE}>
              {t("quality.editor.thresholds", "Passing thresholds")}
            </h2>
            <div className={NUMBER_GRID}>
              {percentField("hitRate", say(METRIC_LABELS.hitRate))}
              {percentField("recall", say(METRIC_LABELS.recall))}
              {percentField("meanReciprocalRank", say(METRIC_LABELS.meanReciprocalRank))}
              {percentField("maximumUnexpectedResponseRate", say(METRIC_LABELS.unexpected))}
            </div>
          </section>
          <section className={PANEL} aria-labelledby="suite-limits">
            <h2 id="suite-limits" className={SECTION_TITLE}>
              {t("quality.editor.runLimits", "Run limits")}
            </h2>
            <div className={NUMBER_GRID}>
              {limitField("maximumSearches", t("quality.editor.searches", "Searches"), 1, 1000)}
              {limitField("maximumEmbeddingCalls", t("quality.editor.embeddingCalls", "Embedding calls"), 0, 1000)}
              {limitField("maximumEmbeddingTokens", t("quality.editor.embeddingTokens", "Embedding tokens"), 0, 1000000)}
              {limitField("maximumDurationMilliseconds", t("quality.editor.time", "Time"), 10, 600000, t("quality.editor.milliseconds", "ms"))}
            </div>
          </section>
        </div>

        {mayManage && (
          <div className={SAVE_BAR}>
            <span className="text-xs" role="status">
              {missing !== null ? (
                <span className={MISSING}>{missing}</span>
              ) : suite === null ? (
                t("quality.editor.notCreated", "Not created yet")
              ) : (
                t("quality.editor.savingNote", "Saving writes a new revision; earlier runs keep theirs.")
              )}
            </span>
            <Button variant="primary" disabled={saving || (attempted && blocking)} onClick={() => void save()}>
              {saving
                ? t("common.saving", "Saving…")
                : suite === null
                  ? t("quality.editor.create", "Create suite")
                  : t("quality.editor.saveRevision", "Save revision")}
            </Button>
          </div>
        )}
      </fieldset>
    </>
  );
}
