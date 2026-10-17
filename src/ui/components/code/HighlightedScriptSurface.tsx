import { createStaticHighlighter, SCRIPT_LANGUAGE, SYNTAX_HIGHLIGHT_STYLE } from "@jmouse/codemirror/highlight";
import { createHighlightedCode } from "@jmouse/codemirror/react-highlight";
import "./codeSurface.css";
const BLOCK = [
  "m-0 max-h-[calc(560px*var(--ui-scale))] overflow-auto rounded-control border border-line bg-surface",
  "px-4 py-3 leading-[1.6] whitespace-pre-wrap [overflow-wrap:anywhere]",
].join(" ");

// Raccoon shows one dialect of code, jMS; anything else would render as plain text.
const highlighter = createStaticHighlighter({ highlightStyle: SYNTAX_HIGHLIGHT_STYLE, grammars: [SCRIPT_LANGUAGE] });
const HighlightedCode = createHighlightedCode(highlighter);

/** A jMS document being read, not edited — coloured by the shared grammar, escaped by the library. */
export default function HighlightedScriptSurface({ code }: { code: string }) {
  return <HighlightedCode code={code} language="jms" className={`code-surface ${BLOCK}`} />;
}
