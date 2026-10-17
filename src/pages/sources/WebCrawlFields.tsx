import { explainParameter } from "../../application/parameterExplanations";
import type { WebOptions } from "../../lib/contracts";
import { ExplainParameter, Segmented } from "../../ui/components";
import { Field, Input } from "../../ui/primitives";
import { useTranslation } from "../../translations/TranslationProvider";
import { translate, translatePlural } from "../../translations/translate";

// How far a web source reaches, edited the same way where it is created and on its own page. The server
// owns the bounds and judges them again; these mirror them so a mistake is caught before sending.

/* The crawl mode reads like a field: its label above, the choice, then what the choice means. */
const MODE_FIELD = "grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5";

/*
 * Depth and budget side by side where there is room; each keeps a number's width, not the row's.
 *
 * ⚠️ Flex rather than an auto-fill grid. Inside a form sized by its content, `auto-fill` counts its
 * columns from the max-width and would demand two columns' worth of width on a phone.
 */
const NUMBER_ROW =
  "flex max-w-[calc(460px*var(--ui-scale))] flex-wrap gap-3 [&>*]:min-w-0 [&>*]:flex-[1_1_calc(200px*var(--ui-scale))]";

export type CrawlMode = WebOptions["crawlMode"];

export const LARGEST_LINK_DEPTH = 5;
export const LARGEST_PAGE_BUDGET = 500;
const DEFAULT_PAGE_BUDGET = 50;

/** A web source's crawl settings as typed: numbers stay text until they are checked. */
export interface WebCrawlDraft {
  crawlMode: CrawlMode;
  linkDepth: string;
  maximumPages: string;
}

export const NEW_WEB_CRAWL: WebCrawlDraft = {
  crawlMode: "FOLLOW_LINKS",
  linkDepth: "1",
  maximumPages: String(DEFAULT_PAGE_BUDGET),
};

/** The draft a stored source starts from. */
export function webCrawlDraftOf(options: Record<string, unknown>): WebCrawlDraft {
  return {
    crawlMode: options.crawlMode === "LISTED_PAGES" ? "LISTED_PAGES" : "FOLLOW_LINKS",
    linkDepth: typeof options.linkDepth === "number" ? String(options.linkDepth) : "1",
    maximumPages:
      typeof options.maximumPages === "number"
        ? String(options.maximumPages)
        : String(DEFAULT_PAGE_BUDGET),
  };
}

export interface WebCrawlErrors {
  linkDepth?: string;
  maximumPages?: string;
}

function isWholeNumberWithin(text: string, smallest: number, largest: number): boolean {
  const value = Number(text);
  return text.trim() !== "" && Number.isInteger(value) && value >= smallest && value <= largest;
}

export function validateWebCrawl(draft: WebCrawlDraft): WebCrawlErrors {
  const errors: WebCrawlErrors = {};
  if (
    draft.crawlMode === "FOLLOW_LINKS" &&
    !isWholeNumberWithin(draft.linkDepth, 1, LARGEST_LINK_DEPTH)
  ) {
    errors.linkDepth = translate("sourceSetup.webCrawl.error.linkDepth", "A depth from 1 to {largest}.", { largest: LARGEST_LINK_DEPTH });
  }
  if (!isWholeNumberWithin(draft.maximumPages, 1, LARGEST_PAGE_BUDGET)) {
    errors.maximumPages = translate("sourceSetup.webCrawl.error.maximumPages", "A page budget from 1 to {largest}.", {
      largest: LARGEST_PAGE_BUDGET,
    });
  }
  return errors;
}

/** The options the server stores: a depth only when following links. */
export function webCrawlOptionsOf(draft: WebCrawlDraft): Record<string, unknown> {
  return draft.crawlMode === "FOLLOW_LINKS"
    ? {
        crawlMode: draft.crawlMode,
        linkDepth: Number(draft.linkDepth),
        maximumPages: Number(draft.maximumPages),
      }
    : { crawlMode: draft.crawlMode, maximumPages: Number(draft.maximumPages) };
}

/** The "About …" button of one crawl setting. */
function aboutCrawl(field: "crawlMode" | "linkDepth" | "maximumPages", name: string) {
  return (
    <ExplainParameter
      name={name}
      identifier={field}
      explanation={explainParameter("web-crawl", field, { title: name })}
    />
  );
}

/** One line for a summary: what a scan fetches. */
export function describeWebCrawl(draft: {
  crawlMode: CrawlMode;
  linkDepth: string | number;
}): string {
  if (draft.crawlMode === "LISTED_PAGES") {
    return translate("sourceSetup.webCrawl.listedPagesOnly", "Only the listed pages");
  }
  return translatePlural("sourceSetup.webCrawl.followsLinks", Number(draft.linkDepth), {
    one: "Follows links {count} link deep",
    other: "Follows links {count} links deep",
  });
}

interface WebCrawlFieldsProperties {
  draft: WebCrawlDraft;
  errors: WebCrawlErrors;
  onChange: (draft: WebCrawlDraft) => void;
}

export function WebCrawlFields({ draft, errors, onChange }: WebCrawlFieldsProperties) {
  const { t } = useTranslation();
  const pagesToFetch = t("sourceSetup.webCrawl.pagesToFetch", "Pages to fetch");
  const linksDeep = t("sourceSetup.webCrawl.linksDeep", "Links deep");
  const pagesPerScan = t("sourceSetup.webCrawl.pagesPerScan", "Pages per scan");
  return (
    <>
      <div className={MODE_FIELD}>
        <span className="flex items-center gap-1">
          <span className="text-xs font-[550] text-secondary" aria-hidden="true">
            {pagesToFetch}
          </span>
          {aboutCrawl("crawlMode", pagesToFetch)}
        </span>
        <Segmented<CrawlMode>
          label={pagesToFetch}
          value={draft.crawlMode}
          options={[
            { value: "LISTED_PAGES", label: t("sourceSetup.webCrawl.onlyThesePages", "Only these pages") },
            { value: "FOLLOW_LINKS", label: t("sourceSetup.webCrawl.followLinks", "Follow links") },
          ]}
          onChange={(crawlMode) => onChange({ ...draft, crawlMode })}
        />
        <p className="text-xs text-muted">
          {draft.crawlMode === "LISTED_PAGES"
            ? t("sourceSetup.webCrawl.listedPagesHint", "Exactly the start address and the further addresses; links on them are not followed.")
            : t("sourceSetup.webCrawl.followLinksHint", "Also the pages they link to within the same sites, as many links away as the depth.")}
        </p>
      </div>
      <div className={NUMBER_ROW}>
        {draft.crawlMode === "FOLLOW_LINKS" && (
          <Field
            label={linksDeep}
            labelAside={aboutCrawl("linkDepth", linksDeep)}
            hint={t("sourceSetup.webCrawl.linkDepthHint", "1 to {largest}. 1 also fetches the pages the start pages link to.", {
              largest: LARGEST_LINK_DEPTH,
            })}
            error={errors.linkDepth}
          >
            <Input
              type="number"
              className="numeric"
              min={1}
              max={LARGEST_LINK_DEPTH}
              step={1}
              value={draft.linkDepth}
              onChange={(event) => onChange({ ...draft, linkDepth: event.target.value })}
            />
          </Field>
        )}
        <Field
          label={pagesPerScan}
          labelAside={aboutCrawl("maximumPages", pagesPerScan)}
          hint={t("sourceSetup.webCrawl.maximumPagesHint", "At most {largest}; a scan stops there and says how many it left.", {
            largest: LARGEST_PAGE_BUDGET,
          })}
          error={errors.maximumPages}
        >
          <Input
            type="number"
            className="numeric"
            min={1}
            max={LARGEST_PAGE_BUDGET}
            step={1}
            value={draft.maximumPages}
            onChange={(event) => onChange({ ...draft, maximumPages: event.target.value })}
          />
        </Field>
      </div>
    </>
  );
}
