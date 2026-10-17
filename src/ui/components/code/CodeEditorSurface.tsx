import { useMemo, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { jmsSyntax } from "@jmouse/codemirror";
import { catalogueCompletion, JMS_COMPLETION_RULES, type CompletionCatalogue } from "@jmouse/codemirror/completion";
import { editorChrome } from "@jmouse/codemirror/editor";
import { SYNTAX_HIGHLIGHT_STYLE } from "@jmouse/codemirror/highlight";
import "./codeSurface.css";
/* The frame around an editor. ⚠️ The colours INSIDE it are the library syntax palette, never this
   product tokens — see `codeSurface.css`. */
const EDITOR_FRAME = [
  "overflow-hidden rounded-control border border-line-strong bg-surface",
  "focus-within:border-accent-text",
  "focus-within:shadow-[0_0_0_2px_color-mix(in_srgb,var(--accent-text)_25%,transparent)]",
].join(" ");

export interface CodeEditorProperties {
  value: string;
  /** What a screen reader calls the editing surface — the script's name, where there is one. */
  label: string;
  onChange?: (next: string) => void;
  readOnly?: boolean;
  /** What `@`, `on` and plain names are completed from. The binder on the server still decides. */
  catalogue?: CompletionCatalogue | null;
  /** The editor's height; it never grows past the window. */
  height?: string;
}

/**
 * A jMS document in CodeMirror: coloured by the shared grammar and palette, completed from the host's
 * catalogue, and judged only on the server when it is saved.
 *
 * Loaded lazily through `CodeEditor`, so a page with no code does not carry the editor.
 */
export default function CodeEditorSurface({ value, label, onChange, readOnly = false, catalogue = null, height }: CodeEditorProperties) {
  // Read through a ref, so completion follows a catalogue that arrives late without rebuilding the editor.
  const latestCatalogue = useRef(catalogue);
  latestCatalogue.current = catalogue;

  const extensions = useMemo(
    () => [
      jmsSyntax(),
      // The frame and the colours are both the library's: `editorChrome` reads the names bridged in
      // codeSurface.css, the palette is the same one every jMouse interface paints code with.
      editorChrome({ padding: "12px 14px" }),
      syntaxHighlighting(SYNTAX_HIGHLIGHT_STYLE),
      catalogueCompletion({ catalogue: () => latestCatalogue.current, rules: JMS_COMPLETION_RULES }),
      EditorView.lineWrapping,
      // The name goes on the editing surface, the only element a screen reader lands on.
      EditorView.contentAttributes.of({ "aria-label": label }),
    ],
    [label],
  );

  return (
    <CodeMirror
      value={value}
      height={height ?? "clamp(320px, calc(100dvh - 22rem), 760px)"}
      editable={!readOnly}
      readOnly={readOnly}
      extensions={extensions}
      onChange={onChange}
      // "none", or the wrapper installs its own light theme under ours and the editor sits on white in dark mode.
      theme="none"
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: !readOnly,
        highlightActiveLineGutter: !readOnly,
        autocompletion: false,
      }}
      className={`code-surface ${EDITOR_FRAME}`}
    />
  );
}
