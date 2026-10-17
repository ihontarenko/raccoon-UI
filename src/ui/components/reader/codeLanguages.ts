import { LanguageDescription, LanguageSupport, StreamLanguage, type StreamParser } from "@codemirror/language";
import { jmpLanguageDescription, jmsLanguageDescription } from "@jmouse/codemirror";
import { createStaticHighlighter, SYNTAX_HIGHLIGHT_STYLE } from "@jmouse/codemirror/highlight";

// The languages an original is read in. Each grammar is a CodeMirror legacy mode loaded only when a file
// of that language is opened, so reading one Java class costs the Java grammar and nothing else. The same
// catalogue colours the code reader, the fenced blocks of a rendered Markdown file and the members of the
// documentation view, so a snippet reads alike in all three.

function streamLanguage(
  name: string,
  alias: string[],
  loadParser: () => Promise<StreamParser<unknown>>,
): LanguageDescription {
  return LanguageDescription.of({
    name,
    alias,
    load: async () => new LanguageSupport(StreamLanguage.define(await loadParser())),
  });
}

/** Every language the reader colours, by the names `readingFormatOf` and Markdown fences use. */
export const READING_LANGUAGES: readonly LanguageDescription[] = [
  streamLanguage("java", [], async () => (await import("@codemirror/legacy-modes/mode/clike")).java),
  streamLanguage("kotlin", ["kt"], async () => (await import("@codemirror/legacy-modes/mode/clike")).kotlin),
  streamLanguage("scala", [], async () => (await import("@codemirror/legacy-modes/mode/clike")).scala),
  streamLanguage("c", ["h"], async () => (await import("@codemirror/legacy-modes/mode/clike")).c),
  streamLanguage("cpp", ["c++", "cc", "cxx", "hpp"], async () => (await import("@codemirror/legacy-modes/mode/clike")).cpp),
  streamLanguage("csharp", ["c#", "cs"], async () => (await import("@codemirror/legacy-modes/mode/clike")).csharp),
  streamLanguage("groovy", ["gradle"], async () => (await import("@codemirror/legacy-modes/mode/groovy")).groovy),
  streamLanguage("javascript", ["js", "jsx", "mjs", "cjs", "node"], async () => (await import("@codemirror/legacy-modes/mode/javascript")).javascript),
  streamLanguage("typescript", ["ts", "tsx"], async () => (await import("@codemirror/legacy-modes/mode/javascript")).typescript),
  streamLanguage("json", ["json5", "jsonc"], async () => (await import("@codemirror/legacy-modes/mode/javascript")).json),
  streamLanguage("python", ["py"], async () => (await import("@codemirror/legacy-modes/mode/python")).python),
  streamLanguage("go", ["golang"], async () => (await import("@codemirror/legacy-modes/mode/go")).go),
  streamLanguage("rust", ["rs"], async () => (await import("@codemirror/legacy-modes/mode/rust")).rust),
  streamLanguage("ruby", ["rb"], async () => (await import("@codemirror/legacy-modes/mode/ruby")).ruby),
  streamLanguage("swift", [], async () => (await import("@codemirror/legacy-modes/mode/swift")).swift),
  streamLanguage("sql", ["postgresql", "postgres", "mysql", "plsql"], async () => (await import("@codemirror/legacy-modes/mode/sql")).standardSQL),
  streamLanguage("shell", ["sh", "bash", "zsh", "console", "shellscript", "bat", "makefile"], async () => (await import("@codemirror/legacy-modes/mode/shell")).shell),
  streamLanguage("powershell", ["ps1", "pwsh"], async () => (await import("@codemirror/legacy-modes/mode/powershell")).powerShell),
  streamLanguage("yaml", ["yml"], async () => (await import("@codemirror/legacy-modes/mode/yaml")).yaml),
  streamLanguage("toml", [], async () => (await import("@codemirror/legacy-modes/mode/toml")).toml),
  streamLanguage("xml", ["svg", "xsd", "pom"], async () => (await import("@codemirror/legacy-modes/mode/xml")).xml),
  streamLanguage("html", ["htm", "xhtml"], async () => (await import("@codemirror/legacy-modes/mode/xml")).html),
  streamLanguage("css", [], async () => (await import("@codemirror/legacy-modes/mode/css")).css),
  streamLanguage("properties", ["ini", "conf"], async () => (await import("@codemirror/legacy-modes/mode/properties")).properties),
  streamLanguage("dockerfile", ["docker"], async () => (await import("@codemirror/legacy-modes/mode/dockerfile")).dockerFile),
  streamLanguage("lua", [], async () => (await import("@codemirror/legacy-modes/mode/lua")).lua),
  streamLanguage("assembly", ["asm", "s", "gas", "arm"], async () => (await import("@codemirror/legacy-modes/mode/gas")).gasArm),
  streamLanguage("cmake", [], async () => (await import("@codemirror/legacy-modes/mode/cmake")).cmake),
  streamLanguage("diff", ["patch"], async () => (await import("@codemirror/legacy-modes/mode/diff")).diff),
  LanguageDescription.of({
    name: "markdown",
    alias: ["md"],
    load: async () => (await import("@codemirror/lang-markdown")).markdown(),
  }),
  jmsLanguageDescription,
  jmpLanguageDescription,
];

/** The language a name stands for, loaded; null when the reader knows no grammar for it. */
export async function loadReadingLanguage(name: string): Promise<LanguageSupport | null> {
  const description = LanguageDescription.matchLanguageName([...READING_LANGUAGES], name.trim().toLowerCase(), true);
  if (description === null) {
    return null;
  }
  return description.load();
}

/** Colours code that is read rather than edited — fenced Markdown blocks and documented members. */
export const READING_HIGHLIGHTER = createStaticHighlighter({
  highlightStyle: SYNTAX_HIGHLIGHT_STYLE,
  catalogue: READING_LANGUAGES,
});
