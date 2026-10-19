import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { WorkspaceLockGate } from "./WorkspaceLockGate";
import { useEffect, useRef, useState } from "react";
import { PermissionsProvider } from "../../access/PermissionsProvider";
import { describeProblem } from "../../application/problems";
import { useSession } from "../../application/session";
import { useTranslation } from "../../translations/TranslationProvider";
import { ProblemState, Waiting } from "../components";
import { Button } from "../primitives";
import { BrandLockup } from "../brand/BrandLockup";
import { isPublicPath } from "./navigation";
import { Rail } from "./Rail";
import {
  BRAND,
  COLUMN,
  MAIN,
  PUBLIC_FRAME,
  SCRIM,
  SHELL,
  SKIP_LINK,
  STANDALONE,
  TOPBAR,
} from "./shellClasses";
import { Topbar } from "./Topbar";
import { ShellTrailProvider } from "./shellTrail";
import { WorkspaceActivityProvider } from "../../application/WorkspaceActivityProvider";

// The signed-in frame. It is also the gate: a visitor without a session is sent to the sign-in
// page with the address they asked for, and a session that cannot be restored because the server
// is down gets a problem page instead of a half-drawn shell.
export function AppShell() {
  const { state, retry, signOut } = useSession();
  const { t } = useTranslation();
  const location = useRouterState({ select: (routerState) => routerState.location });

  // A public page stays readable without a session — and when the session cannot be restored,
  // which is exactly when somebody wants to report a bug.
  if ((state.status === "signed-out" || state.status === "failed") && isPublicPath(location.pathname)) {
    return <PublicFrame signedOut={state.status === "signed-out"} />;
  }
  if (state.status === "signed-out") {
    return <SignInRedirect from={location.href} />;
  }
  if (state.status === "loading") {
    return (
      <div className={STANDALONE}>
        <Waiting label={t("shell.restoringSession", "Restoring your session")} />
      </div>
    );
  }
  if (state.status === "failed") {
    return (
      <div className={STANDALONE}>
        <ProblemState
          problem={describeProblem(new TypeError(state.message))}
          actions={
            <>
              <Button variant="primary" icon="refresh" onClick={retry}>
                {t("common.tryAgain", "Try again")}
              </Button>
              <Button variant="quiet" onClick={signOut}>
                {t("shell.signInAsSomeoneElse", "Sign in as someone else")}
              </Button>
            </>
          }
        />
      </div>
    );
  }
  return (
    <PermissionsProvider workspaceId={state.workspace?.id ?? null}>
      <WorkspaceActivityProvider workspaceId={state.workspace?.id ?? null}>
        <SignedInFrame pathname={location.pathname} />
      </WorkspaceActivityProvider>
    </PermissionsProvider>
  );
}

/**
 * Sends a visitor without a session to sign in, once, carrying the address they asked for.
 *
 * The address is captured on the first render and never re-read: while the navigation is pending
 * the router already reports the sign-in address as the current location, so following it would
 * redirect to a redirect to a redirect, without end.
 */
function SignInRedirect({ from }: { from: string }) {
  const navigate = useNavigate();
  const [requested] = useState(from);
  useEffect(() => {
    void navigate({ to: "/login", search: { redirect: requested }, replace: true });
  }, [navigate, requested]);
  return null;
}

/** The frame of a public page for somebody without a session: the brand, a way in, and the page. */
function PublicFrame({ signedOut }: { signedOut: boolean }) {
  const { t } = useTranslation();
  return (
    <div className={PUBLIC_FRAME}>
      <a className={SKIP_LINK} href="#main">
        {t("shell.skipToContent", "Skip to content")}
      </a>
      <header className={TOPBAR}>
        <Link to="/login" className={BRAND} aria-label={t("shell.brandSignIn", "Raccoon — sign in")}>
          <BrandLockup />
        </Link>
        {signedOut && (
          <Button href="/login" variant="quiet" icon="arrow">
            {t("shell.signIn", "Sign in")}
          </Button>
        )}
      </header>
      <main id="main" className={MAIN} tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}

function SignedInFrame({ pathname }: { pathname: string }) {
  const { t } = useTranslation();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const mainReference = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // After a route change, move focus to the new page's title so assistive technology announces it
  // and keyboard users continue from the top of the content rather than from the clicked link.
  useEffect(() => {
    setNavigationOpen(false);
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const title = mainReference.current?.querySelector<HTMLElement>("[data-page-title]");
      title?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  useEffect(() => {
    if (!navigationOpen) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNavigationOpen(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
    };
  }, [navigationOpen]);

  return (
    <div className={SHELL}>
      <a className={SKIP_LINK} href="#main">
        {t("shell.skipToContent", "Skip to content")}
      </a>
      <Rail
        pathname={pathname}
        open={navigationOpen}
        onNavigate={() => {
          setNavigationOpen(false);
        }}
      />
      {navigationOpen && (
        <button
          type="button"
          className={SCRIM}
          aria-label={t("shell.closeNavigation", "Close navigation")}
          tabIndex={-1}
          onClick={() => {
            setNavigationOpen(false);
          }}
        />
      )}
      <ShellTrailProvider>
      <div className={COLUMN}>
        <Topbar
          pathname={pathname}
          navigationOpen={navigationOpen}
          onToggleNavigation={() => {
            setNavigationOpen((current) => !current);
          }}
        />
        <main id="main" ref={mainReference} className={MAIN} tabIndex={-1}>
          {/* Administration is the installation's, not the workspace's: a locked workspace does not shut it. */}
          {pathname.startsWith("/administration") ? <Outlet /> : (
            <WorkspaceLockGate>
              <Outlet />
            </WorkspaceLockGate>
          )}
        </main>
      </div>
      </ShellTrailProvider>
    </div>
  );
}
