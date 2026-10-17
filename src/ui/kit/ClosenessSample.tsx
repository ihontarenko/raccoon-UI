import { useMemo, useState } from "react";
import type { SearchHit, SearchResponse } from "../../lib/contracts";
import { declareText, type DeclaredText } from "../../translations/translate";
import { useTranslation } from "../../translations/TranslationProvider";
import { ClosenessGauge, ClosenessOverview, HitCloseness, closenessOfHits, distanceScaleEnd } from "../components";
import {
  CLOSENESS_ROW,
  INSTRUMENT_PANEL,
  SAMPLE_ROWS,
  SAMPLE_STAGE,
  SAMPLE_SURFACE,
} from "./kitClasses";

/** A hybrid cosine search as the server reports it: semantic scores are 1 − distance / 2, keyword scores raw. */
const SAMPLE_SCORES: { title: DeclaredText; semantic: number | null; keyword: number | null }[] = [
  { title: declareText("uiKit.closenessSample.agentCredentials", "Agent credentials and scope"), semantic: 0.94, keyword: 0.62 },
  { title: declareText("uiKit.closenessSample.toolCalls", "Tool calls run as the caller"), semantic: 0.91, keyword: null },
  { title: declareText("uiKit.closenessSample.consentScreen", "Consent screen"), semantic: 0.83, keyword: 0.41 },
  { title: declareText("uiKit.closenessSample.keywordOnly", "Keyword-only match"), semantic: null, keyword: 0.55 },
  { title: declareText("uiKit.closenessSample.rateLimits", "Rate limits"), semantic: 0.71, keyword: null },
];

function sampleResponse(): Pick<SearchResponse, "hits" | "retrieval" | "effective"> {
  const hits = SAMPLE_SCORES.map(
    (sample, index): SearchHit => ({
      entryId: `sample-${index}`,
      entryRevision: 1,
      origin: "DERIVED",
      linkedEntryId: null,
      title: sample.title.fallback,
      score: Math.max(sample.semantic ?? 0, sample.keyword ?? 0),
      excerpt: "",
      excerptTruncated: false,
      citation: null,
      evidence: {
        lexicalScore: sample.keyword,
        semanticScore: sample.semantic,
        vectorGenerationId: null,
        vectorRecordId: null,
        vectorOrigin: null,
        vectorRecordRevision: null,
      },
    }),
  );
  return {
    hits,
    effective: { minimumScore: 0, maximumSemanticDistance: 0.5 },
    retrieval: {
      requestedMode: "HYBRID",
      effectiveMode: "HYBRID",
      reason: "SELECTED",
      lexicalCandidates: 3,
      semanticCandidates: 4,
      embeddingProfileId: null,
      metric: "COSINE",
      embeddingCalls: 0,
      queryCacheHit: true,
      reportedInputTokens: 0,
      usageUncertain: false,
    },
  };
}

/** The closeness views on a sample hybrid search, so the kit shows every part of them. */
export function ClosenessSample() {
  const { say } = useTranslation();
  const response = useMemo(sampleResponse, []);
  const titleOf = (index: number): string => {
    const sample = SAMPLE_SCORES[index];
    return sample === undefined ? "" : say(sample.title);
  };
  const closenesses = useMemo(() => closenessOfHits(response), [response]);
  const scaleEnd = distanceScaleEnd(closenesses, "COSINE");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = closenesses[selectedIndex];
  return (
    <div className={SAMPLE_STAGE}>
      <div className={SAMPLE_SURFACE}>
        <ClosenessOverview closenesses={closenesses} distanceScaleEnd={scaleEnd} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />
        <ul className={SAMPLE_ROWS}>
          {closenesses.map((closeness, index) => (
            <li className={CLOSENESS_ROW} key={response.hits[index]?.entryId}>
              <span>{titleOf(index)}</span>
              <HitCloseness closeness={closeness} distanceScaleEnd={scaleEnd} />
            </li>
          ))}
        </ul>
      </div>
      {selected !== undefined && (
        <div className={SAMPLE_SURFACE}>
          <div className={INSTRUMENT_PANEL}>
            <p className="eyebrow">{titleOf(selectedIndex)}</p>
            <ClosenessGauge closeness={selected} distanceScaleEnd={scaleEnd} />
          </div>
        </div>
      )}
    </div>
  );
}
