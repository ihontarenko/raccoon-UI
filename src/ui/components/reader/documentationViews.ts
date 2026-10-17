// Which originals can be read as documentation — a page built from the declarations processing recorded — and by
// which builder. This is the one place a language is registered for the [Documentation | Code] switch.

import type { Chunk } from "../../../lib/pipeline";
import { buildJavaDocPage, type JavaDocPage } from "./javaDoc";
import type { ReadingFormat } from "./readingFormat";
import { buildScriptDocPage, type ScriptDocPage } from "./scriptDoc";

/** A documentation page of either family. */
export type DocumentationPage = { family: "java"; page: JavaDocPage } | { family: "script"; page: ScriptDocPage; codeLanguage: string };

/** The code-reader languages each documentation family reads. */
const FAMILIES: Record<string, "java" | "script"> = {
  java: "java",
  typescript: "script",
  tsx: "script",
  javascript: "script",
  jsx: "script",
};

/** The documentation family a format is read as, or null when it has no documentation view. */
export function documentationFamilyOf(format: ReadingFormat): "java" | "script" | null {
  if (format.kind !== "code" || format.language === null) {
    return null;
  }
  return FAMILIES[format.language] ?? null;
}

/** Builds the documentation page of an original from its chunks; null for a format with no documentation view. */
export function buildDocumentationPage(format: ReadingFormat, chunks: Chunk[], sourceText: string | null, documentPath: string | null): DocumentationPage | null {
  const family = documentationFamilyOf(format);
  if (family === "java") {
    return { family, page: buildJavaDocPage(chunks, sourceText) };
  }
  if (family === "script") {
    return { family, page: buildScriptDocPage(chunks, sourceText, documentPath), codeLanguage: format.language ?? "typescript" };
  }
  return null;
}

/** Whether processing recorded no declaration the page could show. */
export function isDocumentationEmpty(documentation: DocumentationPage): boolean {
  if (documentation.family === "java") {
    return documentation.page.types.length === 0 && documentation.page.looseMembers.length === 0;
  }
  return documentation.page.declarations.length === 0 && documentation.page.groups.length === 0;
}
