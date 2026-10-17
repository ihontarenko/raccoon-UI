// Why a search hit was found, read only from what the server returned with it.
//
// The server attaches `match` to every hit: the query terms its keyword index contains, where they fall in
// the excerpt, the place each retrieval branch gave it, and the symbol boost. The rerank stage adds where
// fusion had put the hit before the model moved it. Nothing here is estimated — a missing field means the
// stage did not run or the server predates the field, and the view says so rather than guessing.

import type { HitTermSpan, SearchHit, SearchResponse } from "../../../lib/contracts";

export type Stage = "keyword" | "meaning";

export interface StageContribution {
  stage: Stage;
  /** One-based place in that branch's own order; null when only the score says the branch saw it. */
  rank: number | null;
}

export type SymbolMatch = "exact" | "name" | null;

export interface HitExplanation {
  stages: StageContribution[];
  symbol: SymbolMatch;
  matchedTerms: string[];
  /** Query terms the hit's keyword index does not contain. */
  missingTerms: string[];
  /** Matched terms that occur in the index entry but not in the returned excerpt. */
  termsBeyondExcerpt: string[];
  spans: HitTermSpan[];
  /** Where the hit stood before reranking, one-based; equal to `after` when nothing reordered it. */
  before: number;
  after: number;
  /** Positive when the rerank model moved it up. */
  movement: number;
  /** Whether the server sent a match explanation at all. */
  explained: boolean;
  /** The part recognised in the query that identifies this hit's document, or null. */
  recognizedPart: string | null;
  /** Recognised query symbols the hit's text contains exactly. */
  recognizedSymbols: string[];
}

export function explainHit(hit: SearchHit, index: number, response: Pick<SearchResponse, "queryTerms" | "retrieval">): HitExplanation {
  const match = hit.match ?? null;
  const stages: StageContribution[] = [];
  const keywordOnly = response.retrieval.effectiveMode === "LEXICAL";
  const keywordRank = match?.lexicalRank ?? null;
  const meaningRank = match?.semanticRank ?? null;
  if (keywordRank !== null || (hit.evidence?.lexicalScore ?? null) !== null || (keywordOnly && match === null)) {
    stages.push({ stage: "keyword", rank: keywordRank });
  }
  if (meaningRank !== null || (hit.evidence?.semanticScore ?? null) !== null) {
    stages.push({ stage: "meaning", rank: meaningRank });
  }
  const matchedTerms = match?.matchedTerms ?? [];
  const spans = match?.spans ?? [];
  const inExcerpt = new Set(spans.map((span) => span.term));
  const matched = new Set(matchedTerms);
  const after = index + 1;
  const before = hit.reranked?.fusedPosition ?? after;
  return {
    stages,
    symbol: match?.symbolMatch === 2 ? "exact" : match?.symbolMatch === 1 ? "name" : null,
    matchedTerms,
    missingTerms: match === null ? [] : (response.queryTerms ?? []).filter((term) => !matched.has(term)),
    termsBeyondExcerpt: matchedTerms.filter((term) => !inExcerpt.has(term)),
    spans,
    before,
    after,
    movement: before - after,
    explained: match !== null,
    recognizedPart: match?.recognizedPart ?? null,
    recognizedSymbols: match?.recognizedSymbols ?? [],
  };
}

export interface TermPresence {
  term: string;
  /** How many of the returned hits contain the term in their keyword index. */
  hits: number;
}

/** Each query term and how many hits contain it — the query's own vocabulary, measured against the result. */
export function termPresence(response: Pick<SearchResponse, "queryTerms" | "hits">): TermPresence[] {
  return (response.queryTerms ?? []).map((term) => ({
    term,
    hits: response.hits.filter((hit) => hit.match?.matchedTerms.includes(term) ?? false).length,
  }));
}

export interface ExcerptPiece {
  text: string;
  term: string | null;
}

/** The excerpt cut at its matched-term spans, in order; overlapping or out-of-range spans are dropped. */
export function piecesOf(text: string, spans: HitTermSpan[]): ExcerptPiece[] {
  const ordered = [...spans].sort((left, right) => left.start - right.start);
  const pieces: ExcerptPiece[] = [];
  let cursor = 0;
  for (const span of ordered) {
    if (span.start < cursor || span.end > text.length || span.end <= span.start) {
      continue;
    }
    if (span.start > cursor) {
      pieces.push({ text: text.slice(cursor, span.start), term: null });
    }
    pieces.push({ text: text.slice(span.start, span.end), term: span.term });
    cursor = span.end;
  }
  if (cursor < text.length) {
    pieces.push({ text: text.slice(cursor), term: null });
  }
  return pieces;
}
