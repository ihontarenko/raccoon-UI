import { INTERFACE_BUILD } from "../../application/build";
import { formatDateTime } from "../../application/format";
import { usePageTitle } from "../../application/usePageTitle";
import { FEEDBACK_FORMS, INNOVENTA_ORIGIN, embedAddressOf, standaloneAddressOf, type FeedbackForm } from "../../lib/feedbackForms";
import { declareText, type DeclaredText } from "../../translations/translate";
import { useTranslation } from "../../translations/TranslationProvider";
import { DetailList, DetailSection, DetailSurface, EmbeddedForm, PageHeader } from "../../ui/components";
import { Badge, Button } from "../../ui/primitives";

// What Raccoon is, why it exists, how it works, who made it — and two Innoventa forms to write to
// the author. Readable signed out as well, because the bug most worth reporting is the one that
// keeps somebody from signing in; it shows nothing of any workspace, so it needs no session.
//
// ⚠️ ONE SURFACE, ONE GRAMMAR. The page is the product's object-page template — sections on one
// bordered surface, divided by a rule, every label in the one shared column — rather than a layout of
// its own per section. It was five layouts once (two statements, a boxed strip, a table, two fact
// columns, two cards) and read as blocks thrown onto the page.

/* A page that is read rather than worked in: held to a reading width, so prose capped at 72ch does
   not leave the right half of a wide screen empty beside it. */
const PAGE = "grid min-w-0 max-w-[1040px]";

const LEAD = "m-0 max-w-[72ch] text-base text-ink";

const PROSE = "m-0 max-w-[72ch] text-secondary";

const CONNECTION = "grid justify-items-start gap-1 text-secondary";

/* Each form is one independent object, but it already sits on the page's surface — so the two are
   divided by a rule rather than boxed, and the rule moves from the side to the top once they stack.
   ⚠️ `scroll-mt-*` clears the sticky top bar when the page is opened at #contact or #bug-report, and
   the border removals carry `!` because a media query adds no specificity of its own. */
const FORMS = "grid grid-cols-2 items-start gap-6 max-[1100px]:grid-cols-[minmax(0,1fr)]";

const FORM = [
  "grid min-w-0 gap-3 scroll-mt-[calc(52px*var(--ui-scale)+var(--space-4))]",
  "not-first:border-l not-first:border-line not-first:pl-6",
  "max-[1100px]:not-first:border-l-0! max-[1100px]:not-first:border-t max-[1100px]:not-first:pt-6",
  "max-[1100px]:not-first:pl-0",
].join(" ");

const FORM_HEAD = "grid gap-1 [&_p]:m-0";

const FORM_TITLE = "m-0 text-base";

const AUTHOR = {
  name: "Ivan Hontarenko",
  email: "ihontarenko@gmail.com",
  gitHubAddress: "https://github.com/ihontarenko",
  gitHubLabel: "github.com/ihontarenko",
} as const;

/** The path every piece of knowledge takes, in order. */
const CHAIN: readonly { key: string; name: DeclaredText; detail: DeclaredText }[] = [
  {
    key: "sources",
    name: declareText("about.chain.sources", "Sources"),
    detail: declareText(
      "about.chain.sourcesDetail",
      "Local and managed folders, Git repositories, web pages and whole sites, pushed and pasted text. Scanners and rules decide what is taken and why the rest is skipped.",
    ),
  },
  {
    key: "processing",
    name: declareText("about.chain.processing", "Processing"),
    detail: declareText(
      "about.chain.processingDetail",
      "Every change becomes an immutable version. Parsers read Markdown, text, Java and more; chunks stay exact slices of the original, with their lines and offsets.",
    ),
  },
  {
    key: "index",
    name: declareText("about.chain.index", "Index"),
    detail: declareText(
      "about.chain.indexDetail",
      "Keyword entries in PostgreSQL full-text search and vectors in pgvector, published as generations that can be inspected, withdrawn and rebuilt.",
    ),
  },
  {
    key: "search",
    name: declareText("about.chain.search", "Search, ask and agents"),
    detail: declareText(
      "about.chain.searchDetail",
      "Keyword, meaning and hybrid search; context assembled within a budget; answers whose citations are checked; the same operations for assistants over MCP.",
    ),
  },
];

interface Connection {
  name: DeclaredText;
  role: DeclaredText;
  state: "in use" | "planned";
}

const CONNECTIONS: readonly Connection[] = [
  {
    name: declareText("about.connections.libraries", "jMouse libraries"),
    role: declareText(
      "about.connections.librariesRole",
      "jMP decides access, jMS runs scripts at every stage, jMQ answers queries; jmouse-ai carries the providers and the MCP server; storage and files keep originals; grabber reads websites, git reads repositories and the Java parser reads declarations.",
    ),
    state: "in use",
  },
  {
    name: declareText("about.connections.providers", "Voyage and other providers"),
    role: declareText(
      "about.connections.providersRole",
      "Embeddings and reranking through managed provider configurations — Voyage, OpenAI-compatible, Ollama and TEI endpoints. Keys are sealed at rest, and nothing is sent to a provider unless a profile allows it.",
    ),
    state: "in use",
  },
  {
    name: declareText("about.connections.kiwi", "Kiwi"),
    role: declareText(
      "about.connections.kiwiRole",
      "The knowledge base where Raccoon's own decisions and notes are kept. Reading Kiwi pages as a connected source, through Kiwi's consumer access, is the next connector.",
    ),
    state: "planned",
  },
];

/** The words of the two feedback forms; the forms themselves are Innoventa's. */
const FORM_WORDS: Record<FeedbackForm["key"], { title: DeclaredText; description: DeclaredText }> = {
  contact: {
    title: declareText("about.form.contact", "Contact"),
    description: declareText("about.form.contactDescription", "A question, an idea, or a source you would like Raccoon to read."),
  },
  "bug-report": {
    title: declareText("about.form.bugReport", "Bug report"),
    description: declareText("about.form.bugReportDescription", "What happened, how to get there, and what you expected instead."),
  },
};

export function AboutPage() {
  const { t, say } = useTranslation();
  usePageTitle(t("about.pageTitle", "About"));
  const buildMoment = formatDateTime(INTERFACE_BUILD.builtAt.toISOString());

  return (
    <div className={PAGE}>
      <PageHeader
        eyebrow={t("about.eyebrow", "System")}
        title={t("about.title", "About Raccoon")}
        status={<Badge>{t("about.version", "Version {version}", { version: INTERFACE_BUILD.version })}</Badge>}
        actions={
          <>
            <Button href="#contact" variant="quiet" icon="answers">
              {t("about.form.contact", "Contact")}
            </Button>
            <Button href="#bug-report" variant="quiet" icon="edit">
              {t("about.reportBug", "Report a bug")}
            </Button>
          </>
        }
      />

      <DetailSurface>
        <DetailSection title={t("about.overview", "Overview")}>
          <p className={LEAD}>
            {t(
              "about.lead",
              "Knowledge search over your own sources, run on your own machine — every result cites the exact version and lines it came from.",
            )}
          </p>
          <DetailList
            rows={[
              [
                t("about.what", "What it is"),
                <p className={PROSE}>
                  {t(
                    "about.whatText",
                    "Raccoon reads the folders, repositories, web pages and text you point it at, keeps every version of what it read, and lets you search, assemble context and ask questions over it. Whatever it finds is cited to the exact document version and line range, so an answer can always be checked against its source.",
                  )}
                </p>,
              ],
              [
                t("about.why", "Why it exists"),
                <p className={PROSE}>
                  {t(
                    "about.whyText",
                    "Documentation, code and notes are spread over folders, repositories and wikis, and a general assistant answers from what it was trained on rather than from what you actually have. Raccoon answers from your material only. Nothing is used to train a model: the knowledge stays in the documents and the index, and is chosen per question. Search, context and answer are separate steps, so search stays useful with no model at all.",
                  )}
                </p>,
              ],
            ]}
          />
        </DetailSection>

        <DetailSection title={t("about.how", "How it works")}>
          {/* Numbered in the label, because the order is the point: a document passes these in turn. */}
          <DetailList
            rows={CHAIN.map((step, index) => [
              `${index + 1}. ${say(step.name)}`,
              <p className={PROSE}>{say(step.detail)}</p>,
            ])}
          />
        </DetailSection>

        <DetailSection title={t("about.connections.title", "What it connects to")}>
          <DetailList
            rows={CONNECTIONS.map((connection) => [
              say(connection.name),
              <div className={CONNECTION}>
                <Badge tone={connection.state === "in use" ? "good" : "neutral"}>
                  {connection.state === "in use" ? t("about.connections.inUse", "In use") : t("about.connections.planned", "Planned")}
                </Badge>
                <p className={PROSE}>{say(connection.role)}</p>
              </div>,
            ])}
          />
        </DetailSection>

        <DetailSection title={t("about.authorTitle", "Author")}>
          <DetailList
            rows={[
              [t("about.author.name", "Name"), AUTHOR.name],
              [t("about.author.email", "E-mail"), <a href={`mailto:${AUTHOR.email}`}>{AUTHOR.email}</a>],
              [
                "GitHub",
                <a href={AUTHOR.gitHubAddress} target="_blank" rel="noopener noreferrer">
                  {AUTHOR.gitHubLabel}
                </a>,
              ],
            ]}
          />
        </DetailSection>

        <DetailSection title={t("about.buildTitle", "This build")}>
          <DetailList
            rows={[
              [t("about.build.interface", "Interface"), <span className="numeric">{INTERFACE_BUILD.version}</span>],
              [
                INTERFACE_BUILD.kind === "bundle" ? t("about.build.built", "Built") : t("about.build.devServerStarted", "Dev server started"),
                <span className="numeric">{buildMoment}</span>,
              ],
              [
                t("about.build.kind", "Kind"),
                INTERFACE_BUILD.kind === "bundle"
                  ? t("about.build.productionBundle", "Production bundle")
                  : t("about.build.developmentServer", "Development server"),
              ],
            ]}
          />
        </DetailSection>

        <DetailSection title={t("about.write", "Write to the author")}>
          <p className={`${PROSE} text-sm`}>
            {t(
              "about.writeExplained",
              "Both forms are served by Innoventa, the author's forms product at {host}. What you send is stored there as an entry and read by the author — it is not kept in this installation, and Raccoon never sees it.",
              { host: <span className="numeric">{new URL(INNOVENTA_ORIGIN).host}</span> },
            )}
          </p>
          <div className={FORMS}>
            {FEEDBACK_FORMS.map((form) => (
              <section key={form.key} id={form.key} className={FORM} aria-labelledby={`${form.key}-title`}>
                <header className={FORM_HEAD}>
                  <h3 id={`${form.key}-title`} className={FORM_TITLE}>
                    {say(FORM_WORDS[form.key].title)}
                  </h3>
                  <p className="text-xs text-secondary">{say(FORM_WORDS[form.key].description)}</p>
                </header>
                <EmbeddedForm
                  title={t("about.form.frameTitle", "{form} form, served by Innoventa", { form: say(FORM_WORDS[form.key].title) })}
                  address={embedAddressOf(form)}
                  origin={INNOVENTA_ORIGIN}
                  standaloneAddress={standaloneAddressOf(form)}
                />
              </section>
            ))}
          </div>
        </DetailSection>
      </DetailSurface>
    </div>
  );
}
