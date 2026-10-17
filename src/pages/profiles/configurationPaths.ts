import type { CatalogueParameter, ProfileConfiguration } from "../../lib/profiles";

// A catalogue names each parameter by its dotted path into the configuration — `retrieval.semantic.metric`.
// These read and write a value at such a path without mutating the configuration they were given.

export function valueAt(configuration: ProfileConfiguration, path: string): unknown {
  let current: unknown = configuration;
  for (const segment of path.split(".")) {
    if (current === null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function withValueAt(configuration: ProfileConfiguration, path: string, value: unknown): ProfileConfiguration {
  const [head, ...rest] = path.split(".");
  if (head === undefined) {
    return configuration;
  }
  if (rest.length === 0) {
    return { ...configuration, [head]: value };
  }
  const child = configuration[head];
  const childObject = child !== null && typeof child === "object" && !Array.isArray(child) ? (child as ProfileConfiguration) : {};
  return { ...configuration, [head]: withValueAt(childObject, rest.join("."), value) };
}

/** The section a parameter belongs to: everything but its last segment, or "" for a top-level one. */
export function sectionOf(path: string): string {
  const index = path.lastIndexOf(".");
  return index < 0 ? "" : path.slice(0, index);
}

/** The value a fresh editor starts from: the catalogue's suggestion, or the first choice, or empty (no limit). */
export function startingValue(parameter: CatalogueParameter): unknown {
  if (parameter.suggestion !== null && parameter.suggestion !== undefined) {
    return parameter.suggestion;
  }
  switch (parameter.type) {
    case "BOOLEAN":
      return false;
    case "DECIMAL":
      // A decimal the catalogue suggests nothing for is an optional ceiling — maximum distance, maximum
      // question cost — and empty means "no limit". Starting it at its minimum, 0, meant "match only
      // identical vectors" and "admit only free calls": switching meaning search on made it never work.
      return null;
    case "INTEGER":
      return parameter.minimum ?? 0;
    case "CHOICE":
      return parameter.choices[0] ?? "";
    case "CHOICE_LIST":
    case "UUID_LIST":
    case "TEXT_LIST":
      return [];
    case "OBJECT":
    case "URI":
      return null;
    default:
      return "";
  }
}

/** A configuration built from the catalogue alone, for a profile that does not exist yet. */
export function startingConfiguration(parameters: CatalogueParameter[], skippedSections: readonly string[] = []): ProfileConfiguration {
  let configuration: ProfileConfiguration = {};
  for (const parameter of parameters) {
    const section = sectionOf(parameter.path);
    if (skippedSections.some((skipped) => section === skipped || section.startsWith(`${skipped}.`))) {
      continue;
    }
    configuration = withValueAt(configuration, parameter.path, startingValue(parameter));
  }
  return configuration;
}

/** Fills a section the configuration holds as null, so the person can switch it on and edit it. */
export function withSectionFilled(configuration: ProfileConfiguration, section: string, parameters: CatalogueParameter[]): ProfileConfiguration {
  let next = withValueAt(configuration, section, {});
  for (const parameter of parameters.filter((candidate) => sectionOf(candidate.path) === section)) {
    next = withValueAt(next, parameter.path, startingValue(parameter));
  }
  return next;
}
