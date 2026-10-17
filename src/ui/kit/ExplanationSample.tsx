import { useMemo, useState } from "react";
import type { QueryRecognition, SearchHit, SearchResponse } from "../../lib/contracts";
import { FoundBy, HighlightedExcerpt, RankLadder, RankShift, RecognizedInQuery, TermPresence, explainHit, termPresence } from "../components";
import {
  EXPLANATION_BODY,
  EXPLANATION_ROW,
  INSTRUMENT_PANEL,
  SAMPLE_ROWS,
  SAMPLE_STAGE,
  SAMPLE_SURFACE,
} from "./kitClasses";

/** A sample reranked hybrid search for «bean definition strategy», shaped exactly as the server returns it. */
const SAMPLE_EXCERPTS: { title: string; excerpt: string; fused: number; keywordRank: number | null; meaningRank: number | null; symbol: number }[] = [
  {
    title: "AbstractBeanDefinitionCreationStrategy.java",
    excerpt: "public abstract class AbstractBeanDefinitionCreationStrategy<T> implements BeanDefinitionCreationStrategy<T> {",
    fused: 3,
    keywordRank: 2,
    meaningRank: 4,
    symbol: 0,
  },
  {
    title: "BeanDefinitionCreationStrategy.java",
    excerpt: "public interface BeanDefinitionCreationStrategy<T> { BeanDefinition create(T object, BeanContext context); }",
    fused: 1,
    keywordRank: 1,
    meaningRank: 2,
    symbol: 0,
  },
  {
    title: "BeanInstantiationStrategy.java",
    excerpt: "Strategy for creating bean instances from a definition.",
    fused: 2,
    keywordRank: null,
    meaningRank: 1,
    symbol: 0,
  },
];

const QUERY_TERMS = ["bean", "definition", "strategy"];

/** The symbol the sample query was recognised to name; a chunk containing it exactly is ranked first. */
const RECOGNIZED_SYMBOL = "BeanDefinitionCreationStrategy";

const SAMPLE_RECOGNITION: QueryRecognition = { parts: [], symbols: [RECOGNIZED_SYMBOL], scopedDocumentId: null };

function spansOf(excerpt: string): { start: number; end: number; term: string }[] {
  const spans: { start: number; end: number; term: string }[] = [];
  for (const term of QUERY_TERMS) {
    const pattern = new RegExp(term, "gi");
    let found = pattern.exec(excerpt);
    while (found !== null) {
      spans.push({ start: found.index, end: found.index + term.length, term });
      found = pattern.exec(excerpt);
    }
  }
  return spans;
}

function sampleResponse(): Pick<SearchResponse, "hits" | "retrieval" | "queryTerms"> {
  const hits = SAMPLE_EXCERPTS.map(
    (sample, index): SearchHit => ({
      entryId: `explanation-${index}`,
      entryRevision: 1,
      origin: "DERIVED",
      linkedEntryId: null,
      title: sample.title,
      score: 0.5,
      excerpt: sample.excerpt,
      excerptTruncated: false,
      citation: null,
      evidence: null,
      reranked: { fusedPosition: sample.fused, relevance: 0.8 - index * 0.1 },
      match: {
        matchedTerms: QUERY_TERMS.filter((term) => sample.excerpt.toLowerCase().includes(term)),
        spans: spansOf(sample.excerpt),
        lexicalRank: sample.keywordRank,
        semanticRank: sample.meaningRank,
        symbolMatch: sample.symbol,
        recognizedSymbols: sample.excerpt.includes(RECOGNIZED_SYMBOL) ? [RECOGNIZED_SYMBOL] : [],
      },
    }),
  );
  return {
    hits,
    queryTerms: QUERY_TERMS,
    retrieval: {
      requestedMode: "HYBRID",
      effectiveMode: "HYBRID",
      reason: "SELECTED",
      lexicalCandidates: 2,
      semanticCandidates: 3,
      embeddingProfileId: null,
      embeddingCalls: 0,
      queryCacheHit: true,
      reportedInputTokens: 0,
      usageUncertain: false,
    },
  };
}

/** Why a hit was found: the rank shift, the stage marks, term highlights, the term table and the rerank ladder. */
export function ExplanationSample() {
  const response = useMemo(sampleResponse, []);
  const explanations = useMemo(() => response.hits.map((hit, index) => explainHit(hit, index, response)), [response]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  return (
    <div className={SAMPLE_STAGE}>
      <div className={SAMPLE_SURFACE}>
        <ul className={SAMPLE_ROWS}>
          {response.hits.map((hit, index) => {
            const explanation = explanations[index];
            if (explanation === undefined) {
              return null;
            }
            return (
              <li className={EXPLANATION_ROW} key={hit.entryId}>
                <RankShift explanation={explanation} reranked />
                <div className={EXPLANATION_BODY}>
                  <strong className="numeric">{hit.title}</strong>
                  <FoundBy explanation={explanation} />
                  <HighlightedExcerpt text={hit.excerpt} spans={explanation.spans} truncated={false} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <div className={SAMPLE_SURFACE}>
        <div className={INSTRUMENT_PANEL}>
          <RecognizedInQuery recognition={SAMPLE_RECOGNITION} />
          <TermPresence presence={termPresence(response)} hitCount={response.hits.length} />
          <RankLadder explanations={explanations} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />
        </div>
      </div>
    </div>
  );
}
