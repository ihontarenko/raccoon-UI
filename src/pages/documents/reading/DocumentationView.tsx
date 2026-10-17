import { useMemo } from "react";
import { collectAllPages } from "../../../lib/api";
import { pipelineApi } from "../../../lib/pipeline";
import { useResource } from "../../../application/useResource";
import { buildDocumentationPage } from "../../../ui/components/reader/documentationViews";
import { DocumentationReader, type DocumentationState } from "../../../ui/components/reader/Reader";
import type { ReadingViewProperties } from "./readingViews";

/**
 * A source file read as its documentation — a Java class, a TypeScript module — built from the declarations processing
 * recorded in its chunks. A declaration opens the code at its lines.
 */
export function DocumentationView({ workspaceId, generation, format, sourceText, documentPath, onShowLines }: ReadingViewProperties) {
  const chunks = useResource(
    () => collectAllPages((pageRequest) => pipelineApi.generationChunks(workspaceId, generation.jobId, pageRequest)),
    [workspaceId, generation.jobId],
  );
  const loaded = chunks.status === "ready" ? chunks.data : null;
  const page = useMemo(
    () => (loaded !== null ? buildDocumentationPage(format, loaded, sourceText, documentPath) : null),
    [format, loaded, sourceText, documentPath],
  );

  let documentation: DocumentationState;
  if (chunks.status === "failed") {
    documentation = { status: "failed", title: chunks.problem.title, detail: chunks.problem.detail ?? chunks.problem.description };
  } else if (page !== null) {
    documentation = { status: "ready", documentation: page };
  } else {
    documentation = { status: "loading" };
  }
  return <DocumentationReader documentation={documentation} onShowLines={onShowLines} />;
}
