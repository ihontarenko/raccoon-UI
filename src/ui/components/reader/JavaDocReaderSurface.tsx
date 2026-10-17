import { CollapsibleCode, DocumentationComment, jumpTo } from "./DocumentationParts";
import type { DocumentedFieldGroup, DocumentedMember, DocumentedMemberKind, DocumentedType, JavaDocPage } from "./javaDoc";
import type { LineRange } from "./readingFormat";
import { declareText, type DeclaredText } from "../../../translations/translate";
import { useTranslation } from "../../../translations/TranslationProvider";
import {
  DOCUMENTATION,
  MEMBER,
  MEMBER_HEAD,
  MEMBER_NAME,
  SECTION_TITLE,
  SIGNATURE,
  SUMMARY,
  SUMMARY_ITEM,
  SUMMARY_KIND,
  SUMMARY_LINK,
  TYPE_EYEBROW,
  TYPE_SECTION,
  TYPE_TITLE,
} from "./readerClasses";

export interface JavaDocReaderProperties {
  page: JavaDocPage;
  /** Opens the code view at these lines. */
  onShowLines: (range: LineRange) => void;
}

/** Members in the order a JavaDoc page lists them: constructors, then methods, then fields. */
const MEMBER_ORDER: DocumentedMemberKind[] = ["Constructor", "Method", "Field"];
const MEMBER_HEADINGS: Record<DocumentedMemberKind, DeclaredText> = {
  Constructor: declareText("reader.javadoc.constructors", "Constructors"),
  Method: declareText("reader.javadoc.methods", "Methods"),
  Field: declareText("reader.javadoc.fields", "Fields"),
};

/** A member's kind as a word beside its name. */
const MEMBER_KINDS: Record<DocumentedMemberKind, DeclaredText> = {
  Constructor: declareText("reader.javadoc.constructor", "constructor"),
  Method: declareText("reader.javadoc.method", "method"),
  Field: declareText("reader.javadoc.field", "field"),
};

function anchorOf(typeIndex: number, memberIndex: number): string {
  return `declaration-${typeIndex}-${memberIndex}`;
}

function Member({ member, identifier, onShowLines }: { member: DocumentedMember; identifier: string; onShowLines: (range: LineRange) => void }) {
  const { say } = useTranslation();
  return (
    <article className={MEMBER} id={identifier} tabIndex={-1} aria-labelledby={`${identifier}-name`}>
      <div className={MEMBER_HEAD}>
        <h4 className={MEMBER_NAME} id={`${identifier}-name`}>
          {member.name}
        </h4>
        <span className="text-xs text-muted">{say(MEMBER_KINDS[member.kind])}</span>
      </div>
      <pre className={SIGNATURE}>{member.signature}</pre>
      <DocumentationComment comment={member.comment} />
      {member.code !== "" && <CollapsibleCode language="java" code={member.code} range={{ start: member.startLine, end: member.endLine }} onShowLines={onShowLines} />}
    </article>
  );
}

function FieldGroups({ groups, onShowLines }: { groups: DocumentedFieldGroup[]; onShowLines: (range: LineRange) => void }) {
  const { t } = useTranslation();
  const fields = groups.flatMap((group) => group.fields);
  const first = groups[0];
  const last = groups[groups.length - 1];
  if (first === undefined || last === undefined) {
    return null;
  }
  const constantCount = fields.filter((field) => field.kind === "ENUM_CONSTANT").length;
  const heading =
    constantCount === fields.length
      ? t("reader.javadoc.enumConstants", "Enum constants")
      : constantCount > 0
        ? t("reader.javadoc.constantsAndFields", "Constants and fields")
        : t("reader.javadoc.fields", "Fields");
  return (
    <section className={TYPE_SECTION} aria-label={heading}>
      <h3 className={SECTION_TITLE}>
        {heading} <span className="numeric">· {fields.length}</span>
      </h3>
      <ul className={SUMMARY}>
        {fields.map((field) => (
          <li className={SUMMARY_ITEM} key={field.symbolId}>
            <span className={SUMMARY_KIND}>{field.kind === "ENUM_CONSTANT" ? t("reader.javadoc.constant", "constant") : field.kind.toLowerCase()}</span>
            <code className="numeric text-xs">{field.signature}</code>
          </li>
        ))}
      </ul>
      <CollapsibleCode
        language="java"
        code={groups.map((group) => group.code).join("\n\n")}
        range={{ start: first.startLine, end: last.endLine }}
        onShowLines={onShowLines}
      />
    </section>
  );
}

function TypeDocumentation({ type, typeIndex, packageName, onShowLines }: { type: DocumentedType; typeIndex: number; packageName: string; onShowLines: (range: LineRange) => void }) {
  const { t, say } = useTranslation();
  const ordered = MEMBER_ORDER.flatMap((kind) => type.members.map((member, memberIndex) => ({ member, memberIndex })).filter(({ member }) => member.kind === kind));
  return (
    <section className={TYPE_SECTION} aria-labelledby={`type-${typeIndex}`}>
      <p className={TYPE_EYEBROW}>{type.enclosingSignature !== null
          ? t("reader.javadoc.nestedIn", "Nested in {type}", { type: type.enclosingSignature })
          : `package ${packageName || t("reader.javadoc.defaultPackage", "(default)")}`}</p>
      <h2 className={TYPE_TITLE} id={`type-${typeIndex}`}>
        {type.signature}
      </h2>
      <DocumentationComment comment={type.comment} />
      {type.code !== "" && <CollapsibleCode language="java" code={type.code} range={{ start: type.startLine, end: type.endLine }} onShowLines={onShowLines} />}

      {ordered.length > 0 && (
        <nav aria-label={t("reader.javadoc.membersOf", "Members of {type}", { type: type.signature })}>
          <h3 className={SECTION_TITLE}>
            {t("reader.javadoc.summary", "Summary")} <span className="numeric">· {ordered.length}</span>
          </h3>
          <ul className={SUMMARY}>
            {ordered.map(({ member, memberIndex }) => {
              const identifier = anchorOf(typeIndex, memberIndex);
              return (
                <li className={SUMMARY_ITEM} key={identifier}>
                  <span className={SUMMARY_KIND}>{say(MEMBER_KINDS[member.kind])}</span>
                  <a className={SUMMARY_LINK} href={`#${identifier}`} onClick={(event) => jumpTo(event, identifier)}>
                    {member.signature}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {type.fieldGroups.length > 0 && <FieldGroups groups={type.fieldGroups} onShowLines={onShowLines} />}

      {MEMBER_ORDER.map((kind) => {
        const members = ordered.filter(({ member }) => member.kind === kind);
        if (members.length === 0) {
          return null;
        }
        return (
          <section key={kind} aria-label={say(MEMBER_HEADINGS[kind])}>
            <h3 className={SECTION_TITLE}>{say(MEMBER_HEADINGS[kind])}</h3>
            {members.map(({ member, memberIndex }) => (
              <Member key={memberIndex} member={member} identifier={anchorOf(typeIndex, memberIndex)} onShowLines={onShowLines} />
            ))}
          </section>
        );
      })}
    </section>
  );
}

/**
 * A Java file read as its documentation: each type with its comment, a summary of its members, then every
 * member's signature, comment and tags, with the code it documents folded underneath.
 *
 * Loaded lazily through `JavaDocReader`, with the Markdown renderer its comments are drawn by.
 */
export default function JavaDocReaderSurface({ page, onShowLines }: JavaDocReaderProperties) {
  const { t } = useTranslation();
  return (
    <div className={DOCUMENTATION}>
      {page.types.map((type, typeIndex) => (
        <TypeDocumentation key={typeIndex} type={type} typeIndex={typeIndex} packageName={page.packageName} onShowLines={onShowLines} />
      ))}
      {page.looseMembers.length > 0 && (
        <section className={TYPE_SECTION} aria-label={t("reader.javadoc.otherDeclarations", "Other declarations")}>
          <h3 className={SECTION_TITLE}>{t("reader.javadoc.otherDeclarations", "Other declarations")}</h3>
          {page.looseMembers.map((member, memberIndex) => (
            <Member key={memberIndex} member={member} identifier={anchorOf(page.types.length, memberIndex)} onShowLines={onShowLines} />
          ))}
        </section>
      )}
    </div>
  );
}
