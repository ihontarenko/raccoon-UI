// ⚠️ The registered views — add one here and the Read tab offers it. Kept apart from the contract so a view's surface
// is only loaded where the Read tab is.

import { declareText } from "../../../translations/translate";
import { documentationFamilyOf } from "../../../ui/components/reader/documentationViews";
import { DocumentationView } from "./DocumentationView";
import { PathsView } from "./PathsView";
import { ORIGINAL_LABEL, SOURCE_LABEL, type ReadingView } from "./readingViews";
import { RebuiltView } from "./RebuiltView";

/** Every view, in the order they are looked for; a format takes the first that reads it. */
export const READING_VIEWS: ReadingView[] = [
  {
    key: "documentation",
    label: declareText("reader.mode.documentation", "Documentation"),
    reads: (format) => documentationFamilyOf(format) !== null,
    original: { key: "code", label: declareText("reader.mode.code", "Code") },
    opensFirst: true,
    Surface: DocumentationView,
  },
  {
    key: "rebuilt",
    label: declareText("documents.read.view.rebuilt", "Rebuilt"),
    reads: (format) => format.kind === "pdf",
    original: { key: "original", label: ORIGINAL_LABEL },
    opensFirst: false,
    Surface: RebuiltView,
  },
  {
    key: "paths",
    label: declareText("documents.read.view.paths", "Paths"),
    reads: (format) => format.kind === "code" && (format.language === "xml" || format.language === "json"),
    original: { key: "code", label: SOURCE_LABEL },
    opensFirst: false,
    Surface: PathsView,
  },
];

/** The view a format is read with besides itself, or null. */
export function readingViewOf(format: Parameters<ReadingView["reads"]>[0]): ReadingView | null {
  return READING_VIEWS.find((view) => view.reads(format)) ?? null;
}
