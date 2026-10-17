import type { ReactNode } from "react";
import type { Problem } from "../../application/problems";
import { translate } from "../../translations/translate";

/* No pictogram: the failure is said by the red rule and the code above the title, the same language
   as the section strip below — a decorative icon tile added nothing and did not belong to the page. */
const PAGE = [
  "my-12 grid max-w-[64ch] justify-items-start gap-3",
  "[padding:var(--space-1)_0_var(--space-1)_var(--space-5)] border-l-2 border-l-danger",
].join(" ");

const CODE = "m-0 font-mono text-xs font-semibold tracking-[0.08em] text-danger uppercase";

const DETAIL = [
  "max-w-full rounded-control border border-line bg-well px-3 py-2",
  "font-mono text-xs text-secondary [overflow-wrap:anywhere]",
].join(" ");

/* Section strip — laid out by its OWN width, not the viewport: it sits in narrow columns as often as
   in wide ones, and a strip squeezed by a column must stack its action, never overlap the text. */
const SECTION = [
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3",
  "rounded-surface border border-line border-l-2 border-l-danger bg-surface",
  "@max-[560px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

interface ProblemStateProperties {
  problem: Problem;
  /** What the person can do next: retry, go back, sign in again. */
  actions?: ReactNode;
  /** `page` is the only content of the screen and owns its h1; `section` sits inside a page. */
  layout?: "page" | "section";
}

function eyebrowFor(problem: Problem): string {
  if (problem.status !== null) {
    return translate("problems.errorStatus", "Error {status}", { status: problem.status });
  }
  if (problem.kind === "not-found") {
    return translate("problems.errorStatus", "Error {status}", { status: 404 });
  }
  if (problem.kind === "interface" || problem.kind === "stale-interface") {
    return translate("problems.interfaceError", "Interface error");
  }
  if (problem.kind === "unavailable") {
    return translate("problems.noConnection", "No connection");
  }
  return translate("problems.problem", "Problem");
}

export function ProblemState({ problem, actions, layout = "page" }: ProblemStateProperties) {
  if (layout === "section") {
    return <SectionProblem problem={problem} actions={actions} />;
  }
  return (
    <div className={PAGE} role="alert">
      <p className={CODE}>{eyebrowFor(problem)}</p>
      <h1 className="text-xl focus:outline-none" tabIndex={-1} data-page-title="">
        {problem.title}
      </h1>
      <p className="text-secondary">{problem.description}</p>
      {problem.detail !== null && <p className={DETAIL}>{problem.detail}</p>}
      {actions !== undefined && <div className="mt-2 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

// Inside a page the problem is one strip in the place the content would have been: the page around
// it still stands, so it needs no headline of its own — only what failed, why, and the way out.
function SectionProblem({ problem, actions }: Omit<ProblemStateProperties, "layout">) {
  return (
    <div className="@container">
      <div className={SECTION} role="alert">
        <div className="grid min-w-0 gap-[calc(2px*var(--ui-scale))]">
          <p className="m-0 flex flex-wrap items-baseline gap-x-2 gap-y-0 font-semibold">
            {problem.title}
            <span className="text-2xs font-medium tracking-[0.06em] whitespace-nowrap text-muted uppercase">
              {eyebrowFor(problem)}
            </span>
          </p>
          <p className="m-0 text-sm text-secondary [overflow-wrap:anywhere]">
            {problem.description}
            {problem.detail !== null && <span className="text-muted"> {problem.detail}</span>}
          </p>
        </div>
        {actions !== undefined && <div className="flex gap-2">{actions}</div>}
      </div>
    </div>
  );
}
