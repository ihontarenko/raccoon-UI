import { CollapsibleCode, DocumentationComment, jumpTo } from "./DocumentationParts";
import type { LineRange } from "./readingFormat";
import { SCRIPT_ROLE_ORDER, type ScriptDeclaration, type ScriptDeclarationGroup, type ScriptDocPage, type ScriptMember, type ScriptRole } from "./scriptDoc";
import { declareText, type DeclaredText } from "../../../translations/translate";
import { useTranslation } from "../../../translations/TranslationProvider";
import { Badge } from "../../primitives";
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
  TAG_ARGUMENT,
  TYPE_EYEBROW,
  TYPE_SECTION,
  TYPE_TITLE,
} from "./readerClasses";

export interface ScriptDocReaderProperties {
  page: ScriptDocPage;
  /** The language the code is highlighted as — `tsx` for a module with JSX. */
  codeLanguage: string;
  /** Opens the code view at these lines. */
  onShowLines: (range: LineRange) => void;
}

/** Each role's section heading. */
const ROLE_HEADINGS: Record<ScriptRole, DeclaredText> = {
  COMPONENT: declareText("reader.script.components", "Components"),
  HOOK: declareText("reader.script.hooks", "Hooks"),
  FUNCTION: declareText("reader.script.functions", "Functions"),
  CLASS: declareText("reader.script.classes", "Classes"),
  INTERFACE: declareText("reader.script.interfaces", "Interfaces"),
  TYPE: declareText("reader.script.types", "Types"),
  ENUM: declareText("reader.script.enums", "Enums"),
  CONSTANT: declareText("reader.script.constants", "Constants"),
  VARIABLE: declareText("reader.script.variables", "Variables"),
  NAMESPACE: declareText("reader.script.namespaces", "Namespaces"),
  STATEMENT: declareText("reader.script.statements", "Other statements"),
};

/** A role as a word beside a declaration's name. */
const ROLE_WORDS: Record<string, DeclaredText> = {
  COMPONENT: declareText("reader.script.component", "component"),
  HOOK: declareText("reader.script.hook", "hook"),
  FUNCTION: declareText("reader.script.function", "function"),
  CLASS: declareText("reader.script.class", "class"),
  INTERFACE: declareText("reader.script.interface", "interface"),
  TYPE: declareText("reader.script.type", "type"),
  ENUM: declareText("reader.script.enum", "enum"),
  CONSTANT: declareText("reader.script.constant", "constant"),
  VARIABLE: declareText("reader.script.variable", "variable"),
  NAMESPACE: declareText("reader.script.namespace", "namespace"),
  STATEMENT: declareText("reader.script.statement", "statement"),
  METHOD: declareText("reader.javadoc.method", "method"),
  CONSTRUCTOR: declareText("reader.javadoc.constructor", "constructor"),
  PROPERTY: declareText("reader.script.property", "property"),
  GETTER: declareText("reader.script.getter", "getter"),
  SETTER: declareText("reader.script.setter", "setter"),
  INITIALIZER: declareText("reader.script.initializer", "static block"),
};

function anchorOf(declarationIndex: number, memberIndex?: number): string {
  return memberIndex === undefined ? `script-declaration-${declarationIndex}` : `script-declaration-${declarationIndex}-${memberIndex}`;
}

function RoleWord({ role }: { role: string }) {
  const { say } = useTranslation();
  const declared = ROLE_WORDS[role];
  return <span className="text-xs text-muted">{declared === undefined ? role.toLowerCase() : say(declared)}</span>;
}

function DeprecatedBadge() {
  const { t } = useTranslation();
  return <Badge tone="warn">{t("reader.script.deprecated", "deprecated")}</Badge>;
}

function Visibility({ exported, deprecated }: { exported: boolean; deprecated: boolean }) {
  const { t } = useTranslation();
  return (
    <>
      {exported ? <Badge tone="allow">{t("reader.script.exported", "exported")}</Badge> : <Badge tone="neutral">{t("reader.script.internal", "internal")}</Badge>}
      {deprecated && <DeprecatedBadge />}
    </>
  );
}

function Member({ member, identifier, codeLanguage, onShowLines }: { member: ScriptMember; identifier: string; codeLanguage: string; onShowLines: (range: LineRange) => void }) {
  return (
    <article className={MEMBER} id={identifier} tabIndex={-1} aria-labelledby={`${identifier}-name`}>
      <div className={MEMBER_HEAD}>
        <h5 className={MEMBER_NAME} id={`${identifier}-name`}>
          {member.name}
        </h5>
        <RoleWord role={member.role} />
        {member.deprecated && <DeprecatedBadge />}
      </div>
      <pre className={SIGNATURE}>{member.signature}</pre>
      <DocumentationComment comment={member.comment} />
      {member.code !== "" && <CollapsibleCode language={codeLanguage} code={member.code} range={{ start: member.startLine, end: member.endLine }} onShowLines={onShowLines} />}
    </article>
  );
}

function Declaration({ declaration, index, codeLanguage, onShowLines }: { declaration: ScriptDeclaration; index: number; codeLanguage: string; onShowLines: (range: LineRange) => void }) {
  const { t } = useTranslation();
  const identifier = anchorOf(index);
  return (
    <article className={MEMBER} id={identifier} tabIndex={-1} aria-labelledby={`${identifier}-name`}>
      <div className={MEMBER_HEAD}>
        <h4 className={MEMBER_NAME} id={`${identifier}-name`}>
          {declaration.name}
        </h4>
        <RoleWord role={declaration.role} />
        <Visibility exported={declaration.exported} deprecated={declaration.deprecated} />
      </div>
      <p className="numeric m-0 text-xs text-muted [overflow-wrap:anywhere]">{declaration.label}</p>
      <pre className={SIGNATURE}>{declaration.signature}</pre>
      {declaration.propsType !== null && (
        <p className="text-xs">
          <span className="text-muted">{t("reader.script.properties", "Properties")}</span> <code className={TAG_ARGUMENT}>{declaration.propsType}</code>
        </p>
      )}
      <DocumentationComment comment={declaration.comment} />
      {declaration.outline.length > 0 && (
        <ul className={SUMMARY} aria-label={t("reader.script.membersOf", "Members of {name}", { name: declaration.name })}>
          {declaration.outline.map((member) => (
            <li className={SUMMARY_ITEM} key={member.symbolId}>
              <span className={SUMMARY_KIND}>{member.kind.toLowerCase()}</span>
              <code className="numeric text-xs">{member.signature}</code>
            </li>
          ))}
        </ul>
      )}
      {declaration.code !== "" && <CollapsibleCode language={codeLanguage} code={declaration.code} range={{ start: declaration.startLine, end: declaration.endLine }} onShowLines={onShowLines} />}
      {declaration.members.map((member, memberIndex) => (
        <Member key={memberIndex} member={member} identifier={anchorOf(index, memberIndex)} codeLanguage={codeLanguage} onShowLines={onShowLines} />
      ))}
    </article>
  );
}

function Groups({ groups, codeLanguage, onShowLines }: { groups: ScriptDeclarationGroup[]; codeLanguage: string; onShowLines: (range: LineRange) => void }) {
  const { t } = useTranslation();
  const declarations = groups.flatMap((group) => group.declarations);
  const heading = t("reader.script.smallDeclarations", "Types, constants and statements");
  return (
    <section className={TYPE_SECTION} aria-label={heading}>
      <h3 className={SECTION_TITLE}>
        {heading} <span className="numeric">· {declarations.length}</span>
      </h3>
      <ul className={SUMMARY}>
        {declarations.map((declaration, index) => (
          <li className={SUMMARY_ITEM} key={`${declaration.symbolId}-${index}`}>
            <span className={SUMMARY_KIND}>{declaration.kind.toLowerCase()}</span>
            <code className="numeric text-xs">{declaration.signature}</code>
          </li>
        ))}
      </ul>
      {groups.map((group, index) => (
        <CollapsibleCode key={index} language={codeLanguage} code={group.code} range={{ start: group.startLine, end: group.endLine }} onShowLines={onShowLines} />
      ))}
    </section>
  );
}

/**
 * A TypeScript or JavaScript module read as its documentation: a summary of what it declares, then each component, hook,
 * function, class and type with its signature, its properties, its JSDoc and tags, whether the module exports it, and the
 * code folded underneath.
 */
export default function ScriptDocReaderSurface({ page, codeLanguage, onShowLines }: ScriptDocReaderProperties) {
  const { t, say } = useTranslation();
  const indexed = page.declarations.map((declaration, index) => ({ declaration, index }));
  const exportedCount = page.declarations.filter((declaration) => declaration.exported).length;
  return (
    <div className={DOCUMENTATION}>
      <section className={TYPE_SECTION} aria-labelledby="script-module">
        <p className={TYPE_EYEBROW}>{t("reader.script.module", "Module")}</p>
        <h2 className={TYPE_TITLE} id="script-module">
          {page.modulePath ?? t("reader.script.thisModule", "This module")}
        </h2>
        <p className="text-xs text-secondary">
          {t("reader.script.counts", "{declarations} declarations, {exported} exported", { declarations: page.declarations.length, exported: exportedCount })}
        </p>
        {page.preamble !== null && page.preamble !== "" && (
          <CollapsibleCode language={codeLanguage} code={page.preamble} range={{ start: 1, end: page.preamble.split("\n").length }} onShowLines={onShowLines} />
        )}
        {indexed.length > 0 && (
          <nav aria-label={t("reader.script.declarationsOf", "Declarations of this module")}>
            <h3 className={SECTION_TITLE}>
              {t("reader.javadoc.summary", "Summary")} <span className="numeric">· {indexed.length}</span>
            </h3>
            <ul className={SUMMARY}>
              {SCRIPT_ROLE_ORDER.flatMap((role) => indexed.filter(({ declaration }) => declaration.role === role)).map(({ declaration, index }) => (
                <li className={SUMMARY_ITEM} key={index}>
                  <span className={SUMMARY_KIND}>
                    <RoleWord role={declaration.role} />
                  </span>
                  <span>
                    <a className={SUMMARY_LINK} href={`#${anchorOf(index)}`} onClick={(event) => jumpTo(event, anchorOf(index))}>
                      {declaration.name}
                    </a>
                    {!declaration.exported && <span className="text-xs text-muted"> · {t("reader.script.internal", "internal")}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </section>

      {SCRIPT_ROLE_ORDER.map((role) => {
        const ofRole = indexed.filter(({ declaration }) => declaration.role === role);
        if (ofRole.length === 0) {
          return null;
        }
        return (
          <section key={role} className={TYPE_SECTION} aria-label={say(ROLE_HEADINGS[role])}>
            <h3 className={SECTION_TITLE}>
              {say(ROLE_HEADINGS[role])} <span className="numeric">· {ofRole.length}</span>
            </h3>
            {ofRole.map(({ declaration, index }) => (
              <Declaration key={index} declaration={declaration} index={index} codeLanguage={codeLanguage} onShowLines={onShowLines} />
            ))}
          </section>
        );
      })}

      {page.groups.length > 0 && <Groups groups={page.groups} codeLanguage={codeLanguage} onShowLines={onShowLines} />}
    </div>
  );
}
