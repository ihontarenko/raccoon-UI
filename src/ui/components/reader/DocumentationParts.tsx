import { useState, type MouseEvent } from "react";
import { createHighlightedCode } from "@jmouse/codemirror/react-highlight";
import { READING_HIGHLIGHTER } from "./codeLanguages";
import type { JavaDocComment } from "./javaDoc";
import type { LineRange } from "./readingFormat";
import { declareText, type DeclaredText } from "../../../translations/translate";
import { useTranslation } from "../../../translations/TranslationProvider";
import MarkdownReaderSurface from "./MarkdownReaderSurface";
import "../code/codeSurface.css";
import {
  NO_COMMENT,
  TAGS,
  TAG_ARGUMENT,
} from "./readerClasses";

// What a documentation view of source code is drawn from, whatever the language: a declaration's comment with its
// tags, and the code it documents folded underneath. Java's and TypeScript's views share them.

const HighlightedCode = createHighlightedCode(READING_HIGHLIGHTER);

/** Block tags under the label a reader knows them by — JavaDoc's and JSDoc's alike. */
const TAG_LABELS: Record<string, DeclaredText> = {
  param: declareText("reader.javadoc.tag.parameters", "Parameters"),
  arg: declareText("reader.javadoc.tag.parameters", "Parameters"),
  argument: declareText("reader.javadoc.tag.parameters", "Parameters"),
  typeParam: declareText("reader.javadoc.tag.typeParameters", "Type parameters"),
  template: declareText("reader.javadoc.tag.typeParameters", "Type parameters"),
  property: declareText("reader.javadoc.tag.properties", "Properties"),
  prop: declareText("reader.javadoc.tag.properties", "Properties"),
  return: declareText("reader.javadoc.tag.returns", "Returns"),
  returns: declareText("reader.javadoc.tag.returns", "Returns"),
  throws: declareText("reader.javadoc.tag.throws", "Throws"),
  exception: declareText("reader.javadoc.tag.throws", "Throws"),
  example: declareText("reader.javadoc.tag.example", "Example"),
  remarks: declareText("reader.javadoc.tag.remarks", "Remarks"),
  defaultValue: declareText("reader.javadoc.tag.defaultValue", "Default"),
  default: declareText("reader.javadoc.tag.defaultValue", "Default"),
  see: declareText("reader.javadoc.tag.see", "See also"),
  since: declareText("reader.javadoc.tag.since", "Since"),
  deprecated: declareText("reader.javadoc.tag.deprecated", "Deprecated"),
  author: declareText("reader.javadoc.tag.author", "Author"),
  version: declareText("reader.javadoc.tag.version", "Version"),
  apiNote: declareText("reader.javadoc.tag.apiNote", "API note"),
  implNote: declareText("reader.javadoc.tag.implementationNote", "Implementation note"),
  implSpec: declareText("reader.javadoc.tag.implementationRequirements", "Implementation requirements"),
  serial: declareText("reader.javadoc.tag.serial", "Serial"),
  serialField: declareText("reader.javadoc.tag.serialField", "Serial field"),
};

/** Scrolls within the page rather than changing the address, which the router owns. */
export function jumpTo(event: MouseEvent<HTMLAnchorElement>, identifier: string) {
  event.preventDefault();
  const target = document.getElementById(identifier);
  if (target !== null) {
    target.scrollIntoView({ block: "start" });
    target.focus({ preventScroll: true });
  }
}

/** A documentation comment: its description, then its tags grouped under one label per kind, in the order written. */
export function DocumentationComment({ comment }: { comment: JavaDocComment | null }) {
  const { t, say } = useTranslation();
  if (comment === null || (comment.description === "" && comment.tags.length === 0)) {
    return <p className={NO_COMMENT}>{t("reader.javadoc.noComment", "No documentation comment.")}</p>;
  }
  const groups = new Map<string, JavaDocComment["tags"]>();
  for (const tag of comment.tags) {
    const declared = TAG_LABELS[tag.name];
    const label = declared === undefined ? `@${tag.name}` : say(declared);
    groups.set(label, [...(groups.get(label) ?? []), tag]);
  }
  return (
    <>
      {comment.description !== "" && <MarkdownReaderSurface markdown={comment.description} />}
      {groups.size > 0 && (
        <dl className={TAGS}>
          {[...groups.entries()].map(([label, tags]) => (
            <TagGroup key={label} label={label} tags={tags} />
          ))}
        </dl>
      )}
    </>
  );
}

function TagGroup({ label, tags }: { label: string; tags: JavaDocComment["tags"] }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>
        {tags.map((tag, index) => (
          <div key={index}>
            {tag.argument !== null && <code className={TAG_ARGUMENT}>{tag.argument}</code>}
            {tag.type !== undefined && tag.type !== null && <code className={`${TAG_ARGUMENT} text-muted`}>{tag.type}</code>}
            {tag.text !== "" && <MarkdownReaderSurface markdown={tag.text} />}
          </div>
        ))}
      </dd>
    </>
  );
}

/** The declaration as written, highlighted only once it is opened, so a long file stays light. */
export function CollapsibleCode({ code, language, range, onShowLines }: { code: string; language: string; range: LineRange; onShowLines: (range: LineRange) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <details
      className="min-w-0 [&>summary]:inline-flex [&>summary]:cursor-pointer [&>summary]:items-center [&>summary]:gap-2 [&>summary]:py-[2px] [&>summary]:text-xs [&>summary]:text-accent-text [&>summary:focus-visible]:outline-2 [&>summary:focus-visible]:outline-offset-2 [&>summary:focus-visible]:outline-accent-text"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{t("reader.javadoc.codeLines", "Code · lines {start}–{end}", { start: range.start, end: range.end })}</summary>
      {open && (
        <>
          <HighlightedCode
            code={code}
            language={language}
            className="code-surface mx-0 mt-2 mb-0 max-h-[calc(520px*var(--ui-scale))] overflow-auto rounded-control border border-line bg-surface px-4 py-3 leading-[1.6] whitespace-pre"
          />
          <button
            type="button"
            className="cursor-pointer border-0 bg-transparent p-0 text-xs text-accent-text underline [text-underline-offset:2px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text"
            onClick={() => onShowLines(range)}
          >
            {t("reader.javadoc.showInFile", "Show in the whole file")}
          </button>
        </>
      )}
    </details>
  );
}
