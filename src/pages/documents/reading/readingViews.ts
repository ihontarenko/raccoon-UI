// The ways a document's original can be read besides its own form — each built from what processing understood of
// it. The Read tab offers a view as the second half of a switch beside the original's own way of reading:
// PDF [Original | Rebuilt], XML and JSON [Source | Paths], Java and TypeScript [Documentation | Code].
//
// ⚠️ This list is the one place a view is registered. A new view is one entry: say which formats it reads, the
// label of the original's side of the switch, and the surface that draws it. The Read tab knows nothing else
// about any of them.

import type { ComponentType } from "react";
import type { DocumentReadingView } from "../../../application/routeTabs";
import { declareText, translateDeclared, type DeclaredText } from "../../../translations/translate";
import type { ProcessingReference } from "../../../lib/pipeline";
import type { LineRange, ReadingFormat } from "../../../ui/components/reader/readingFormat";

/** What a view's surface is given: where the original is, the run whose parse it reads, and how to go back to the original. */
export interface ReadingViewProperties {
  workspaceId: string;
  documentId: string;
  versionId: string;
  format: ReadingFormat;
  /** The processing run whose parse the view is built from — never purged, never absent when a surface is drawn. */
  generation: ProcessingReference;
  /** The original's text when it was read whole; null for a binary original or one shown in part. */
  sourceText: string | null;
  /** The document's path in its source, for a title. */
  documentPath: string | null;
  /** Opens the original's own view at cited lines. */
  onShowLines: (range: LineRange) => void;
  /** Opens the original's own view at a cited page. */
  onShowPage: (page: number) => void;
}

/** A way of reading an original built from its parse. */
export interface ReadingView {
  /** Its value in the address, `?view=`. */
  key: DocumentReadingView;
  label: DeclaredText;
  /** Whether the view reads this format. */
  reads: (format: ReadingFormat) => boolean;
  /** The other side of the switch: the original read as itself. */
  original: { key: DocumentReadingView; label: DeclaredText };
  /** Whether the view opens first when the address names no view and no citation points into the original. */
  opensFirst: boolean;
  Surface: ComponentType<ReadingViewProperties>;
}

/** The label a declared text reads as now. */
export function labelOf(text: DeclaredText): string {
  return translateDeclared(text);
}

export const ORIGINAL_LABEL = declareText("documents.read.view.original", "Original");
export const SOURCE_LABEL = declareText("documents.read.view.source", "Source");
