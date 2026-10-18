import { useState } from "react";
import { describeProblem } from "../../../application/problems";
import { useResource } from "../../../application/useResource";
import { formatDateTime, shortIdentifier } from "../../../application/format";
import {
  pipelineApi,
  type PreparationConfiguration,
  type ProcessingPreview,
  type ProcessingProfile,
  type ProcessingRequest,
  type ProcessingRun,
} from "../../../lib/pipeline";
import { graphApi, type GraphCandidate, type GraphRequest } from "../../../lib/graph";
import { profilesApi, type ProfileConfiguration } from "../../../lib/profiles";
import { useTranslation } from "../../../translations/TranslationProvider";
import { EmptyState, ProblemState, Waiting, useToaster } from "../../../ui/components";
import { Badge, Button, Checkbox, Field, Select, Table } from "../../../ui/primitives";
import { CatalogueForm, outOfBounds } from "../../profiles/CatalogueForm";
import { startingConfiguration, valueAt } from "../../profiles/configurationPaths";
import { ProcessingOperations, OPERATIONS, type Operation } from "../pipeline/ProcessingOperations";
import { RelationRuleSelection } from "../pipeline/RelationRuleSelection";
import {
  WORKBENCH,
  WORKBENCH_MAIN,
  RUN_INSPECTOR,
  RUN_MODE,
  RUN_MODE_OPTION,
} from "../pipeline/processingClasses";
import { parsersApi, type Parser } from "../../../lib/parsers";
import { PreparationPreview } from "../pipeline/PreparationPreview";

interface Properties {
  workspaceId: string;
  documentId: string;
  versionId: string;
  documentTitle: string;
  mediaType: string;
  profiles: ProcessingProfile[];
  runs: ProcessingRun[];
  submitting: boolean;
  mayProcess: boolean;
  onSubmit: (profile: ProcessingProfile, request: ProcessingRequest) => void;
}

/** A per-run draft: capabilities are composed independently, shared profiles only supply defaults. */
export function ManagementTab(properties: Properties) {
  const { t } = useTranslation();
  const catalogue = useResource(async () => {
    const [configuration, installed] = await Promise.all([
      profilesApi.catalogue(properties.workspaceId, "processing"),
      parsersApi.overview(properties.workspaceId),
    ]);
    return { configuration, parsers: installed.parsers };
  }, [properties.workspaceId]);
  if (catalogue.status === "loading")
    return <Waiting label={t("preparation.loading", "Loading preparation settings")} lines={4} />;
  if (catalogue.status === "failed")
    return <ProblemState layout="section" problem={catalogue.problem} />;
  const usable = properties.profiles.filter(
    (profile) =>
      profile.configuration.enabled !== false &&
      catalogue.data.parsers.some((parser) => {
        const candidates =
          profile.configuration.parserId === "automatic"
            ? (profile.configuration.automaticParserIds ?? [])
            : [profile.configuration.parserId];
        const mediaType = properties.mediaType.split(";")[0].toLowerCase();
        const descriptor = parser.descriptor;
        return (
          candidates.includes(parser.identifier) &&
          (descriptor.mediaTypes.some(
            (type) =>
              type === mediaType ||
              (type.endsWith("/*") && mediaType.startsWith(type.slice(0, -1))),
          ) ||
            descriptor.extensions.some((extension) =>
              properties.documentTitle.toLowerCase().endsWith(extension),
            ))
        );
      }),
  );
  if (usable.length === 0)
    return (
      <EmptyState
        title={t("processing.noCompatibleProfile", "No compatible processing profile")}
        description={t(
          "processing.createCompatibleProfile",
          "Create or enable a profile that reads this file type under Profiles.",
        )}
      />
    );
  return (
    <PreparationDraft
      {...properties}
      profiles={usable}
      catalogue={catalogue.data.configuration}
      parsers={catalogue.data.parsers}
      key={properties.versionId}
    />
  );
}

function PreparationDraft({
  catalogue,
  parsers,
  ...properties
}: Properties & {
  parsers: Parser[];
  catalogue: Awaited<ReturnType<typeof profilesApi.catalogue>>;
}) {
  const { workspaceId, documentId, versionId, profiles, runs, submitting, mayProcess, onSubmit } =
    properties;
  const { t, say } = useTranslation();
  const { notify } = useToaster();
  const [profileId, setProfileId] = useState(
    runs.find((run) => profiles.some((profile) => profile.id === run.profileId))?.profileId ??
      profiles[0].id,
  );
  const [mode, setMode] = useState<"profile" | "custom">("profile");
  const [chunking, setChunking] = useState(false);
  const [lexical, setLexical] = useState(false);
  const [relations, setRelations] = useState(false);
  const [parseId, setParseId] = useState("");
  const [draft, setDraft] = useState<PreparationConfiguration | null>(null);
  const [preview, setPreview] = useState<ProcessingPreview | null>(null);
  const [previewKey, setPreviewKey] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [context, setContext] = useState<Record<string, GraphCandidate>>({});
  const candidates = useResource(
    () => graphApi.candidates(workspaceId, { limit: 100, offset: 0 }),
    [workspaceId],
  );
  const profile = profiles.find((item) => item.id === profileId) ?? profiles[0];
  const defaults = startingConfiguration(catalogue.parameters) as unknown as {
    preparation: PreparationConfiguration;
  };
  const base = draft ?? profile.configuration.preparation ?? defaults.preparation;
  const reusable = runs.filter(
    (run) => run.job.status === "SUCCEEDED" && run.reusedParseJobId === null,
  );
  const reusedParseJobId =
    mode === "profile"
      ? base.steps.includes("parse")
        ? null
        : parseId || reusable[0]?.job.id || null
      : parseId && (chunking || relations)
        ? parseId
        : null;
  const preparation: PreparationConfiguration = {
    ...base,
    steps:
      mode === "profile"
        ? base.steps
        : [
            ...(reusedParseJobId ? [] : ["parse"]),
            ...(chunking ? ["chunk"] : []),
            ...(lexical && chunking ? ["lexical"] : []),
            ...(relations ? ["relations"] : []),
          ],
    chunking: (mode === "profile" ? base.steps.includes("chunk") : chunking)
      ? (base.chunking ?? defaults.preparation.chunking)
      : null,
    indexing: (mode === "profile" ? base.steps.includes("lexical") : lexical && chunking)
      ? (base.indexing ?? defaults.preparation.indexing)
      : null,
    relations: (mode === "profile" ? base.steps.includes("relations") : relations)
      ? (base.relations ?? defaults.preparation.relations)
      : null,
  };
  const request: ProcessingRequest = {
    profileId: profile.id,
    profileRevision: profile.revision,
    reusedParseJobId,
    preparation,
  };
  const contextRequest: GraphRequest | undefined =
    Object.keys(context).length === 0
      ? undefined
      : { groups: [{ name: "document-preview", relationJobIds: Object.keys(context) }] };
  const requestKey = JSON.stringify({ request, contextRequest });
  const configuration = { preparation } as unknown as ProfileConfiguration;
  const inputParserId = reusedParseJobId
    ? runs.find((run) => run.job.id === reusedParseJobId)?.parserId
    : null;
  const parserOrder = inputParserId
    ? [inputParserId]
    : profile.configuration.parserId === "automatic"
      ? (profile.configuration.automaticParserIds ?? [])
      : [profile.configuration.parserId];
  const selectedParser = parserOrder
    .map((identifier) => parsers.find((parser) => parser.identifier === identifier))
    .find((parser) => {
      if (!parser) {
        return false;
      }
      if (inputParserId) {
        return true;
      }
      const mediaType = properties.mediaType.split(";")[0].toLowerCase();
      return (
        parser.descriptor.mediaTypes.some(
          (type) =>
            type === mediaType || (type.endsWith("/*") && mediaType.startsWith(type.slice(0, -1))),
        ) ||
        parser.descriptor.extensions.some((extension) =>
          properties.documentTitle.toLowerCase().endsWith(extension),
        )
      );
    });
  const selectedChunks = preparation.steps.includes("chunk");
  const selectedLexical = preparation.steps.includes("lexical");
  const selectedRelations = preparation.steps.includes("relations");
  const parameters = catalogue.parameters.filter(
    (parameter) =>
      (selectedChunks && parameter.path.startsWith("preparation.chunking.")) ||
      (selectedLexical && parameter.path.startsWith("preparation.indexing.")) ||
      (selectedRelations && parameter.path.startsWith("preparation.relations.")),
  );
  const invalid =
    (!preparation.steps.includes("parse") && !reusedParseJobId) ||
    parameters.some(
      (parameter) => outOfBounds(parameter, valueAt(configuration, parameter.path)) !== null,
    );
  const busy = submitting || previewing;
  const reset = () => setPreview(null);
  const runPreview = async () => {
    setPreviewKey(requestKey);
    setPreviewing(true);
    setPreview(null);
    try {
      setPreview(
        await pipelineApi.processingPreview(
          workspaceId,
          documentId,
          versionId,
          request,
          contextRequest,
        ),
      );
    } catch (error) {
      const problem = describeProblem(error);
      notify({
        tone: "error",
        title: problem.title,
        description: problem.detail ?? problem.description,
      });
    } finally {
      setPreviewing(false);
    }
  };
  const choose = (operation: Operation, checked: boolean, only = false) => {
    const nextChunk = only
      ? ["chunk", "lexical"].includes(operation)
      : operation === "chunk"
        ? checked
        : operation === "lexical" && checked
          ? true
          : selectedChunks;
    setChunking(nextChunk);
    setLexical(
      only
        ? operation === "lexical"
        : operation === "lexical"
          ? checked
          : nextChunk && selectedLexical,
    );
    setRelations(
      only ? operation === "relations" : operation === "relations" ? checked : selectedRelations,
    );
    if (only && operation === "parse") {
      setParseId("");
    }
    setMode("custom");
    reset();
  };
  return (
    <div className="grid min-w-0 gap-6">
      <div className={WORKBENCH}>
        <div className={WORKBENCH_MAIN}>
          <div>
            <h2 className="font-semibold">
              {t("preparation.manageTitle", "Prepare this version")}
            </h2>
            <p className="mt-1 text-sm text-secondary">
              {t(
                "preparation.manageHelp",
                "Parse only, add chunks, prepare search entries or select relations. Settings apply to this run; the shared profile stays unchanged.",
              )}
            </p>
          </div>
          <Field label={t("preparation.profile", "Settings from profile")}>
            <Select
              value={profile.id}
              disabled={busy}
              onChange={(event) => {
                setProfileId(event.target.value);
                setDraft(null);
                setMode("profile");
                setParseId("");
                reset();
              }}
            >
              {profiles.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.revision}
                </option>
              ))}
            </Select>
          </Field>
          <fieldset disabled={busy} className={RUN_MODE}>
            <legend className="mb-3 text-sm font-semibold">
              {t("processing.runMode", "Choose how to run")}
            </legend>
            <label className={RUN_MODE_OPTION}>
              <input
                type="radio"
                name="processing-mode"
                checked={mode === "profile"}
                onChange={() => {
                  setMode("profile");
                  reset();
                }}
              />
              <span>
                <strong className="text-sm">
                  {t("processing.fullProfile", "All configured steps")}
                </strong>
                <span className="mt-1 block text-xs text-secondary">
                  {t(
                    "processing.fullProfileHelp",
                    "Run every preparation step configured in the selected profile.",
                  )}
                </span>
              </span>
            </label>
            <label className={RUN_MODE_OPTION}>
              <input
                type="radio"
                name="processing-mode"
                checked={mode === "custom"}
                onChange={() => {
                  setChunking(selectedChunks);
                  setLexical(selectedLexical);
                  setRelations(selectedRelations);
                  setMode("custom");
                  reset();
                }}
              />
              <span>
                <strong className="text-sm">{t("processing.custom", "Choose operations")}</strong>
                <span className="mt-1 block text-xs text-secondary">
                  {t("processing.customHelp", "Select one operation or compose this run yourself.")}
                </span>
              </span>
            </label>
          </fieldset>
          <section aria-label={t("processing.capabilities", "What this document can do")}>
            <h2 className="mb-3 text-sm font-semibold">
              {t("processing.capabilities", "What this document can do")}
            </h2>
            <ProcessingOperations
              steps={preparation.steps}
              runs={runs}
              disabled={busy}
              onToggle={(operation, checked) => choose(operation, checked)}
              onOnly={(operation) => choose(operation, true, true)}
            />
          </section>
          {((mode === "custom" && (selectedChunks || selectedRelations)) ||
            !preparation.steps.includes("parse")) && (
            <Field
              label={t("preparation.input", "Input")}
              hint={t(
                "preparation.reuseHelp",
                "Reusing a parse keeps its parser and options. It never reads the original again.",
              )}
            >
              <Select
                value={parseId}
                disabled={busy}
                onChange={(event) => {
                  setParseId(event.target.value);
                  reset();
                }}
              >
                <option value="">{t("preparation.parseOriginal", "Parse the original now")}</option>
                {reusable.map((run) => (
                  <option key={run.job.id} value={run.job.id}>
                    {t("preparation.savedParse", "Saved parse {id} · {parser}", {
                      id: shortIdentifier(run.job.id),
                      parser: run.parserId,
                    })}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {parameters.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm font-semibold">
                {t("preparation.settings", "Settings for this run")}
              </summary>
              <div className="pt-4">
                <CatalogueForm
                  parameters={parameters}
                  configuration={configuration}
                  onChange={(next) => {
                    setDraft(next.preparation as PreparationConfiguration);
                    reset();
                  }}
                  references={{ providers: [], options: {} }}
                  optionalSections={[]}
                  requiredSections={[]}
                  explanationScope="processing"
                  disabled={busy}
                />
              </div>
            </details>
          )}
          {selectedRelations && (
            <RelationRuleSelection
              workspaceId={workspaceId}
              selected={base.ruleSetIds ?? []}
              disabled={busy}
              onChange={(ruleSetIds) => {
                setDraft({ ...base, ruleSetIds });
                reset();
              }}
            />
          )}
          {selectedRelations && (
            <details>
              <summary className="cursor-pointer text-sm font-semibold">
                {t("preparation.context", "Other documents for relation preview")}
              </summary>
              <p className="my-3 text-xs text-secondary">
                {t(
                  "preparation.contextHelp",
                  "Select existing relation runs to resolve the preview in one context. These inputs are used for preview only. Publishing a shared graph is a separate action under Relations.",
                )}
              </p>
              {candidates.status === "loading" ? (
                <Waiting label={t("graph.candidatesLoading", "Loading relation runs")} lines={2} />
              ) : candidates.status === "failed" ? (
                <ProblemState layout="section" problem={candidates.problem} />
              ) : (
                <div className="grid max-h-64 gap-2 overflow-auto">
                  {candidates.data
                    .filter((item) => item.documentId !== documentId)
                    .map((candidate) => (
                      <Checkbox
                        key={candidate.jobId}
                        disabled={busy}
                        label={`${candidate.title} · ${shortIdentifier(candidate.jobId)}`}
                        checked={candidate.jobId in context}
                        onChange={(event) => {
                          const next = { ...context };
                          for (const [id, item] of Object.entries(next))
                            if (item.documentId === candidate.documentId) delete next[id];
                          if (event.target.checked) next[candidate.jobId] = candidate;
                          setContext(next);
                          reset();
                        }}
                      />
                    ))}
                </div>
              )}
            </details>
          )}
        </div>
        <aside className={RUN_INSPECTOR} aria-label={t("processing.nextRun", "Next run")}>
          <h2 className="text-sm font-semibold">{t("processing.nextRun", "Next run")}</h2>
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted">{t("processing.parser", "Parser")}</dt>
              <dd className="mt-1 font-medium">
                {selectedParser?.descriptor.name ?? profile.configuration.parserId}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{t("processing.input", "Reads from")}</dt>
              <dd className="mt-1">
                {reusedParseJobId
                  ? t("preparation.reused", "Uses a saved parse")
                  : t("preparation.parseOriginal", "Parse the original now")}
              </dd>
            </div>
          </dl>
          <ol className="grid gap-2 border-y border-line py-3">
            {preparation.steps
              .map((identifier) => OPERATIONS.find((operation) => operation.id === identifier))
              .filter(
                (operation): operation is (typeof OPERATIONS)[number] => operation !== undefined,
              )
              .map((operation, index) => (
                <li key={operation.id} className="flex items-center gap-3 text-sm">
                  <span className="numeric text-xs text-muted">{index + 1}.</span>
                  {say(operation.title)}
                </li>
              ))}
          </ol>
          <p className="text-xs leading-relaxed text-secondary">
            {t(
              "processing.runNotice",
              "Preview calculates fresh results without saving. Run and save creates one background job for the selected operations.",
            )}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="quiet"
              disabled={!mayProcess || busy || invalid}
              onClick={() => void runPreview()}
            >
              {previewing
                ? t("preparation.previewing", "Preparing preview…")
                : t("preparation.preview", "Preview before saving")}
            </Button>
            <Button
              variant="primary"
              icon="play"
              disabled={!mayProcess || busy || invalid}
              onClick={() => onSubmit(profile, request)}
            >
              {submitting
                ? t("common.starting", "Starting…")
                : t("preparation.start", "Run and save")}
            </Button>
            <span className="text-xs text-secondary">{preparation.steps.join(" → ")}</span>
          </div>
        </aside>
      </div>
      {preview !== null && previewKey === requestKey && (
        <PreparationPreview result={preview} key={previewKey} />
      )}
      <section className="grid min-w-0 gap-3 border-t border-line pt-5">
        <h2 className="font-semibold">{t("preparation.history", "Runs of this version")}</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-secondary">
            {t("preparation.noRuns", "This version has no preparation runs yet.")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t("preparation.run", "Run")}</th>
                  <th scope="col">{t("preparation.operations", "What to prepare")}</th>
                  <th scope="col">{t("common.status", "Status")}</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.job.id}>
                    <td>
                      <code>{shortIdentifier(run.job.id)}</code>
                      <div className="text-xs text-muted">{formatDateTime(run.job.createdAt)}</div>
                    </td>
                    <td>
                      {run.preparation.steps.join(" → ")}
                      <div className="text-xs text-muted">
                        {run.reusedParseJobId
                          ? t("preparation.reused", "Uses a saved parse")
                          : run.parserId}
                      </div>
                    </td>
                    <td>
                      <Badge tone={run.job.status === "SUCCEEDED" ? "allow" : "neutral"}>
                        {run.job.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
