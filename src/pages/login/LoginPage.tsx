import { Link, useRouter, useSearch } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { describeProblem, type Problem } from "../../application/problems";
import { useSession } from "../../application/session";
import { usePageTitle } from "../../application/usePageTitle";
import { declareText, type DeclaredText } from "../../translations/translate";
import { useTranslation } from "../../translations/TranslationProvider";
import { Notice } from "../../ui/components";
import { BrandLockup } from "../../ui/brand/BrandLockup";
import { Button, Field, Input } from "../../ui/primitives";

/* Two halves: what raccoon is, and the door. Below 960px the identity half goes and the small lockup
   takes its place above the form. */
const GATE = [
  "grid min-h-[100dvh] bg-bg",
  "grid-cols-[minmax(0,1.1fr)_minmax(calc(420px*var(--ui-scale)),0.9fr)]",
  "max-[960px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

/* ⚠️ The faint instrument grid is the ONLY texture in the product — a drafting surface, not
   decoration — and it is two one-pixel gradients over the rail's own ground, offset by a pixel so a
   line falls on the edge rather than inside it. */
const IDENTITY_HALF = [
  "grid content-center gap-8 border-r border-line bg-side",
  "[padding:var(--space-7)_clamp(var(--space-5),6vw,calc(96px*var(--ui-scale)))]",
  "[--grid-line:color-mix(in_srgb,var(--line)_55%,transparent)]",
  "[background-image:linear-gradient(var(--grid-line)_1px,transparent_1px),linear-gradient(90deg,var(--grid-line)_1px,transparent_1px)]",
  "[background-size:calc(32px*var(--ui-scale))_calc(32px*var(--ui-scale))] [background-position:-1px_-1px]",
  "max-[960px]:hidden",
].join(" ");

const PIPELINE_LIST = [
  "m-0 grid max-w-[calc(520px*var(--ui-scale))] list-none rounded-surface border border-line-strong",
  "bg-surface p-0",
].join(" ");

const STAGE = [
  "grid items-baseline gap-3 px-4 py-3 not-first:border-t not-first:border-line",
  "grid-cols-[calc(36px*var(--ui-scale))_calc(110px*var(--ui-scale))_minmax(0,1fr)]",
].join(" ");

const ACCESS_HALF = "grid place-items-center px-6 py-8 max-[960px]:items-start max-[960px]:pt-12";

const FORM = "grid gap-4 rounded-surface border border-line bg-surface p-6 [&>button]:mt-1";

/** Only an address inside this application may be returned to — never another origin. */
export function safeRedirect(candidate: unknown): string {
  if (typeof candidate === "string" && candidate.startsWith("/") && !candidate.startsWith("//")) {
    return candidate.startsWith("/login") ? "/search" : candidate;
  }
  return "/search";
}

/** Replaces the sign-in page with the full address that was asked for, query included. */
function ReturnTo({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    router.history.replace(href);
  }, [router, href]);
  return null;
}

/** The path every document takes, shown beside sign-in so the product explains itself. */
const PIPELINE: readonly { key: string; name: DeclaredText; detail: DeclaredText }[] = [
  {
    key: "sources",
    name: declareText("login.pipeline.sources", "Sources"),
    detail: declareText("login.pipeline.sourcesDetail", "folders, repositories, pushed text"),
  },
  {
    key: "scan",
    name: declareText("login.pipeline.scan", "Scan"),
    detail: declareText("login.pipeline.scanDetail", "rules decide what is taken"),
  },
  {
    key: "documents",
    name: declareText("login.pipeline.documents", "Documents"),
    detail: declareText("login.pipeline.documentsDetail", "every change is a version"),
  },
  {
    key: "index",
    name: declareText("login.pipeline.index", "Index"),
    detail: declareText("login.pipeline.indexDetail", "chunks, keywords and vectors"),
  },
  {
    key: "answers",
    name: declareText("login.pipeline.answers", "Answers"),
    detail: declareText("login.pipeline.answersDetail", "search, context and cited replies"),
  },
];

export function LoginPage() {
  const { t, say } = useTranslation();
  usePageTitle(t("login.title", "Sign in"));
  const { state, signIn } = useSession();
  const search = useSearch({ strict: false }) as { redirect?: unknown };
  const destination = safeRedirect(search.redirect);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  // Once a session exists the shell takes over — including restoring it and reporting a server
  // that cannot be reached — so this page only ever deals with signing in.
  if (state.status !== "signed-out") {
    return <ReturnTo href={destination} />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setProblem(null);
    try {
      // A ready session re-renders this page, which then returns to the destination.
      await signIn(username.trim(), password);
    } catch (error) {
      setProblem(describeProblem(error));
      setSubmitting(false);
    }
  };

  const refused = problem?.kind === "refused";

  return (
    <main className={GATE}>
      <section className={IDENTITY_HALF} aria-labelledby="product-statement">
        <BrandLockup size="display" />
        <p id="product-statement" className="m-0 max-w-[44ch] text-lg leading-[1.45] text-ink">
          {t(
            "login.statement",
            "Folders, repositories and pushed text, scanned into versioned documents — and searched, cited and answered from.",
          )}
        </p>
        <ol className={PIPELINE_LIST} aria-label={t("login.pipelineLabel", "How knowledge moves through Raccoon")}>
          {PIPELINE.map((stage, index) => (
            <li key={stage.key} className={STAGE}>
              <span className="font-mono text-xs text-accent-text">{String(index + 1).padStart(2, "0")}</span>
              <span className="font-[650]">{say(stage.name)}</span>
              <span className="text-sm text-secondary">{say(stage.detail)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className={ACCESS_HALF} aria-labelledby="sign-in-title">
        <div className="grid w-[min(calc(380px*var(--ui-scale)),100%)] gap-6">
          <div className="hidden max-[960px]:block">
            <BrandLockup />
          </div>
          <header className="grid gap-1">
            <h1 id="sign-in-title" className="text-xl">
              {t("login.title", "Sign in")}
            </h1>
            <p className="m-0 text-secondary">{t("login.lead", "Use the account this installation gave you.")}</p>
          </header>

          {problem !== null && (
            <Notice tone="error" title={refused ? t("login.refused", "Wrong username or password") : problem.title}>
              {refused ? t("login.refusedDetail", "Check both and try again.") : (problem.detail ?? problem.description)}
            </Notice>
          )}

          <form className={FORM} onSubmit={(event) => void handleSubmit(event)} noValidate>
            <Field label={t("login.username", "Username")} required>
              <Input
                name="username"
                autoComplete="username"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                }}
                required
                fullWidth
                autoFocus
              />
            </Field>
            <Field label={t("login.password", "Password")} required>
              <Input
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                }}
                required
                fullWidth
              />
            </Field>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting || username.trim().length === 0 || password.length === 0}
            >
              {submitting ? t("login.signingIn", "Signing in…") : t("login.title", "Sign in")}
            </Button>
          </form>
          <p className="m-0 text-xs text-muted">
            {t("login.footnote", "Accounts are created by an administrator; there is no self sign-up. Cannot get in? {report} or read {about}.", {
              report: (
                <Link to="/about" hash="bug-report">
                  {t("login.reportIt", "Report it")}
                </Link>
              ),
              about: <Link to="/about">{t("login.aboutLink", "about Raccoon")}</Link>,
            })}
          </p>
        </div>
      </section>
    </main>
  );
}
