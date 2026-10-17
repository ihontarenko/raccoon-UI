import { PERMISSIONS, type Permission } from "../../access/permissions";
import { declareText, type DeclaredText } from "../../translations/translate";
import type { IconName } from "../primitives";

// The single source of truth for where things live: the main rail's groups, the administration
// area's sections, and the breadcrumb both are read from. Only screens that exist are listed — a
// link to an unbuilt page would be a dead control.

export interface NavigationItem {
  to: string;
  label: DeclaredText;
  icon: IconName;
  /** Drawn when the caller holds any one of these; the route behind it enforces the same. */
  permissions: readonly Permission[];
}

export interface NavigationGroup {
  title: DeclaredText;
  items: NavigationItem[];
}

export type AdministrationSectionKey =
  | "jobs"
  | "accounts"
  | "members"
  | "access"
  | "workspaces"
  | "agents"
  | "providers"
  | "prompts"
  | "tools"
  | "connections"
  | "settings"
  | "translations"
  | "telegram"
  | "vault";

export interface AdministrationSection {
  key: AdministrationSectionKey;
  label: DeclaredText;
  description: DeclaredText;
  icon: IconName;
  permission: Permission;
}

export interface AdministrationGroup {
  title: DeclaredText;
  sections: AdministrationSection[];
}

export const ADMINISTRATION_GROUPS: AdministrationGroup[] = [
  {
    title: declareText("navigation.group.processing", "Processing"),
    sections: [
      {
        key: "jobs",
        label: declareText("navigation.section.jobs.label", "Jobs"),
        description: declareText(
          "navigation.section.jobs.description",
          "Background work: parsing, indexing and storage checks, with their attempts.",
        ),
        icon: "jobs",
        permission: PERMISSIONS.jobRead,
      },
    ],
  },
  {
    title: declareText("navigation.group.access", "Access"),
    sections: [
      {
        key: "accounts",
        label: declareText("navigation.section.accounts.label", "Accounts"),
        description: declareText(
          "navigation.section.accounts.description",
          "People and agents who can sign in, and whether each may still do so.",
        ),
        icon: "access",
        permission: PERMISSIONS.identityManage,
      },
      {
        key: "workspaces",
        label: declareText("navigation.section.workspaces.label", "Workspaces"),
        description: declareText(
          "navigation.section.workspaces.description",
          "Where sources, documents and indexes live apart — created, renamed and switched here.",
        ),
        icon: "workspace",
        permission: PERMISSIONS.workspaceRead,
      },
      {
        key: "members",
        label: declareText("navigation.section.members.label", "Members"),
        description: declareText(
          "navigation.section.members.description",
          "Who belongs to the current workspace, and with which role.",
        ),
        icon: "projects",
        permission: PERMISSIONS.workspaceMembers,
      },
      {
        key: "access",
        label: declareText("navigation.section.access.label", "Access rules"),
        description: declareText(
          "navigation.section.access.description",
          "Who may do what, and where: every rule by person, workspace or permission, and the exceptions made by form.",
        ),
        icon: "access",
        permission: PERMISSIONS.identityManage,
      },
    ],
  },
  {
    title: declareText("navigation.group.models", "Models"),
    sections: [
      {
        key: "providers",
        label: declareText("navigation.section.providers.label", "AI providers"),
        description: declareText(
          "navigation.section.providers.description",
          "Which model raccoon calls for embeddings and answers, on whose key.",
        ),
        icon: "key",
        permission: PERMISSIONS.systemRead,
      },
      {
        key: "prompts",
        label: declareText("navigation.section.prompts.label", "Prompts"),
        description: declareText(
          "navigation.section.prompts.description",
          "The texts that steer the AI layer, the variant in force, and the shipped originals.",
        ),
        icon: "prompt",
        permission: PERMISSIONS.systemRead,
      },
    ],
  },
  {
    title: declareText("navigation.group.assistants", "Assistants"),
    sections: [
      {
        key: "agents",
        label: declareText("navigation.section.agents.label", "Agents"),
        description: declareText(
          "navigation.section.agents.description",
          "Assistants people connected to act for them, and every client holding their token.",
        ),
        icon: "agent",
        permission: PERMISSIONS.systemRead,
      },
      {
        key: "tools",
        label: declareText("navigation.section.tools.label", "Tools"),
        description: declareText(
          "navigation.section.tools.description",
          "What an assistant may do here, what it has done, and what that cost.",
        ),
        icon: "gauge",
        permission: PERMISSIONS.systemRead,
      },
    ],
  },
  {
    title: declareText("navigation.group.installation", "Installation"),
    sections: [
      {
        key: "connections",
        label: declareText("navigation.section.connections.label", "Connections"),
        description: declareText(
          "navigation.section.connections.description",
          "How every source type is configured: this computer's allowed folders, git hostings, web hosts, the push address and knowledge bases such as Kiwi.",
        ),
        icon: "link",
        permission: PERMISSIONS.systemRead,
      },
      {
        key: "settings",
        label: declareText("navigation.section.settings.label", "Settings"),
        description: declareText(
          "navigation.section.settings.description",
          "Limits and switches that apply to the whole installation.",
        ),
        icon: "system",
        permission: PERMISSIONS.systemRead,
      },
      {
        key: "translations",
        label: declareText("navigation.section.translations.label", "Translations"),
        description: declareText(
          "navigation.section.translations.description",
          "The languages the interface speaks, and what it says in each.",
        ),
        icon: "language",
        permission: PERMISSIONS.systemRead,
      },
      {
        key: "telegram",
        label: declareText("navigation.section.telegram.label", "Telegram"),
        description: declareText(
          "navigation.section.telegram.description",
          "Connect your account to the bot, and see why a message did not arrive.",
        ),
        icon: "link",
        permission: PERMISSIONS.systemWrite,
      },
      {
        key: "vault",
        label: declareText("navigation.section.vault.label", "Vault"),
        description: declareText(
          "navigation.section.vault.description",
          "Every secret and credential the installation uses, where each one comes from, and who changed or read it.",
        ),
        icon: "shield",
        permission: PERMISSIONS.vaultRead,
      },
    ],
  },
];

/** The administration area exists for anybody who may open at least one of its sections. */
export const ADMINISTRATION_PERMISSIONS: readonly Permission[] = ADMINISTRATION_GROUPS.flatMap(
  (group) => group.sections.map((section) => section.permission),
);

export const MAIN_NAVIGATION: NavigationGroup[] = [
  {
    title: declareText("navigation.group.knowledge", "Knowledge"),
    items: [
      {
        to: "/search",
        label: declareText("navigation.item.search.label", "Search"),
        icon: "search",
        permissions: [PERMISSIONS.documentRead],
      },
      {
        // Reading and browsing what the workspace holds: the explorer, and the files as a mode of it.
        to: "/library",
        label: declareText("navigation.item.library.label", "Library"),
        icon: "files",
        permissions: [PERMISSIONS.documentRead],
      },
    ],
  },
  {
    title: declareText("navigation.group.intake", "Intake"),
    items: [
      {
        to: "/sources",
        label: declareText("navigation.item.sources.label", "Sources"),
        icon: "sources",
        permissions: [PERMISSIONS.sourceRead],
      },
      {
        to: "/documents",
        label: declareText("navigation.item.documents.label", "Documents"),
        icon: "documents",
        permissions: [PERMISSIONS.documentRead],
      },
    ],
  },
  {
    title: declareText("navigation.group.layers", "Processing layers"),
    items: [
      {
        to: "/pipeline",
        label: declareText("navigation.item.pipeline.label", "Pipeline"),
        icon: "layers",
        permissions: [PERMISSIONS.automationRead],
      },
      {
        to: "/parsers",
        label: declareText("navigation.item.parsers.label", "Parsers"),
        icon: "chunks",
        permissions: [PERMISSIONS.automationRead],
      },
      {
        to: "/rules",
        label: declareText("navigation.item.ruleSets.label", "Rule sets"),
        icon: "shield",
        permissions: [PERMISSIONS.automationRead],
      },
      {
        to: "/chunking",
        label: declareText("navigation.item.chunking.label", "Chunking"),
        icon: "copy",
        permissions: [PERMISSIONS.automationRead],
      },
      {
        to: "/index",
        label: declareText("navigation.item.index.label", "Index"),
        icon: "vectors",
        permissions: [PERMISSIONS.automationRead],
      },
    ],
  },
  {
    title: declareText("navigation.group.setup", "Setup"),
    items: [
      {
        to: "/profiles",
        label: declareText("navigation.item.profiles.label", "Profiles"),
        icon: "model",
        permissions: [PERMISSIONS.automationRead],
      },
      {
        to: "/automation",
        label: declareText("navigation.item.automation.label", "Automation"),
        icon: "script",
        permissions: [PERMISSIONS.automationRead],
      },
    ],
  },
  {
    title: declareText("navigation.group.observation", "Observation"),
    items: [
      {
        to: "/jobs",
        label: declareText("navigation.item.jobs.label", "Jobs"),
        icon: "gauge",
        permissions: [PERMISSIONS.automationRead],
      },
      {
        to: "/activity",
        label: declareText("navigation.item.activity.label", "Activity"),
        icon: "jobs",
        permissions: [PERMISSIONS.automationRead],
      },
      {
        to: "/quality",
        label: declareText("navigation.item.quality.label", "Quality"),
        icon: "evaluation",
        permissions: [PERMISSIONS.automationRead],
      },
    ],
  },
  {
    title: declareText("navigation.group.system", "System"),
    items: [
      {
        to: "/administration",
        label: declareText("navigation.item.administration.label", "Administration"),
        icon: "access",
        permissions: ADMINISTRATION_PERMISSIONS,
      },
      {
        to: "/ui-kit",
        label: declareText("navigation.item.uiKit.label", "UI Kit"),
        icon: "code",
        permissions: [],
      },
      {
        to: "/about",
        label: declareText("navigation.item.about.label", "About"),
        icon: "information",
        permissions: [],
      },
    ],
  },
];

export const ADMINISTRATION_OVERVIEW = {
  label: declareText("navigation.overview.label", "Overview"),
  description: declareText(
    "navigation.overview.description",
    "The state of this installation at a glance.",
  ),
} as const;

export function administrationSectionFor(key: string): AdministrationSection | null {
  for (const group of ADMINISTRATION_GROUPS) {
    const section = group.sections.find((candidate) => candidate.key === key);
    if (section !== undefined) {
      return section;
    }
  }
  return null;
}

export interface Place {
  group: DeclaredText;
  label: DeclaredText;
}

/** Where a path sits in the product, for the breadcrumb. */
export function placeOf(pathname: string): Place | null {
  const administrationMatch = /^\/administration(?:\/([^/]+))?\/?$/.exec(pathname);
  if (administrationMatch !== null) {
    const sectionKey = administrationMatch[1];
    if (sectionKey === undefined) {
      return {
        group: declareText("navigation.item.administration.label", "Administration"),
        label: ADMINISTRATION_OVERVIEW.label,
      };
    }
    const section = administrationSectionFor(sectionKey);
    return section === null
      ? null
      : {
          group: declareText("navigation.item.administration.label", "Administration"),
          label: section.label,
        };
  }
  for (const group of MAIN_NAVIGATION) {
    // A detail page — a source, a document — sits under the area its list belongs to.
    const item = group.items.find((candidate) => isActivePath(pathname, candidate.to));
    if (item !== undefined) {
      return { group: group.title, label: item.label };
    }
  }
  return null;
}

/**
 * Pages a visitor may read without signing in. They show nothing of any workspace and call nothing
 * that needs a session, so the shell draws them in a plain frame instead of sending the visitor away.
 */
export const PUBLIC_PATHS: readonly string[] = ["/about"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => isActivePath(pathname, path));
}

export function isActivePath(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}
