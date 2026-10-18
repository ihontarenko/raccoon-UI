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
import { PreparationPreview } from "../pipeline/PreparationPreview";

interface Properties {
  workspaceId: string;
  documentId: string;
  versionId: string;
  profiles: ProcessingProfile[];
  runs: ProcessingRun[];
  submitting: boolean;
  mayProcess: boolean;
  onSubmit: (profile: ProcessingProfile, request: ProcessingRequest) => void;
}

/** A per-run draft: capabilities are composed independently, shared profiles only supply defaults. */
export function ManagementTab(properties: Properties) {
  const { t } = useTranslation();
  const catalogue = useResource(
    () => profilesApi.catalogue(properties.workspaceId, "processing"),
    [properties.workspaceId],
  );
  if (catalogue.status === "loading")
    return <Waiting label={t("preparation.loading", "Loading preparation settings")} lines={4} />;
  if (catalogue.status === "failed")
    return <ProblemState layout="section" problem={catalogue.problem} />;
  const usable = properties.profiles.filter((profile) => profile.configuration.enabled !== false);
  if (usable.length === 0)
    return (
      <EmptyState
        title={t("preparation.noProfile", "No enabled processing profile")}
        description={t(
          "preparation.createProfile",
          "Create a processing profile under Profiles first.",
        )}
      />
    );
  return (
    <PreparationDraft
      {...properties}
      profiles={usable}
      catalogue={catalogue.data}
      key={properties.versionId}
    />
  );
}

function PreparationDraft({
  catalogue,
  ...properties
}: Properties & { catalogue: Awaited<ReturnType<typeof profilesApi.catalogue>> }) {
  const { workspaceId, documentId, versionId, profiles, runs, submitting, mayProcess, onSubmit } =
    properties;
  const { t } = useTranslation();
  const { notify } = useToaster();
  const [profileId, setProfileId] = useState(profiles[0].id);
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
  const reusedParseJobId = parseId && (chunking || relations) ? parseId : null;
  const preparation: PreparationConfiguration = {
    ...base,
    steps: [
      ...(reusedParseJobId ? [] : ["parse"]),
      ...(chunking ? ["chunk"] : []),
      ...(lexical && chunking ? ["lexical"] : []),
      ...(relations ? ["relations"] : []),
    ],
    chunking: chunking ? (base.chunking ?? defaults.preparation.chunking) : null,
    indexing: lexical && chunking ? (base.indexing ?? defaults.preparation.indexing) : null,
    relations: relations ? (base.relations ?? defaults.preparation.relations) : null,
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
  const parameters = catalogue.parameters.filter(
    (parameter) =>
      (chunking && parameter.path.startsWith("preparation.chunking.")) ||
      (lexical && chunking && parameter.path.startsWith("preparation.indexing.")) ||
      (relations && parameter.path.startsWith("preparation.relations.")),
  );
  const invalid = parameters.some(
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
  return (
    <div className="grid min-w-0 gap-6">
      <div className="grid max-w-4xl gap-5">
        <div>
          <h2 className="font-semibold">{t("preparation.manageTitle", "Prepare this version")}</h2>
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
        <fieldset disabled={busy} className="grid gap-3">
          <legend className="mb-3 text-sm font-semibold">
            {t("preparation.operations", "What to prepare")}
          </legend>
          <p className="text-xs text-secondary">
            {t(
              "preparation.parseAlways",
              "The original is parsed unless you choose an existing parse below.",
            )}
          </p>
          <Checkbox
            label={t("preparation.chunks", "Create chunks")}
            checked={chunking}
            onChange={(event) => {
              setChunking(event.target.checked);
              if (!event.target.checked) setLexical(false);
              reset();
            }}
          />
          <Checkbox
            label={t("preparation.lexical", "Lexical index")}
            checked={lexical}
            onChange={(event) => {
              setLexical(event.target.checked);
              if (event.target.checked) setChunking(true);
              reset();
            }}
          />
          <Checkbox
            label={t("preparation.relations", "Relations")}
            checked={relations}
            onChange={(event) => {
              setRelations(event.target.checked);
              reset();
            }}
          />
        </fieldset>
        {(chunking || relations) && (
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
        {relations && (
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
