import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { profileKind, type Profile, type ProfileKind } from "../../lib/profiles";
import { useTranslation } from "../../translations/TranslationProvider";
import { declareText, type DeclaredText } from "../../translations/translate";
import { Badge, Field, Icon, Select, Table } from "../../ui/primitives";
import { ProfileFlow, planFor } from "./ProfileFlow";
import {
  answerWriter,
  embeddingOfSearch,
  hasRerank,
  rerankVerdict,
  isEnabled,
  embeddingSource,
  searchMode,
  stateOf,
  usedBy,
  usesVectors,
  vectorsVerdict,
  type ProfileWiring,
  type Verdict,
} from "./profileWiring";
import { CELL_STACK, CONNECTIONS, CONNECTIONS_BODY, CONNECTIONS_MAIN, FLOW_EXPLORER, FLOW_EXPLORER_HEAD, GUIDE, GUIDE_LINK, GUIDE_STEPS, PLAIN_LIST, PROBLEM, PROFILE_LINK, SECTION_HEADING, STAGE, STAGE_STRIP, STAGE_ARROW, STAGE_LINK, STAGE_NAME, STAGE_ROLE, SUB_HEADING, TABLE_SURFACE } from "./profilesClasses";

/** The order work flows through the profiles; read profiles feed context, so they sit beside it. */
const STAGES: { kind: ProfileKind; role: DeclaredText }[] = [
  {
    kind: "processing",
    role: declareText("profiles.connections.role.processing", "cuts originals into chunks and keyword-indexes them"),
  },
  {
    kind: "embedding",
    role: declareText("profiles.connections.role.embedding", "turns chunks into vectors with one AI provider and model"),
  },
  {
    kind: "search",
    role: declareText(
      "profiles.connections.role.search",
      "finds by keywords, by one embedding profile's vectors, or both — and may rerank them",
    ),
  },
  {
    kind: "context",
    role: declareText("profiles.connections.role.context", "turns hits into verified passages, reading with a read profile"),
  },
  {
    kind: "answer",
    role: declareText("profiles.connections.role.answer", "writes an answer from one search and one context, with a chat model"),
  },
];

/**
 * How the workspace's profiles connect, drawn from the profiles that exist: one row per search profile —
 * where its vectors come from, whether any are published for that model, and which answers go through
 * it — with every link judged blue when it works and red when it cannot, and why.
 */
export function ProfileConnections({ wiring }: { wiring: ProfileWiring }) {
  const { t, say } = useTranslation();
  const searches = wiring.profiles.search;
  const unreadEmbeddings = wiring.profiles.embedding.filter((embedding) => usedBy(wiring, "embedding", embedding.id).length === 0);

  return (
    <div className={CONNECTIONS}>
      <ol className={STAGE_STRIP} aria-label={t("profiles.connections.flowLabel", "How work flows through the profiles")}>
        {STAGES.map((stage, index) => {
          return (
            <li key={stage.kind} className={STAGE}>
              <Link to="/profiles" search={{ kind: stage.kind }} className={STAGE_LINK}>
                <span className={STAGE_NAME}>
                  {say(profileKind(stage.kind).name)} <span className="numeric text-xs text-muted">{wiring.profiles[stage.kind].length}</span>
                </span>
                <span className={STAGE_ROLE}>{say(stage.role)}</span>
              </Link>
              {index < STAGES.length - 1 && (
                <span className={STAGE_ARROW} aria-hidden="true">
                  <Icon name="arrow" size="small" />
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <FlowExplorer wiring={wiring} />

      <div className={CONNECTIONS_BODY}>
        <section className={CONNECTIONS_MAIN} aria-labelledby="stacks-title">
          <h2 id="stacks-title" className={SECTION_HEADING}>
            {t("profiles.connections.stacks", "Search stacks")}
          </h2>
          <p className="text-xs text-secondary">
            {t(
              "profiles.connections.stacksLead",
              "Each search profile is one stack: what it finds by, whose vectors it reads, and the answers that go through it.",
            )}
          </p>
          {searches.length === 0 ? (
            <p className="text-xs text-muted">
              {t("profiles.connections.noSearch", "No search profile yet — nothing can be searched or answered.")}
            </p>
          ) : (
            <div className={TABLE_SURFACE}>
              <Table>
                <thead>
                  <tr>
                    <th scope="col">{t("profiles.connections.column.search", "Search profile")}</th>
                    <th scope="col">{t("profiles.connections.column.findsBy", "Finds by")}</th>
                    <th scope="col">{t("profiles.connections.column.vectorsFrom", "Vectors from")}</th>
                    <th scope="col">{t("profiles.connections.column.reranksWith", "Reranks with")}</th>
                    <th scope="col">{t("profiles.connections.column.answers", "Answers through it")}</th>
                    <th scope="col">{t("profiles.list.state", "State")}</th>
                  </tr>
                </thead>
                <tbody>
                  {searches.map((search) => (
                    <StackRow key={search.id} wiring={wiring} search={search} />
                  ))}
                </tbody>
              </Table>
            </div>
          )}

          {unreadEmbeddings.length > 0 && (
            <>
              <h3 className={SUB_HEADING}>{t("profiles.connections.unreadEmbeddings", "Embedding profiles no search reads")}</h3>
              <ul className={PLAIN_LIST}>
                {unreadEmbeddings.map((embedding) => (
                  <li key={embedding.id}>
                    <ProfileName kind="embedding" profile={embedding} />
                    <span className="text-xs text-secondary"> — {embeddingSource(wiring, embedding)}</span>{" "}
                    <VerdictBadge verdict={vectorsVerdict(wiring, embedding)} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <SideBySideGuide />
      </div>
    </div>
  );
}

/**
 * Pick any search or answer profile and see what a request through it does right now — which stages run,
 * which fall back, which cannot — and the setting behind each. Answers come first: they include a search.
 */
function FlowExplorer({ wiring }: { wiring: ProfileWiring }) {
  const { t } = useTranslation();
  const answers = wiring.profiles.answer;
  const searches = wiring.profiles.search;
  const first = answers[0] !== undefined ? `answer:${answers[0].id}` : searches[0] !== undefined ? `search:${searches[0].id}` : "";
  const [chosen, setChosen] = useState(first);
  const [kind, profileId] = chosen.split(":") as ["search" | "answer", string];
  const profile = chosen === "" ? null : (wiring.profiles[kind].find((candidate) => candidate.id === profileId) ?? null);
  if (first === "") {
    return null;
  }
  return (
    <section className={FLOW_EXPLORER} aria-labelledby="flow-explorer-title">
      <div className={FLOW_EXPLORER_HEAD}>
        <h2 id="flow-explorer-title" className={SECTION_HEADING}>
          {t("profiles.connections.explorer", "What a request will do")}
        </h2>
        <Field label={t("profiles.connections.through", "Through")}>
          <Select value={chosen} onChange={(event) => setChosen(event.target.value)}>
            {answers.length > 0 && (
              <optgroup label={t("profiles.connections.answerGroup", "Answer profiles — question to answer")}>
                {answers.map((answer) => (
                  <option key={answer.id} value={`answer:${answer.id}`}>
                    {answer.name}
                  </option>
                ))}
              </optgroup>
            )}
            {searches.length > 0 && (
              <optgroup label={t("profiles.connections.searchGroup", "Search profiles — question to hits")}>
                {searches.map((search) => (
                  <option key={search.id} value={`search:${search.id}`}>
                    {search.name}
                  </option>
                ))}
              </optgroup>
            )}
          </Select>
        </Field>
      </div>
      {profile !== null && <ProfileFlow plan={planFor(wiring, kind, profile)} headingLevel={3} title={t("profiles.connections.throughProfile", "Through {name}", { name: profile.name })} />}
    </section>
  );
}

function StackRow({ wiring, search }: { wiring: ProfileWiring; search: Profile }) {
  const { t } = useTranslation();
  const state = stateOf(wiring, "search", search);
  const embedding = usesVectors(search) ? embeddingOfSearch(wiring, search) : null;
  const answers = usedBy(wiring, "search", search.id);
  return (
    <tr>
      <td>
        <ProfileName kind="search" profile={search} />
      </td>
      <td className="text-xs">{searchMode(search)}</td>
      <td className="wraps">
        {!usesVectors(search) ? (
          <span className="text-xs text-muted">{t("profiles.connections.noVectors", "No vectors — keywords only")}</span>
        ) : embedding === null ? (
          <VerdictBadge verdict={{ tone: "deny", text: t("profiles.kinds.embedding.none", "No embedding profile") }} />
        ) : (
          <div className={CELL_STACK}>
            <ProfileName kind="embedding" profile={embedding} />
            <span className="text-xs text-secondary">{embeddingSource(wiring, embedding)}</span>
            <VerdictBadge verdict={vectorsVerdict(wiring, embedding)} />
          </div>
        )}
      </td>
      <td className="wraps">
        {!hasRerank(search) ? (
          <span className="text-xs text-muted">{t("profiles.connections.noRerank", "No rerank — fused order")}</span>
        ) : (
          <div className={CELL_STACK}>
            <VerdictBadge verdict={rerankVerdict(wiring, search)} />
            {rerankVerdict(wiring, search).tone === "deny" && (
              <span className="text-xs text-secondary">{t("profiles.connections.rerankFallsBack", "Falls back to the fused order")}</span>
            )}
          </div>
        )}
      </td>
      <td className="wraps">
        {answers.length === 0 ? (
          <span className="text-xs text-muted">{t("profiles.connections.none", "None")}</span>
        ) : (
          <ul className={PLAIN_LIST}>
            {answers.map((answer) => (
              <li key={answer.profile.id}>
                <ProfileName kind="answer" profile={answer.profile} />
                <span className="text-xs text-secondary"> — {answerWriter(wiring, answer.profile)}</span>
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="wraps">
        <VerdictBadge verdict={state.verdict} />
        {state.problems.map((problem) => (
          <div key={problem} className={PROBLEM}>
            {problem}
          </div>
        ))}
      </td>
    </tr>
  );
}

function ProfileName({ kind, profile }: { kind: ProfileKind; profile: Profile }) {
  const { t } = useTranslation();
  return (
    <Link to="/profiles/$kind/$profileId" params={{ kind, profileId: profile.id }} className={PROFILE_LINK}>
      {profile.name}
      {!isEnabled(profile) && <span className="text-xs text-muted"> {t("profiles.connections.disabled", "(disabled)")}</span>}
    </Link>
  );
}

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return <Badge tone={verdict.tone}>{verdict.text}</Badge>;
}

/**
 * The question this page is asked most, as a task: one stack per AI provider. A stack is chosen by its
 * search profile, so two providers side by side are two embedding profiles, each vectorised and each
 * read by its own search profile.
 */
function SideBySideGuide() {
  const { t, say } = useTranslation();
  return (
    <aside className={GUIDE} aria-labelledby="guide-title">
      <h2 id="guide-title" className={SECTION_HEADING}>
        {t("profiles.connections.guide.title", "Two AI providers side by side")}
      </h2>
      <p className="text-xs text-secondary">
        {t(
          "profiles.connections.guide.lead",
          "Vectors from different models cannot be compared, so each provider gets its own stack, and a search picks the stack.",
        )}
      </p>
      <ol className={GUIDE_STEPS}>
        <li>
          <strong>{t("profiles.connections.guide.inForce", "Put both providers in force.")}</strong>
          <span>
            {t(
              "profiles.connections.guide.inForceDetail",
              "Give each configuration its own {purpose} — putting one in force takes any other with the same purpose out of force.",
              { purpose: <em>{t("profiles.connections.guide.purpose", "purpose")}</em> },
            )}
          </span>
          <Link to="/administration/$section" params={{ section: "providers" }} className={GUIDE_LINK}>
            {t("profiles.connections.guide.providers", "AI providers")}
          </Link>
        </li>
        <li>
          <strong>{t("profiles.connections.guide.embedding", "One embedding profile per provider.")}</strong>
          <span>
            {t("profiles.connections.guide.embeddingDetail", "Each names its provider and model; its vectors belong to that model only.")}
          </span>
          <Link to="/profiles/$kind/$profileId" params={{ kind: "embedding", profileId: "new" }} className={GUIDE_LINK}>
            {say(profileKind("embedding").newProfile)}
          </Link>
        </li>
        <li>
          <strong>{t("profiles.connections.guide.vectorise", "Vectorise with each.")}</strong>
          <span>
            {t(
              "profiles.connections.guide.vectoriseDetail",
              "Choose the embedding profile when you vectorise; the documents stay the same, the vectors differ.",
            )}
          </span>
          <Link to="/index" search={{ tab: "vectors" }} className={GUIDE_LINK}>
            {t("profiles.connections.guide.generations", "Vector generations")}
          </Link>
        </li>
        <li>
          <strong>{t("profiles.connections.guide.search", "One search profile per embedding profile.")}</strong>
          <span>
            {t(
              "profiles.connections.guide.searchDetail",
              "Set it to find by vectors or by keywords and vectors, and choose that embedding profile; an answer profile then names the search profile.",
            )}
          </span>
          <Link to="/profiles/$kind/$profileId" params={{ kind: "search", profileId: "new" }} className={GUIDE_LINK}>
            {say(profileKind("search").newProfile)}
          </Link>
        </li>
      </ol>
      <p className="text-xs text-muted">
        {t(
          "profiles.connections.guide.choose",
          "Search and Ask let you choose the search or answer profile, so each question goes to the stack you pick.",
        )}
      </p>
    </aside>
  );
}
