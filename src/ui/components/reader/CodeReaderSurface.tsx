import { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { RangeSetBuilder, StateField, type EditorState, type Extension } from "@codemirror/state";
import { syntaxHighlighting, type LanguageSupport } from "@codemirror/language";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { editorChrome } from "@jmouse/codemirror/editor";
import { SYNTAX_HIGHLIGHT_STYLE } from "@jmouse/codemirror/highlight";
import { loadReadingLanguage } from "./codeLanguages";
import type { LineRange } from "./readingFormat";
import "../code/codeSurface.css";

export interface CodeReaderProperties {
  text: string;
  /** What a screen reader calls the surface — the file's name. */
  label: string;
  /** A language the catalogue knows; null or unknown reads as plain text. */
  language: string | null;
  /** Lines to bring into view and mark, as a citation names them. */
  focus?: LineRange | null;
  /** Long lines wrap; off for code, where indentation carries meaning. */
  wrapLines?: boolean;
}

const focusLine = Decoration.line({ class: "reader-focus-line" });

/** Marks the cited lines; recomputed only when the document itself is replaced. */
function focusField(focus: LineRange): Extension {
  const decorate = (state: EditorState): DecorationSet => {
    const builder = new RangeSetBuilder<Decoration>();
    const last = Math.min(focus.end, state.doc.lines);
    for (let lineNumber = Math.max(1, focus.start); lineNumber <= last; lineNumber++) {
      const line = state.doc.line(lineNumber);
      builder.add(line.from, line.from, focusLine);
    }
    return builder.finish();
  };
  return StateField.define<DecorationSet>({
    create: decorate,
    update: (value, transaction) => (transaction.docChanged ? decorate(transaction.state) : value),
    provide: (field) => EditorView.decorations.from(field),
  });
}

function scrollToFocus(view: EditorView, focus: LineRange) {
  if (focus.start > view.state.doc.lines) {
    return;
  }
  const position = view.state.doc.line(focus.start).from;
  view.dispatch({ effects: EditorView.scrollIntoView(position, { y: "start", yMargin: 48 }) });
}

/**
 * An original read in CodeMirror: coloured by its language, numbered, searchable with Ctrl+F, and never
 * editable. CodeMirror draws only the lines in view, so a file of fifty thousand lines opens as quickly
 * as one of fifty. A citation's lines are marked and scrolled to.
 *
 * Loaded lazily through `CodeReader`, so a page with no code does not carry the editor.
 */
export default function CodeReaderSurface({ text, label, language, focus = null, wrapLines = false }: CodeReaderProperties) {
  const [languageSupport, setLanguageSupport] = useState<LanguageSupport | null>(null);
  const view = useRef<EditorView | null>(null);

  useEffect(() => {
    let current = true;
    setLanguageSupport(null);
    if (language === null) {
      return;
    }
    loadReadingLanguage(language)
      .then((support) => {
        if (current) {
          setLanguageSupport(support);
        }
      })
      .catch(() => {
        // An unloadable grammar leaves the text plain, which is still readable.
      });
    return () => {
      current = false;
    };
  }, [language]);

  const focusStart = focus?.start ?? null;
  const focusEnd = focus?.end ?? null;

  const extensions = useMemo(() => {
    const list: Extension[] = [
      editorChrome({ padding: "8px 0" }),
      syntaxHighlighting(SYNTAX_HIGHLIGHT_STYLE),
      EditorView.contentAttributes.of({ "aria-label": label, "aria-readonly": "true" }),
    ];
    if (wrapLines) {
      list.push(EditorView.lineWrapping);
    }
    if (languageSupport !== null) {
      list.push(languageSupport);
    }
    if (focusStart !== null && focusEnd !== null) {
      list.push(focusField({ start: focusStart, end: focusEnd }));
    }
    return list;
  }, [label, wrapLines, languageSupport, focusStart, focusEnd]);

  // A new citation on the same document scrolls to it as well.
  useEffect(() => {
    if (view.current !== null && focusStart !== null && focusEnd !== null) {
      const editor = view.current;
      const frame = window.requestAnimationFrame(() => scrollToFocus(editor, { start: focusStart, end: focusEnd }));
      return () => window.cancelAnimationFrame(frame);
    }
    return undefined;
  }, [focusStart, focusEnd]);

  return (
    <CodeMirror
      value={text}
      height="100%"
      // Editable but read-only: the caret moves, text selects and Ctrl+F searches, nothing can change.
      editable
      readOnly
      extensions={extensions}
      theme="none"
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
        autocompletion: false,
        bracketMatching: true,
        highlightSelectionMatches: true,
        searchKeymap: true,
      }}
      onCreateEditor={(created) => {
        view.current = created;
        if (focusStart !== null && focusEnd !== null) {
          window.requestAnimationFrame(() => scrollToFocus(created, { start: focusStart, end: focusEnd }));
        }
      }}
      className="code-surface rc-code-surface"
    />
  );
}
