import type { ReadingFormat } from "../../ui/components/reader/readingFormat";

/** One place in a document worth jumping to: a heading, or a declaration of code. */
export interface OutlineEntry {
  label: string;
  /** 1 for a top heading or a type, deeper for what sits under it. */
  level: number;
  /** One-based line in the original. */
  line: number;
  /** The place among the document's headings, which is how a rendered page is scrolled to it. */
  headingIndex: number | null;
}

const MOST_ENTRIES = 120;
const MARKDOWN_HEADING = /^(#{1,4})\s+(.+?)\s*#*\s*$/;
const FENCE = /^\s*(```|~~~)/;
/* Types and members as most C-like and scripting languages write them; good enough to jump around a file. */
const TYPE = /^\s*(?:export\s+)?(?:public\s+|private\s+|protected\s+|abstract\s+|final\s+|sealed\s+|static\s+|default\s+)*(class|interface|enum|record|trait|struct|object|type)\s+([A-Za-z_$][\w$]*)/;
const MEMBER = /^\s+(?:@\w+\s+)*(?:public|protected|private|static|async|def|func|fn|function|override|suspend)\b[^;=]*?\b([A-Za-z_$][\w$]*)\s*\(/;
const TOP_FUNCTION = /^(?:export\s+)?(?:async\s+)?(?:function|def|func|fn)\s+([A-Za-z_$][\w$]*)/;

/**
 * The outline of a text original, read from the text itself: Markdown headings outside code fences, or the types
 * and members of a code file. A first look, not a parse — the document page shows what the parser made of it.
 */
export function outlineOf(text: string, format: ReadingFormat): OutlineEntry[] {
  const lines = text.split(/\r?\n/);
  const entries: OutlineEntry[] = [];
  if (format.kind === "markdown") {
    let inFence = false;
    let headingIndex = 0;
    lines.forEach((line, index) => {
      if (FENCE.test(line)) {
        inFence = !inFence;
        return;
      }
      const heading = inFence ? null : MARKDOWN_HEADING.exec(line);
      if (heading !== null && entries.length < MOST_ENTRIES) {
        entries.push({ label: stripInline(heading[2]), level: heading[1].length, line: index + 1, headingIndex });
        headingIndex += 1;
      }
    });
    return entries;
  }
  if (format.kind === "code") {
    lines.forEach((line, index) => {
      if (entries.length >= MOST_ENTRIES) {
        return;
      }
      const type = TYPE.exec(line);
      if (type !== null) {
        entries.push({ label: `${type[1]} ${type[2]}`, level: 1, line: index + 1, headingIndex: null });
        return;
      }
      const topFunction = TOP_FUNCTION.exec(line);
      if (topFunction !== null) {
        entries.push({ label: `${topFunction[1]}()`, level: 1, line: index + 1, headingIndex: null });
        return;
      }
      const member = MEMBER.exec(line);
      if (member !== null && !/^(if|for|while|switch|catch|return|new)$/.test(member[1])) {
        entries.push({ label: `${member[1]}()`, level: 2, line: index + 1, headingIndex: null });
      }
    });
  }
  return entries;
}

/** A heading's text as read: no emphasis marks, links reduced to their words, code ticks dropped. */
function stripInline(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .trim();
}
