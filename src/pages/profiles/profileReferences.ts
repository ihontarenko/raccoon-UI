import { api, collectAllPages, pageQuery, workspacePath } from "../../lib/api";
import type { AiCapability, ProviderConfiguration } from "../../lib/ai";
import type { ProfileKind } from "../../lib/profiles";
import { translate } from "../../translations/translate";
import {
  embeddingSource,
  inForce,
  isEnabled,
  providerLabel,
  providerVerdict,
  searchMode,
  stateOf,
  vectorsVerdict,
  type ProfileWiring,
  type Verdict,
} from "./profileWiring";

// A profile names other things by identifier — a provider configuration, another profile, script
// groups. The editor offers those as choices by name; a list the caller may not read is simply absent,
// and its field falls back to plain text rather than failing the whole editor. Each choice also says
// what it is and whether it works, so choosing an embedding profile shows its provider and its vectors.

export interface ReferenceOption {
  value: string;
  label: string;
  /** Short, inside the option itself. */
  note?: string;
  /** Under the field once chosen: what this choice brings with it. */
  detail?: string;
  /** Under the field once chosen: whether it works now. */
  verdict?: Verdict;
}

export interface ProfileReferences {
  providers: ProviderConfiguration[];
  /** Keyed by the parameter's last path segment: `embeddingProfileId`, `scriptGroupIds`. */
  options: Record<string, ReferenceOption[]>;
}

interface ScriptGroup {
  id: string;
  name: string;
  revision: number;
}

/** Which capability a provider needs to be offered in each kind's provider field. */
const PROVIDER_CAPABILITY: Partial<Record<ProfileKind, AiCapability>> = { embedding: "EMBEDDINGS", search: "RERANK", answer: "CHAT" };

/** Which other profiles each kind refers to, by field. */
const PROFILE_FIELDS: Partial<Record<ProfileKind, Partial<Record<string, ProfileKind>>>> = {
  search: { embeddingProfileId: "embedding" },
  context: { readProfileId: "read" },
  answer: { searchProfileId: "search", contextProfileId: "context" },
};

function revisionNote(revision: number): string {
  return translate("profiles.references.revision", "revision {revision}", { revision });
}

async function orNothing<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch {
    return null;
  }
}

export async function loadProfileReferences(workspaceId: string, kind: ProfileKind, wiring: ProfileWiring): Promise<ProfileReferences> {
  const options: Record<string, ReferenceOption[]> = {};
  const capability = PROVIDER_CAPABILITY[kind];
  const groups = await orNothing(() => collectAllPages((page) => api.send<ScriptGroup[]>("GET", workspacePath(workspaceId, `/script-groups?${pageQuery(page)}`))));

  const providers = wiring.providers ?? [];
  if (wiring.providers !== null && capability !== undefined) {
    options.providerConfigurationId = providers
      .filter((provider) => provider.capabilities.includes(capability))
      .map((provider) => ({
        value: provider.id,
        label: providerLabel(provider),
        note: [
          provider.active ? inForce() : translate("profiles.references.notInForce", "not in force"),
          provider.purpose === null ? null : translate("profiles.references.purpose", "purpose {purpose}", { purpose: provider.purpose }),
        ]
          .filter(Boolean)
          .join(", "),
        detail:
          provider.purpose === null
            ? translate("profiles.references.noPurpose", "No purpose set.")
            : translate(
                "profiles.references.purposeDetail",
                "Purpose “{purpose}” — putting another configuration with the same purpose in force takes this one out.",
                { purpose: provider.purpose },
              ),
        verdict: providerVerdict(wiring, provider.id, capability),
      }));
  }
  if (groups !== null) {
    options.scriptGroupIds = groups.map((group) => ({ value: group.id, label: group.name, note: revisionNote(group.revision) }));
  }

  for (const [field, otherKind] of Object.entries(PROFILE_FIELDS[kind] ?? {})) {
    if (otherKind === undefined) {
      continue;
    }
    options[field] = wiring.profiles[otherKind].map((profile) => {
      const state = stateOf(wiring, otherKind, profile);
      const option: ReferenceOption = {
        value: profile.id,
        label: profile.name,
        note: isEnabled(profile) ? revisionNote(profile.revision) : translate("profiles.references.disabled", "disabled"),
        verdict: state.problems.length > 0 ? { tone: "deny", text: state.problems[0] ?? state.verdict.text } : state.verdict,
      };
      if (otherKind === "embedding") {
        option.detail = translate(
          "profiles.references.vectorsMadeBy",
          "Vectors made by {source}. This search finds only those vectors.",
          { source: embeddingSource(wiring, profile) },
        );
        const vectors = vectorsVerdict(wiring, profile);
        option.verdict = state.verdict.tone === "deny" ? option.verdict : vectors;
      }
      if (otherKind === "search") {
        option.detail = translate("profiles.references.findsBy", "Finds by {mode}.", { mode: searchMode(profile).toLowerCase() });
      }
      return option;
    });
  }

  return { providers, options };
}
