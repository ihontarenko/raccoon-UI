// A TypeScript or JavaScript module read as its documentation. Processing already cut the module along its
// declarations and recorded each one's symbol and traits — component, hook, function, class; exported or
// internal; the type of a component's properties — on the chunk; this module joins the parts of one
// declaration back together, takes its lines from the original and turns its JSDoc or TSDoc comment into
// Markdown. Nothing here parses TypeScript: the structure is the backend's, only the comment syntax is read here.

import type { Chunk, ChunkSymbol, ChunkSymbolMember } from "../../../lib/pipeline";
import { javaDocToMarkdown, splitLeadingJavaDoc, type JavaDocComment, type JavaDocTag } from "./javaDoc";

/** What a declaration is, as processing recorded it. */
export type ScriptRole =
  | "COMPONENT"
  | "HOOK"
  | "FUNCTION"
  | "CLASS"
  | "INTERFACE"
  | "TYPE"
  | "ENUM"
  | "CONSTANT"
  | "VARIABLE"
  | "NAMESPACE"
  | "STATEMENT";

export interface ScriptMember {
  /** METHOD, CONSTRUCTOR, GETTER, SETTER, PROPERTY, INITIALIZER. */
  role: string;
  name: string;
  signature: string;
  comment: JavaDocComment | null;
  deprecated: boolean;
  code: string;
  startLine: number;
  endLine: number;
}

export interface ScriptDeclaration {
  role: ScriptRole;
  name: string;
  signature: string;
  /** The label search and citations use: `module path · Class#member`. */
  label: string;
  exported: boolean;
  deprecated: boolean;
  /** For a component, the type of its properties as written. */
  propsType: string | null;
  comment: JavaDocComment | null;
  code: string;
  startLine: number;
  endLine: number;
  /** A class's members, an interface's outline. */
  members: ScriptMember[];
  outline: ChunkSymbolMember[];
}

/** Small declarations processing kept together in one chunk — types, constants — listed by the symbols it recorded. */
export interface ScriptDeclarationGroup {
  declarations: ChunkSymbolMember[];
  code: string;
  startLine: number;
  endLine: number;
}

export interface ScriptDocPage {
  /** The module's path without its extension, `pages/documents/tabs/ReadTab`; null when unknown. */
  modulePath: string | null;
  language: string;
  /** The imports and re-exports, as written. */
  preamble: string | null;
  declarations: ScriptDeclaration[];
  groups: ScriptDeclarationGroup[];
}

/** The order a module's page lists its declarations in. */
export const SCRIPT_ROLE_ORDER: ScriptRole[] = ["COMPONENT", "HOOK", "FUNCTION", "CLASS", "INTERFACE", "TYPE", "ENUM", "CONSTANT", "VARIABLE", "NAMESPACE", "STATEMENT"];

/** The module path a document's path names: its extension dropped. */
export function modulePathOf(documentPath: string | null): string | null {
  if (documentPath === null || documentPath === "") {
    return null;
  }
  return documentPath.replace(/\\/g, "/").replace(/\.(?:d\.)?[cm]?[jt]sx?$/i, "");
}

/** `module path · Class#member`, or the symbol id alone when the module is unknown. */
export function scriptSymbolLabel(modulePath: string | null, symbol: ChunkSymbol): string | null {
  const name = symbol.symbolId ?? symbol.memberName ?? null;
  if (name === null) {
    return modulePath;
  }
  return modulePath === null ? name : `${modulePath} · ${name}`;
}

/** Tags whose first word names what they are about. */
const NAMING_TAGS = new Set(["param", "arg", "argument", "property", "prop", "typeParam", "template", "throws", "exception"]);

/** Tags whose text is code. */
const CODE_TAGS = new Set(["example"]);

/**
 * A JSDoc or TSDoc comment's body — without its opening and closing markers — as a description and its block tags:
 * `@param {Type} name - text`, `@returns {Type} text`, `@example` as code, `{@link …}` as code.
 */
export function parseScriptDoc(body: string, language: string): JavaDocComment {
  const lines = body.split("\n").map((line) => line.replace(/^\s*\*(?: ?)/, ""));
  const descriptionLines: string[] = [];
  const tags: { name: string; lines: string[] }[] = [];
  let fenced = false;
  for (const line of lines) {
    const tagMatch = fenced ? null : /^\s*@(\w+)\s?(.*)$/.exec(line);
    if (tagMatch !== null) {
      tags.push({ name: tagMatch[1] ?? "", lines: [tagMatch[2] ?? ""] });
    } else if (tags.length > 0) {
      tags[tags.length - 1]?.lines.push(line);
    } else {
      descriptionLines.push(line);
    }
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
    }
  }
  return {
    description: scriptDocToMarkdown(descriptionLines.join("\n")),
    tags: tags.map((tag) => scriptTag(tag.name, tag.lines.join("\n").trim(), language)),
  };
}

function scriptTag(name: string, text: string, language: string): JavaDocTag {
  if (CODE_TAGS.has(name)) {
    const code = /^\s*(```|~~~)/.test(text) ? text : `\`\`\`${language}\n${text}\n\`\`\``;
    return { name, argument: null, type: null, text: code };
  }
  const typeMatch = /^\{([^}]*)\}\s*([\s\S]*)$/.exec(text);
  const type = typeMatch?.[1]?.trim() ?? null;
  const rest = typeMatch?.[2] ?? text;
  if (NAMING_TAGS.has(name)) {
    const argumentMatch = /^(\[[^\]]*\]|\S+)\s*(?:-\s+)?([\s\S]*)$/.exec(rest);
    return { name, argument: argumentMatch?.[1] ?? null, type, text: scriptDocToMarkdown(argumentMatch?.[2] ?? "") };
  }
  return { name, argument: null, type, text: scriptDocToMarkdown(rest) };
}

/** JSDoc is Markdown already; only `{@link …}` and the odd HTML tag need the JavaDoc treatment. */
function scriptDocToMarkdown(text: string): string {
  if (!/[<{]/.test(text)) {
    return text.trim();
  }
  return javaDocToMarkdown(text);
}

/** One declaration: the consecutive chunks that carry its parts. */
interface Joined {
  symbol: ChunkSymbol;
  startLine: number;
  endLine: number;
  text: string;
}

function joinParts(chunks: Chunk[], sourceLines: string[] | null): Joined[] {
  const ordered = [...chunks].sort((first, second) => first.number - second.number);
  const joined: Joined[] = [];
  let previousKey: string | null = null;
  for (const chunk of ordered) {
    if (chunk.symbol === null) {
      continue;
    }
    const key = [chunk.symbol.kind, chunk.symbol.symbolId ?? "", chunk.symbol.signature ?? ""].join("|");
    const last = joined[joined.length - 1];
    if (last !== undefined && key === previousKey && chunk.symbol.part > 1) {
      last.startLine = Math.min(last.startLine, chunk.startLine);
      last.endLine = Math.max(last.endLine, chunk.endLine);
      last.text = sourceLines === null ? `${last.text}\n${chunk.text}` : last.text;
    } else {
      joined.push({ symbol: chunk.symbol, startLine: chunk.startLine, endLine: chunk.endLine, text: chunk.text });
    }
    previousKey = key;
  }
  if (sourceLines !== null) {
    for (const declaration of joined) {
      declaration.text = sourceLines.slice(declaration.startLine - 1, declaration.endLine).join("\n");
    }
  }
  return joined;
}

function commentOf(text: string, language: string): { comment: JavaDocComment | null; code: string } {
  const split = splitLeadingJavaDoc(text);
  return { comment: split.comment === null ? null : parseScriptDoc(split.comment, language), code: split.code };
}

function roleOf(symbol: ChunkSymbol): ScriptRole {
  const role = symbol.traits?.role;
  if (role !== undefined && (SCRIPT_ROLE_ORDER as string[]).includes(role)) {
    return role as ScriptRole;
  }
  return symbol.kind === "TYPE" ? "CLASS" : "STATEMENT";
}

/**
 * The documentation page of one module, from its chunks and — when it is at hand — the original's text, from which
 * each declaration's lines are taken whole rather than stitched from overlapping parts.
 */
export function buildScriptDocPage(chunks: Chunk[], sourceText: string | null, documentPath: string | null): ScriptDocPage {
  const sourceLines = sourceText === null ? null : sourceText.split(/\r?\n/);
  const modulePath = modulePathOf(documentPath);
  const page: ScriptDocPage = { modulePath, language: "typescript", preamble: null, declarations: [], groups: [] };
  const classes = new Map<string, ScriptDeclaration>();

  for (const part of joinParts(chunks, sourceLines)) {
    const { symbol } = part;
    page.language = symbol.language;
    if (symbol.kind === "FILE") {
      page.preamble = part.text.trim();
      continue;
    }
    if (symbol.kind === "DECLARATIONS" || symbol.kind === "MEMBERS") {
      page.groups.push({ declarations: symbol.members, code: part.text.trim(), startLine: part.startLine, endLine: part.endLine });
      continue;
    }
    if (symbol.kind === "MEMBER") {
      const owner = symbol.typeName === null ? undefined : classes.get(symbol.typeName);
      const { comment, code } = commentOf(part.text, symbol.language);
      const member: ScriptMember = {
        role: symbol.traits?.role ?? "METHOD",
        name: symbol.memberName ?? "member",
        signature: symbol.signature ?? symbol.memberName ?? "",
        comment,
        deprecated: symbol.traits?.deprecated ?? false,
        code,
        startLine: part.startLine,
        endLine: part.endLine,
      };
      if (owner !== undefined) {
        owner.members.push(member);
      }
      continue;
    }
    const { comment, code } = commentOf(part.text, symbol.language);
    const name = symbol.typeName ?? symbol.memberName ?? symbol.symbolId ?? symbol.signature ?? "declaration";
    const declaration: ScriptDeclaration = {
      role: roleOf(symbol),
      name,
      signature: symbol.signature ?? name,
      label: scriptSymbolLabel(modulePath, symbol) ?? name,
      exported: symbol.traits?.exported ?? false,
      deprecated: symbol.traits?.deprecated ?? false,
      propsType: symbol.traits?.propsType ?? null,
      comment,
      code,
      startLine: part.startLine,
      endLine: part.endLine,
      members: [],
      outline: symbol.kind === "DECLARATION" ? symbol.members : [],
    };
    page.declarations.push(declaration);
    if (symbol.kind === "TYPE" && symbol.typeName !== null) {
      classes.set(symbol.typeName, declaration);
    }
  }
  return page;
}
