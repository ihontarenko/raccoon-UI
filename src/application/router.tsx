import type { LibrarySearch } from "../pages/library/librarySearch";
import { RULE_STAGES, type RuleStage } from "../lib/ruleSets";
import {
  Navigate,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from "@tanstack/react-router";
import {
  ACTIVITY_TABS,
  AUTOMATION_TABS,
  DOCUMENT_READING_VIEWS,
  documentTabOf,
  INDEX_TABS,
  QUALITY_TABS,
  SOURCE_TABS,
  PARSER_TABS,
  CHUNKER_TABS,
  RULE_SET_TABS,
  pageOf,
  tabOf,
  type ActivityTab,
  type AutomationTab,
  type DocumentSearch,
  type IndexTab,
  type QualityTab,
  type SourceTab,
  type ParserTab,
  type ChunkerTab,
  type RuleSetTab,
} from "./routeTabs";
import { LoginPage } from "../pages/login/LoginPage";
import { NotFoundPage, RouteProblem, ShellProblem } from "../pages/problems/ProblemPages";
import { SearchPage } from "../pages/search/SearchPage";
import { readDocumentsSearch } from "../lib/documentCatalogue";
import { AppShell } from "../ui/shell/AppShell";

// The route tree. `/login` stands alone; everything else sits under the pathless `shell` route,
// whose component is also the gate that sends a visitor without a session to sign in.

const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: NotFoundPage,
  // Anything failing above the shell — the shell itself, or sign-in — has no navigation to keep.
  errorComponent: ShellProblem,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: LoginPage,
});

const shellRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "shell",
  component: AppShell,
  errorComponent: ShellProblem,
});

const homeRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/",
  component: () => <Navigate to="/search" replace />,
});

const searchRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/search",
  validateSearch: (search: Record<string, unknown>): { text?: string; mode?: "answer" } => ({
    text: typeof search.text === "string" && search.text.length > 0 ? search.text : undefined,
    mode: search.mode === "answer" ? "answer" : undefined,
  }),
  component: SearchPage,
});

const askRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/ask",
  // Ask is the Answer side of Search now; an old link lands there rather than on nothing.
  component: () => <Navigate to="/search" search={{ mode: "answer" }} replace />,
});

const sourcesRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/sources",
  component: lazyRouteComponent(() => import("../pages/sources/SourcesPage"), "SourcesPage"),
});

const newSourceRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/sources/new",
  component: lazyRouteComponent(() => import("../pages/sources/NewSourcePage"), "NewSourcePage"),
});

const sourceRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/sources/$sourceId",
  validateSearch: (search: Record<string, unknown>): { tab?: SourceTab } => ({
    tab: tabOf(SOURCE_TABS, search.tab),
  }),
  component: lazyRouteComponent(() => import("../pages/sources/SourcePage"), "SourcePage"),
});

/** Files and the explorer share the place in the address (source, folder), so switching modes keeps where you are. */
function librarySearchOf(search: Record<string, unknown>): LibrarySearch {
  return {
    mode: search.mode === "files" ? "files" : undefined,
    source: typeof search.source === "string" ? search.source : undefined,
    folder: typeof search.folder === "string" ? search.folder : undefined,
    text: typeof search.text === "string" ? search.text : undefined,
    view: search.view === "list" ? "list" : undefined,
    removed: search.removed === true || search.removed === "true" ? true : undefined,
    file: typeof search.file === "string" ? search.file : undefined,
    pick: typeof search.pick === "string" ? search.pick : undefined,
    order: search.order === "SIZE" || search.order === "CAPTURED" ? search.order : undefined,
    kind: ["markdown", "text", "code", "pdf", "book", "image", "audio", "video", "none"].find(
      (kind) => kind === search.kind,
    ) as LibrarySearch["kind"],
    open: typeof search.open === "string" && search.open.length > 0 ? search.open : undefined,
    active: typeof search.active === "string" ? search.active : undefined,
    read: search.read === true || search.read === "true" ? true : undefined,
  };
}

const libraryRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/library",
  validateSearch: librarySearchOf,
  component: lazyRouteComponent(() => import("../pages/library/LibraryPage"), "LibraryPage"),
});

// Files became the Files mode of the Library; an old link lands there with everything it carried.
const filesRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/files",
  validateSearch: librarySearchOf,
  component: function FilesRedirect() {
    const search = filesRoute.useSearch();
    return <Navigate to="/library" search={{ ...search, mode: "files" }} replace />;
  },
});

const documentsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/documents",
  validateSearch: readDocumentsSearch,
  component: lazyRouteComponent(() => import("../pages/documents/DocumentsPage"), "DocumentsPage"),
});

const documentRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/documents/$documentId",
  validateSearch: (search: Record<string, unknown>): DocumentSearch => ({
    version: typeof search.version === "string" ? search.version : undefined,
    tab: documentTabOf(search.tab),
    view: tabOf(DOCUMENT_READING_VIEWS, search.view),
    lines:
      typeof search.lines === "string" || typeof search.lines === "number"
        ? String(search.lines)
        : undefined,
    page: pageOf(search.page),
  }),
  component: lazyRouteComponent(() => import("../pages/documents/DocumentPage"), "DocumentPage"),
});

const documentProcessingRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/documents/$documentId/processing",
  validateSearch: (search: Record<string, unknown>): DocumentSearch => ({
    version: typeof search.version === "string" ? search.version : undefined,
    tab: documentTabOf(search.tab),
  }),
  component: lazyRouteComponent(
    () => import("../pages/documents/DocumentPage"),
    "DocumentProcessingPage",
  ),
});

const parsersRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/parsers",
  component: lazyRouteComponent(() => import("../pages/parsers/ParsersPage"), "ParsersPage"),
});

const pipelineRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/pipeline",
  component: lazyRouteComponent(() => import("../pages/pipeline/PipelinePage"), "PipelinePage"),
});

const chunkingRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/chunking",
  component: lazyRouteComponent(() => import("../pages/chunking/ChunkingPage"), "ChunkingPage"),
});

const parserRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/parsers/$parserId",
  validateSearch: (search: Record<string, unknown>): { tab?: ParserTab } => ({
    tab: tabOf(PARSER_TABS, search.tab),
  }),
  component: lazyRouteComponent(() => import("../pages/parsers/ParserPage"), "ParserPage"),
});

const chunkerRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/chunking/$chunkerId",
  validateSearch: (search: Record<string, unknown>): { tab?: ChunkerTab } => ({
    tab: tabOf(CHUNKER_TABS, search.tab),
  }),
  component: lazyRouteComponent(() => import("../pages/chunking/ChunkerPage"), "ChunkerPage"),
});

const ruleSetsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/rules",
  component: lazyRouteComponent(() => import("../pages/rules/RuleSetsPage"), "RuleSetsPage"),
});

const ruleSetRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/rules/$ruleSetId",
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab?: RuleSetTab; addStage?: RuleStage } => ({
    tab: tabOf(RULE_SET_TABS, search.tab),
    addStage: RULE_STAGES.find((stage) => stage === search.addStage),
  }),
  component: lazyRouteComponent(() => import("../pages/rules/RuleSetPage"), "RuleSetPage"),
});

const workspaceJobsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/jobs",
  component: lazyRouteComponent(
    () => import("../pages/jobs/WorkspaceJobsPage"),
    "WorkspaceJobsPage",
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/index",
  validateSearch: (search: Record<string, unknown>): { tab?: IndexTab; vector?: string } => ({
    tab: tabOf(INDEX_TABS, search.tab),
    vector: typeof search.vector === "string" ? search.vector : undefined,
  }),
  component: lazyRouteComponent(() => import("../pages/indexing/IndexPage"), "IndexPage"),
});

const automationRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/automation",
  validateSearch: (search: Record<string, unknown>): { tab?: AutomationTab } => ({
    tab: tabOf(AUTOMATION_TABS, search.tab),
  }),
  component: lazyRouteComponent(
    () => import("../pages/automation/AutomationPage"),
    "AutomationPage",
  ),
});

const scriptRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/automation/scripts/$scriptId",
  validateSearch: (search: Record<string, unknown>): { example?: string; stage?: string } => ({
    example: typeof search.example === "string" ? search.example : undefined,
    stage: typeof search.stage === "string" ? search.stage : undefined,
  }),
  component: lazyRouteComponent(
    () => import("../pages/automation/ScriptEditorPage"),
    "ScriptEditorPage",
  ),
});

const activityRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/activity",
  validateSearch: (search: Record<string, unknown>): { tab?: ActivityTab } => ({
    tab: tabOf(ACTIVITY_TABS, search.tab),
  }),
  component: lazyRouteComponent(() => import("../pages/activity/ActivityPage"), "ActivityPage"),
});

const qualityRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/quality",
  validateSearch: (search: Record<string, unknown>): { tab?: QualityTab } => ({
    tab: tabOf(QUALITY_TABS, search.tab),
  }),
  component: lazyRouteComponent(() => import("../pages/quality/QualityPage"), "QualityPage"),
});

const suiteRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/quality/suites/$suiteId",
  component: lazyRouteComponent(
    () => import("../pages/quality/SuiteEditorPage"),
    "SuiteEditorPage",
  ),
});

const profilesRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/profiles",
  validateSearch: (search: Record<string, unknown>): { kind?: string } => ({
    kind: typeof search.kind === "string" ? search.kind : undefined,
  }),
  component: lazyRouteComponent(() => import("../pages/profiles/ProfilesPage"), "ProfilesPage"),
});

const profileRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/profiles/$kind/$profileId",
  // Which tabs exist depends on the profile's kind, so the page itself falls back from a tab its kind lacks.
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  component: lazyRouteComponent(
    () => import("../pages/profiles/ProfileEditorPage"),
    "ProfileEditorPage",
  ),
});

const administrationRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/administration",
  component: lazyRouteComponent(
    () => import("../ui/shell/AdministrationFrame"),
    "AdministrationFrame",
  ),
});

const administrationOverviewRoute = createRoute({
  getParentRoute: () => administrationRoute,
  path: "/",
  component: lazyRouteComponent(
    () => import("../pages/administration/OverviewPanel"),
    "OverviewPanel",
  ),
});

const administrationSectionRoute = createRoute({
  getParentRoute: () => administrationRoute,
  path: "$section",
  component: lazyRouteComponent(
    () => import("../pages/administration/AdministrationSectionPage"),
    "AdministrationSectionPage",
  ),
});

// Public: the shell draws it without the rail for a visitor who has not signed in (see PUBLIC_PATHS).
const aboutRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/about",
  component: lazyRouteComponent(() => import("../pages/about/AboutPage"), "AboutPage"),
});

const uiKitRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/ui-kit",
  component: lazyRouteComponent(() => import("../ui/kit/UiKit"), "UiKit"),
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  shellRoute.addChildren([
    homeRoute,
    searchRoute,
    askRoute,
    sourcesRoute,
    newSourceRoute,
    sourceRoute,
    libraryRoute,
    filesRoute,
    documentsRoute,
    documentRoute,
    documentProcessingRoute,
    indexRoute,
    workspaceJobsRoute,
    parsersRoute,
    pipelineRoute,
    chunkingRoute,
    parserRoute,
    chunkerRoute,
    ruleSetsRoute,
    ruleSetRoute,
    automationRoute,
    scriptRoute,
    qualityRoute,
    activityRoute,
    suiteRoute,
    profilesRoute,
    profileRoute,
    administrationRoute.addChildren([administrationOverviewRoute, administrationSectionRoute]),
    uiKitRoute,
    aboutRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  // A route that throws is replaced by a problem page in place, inside the shell.
  defaultErrorComponent: RouteProblem,
  defaultNotFoundComponent: NotFoundPage,
});
