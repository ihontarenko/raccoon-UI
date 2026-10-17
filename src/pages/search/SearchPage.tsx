import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { usePermissions } from "../../access/PermissionsProvider";
import { PERMISSIONS } from "../../access/permissions";
import { ENTRY_ORIGINS, RETRIEVAL_MODES } from "../../application/codeLabels";
import { formatNumber, labelOfCode, shortIdentifier } from "../../application/format";
import { describeProblem, type Problem } from "../../application/problems";
import { RERANK_STATE, ordinal, rerankReasonText } from "../../application/rerank";
import { useReadySession } from "../../application/session";
import { useStoredChoice } from "../../application/useStoredChoice";
import { ClosenessBars } from "../../ui/components/closeness/ClosenessBars";
import { ClosenessTable } from "../../ui/components/closeness/ClosenessTable";
import { usePageTitle } from "../../application/usePageTitle";
import { useResource } from "../../application/useResource";
import { api, collectAllPages } from "../../lib/api";
import type { HitGroup, HitRemote, RetrievalMode, SearchHit, SearchResponse } from "../../lib/contracts";
import {
  ClosenessGauge,
  ClosenessOverview,
  EmptyState,
  Facts,
  FoundBy,
  HighlightedExcerpt,
  HitCloseness,
  Inspector,
  InspectorActions,
  InspectorSection,
  Notice,
  PageHeader,
  ProblemState,
  RankLadder,
  RankShift,
  RecognizedInQuery,
  SectionBar,
  Segmented,
  CopyButton,
  TermPresence,
  Waiting,
  Workbench,
  closenessOfHits,
  distanceScaleEnd,
  explainHit,
  hasRecognition,
  termPresence,
  type Closeness,
  type HitExplanation,
} from "../../ui/components";
import { formatDecimal } from "../../ui/components/closeness/closeness";
import { profilesApi, type Profile } from "../../lib/profiles";
import { declareText, translate, translateDeclared, type DeclaredText } from "../../translations/translate";
import { useTranslation } from "../../translations/TranslationProvider";
import { Badge, Button, Icon, Select } from "../../ui/primitives";
import { ProfileFlowStrip } from "../profiles/ProfileFlow";
import { ProfileQuickSettings } from "../profiles/ProfileQuickSettings";
import { answersApi, type AnswerResponse } from "../../lib/answers";
import { AnswerPanel, referencesOf, type AnswerReferences } from "./AnswerPanel";
import { hasRerank } from "../profiles/profileWiring";

/*
 * ⚠️ THE QUERY PANEL CARRIES THE FOCUS RING FOR THE FIELD INSIDE IT. The field is borderless and
 * transparent so the panel reads as one control; `focus-within` on the panel and `outline-none` on
 * the field are the two halves of that, and dropping either leaves the keyboard with nothing to see.
 */
const QUERY_PANEL = [
  "mb-3 rounded-surface border border-line-strong bg-surface",
  "focus-within:border-accent-text",
].join(" ");

const QUERY_LABEL = "block [padding:var(--space-3)_var(--space-4)_0] text-xs text-secondary";

const QUERY_MAIN = [
  "flex items-center gap-3 text-accent-text",
  "[padding:var(--space-3)_var(--space-4)_var(--space-4)]",
  "max-[700px]:flex-wrap",
].join(" ");

/* The field and the button beside it are one control: both take the control height. */
const QUERY_INPUT = [
  "h-(--control) min-w-0 flex-1 border-0 bg-transparent font-sans text-md text-ink",
  "placeholder:text-muted focus-visible:outline-none",
  "max-[700px]:text-base",
].join(" ");

/*
 * ⚠️ ON A PHONE THE FILTER ROW BECOMES A LIST OF LINES, each built the same way: a fixed label track
 * on the left and the control filling the rest. Pushing each control to the right edge instead left
 * three selects of three different widths and so three different left edges — a ragged column where
 * the eye expects a list.
 */
const FILTERS = [
  "flex flex-wrap items-center gap-4 border-t border-line bg-well px-4 py-3",
  "rounded-b-surface",
  "max-[700px]:grid max-[700px]:gap-3",
].join(" ");

const INLINE_FIELD = [
  "flex items-center gap-2 text-xs text-secondary",
  "max-[700px]:grid max-[700px]:w-full max-[700px]:grid-cols-[minmax(0,6.5em)_minmax(0,1fr)]",
  "max-[700px]:items-center max-[700px]:gap-3",
  "max-[700px]:[&_select]:w-full max-[700px]:[&_input]:w-full",
].join(" ");

/* The mode as a segmented control: one press per mode, the ones this profile refuses struck through.
   The strip needs the whole line, so on a phone its label sits above it rather than taking a track. */
const MODE_FIELD = [
  "flex flex-wrap items-center gap-2 text-xs text-secondary",
  "max-[700px]:grid max-[700px]:w-full max-[700px]:gap-2",
].join(" ");

const COST_NOTE = "text-xs text-warn";

const RESULTS = "grid gap-4";

const RESULT_LIST = "min-w-0";

const RETRIEVAL_SUMMARY = "flex flex-wrap items-center gap-2 text-xs text-muted";

const HIT_LIST = "m-0 list-none p-0";

/*
 * The instrument strip over the hits: closeness of every hit, the query's terms against the result,
 * and — when the rerank stage reordered them — the ladder from fused to final order. Cells sit side
 * by side, divided by rules, and wrap under one another when the column is narrow, where the rule
 * moves from the side to the top.
 */
const INSTRUMENT = "flex flex-wrap border-b border-line";

/* The closeness block's own header: what it is, how it is drawn, and the fold — so a reader who has seen enough
   folds it away and keeps the list, and the choice is remembered. */
const INSTRUMENT_BAR = "flex flex-wrap items-center gap-3 border-b border-line bg-well px-4 py-2";

const INSTRUMENT_TITLE = "mr-auto text-2xs font-semibold tracking-[0.06em] text-secondary uppercase";

type ClosenessView = "scale" | "bars" | "table";

const CLOSENESS_VIEWS: readonly ClosenessView[] = ["scale", "bars", "table"];

const INSTRUMENT_CELL = [
  "min-w-0 flex-[1_1_220px] px-4 py-3",
  "not-first:border-l not-first:border-line",
  "max-[700px]:basis-full max-[700px]:p-3",
  "max-[700px]:not-first:border-l-0! max-[700px]:not-first:border-t max-[700px]:not-first:border-line",
].join(" ");

/* The closeness overview brings its own padding and rule, and is the widest picture: it gets the most
   room and no padding of its own. */
const INSTRUMENT_CLOSENESS = "flex-[2_1_380px] p-0! [&>figure]:border-b-0";

/* The query's terms over the rerank ladder, in one column beside the closeness picture. */
const INSTRUMENT_SIDE = "grid content-start gap-4";

const HIT = [
  "grid grid-cols-[calc(30px*var(--ui-scale))_minmax(0,1fr)_auto] gap-3 p-4",
  "border-b border-line border-l-2 border-l-transparent last:border-b-0 hover:bg-well",
  "max-[700px]:grid-cols-[calc(26px*var(--ui-scale))_minmax(0,1fr)] max-[700px]:p-3",
].join(" ");

/* ⚠️ MARKED IMPORTANT: the selected hit keeps its tint under the cursor, and `hover:bg-well` on the
   row is a variant that would otherwise win over a plain fill. */
const HIT_SELECTED = "border-l-accent! bg-accent-soft!";

/* A further passage of the document above it: under its body, quieter, no title of its own. */
const HIT_PASSAGE = "bg-well pt-2 pb-3";
const PASSAGE_LINK = "numeric text-xs font-semibold text-accent-text hover:underline";
const GROUP_SUMMARY = "flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-dashed border-line pt-2";
const GROUP_COUNT = "text-xs text-secondary numeric";
/* After a search, the offer to answer from it: one quiet line, not a second form. */
const ANSWER_OFFER = "mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-dashed border-line py-2";
const SCOPE_CHIP = "inline-flex items-center gap-2 rounded-control border border-line bg-well py-0.5 pr-0.5 pl-2 text-xs";

interface DocumentScope {
  documentId: string;
  title: string;
}

const RANK = "pt-[calc(2px*var(--ui-scale))] text-2xs text-muted";

/* ⚠️ ONE EXPLICIT SHRINKABLE COLUMN: an implicit one grows to the longest unbroken path or
   identifier, and a technical value inside is told to break anywhere for the same reason. */
const HIT_BODY = [
  "grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2",
  "[&_.numeric]:min-w-0 [&_.numeric]:[overflow-wrap:anywhere]",
].join(" ");

const HIT_TITLE = [
  "[&_button]:border-0 [&_button]:bg-transparent [&_button]:p-0 [&_button]:text-left",
  "[&_button]:text-base [&_button]:font-semibold [&_button]:text-ink",
  "[&_button]:[overflow-wrap:anywhere] [&_button:hover]:text-accent-text",
].join(" ");

const HIT_META = "flex flex-wrap items-center gap-2";

/* Four lines of the chunk and then an ellipsis: enough to judge the hit, not enough to read it here. */
const EXCERPT = "line-clamp-4 max-w-[80ch] whitespace-pre-line text-secondary [overflow-wrap:anywhere]";

/* The closeness picture over the score it was ranked by. */
const SCORE = [
  "grid content-start justify-items-end gap-1 text-2xs text-muted",
  "max-[700px]:col-start-2 max-[700px]:justify-items-start",
].join(" ");

/* The short identities of a hit's origin as a row of badges — scanned at a glance, where a table of six facts read
   as one grey block. Colour follows meaning: the source is the door, the parser is the pipeline. */
const CHIPS = "flex flex-wrap gap-1";

const PATH_LINE = "m-0 mt-2 font-mono text-xs [overflow-wrap:anywhere] text-ink";

const DIGEST = "mt-1 flex items-center gap-2 text-xs";

const BRANCHES = [
  "m-0 mt-2 grid list-none gap-1 p-0",
  "[&>li]:flex [&>li]:items-center [&>li]:justify-between [&>li]:gap-3",
].join(" ");

const BRANCH_LABEL = "text-xs text-secondary";

const QUIET_LINE = "m-0 mt-2 border-t border-line pt-2 text-xs text-muted";

const INSPECTOR_EXCERPT = [
  "border-l-2 border-l-accent pl-3 text-xs leading-[1.7] whitespace-pre-line text-secondary",
  "[overflow-wrap:anywhere]",
].join(" ");

/* What the chosen profile will do with this search, stage by stage. ⚠️ The strip stands on its own
   under the query block rather than as a last row inside it. */
const FLOW_STRIP = "mb-6";

/* Where fusion had put a hit before the rerank model moved it — quiet, beside the score. */
const FUSED_POSITION = "text-2xs whitespace-nowrap text-muted";

/* The link back to a knowledge-base page a hit was imported from. */
const REMOTE_LINK = "inline-flex items-center gap-1 text-sm text-accent-text";

/** "Profile default" asks for no override, so the profile's own mode runs. */
type ModeChoice = RetrievalMode | "DEFAULT";

const MODE_OPTIONS: { value: ModeChoice; label: DeclaredText; meaning: DeclaredText }[] = [
  {
    value: "DEFAULT",
    label: declareText("search.mode.default", "Profile default"),
    meaning: declareText("search.mode.default.meaning", "whatever the profile is set to"),
  },
  {
    value: "LEXICAL",
    label: declareText("search.mode.lexical", "Keyword"),
    meaning: declareText("search.mode.lexical.meaning", "matching words"),
  },
  {
    value: "SEMANTIC",
    label: declareText("search.mode.semantic", "Meaning"),
    meaning: declareText("search.mode.semantic.meaning", "closeness of meaning, by vectors"),
  },
  {
    value: "HYBRID",
    label: declareText("search.mode.hybrid", "Hybrid"),
    meaning: declareText("search.mode.hybrid.meaning", "words and meaning, fused"),
  },
  {
    value: "AUTO",
    label: declareText("search.mode.auto", "Auto"),
    meaning: declareText("search.mode.auto.meaning", "the profile chooses per query"),
  },
];

/**
 * The modes a search profile lets a person ask for: its own mode and the overrides it allows — the same
 * rule the server applies. Null when the profile could not be read, and then every mode is offered and
 * the server's refusal says why.
 */
/** A mode in the words the control uses: "keyword", "meaning", "hybrid", "auto". */
function modeWordOf(mode: string): string {
  const option = MODE_OPTIONS.find((candidate) => candidate.value === mode);
  return (option === undefined ? labelOfCode(RETRIEVAL_MODES, mode) : translateDeclared(option.label)).toLowerCase();
}

function allowedModesOf(profile: Profile | null): Set<RetrievalMode> | null {
  const retrieval = (
    profile?.configuration as
      { retrieval?: { mode?: unknown; allowedOverrides?: unknown } } | undefined
  )?.retrieval;
  if (
    retrieval === undefined ||
    typeof retrieval.mode !== "string" ||
    !Array.isArray(retrieval.allowedOverrides)
  ) {
    return null;
  }
  return new Set(
    [retrieval.mode, ...retrieval.allowedOverrides].filter(
      (value): value is RetrievalMode => typeof value === "string",
    ) as RetrievalMode[],
  );
}

const LIMIT_OPTIONS = [10, 25, 50, 100];

type Outcome =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "answering" }
  | { status: "done"; response: SearchResponse }
  | { status: "answered"; answer: AnswerResponse }
  | { status: "failed"; problem: Problem };

/** What one query is for: the passages themselves, or an answer written from them. */
type Intent = "find" | "answer";

function linesOf(hit: SearchHit): string | null {
  if (hit.citation === null) {
    return null;
  }
  const { startLine, endLine, startPage, endPage } = hit.citation;
  const lines =
    startLine === endLine
      ? translate("search.line", "line {line}", { line: startLine })
      : translate("search.lines", "lines {start}–{end}", { start: startLine, end: endLine });
  if (startPage === null || startPage === undefined || endPage === null || endPage === undefined) {
    return lines;
  }
  const pages =
    startPage === endPage
      ? translate("search.page", "page {page}", { page: startPage })
      : translate("search.pages", "pages {start}–{end}", { start: startPage, end: endPage });
  return `${pages} · ${lines}`;
}

function formatScore(score: number | null | undefined): string {
  return score === null || score === undefined ? "—" : formatDecimal(score, 3);
}

export function SearchPage() {
  const { t, say } = useTranslation();
  usePageTitle(t("search.title", "Search"));
  const { workspace } = useReadySession();
  const workspaceId = workspace?.id ?? null;
  const permissions = usePermissions();
  const search = useSearch({ strict: false }) as { text?: unknown; mode?: unknown };
  const navigate = useNavigate();
  const addressText = typeof search.text === "string" ? search.text : "";
  const intent: Intent = search.mode === "answer" ? "answer" : "find";
  const changeIntent = (next: Intent) => {
    void navigate({
      to: "/search",
      search: { text: addressText === "" ? undefined : addressText, mode: next === "answer" ? "answer" : undefined },
      replace: true,
    });
  };

  const [draft, setDraft] = useState(addressText);
  const [profileId, setProfileId] = useState("");
  const [mode, setMode] = useState<ModeChoice>("DEFAULT");
  const [sourceId, setSourceId] = useState("");
  // "Search in this document" from a grouped result: the next searches stay inside it until the scope is removed.
  const [documentScope, setDocumentScope] = useState<DocumentScope | null>(null);
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false);
  const [answerProfileId, setAnswerProfileId] = useState("");
  const answerProfiles = useResource(
    () =>
      workspaceId === null
        ? Promise.resolve([])
        : collectAllPages((page) => answersApi.availableAnswerProfiles(workspaceId, page)).catch(() => []),
    [workspaceId],
  );
  useEffect(() => {
    if (answerProfiles.status === "ready" && answerProfiles.data.length > 0) {
      setAnswerProfileId((current) =>
        answerProfiles.data.some((candidate) => candidate.id === current) ? current : answerProfiles.data[0].id,
      );
    }
  }, [answerProfiles]);
  const answerProfileList = answerProfiles.status === "ready" ? answerProfiles.data : [];
  // A saved profile is a new revision: the flow strip and the results are read again under it.
  const [profileRevisionKey, setProfileRevisionKey] = useState(0);
  const [limit, setLimit] = useState(25);
  const [outcome, setOutcome] = useState<Outcome>({ status: "idle" });
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const searchGeneration = useRef(0);

  const profiles = useResource(
    () => (workspaceId === null ? Promise.resolve([]) : api.availableSearchProfiles(workspaceId)),
    [workspaceId],
  );
  // Which modes the chosen profile allows is part of its configuration, readable to whoever may read profiles.
  const mayReadProfiles = permissions.may(PERMISSIONS.automationRead);
  const profile = useResource(
    () =>
      workspaceId === null || profileId === "" || !mayReadProfiles
        ? Promise.resolve(null)
        : profilesApi.get(workspaceId, "search", profileId).catch(() => null),
    [workspaceId, profileId, mayReadProfiles],
  );
  const allowedModes = allowedModesOf(profile.status === "ready" ? profile.data : null);
  const profileMode =
    (profile.status === "ready"
      ? (profile.data?.configuration as { retrieval?: { mode?: string } } | undefined)?.retrieval
          ?.mode
      : undefined) ?? null;

  const profileReranks =
    profile.status === "ready" &&
    profile.data !== null &&
    hasRerank(profile.data);

  // A mode the newly chosen profile does not allow falls back to the profile's own.
  useEffect(() => {
    if (mode !== "DEFAULT" && allowedModes !== null && !allowedModes.has(mode)) {
      setMode("DEFAULT");
    }
  }, [allowedModes, mode]);
  const maySeeSources = permissions.may(PERMISSIONS.sourceRead);
  const sources = useResource(
    () =>
      workspaceId === null || !maySeeSources
        ? Promise.resolve([])
        : collectAllPages((page) => api.listSources(workspaceId, page)),
    [workspaceId, maySeeSources],
  );

  const sourceNames = useMemo(() => {
    const names = new Map<string, string>();
    if (sources.status === "ready") {
      for (const source of sources.data) {
        names.set(source.id, source.name);
      }
    }
    return names;
  }, [sources]);

  // Choose the first available profile once they arrive, keeping a choice the person already made.
  useEffect(() => {
    if (profiles.status === "ready" && profiles.data.length > 0) {
      setProfileId((current) =>
        profiles.data.some((profile) => profile.id === current) ? current : profiles.data[0].id,
      );
    }
  }, [profiles]);

  const runSearch = (text: string, scope: DocumentScope | null = documentScope) => {
    if (workspaceId === null || profileId === "" || text.trim().length === 0) {
      return;
    }
    searchGeneration.current += 1;
    const generation = searchGeneration.current;
    setOutcome({ status: "searching" });
    api
      .search(workspaceId, {
        profileId,
        text: text.trim(),
        limit,
        mode: mode === "DEFAULT" ? undefined : mode,
        sourceId: sourceId === "" ? undefined : sourceId,
        documentId: scope?.documentId,
      })
      .then((response) => {
        if (generation === searchGeneration.current) {
          setOutcome({ status: "done", response });
          setSelectedEntryId(response.hits[0]?.entryId ?? null);
        }
      })
      .catch((error: unknown) => {
        if (generation === searchGeneration.current) {
          setOutcome({ status: "failed", problem: describeProblem(error) });
        }
      });
  };

  // ⚠️ An answer may call a paid model, so it runs only when asked — never from the address or a profile change.
  const runAnswer = (text: string) => {
    if (workspaceId === null || answerProfileId === "" || text.trim().length === 0) {
      return;
    }
    searchGeneration.current += 1;
    const generation = searchGeneration.current;
    setOutcome({ status: "answering" });
    answersApi
      .answer(workspaceId, { profileId: answerProfileId, question: text.trim(), sourceId: sourceId === "" ? null : sourceId })
      .then((answer) => {
        if (generation === searchGeneration.current) {
          setOutcome({ status: "answered", answer });
          setSelectedEntryId(answer.search?.hits[0]?.entryId ?? null);
        }
      })
      .catch((error: unknown) => {
        if (generation === searchGeneration.current) {
          setOutcome({ status: "failed", problem: describeProblem(error) });
        }
      });
  };

  // A query in the address (a shared link, or back/forward) runs once a profile is known.
  useEffect(() => {
    setDraft(addressText);
    if (addressText.length > 0 && profileId !== "" && intent === "find") {
      runSearch(addressText);
    }
    // Re-run only when the address or the chosen profile changes, not on every filter keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressText, profileId, workspaceId]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (intent === "answer") {
      if (text !== addressText) {
        void navigate({ to: "/search", search: { text, mode: "answer" }, replace: false });
      }
      runAnswer(text);
      return;
    }
    if (text === addressText) {
      runSearch(text);
      return;
    }
    void navigate({ to: "/search", search: { text }, replace: false });
  };

  const header = (
    <PageHeader
      eyebrow={t("navigation.group.knowledge", "Knowledge")}
      title={t("search.title", "Search")}
      lead={t(
        "search.leadWithAnswers",
        "Find the passages, or ask for an answer written from them — either way every passage cites the exact document version and lines it came from.",
      )}
    />
  );

  if (profiles.status === "loading") {
    return (
      <>
        {header}
        <Waiting label={t("search.loadingProfiles", "Loading search profiles")} />
      </>
    );
  }
  if (profiles.status === "failed") {
    return (
      <>
        {header}
        <ProblemState
          layout="section"
          problem={profiles.problem}
          actions={
            <Button icon="refresh" onClick={profiles.reload}>
              {t("common.tryAgain", "Try again")}
            </Button>
          }
        />
      </>
    );
  }
  if (profiles.data.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          title={t("search.noProfile", "No search profile in this workspace")}
          description={t(
            "search.noProfileDescription",
            "Searching runs through a search profile, which names the retrieval backend, the ranking and the limits. None is available to you here yet.",
          )}
        />
      </>
    );
  }

  const shownResponse =
    outcome.status === "done" ? outcome.response : outcome.status === "answered" ? outcome.answer.search : null;
  const hits = shownResponse?.hits ?? [];
  const references = outcome.status === "answered" ? referencesOf(outcome.answer) : undefined;
  const busy = outcome.status === "searching" || outcome.status === "answering";
  const selectedHit = hits.find((hit) => hit.entryId === selectedEntryId) ?? hits[0] ?? null;

  return (
    <>
      {header}
      <form className={QUERY_PANEL} onSubmit={handleSubmit} role="search">
        <label className={QUERY_LABEL} htmlFor="search-text">
          {t("search.query", "Query")}
        </label>
        <div className={QUERY_MAIN}>
          <Icon name="search" />
          <input
            id="search-text"
            className={QUERY_INPUT}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            placeholder={
              intent === "answer"
                ? t("search.questionPlaceholder", "A question — how does a source decide which files to take?")
                : t("search.queryPlaceholder", "A phrase, a file name or a question…")
            }
            autoComplete="off"
            spellCheck={false}
          />
          <Button
            type="submit"
            variant="primary"
            icon={intent === "answer" ? "answers" : undefined}
            disabled={draft.trim().length === 0 || busy || (intent === "answer" && answerProfileId === "")}
          >
            {intent === "answer" ? t("search.submitAnswer", "Answer") : t("search.submit", "Search")}
          </Button>
        </div>
        <div className={FILTERS}>
          <Segmented<Intent>
            label={t("search.intent", "What to do")}
            value={intent}
            onChange={changeIntent}
            options={[
              { value: "find", label: t("search.intent.find", "Find"), title: t("search.intent.findTitle", "The passages themselves, ranked") },
              {
                value: "answer",
                label: t("search.intent.answer", "Answer"),
                title:
                  answerProfileList.length === 0
                    ? t("search.intent.answerNone", "No answer profile is available to you here")
                    : t("search.intent.answerTitle", "An answer written from the passages, citing them"),
                disabled: answerProfileList.length === 0,
              },
            ]}
          />
          <label className={INLINE_FIELD}>
            <span>{t("search.profile", "Profile")}</span>
            {intent === "answer" ? (
              <Select
                value={answerProfileId}
                onChange={(event) => {
                  setAnswerProfileId(event.target.value);
                }}
              >
                {answerProfileList.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </Select>
            ) : (
              <Select
                value={profileId}
                onChange={(event) => {
                  setProfileId(event.target.value);
                }}
              >
                {profiles.data.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </Select>
            )}
          </label>
          {mayReadProfiles && (intent === "answer" ? answerProfileId : profileId) !== "" && (
            <Button
              variant="quiet"
              iconOnly
              icon="system"
              aria-label={intent === "answer" ? t("search.answerProfileSettings", "Settings of this answer profile") : t("search.profileSettings", "Settings of this search profile")}
              title={intent === "answer" ? t("search.answerProfileSettings", "Settings of this answer profile") : t("search.profileSettings", "Settings of this search profile")}
              onClick={() => {
                setProfileSettingsOpen(true);
              }}
            />
          )}
          {intent === "find" && (
          <div className={MODE_FIELD}>
            <span aria-hidden="true">{t("search.mode", "Mode")}</span>
            <Segmented<ModeChoice>
              label={t("search.mode", "Mode")}
              value={mode}
              onChange={setMode}
              options={MODE_OPTIONS.map((option) => {
                const refused =
                  option.value !== "DEFAULT" &&
                  allowedModes !== null &&
                  !allowedModes.has(option.value);
                const label = say(option.label);
                return {
                  value: option.value,
                  label,
                  disabled: refused,
                  title: refused
                    ? profileMode === null
                      ? t("search.modeRefused", "This profile does not allow {mode} search", {
                          mode: label.toLowerCase(),
                        })
                      : t(
                          "search.modeRefusedWithOwn",
                          "This profile does not allow {mode} search — it searches by {own}",
                          { mode: label.toLowerCase(), own: modeWordOf(profileMode) },
                        )
                    : option.value === "DEFAULT" && profileMode !== null
                      ? t("search.modeOwn", "The profile's own mode: {mode}", { mode: modeWordOf(profileMode) })
                      : t("search.modeSearchBy", "Search by {meaning}", { meaning: say(option.meaning) }),
                };
              })}
            />
          </div>
          )}
          {maySeeSources && (
            <label className={INLINE_FIELD}>
              <span>{t("search.source", "Source")}</span>
              <Select
                value={sourceId}
                onChange={(event) => {
                  setSourceId(event.target.value);
                }}
              >
                <option value="">{t("search.allSources", "All sources")}</option>
                {sources.status === "ready" &&
                  sources.data.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name}
                    </option>
                  ))}
              </Select>
            </label>
          )}
          {intent === "find" && documentScope !== null && (
            <span className={SCOPE_CHIP}>
              <span className="text-muted">{t("search.withinDocument", "Within")}</span>
              <span className="numeric font-semibold text-ink">{documentScope.title}</span>
              <Button
                variant="quiet"
                iconOnly
                icon="close"
                aria-label={t("search.leaveDocument", "Search all documents again")}
                title={t("search.leaveDocument", "Search all documents again")}
                onClick={() => {
                  setDocumentScope(null);
                  runSearch(draft, null);
                }}
              />
            </span>
          )}
          {intent === "find" && (
          <label className={INLINE_FIELD}>
            <span>{t("search.results", "Results")}</span>
            <Select
              value={String(limit)}
              onChange={(event) => {
                setLimit(Number(event.target.value));
              }}
            >
              {LIMIT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </label>
          )}
          {intent === "find" && (mode === "SEMANTIC" ||
            mode === "HYBRID" ||
            mode === "AUTO" ||
            (mode === "DEFAULT" && profileMode !== null && profileMode !== "LEXICAL")) && (
            <span className={COST_NOTE}>
              {t("search.semanticCost", "Semantic retrieval calls the embedding provider.")}
            </span>
          )}
          {intent === "find" && profileReranks && <span className={COST_NOTE}>
              {t("search.rerankCost", "Reranking calls the rerank provider.")}
            </span>}
        </div>
      </form>
      {/* What the next request will do, under the query rather than inside it: it reports, it is not a field. */}
      {intent === "find" && profileId !== "" && (
        <div className={FLOW_STRIP}>
          <ProfileFlowStrip key={profileRevisionKey} kind="search" profileId={profileId} mode={mode === "DEFAULT" ? undefined : mode} />
        </div>
      )}
      {intent === "answer" && answerProfileId !== "" && (
        <div className={FLOW_STRIP}>
          <ProfileFlowStrip key={profileRevisionKey} kind="answer" profileId={answerProfileId} />
        </div>
      )}
      {intent === "answer" && answerProfileId !== "" && (
        <ProfileQuickSettings
          open={profileSettingsOpen}
          kind="answer"
          profileId={answerProfileId}
          onClose={() => {
            setProfileSettingsOpen(false);
          }}
          onSaved={() => {
            setProfileRevisionKey((current) => current + 1);
          }}
          effectNote={t(
            "search.answerProfileSettingsEffect",
            "The settings an answer uses most. The next answer runs under the new revision — answering again is up to you, since it may call a paid model.",
          )}
        />
      )}
      {intent === "find" && profileId !== "" && (
        <ProfileQuickSettings
          open={profileSettingsOpen}
          kind="search"
          profileId={profileId}
          onClose={() => {
            setProfileSettingsOpen(false);
          }}
          onSaved={() => {
            setProfileRevisionKey((current) => current + 1);
            profile.reload();
            if (draft.trim().length > 0) {
              runSearch(draft);
            }
          }}
          effectNote={t(
            "search.profileSettingsEffect",
            "The settings this page uses most. The next search runs under the new revision; the results below are searched again when you save.",
          )}
        />
      )}

      {outcome.status === "idle" && (
        <EmptyState
          title={intent === "answer" ? t("search.idleAnswer", "Ask the documents") : t("search.idle", "Search the index")}
          description={
            intent === "answer"
              ? t(
                  "search.idleAnswerDescription",
                  "The answer comes with the passages it rests on, each numbered, so every sentence can be checked against its original.",
                )
              : t(
                  "search.idleDescription",
                  "Results show the cited document, its version and the exact lines, so every passage can be traced back to its original.",
                )
          }
        />
      )}
      {outcome.status === "searching" && <Waiting label={t("search.searching", "Searching")} lines={4} />}
      {outcome.status === "answering" && <Waiting label={t("ask.working", "Searching, verifying and answering")} lines={5} />}
      {outcome.status === "failed" && (
        <ProblemState
          layout="section"
          problem={outcome.problem}
          actions={
            <Button icon="refresh" onClick={() => (intent === "answer" ? runAnswer(draft) : runSearch(draft))}>
              {t("common.tryAgain", "Try again")}
            </Button>
          }
        />
      )}
      {outcome.status === "done" && answerProfileList.length > 0 && hits.length > 0 && (
        <div className={ANSWER_OFFER}>
          <span className="text-xs text-secondary">
            {t("search.answerOffer", "Want it in one answer? The same question, answered from these passages with citations.")}
          </span>
          <Button
            variant="quiet"
            icon="answers"
            onClick={() => {
              changeIntent("answer");
              runAnswer(draft);
            }}
          >
            {t("search.answerFromThese", "Answer from these")}
          </Button>
        </div>
      )}
      {outcome.status === "answered" && (
        <div className="mb-6">
          <AnswerPanel answer={outcome.answer} />
        </div>
      )}
      {outcome.status === "answered" && outcome.answer.search !== null && (
        <SearchResults
          response={outcome.answer.search}
          references={references}
          selectedHit={selectedHit}
          sourceNames={sourceNames}
          onSelect={setSelectedEntryId}
          onSearchInDocument={(hit) => {
            if (hit.citation === null) {
              return;
            }
            const scope = { documentId: hit.citation.documentId, title: hit.title };
            changeIntent("find");
            setDocumentScope(scope);
            runSearch(draft, scope);
          }}
        />
      )}
      {outcome.status === "done" && (
        <SearchResults
          response={outcome.response}
          selectedHit={selectedHit}
          sourceNames={sourceNames}
          onSelect={setSelectedEntryId}
          onSearchInDocument={(hit) => {
            if (hit.citation === null) {
              return;
            }
            const scope = { documentId: hit.citation.documentId, title: hit.title };
            setDocumentScope(scope);
            runSearch(draft, scope);
          }}
        />
      )}
    </>
  );
}

interface SearchResultsProperties {
  response: SearchResponse;
  selectedHit: SearchHit | null;
  sourceNames: Map<string, string>;
  onSelect: (entryId: string) => void;
  onSearchInDocument: (hit: SearchHit) => void;
  /** Set under an answer: the answer's number for each passage it drew on, and whether it cited it. */
  references?: AnswerReferences;
}

function SearchResults({ response, selectedHit, sourceNames, onSelect, onSearchInDocument, references }: SearchResultsProperties) {
  const { t, plural } = useTranslation();
  const { hits, retrieval } = response;
  // Grouped by document, a document's further passages stay folded under its best one until asked for.
  const grouped = hits.some((hit) => hit.group !== undefined && hit.group !== null);
  const documentCount = hits.filter((hit) => hit.group?.position === 1).length;
  const [openGroups, setOpenGroups] = useState<ReadonlySet<number>>(new Set());
  useEffect(() => {
    setOpenGroups(new Set());
  }, [response]);
  const toggleGroup = (rank: number) => {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(rank)) {
        next.delete(rank);
      } else {
        next.add(rank);
      }
      return next;
    });
  };
  const rerank = retrieval.rerank ?? null;
  // Every hit's closeness is read together, so keyword scores share one reference and distances one axis.
  const closenesses = useMemo(() => closenessOfHits(response), [response]);
  const explanations = useMemo(() => response.hits.map((hit, index) => explainHit(hit, index, response)), [response]);
  const presence = useMemo(() => termPresence(response), [response]);
  const reranked = rerank?.state === "APPLIED";
  const coverage = retrieval.vectorCoverage ?? null;
  const scaleEnd = distanceScaleEnd(closenesses, retrieval.metric ?? "COSINE");
  const [closenessView, setClosenessView] = useStoredChoice<ClosenessView>("raccoon.search.closenessView", "scale", CLOSENESS_VIEWS);
  const [closenessShown, setClosenessShown] = useStoredChoice<"open" | "folded">("raccoon.search.closenessShown", "open", ["open", "folded"]);
  const selectedIndex =
    selectedHit === null ? null : hits.findIndex((hit) => hit.entryId === selectedHit.entryId);
  const selectByIndex = (index: number) => {
    const hit = hits[index];
    if (hit !== undefined) {
      onSelect(hit.entryId);
    }
  };
  const sourceNameOf = (hit: SearchHit) =>
    hit.citation === null
      ? t("search.editorialEntry", "Editorial entry")
      : (sourceNames.get(hit.citation.sourceId) ??
        t("search.sourceIdentifier", "Source {identifier}", { identifier: shortIdentifier(hit.citation.sourceId) }));

  return (
    <div className={RESULTS}>
      {retrieval.requestedMode !== retrieval.effectiveMode && (
        <Notice
          tone="warn"
          title={t("search.ranAs", "Ran as {effective} instead of {requested}", {
            effective: labelOfCode(RETRIEVAL_MODES, retrieval.effectiveMode),
            requested: labelOfCode(RETRIEVAL_MODES, retrieval.requestedMode),
          })}
        >
          {retrieval.reason}
        </Notice>
      )}
      {rerank?.state === "FELL_BACK" && (
        <Notice tone="warn" title={t("search.notReranked", "Not reranked — the results keep their fused order")}>
          {rerank.providerStatus === null
            ? t("search.rerankFellBack", "The rerank stage fell back: {reason}.", {
                reason: rerankReasonText(rerank.reason) ?? "",
              })
            : t("search.rerankFellBackStatus", "The rerank stage fell back: {reason} (HTTP {status}).", {
                reason: rerankReasonText(rerank.reason) ?? "",
                status: rerank.providerStatus,
              })}
        </Notice>
      )}
      {coverage !== null && coverage.vectorisedDocuments < coverage.documents && (
        <Notice
          tone="warn"
          title={t("search.coverageTitle", "Meaning search saw {vectorised} of {documents} documents", {
            vectorised: formatNumber(coverage.vectorisedDocuments),
            documents: formatNumber(coverage.documents),
          })}
        >
          {t(
            "search.coverageBody",
            "Only documents with vectors in this profile's model space can be found by meaning. The other {missing} are reachable by keywords alone until they are vectorised.",
            { missing: formatNumber(coverage.documents - coverage.vectorisedDocuments) },
          )}
        </Notice>
      )}
      <Workbench>
        <section aria-label={t("search.resultsLabel", "Search results")} className={RESULT_LIST}>
          <SectionBar>
            <span>
              {grouped ? (
                <>
                  <strong className="numeric">
                    {formatNumber(documentCount)}
                    {response.hasMore ? "+" : ""}
                  </strong>{" "}
                  <span className="text-secondary">
                    {plural("search.documentNoun", documentCount, { one: "document", other: "documents" })}
                    {" · "}
                    {plural("search.passageCount", hits.length, { one: "{count} passage", other: "{count} passages" })}
                  </span>
                </>
              ) : (
                <>
                  <strong className="numeric">
                    {formatNumber(hits.length)}
                    {response.hasMore ? "+" : ""}
                  </strong>{" "}
                  <span className="text-secondary">
                    {plural("search.hitNoun", hits.length, { one: "hit", other: "hits" })}
                  </span>
                </>
              )}
            </span>
            <span className={RETRIEVAL_SUMMARY}>
              <Badge tone="active">{labelOfCode(RETRIEVAL_MODES, retrieval.effectiveMode)}</Badge>
              {t("search.candidates", "{lexical} lexical · {semantic} semantic candidates", {
                lexical: <span className="numeric">{formatNumber(retrieval.lexicalCandidates)}</span>,
                semantic: <span className="numeric">{formatNumber(retrieval.semanticCandidates)}</span>,
              })}
              {coverage !== null && (
                <span title={t("search.coverageSummaryTitle", "Documents in scope that have vectors in this model space")}>
                  {t("search.coverageSummary", "· vectors {vectorised}/{documents} docs", {
                    vectorised: <span className="numeric">{formatNumber(coverage.vectorisedDocuments)}</span>,
                    documents: <span className="numeric">{formatNumber(coverage.documents)}</span>,
                  })}
                </span>
              )}
              {rerank !== null && (
                <span title={rerank.reason === null ? undefined : (rerankReasonText(rerank.reason) ?? undefined)}>
                  <Badge tone={RERANK_STATE[rerank.state].tone}>{RERANK_STATE[rerank.state].word}</Badge>
                  {rerank.state === "APPLIED" && (
                    <>
                      {" "}
                      {t("search.rerankedBy", "by {model} · {candidates} → {kept}", {
                        model: <span className="numeric">{rerank.model}</span>,
                        candidates: <span className="numeric">{formatNumber(rerank.candidates)}</span>,
                        kept: <span className="numeric">{formatNumber(rerank.kept)}</span>,
                      })}
                      {rerank.latencyMilliseconds === null
                        ? ""
                        : t("search.latency", " · {milliseconds} ms", {
                            milliseconds: formatNumber(rerank.latencyMilliseconds),
                          })}
                    </>
                  )}
                </span>
              )}
            </span>
          </SectionBar>
          {hits.length === 0 ? (
            <EmptyState
              title={t("search.noMatches", "No matches")}
              description={t("search.noMatchesDescription", "Try fewer or different words, another mode, or all sources.")}
            />
          ) : (
            <>
              <div className={INSTRUMENT_BAR}>
                <span className={INSTRUMENT_TITLE}>{t("search.closeness.title", "Closeness")}</span>
                {closenessShown === "open" && (
                  <Segmented<ClosenessView>
                    label={t("search.closeness.view", "Show closeness as")}
                    value={closenessView}
                    onChange={setClosenessView}
                    options={[
                      { value: "scale", label: t("search.closeness.scale", "Scale") },
                      { value: "bars", label: t("search.closeness.bars", "Bars") },
                      { value: "table", label: t("search.closeness.table", "Table") },
                    ]}
                  />
                )}
                <Button
                  variant="quiet"
                  icon={closenessShown === "open" ? "chevron-up" : "chevron-down"}
                  aria-expanded={closenessShown === "open"}
                  aria-controls="search-closeness"
                  onClick={() => setClosenessShown(closenessShown === "open" ? "folded" : "open")}
                >
                  {closenessShown === "open" ? t("search.closeness.fold", "Fold") : t("search.closeness.unfold", "Unfold")}
                </Button>
              </div>
              {closenessShown === "open" && (
              <div className={INSTRUMENT} id="search-closeness">
                <div className={`${INSTRUMENT_CELL} ${INSTRUMENT_CLOSENESS} ${closenessView === "table" ? "basis-full" : ""}`}>
                  {closenessView === "scale" && (
                    <ClosenessOverview
                      closenesses={closenesses}
                      distanceScaleEnd={scaleEnd}
                      selectedIndex={selectedIndex}
                      onSelect={selectByIndex}
                    />
                  )}
                  {closenessView === "bars" && (
                    <ClosenessBars
                      closenesses={closenesses}
                      titles={hits.map((hit) => hit.title)}
                      distanceScaleEnd={scaleEnd}
                      selectedIndex={selectedIndex}
                      onSelect={selectByIndex}
                    />
                  )}
                  {closenessView === "table" && (
                    <ClosenessTable
                      closenesses={closenesses}
                      titles={hits.map((hit) => hit.title)}
                      selectedIndex={selectedIndex}
                      onSelect={selectByIndex}
                    />
                  )}
                </div>
                {(presence.length > 0 || reranked || hasRecognition(response.recognition)) && (
                  <div className={`${INSTRUMENT_CELL} ${INSTRUMENT_SIDE}`}>
                    {hasRecognition(response.recognition) && <RecognizedInQuery recognition={response.recognition} />}
                    <TermPresence presence={presence} hitCount={hits.length} />
                    {reranked && (
                      <RankLadder explanations={explanations} selectedIndex={selectedIndex} onSelect={selectByIndex} />
                    )}
                  </div>
                )}
              </div>
              )}
              <ol className={HIT_LIST}>
                {hits.map((hit, index) => {
                  const selected = selectedHit?.entryId === hit.entryId;
                  const lines = linesOf(hit);
                  const explanation = explanations[index];
                  const group = hit.group ?? null;
                  if (group !== null && group.position > 1) {
                    return openGroups.has(group.rank) ? (
                      <li key={hit.entryId} className={selected ? `${HIT} ${HIT_PASSAGE} ${HIT_SELECTED}` : `${HIT} ${HIT_PASSAGE}`}>
                        <span aria-hidden="true" />
                        <div className={HIT_BODY}>
                          <div className={HIT_META}>
                            <button
                              type="button"
                              className={PASSAGE_LINK}
                              aria-pressed={selected}
                              onClick={() => {
                                onSelect(hit.entryId);
                              }}
                            >
                              {lines ?? t("search.passageNumber", "Passage {number}", { number: group.position })}
                            </button>
                            {explanation !== undefined && <FoundBy explanation={explanation} />}
                            <AnswerReference references={references} entryId={hit.entryId} />
                          </div>
                          <HighlightedExcerpt
                            className={EXCERPT}
                            text={hit.excerpt}
                            spans={explanation?.spans ?? []}
                            truncated={hit.excerptTruncated}
                          />
                        </div>
                        <span className={SCORE}>
                          <span className="numeric">{formatScore(hit.score)}</span>
                        </span>
                      </li>
                    ) : null;
                  }
                  return (
                    <li
                      key={hit.entryId}
                      className={selected ? `${HIT} ${HIT_SELECTED}` : HIT}
                    >
                      {group !== null && !reranked ? (
                        <span className={`${RANK} numeric`}>{String(group.rank).padStart(2, "0")}</span>
                      ) : explanation === undefined ? (
                        <span className={`${RANK} numeric`}>{String(index + 1).padStart(2, "0")}</span>
                      ) : (
                        <RankShift explanation={explanation} reranked={reranked} />
                      )}
                      <div className={HIT_BODY}>
                        <p className="eyebrow">
                          {sourceNameOf(hit)} / {labelOfCode(ENTRY_ORIGINS, hit.origin)}
                        </p>
                        <AnswerReference references={references} entryId={hit.entryId} />
                        <h2 className={HIT_TITLE}>
                          <button
                            type="button"
                            aria-pressed={selected}
                            onClick={() => {
                              onSelect(hit.entryId);
                            }}
                          >
                            {hit.title}
                          </button>
                        </h2>
                        {hit.citation !== null && (
                          <div className={HIT_META}>
                            <span className="numeric">{hit.remote ? remoteFolderOf(hit.remote) : hit.citation.externalId}</span>
                            <Badge>v{hit.citation.versionNumber}</Badge>
                            {lines !== null && <span className="text-xs text-muted">{lines}</span>}
                          </div>
                        )}
                        {hit.remote !== undefined && hit.remote !== null && <RemoteOrigin remote={hit.remote} />}
                        {explanation !== undefined && <FoundBy explanation={explanation} />}
                        <HighlightedExcerpt
                          className={EXCERPT}
                          text={hit.excerpt}
                          spans={explanation?.spans ?? []}
                          truncated={hit.excerptTruncated}
                        />
                        {group !== null && (
                          <GroupSummary
                            hit={hit}
                            group={group}
                            open={openGroups.has(group.rank)}
                            onToggle={() => {
                              toggleGroup(group.rank);
                            }}
                            onSearchInDocument={() => {
                              onSearchInDocument(hit);
                            }}
                          />
                        )}
                      </div>
                      <span className={SCORE}>
                        {closenesses[index] !== undefined && (
                          <HitCloseness
                            closeness={closenesses[index]}
                            distanceScaleEnd={scaleEnd}
                          />
                        )}
                        <span
                          className="numeric"
                          title={
                            hit.reranked
                              ? t("search.scoreBeforeRerank", "The retrieval score, before reranking")
                              : t("search.scoreRankedBy", "The score the result was ranked by")
                          }
                        >
                          {formatScore(hit.score)}
                        </span>
                        {hit.reranked && (
                          <span
                            className={FUSED_POSITION}
                            title={t("search.rerankRelevanceTitle", "The relevance the rerank model gave it")}
                          >
                            {t("search.relevanceShort", "rel {relevance}", { relevance: formatScore(hit.reranked.relevance) })}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </section>
        {selectedHit !== null && (
          <HitInspector
            hit={selectedHit}
            sourceName={sourceNameOf(selectedHit)}
            closeness={
              selectedIndex === null || selectedIndex < 0
                ? null
                : (closenesses[selectedIndex] ?? null)
            }
            distanceScaleEnd={scaleEnd}
            explanation={selectedIndex === null || selectedIndex < 0 ? null : (explanations[selectedIndex] ?? null)}
            reranked={reranked}
          />
        )}
      </Workbench>
    </div>
  );
}

/**
 * Under a document's best passage: how many of its passages matched in all, the further ones it brought (folded),
 * and the way into the document itself — the same query, narrowed to it, where every passage is a result.
 */
function GroupSummary({
  hit,
  group,
  open,
  onToggle,
  onSearchInDocument,
}: {
  hit: SearchHit;
  group: HitGroup;
  open: boolean;
  onToggle: () => void;
  onSearchInDocument: () => void;
}) {
  const { t, plural } = useTranslation();
  const more = group.shown - 1;
  const matches = group.matches;
  const beyond = matches !== null && matches > group.shown;
  if (more === 0 && !beyond) {
    return null;
  }
  return (
    <div className={GROUP_SUMMARY}>
      {matches !== null && (
        <span className={GROUP_COUNT}>
          {plural("search.matchesInDocument", matches, {
            one: "{count} match in this document",
            other: "{count} matches in this document",
          })}
        </span>
      )}
      {more > 0 && (
        <Button variant="quiet" flush icon={open ? "chevron-up" : "chevron-down"} aria-expanded={open} onClick={onToggle}>
          {open
            ? t("search.hidePassages", "Hide the other passages")
            : plural("search.showPassages", more, { one: "Show {count} more passage", other: "Show {count} more passages" })}
        </Button>
      )}
      {hit.citation !== null && beyond && (
        <Button variant="quiet" flush icon="search" onClick={onSearchInDocument}>
          {t("search.searchInDocument", "Search in this document")}
        </Button>
      )}
    </div>
  );
}

/** Under an answer, the number the answer gave this passage — marked when the answer actually cited it. */
function AnswerReference({ references, entryId }: { references: AnswerReferences | undefined; entryId: string }) {
  const { t } = useTranslation();
  const reference = references?.get(entryId);
  if (reference === undefined) {
    return null;
  }
  return (
    <span className="flex">
      <Badge tone={reference.cited ? "good" : "neutral"}>
        {reference.cited
          ? t("search.citedAs", "Cited as [{number}]", { number: reference.number })
          : t("search.givenAs", "Given to the answer as [{number}]", { number: reference.number })}
      </Badge>
    </span>
  );
}

/** Where an imported hit is filed remotely, without its own title, which the hit already shows. */
function remoteFolderOf(remote: HitRemote): string {
  const separator = remote.path.lastIndexOf("/");
  return separator < 0 ? remote.path : remote.path.slice(0, separator);
}

/** A hit imported from a knowledge base: its tags there, and the link back to the page itself. */
function RemoteOrigin({ remote }: { remote: HitRemote }) {
  const { t } = useTranslation();
  return (
    <div className={HIT_META}>
      {remote.address !== null && (
        <a className={REMOTE_LINK} href={remote.address} target="_blank" rel="noopener noreferrer">
          <Icon name="link" size="small" />
          {t("search.openOriginal", "Open the original")}
          <span className="sr-only"> {t("search.newTab", "(opens in a new tab)")}</span>
        </a>
      )}
      {remote.tags.map((tag) => (
        <Badge key={tag} tone="neutral">
          {tag}
        </Badge>
      ))}
    </div>
  );
}

/** One branch's answer: its rank and score in the branch's own colour, or a quiet "not returned". */
function BranchBadge({ rank, score, tone }: { rank: number | null | undefined; score: number | null | undefined; tone: "active" | "allow" }) {
  const { t } = useTranslation();
  if (score === null || score === undefined) {
    return <Badge tone="neutral">{t("search.notReturned", "not returned")}</Badge>;
  }
  return (
    <Badge tone={tone}>
      {rank === null || rank === undefined ? formatScore(score) : `#${rank} · ${formatScore(score)}`}
    </Badge>
  );
}

function HitInspector({
  hit,
  sourceName,
  closeness,
  distanceScaleEnd: scaleEnd,
  explanation,
  reranked,
}: {
  hit: SearchHit;
  sourceName: string;
  closeness: Closeness | null;
  distanceScaleEnd: number;
  explanation: HitExplanation | null;
  reranked: boolean;
}) {
  const { t } = useTranslation();
  // A keyword-only search reports no separate lexical evidence: the score it was ranked by is the keyword score.
  const keywordRank = hit.match?.lexicalRank ?? null;
  const keywordScore = hit.evidence?.lexicalScore ?? (keywordRank === null ? null : hit.score);
  const citation = hit.citation;
  const lines = linesOf(hit);
  return (
    <Inspector
      label={t("search.selectedHit", "Selected hit")}
      eyebrow={t("search.hitOrigin", "Hit / {origin}", { origin: labelOfCode(ENTRY_ORIGINS, hit.origin) })}
      title={hit.title}
    >
      {citation !== null && (
        <InspectorSection title={t("search.provenance", "Provenance")}>
          <div className={CHIPS}>
            <Badge tone="door">{sourceName}</Badge>
            <Badge tone="neutral">{`v${citation.versionNumber}`}</Badge>
            {lines !== null && <Badge tone="neutral">{lines}</Badge>}
            <Badge tone="neutral">{t("search.chunkNumber", "chunk {chunk}", { chunk: citation.chunkNumber })}</Badge>
            <Badge tone="pipeline">{citation.parserId}</Badge>
          </div>
          <p className={PATH_LINE}>{hit.remote?.path ?? citation.externalId}</p>
          {hit.remote !== undefined && hit.remote !== null && <RemoteOrigin remote={hit.remote} />}
          <span className={DIGEST}>
            <span className="text-muted">SHA-256</span>
            <span className="numeric" title={citation.sha256}>{citation.sha256.slice(0, 16)}…</span>
            <CopyButton value={citation.sha256} label={t("search.copyDigest", "Copy the SHA-256")} />
          </span>
        </InspectorSection>
      )}
      {closeness !== null && (
        <InspectorSection title={t("search.howClose", "How close to the question")}>
          <ClosenessGauge closeness={closeness} distanceScaleEnd={scaleEnd} />
        </InspectorSection>
      )}
      <InspectorSection title={t("search.whyFound", "Why it was found")}>
        {explanation !== null && <FoundBy explanation={explanation} />}
        <ul className={BRANCHES} aria-label={t("search.branches", "How each branch answered")}>
          <li>
            <span className={BRANCH_LABEL}>{t("search.keywordBranch", "Keyword branch")}</span>
            <BranchBadge rank={hit.match?.lexicalRank} score={keywordScore} tone="active" />
          </li>
          <li>
            <span className={BRANCH_LABEL}>{t("search.meaningBranch", "Meaning branch")}</span>
            <BranchBadge rank={hit.match?.semanticRank} score={hit.evidence?.semanticScore} tone="allow" />
          </li>
        </ul>
        <Facts
          rows={[
            ...(explanation !== null && explanation.symbol !== null
              ? ([
                  [
                    t("search.symbolBoost", "Symbol boost"),
                    explanation.symbol === "exact"
                      ? t("search.symbolExact", "names the declaration exactly")
                      : t("search.symbolName", "names the declaration"),
                  ],
                ] as [string, ReactNode][])
              : []),
            ...(reranked && hit.reranked
              ? ([
                  [
                    t("search.rerankMove", "Rerank"),
                    <span className="numeric">
                      {t("search.rerankMoveValue", "{before} → {after} · relevance {relevance}", {
                        before: ordinal(hit.reranked.fusedPosition),
                        after: ordinal(explanation?.after ?? hit.reranked.fusedPosition),
                        relevance: formatScore(hit.reranked.relevance),
                      })}
                    </span>,
                  ],
                ] as [string, ReactNode][])
              : []),
          ]}
        />
        <p className={QUIET_LINE}>
          {t("search.rankedLine", "Ranked by score {score} · entry {entry}", {
            score: <span className="numeric text-ink">{formatScore(hit.score)}</span>,
            entry: <span className="numeric">{`${shortIdentifier(hit.entryId)} · r${hit.entryRevision}`}</span>,
          })}
        </p>
      </InspectorSection>
      <InspectorSection title={t("search.excerpt", "Excerpt")}>
        <HighlightedExcerpt
          className={INSPECTOR_EXCERPT}
          text={hit.excerpt}
          spans={explanation?.spans ?? []}
          truncated={hit.excerptTruncated}
        />
      </InspectorSection>
      {citation !== null && (
        <InspectorSection>
          <InspectorActions>
            <Button href={`/documents/${citation.documentId}?version=${citation.versionId}&lines=${citation.startLine}-${citation.endLine}`} icon="documents">
              {t("search.openDocument", "Open document")}
            </Button>
          </InspectorActions>
        </InspectorSection>
      )}
    </Inspector>
  );
}
