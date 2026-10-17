import { formatNumber } from "../../application/format";
import type { IndexChain as Chain } from "../../lib/indexOverview";
import { useTranslation, type Translation } from "../../translations/TranslationProvider";

/* One step after another, joined by arrows: the order is the meaning. Five across on a wide screen,
   one under another once there is no room — where the arrow turns to point down instead. */
const CHAIN = [
  "m-0 grid list-none grid-cols-5 overflow-clip rounded-surface border border-line bg-surface p-0",
  "max-[1100px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

/*
 * ⚠️ THE ARROW IS A NOTCH CUT INTO THE SHARED BORDER, not a glyph: a square with two edges, turned
 * 45° and filled with the surface, sitting over the rule between two steps. `not-first:` is the old
 * `.step + .step` — every sibling here is a step, so the two say the same thing.
 */
const STEP = [
  "group relative grid grid-cols-[auto_minmax(0,1fr)] grid-rows-[auto_auto_1fr_auto] gap-x-2 gap-y-1",
  "[padding:var(--space-3)_var(--space-5)_var(--space-3)_var(--space-4)]",
  "border-t-[3px] border-t-allow data-[waiting=true]:border-t-warn data-[empty=true]:border-t-line-strong",
  "not-first:border-l not-first:border-l-line",
  "not-first:before:absolute not-first:before:top-1/2 not-first:before:left-[calc(-7px*var(--ui-scale))]",
  "not-first:before:size-[calc(12px*var(--ui-scale))] not-first:before:border-t not-first:before:border-r",
  "not-first:before:border-line not-first:before:bg-surface not-first:before:content-['']",
  "not-first:before:[transform:translateY(-50%)_rotate(45deg)]",
  "max-[1100px]:not-first:border-l-0",
  "max-[1100px]:not-first:before:top-[calc(-8px*var(--ui-scale))]",
  "max-[1100px]:not-first:before:left-[var(--space-4)]",
  "max-[1100px]:not-first:before:[transform:rotate(135deg)]",
].join(" ");

const STEP_NUMBER = [
  "row-span-2 row-start-1 grid size-[calc(22px*var(--ui-scale))] place-items-center rounded-full",
  "bg-allow-soft text-2xs font-bold text-allow",
  "group-data-[waiting=true]:bg-warn-soft group-data-[waiting=true]:text-warn",
].join(" ");

interface Step {
  key: string;
  title: string;
  value: number;
  unit: string;
  explains: string;
  /** What has not reached this step yet, in words; absent when nothing is waiting. */
  waiting?: string;
}

function stepsOf(chain: Chain, { t, plural }: Translation): Step[] {
  const notProcessed = chain.documents - chain.processedDocuments;
  const notPublished = chain.processedDocuments - chain.searchableDocuments;
  const withoutVectors = chain.searchableDocuments - chain.vectorisedDocuments;
  const documentsUnit = (count: number) =>
    plural("index.chain.documentsUnit", count, { one: "document", other: "documents" });
  return [
    {
      key: "captured",
      title: t("index.chain.captured", "Captured"),
      value: chain.documents,
      unit: documentsUnit(chain.documents),
      explains: t("index.chain.captured.explains", "Originals taken from the sources, version by version."),
    },
    {
      key: "chunks",
      title: t("index.chain.chunks", "Cut into chunks"),
      value: chain.processedDocuments,
      unit: t("index.chain.processed", "processed"),
      explains: t(
        "index.chain.chunks.explains",
        "Processing reads a version and cuts it into pieces — {count} of them are searchable now.",
        { count: formatNumber(chain.chunks) },
      ),
      waiting:
        notProcessed > 0
          ? t("index.chain.notProcessed", "{count} not processed yet", { count: formatNumber(notProcessed) })
          : undefined,
    },
    {
      key: "entries",
      title: t("index.chain.entries", "Keyword entries"),
      value: chain.searchableEntries,
      unit: plural("index.chain.entriesUnit", chain.searchableEntries, { one: "entry", other: "entries" }),
      explains:
        chain.writtenEntries > 0
          ? t(
              "index.chain.entries.explainsWritten",
              "One per chunk — what keyword search matches. Plus {count} written by hand.",
              { count: formatNumber(chain.writtenEntries) },
            )
          : t("index.chain.entries.explains", "One per chunk — the words keyword search matches."),
    },
    {
      key: "searchable",
      title: t("index.chain.searchable", "Searchable"),
      value: chain.searchableDocuments,
      unit: documentsUnit(chain.searchableDocuments),
      explains: t("index.chain.searchable.explains", "Publishing a document's entries is what lets search find it."),
      waiting:
        notPublished > 0
          ? t("index.chain.notPublished", "{count} built, not published", { count: formatNumber(notPublished) })
          : undefined,
    },
    {
      key: "vectorised",
      title: t("index.chain.vectorised", "Vectorised"),
      value: chain.vectorisedDocuments,
      unit: documentsUnit(chain.vectorisedDocuments),
      explains: t(
        "index.chain.vectorised.explains",
        "An AI model turns entries into vectors, so search can match meaning — {count} in use.",
        { count: formatNumber(chain.searchableVectors) },
      ),
      waiting:
        withoutVectors > 0
          ? t("index.chain.withoutVectors", "{count} searchable without vectors", { count: formatNumber(withoutVectors) })
          : undefined,
    },
  ];
}

function placeholderSteps({ t }: Translation): Step[] {
  return [
    { key: "captured", title: t("index.chain.captured", "Captured") },
    { key: "chunks", title: t("index.chain.chunks", "Cut into chunks") },
    { key: "entries", title: t("index.chain.entries", "Keyword entries") },
    { key: "searchable", title: t("index.chain.searchable", "Searchable") },
    { key: "vectorised", title: t("index.chain.vectorised", "Vectorised") },
  ].map((step) => ({ ...step, value: 0, unit: "", explains: "" }));
}

/**
 * The index as the chain it is: a captured version is cut into chunks, each chunk becomes one keyword
 * entry, publishing makes the entries searchable, and vectors are embedded from published entries. Each
 * step says what it holds and what has not reached it — the rest of the page is the detail of one step.
 */
export function IndexChain({ chain }: { chain: Chain | null }) {
  const translation = useTranslation();
  const steps = chain === null ? placeholderSteps(translation) : stepsOf(chain, translation);
  return (
    <ol
      className={CHAIN}
      aria-label={translation.t("index.chain.label", "How a document becomes searchable")}
      aria-busy={chain === null}
    >
      {steps.map((step, index) => (
        <li key={step.key} className={STEP} data-waiting={step.waiting !== undefined} data-empty={chain !== null && step.value === 0}>
          <span className={STEP_NUMBER} aria-hidden="true">
            {index + 1}
          </span>
          <span className="text-2xs font-semibold tracking-[0.06em] text-muted uppercase">{step.title}</span>
          <span className="col-start-2 whitespace-nowrap [&_strong]:text-lg [&_strong]:font-[650]">
            <strong className="numeric">{chain === null ? "…" : formatNumber(step.value)}</strong> <span className="text-xs text-secondary">{step.unit}</span>
          </span>
          <span className="col-span-full text-xs text-secondary">{step.explains}</span>
          {step.waiting !== undefined && <span className="col-span-full text-xs font-semibold text-warn">{step.waiting}</span>}
        </li>
      ))}
    </ol>
  );
}
