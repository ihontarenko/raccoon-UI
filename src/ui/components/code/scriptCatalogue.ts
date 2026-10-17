import type { CatalogueFacade, CompletionCatalogue } from "@jmouse/codemirror/completion";
import type { StageView } from "../../../lib/automation";
import { declareText, translateDeclared, type DeclaredText } from "../../../translations/translate";

/** A facade as it is declared here: its words are keys, read in the viewer's language when a catalogue is built. */
interface DeclaredFacade {
  readonly name: string;
  readonly detail: DeclaredText;
  readonly methods: readonly { name: string; arity: number; detail?: DeclaredText }[];
}

const DECIDES = declareText("components.scriptCatalogue.decides", "decides");
const OBSERVES = declareText("components.scriptCatalogue.observes", "observes");
const SCAN_RULE = declareText("components.scriptCatalogue.scanRule", "scan rule");

function facadeOf(declared: DeclaredFacade): CatalogueFacade {
  return {
    name: declared.name,
    detail: translateDeclared(declared.detail),
    methods: declared.methods.map((method) => ({
      name: method.name,
      arity: method.arity,
      detail: method.detail === undefined ? undefined : translateDeclared(method.detail),
    })),
  };
}

/**
 * The facades a Raccoon script may reach with `@name`, as `automation/ScriptMechanism` registers them.
 *
 * ⚠️ A MIRROR, NOT THE AUTHORITY. Raccoon serves no catalogue endpoint, so the names are copied here and
 * only ever offered — the binder on the server decides whether a script binds when it is saved. A facade
 * added to `ScriptMechanism` must be added here too, or completion simply will not offer it.
 */
const FACADES: DeclaredFacade[] = [
  {
    name: "decision",
    detail: declareText("components.scriptCatalogue.decision", "Refuse the work at a decision stage"),
    methods: [{ name: "refuse", arity: 1, detail: declareText("components.scriptCatalogue.decisionRefuse", "stop it, with the reason") }],
  },
  {
    name: "log",
    detail: declareText("components.scriptCatalogue.log", "Write to the script log"),
    methods: [
      { name: "info", arity: 1, detail: declareText("components.scriptCatalogue.logInformation", "an informational line") },
      { name: "warn", arity: 1, detail: declareText("components.scriptCatalogue.logWarning", "a warning line") },
    ],
  },
  {
    name: "processing",
    detail: declareText("components.scriptCatalogue.processing", "Narrow how a document is prepared"),
    methods: [
      { name: "maximumCodePoints", arity: 1 },
      { name: "overlapCodePoints", arity: 1 },
      { name: "analyzer", arity: 1 },
      { name: "publishAutomatically", arity: 1 },
    ],
  },
  {
    name: "search",
    detail: declareText("components.scriptCatalogue.search", "Narrow a search before it runs"),
    methods: [
      { name: "limit", arity: 1 },
      { name: "excerptCodePoints", arity: 1 },
      { name: "minimumScore", arity: 1 },
      { name: "maximumSemanticDistance", arity: 1 },
      { name: "includeEditorial", arity: 1 },
      { name: "sourceId", arity: 1 },
      { name: "maximumQueryTokens", arity: 1 },
      { name: "mode", arity: 1 },
    ],
  },
  {
    name: "originalRead",
    detail: declareText("components.scriptCatalogue.originalRead", "Narrow an original read"),
    methods: [{ name: "maximumCodePoints", arity: 1 }],
  },
  {
    name: "context",
    detail: declareText("components.scriptCatalogue.context", "Narrow the context assembled for an answer"),
    methods: [
      { name: "maximumCodePoints", arity: 1 },
      { name: "maximumFragments", arity: 1 },
      { name: "neighborRadius", arity: 1 },
      { name: "includeEditorial", arity: 1 },
    ],
  },
  {
    name: "embedding",
    detail: declareText("components.scriptCatalogue.embedding", "Narrow a vectorisation's budget"),
    methods: [
      { name: "maximumTokens", arity: 1 },
      { name: "maximumChunks", arity: 1 },
    ],
  },
  {
    name: "evaluation",
    detail: declareText("components.scriptCatalogue.evaluation", "Narrow an evaluation run"),
    methods: [
      { name: "maximumCalls", arity: 1 },
      { name: "maximumTokens", arity: 1 },
      { name: "maximumSearches", arity: 1 },
      { name: "maximumDurationMilliseconds", arity: 1 },
    ],
  },
  {
    name: "answer",
    detail: declareText("components.scriptCatalogue.answer", "Narrow an answer's model call"),
    methods: [
      { name: "maximumCalls", arity: 1 },
      { name: "maximumOutputTokens", arity: 1 },
      { name: "maximumPromptCodePoints", arity: 1 },
      { name: "maximumResponseBytes", arity: 1 },
    ],
  },
];

/** Events and their variables come live from the server's stage list; the facades from the mirror above. */
export function scriptCatalogue(stages: StageView[], extraVariables: Record<string, string[]> = {}): CompletionCatalogue {
  return {
    facades: FACADES.map(facadeOf),
    events: [
      ...stages.map((stage) => ({
        name: stage.name,
        detail: translateDeclared(stage.timing === "DECISION" ? DECIDES : OBSERVES),
        context: stage.variables,
      })),
      ...Object.entries(extraVariables).map(([name, context]) => ({ name, detail: translateDeclared(SCAN_RULE), context })),
    ],
  };
}
