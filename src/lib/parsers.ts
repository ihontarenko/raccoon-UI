// The installed parsers as a workspace sees them — what each reads, what it indexes and keeps for reading
// only, its options, whether it can run here, and which processing profiles send documents to it. Mirrors
// `processing/ParserOverview`. Options are changed on the processing profiles, never here.

import { api, workspacePath } from "./api";
import type { BlockKind } from "./pipeline";

export const AUTOMATIC_PARSER = "automatic";

export type ParserOptionType = "BOOLEAN" | "INTEGER" | "CHOICE" | "CHOICE_LIST" | "TEXT_LIST";

export interface ParserOption {
  name: string;
  type: ParserOptionType;
  defaultValue: boolean | number | string | string[];
  minimum: number | null;
  maximum: number | null;
  choices: string[];
  label: string;
  description: string;
}

export interface ParserDescriptor {
  name: string;
  summary: string;
  mediaTypes: string[];
  extensions: string[];
  indexed: string;
  keptForReading: string;
  options: ParserOption[];
  /** The kinds of block it hands the chunk step; a structural parser falling back to text for one original emits TEXT for it. */
  blockKinds: BlockKind[];
}

export interface ParserAvailability {
  available: boolean;
  reason: string | null;
  detail: string | null;
}

export interface ParserProfileUse {
  profileId: string;
  name: string;
  revision: number;
  enabled: boolean;
  /** One-based place in the profile's automatic order; null when the profile sends every document here. */
  automaticPosition: number | null;
  options: Record<string, unknown>;
}

/** How many versions a parser has read in the workspace. */
export interface ParserReadCount {
  versions: number;
  latest: string | null;
}

export interface Parser {
  identifier: string;
  descriptor: ParserDescriptor;
  availability: ParserAvailability;
  automaticDefault: boolean;
  profiles: ParserProfileUse[];
  reads: ParserReadCount;
}

export interface ParserOverview {
  parsers: Parser[];
  defaultAutomaticOrder: string[];
  profilesTruncated: boolean;
}

export const parsersApi = {
  overview: (workspaceId: string) => api.send<ParserOverview>("GET", workspacePath(workspaceId, "/parsers")),
};

/** An option's value as a short phrase: "on", "off", "6", "eng, ukr". */
export function describeOptionValue(value: unknown): string {
  if (value === true) {
    return "on";
  }
  if (value === false) {
    return "off";
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? "none" : value.join(", ");
  }
  return value === null || value === undefined ? "—" : String(value);
}

/** Whether a value equals the option's default; lists compare in order. */
export function isDefaultValue(option: ParserOption, value: unknown): boolean {
  return JSON.stringify(option.defaultValue) === JSON.stringify(value);
}
