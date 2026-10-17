import { api } from "../../lib/api";
import type { FileEntry } from "../../lib/files";

/** A document that shares words with the one being read, and which words. */
export interface RelatedDocument {
  documentId: string;
  versionId: string;
  title: string;
  /** The words of the reader's document this one was found by. */
  shared: string[];
  bestScore: number;
}

const MOST_WORDS = 4;
const MOST_RELATED = 6;
const SEARCHED_PER_WORD = 12;
/* Words a file name carries without saying what it is about. */
const EMPTY_WORDS = new Set(["the", "and", "for", "with", "readme", "index", "main", "file", "doc", "docs", "document", "notes", "copy", "new", "old", "draft", "final", "md", "txt", "pdf", "html", "json", "xml", "java", "src"]);

/**
 * The words a document's name is about: «JMOUSE_TELEGRAM_JPA.md» in source «jmouse/api-documentation» is about
 * «telegram» and «jpa» — «jmouse» names the source, not the subject, so it would match everything there.
 */
export function subjectWords(file: Pick<FileEntry, "name">, sourceName: string | null): string[] {
  const dot = file.name.lastIndexOf(".");
  const stem = dot > 0 ? file.name.slice(0, dot) : file.name;
  const sourceWords = new Set(wordsOf(sourceName ?? ""));
  return [...new Set(wordsOf(stem))].filter((word) => word.length > 2 && !EMPTY_WORDS.has(word) && !sourceWords.has(word)).slice(0, MOST_WORDS);
}

function wordsOf(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0);
}

/**
 * Other documents that mention the subject words, best first: each word is searched on its own — a keyword profile
 * wants every word of a query, and one document rarely has all of them — and a document found by more words ranks
 * higher. The reader's own document is left out.
 */
export async function relatedDocuments(workspaceId: string, profileId: string, file: FileEntry, words: string[]): Promise<RelatedDocument[]> {
  const found = new Map<string, RelatedDocument>();
  const responses = await Promise.all(
    words.map((word) => api.search(workspaceId, { profileId, text: word, limit: SEARCHED_PER_WORD }).then((response) => ({ word, response }), () => null)),
  );
  for (const result of responses) {
    if (result === null) {
      continue;
    }
    for (const hit of result.response.hits) {
      const citation = hit.citation;
      if (citation === null || citation.documentId === file.documentId || (hit.group !== undefined && hit.group !== null && hit.group.position > 1)) {
        continue;
      }
      const known = found.get(citation.documentId);
      if (known === undefined) {
        found.set(citation.documentId, { documentId: citation.documentId, versionId: citation.versionId, title: hit.title, shared: [result.word], bestScore: hit.score });
      } else if (!known.shared.includes(result.word)) {
        known.shared.push(result.word);
        known.bestScore = Math.max(known.bestScore, hit.score);
      }
    }
  }
  return [...found.values()]
    .sort((first, second) => second.shared.length - first.shared.length || second.bestScore - first.bestScore)
    .slice(0, MOST_RELATED);
}
