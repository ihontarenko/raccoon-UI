// A Java source read as its documentation. Processing already cut the file along its declarations and
// recorded each one's symbol — the type, its members, their signatures — on the chunk; this module joins
// the parts of one declaration back together, takes the declaration's own lines from the original, and
// turns its JavaDoc comment into Markdown the shared renderer can draw. Nothing here parses Java: the
// structure is the backend's, and only the comment syntax is read in the browser.

import type { Chunk, ChunkSymbol, ChunkSymbolMember } from "../../../lib/pipeline";

export interface JavaDocTag {
  /** `param`, `return`, `throws`, `see`, `since`, `deprecated`… */
  name: string;
  /** The parameter or exception a tag is about; null for tags that name nothing. */
  argument: string | null;
  /** The type a JSDoc tag names in braces, `@param {string} name`; JavaDoc tags name none. */
  type?: string | null;
  /** Markdown. */
  text: string;
}

export interface JavaDocComment {
  /** Markdown. */
  description: string;
  tags: JavaDocTag[];
}

export type DocumentedMemberKind = "Constructor" | "Method" | "Field";

export interface DocumentedMember {
  kind: DocumentedMemberKind;
  name: string;
  signature: string;
  symbolId: string | null;
  comment: JavaDocComment | null;
  /** The declaration as written, without its comment. */
  code: string;
  startLine: number;
  endLine: number;
}

/** Fields or enum constants processing kept together in one chunk, listed by the symbols it recorded. */
export interface DocumentedFieldGroup {
  fields: ChunkSymbolMember[];
  code: string;
  startLine: number;
  endLine: number;
}

export interface DocumentedType {
  signature: string;
  symbolId: string | null;
  /** The type it is declared inside, for a nested type. */
  enclosingSignature: string | null;
  comment: JavaDocComment | null;
  /** The header as written — annotations and the declaration line — without its comment. */
  code: string;
  startLine: number;
  endLine: number;
  members: DocumentedMember[];
  fieldGroups: DocumentedFieldGroup[];
}

export interface JavaDocPage {
  packageName: string;
  /** The package line and imports, as written. */
  preamble: string | null;
  types: DocumentedType[];
  /** Members whose enclosing type no chunk declared — kept rather than dropped. */
  looseMembers: DocumentedMember[];
}

/** One declaration: the consecutive chunks that carry its parts. */
interface Declaration {
  symbol: ChunkSymbol;
  startLine: number;
  endLine: number;
  text: string;
}

function declarationKey(symbol: ChunkSymbol): string {
  return [symbol.kind, symbol.symbolId ?? "", symbol.signature ?? "", symbol.enclosingSignature ?? ""].join("|");
}

/** Joins the parts of each declaration; a declaration split in four is one entry with its four parts' lines. */
function declarationsOf(chunks: Chunk[], sourceLines: string[] | null): Declaration[] {
  const ordered = [...chunks].sort((first, second) => first.number - second.number);
  const declarations: Declaration[] = [];
  let previousKey: string | null = null;
  for (const chunk of ordered) {
    if (chunk.symbol === null) {
      continue;
    }
    const key = declarationKey(chunk.symbol);
    const last = declarations[declarations.length - 1];
    // A continuation is a later part of the same declaration; MEMBERS chunks are distinct groups even when
    // their keys agree, so each part number 1 starts a new one.
    if (last !== undefined && key === previousKey && chunk.symbol.part > 1) {
      last.startLine = Math.min(last.startLine, chunk.startLine);
      last.endLine = Math.max(last.endLine, chunk.endLine);
      last.text = sourceLines === null ? `${last.text}\n${chunk.text}` : last.text;
    } else {
      declarations.push({ symbol: chunk.symbol, startLine: chunk.startLine, endLine: chunk.endLine, text: chunk.text });
    }
    previousKey = key;
  }
  if (sourceLines !== null) {
    for (const declaration of declarations) {
      declaration.text = sourceLines.slice(declaration.startLine - 1, declaration.endLine).join("\n");
    }
  }
  return declarations;
}

/** Splits a declaration into the JavaDoc comment in front of it and the code it documents. */
export function splitLeadingJavaDoc(text: string): { comment: string | null; code: string } {
  const match = /^(\s*(?:\/\/[^\n]*\n\s*)*)\/\*\*(?!\/)([\s\S]*?)\*\//.exec(text);
  if (match === null) {
    return { comment: null, code: dedent(text) };
  }
  const code = text.slice(match[0].length);
  return { comment: match[2] ?? "", code: dedent(code) };
}

/** Removes the indentation every non-blank line shares, so a member reads from its own margin. */
function dedent(text: string): string {
  const lines = text.replace(/^\s*\n/, "").replace(/\s+$/, "").split("\n");
  const indents = lines.filter((line) => line.trim().length > 0).map((line) => /^[ \t]*/.exec(line)?.[0].length ?? 0);
  const shared = indents.length === 0 ? 0 : Math.min(...indents);
  return lines.map((line) => line.slice(Math.min(shared, /^[ \t]*/.exec(line)?.[0].length ?? 0))).join("\n");
}

const TAGS_WITH_ARGUMENT = new Set(["param", "throws", "exception", "serialField"]);

/** A JavaDoc comment's body — without `/**` and `*\/` — as a description and its block tags. */
export function parseJavaDoc(body: string): JavaDocComment {
  const lines = body.split("\n").map((line) => line.replace(/^\s*\*(?: ?)/, ""));
  const descriptionLines: string[] = [];
  const tags: { name: string; lines: string[] }[] = [];
  let preformattedDepth = 0;
  for (const line of lines) {
    const tagMatch = preformattedDepth === 0 ? /^\s*@(\w+)\s?(.*)$/.exec(line) : null;
    if (tagMatch !== null) {
      tags.push({ name: tagMatch[1] ?? "", lines: [tagMatch[2] ?? ""] });
    } else if (tags.length > 0) {
      tags[tags.length - 1]?.lines.push(line);
    } else {
      descriptionLines.push(line);
    }
    preformattedDepth += (line.match(/<pre\b/gi) ?? []).length - (line.match(/<\/pre>/gi) ?? []).length;
    preformattedDepth = Math.max(0, preformattedDepth);
  }
  return {
    description: javaDocToMarkdown(descriptionLines.join("\n")),
    tags: tags.map((tag) => {
      const text = tag.lines.join("\n").trim();
      if (TAGS_WITH_ARGUMENT.has(tag.name)) {
        const argumentMatch = /^(\S+)\s*([\s\S]*)$/.exec(text);
        return { name: tag.name, argument: argumentMatch?.[1] ?? null, text: javaDocToMarkdown(argumentMatch?.[2] ?? "") };
      }
      return { name: tag.name, argument: null, text: javaDocToMarkdown(text) };
    }),
  };
}

const ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    }
    return ENTITIES[entity.toLowerCase()] ?? whole;
  });
}

function inlineCode(content: string): string {
  const longestRun = Math.max(0, ...(content.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(longestRun + 1);
  const padding = content.startsWith("`") || content.endsWith("`") ? " " : "";
  return `${fence}${padding}${content}${padding}${fence}`;
}

function fencedCode(content: string): string {
  const fence = content.includes("```") ? "~~~~" : "```";
  return `\n\n${fence}java\n${content}\n${fence}\n\n`;
}

/** The text a `{@link Type#member label}` shows: its label when it has one, otherwise its reference. */
function linkText(content: string): { text: string; labelled: boolean } {
  const trimmed = content.trim();
  // A reference may carry a parameter list with spaces; the label starts after it.
  const referenceMatch = /^([^\s(]+(?:\([^)]*\))?)\s*([\s\S]*)$/.exec(trimmed);
  const reference = (referenceMatch?.[1] ?? trimmed).replace(/^#/, "");
  const label = referenceMatch?.[2]?.trim() ?? "";
  return label.length > 0 ? { text: label, labelled: true } : { text: reference, labelled: false };
}

/** HTML a JavaDoc comment may carry; anything else in angle brackets is text, such as `List<String>`. */
const KNOWN_TAGS = "p|br|ul|ol|li|b|i|em|strong|code|tt|pre|a|h[1-6]|table|thead|tbody|tfoot|tr|td|th|caption|div|span|blockquote|dl|dt|dd|sup|sub|small|big|u|s|strike|hr|img|font|center|cite|var|kbd|samp";

/**
 * A JavaDoc description as Markdown: inline tags become code or text, the usual HTML becomes paragraphs,
 * lists, headings and emphasis, `<pre>` becomes a fenced Java block, and every other angle bracket stays
 * text. The renderer draws no raw HTML, so whatever survives this is shown, never run.
 */
export function javaDocToMarkdown(html: string): string {
  const preserved: string[] = [];
  const keep = (markdown: string) => {
    preserved.push(markdown);
    return `\u0000${preserved.length - 1}\u0000`;
  };

  // Preformatted blocks first, verbatim — usually `<pre>{@code … }</pre>`.
  let text = html.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_whole, inner: string) => {
    let content = inner.trim();
    if (content.startsWith("{@code") && content.endsWith("}")) {
      content = content.slice("{@code".length, -1);
    }
    return keep(fencedCode(dedent(decodeEntities(content)).replace(/\s+$/, "")));
  });

  // Inline tags, with nested braces balanced: `{@code Map<String, List<?>>}` and `{@code { }}` alike.
  let rebuilt = "";
  let position = 0;
  while (position < text.length) {
    const start = text.indexOf("{@", position);
    if (start < 0) {
      rebuilt += text.slice(position);
      break;
    }
    rebuilt += text.slice(position, start);
    let depth = 0;
    let end = start;
    for (; end < text.length; end++) {
      if (text[end] === "{") {
        depth++;
      } else if (text[end] === "}") {
        depth--;
        if (depth === 0) {
          break;
        }
      }
    }
    if (end >= text.length) {
      rebuilt += text.slice(start);
      break;
    }
    const inner = text.slice(start + 2, end);
    const nameMatch = /^(\w+)\s*([\s\S]*)$/.exec(inner);
    const tagName = nameMatch?.[1] ?? "";
    const content = nameMatch?.[2] ?? "";
    if (tagName === "code" || tagName === "literal" || tagName === "value") {
      rebuilt += tagName === "literal" ? keep(content.replace(/[\\`*_[\]<>&]/g, (character) => `\\${character}`)) : keep(inlineCode(content));
    } else if (tagName === "link" || tagName === "linkplain") {
      const link = linkText(content);
      rebuilt += tagName === "link" && !link.labelled ? keep(inlineCode(link.text)) : link.text;
    } else if (tagName === "inheritDoc") {
      rebuilt += "*Inherited from the overridden declaration.*";
    } else {
      rebuilt += content;
    }
    position = end + 1;
  }
  text = rebuilt;

  // `<code>` and `<tt>` are code too; their content is literal.
  text = text.replace(/<(code|tt)>([\s\S]*?)<\/\1>/gi, (_whole, _tag: string, inner: string) => keep(inlineCode(decodeEntities(inner))));
  text = text.replace(/<a\s[^>]*href\s*=\s*"(https?:[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_whole, address: string, label: string) => keep(`[${label.replace(/[[\]]/g, "")}](${address})`));

  text = text
    .replace(/<\/?p\b[^>]*>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "  \n")
    .replace(/<\/?(ul|ol|dl|table|blockquote)\b[^>]*>/gi, "\n\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<dt\b[^>]*>/gi, "\n\n**")
    .replace(/<\/dt>/gi, "**\n")
    .replace(/<h[1-6]\b[^>]*>/gi, "\n\n#### ")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/?(b|strong)>/gi, "**")
    .replace(/<\/?(i|em|cite|var)>/gi, "*")
    .replace(/<\/tr>/gi, "\n")
    .replace(new RegExp(`</?(?:${KNOWN_TAGS})\\b[^>]*>`, "gi"), "");

  // What is left in angle brackets is prose, such as a generic type; the renderer must not take it for HTML.
  text = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Indentation in a comment is layout, not Markdown's indented code.
  text = text
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text.replace(/\u0000(\d+)\u0000/g, (_whole, index: string) => preserved[Number(index)] ?? "");
}

function simpleName(qualifiedName: string | null): string | null {
  if (qualifiedName === null) {
    return null;
  }
  const segments = qualifiedName.split(/[.$]/);
  return segments[segments.length - 1] ?? null;
}

function memberKindOf(symbol: ChunkSymbol): DocumentedMemberKind {
  const signature = symbol.signature ?? "";
  if (symbol.memberName !== null && symbol.memberName === simpleName(symbol.typeName)) {
    return "Constructor";
  }
  // A method's parameter list follows its name; a field's initialiser may hold parentheses only after `=`.
  const beforeInitialiser = signature.split("=")[0] ?? signature;
  return beforeInitialiser.includes("(") ? "Method" : "Field";
}

function commentOf(text: string): { comment: JavaDocComment | null; code: string } {
  const split = splitLeadingJavaDoc(text);
  return { comment: split.comment === null ? null : parseJavaDoc(split.comment), code: split.code };
}

/**
 * The documentation page of one Java file, from its chunks and — when it is at hand — the original's text,
 * from which each declaration's lines are taken whole rather than stitched from overlapping parts.
 */
export function buildJavaDocPage(chunks: Chunk[], sourceText: string | null): JavaDocPage {
  const sourceLines = sourceText === null ? null : sourceText.split(/\r?\n/);
  const declarations = declarationsOf(chunks, sourceLines);
  const page: JavaDocPage = { packageName: "", preamble: null, types: [], looseMembers: [] };
  const typesBySignature = new Map<string, DocumentedType>();

  for (const declaration of declarations) {
    const { symbol } = declaration;
    if (page.packageName === "" && symbol.packageName !== "") {
      page.packageName = symbol.packageName;
    }
    if (symbol.kind === "FILE") {
      page.preamble = declaration.text.trim();
      continue;
    }
    if (symbol.kind === "TYPE") {
      const { comment, code } = commentOf(declaration.text);
      const type: DocumentedType = {
        signature: symbol.signature ?? simpleName(symbol.typeName) ?? "type",
        symbolId: symbol.symbolId,
        enclosingSignature: symbol.enclosingSignature,
        comment,
        code,
        startLine: declaration.startLine,
        endLine: declaration.endLine,
        members: [],
        fieldGroups: [],
      };
      page.types.push(type);
      typesBySignature.set(type.signature, type);
      continue;
    }
    const owner = symbol.enclosingSignature === null ? undefined : typesBySignature.get(symbol.enclosingSignature);
    if (symbol.kind === "MEMBERS") {
      const group: DocumentedFieldGroup = {
        fields: symbol.members,
        code: dedent(declaration.text),
        startLine: declaration.startLine,
        endLine: declaration.endLine,
      };
      if (owner !== undefined) {
        owner.fieldGroups.push(group);
      }
      continue;
    }
    const { comment, code } = commentOf(declaration.text);
    const member: DocumentedMember = {
      kind: memberKindOf(symbol),
      name: symbol.memberName ?? symbol.signature ?? "member",
      signature: symbol.signature ?? symbol.memberName ?? "",
      symbolId: symbol.symbolId,
      comment,
      code,
      startLine: declaration.startLine,
      endLine: declaration.endLine,
    };
    if (owner !== undefined) {
      owner.members.push(member);
    } else {
      page.looseMembers.push(member);
    }
  }
  return page;
}

/** Whether a version's chunks carry declarations — a file processing read as Java rather than as text. */
export function hasDeclarations(chunks: Chunk[]): boolean {
  return chunks.some((chunk) => chunk.symbol !== null && chunk.symbol.kind === "TYPE");
}
