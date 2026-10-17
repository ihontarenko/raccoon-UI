import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { usePermissions } from "../../access/PermissionsProvider";
import { problemOf } from "../../application/problems";
import { usePageTitle } from "../../application/usePageTitle";
import { declareText } from "../../translations/translate";
import { useTranslation } from "../../translations/TranslationProvider";
import { PageHeader, ProblemState, Waiting, revealActiveItem } from "../components";
import { Button, Icon } from "../primitives";
import {
  ADMINISTRATION_GROUPS,
  ADMINISTRATION_OVERVIEW,
  ADMINISTRATION_PERMISSIONS,
  administrationSectionFor,
} from "./navigation";
/* On a phone the section column becomes a horizontal strip, headings hidden — as in Kitsu. The
   current section is marked on its left edge in the column and under it in the strip, which is why
   the border switches side with the layout rather than only changing colour. */
const FRAME = [
  "grid grid-cols-[calc(200px*var(--ui-scale))_minmax(0,1fr)] items-start gap-6",
  "max-[800px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

const SECTIONS = [
  "sticky top-[calc(52px*var(--ui-scale)+var(--space-5))] grid gap-4",
  "max-[800px]:static max-[800px]:flex max-[800px]:gap-1",
  "max-[800px]:overflow-x-auto max-[800px]:border-b max-[800px]:border-line max-[800px]:pb-2",
].join(" ");

const SECTION_LINK = [
  "flex min-h-(--control) items-center gap-2 border-l-2 border-l-transparent",
  "[padding:calc(5px*var(--ui-scale))_calc(10px*var(--ui-scale))] font-control text-secondary no-underline",
  "hover:bg-well hover:text-ink",
  "aria-[current=page]:border-l-accent aria-[current=page]:bg-accent-soft",
  "aria-[current=page]:font-semibold aria-[current=page]:text-accent-text",
  "max-[800px]:border-l-0 max-[800px]:border-b-2 max-[800px]:border-b-transparent max-[800px]:whitespace-nowrap",
  "max-[800px]:aria-[current=page]:border-b-accent",
].join(" ");

// The administration area lives inside the main shell and adds its own section column, grouped the
// way Kitsu groups its administration. Sections the caller may not open are not drawn, and opening
// one by address shows a refusal rather than a screen whose every request fails.

function sectionKeyOf(pathname: string): string | null {
  const match = /^\/administration\/([^/]+)/.exec(pathname);
  return match === null ? null : (match[1] ?? null);
}

export function AdministrationFrame() {
  const pathname = useRouterState({ select: (routerState) => routerState.location.pathname });
  const permissions = usePermissions();
  const { t, say } = useTranslation();
  const sectionKey = sectionKeyOf(pathname);
  const section = sectionKey === null ? null : administrationSectionFor(sectionKey);
  const unknownSection = sectionKey !== null && section === null;
  // An address naming no section must not be headed "Overview" above a not-found message.
  const heading = unknownSection
    ? {
        label: declareText("navigation.item.administration.label", "Administration"),
        description: declareText("administration.unknownSection", "That section does not exist."),
      }
    : (section ?? ADMINISTRATION_OVERVIEW);
  usePageTitle(unknownSection ? t("problems.notFound.title", "Not found") : say(heading.label));
  const sectionStrip = useRef<HTMLElement>(null);

  // On a phone the section column becomes one scrolling strip; keep the open section in it.
  useEffect(() => {
    revealActiveItem(sectionStrip.current, "[aria-current=page]");
  }, [pathname, permissions.loading]);

  if (permissions.loading) {
    return <Waiting label={t("common.checkingAccess", "Checking access")} />;
  }
  if (!permissions.mayAny(ADMINISTRATION_PERMISSIONS)) {
    return (
      <ProblemState
        problem={problemOf("refused")}
        actions={
          <Button href="/search" variant="primary">
            {t("common.goToSearch", "Go to search")}
          </Button>
        }
      />
    );
  }

  const visibleGroups = ADMINISTRATION_GROUPS.map((group) => ({
    ...group,
    sections: group.sections.filter((candidate) => permissions.may(candidate.permission)),
  })).filter((group) => group.sections.length > 0);

  let content = <Outlet />;
  if (unknownSection) {
    content = <ProblemState layout="section" problem={problemOf("not-found")} />;
  } else if (section !== null && !permissions.may(section.permission)) {
    content = <ProblemState layout="section" problem={problemOf("refused")} />;
  }

  return (
    <>
      <PageHeader
        eyebrow={t("navigation.item.administration.label", "Administration")}
        title={say(heading.label)}
        lead={say(heading.description)}
      />
      <div className={FRAME}>
        <nav ref={sectionStrip} className={SECTIONS} aria-label={t("administration.sections", "Administration sections")}>
          <Link
            to="/administration"
            activeOptions={{ exact: true }}
            className={SECTION_LINK}
            aria-current={sectionKey === null ? "page" : undefined}
          >
            <Icon name="evaluation" size="small" />
            <span>{say(ADMINISTRATION_OVERVIEW.label)}</span>
          </Link>
          {visibleGroups.map((group) => (
            <div key={group.title.key} className="grid gap-[3px] max-[800px]:flex max-[800px]:gap-1">
              <span className="eyebrow mb-[calc(4px*var(--ui-scale))] px-3 max-[800px]:hidden">
                {say(group.title)}
              </span>
              {group.sections.map((candidate) => (
                <Link
                  key={candidate.key}
                  to="/administration/$section"
                  params={{ section: candidate.key }}
                  className={SECTION_LINK}
                  aria-current={candidate.key === sectionKey ? "page" : undefined}
                >
                  <Icon name={candidate.icon} size="small" />
                  <span>{say(candidate.label)}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="min-w-0">{content}</div>
      </div>
    </>
  );
}
