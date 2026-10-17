import { useState, type ReactNode } from "react";
import { JobTrack } from "../../pages/jobs/JobTrack";
import type { WorkspaceJob } from "../../lib/workspaceJobs";
import { AppearanceControls } from "../../appearance/AppearanceControls";
import { useAppearance } from "../../appearance/AppearanceProvider";
import { explainParameter } from "../../application/parameterExplanations";
import { problemOf } from "../../application/problems";
import { usePageTitle } from "../../application/usePageTitle";
import { declareText } from "../../translations/translate";
import { useTranslation } from "../../translations/TranslationProvider";
import { BrandLockup } from "../brand/BrandLockup";
import { BrandLogoLab } from "../brand/BrandLogoLab";
import {
  FEEDBACK_FORMS,
  INNOVENTA_ORIGIN,
  embedAddressOf,
  standaloneAddressOf,
} from "../../lib/feedbackForms";
import {
  ChipInput,
  ConfirmDialog,
  CopyButton,
  DateRangeField,
  DetailList,
  DetailSection,
  DetailSurface,
  DetailTokens,
  EditorCard,
  EditorCardFields,
  EditorCardList,
  EmbeddedForm,
  EmptyState,
  ExplainParameter,
  Facts,
  Inspector,
  InspectorSection,
  ListFooter,
  Menu,
  Notice,
  PageHeader,
  PresetPicker,
  ParameterFindings,
  PathText,
  ProblemState,
  RowName,
  SectionBar,
  Segmented,
  Statistics,
  TabPanel,
  TabToolbar,
  Tabs,
  Waiting,
  Workbench,
  useToaster,
  type ParameterFinding,
  type PresetChoice,
} from "../components";
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  Field,
  ICON_NAMES,
  Icon,
  Input,
  Select,
  Table,
} from "../primitives";
import { ClosenessSample } from "./ClosenessSample";
import { DocumentPickerSample } from "./DocumentPickerSample";
import { ExplanationSample } from "./ExplanationSample";
import { FORM_GRID, ROW, SECTION, SECTION_HEAD, STACK, STATES, STATE_SAMPLE } from "./kitClasses";

/* The lockup pair, shown at both sizes against the ground each of them really sits on. */
const LOCKUPS = "mb-6 flex flex-wrap items-end gap-12 [&_.eyebrow]:mb-2";

const ICONS = [
  "m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(calc(120px*var(--ui-scale)),1fr))] gap-2 p-0",
  "[&>li]:flex [&>li]:items-center [&>li]:gap-2 [&>li]:rounded-control [&>li]:border [&>li]:border-line",
  "[&>li]:bg-surface [&>li]:px-3 [&>li]:py-2",
].join(" ");

/* The tint a SELECTED table row carries, so a badge specimen can be checked against it — which is
   the whole reason the badges stopped being blue on blue. */
const ON_WELL =
  "rounded-control border border-line bg-well p-3 shadow-[inset_3px_0_0_var(--accent)]";

const EMBEDDED_SAMPLE =
  "max-w-[calc(560px*var(--ui-scale))] rounded-surface border border-line bg-surface p-4";

/* Catalogue controls: the period, a path cut in its middle in a narrow column, a copyable hash. */
const CATALOGUE_SAMPLE = [
  "grid items-end gap-6",
  "grid-cols-[minmax(0,calc(220px*var(--ui-scale)))_minmax(0,calc(260px*var(--ui-scale)))_auto]",
  "max-[700px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

/** The kit shows the frame, not a working list, so every card offers the same three inert actions. */
const EXAMPLE_CARD_ACTIONS = {
  moveUp: { label: "Move up", disabled: true, onClick: () => {} },
  moveDown: { label: "Move down", disabled: false, onClick: () => {} },
  remove: { label: "Remove", onClick: () => {} },
};

function KitSection({
  name,
  title,
  description,
  children,
}: {
  /** A stable identifier for the heading, the same in every language. */
  name: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className={SECTION} aria-labelledby={`kit-${name}`}>
      <div className={SECTION_HEAD}>
        <h2 id={`kit-${name}`}>{title}</h2>
        {description !== undefined && <p className="text-xs text-secondary">{description}</p>}
      </div>
      {children}
    </section>
  );
}

const SAMPLE_JOB: WorkspaceJob = {
  id: "00000000-0000-4000-8000-0000000000aa",
  kind: "DOCUMENT_PARSE",
  work: "PROCESSING",
  status: "QUEUED",
  sourceId: null,
  subject: "README.md",
  documentId: null,
  done: null,
  total: null,
  attemptCount: 0,
  attemptLimit: 3,
  failureCode: null,
  failureDetail: null,
  currentStep: null,
  workerId: null,
  createdAt: "2026-10-07T12:00:00Z",
  updatedAt: "2026-10-07T12:00:00Z",
};

/* Every state the track draws, in the order a job lives through them. */
const JOB_TRACK_SAMPLES: { caption: string; job: WorkspaceJob; workerAlive: boolean }[] = [
  { caption: "Queued", job: SAMPLE_JOB, workerAlive: true },
  { caption: "Queued, no worker", job: SAMPLE_JOB, workerAlive: false },
  { caption: "Taken", job: { ...SAMPLE_JOB, status: "RUNNING", workerId: "local-worker", attemptCount: 1 }, workerAlive: true },
  { caption: "Working · chunking", job: { ...SAMPLE_JOB, status: "RUNNING", done: 1, total: 3, currentStep: "chunk" }, workerAlive: true },
  { caption: "Done", job: { ...SAMPLE_JOB, status: "SUCCEEDED", done: 3, total: 3 }, workerAlive: true },
  { caption: "Failed", job: { ...SAMPLE_JOB, status: "FAILED", failureCode: "DOCUMENT_PARSE_FAILED" }, workerAlive: true },
  { caption: "Cancelled", job: { ...SAMPLE_JOB, status: "CANCELLED" }, workerAlive: true },
];

const SAMPLE_ROWS = [
  {
    name: "README.md",
    state: declareText("uiKit.sample.indexed", "Indexed"),
    tone: "good" as const,
    version: 3,
    chunks: 42,
  },
  {
    name: "architecture.md",
    state: declareText("uiKit.sample.pending", "Pending"),
    tone: "warn" as const,
    version: 1,
    chunks: 0,
  },
  {
    name: "private.txt",
    state: declareText("uiKit.sample.registered", "Registered"),
    tone: "neutral" as const,
    version: 2,
    chunks: 11,
  },
];

export function UiKit() {
  const { t, plural, say } = useTranslation();
  usePageTitle(t("uiKit.title", "UI Kit"));
  const { appearance, changeAppearance } = useAppearance();
  const [samplePeriod, setSamplePeriod] = useState<{ from?: string; until?: string }>({
    from: "2026-10-01",
  });
  const { notify } = useToaster();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [wideOpen, setWideOpen] = useState(false);
  const [chips, setChips] = useState(["*.md", "docs/**", "node_modules/"]);
  const [kitTab, setKitTab] = useState<"chunks" | "entries" | "journal">("chunks");
  const [segment, setSegment] = useState<"all" | "taken" | "skipped">("all");
  const [preset, setPreset] = useState("usual-cleanup");
  const [selectedRow, setSelectedRow] = useState(SAMPLE_ROWS[0].name);
  const selected = SAMPLE_ROWS.find((row) => row.name === selectedRow) ?? SAMPLE_ROWS[0];

  const kitFindings: ParameterFinding[] = [
    {
      tone: "deny",
      text: t(
        "uiKit.parameters.finding",
        "A maximum distance of 0 matches only vectors identical to the question — meaning search returns nothing.",
      ),
    },
  ];
  const maximumDistance = t("uiKit.parameters.maximumDistance", "Maximum distance");
  const maximumQuestionTokens = t(
    "uiKit.parameters.maximumQuestionTokens",
    "Maximum question tokens",
  );
  const versionLabel = t("uiKit.list.version", "Version");
  const chunksLabel = t("uiKit.list.chunks", "Chunks");
  const stateLabel = t("uiKit.list.state", "State");
  const localDocs = t("uiKit.sample.localDocs", "Local docs");

  // Two groups rather than one, because the picker draws a heading per group and a kit that only ever shows one
  // would not say so. The facts are what applying the choice would do, never what the choice is called again.
  const presetChoices: PresetChoice[] = [
    {
      key: "usual-cleanup",
      group: t("uiKit.presets.content", "Content steps"),
      name: t("uiKit.presets.usualCleanup", "Usual cleanup"),
      description: t(
        "uiKit.presets.usualCleanupSummary",
        "What nearly every corpus wants: empty blocks, page furniture, consistent whitespace, and words put back together across a line break.",
      ),
      facts: [plural("uiKit.presets.steps", 4, { one: "{count} step", other: "{count} steps" })],
    },
    {
      key: "minimal",
      group: t("uiKit.presets.content", "Content steps"),
      name: t("uiKit.presets.minimal", "Minimal"),
      description: t(
        "uiKit.presets.minimalSummary",
        "The two nothing is lost by: empty blocks, and one spelling of every space and quote.",
      ),
      facts: [plural("uiKit.presets.steps", 2, { one: "{count} step", other: "{count} steps" })],
    },
    {
      key: "source-code",
      group: t("uiKit.presets.scan", "Scan rules"),
      name: t("uiKit.presets.sourceCode", "A source tree"),
      description: t(
        "uiKit.presets.sourceCodeSummary",
        "Takes what a person wrote and leaves what a tool generated: dependencies, builds, lock files.",
      ),
      facts: [
        plural("uiKit.presets.rules", 7, { one: "{count} rule", other: "{count} rules" }),
        t("uiKit.presets.thenTakes", "then takes the file"),
      ],
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow={t("uiKit.eyebrow", "System")}
        title={t("uiKit.title", "UI Kit")}
        lead={t(
          "uiKit.lead",
          "Every primitive and component the interface is built from, on the shared tokens. All of it responds live to the four appearance axes.",
        )}
      />

      <KitSection
        name="appearance"
        title={t("uiKit.appearance.title", "Appearance")}
        description={t(
          "uiKit.appearance.description",
          "Theme, colour scheme, interface size, typeface and logo are independent axes.",
        )}
      >
        <AppearanceControls state={appearance} onChange={changeAppearance} />
      </KitSection>

      <KitSection
        name="logo"
        title={t("uiKit.logo.title", "Logo")}
        description={t(
          "uiKit.logo.description",
          "The product signs with the face chosen under Appearance — the grey Mask by default — and the lowercase wordmark; both glitch together on one timeline, and stay still under reduced motion.",
        )}
      >
        <div className={LOCKUPS}>
          <div>
            <p className="eyebrow">{t("uiKit.logo.rail", "Rail")}</p>
            <BrandLockup />
          </div>
          <div>
            <p className="eyebrow">{t("uiKit.logo.signIn", "Sign-in")}</p>
            <BrandLockup size="display" />
          </div>
        </div>
        <BrandLogoLab theme={appearance.theme} />
      </KitSection>

      <KitSection
        name="icons"
        title={t("uiKit.icons.title", "Icons")}
        description={t(
          "uiKit.icons.description",
          "One stroked set on a 24-unit grid; an icon takes the colour of the text beside it.",
        )}
      >
        <ul className={ICONS}>
          {ICON_NAMES.map((name) => (
            <li key={name}>
              <Icon name={name} />
              <span className="numeric text-xs">{name}</span>
            </li>
          ))}
        </ul>
      </KitSection>

      <KitSection
        name="buttons"
        title={t("uiKit.buttons.title", "Buttons")}
        description={t(
          "uiKit.buttons.description",
          "One primary action per area. Destructive actions say so on the control.",
        )}
      >
        <div className={ROW}>
          <Button variant="primary">{t("uiKit.buttons.runSearch", "Run search")}</Button>
          <Button>{t("uiKit.buttons.addSource", "Add source")}</Button>
          <Button variant="quiet">{t("common.cancel", "Cancel")}</Button>
          <Button variant="danger">{t("uiKit.buttons.delete", "Delete")}</Button>
          <Button icon="plus">{t("uiKit.buttons.newDocument", "New document")}</Button>
          <Button
            variant="quiet"
            iconOnly
            icon="system"
            aria-label={t("uiKit.buttons.settings", "Settings")}
            title={t("uiKit.buttons.settings", "Settings")}
          />
          <Button disabled>{t("uiKit.buttons.disabled", "Disabled")}</Button>
          <Button href="/search" variant="quiet" icon="arrow">
            {t("uiKit.buttons.linkToSearch", "Link to search")}
          </Button>
        </div>
      </KitSection>

      <KitSection
        name="badges"
        title={t("uiKit.badges.title", "Badges")}
        description={t(
          "uiKit.badges.description",
          "Status is carried by the word; the stripe and colour only reinforce it.",
        )}
      >
        <div className={ROW}>
          <Badge>{t("uiKit.sample.registered", "Registered")}</Badge>
          <Badge tone="active">{t("uiKit.badges.running", "Running")}</Badge>
          <Badge tone="good">{t("uiKit.sample.indexed", "Indexed")}</Badge>
          <Badge tone="warn">{t("uiKit.sample.pending", "Pending")}</Badge>
          <Badge tone="error">{t("uiKit.badges.failed", "Failed")}</Badge>
          <Badge tone="allow">{t("uiKit.sample.taken", "Taken")}</Badge>
          <Badge tone="deny">{t("uiKit.sample.skipped", "Skipped")}</Badge>
        </div>
        <p className="text-xs text-secondary">
          {t(
            "uiKit.badges.colourKinds",
            "Three kinds of colour. Outcomes of work that ran — indexed, pending, failed — are green, amber and red. Verdicts — a rule takes or skips, a source is enabled or not, a check passes or not — are always blue for yes and red for no, under every palette. Places — where a rule set rule runs, and so what runs it — are violet at the door (a source) and teal in the pipeline (a processing profile); they say where, never how it went.",
          )}
        </p>
        <div className={ROW}>
          <Badge tone="door">{t("rules.place.door", "Door")}</Badge>
          <Badge tone="door">{t("rules.holder.source", "Source")}</Badge>
          <Badge tone="pipeline">{t("rules.place.pipeline", "Pipeline")}</Badge>
          <Badge tone="pipeline">{t("rules.holder.profile", "Processing profile")}</Badge>
        </div>
        {/* The case that broke in production: a badge is dropped onto whatever surface its row has, and a
            selected row is tinted. Every tone must still read here, or it will not read in a table. */}
        <div className={ON_WELL}>
          <div className={ROW}>
            <Badge>{t("uiKit.sample.registered", "Registered")}</Badge>
            <Badge tone="active">{t("uiKit.badges.running", "Running")}</Badge>
            <Badge tone="good">{t("uiKit.sample.indexed", "Indexed")}</Badge>
            <Badge tone="warn">{t("uiKit.sample.pending", "Pending")}</Badge>
            <Badge tone="error">{t("uiKit.badges.failed", "Failed")}</Badge>
            <Badge tone="allow">{t("uiKit.sample.taken", "Taken")}</Badge>
            <Badge tone="deny">{t("uiKit.sample.skipped", "Skipped")}</Badge>
            <Badge tone="door">{t("rules.place.door", "Door")}</Badge>
            <Badge tone="pipeline">{t("rules.place.pipeline", "Pipeline")}</Badge>
          </div>
        </div>
        <p className="text-xs text-secondary">
          {t(
            "uiKit.badges.onSelected",
            "The same badges on the tint a selected row carries. A badge keeps an edge of its own tone so it never dissolves into the row underneath it.",
          )}
        </p>
      </KitSection>

      <KitSection
        name="tab-toolbar"
        title={t("uiKit.tabToolbar.title", "Tab toolbar")}
        description={t(
          "uiKit.tabToolbar.description",
          "The band above a tab's content: what the tab shows, and the one control that narrows it. Two readings of one document — its parsed text and the chunks cut from it — are introduced the same way.",
        )}
      >
        <TabToolbar
          control={
            <Select defaultValue="all">
              <option value="all">{t("uiKit.tabToolbar.all", "All chunks")}</option>
            </Select>
          }
        >
          {t(
            "uiKit.tabToolbar.example",
            "Processing cut this version into the pieces below. Each piece is shown as it is indexed.",
          )}
        </TabToolbar>
      </KitSection>

      <KitSection
        name="editor-cards"
        title={t("uiKit.editorCards.title", "Ordered editors")}
        description={t(
          "uiKit.editorCards.description",
          "One frame for the ordered, named condition → action items the product edits in a list: a source's scan rules, a processing profile's content steps. The stripe says what the item does to what it matches; the word beside it says the same thing.",
        )}
      >
        <EditorCardList label={t("uiKit.editorCards.listLabel", "Example items")}>
          <EditorCard
            ordinal={1}
            tone="deny"
            title={t("uiKit.editorCards.first", "Leave dependency folders")}
            marks={<Badge tone="deny">{t("uiKit.editorCards.skips", "Skips")}</Badge>}
            summary={t("uiKit.editorCards.firstSummary", "path contains node_modules/ → skip")}
            actions={EXAMPLE_CARD_ACTIONS}
          />
          <EditorCard
            ordinal={2}
            tone="allow"
            title={t("uiKit.editorCards.second", "Take documentation")}
            marks={<Badge tone="allow">{t("uiKit.editorCards.takes", "Takes")}</Badge>}
            summary={t("uiKit.editorCards.secondSummary", "path matches docs/** → take")}
            actions={EXAMPLE_CARD_ACTIONS}
          >
            <EditorCardFields>
              <Field label={t("uiKit.editorCards.when", "When")}>
                <Select defaultValue="CONTAINS">
                  <option value="CONTAINS">
                    {t("uiKit.editorCards.contains", "the path contains")}
                  </option>
                </Select>
              </Field>
              <Field label={t("uiKit.editorCards.then", "Then")}>
                <Select defaultValue="INCLUDE">
                  <option value="INCLUDE">{t("uiKit.editorCards.takeIt", "take the file")}</option>
                </Select>
              </Field>
            </EditorCardFields>
          </EditorCard>
          <EditorCard
            ordinal={3}
            resting
            title={t("uiKit.editorCards.third", "Drop page edges")}
            summary={t("uiKit.editorCards.thirdSummary", "block kind is PAGE_FURNITURE → drop")}
            toggle={
              <Checkbox
                label={<span className="sr-only">{t("uiKit.editorCards.runs", "It runs")}</span>}
                checked={false}
                readOnly
              />
            }
            actions={EXAMPLE_CARD_ACTIONS}
          />
        </EditorCardList>
      </KitSection>

      <KitSection
        name="presets"
        title={t("uiKit.presets.title", "Ready-made starting points")}
        description={t(
          "uiKit.presets.description",
          "How a shipped starting point is chosen: every candidate open, with what it is for and what applying it would do. Never a closed list — a preset is a dozen settings, and a description that lives in a tooltip exists for nobody. The caller owns the button, because only it knows what applying means.",
        )}
      >
        <PresetPicker
          label={t("uiKit.presets.label", "Start from a ready set")}
          hint={t(
            "uiKit.presets.hint",
            "What is created is an ordinary rule set afterwards, and is edited like any other.",
          )}
          choices={presetChoices}
          selectedKey={preset}
          onSelect={setPreset}
          action={
            <Button variant="quiet" icon="plus" disabled>
              {t("uiKit.presets.apply", "Create this set")}
            </Button>
          }
        />
      </KitSection>

      <KitSection
        name="notices"
        title={t("uiKit.notices.title", "Notices")}
        description={t(
          "uiKit.notices.description",
          "Context inside a page. Errors are announced to assistive technology.",
        )}
      >
        <div className={STACK}>
          <Notice title={t("uiKit.notices.lexicalTitle", "Ran as lexical instead of hybrid")}>
            {t("uiKit.notices.lexicalBody", "The profile has no embedding provider configured.")}
          </Notice>
          <Notice tone="good" title={t("uiKit.notices.publishedTitle", "Index published")}>
            {t("uiKit.notices.publishedBody", "Search now reads generation 2.")}
          </Notice>
          <Notice
            tone="warn"
            title={t("uiKit.notices.processingTitle", "A newer version is still processing")}
          >
            {t("uiKit.notices.processingBody", "Search keeps using the previous one.")}
          </Notice>
          <Notice
            tone="error"
            title={t("uiKit.notices.unavailableTitle", "Embedding provider unavailable")}
          >
            {t(
              "uiKit.notices.unavailableBody",
              "The original is stored; the active version stays searchable.",
            )}
          </Notice>
          <Notice
            tone="warn"
            title={t("uiKit.notices.removedTitle", "Removed {time}", {
              time: "05 Oct 2026, 09:09",
            })}
            action={<Button icon="refresh">{t("uiKit.notices.restore", "Restore")}</Button>}
          >
            {t(
              "uiKit.notices.actionBody",
              "A notice with an action: the one thing to do about it sits beside the text, and under it when narrow.",
            )}
          </Notice>
        </div>
      </KitSection>

      <KitSection
        name="parameters"
        title={t("uiKit.parameters.title", "Parameter explanations")}
        description={t(
          "uiKit.parameters.description",
          "An information button at the end of a parameter's label opens what it is, what it affects, its safe value, its extremes and an example. Findings on the value as it stands sit under the field: red stops work, amber deserves a look; the button takes the worst tone. Content comes from application/parameterExplanations.",
        )}
      >
        <div className={STACK}>
          <Field
            label={maximumDistance}
            labelAside={
              <ExplainParameter
                name={maximumDistance}
                identifier="retrieval.semantic.maximumDistance"
                explanation={explainParameter("search", "retrieval.semantic.maximumDistance", {
                  title: maximumDistance,
                })}
                findings={kitFindings}
                facts={[
                  {
                    label: t("uiKit.parameters.allowed", "Allowed"),
                    value: t("uiKit.parameters.allowedValue", "0 – … native vector distance"),
                  },
                  {
                    label: t("uiKit.parameters.takesEffect", "Takes effect"),
                    value: t("uiKit.parameters.takesEffectValue", "from the next search"),
                  },
                ]}
              />
            }
            hint={<ParameterFindings findings={kitFindings} />}
          >
            <Input type="number" className="numeric" defaultValue="0" />
          </Field>
          <Field
            label={maximumQuestionTokens}
            labelAside={
              <ExplainParameter
                name={maximumQuestionTokens}
                explanation={explainParameter("search", "retrieval.semantic.maximumQueryTokens", {
                  title: maximumQuestionTokens,
                })}
              />
            }
          >
            <Input type="number" className="numeric" defaultValue="2000" />
          </Field>
        </div>
      </KitSection>

      <KitSection
        name="closeness"
        title={t("uiKit.closeness.title", "Closeness")}
        description={t(
          "uiKit.closeness.description",
          "How near a result is to its question, drawn only from the numbers the search returned. The waves are the question and the result offset by the angle between their vectors — two waves that far apart correlate by exactly the cosine similarity. Left is always closer; blue is within the profile's cut-off, red beyond it. Sample: a hybrid cosine search with a 0.50 distance cut-off.",
        )}
      >
        <ClosenessSample />
      </KitSection>

      <KitSection
        name="explanation"
        title={t("uiKit.explanation.title", "Why a hit was found")}
        description={t(
          "uiKit.explanation.description",
          "Read only from what the search returned. The rank cell shows the final place and how far the rerank model moved it. Found by names each retrieval stage with the place it gave the hit, and the symbol boost when the query named a declaration. Matched query terms are marked in the excerpt, including inside identifiers; missing terms are struck through. The term table measures each query term against the result, and the ladder draws fused order against reranked order. Sample: a reranked hybrid search for «bean definition strategy».",
        )}
      >
        <ExplanationSample />
      </KitSection>

      <KitSection
        name="menu"
        title={t("uiKit.menu.title", "Menu")}
        description={t(
          "uiKit.menu.description",
          "Actions behind a ⋯ button. Arrow keys move through it, Escape and a click outside close it, a destructive item is last and red.",
        )}
      >
        <div className={ROW}>
          <Menu
            label={t("uiKit.menu.label", "Actions for {name}", { name: "README.md" })}
            items={[
              {
                label: t("uiKit.menu.open", "Open"),
                icon: "eye",
                onSelect: () => notify({ tone: "good", title: t("uiKit.menu.open", "Open") }),
              },
              {
                label: t("uiKit.menu.download", "Download"),
                icon: "download",
                onSelect: () =>
                  notify({ tone: "good", title: t("uiKit.menu.download", "Download") }),
              },
              {
                label: t("uiKit.menu.removeFromCorpus", "Remove from the corpus"),
                icon: "trash",
                destructive: true,
                onSelect: () => notify({ tone: "error", title: t("uiKit.menu.remove", "Remove") }),
              },
            ]}
          />
        </div>
      </KitSection>

      <KitSection
        name="toasts"
        title={t("uiKit.toasts.title", "Toasts")}
        description={t(
          "uiKit.toasts.description",
          "Transient outcome of an action. Errors stay longer; hovering or focusing pauses them.",
        )}
      >
        <div className={ROW}>
          <Button
            onClick={() => {
              notify({ title: t("uiKit.toasts.profileSelected", "Search profile selected") });
            }}
          >
            {t("uiKit.toasts.neutral", "Neutral toast")}
          </Button>
          <Button
            onClick={() => {
              notify({
                tone: "good",
                title: t("uiKit.toasts.saved", "{name} saved", { name: localDocs }),
                description: t("uiKit.toasts.revision", "Revision {revision}", { revision: 2 }),
              });
            }}
          >
            {t("uiKit.toasts.success", "Success toast")}
          </Button>
          <Button
            onClick={() => {
              notify({
                tone: "error",
                title: t("uiKit.toasts.changedElsewhere", "Changed elsewhere"),
                description: t("uiKit.toasts.reload", "Reload the record and try again."),
              });
            }}
          >
            {t("uiKit.toasts.error", "Error toast")}
          </Button>
        </div>
      </KitSection>

      <KitSection
        name="forms"
        title={t("uiKit.forms.title", "Form controls")}
        description={t(
          "uiKit.forms.description",
          "Every field has a visible label; hints and errors are tied to their field.",
        )}
      >
        <div className={FORM_GRID}>
          <Field label={t("uiKit.forms.workspaceName", "Workspace name")}>
            <Input defaultValue={t("uiKit.forms.workspaceNameValue", "Demo knowledge")} />
          </Field>
          <Field label={t("uiKit.forms.retrievalBackend", "Retrieval backend")}>
            <Select defaultValue="postgresql-retrieval">
              <option value="postgresql-retrieval">
                {t("uiKit.forms.postgresqlRetrieval", "PostgreSQL retrieval")}
              </option>
              <option value="postgresql-fts">
                {t("uiKit.forms.postgresqlFullText", "PostgreSQL full-text")}
              </option>
            </Select>
          </Field>
          <Field
            label={t("uiKit.forms.resultLimit", "Result limit")}
            hint={t("uiKit.forms.resultLimitHint", "Maximum hits returned by a single query.")}
            required
          >
            <Input type="number" defaultValue={25} min={1} max={100} />
          </Field>
          <Field
            label={t("uiKit.forms.tokenBudget", "Embedding token budget")}
            error={t("uiKit.forms.tokenBudgetError", "Must be a positive whole number.")}
          >
            <Input defaultValue="-1" />
          </Field>
          <Field label={t("uiKit.forms.disabledField", "Disabled field")}>
            <Input defaultValue={t("uiKit.forms.readOnly", "Read only")} disabled />
          </Field>
        </div>
        <DocumentPickerSample />
      </KitSection>

      <KitSection
        name="list"
        title={t("uiKit.list.title", "List and inspector")}
        description={t(
          "uiKit.list.description",
          "A list and its detail column share one surface and one edge.",
        )}
      >
        <Workbench>
          <section aria-label={t("uiKit.list.sampleDocuments", "Sample documents")}>
            <SectionBar>
              <span className="text-xs text-secondary">
                {t("uiKit.list.sampleDocuments", "Sample documents")}
              </span>
              <Button
                variant="quiet"
                icon="refresh"
                onClick={() => {
                  notify({ title: t("uiKit.list.refreshed", "Sample list refreshed") });
                }}
              >
                {t("uiKit.list.refresh", "Refresh")}
              </Button>
            </SectionBar>
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t("uiKit.list.document", "Document")}</th>
                  <th scope="col">{stateLabel}</th>
                  <th scope="col" className="numeric">
                    {versionLabel}
                  </th>
                  <th scope="col" className="numeric">
                    {chunksLabel}
                  </th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_ROWS.map((row) => (
                  <tr key={row.name} data-selected={row.name === selected.name}>
                    <td>
                      <RowName
                        selected={row.name === selected.name}
                        onSelect={() => {
                          setSelectedRow(row.name);
                        }}
                      >
                        {row.name}
                      </RowName>
                    </td>
                    <td>
                      <Badge tone={row.tone}>{say(row.state)}</Badge>
                    </td>
                    <td className="numeric">{row.version}</td>
                    <td className="numeric">{row.chunks}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <ListFooter
              shown={SAMPLE_ROWS.length}
              counted={plural("uiKit.list.count", SAMPLE_ROWS.length, {
                one: "{count} document",
                other: "{count} documents",
              })}
              hasMore
              loadingMore={false}
              moreProblem={null}
              onLoadMore={() => {
                notify({
                  title: t("uiKit.list.noFurtherPage", "The sample list has no further page"),
                });
              }}
            />
          </section>
          <Inspector
            label={t("uiKit.list.selectedSample", "Selected sample")}
            eyebrow={localDocs}
            title={selected.name}
          >
            <InspectorSection title={versionLabel}>
              <Facts
                rows={[
                  [stateLabel, <Badge tone={selected.tone}>{say(selected.state)}</Badge>],
                  [versionLabel, `v${selected.version}`],
                  [chunksLabel, <span className="numeric">{selected.chunks}</span>],
                ]}
              />
            </InspectorSection>
          </Inspector>
        </Workbench>
      </KitSection>

      <KitSection
        name="detail-sections"
        title={t("uiKit.detail.title", "Detail sections")}
        description={t(
          "uiKit.detail.description",
          "An object's settings on its detail page: one surface, sections divided by a rule, labels in one column of one width. Parsers, chunkers and content steps use it.",
        )}
      >
        <DetailSurface>
          <DetailSection title={t("uiKit.detail.reads", "What it reads")}>
            <DetailList
              rows={[
                [
                  t("uiKit.detail.mediaTypes", "Media types"),
                  <DetailTokens values={["text/*", "application/json", "application/xml"]} />,
                ],
                [
                  t("uiKit.detail.extensions", "Extensions"),
                  <DetailTokens values={[".txt", ".log", ".csv"]} />,
                ],
                [
                  t("uiKit.detail.handsOn", "Hands on"),
                  t("uiKit.detail.handsOnValue", "headings, paragraphs, list items"),
                ],
              ]}
            />
          </DetailSection>
          <DetailSection title={t("uiKit.detail.options", "Options")}>
            <p className="text-secondary">
              {t("uiKit.detail.noOptions", "None — it reads the same way under every profile.")}
            </p>
          </DetailSection>
        </DetailSurface>
      </KitSection>

      <KitSection
        name="statistics"
        title={t("uiKit.statistics.title", "Statistics, tabs and filters")}
        description={t(
          "uiKit.statistics.description",
          "A strip of counts reads like an instrument; tabs switch views of one thing; a segmented filter narrows a list.",
        )}
      >
        <div className={STACK}>
          <Statistics
            label={t("uiKit.statistics.label", "Sample statistics")}
            items={[
              { label: t("uiKit.statistics.documents", "Documents"), value: "128" },
              {
                label: t("uiKit.statistics.notProcessed", "Not processed"),
                value: "6",
                tone: "warn",
              },
              { label: t("uiKit.statistics.searchable", "Searchable"), value: "122", tone: "good" },
              { label: t("uiKit.statistics.vectors", "Vectors"), value: "3,904" },
            ]}
          />
          <Tabs<"chunks" | "entries" | "journal">
            label={t("uiKit.statistics.tabs", "Sample tabs")}
            active={kitTab}
            onSelect={setKitTab}
            items={[
              { key: "chunks", label: chunksLabel, count: 42 },
              {
                key: "entries",
                label: t("uiKit.statistics.indexEntries", "Index entries"),
                marker: "changed",
              },
              {
                key: "journal",
                label: t("uiKit.statistics.journal", "Journal"),
                marker: "invalid",
              },
            ]}
          />
          <TabPanel tabKey={kitTab}>
            <Segmented<"all" | "taken" | "skipped">
              label={t("uiKit.statistics.filter", "Sample filter")}
              value={segment}
              onChange={setSegment}
              options={[
                { value: "all", label: t("uiKit.statistics.all", "All"), count: 178 },
                { value: "taken", label: t("uiKit.sample.taken", "Taken"), count: 22 },
                { value: "skipped", label: t("uiKit.sample.skipped", "Skipped"), count: 156 },
              ]}
            />
          </TabPanel>
        </div>
      </KitSection>

      <KitSection
        name="chips"
        title={t("uiKit.chips.title", "Chips")}
        description={t(
          "uiKit.chips.description",
          "Short values as removable chips; Enter or a comma adds, a pasted list is split.",
        )}
      >
        <ChipInput
          values={chips}
          onChange={setChips}
          listLabel={t("uiKit.chips.patterns", "Patterns")}
          addLabel={t("uiKit.chips.addPattern", "Add a pattern")}
          removeLabel={(value) =>
            t("uiKit.chips.removePattern", "Remove pattern {value}", { value })
          }
          code
          placeholder="*.md"
        />
      </KitSection>

      <KitSection
        name="states"
        title={t("uiKit.states.title", "States")}
        description={t(
          "uiKit.states.description",
          "Loading keeps the layout; empty explains the next step; a problem says what failed and what to do.",
        )}
      >
        <div className={STATES}>
          <div className={STATE_SAMPLE}>
            <p className="eyebrow">{t("uiKit.states.loading", "Loading")}</p>
            <Waiting label={t("uiKit.states.loadingSample", "Loading sample")} />
          </div>
          <div className={STATE_SAMPLE}>
            <p className="eyebrow">{t("uiKit.states.empty", "Empty")}</p>
            <EmptyState
              title={t("uiKit.states.noDocuments", "No documents yet")}
              description={t(
                "uiKit.states.noDocumentsDescription",
                "Documents appear once a source has been scanned.",
              )}
              action={
                <Button href="/sources" icon="sources">
                  {t("uiKit.states.goToSources", "Go to sources")}
                </Button>
              }
            />
          </div>
          <div className={STATE_SAMPLE}>
            <p className="eyebrow">{t("uiKit.states.problem", "Problem")}</p>
            <ProblemState
              layout="section"
              problem={problemOf("unavailable")}
              actions={
                <Button
                  icon="refresh"
                  onClick={() => {
                    notify({
                      tone: "error",
                      title: t("uiKit.states.stillUnreachable", "Still unreachable"),
                      description: t("uiKit.states.sampleNote", "This is a sample."),
                    });
                  }}
                >
                  {t("common.tryAgain", "Try again")}
                </Button>
              }
            />
          </div>
        </div>
      </KitSection>

      <KitSection
        name="dialogs"
        title={t("uiKit.dialogs.title", "Dialogs")}
        description={t(
          "uiKit.dialogs.description",
          "Focus is trapped while open and returns to the trigger. Escape closes.",
        )}
      >
        <div className={ROW}>
          <Button icon="layers" onClick={() => setWideOpen(true)}>
            {t("uiKit.dialogs.openWide", "Open a wide dialog")}
          </Button>
          <Button
            onClick={() => {
              setDialogOpen(true);
            }}
          >
            {t("uiKit.dialogs.open", "Open dialog")}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setConfirmOpen(true);
            }}
          >
            {t("uiKit.dialogs.confirmDestructive", "Confirm a destructive action")}
          </Button>
        </div>
        <Dialog
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false);
          }}
          title={t("uiKit.dialogs.renameSource", "Rename source")}
          footer={
            <>
              <Button
                variant="quiet"
                onClick={() => {
                  setDialogOpen(false);
                }}
              >
                {t("common.cancel", "Cancel")}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setDialogOpen(false);
                }}
              >
                {t("common.save", "Save")}
              </Button>
            </>
          }
        >
          <Field label={t("uiKit.dialogs.name", "Name")} required>
            <Input defaultValue={localDocs} fullWidth />
          </Field>
        </Dialog>
        <ConfirmDialog
          open={confirmOpen}
          title={t("uiKit.dialogs.disableSource", "Disable source")}
          confirmLabel={t("uiKit.dialogs.disableSource", "Disable source")}
          destructive
          onConfirm={() => {
            setConfirmOpen(false);
            notify({
              tone: "good",
              title: t("uiKit.dialogs.disabled", "{name} disabled", { name: localDocs }),
            });
          }}
          onCancel={() => {
            setConfirmOpen(false);
          }}
        >
          <p>
            {t("uiKit.dialogs.disableBody", "{name} stops being scanned. Its documents stay.", {
              name: localDocs,
            })}
          </p>
        </ConfirmDialog>
      </KitSection>
      <KitSection
        name="job-track"
        title={t("uiKit.jobTrack.title", "Job track")}
        description={t(
          "uiKit.jobTrack.description",
          "Where a background job stands: Queued → Taken → Working → Done or Failed. Passed stops are green, the current one breathes in the accent, a queue with no worker to take it is amber, a failure is red; the word under each dot carries the state without the colour. Used in the header's activity panel and on Jobs.",
        )}
      >
        <div className="grid gap-4">
          {JOB_TRACK_SAMPLES.map((sample) => (
            <div key={sample.caption} className="grid grid-cols-[calc(180px*var(--ui-scale))_1fr] items-center gap-3 max-[700px]:grid-cols-1">
              <span className="text-xs text-secondary">{sample.caption}</span>
              <JobTrack job={sample.job} workerAlive={sample.workerAlive} />
            </div>
          ))}
        </div>
      </KitSection>
      <KitSection
        name="embedded"
        title={t("uiKit.embedded.title", "Embedded form")}
        description={t(
          "uiKit.embedded.description",
          "A form another product owns, framed in place: it takes the height the page inside reports, ignores messages from any other frame, always offers the form on its own page, and turns into a warning with Try again when the frame stays silent for 15 seconds. Used on About for Innoventa's forms.",
        )}
      >
        <div className={EMBEDDED_SAMPLE}>
          <EmbeddedForm
            title={t("uiKit.embedded.formTitle", "Contact form, served by Innoventa")}
            address={embedAddressOf(FEEDBACK_FORMS[0])}
            origin={INNOVENTA_ORIGIN}
            standaloneAddress={standaloneAddressOf(FEEDBACK_FORMS[0])}
          />
        </div>
      </KitSection>
      <KitSection
        name="catalogue-controls"
        title={t("uiKit.catalogue.title", "Catalogue controls")}
        description={t(
          "uiKit.catalogue.description",
          "From the Documents page. A period of days as one control, written in the interface's own date format; a path cut in its middle so its start and its name both stay readable; a copy button beside an identifier or a hash.",
        )}
      >
        <div className={CATALOGUE_SAMPLE}>
          <DateRangeField
            label={t("uiKit.catalogue.period", "Captured")}
            from={samplePeriod.from}
            until={samplePeriod.until}
            onChange={setSamplePeriod}
          />
          <div className="pb-[calc(6px*var(--ui-scale))] text-xs text-muted">
            <PathText
              path="system/apps_experiments/111_micropython/source/py/ringbuf.h"
              fit="middle"
            />
          </div>
          <span className="inline-flex items-center gap-1">
            <span className="numeric">a288bb63e714f3e3…</span>
            <CopyButton
              value="a288bb63e714f3e3"
              label={t("uiKit.catalogue.copy", "Copy the sample hash")}
            />
          </span>
        </div>
      </KitSection>
      <Dialog
        open={wideOpen}
        onClose={() => setWideOpen(false)}
        title={t("uiKit.wide.title", "A wide dialog")}
        size="wide"
      >
        <p className="text-secondary">
          {t(
            "uiKit.wide.body",
            "For a dialog that holds a table, a report or a preflight. A short form keeps the regular width.",
          )}
        </p>
        <Statistics
          label={t("uiKit.wide.preflight", "Sample preflight")}
          items={[
            { label: chunksLabel, value: "1" },
            { label: t("uiKit.wide.tokensToSend", "Tokens to send"), value: "17" },
            {
              label: t("uiKit.wide.estimatedCost", "Estimated cost"),
              value: t("uiKit.wide.unknown", "Unknown"),
              tone: "warn",
            },
          ]}
        />
      </Dialog>
    </>
  );
}
