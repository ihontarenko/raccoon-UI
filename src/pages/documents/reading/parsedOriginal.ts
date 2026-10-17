import { useResource, type Resource } from "../../../application/useResource";
import { pipelineApi, type ContentOutcome, type IndexGeneration, type StructuredBlock, type StructuredDocument } from "../../../lib/pipeline";

/** A published parse and what the content pipeline dropped from it. */
export interface ParsedOriginal {
  document: StructuredDocument;
  outcome: ContentOutcome;
}

/** Loads the parse a processing run published, with its content outcome. */
export function useParsedOriginal(workspaceId: string, documentId: string, generation: IndexGeneration): Resource<ParsedOriginal> {
  return useResource(async () => {
    const [document, outcome] = await Promise.all([
      pipelineApi.processingResult(workspaceId, documentId, generation.versionId, generation.jobId),
      pipelineApi.contentOutcome(workspaceId, documentId, generation.versionId, generation.jobId),
    ]);
    return { document, outcome };
  }, [workspaceId, documentId, generation.versionId, generation.jobId]);
}

/** The indexes of the blocks the content pipeline dropped. */
export function droppedBlockIndexes(outcome: ContentOutcome): ReadonlySet<number> {
  return new Set(outcome.droppedBlocks.map((dropped) => dropped.blockIndex));
}

/** The text a block stands for: its content when the parser or pipeline gave it one, otherwise its slice. */
export function textOfBlock(block: StructuredBlock, sourceText: string): string {
  return block.content ?? sourceText.slice(block.startOffset, block.endOffset);
}

/** The page an offset falls on, from 1; null for an unpaged document. */
export function pageAtOffset(document: StructuredDocument, offset: number): number | null {
  const pages = document.pages ?? [];
  for (const page of pages) {
    if (offset < page.endOffset) {
      return page.number;
    }
  }
  return pages.length === 0 ? null : (pages[pages.length - 1]?.number ?? null);
}
