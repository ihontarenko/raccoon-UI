// How close a search result is to its query, read only from numbers the server returned.
//
// A semantic hit carries `evidence.semanticScore`, which the server derives from the native vector
// distance (search/PostgresSemanticRetrieval):
//   COSINE    score = 1 − distance / 2   →  distance = 2 (1 − score), cosine similarity = 1 − distance
//   EUCLIDEAN score = 1 / (1 + distance) →  distance = 1 / score − 1
// For cosine the similarity is the cosine of the angle between the query vector and the result vector,
// so the angle itself is exact — and two sine waves offset by that angle correlate by exactly that
// similarity, which is why the wave picture is a measurement rather than a decoration.
//
// A keyword hit carries a lexical score that is only comparable within one query, so it is shown
// relative to the best keyword score of the same response, never as an absolute closeness.

import type { SearchHit, SearchResponse } from "../../../lib/contracts";
import { currentLocale, translate } from "../../../translations/translate";

/** A measured number with a fixed count of decimals, written the way the viewer's language writes it. */
export function formatDecimal(value: number, digits: number): string {
  return new Intl.NumberFormat(currentLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

export type DistanceMetric = "COSINE" | "EUCLIDEAN";

export interface MeaningCloseness {
  metric: DistanceMetric;
  /** The native distance: 0 is the same vector. */
  distance: number;
  /** Cosine similarity, −1…1; only for cosine. */
  similarity: number | null;
  /** The angle between the two vectors, in degrees; only for cosine. */
  angleDegrees: number | null;
  /** The profile's ceiling: a hit farther than this is left out. Null when the profile sets none. */
  cutOff: number | null;
  withinCutOff: boolean;
}

export interface KeywordCloseness {
  score: number;
  /** Share of the best keyword score among this response's hits, 0…1. */
  relativeToBest: number;
}

export interface Closeness {
  meaning: MeaningCloseness | null;
  keywords: KeywordCloseness | null;
  /** The score the hit was ranked by, and the profile's floor under it. */
  rankingScore: number;
  minimumScore: number;
}

/** The fields of `effective` this view reads, typed where the response leaves them open. */
export function effectiveCutOffs(response: Pick<SearchResponse, "effective">): { minimumScore: number; maximumSemanticDistance: number | null } {
  const minimum = response.effective.minimumScore;
  const maximum = response.effective.maximumSemanticDistance;
  return {
    minimumScore: typeof minimum === "number" ? minimum : 0,
    maximumSemanticDistance: typeof maximum === "number" ? maximum : null,
  };
}

export function distanceOf(metric: DistanceMetric, semanticScore: number): number {
  if (metric === "COSINE") {
    return Math.max(0, Math.min(2, 2 * (1 - semanticScore)));
  }
  return semanticScore > 0 ? 1 / semanticScore - 1 : Number.POSITIVE_INFINITY;
}

/** The keyword score a hit was found by: its evidence, or — for a keyword-only search — the score itself. */
function keywordScoreOf(hit: SearchHit, keywordOnly: boolean): number | null {
  if (hit.evidence !== null && hit.evidence.lexicalScore !== null) {
    return hit.evidence.lexicalScore;
  }
  return keywordOnly ? hit.score : null;
}

/** Every hit's closeness, computed together so keyword scores share one reference: the best of them. */
export function closenessOfHits(response: Pick<SearchResponse, "hits" | "retrieval" | "effective">): Closeness[] {
  const { minimumScore, maximumSemanticDistance } = effectiveCutOffs(response);
  const metric = response.retrieval.metric ?? null;
  const keywordOnly = response.retrieval.effectiveMode === "LEXICAL";
  const keywordScores = response.hits.map((hit) => keywordScoreOf(hit, keywordOnly));
  const bestKeyword = Math.max(0, ...keywordScores.filter((score): score is number => score !== null));
  return response.hits.map((hit, index) => {
    const semanticScore = hit.evidence?.semanticScore ?? null;
    let meaning: MeaningCloseness | null = null;
    if (semanticScore !== null && metric !== null) {
      const distance = distanceOf(metric, semanticScore);
      const similarity = metric === "COSINE" ? 1 - distance : null;
      meaning = {
        metric,
        distance,
        similarity,
        angleDegrees: similarity === null ? null : (Math.acos(Math.max(-1, Math.min(1, similarity))) * 180) / Math.PI,
        cutOff: maximumSemanticDistance,
        withinCutOff: maximumSemanticDistance === null || distance <= maximumSemanticDistance,
      };
    }
    const keywordScore = keywordScores[index] ?? null;
    return {
      meaning,
      keywords: keywordScore === null ? null : { score: keywordScore, relativeToBest: bestKeyword > 0 ? keywordScore / bestKeyword : 0 },
      rankingScore: hit.score,
      minimumScore,
    };
  });
}

/** The end of the distance axis: past every hit and the cut-off, on a round value, never past cosine's 2. */
export function distanceScaleEnd(closenesses: Closeness[], metric: DistanceMetric): number {
  const largest = Math.max(
    0.1,
    ...closenesses.flatMap((closeness) => (closeness.meaning === null ? [] : [closeness.meaning.distance, closeness.meaning.cutOff ?? 0])),
  );
  const padded = largest * 1.2;
  const step = padded <= 0.5 ? 0.1 : padded <= 1 ? 0.2 : 0.5;
  const end = Math.ceil(padded / step) * step;
  return metric === "COSINE" ? Math.min(2, end) : end;
}

/** One line a screen reader — and anyone without colour — reads instead of the picture. */
export function describeCloseness(closeness: Closeness): string {
  const parts: string[] = [];
  if (closeness.meaning !== null) {
    const meaning = closeness.meaning;
    parts.push(
      meaning.similarity !== null && meaning.angleDegrees !== null
        ? translate("closeness.describe.similarity", "meaning: similarity {similarity}, {angle}° apart", {
            similarity: formatDecimal(meaning.similarity, 2),
            angle: Math.round(meaning.angleDegrees),
          })
        : translate("closeness.describe.distance", "meaning: distance {distance}", {
            distance: formatDecimal(meaning.distance, 2),
          }),
    );
    if (meaning.cutOff !== null) {
      parts.push(
        meaning.withinCutOff
          ? translate("closeness.describe.withinCutOff", "within the cut-off {cutOff}", { cutOff: formatDecimal(meaning.cutOff, 2) })
          : translate("closeness.describe.beyondCutOff", "beyond the cut-off {cutOff}", { cutOff: formatDecimal(meaning.cutOff, 2) }),
      );
    }
  }
  if (closeness.keywords !== null) {
    parts.push(
      translate("closeness.describe.keywords", "keywords: {percent}% of the best match", {
        percent: Math.round(closeness.keywords.relativeToBest * 100),
      }),
    );
  }
  if (parts.length === 0) {
    parts.push(translate("closeness.describe.score", "score {score}", { score: formatDecimal(closeness.rankingScore, 3) }));
  }
  return parts.join(" · ");
}
