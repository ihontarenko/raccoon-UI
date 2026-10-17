import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { Component, useEffect, type ErrorInfo, type ReactNode } from "react";
import { describeProblem, problemOf, type Problem } from "../../application/problems";
import { usePageTitle } from "../../application/usePageTitle";
import { translate } from "../../translations/translate";
import { useTranslation } from "../../translations/TranslationProvider";
import { BrandLockup } from "../../ui/brand/BrandLockup";
import { ProblemState } from "../../ui/components";
import { Button } from "../../ui/primitives";

// Every way a screen can fail ends on one design: an address that matches nothing, a route that threw
// while rendering, the shell itself failing, or a failure outside the router altogether. Outside the
// shell a problem stands in one frame with the product mark; inside it, it takes the content area and
// the navigation keeps working. Both speak through ProblemState and offer the same pair of actions:
// the one way to recover, then the way out.

function StandaloneProblem({ problem, actions }: { problem: Problem; actions: ReactNode }) {
  usePageTitle(problem.title);
  return (
    <main className="mx-auto grid min-h-[100dvh] w-[min(640px,100%)] content-center justify-items-start gap-4 [padding:var(--space-5)_var(--space-4)]">
      <a href="/search" className="inline-flex text-ink no-underline" aria-label={translate("shell.brandGoToSearch", "Raccoon — go to search")}>
        <BrandLockup />
      </a>
      <ProblemState problem={problem} actions={actions} />
    </main>
  );
}

/**
 * The way to recover from a problem. An interface failure is a broken page, not a broken request: a
 * reset re-renders the same modules, so only a reload helps. Anything that came from the server is
 * worth trying again in place.
 */
function RecoverButton({ problem, onTryAgain }: { problem: Problem; onTryAgain?: () => void }) {
  const { t } = useTranslation();
  // A stale interface is fixed by fetching it again, never by retrying the same request in place.
  if (problem.kind === "interface" || problem.kind === "stale-interface" || onTryAgain === undefined) {
    return (
      <Button variant="primary" icon="refresh" onClick={() => window.location.reload()}>
        {t("common.reloadPage", "Reload the page")}
      </Button>
    );
  }
  return (
    <Button variant="primary" icon="refresh" onClick={onTryAgain}>
      {t("common.tryAgain", "Try again")}
    </Button>
  );
}

function WayOut() {
  const { t } = useTranslation();
  return (
    <Button href="/search" variant="quiet" icon="search">
      {t("common.goToSearch", "Go to search")}
    </Button>
  );
}

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <StandaloneProblem
      problem={problemOf("not-found")}
      actions={
        <>
          <Button href="/search" variant="primary" icon="search">
            {t("common.goToSearch", "Go to search")}
          </Button>
          <Button variant="quiet" onClick={() => window.history.back()}>
            {t("common.goBack", "Go back")}
          </Button>
        </>
      }
    />
  );
}

function useReportedFailure(error: unknown, where: string) {
  useEffect(() => {
    console.error(where, error);
  }, [error, where]);
}

/** In place of a route inside the shell that threw — the navigation around it keeps working. */
export function RouteProblem({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const problem = describeProblem(error);
  usePageTitle(problem.title);
  useReportedFailure(error, "A route failed to render");
  useReloadOnceWhenStale(problem);
  return (
    <ProblemState
      problem={problem}
      actions={
        <>
          <RecoverButton
            problem={problem}
            onTryAgain={() => {
              reset();
              void router.invalidate();
            }}
          />
          <WayOut />
        </>
      }
    />
  );
}

/**
 * A page the browser could not fetch is fetched again, once, by itself.
 *
 * A module import that fails leaves the interface in a dead end: the page is never going to arrive, and the only
 * button that would help is one the person has no reason to prefer over "Try again" — which re-imports the same dead
 * address and fails again. So the interface reloads itself instead, and only once per address: a reload that did not
 * help must not become a loop, and the second failure is shown with the words that say what to do.
 */
function useReloadOnceWhenStale(problem: Problem): void {
  useEffect(() => {
    if (problem.kind !== "stale-interface") {
      return;
    }
    const mark = "raccoon.reloaded-for-stale-module:" + window.location.pathname;
    try {
      if (window.sessionStorage.getItem(mark) !== null) {
        return;
      }
      window.sessionStorage.setItem(mark, String(Date.now()));
    } catch {
      // A browser that refuses session storage gets the button instead of the reload; it is still a way out.
      return;
    }
    window.location.reload();
  }, [problem.kind]);
}

/** When the shell itself fails there is no navigation to keep, so the problem takes the whole frame. */
export function ShellProblem({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const problem = describeProblem(error);
  useReportedFailure(error, "The shell failed to render");
  useReloadOnceWhenStale(problem);
  return (
    <StandaloneProblem
      problem={problem}
      actions={
        <>
          <RecoverButton
            problem={problem}
            onTryAgain={() => {
              reset();
              void router.invalidate();
            }}
          />
          <WayOut />
        </>
      }
    />
  );
}

interface BoundaryState {
  error: unknown;
}

/** The last line: anything that escapes the router, such as a provider failing, lands here. */
export class ApplicationErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { error };
  }

  componentDidCatch(error: unknown, information: ErrorInfo): void {
    console.error("The interface failed outside any route", error, information.componentStack);
  }

  render(): ReactNode {
    if (this.state.error === null) {
      return this.props.children;
    }
    const problem = describeProblem(this.state.error);
    return (
      <StandaloneProblem
        problem={problem}
        actions={
          <>
            <RecoverButton problem={problem} />
            <Button variant="quiet" icon="search" onClick={() => window.location.assign("/search")}>
              {translate("common.goToSearch", "Go to search")}
            </Button>
          </>
        }
      />
    );
  }
}
