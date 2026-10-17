import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Can } from "../../access/Can";
import { PERMISSIONS } from "../../access/permissions";
import { describeProblem, type Problem } from "../../application/problems";
import { useReadySession } from "../../application/session";
import { usePageTitle } from "../../application/usePageTitle";
import { useResource } from "../../application/useResource";
import { api } from "../../lib/api";
import type { SourceKind, SourceView } from "../../lib/contracts";
import { EmptyState, Notice, PageHeader, PathText, PresetChoices, Waiting, useToaster } from "../../ui/components";
import { Badge, Button, Checkbox, Field, Input, Select, TextArea } from "../../ui/primitives";
import { FolderPicker } from "./FolderPicker";
import { ruleSetsApi } from "../../lib/ruleSets";
import { presetChoices, presetName, presetsForKind, startingPreset } from "../rules/presetCatalogue";
import { SOURCE_KINDS, isScanned } from "./sourceKinds";
import { bindNewRuleSet, startScan } from "./sourceOperations";
import { gitOptionsOf } from "./gitOptions";
import {
  NEW_WEB_CRAWL,
  WebCrawlFields,
  describeWebCrawl,
  validateWebCrawl,
  webCrawlOptionsOf,
  type WebCrawlErrors,
} from "./WebCrawlFields";
import {
  ConnectedScopes,
  NEW_CONNECTED,
  connectedOptionsOfDraft,
  validateConnected,
  type ConnectedErrors,
} from "./ConnectedScopes";
import { SourceConnectionField } from "./SourceConnectionField";
import { orderedTypes } from "../administration/connections/connectionTypes";
import {
  connectionsApi,
  scopePathText,
  type ConnectionChoice,
  type ConnectionResource,
  type ConnectionTypeDescriptor,
} from "../../lib/connections";
import { useTranslation } from "../../translations/TranslationProvider";
import { declareText, type DeclaredText } from "../../translations/translate";
import {
  CRUMB,
  KINDS,
  KIND_OPTION,
  KIND_TEXT,
  LAYOUT,
  STEP,
  STEPS,
  STEP_NUMBER,
  STEP_TITLE,
  SUMMARY,
  SUMMARY_ACTIONS,
  SUMMARY_FACTS,
  SUMMARY_TITLE,
} from "./newSourceClasses";

const NAME_LIMIT = 160;
const LOCATION_LIMIT = 2048;

/** Where creating stopped, when it did not get all the way. */
type Outcome = { created: SourceView; problem: Problem; stage: "rules" | "scan" };

/** The toast title when a source was added but a step after it was not taken; `{name}` is the source. */
const UNFINISHED_STAGE: Record<Outcome["stage"], DeclaredText> = {
  rules: declareText("sourceSetup.unfinished.rules", "{name} added, but its rules were not saved"),
  scan: declareText("sourceSetup.unfinished.scan", "{name} added, but the scan did not start"),
};

/**
 * One entry of the flat type list: a connection type — a built-in kind or one knowledge base — or a kind that lives in
 * Raccoon itself and reads through no connection.
 */
interface SourceType {
  key: string;
  kind: SourceKind;
  label: string;
  /** Configured through a connection the source picks. */
  connected: boolean;
}

/** Kinds that live in Raccoon itself: no system to connect to, so no connection. */
const KINDS_WITHOUT_CONNECTION: SourceKind[] = ["MANAGED_FOLDER", "CUSTOM_TEXT"];

function sourceTypesOf(descriptors: ConnectionTypeDescriptor[]): SourceType[] {
  return [
    ...orderedTypes(descriptors).map((descriptor) => ({
      key: descriptor.type,
      kind: descriptor.kind,
      label:
        descriptor.connector === null
          ? SOURCE_KINDS[descriptor.kind].label
          : descriptor.displayName,
      connected: true,
    })),
    ...KINDS_WITHOUT_CONNECTION.map((kind) => ({
      key: kind,
      kind,
      label: SOURCE_KINDS[kind].label,
      connected: false,
    })),
  ];
}

/** The last segment of a path, on either separator, as a name a person would give the folder. */
function folderName(path: string): string {
  const segments = path
    .trim()
    .split(/[\\/]+/)
    .filter((segment) => segment.length > 0);
  return segments.at(-1)?.replace(/:$/, "") ?? "";
}

/** A name a person would give the source, read from its location: the folder, the repository, the site. */
function suggestedName(kind: SourceKind, location: string): string {
  if (kind === "GIT") {
    return folderName(location).replace(/\.git$/i, "");
  }
  if (kind === "WEB") {
    try {
      return new URL(location.trim()).hostname;
    } catch {
      return "";
    }
  }
  return kind === "LOCAL_FOLDER" ? folderName(location) : "";
}

/** The legend of the "What to take" step, which names its radio group. */
const WHAT_TO_TAKE_ID = "new-source-what-to-take";

interface Catalogue {
  types: SourceType[];
  choices: ConnectionChoice[];
}

// One page rather than a dialog: the type, the connection, what to take inside it, a name and the rules are
// separate decisions, and the summary beside them shows what "Create" is about to do before it is pressed.
export function NewSourcePage() {
  const { t, say } = useTranslation();
  usePageTitle(t("sourceSetup.title", "Add source"));
  const { workspace } = useReadySession();
  const navigate = useNavigate();
  const { notify } = useToaster();
  const workspaceId = workspace?.id ?? null;
  const catalogue = useResource<Catalogue>(async () => {
    if (workspaceId === null) {
      return { types: [], choices: [] };
    }
    const [types, choices] = await Promise.all([
      connectionsApi.workspaceTypes(workspaceId),
      connectionsApi.choices(workspaceId),
    ]);
    return { types: sourceTypesOf(types), choices };
  }, [workspaceId]);
  const [typeKey, setTypeKey] = useState("LOCAL_FOLDER");
  const [chosenConnectionId, setChosenConnectionId] = useState("");
  const [location, setLocation] = useState("");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [presetKey, setPresetKey] = useState("");
  const presetCatalogue = useResource(
    async () => (workspaceId === null ? [] : (await ruleSetsApi.vocabulary(workspaceId)).presets),
    [workspaceId],
  );
  const [scanAfterwards, setScanAfterwards] = useState(true);
  const [errors, setErrors] = useState<{
    name?: string;
    location?: string;
    connection?: string;
    crawl?: WebCrawlErrors;
    connected?: ConnectedErrors;
  }>({});
  const [problem, setProblem] = useState<Problem | null>(null);
  const [creating, setCreating] = useState(false);
  const [branch, setBranch] = useState("");
  const [furtherAddresses, setFurtherAddresses] = useState("");
  const [crawl, setCrawl] = useState(NEW_WEB_CRAWL);
  const [connected, setConnected] = useState(NEW_CONNECTED);

  if (workspaceId === null) {
    return (
      <>
        <PageHeader
          eyebrow={t("sourceSetup.eyebrow", "Sources")}
          title={t("sourceSetup.title", "Add source")}
        />
        <EmptyState
          title={t("sourceSetup.noWorkspace.title", "No workspace")}
          description={t(
            "sourceSetup.noWorkspace.description",
            "Sources belong to a workspace, and you are not a member of any yet.",
          )}
        />
      </>
    );
  }

  const sourceTypes = catalogue.status === "ready" ? catalogue.data.types : [];
  const sourceType: SourceType = sourceTypes.find((candidate) => candidate.key === typeKey) ?? {
    key: typeKey,
    kind: "LOCAL_FOLDER",
    label: SOURCE_KINDS.LOCAL_FOLDER.label,
    connected: true,
  };
  const kind = sourceType.kind;
  const description = SOURCE_KINDS[kind];
  const scanned = isScanned(kind);
  // A knowledge base chooses its connection together with its sections; every other connected type here.
  const choosesConnectionHere = sourceType.connected && kind !== "CONNECTED";
  const typeChoices =
    catalogue.status === "ready"
      ? catalogue.data.choices.filter((choice) => choice.type === typeKey)
      : [];
  // The only connection of a type is taken without asking.
  const connectionId = typeChoices.some((choice) => choice.id === chosenConnectionId)
    ? chosenConnectionId
    : typeChoices.length === 1
      ? typeChoices[0].id
      : "";
  const connection = typeChoices.find((choice) => choice.id === connectionId) ?? null;
  // Only presets written for this kind are offered; one chosen for another kind falls back to this kind's start.
  const offeredPresets = presetCatalogue.status === "ready" ? presetsForKind(presetCatalogue.data, kind) : [];
  const preset =
    offeredPresets.find((candidate) => candidate.key === presetKey) ??
    startingPreset(offeredPresets, ["everything", "empty"]);
  const shownName = nameTouched
    ? name
    : kind === "CONNECTED"
      ? (connected.scopes[0]?.path.at(-1) ?? "")
      : suggestedName(kind, location);
  const showsPlaceStep =
    description.locationLabel !== null && (!choosesConnectionHere || connectionId !== "");
  // Steps are numbered as they appear, so a type with fewer of them never skips a number.
  let stepCount = 1;
  const nextStep = () => {
    stepCount += 1;
    return stepCount;
  };

  const chooseLocation = (path: string) => {
    setLocation(path);
    setErrors((current) => ({ ...current, location: undefined }));
  };

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (shownName.trim().length === 0) {
      next.name = t("sourceSetup.error.name", "Give the source a name.");
    }
    if (choosesConnectionHere && connectionId === "") {
      next.connection = t(
        "sourceSetup.error.connection",
        "Choose the connection this source reads through.",
      );
    }
    if (description.locationLabel !== null && location.trim().length === 0) {
      next.location =
        kind === "LOCAL_FOLDER"
          ? t("sourceSetup.error.folder", "Choose the folder to scan.")
          : t("sourceSetup.error.location", "Give the {location}.", {
              location: description.locationLabel.toLowerCase(),
            });
    }
    if (kind === "WEB") {
      const crawlErrors = validateWebCrawl(crawl);
      if (crawlErrors.linkDepth !== undefined || crawlErrors.maximumPages !== undefined) {
        next.crawl = crawlErrors;
      }
    }
    if (kind === "CONNECTED") {
      const connectedErrors = validateConnected(connected);
      if (connectedErrors.connection !== undefined || connectedErrors.scopes !== undefined) {
        next.connected = connectedErrors;
      }
    }
    setErrors(next);
    return Object.values(next).every((value) => value === undefined);
  };

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!validate()) {
      // The first field that needs attention takes focus once its error is on screen.
      window.requestAnimationFrame(() => {
        form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      });
      return;
    }
    setCreating(true);
    setProblem(null);
    let created: SourceView;
    try {
      created = await api.createSource(workspaceId, {
        kind,
        name: shownName.trim(),
        location: description.locationLabel === null ? undefined : location.trim(),
        connectionId:
          kind === "CONNECTED"
            ? connected.connectionId
            : choosesConnectionHere
              ? connectionId
              : undefined,
        options: optionsOf(),
      });
    } catch (error) {
      setProblem(describeProblem(error));
      setCreating(false);
      return;
    }
    const outcome = await prepare(created);
    if (outcome === null) {
      notify({
        tone: "good",
        title: t("sourceSetup.added", "{name} added", { name: created.name }),
        description:
          scanned && scanAfterwards
            ? t("sourceSetup.firstScanStarted", "The first scan has started.")
            : undefined,
      });
    } else {
      // The source exists either way; the page it lands on is where the unfinished step is done.
      notify({
        tone: "error",
        title: say(UNFINISHED_STAGE[outcome.stage], { name: created.name }),
        description: outcome.problem.detail ?? outcome.problem.description,
      });
    }
    const tab =
      outcome?.stage === "rules" ? "rules" : scanned && scanAfterwards ? "scans" : undefined;
    void navigate({
      to: "/sources/$sourceId",
      params: { sourceId: created.id },
      search: tab === undefined ? {} : { tab },
    });
  };

  /** What the chosen kind takes beside its location. */
  const optionsOf = (): Record<string, unknown> | undefined => {
    if (kind === "GIT") {
      return gitOptionsOf(branch);
    }
    if (kind === "CONNECTED") {
      return connectedOptionsOfDraft(connected);
    }
    if (kind === "WEB") {
      const urls = furtherAddresses
        .split(/\s+/)
        .map((address) => address.trim())
        .filter((address) => address.length > 0);
      return { urls, ...webCrawlOptionsOf(crawl) };
    }
    return undefined;
  };

  /**
   * Asks a repository's hosting what it is, then saves the chosen rules and starts the first scan; null when
   * everything went through.
   */
  const prepare = async (created: SourceView): Promise<Outcome | null> => {
    if (!scanned) {
      return null;
    }
    if (kind === "GIT") {
      // What the source page shows about the repository; the source stands whether or not the hosting answers.
      await api.checkRepositoryAccess(workspaceId, created.id).catch(() => undefined);
    }
    if (preset !== null && preset.rules.length > 0) {
      try {
        await bindNewRuleSet(
          workspaceId,
          created,
          `${created.name} — ${presetName(preset)}`.slice(0, 150),
          preset,
        );
      } catch (error) {
        return { created, problem: describeProblem(error), stage: "rules" };
      }
    }
    if (scanAfterwards) {
      try {
        await startScan(workspaceId, created.id);
      } catch (error) {
        return { created, problem: describeProblem(error), stage: "scan" };
      }
    }
    return null;
  };

  return (
    <>
      <PageHeader
        eyebrow={
          <Link to="/sources" className={CRUMB}>
            {t("sourceSetup.eyebrow", "Sources")}
          </Link>
        }
        title={t("sourceSetup.title", "Add source")}
        lead={t(
          "sourceSetup.leadConnections",
          "Choose the type, the connection it reads through and what to take inside it — a folder, a repository, web pages, a knowledge base's sections — or uploads and written notes that live in Raccoon itself.",
        )}
      />

      <Can
        permission={PERMISSIONS.sourceManage}
        fallback={
          <EmptyState
            title={t("sourceSetup.forbidden.title", "You may not add sources here")}
            description={t(
              "sourceSetup.forbidden.description",
              "Adding a source needs source management in this workspace.",
            )}
          />
        }
      >
        <form className={LAYOUT} onSubmit={(event) => void create(event)} noValidate>
          <div className={STEPS}>
            {problem !== null && (
              <Notice tone="error" title={problem.title}>
                {problem.detail ?? problem.description}
              </Notice>
            )}

            <fieldset className={STEP}>
              <legend className={STEP_TITLE}>
                <span className={STEP_NUMBER}>1</span>
                {t("sourceSetup.step.type", "Type")}
              </legend>
              {catalogue.status === "loading" && (
                <Waiting label={t("sourceSetup.typesLoading", "Loading source types")} lines={2} />
              )}
              {catalogue.status === "failed" && (
                <Notice
                  tone="error"
                  title={catalogue.problem.title}
                  action={
                    <Button icon="refresh" onClick={catalogue.reload}>
                      {t("common.tryAgain", "Try again")}
                    </Button>
                  }
                >
                  {catalogue.problem.detail ?? catalogue.problem.description}
                </Notice>
              )}
              <div
                className={KINDS}
                role="radiogroup"
                aria-label={t("sourceSetup.typeOfSource", "Type of source")}
              >
                {sourceTypes.map((candidate) => (
                  <label key={candidate.key} className={KIND_OPTION}>
                    <input
                      type="radio"
                      name="type"
                      value={candidate.key}
                      checked={typeKey === candidate.key}
                      onChange={() => {
                        // A folder path, a repository and a start page are different things; none carries over.
                        if (candidate.key !== typeKey) {
                          setLocation("");
                          setChosenConnectionId("");
                          setConnected(NEW_CONNECTED);
                        }
                        setTypeKey(candidate.key);
                        setErrors({});
                      }}
                    />
                    <span className={KIND_TEXT}>
                      <span>{candidate.label}</span>
                      <Badge tone={isScanned(candidate.kind) ? "active" : "neutral"}>
                        {isScanned(candidate.kind)
                          ? t("sourceSetup.arrival.scanned", "Scanned")
                          : t("sourceSetup.arrival.direct", "Added in Raccoon")}
                      </Badge>
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-secondary">{description.explanation}</p>
            </fieldset>

            {choosesConnectionHere && catalogue.status === "ready" && (
              <fieldset className={STEP}>
                <legend className={STEP_TITLE}>
                  <span className={STEP_NUMBER}>{nextStep()}</span>
                  {t("sourceSetup.step.connection.label", "Connection")}
                </legend>
                <SourceConnectionField
                  choices={typeChoices}
                  value={connectionId}
                  error={errors.connection}
                  onChange={(next) => {
                    setChosenConnectionId(next);
                    setLocation("");
                    setErrors((current) => ({ ...current, connection: undefined }));
                  }}
                />
              </fieldset>
            )}

            {showsPlaceStep && description.locationLabel !== null && (
              <fieldset className={STEP}>
                <legend className={STEP_TITLE}>
                  <span className={STEP_NUMBER}>{nextStep()}</span>
                  {kind === "LOCAL_FOLDER"
                    ? t("sourceSetup.folder", "Folder")
                    : description.locationLabel}
                </legend>
                {kind === "GIT" && connection !== null && (
                  <RepositoryChoice
                    workspaceId={workspaceId}
                    connection={connection}
                    value={location}
                    onChoose={chooseLocation}
                  />
                )}
                {kind === "WEB" && connection !== null && (
                  <AllowedHosts workspaceId={workspaceId} connection={connection} />
                )}
                <Field
                  label={description.locationLabel}
                  hint={description.locationHint ?? undefined}
                  error={errors.location}
                  required
                >
                  <Input
                    className="numeric"
                    value={location}
                    maxLength={LOCATION_LIMIT}
                    spellCheck={false}
                    fullWidth
                    onChange={(event) => {
                      chooseLocation(event.target.value);
                    }}
                  />
                </Field>
                {kind === "LOCAL_FOLDER" && connectionId !== "" && (
                  <FolderPicker
                    key={connectionId}
                    workspaceId={workspaceId}
                    value={location}
                    onChoose={chooseLocation}
                    connectionId={connectionId}
                  />
                )}
                {kind === "GIT" && (
                  <Field
                    label={t("sourceSetup.git.branch", "Branch")}
                    hint={t(
                      "sourceSetup.git.branchHint",
                      "Leave empty for the branch the repository opens on.",
                    )}
                  >
                    <Input
                      className="numeric"
                      value={branch}
                      maxLength={200}
                      spellCheck={false}
                      onChange={(event) => setBranch(event.target.value)}
                    />
                  </Field>
                )}
                {kind === "WEB" && (
                  <>
                    <Field
                      label={t("sourceSetup.web.furtherAddresses", "Further start addresses")}
                      hint={t(
                        "sourceSetup.web.furtherAddressesHintConnection",
                        "One per line, at most 20, each on a host the connection allows.",
                      )}
                    >
                      <TextArea
                        code
                        rows={3}
                        value={furtherAddresses}
                        onChange={(event) => setFurtherAddresses(event.target.value)}
                      />
                    </Field>
                    <WebCrawlFields
                      draft={crawl}
                      errors={errors.crawl ?? {}}
                      onChange={(next) => {
                        setCrawl(next);
                        setErrors((current) => ({ ...current, crawl: undefined }));
                      }}
                    />
                  </>
                )}
              </fieldset>
            )}

            {kind === "CONNECTED" && (
              <fieldset className={STEP}>
                <legend className={STEP_TITLE}>
                  <span className={STEP_NUMBER}>{nextStep()}</span>
                  {t("sourceSetup.step.connection", "Connection and sections")}
                </legend>
                <ConnectedScopes
                  workspaceId={workspaceId}
                  draft={connected}
                  errors={errors.connected ?? {}}
                  connectionType={typeKey}
                  onChange={(next) => {
                    setConnected(next);
                    setErrors((current) => ({ ...current, connected: undefined }));
                  }}
                />
              </fieldset>
            )}

            <fieldset className={STEP}>
              <legend className={STEP_TITLE}>
                <span className={STEP_NUMBER}>{nextStep()}</span>
                {t("sourceSetup.name", "Name")}
              </legend>
              <Field
                label={t("sourceSetup.name", "Name")}
                required
                error={errors.name}
                hint={
                  !nameTouched && description.locationLabel !== null
                    ? t(
                        "sourceSetup.nameHint.address",
                        "Taken from the address until you type your own.",
                      )
                    : !nameTouched && kind === "CONNECTED"
                      ? t(
                          "sourceSetup.nameHint.section",
                          "Taken from the first chosen section until you type your own.",
                        )
                      : undefined
                }
              >
                <Input
                  value={shownName}
                  maxLength={NAME_LIMIT}
                  fullWidth
                  onChange={(event) => {
                    setName(event.target.value);
                    setNameTouched(true);
                    setErrors((current) => ({ ...current, name: undefined }));
                  }}
                />
              </Field>
            </fieldset>

            {scanned && (
              <fieldset className={STEP}>
                <legend id={WHAT_TO_TAKE_ID} className={STEP_TITLE}>
                  <span className={STEP_NUMBER}>{nextStep()}</span>
                  {t("sourceSetup.step.whatToTake", "What to take")}
                </legend>
                <p className="text-xs text-secondary">
                  {t(
                    "sourceSetup.presetsLead",
                    "A starting point. The rules stay editable on the source's Rules tab.",
                  )}
                </p>
                {presetCatalogue.status === "loading" ? (
                  <Waiting label={t("sourceSetup.presetsLoading", "Loading the ready rules")} lines={3} />
                ) : presetCatalogue.status === "failed" ? (
                  <Notice tone="warn">
                    {t(
                      "sourceSetup.presetsFailed",
                      "The ready rules could not be loaded. The source is created without rules; add them on its Rules tab.",
                    )}
                  </Notice>
                ) : (
                  <PresetChoices
                    labelledBy={WHAT_TO_TAKE_ID}
                    choices={presetChoices(offeredPresets, t)}
                    selectedKey={preset?.key ?? ""}
                    onSelect={setPresetKey}
                  />
                )}
              </fieldset>
            )}
          </div>

          <aside className={SUMMARY} aria-labelledby="summary-title">
            <h2 id="summary-title" className={SUMMARY_TITLE}>
              {t("sourceSetup.summary.title", "Summary")}
            </h2>
            <dl className={SUMMARY_FACTS}>
              <div>
                <dt>{t("sourceSetup.step.type", "Type")}</dt>
                <dd>{sourceType.label}</dd>
              </div>
              {choosesConnectionHere && (
                <div>
                  <dt>{t("sourceSetup.step.connection.label", "Connection")}</dt>
                  <dd>
                    {connection === null ? (
                      <span className="text-muted">
                        {t("sourceSetup.summary.notChosen", "Not chosen")}
                      </span>
                    ) : (
                      connection.name
                    )}
                  </dd>
                </div>
              )}
              {description.locationLabel !== null && (
                <div>
                  <dt>
                    {kind === "LOCAL_FOLDER"
                      ? t("sourceSetup.folder", "Folder")
                      : description.locationLabel}
                  </dt>
                  <dd>
                    {location.trim().length === 0 ? (
                      <span className="text-muted">
                        {t("sourceSetup.summary.notChosen", "Not chosen")}
                      </span>
                    ) : (
                      <PathText path={location} />
                    )}
                  </dd>
                </div>
              )}
              <div>
                <dt>{t("sourceSetup.name", "Name")}</dt>
                <dd>
                  {shownName.trim().length === 0 ? (
                    <span className="text-muted">
                      {t("sourceSetup.summary.notGiven", "Not given")}
                    </span>
                  ) : (
                    shownName
                  )}
                </dd>
              </div>
              {kind === "WEB" && (
                <div>
                  <dt>{t("sourceSetup.summary.fetches", "Fetches")}</dt>
                  <dd>{describeWebCrawl(crawl)}</dd>
                </div>
              )}
              {kind === "CONNECTED" && (
                <div>
                  <dt>{t("sourceSetup.summary.imports", "Imports")}</dt>
                  <dd>
                    {connected.scopes.length === 0 ? (
                      <span className="text-muted">
                        {t("sourceSetup.summary.noSection", "No section chosen")}
                      </span>
                    ) : (
                      connected.scopes.map((scope) => (
                        <div key={scope.id}>{scopePathText(scope.path)}</div>
                      ))
                    )}
                  </dd>
                </div>
              )}
              {scanned && (
                <div>
                  <dt>{t("sourceSetup.summary.takes", "Takes")}</dt>
                  <dd>{preset === null ? t("sourceSetup.summary.noRules", "No rules") : presetName(preset)}</dd>
                </div>
              )}
            </dl>
            {scanned ? (
              <Checkbox
                label={t("sourceSetup.scanAfterwards", "Scan as soon as it is added")}
                hint={t(
                  "sourceSetup.scanAfterwardsHint",
                  "Rules can still be changed afterwards; the next scan uses them.",
                )}
                checked={scanAfterwards}
                onChange={(event) => {
                  setScanAfterwards(event.target.checked);
                }}
              />
            ) : (
              <p className="text-xs text-secondary">
                {kind === "MANAGED_FOLDER"
                  ? t(
                      "sourceSetup.notScanned.upload",
                      "Nothing is scanned: upload files into it once it is added.",
                    )
                  : kind === "PUSH"
                    ? t(
                        "sourceSetup.notScanned.push",
                        "Nothing is scanned: the source page shows the address another system pushes to.",
                      )
                    : t(
                        "sourceSetup.notScanned.write",
                        "Nothing is scanned: write notes into it once it is added.",
                      )}
              </p>
            )}
            <div className={SUMMARY_ACTIONS}>
              <Button
                type="submit"
                variant="primary"
                icon={scanned && scanAfterwards ? "play" : "plus"}
                disabled={creating}
              >
                {creating
                  ? t("sourceSetup.adding", "Adding…")
                  : scanned && scanAfterwards
                    ? t("sourceSetup.addAndScan", "Add and scan")
                    : t("sourceSetup.title", "Add source")}
              </Button>
              <Button href="/sources" variant="quiet">
                {t("common.cancel", "Cancel")}
              </Button>
            </div>
          </aside>
        </form>
      </Can>
    </>
  );
}

/**
 * The repositories a git connection's token sees, to pick one instead of typing its address. Without a token the
 * hosting lists nothing and the address is typed.
 */
function RepositoryChoice({
  workspaceId,
  connection,
  value,
  onChoose,
}: {
  workspaceId: string;
  connection: ConnectionChoice;
  value: string;
  onChoose: (address: string) => void;
}) {
  const { t } = useTranslation();
  const repositories = useResource<ConnectionResource[]>(
    () => connectionsApi.resources(workspaceId, connection.id),
    [workspaceId, connection.id],
  );
  if (repositories.status === "loading") {
    return (
      <Waiting
        label={t("sourceSetup.repositories.loading", "Asking the hosting for its repositories")}
        lines={1}
      />
    );
  }
  if (repositories.status === "failed") {
    return (
      <Notice tone="warn" title={repositories.problem.title}>
        {repositories.problem.detail ?? repositories.problem.description}
      </Notice>
    );
  }
  if (repositories.data.length === 0) {
    return (
      <p className="text-xs text-secondary">
        {t(
          "sourceSetup.repositories.none",
          "This connection lists no repositories — it has no token, or the token sees none. Type the address.",
        )}
      </p>
    );
  }
  return (
    <Field
      label={t("sourceSetup.repositories.label", "Repository")}
      hint={t(
        "sourceSetup.repositories.hint",
        "What the connection's token sees, kept to its allowed owners.",
      )}
    >
      <Select
        value={repositories.data.some((repository) => repository.id === value) ? value : ""}
        fullWidth
        onChange={(event) => onChoose(event.target.value)}
      >
        <option value="">{t("sourceSetup.repositories.choose", "Choose a repository…")}</option>
        {repositories.data.map((repository) => (
          <option key={repository.id} value={repository.id}>
            {repository.name}
            {repository.detail === null ? "" : ` · ${repository.detail}`}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** The hosts a web connection allows, so a start address is typed on one of them. */
function AllowedHosts({
  workspaceId,
  connection,
}: {
  workspaceId: string;
  connection: ConnectionChoice;
}) {
  const { t } = useTranslation();
  const hosts = useResource<ConnectionResource[]>(
    () => connectionsApi.resources(workspaceId, connection.id),
    [workspaceId, connection.id],
  );
  if (hosts.status !== "ready" || hosts.data.length === 0) {
    return null;
  }
  return (
    <p className="text-xs text-secondary">
      {t("sourceSetup.web.allowedHosts", "Allowed hosts: {hosts}.", {
        hosts: hosts.data.map((host) => host.name).join(", "),
      })}
    </p>
  );
}
