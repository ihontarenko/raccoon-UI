// Profiles: the versioned settings each stage of the pipeline runs with. Six kinds share one contract —
// list, read, versions, create at revision 0, save at the current revision — and each publishes a
// catalogue of its parameters (path, type, bounds, choices, description), which is what the editor is
// drawn from. See `.scratch/ui-contracts-admin.md` §8 and `.scratch/ui-contracts-pipeline.md` §7, §9.

import { declareText, translateDeclared, type DeclaredText } from "../translations/translate";
import { api, pageQuery, workspacePath, type PageRequest } from "./api";
import type { ParameterType } from "./contracts";

export type ProfileKind = "processing" | "embedding" | "search" | "context" | "read" | "answer";

export interface ProfileKindDescription {
  kind: ProfileKind;
  /** The kind's name, rendered with `say(…)`. */
  name: DeclaredText;
  /** One line: what a profile of this kind decides. */
  decision: DeclaredText;
  /** "New search profile" — a sentence of its own, because a kind's name does not inflect into it in every language. */
  newProfile: DeclaredText;
  /** "No search profile" — likewise its own sentence. */
  noProfile: DeclaredText;
  /** The name in the language held now, for a caller that wants a plain string. */
  readonly label: string;
  /** The decision in the language held now. */
  readonly decides: string;
  /** The route segment under the workspace. */
  segment: string;
  /** Saving a profile that calls a model needs installation-wide write access too. */
  callsModel: boolean;
}

function describeKind(
  description: Omit<ProfileKindDescription, "label" | "decides">,
): ProfileKindDescription {
  return {
    ...description,
    // Read when rendered, never when the module loads, so a change of language reaches every caller.
    get label() {
      return translateDeclared(description.name);
    },
    get decides() {
      return translateDeclared(description.decision);
    },
  };
}

export const PROFILE_KINDS: ProfileKindDescription[] = [
  describeKind({
    kind: "processing",
    name: declareText("profiles.kinds.processing.name", "Processing"),
    decision: declareText(
      "profiles.kinds.processing.decides",
      "How an original is parsed, cut into chunks and written to the keyword index.",
    ),
    newProfile: declareText("profiles.kinds.processing.new", "New processing profile"),
    noProfile: declareText("profiles.kinds.processing.none", "No processing profile"),
    segment: "processing-profiles",
    callsModel: false,
  }),
  describeKind({
    kind: "embedding",
    name: declareText("profiles.kinds.embedding.name", "Embedding"),
    decision: declareText(
      "profiles.kinds.embedding.decides",
      "Which model turns chunks into vectors, at what size, and within which token and cost limits.",
    ),
    newProfile: declareText("profiles.kinds.embedding.new", "New embedding profile"),
    noProfile: declareText("profiles.kinds.embedding.none", "No embedding profile"),
    segment: "embedding-profiles",
    callsModel: true,
  }),
  describeKind({
    kind: "search",
    name: declareText("profiles.kinds.search.name", "Search"),
    decision: declareText(
      "profiles.kinds.search.decides",
      "How a query is matched: keywords, vectors or both, how results are ranked, reranked and cut.",
    ),
    newProfile: declareText("profiles.kinds.search.new", "New search profile"),
    noProfile: declareText("profiles.kinds.search.none", "No search profile"),
    segment: "search-profiles",
    callsModel: true,
  }),
  describeKind({
    kind: "read",
    name: declareText("profiles.kinds.read.name", "Read"),
    decision: declareText(
      "profiles.kinds.read.decides",
      "How much of an original may be read back at once, and whether old versions may be.",
    ),
    newProfile: declareText("profiles.kinds.read.new", "New read profile"),
    noProfile: declareText("profiles.kinds.read.none", "No read profile"),
    segment: "read-profiles",
    callsModel: false,
  }),
  describeKind({
    kind: "context",
    name: declareText("profiles.kinds.context.name", "Context"),
    decision: declareText(
      "profiles.kinds.context.decides",
      "How search hits become verified context: neighbours, merging and size limits.",
    ),
    newProfile: declareText("profiles.kinds.context.new", "New context profile"),
    noProfile: declareText("profiles.kinds.context.none", "No context profile"),
    segment: "context-profiles",
    callsModel: false,
  }),
  describeKind({
    kind: "answer",
    name: declareText("profiles.kinds.answer.name", "Answer"),
    decision: declareText(
      "profiles.kinds.answer.decides",
      "Which search and context feed an answer, which model writes it, and its budget.",
    ),
    newProfile: declareText("profiles.kinds.answer.new", "New answer profile"),
    noProfile: declareText("profiles.kinds.answer.none", "No answer profile"),
    segment: "answer-profiles",
    callsModel: true,
  }),
];

export function profileKind(kind: ProfileKind): ProfileKindDescription {
  const found = PROFILE_KINDS.find((candidate) => candidate.kind === kind);
  if (found === undefined) {
    throw new Error(`Unknown profile kind ${kind}`);
  }
  return found;
}

export function isProfileKind(value: unknown): value is ProfileKind {
  return PROFILE_KINDS.some((candidate) => candidate.kind === value);
}

export type ProfileConfiguration = Record<string, unknown>;

export interface Profile {
  id: string;
  name: string;
  revision: number;
  configuration: ProfileConfiguration;
}

export interface ProfileVersion {
  revision: number;
  configuration: ProfileConfiguration;
}

/** One editable parameter, the same shape whichever kind's catalogue it came from. */
export interface CatalogueParameter {
  path: string;
  /** When a change takes effect, as the server's code: "NEXT_PROCESSING_JOB" — worded through `CHANGE_EFFECTS`. */
  effect: string | null;
  type: ParameterType;
  suggestion: unknown;
  minimum: number | null;
  maximum: number | null;
  choices: string[];
  unit: string | null;
  description: string | null;
}

/** "UNICODE_CODE_POINTS; MUST_BE_LESS_THAN_SIZE" → "unicode code points; must be less than size". */
function words(code: string | undefined): string | null {
  if (code === undefined || code.trim() === "") {
    return null;
  }
  return code.toLowerCase().replace(/_/g, " ");
}

export interface ProfileCatalogue {
  parameters: CatalogueParameter[];
  eventTypes: string[];
  /** Answer profiles ship a starting text for the model's instructions. */
  suggestedInstructions: string | null;
}

interface RawCatalogueParameter {
  path?: string;
  name?: string;
  type: ParameterType;
  suggestedValue?: unknown;
  defaultValue?: unknown;
  minimum: number | null;
  maximum: number | null;
  choices?: string[];
  values?: string[];
  unit?: string;
  description?: string;
  changeEffect?: string;
  effect?: string;
}

function normaliseCatalogue(raw: { parameters?: RawCatalogueParameter[]; eventTypes?: string[]; suggestedInstructions?: string }): ProfileCatalogue {
  return {
    parameters: (raw.parameters ?? []).map((parameter) => ({
      path: parameter.path ?? parameter.name ?? "",
      type: parameter.type,
      suggestion: parameter.suggestedValue ?? parameter.defaultValue ?? null,
      minimum: parameter.minimum,
      maximum: parameter.maximum,
      choices: parameter.choices ?? parameter.values ?? [],
      unit: words(parameter.unit),
      effect: parameter.changeEffect ?? parameter.effect ?? null,
      description: parameter.description ?? null,
    })),
    eventTypes: raw.eventTypes ?? [],
    suggestedInstructions: raw.suggestedInstructions ?? null,
  };
}

const base = (workspaceId: string, kind: ProfileKind) => workspacePath(workspaceId, `/${profileKind(kind).segment}`);

export const profilesApi = {
  list: (workspaceId: string, kind: ProfileKind, page: PageRequest) => api.send<Profile[]>("GET", `${base(workspaceId, kind)}?${pageQuery(page)}`),
  get: (workspaceId: string, kind: ProfileKind, profileId: string) => api.send<Profile>("GET", `${base(workspaceId, kind)}/${profileId}`),
  versions: (workspaceId: string, kind: ProfileKind, profileId: string, page: PageRequest) =>
    api.send<ProfileVersion[]>("GET", `${base(workspaceId, kind)}/${profileId}/versions?${pageQuery(page)}`),
  catalogue: async (workspaceId: string, kind: ProfileKind) => normaliseCatalogue(await api.send("GET", `${base(workspaceId, kind)}/catalogue`)),
  create: (workspaceId: string, kind: ProfileKind, name: string, configuration: ProfileConfiguration) =>
    api.send<Profile>("POST", base(workspaceId, kind), { name, revision: 0, configuration }),
  save: (workspaceId: string, kind: ProfileKind, profile: Profile, name: string, configuration: ProfileConfiguration) =>
    api.send<Profile>("PUT", `${base(workspaceId, kind)}/${profile.id}`, { name, revision: profile.revision, configuration }),
};
