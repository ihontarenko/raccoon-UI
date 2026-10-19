import { useState } from "react";
import { useMediaQuery } from "../../application/useMediaQuery";
import { AppearanceControls } from "../../appearance/AppearanceControls";
import { useAppearance } from "../../appearance/AppearanceProvider";
import { useTranslation } from "../../translations/TranslationProvider";
import { Button, Dialog, Icon } from "../primitives";
import { ActivityIndicator } from "../../pages/jobs/ActivityIndicator";
import { placeOf } from "./navigation";
import { useShellTrail } from "./shellTrail";
import { TOPBAR, TOPBAR_SIDE } from "./shellClasses";

/* The breadcrumb group and its chevron are the first thing a narrow topbar drops: the place itself
   still names the page, and the area it belongs to is already said by the rail. */
const CRUMB_LEAD = "flex text-muted max-[700px]:hidden";

/* A page's own steps: every one but the last gives way on a narrow topbar, so the place being read stays named. */
const STEP = "flex min-w-0 items-center gap-2 max-[700px]:hidden";
const STEP_LINK = "overflow-hidden border-0 bg-transparent p-0 text-xs text-ellipsis whitespace-nowrap text-muted hover:text-ink hover:underline";
const CURRENT = "min-w-0 overflow-hidden font-semibold text-ellipsis whitespace-nowrap text-ink";

interface TopbarProperties {
  pathname: string;
  navigationOpen: boolean;
  onToggleNavigation: () => void;
}

export function Topbar({ pathname, navigationOpen, onToggleNavigation }: TopbarProperties) {
  const { appearance, changeAppearance } = useAppearance();
  // Below this width the label has no room, so the control is built as the icon-only button it becomes
  // rather than a labelled one with its label hidden — which left it a step shorter than its neighbour.
  const compact = useMediaQuery("(max-width: 700px)");
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const { t, say } = useTranslation();
  const place = placeOf(pathname);
  const trail = useShellTrail();
  const steps = trail?.steps ?? [];
  const nextTheme = appearance.theme === "dark" ? "light" : "dark";
  const themeSwitchLabel =
    nextTheme === "dark"
      ? t("shell.switchToDarkTheme", "Switch to dark theme")
      : t("shell.switchToLightTheme", "Switch to light theme");

  return (
    <header className={TOPBAR}>
      <div className={TOPBAR_SIDE}>
        {/* The drawer is the only way to the rail below 1000px, and there is no drawer above it. */}
        <span className="hidden max-[1000px]:inline-flex">
          <Button
            variant="quiet"
            iconOnly
            icon="menu"
            aria-label={
              navigationOpen
                ? t("shell.closeNavigation", "Close navigation")
                : t("shell.openNavigation", "Open navigation")
            }
            aria-controls="navigation"
            aria-expanded={navigationOpen}
            onClick={onToggleNavigation}
          />
        </span>
        {place !== null && (
          <nav aria-label={t("shell.breadcrumb", "Breadcrumb")}>
            <ol className="m-0 flex min-w-0 list-none items-center gap-2 p-0 text-xs">
              <li className={CRUMB_LEAD}>{say(place.group)}</li>
              <li aria-hidden="true" className={CRUMB_LEAD}>
                <Icon name="chevron" size="small" />
              </li>
              {steps.length === 0 || trail === null ? (
                <li aria-current="page" className={CURRENT}>
                  {say(place.label)}
                </li>
              ) : (
                <>
                  <li className="flex min-w-0 max-[700px]:hidden">
                    <button type="button" className={STEP_LINK} onClick={trail.onRoot}>
                      {say(place.label)}
                    </button>
                  </li>
                  {steps.map((step, index) => {
                    const last = index === steps.length - 1;
                    return (
                      <li key={`${index}-${step.label}`} className={last ? "flex min-w-0 items-center gap-2" : STEP}>
                        <Icon name="chevron" size="small" className="flex-none text-muted max-[700px]:hidden" />
                        {last || step.onSelect === undefined ? (
                          <span aria-current={last ? "page" : undefined} className={last ? CURRENT : "overflow-hidden text-ellipsis whitespace-nowrap text-muted"}>
                            {step.label}
                          </span>
                        ) : (
                          <button type="button" className={STEP_LINK} onClick={step.onSelect}>
                            {step.label}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </>
              )}
              {trail?.note !== undefined && (
                <li className="flex-none whitespace-nowrap text-muted numeric">
                  <span aria-hidden="true">· </span>
                  {trail.note}
                </li>
              )}
            </ol>
          </nav>
        )}
      </div>
      <div className={TOPBAR_SIDE}>
        <ActivityIndicator />
        <Button
          variant="quiet"
          icon="system"
          iconOnly={compact}
          aria-label={t("shell.appearance", "Appearance")}
          onClick={() => {
            setAppearanceOpen(true);
          }}
        >
          {!compact && t("shell.appearance", "Appearance")}
        </Button>
        <Button
          variant="quiet"
          iconOnly
          icon={nextTheme === "dark" ? "moon" : "sun"}
          aria-label={themeSwitchLabel}
          title={themeSwitchLabel}
          onClick={() => {
            changeAppearance("theme", nextTheme);
          }}
        />
      </div>
      <Dialog
        open={appearanceOpen}
        onClose={() => {
          setAppearanceOpen(false);
        }}
        title={t("shell.appearance", "Appearance")}
      >
        <AppearanceControls state={appearance} onChange={changeAppearance} />
      </Dialog>
    </header>
  );
}
