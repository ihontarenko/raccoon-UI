import { ApiError } from "../lib/api";
import { declareText, translateDeclared, type DeclaredText } from "../translations/translate";

// Every failure the interface can show — a refused request, a missing record, a server that is
// down, or a bug in the interface itself — is classified here into one problem kind, so error pages,
// inline problem states and toasts all describe the same failure the same way.

export type ProblemKind =
  "not-found" | "refused" | "invalid" | "conflict" | "unavailable" | "not-available" | "server" | "interface" | "stale-interface";

/**
 * Whether a failure is the browser asking for part of an interface that is no longer served — a module import that
 * 404s after a new version was deployed or the dev server restarted. Every engine words it differently, so the test
 * is over the words they share.
 */
function isStaleModule(error: TypeError): boolean {
  const said = error.message.toLowerCase();
  return said.includes("dynamically imported module")
      || said.includes("importing a module script failed")
      || said.includes("error loading dynamically imported module")
      || said.includes("failed to fetch dynamically imported module");
}

export interface Problem {
  kind: ProblemKind;
  title: string;
  description: string;
  /** The server's own words, when it gave any; shown beneath the general description. */
  detail: string | null;
  status: number | null;
}

// Declared, and rendered in the viewer's language each time a problem is described.
const DESCRIPTIONS: Record<ProblemKind, { title: DeclaredText; description: DeclaredText }> = {
  "not-found": {
    title: declareText("problems.notFound.title", "Not found"),
    description: declareText("problems.notFound.description", "This page or record does not exist, or it was removed."),
  },
  refused: {
    title: declareText("problems.refused.title", "Access refused"),
    description: declareText("problems.refused.description", "Your account does not have permission to open this."),
  },
  invalid: {
    title: declareText("problems.invalid.title", "Request rejected"),
    description: declareText("problems.invalid.description", "The server rejected the values that were sent."),
  },
  conflict: {
    title: declareText("problems.conflict.title", "Changed elsewhere"),
    description: declareText(
      "problems.conflict.description",
      "Someone changed this record in the meantime. Reload it and try again.",
    ),
  },
  unavailable: {
    title: declareText("problems.unavailable.title", "Server unreachable"),
    description: declareText(
      "problems.unavailable.description",
      "The Raccoon server did not answer. Check that it is running, then try again.",
    ),
  },
  "not-available": {
    title: declareText("problems.notAvailable.title", "Not available right now"),
    description: declareText(
      "problems.notAvailable.description",
      "The server answered, but this cannot run with the current settings, index or provider limits.",
    ),
  },
  server: {
    title: declareText("problems.server.title", "Server error"),
    description: declareText(
      "problems.server.description",
      "The server failed while handling the request. The failure is logged on the server.",
    ),
  },
  "stale-interface": {
    title: declareText("problems.staleInterface.title", "This page is out of date"),
    description: declareText(
      "problems.staleInterface.description",
      "Part of the interface could not be loaded, because the browser is holding a version that is no longer served. Reload the page: it is served again from scratch, and nothing is lost.",
    ),
  },
  interface: {
    title: declareText("problems.interface.title", "Something broke in the interface"),
    description: declareText(
      "problems.interface.description",
      "An unexpected error stopped this screen from rendering. Reloading usually helps.",
    ),
  },
};

function describedKind(kind: ProblemKind): { title: string; description: string } {
  return {
    title: translateDeclared(DESCRIPTIONS[kind].title),
    description: translateDeclared(DESCRIPTIONS[kind].description),
  };
}

function kindForStatus(status: number): ProblemKind {
  if (status === 404) {
    return "not-found";
  }
  if (status === 401 || status === 403) {
    return "refused";
  }
  if (status === 409 || status === 412) {
    return "conflict";
  }
  if (status === 502 || status === 503 || status === 504) {
    return "unavailable";
  }
  if (status >= 500) {
    return "server";
  }
  return "invalid";
}

export function problemOf(kind: ProblemKind, detail: string | null = null): Problem {
  return { kind, ...describedKind(kind), detail, status: null };
}

export function describeProblem(error: unknown): Problem {
  if (error instanceof ApiError) {
    // The default framework body only repeats the status phrase, which adds nothing to the title.
    const detail = error.message.startsWith("Request failed") || error.message === "Service Unavailable" ? null : error.message;
    // A 503 that carries Raccoon's own words was answered: something refused, nothing is down.
    const kind = error.status === 503 && detail !== null ? "not-available" : kindForStatus(error.status);
    return { kind, ...describedKind(kind), detail, status: error.status };
  }
  /*
   * ⚠️ A page that could not be fetched is not a server that is down, and saying so sends somebody to look at a
   * server that is running. A route's component is imported when the route is first opened, and that import fails
   * with a TypeError too — after a deployment, after the dev server restarted, whenever the browser holds a module
   * graph the server no longer serves. The one thing that fixes it is a reload, which is exactly what the interface
   * kind offers; "Try again" re-imports the same dead address and fails again, for ever.
   */
  if (error instanceof TypeError && isStaleModule(error)) {
    return problemOf("stale-interface");
  }
  // fetch rejects with a TypeError when the connection itself fails (server down, proxy refused).
  if (error instanceof TypeError) {
    return problemOf("unavailable");
  }
  const detail = error instanceof Error ? error.message : null;
  return problemOf("interface", detail);
}

/**
 * A refusal the server tied to one value — its `field` is that value's path, such as `cutoff` or
 * `questions[2].text` — so a form can show it at the field rather than as a banner. Null for anything else.
 */
export function fieldRefusal(error: unknown): { field: string; sentence: string } | null {
  if (!(error instanceof ApiError) || error.status !== 400) {
    return null;
  }
  const detail = error.detail;
  if (detail === null || typeof detail !== "object") {
    return null;
  }
  const body = detail as Record<string, unknown>;
  if (typeof body.field !== "string" || body.field === "") {
    return null;
  }
  return { field: body.field, sentence: typeof body.detail === "string" ? body.detail : error.message };
}
