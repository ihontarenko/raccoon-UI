import { Link } from "@tanstack/react-router";
import { useTranslation } from "../../translations/TranslationProvider";
import { usePermissions } from "../../access/PermissionsProvider";
import { useReadySession } from "../../application/session";
import { BrandLockup } from "../brand/BrandLockup";
import { Button, Icon, Select } from "../primitives";
import { classNames } from "../../lib/classNames";
import { MAIN_NAVIGATION, isActivePath } from "./navigation";
import { BRAND, RAIL } from "./shellClasses";

/* The current place is marked three ways at once — an edge, a fill and a weight — because an item
   marked by colour alone is not marked for everybody. */
const NAVIGATION_LINK = [
  "flex min-h-(--control) items-center gap-[calc(10px*var(--ui-scale))] border-l-2 border-l-transparent",
  "[padding:calc(7px*var(--ui-scale))_calc(10px*var(--ui-scale))] font-control text-secondary no-underline",
  "hover:bg-well hover:text-ink",
  "aria-[current=page]:border-l-accent aria-[current=page]:bg-accent-soft",
  "aria-[current=page]:font-semibold aria-[current=page]:text-accent-text",
].join(" ");

interface RailProperties {
  pathname: string;
  open: boolean;
  onNavigate: () => void;
}

function initialsOf(displayName: string): string {
  const words = displayName.split(/[\s/]+/).filter((word) => word.length > 0);
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

export function Rail({ pathname, open, onNavigate }: RailProperties) {
  const { viewer, workspaces, workspace, selectWorkspace, signOut } = useReadySession();
  const permissions = usePermissions();
  const { t, say } = useTranslation();
  // Hidden, not disabled: an area the caller may not open does not appear, and an emptied group goes too.
  const visibleGroups = MAIN_NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => item.permissions.length === 0 || permissions.mayAny(item.permissions),
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <aside
      id="navigation"
      className={RAIL}
      data-open={open ? "true" : "false"}
      aria-label="raccoon"
    >
      <Link to="/search" className={classNames(BRAND, "px-2")} onClick={onNavigate}>
        <BrandLockup />
      </Link>

      <div className="mx-2 grid gap-1 border-y border-line py-3">
        {workspaces.length > 1 ? (
          <>
            <label className="eyebrow" htmlFor="workspace-switcher">
              {t("shell.rail.workspace", "Workspace")}
            </label>
            <Select
              id="workspace-switcher"
              fullWidth
              value={workspace?.id ?? ""}
              onChange={(event) => {
                selectWorkspace(event.target.value);
              }}
            >
              {workspaces.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.locked ? t("shell.rail.lockedWorkspace", "{name} · PIN", { name: candidate.name }) : candidate.name}
                </option>
              ))}
            </Select>
          </>
        ) : (
          <>
            <span className="eyebrow">{t("shell.rail.workspace", "Workspace")}</span>
            <strong className="font-[550] [overflow-wrap:anywhere]">
              {workspace?.name ?? t("shell.rail.noWorkspace", "No workspace")}
            </strong>
          </>
        )}
      </div>

      <nav
        aria-label={t("shell.rail.mainNavigation", "Main navigation")}
        className="grid content-start gap-4"
      >
        {visibleGroups.map((group) => (
          <div key={group.title.key} className="grid gap-[3px]">
            <span className="eyebrow mb-[calc(5px*var(--ui-scale))] px-3">{say(group.title)}</span>
            {group.items.map((item) => {
              const active = isActivePath(pathname, item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={NAVIGATION_LINK}
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                >
                  <Icon name={item.icon} />
                  <span>{say(item.label)}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <footer className="mt-auto border-t border-line pt-3">
        <Link
          to="/about"
          className="mb-2 block px-1 text-2xs text-muted no-underline hover:text-ink hover:underline"
          onClick={onNavigate}
        >
          {t("about.railLink", "About Raccoon · contact · report a bug")}
        </Link>
        <div className="flex items-center gap-2 px-1">
          <span
            className="grid size-[calc(30px*var(--ui-scale))] flex-none place-items-center rounded-control bg-accent-soft text-2xs font-bold text-accent-text"
            aria-hidden="true"
          >
            {initialsOf(viewer.displayName)}
          </span>
          <span className="grid min-w-0 flex-1">
            <span className="overflow-hidden font-semibold text-ellipsis whitespace-nowrap">
              {viewer.displayName}
            </span>
            <span className="text-2xs text-muted">{t("shell.rail.signedIn", "Signed in")}</span>
          </span>
          <Button
            variant="quiet"
            iconOnly
            icon="signOut"
            aria-label={t("shell.rail.signOut", "Sign out")}
            title={t("shell.rail.signOut", "Sign out")}
            onClick={signOut}
          />
        </div>
      </footer>
    </aside>
  );
}
