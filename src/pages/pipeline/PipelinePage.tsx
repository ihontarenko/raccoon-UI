import { Link } from "@tanstack/react-router";
import { useReadySession } from "../../application/session";
import { usePageTitle } from "../../application/usePageTitle";
import { useResource } from "../../application/useResource";
import { collectAllPages } from "../../lib/api";
import { PREPARATION_LAYERS, layersOffOf, withLayer, type PreparationLayer } from "../../lib/preparationLayers";
import { profilesApi } from "../../lib/profiles";
import { useTranslation } from "../../translations/TranslationProvider";
import { PageHeader, ProblemState, Waiting } from "../../ui/components";
import { Badge, Checkbox } from "../../ui/primitives";
import { ProfileScopedPanel } from "../profiles/ProfileScopedPanel";
import { TextTransforms } from "../profiles/TextTransforms";
import type { ProfileDraft } from "../profiles/useProfileDraft";

const STRIP = "m-0 grid list-none gap-0 p-0";
/* One layer per row: its place, its switch, what it does, and — for a rule layer — the rules working there. A switched-off
   layer is dimmed but stays in its place, because the order is the point. */
const LAYER = [
  "grid grid-cols-[calc(34px*var(--ui-scale))_minmax(0,1fr)] gap-3 border-b border-line py-3 last:border-b-0",
  "data-[off=true]:opacity-60",
].join(" ");
const PLACE = [
  "grid size-[calc(26px*var(--ui-scale))] place-items-center rounded-full border text-xs font-semibold numeric",
  "border-accent text-accent-text data-[off=true]:border-line-strong data-[off=true]:text-muted",
].join(" ");
const LAYER_HEAD = "flex flex-wrap items-center gap-x-3 gap-y-1";

/**
 * The preparation pipeline of one processing profile as the strip of layers it is: in order, each on or off, each
 * with what it does and where its own mechanism lives. Switching a layer is a change to the profile, saved as a new
 * settings revision like any other.
 */
export function PipelinePage() {
  const { t } = useTranslation();
  usePageTitle(t("pipeline.title", "Pipeline"));
  const { workspace } = useReadySession();
  const workspaceId = workspace?.id ?? "";
  const profiles = useResource(() => collectAllPages((page) => profilesApi.list(workspaceId, "processing", page)), [workspaceId]);

  return (
    <>
      <PageHeader
        eyebrow={t("navigation.group.layers", "Processing layers")}
        title={t("pipeline.title", "Pipeline")}
        lead={t(
          "pipeline.lead",
          "What happens to a document between its parser and its index, layer by layer. A layer that is on does its work; one that is off passes what it was given on unchanged. Choose a processing profile to see and switch its layers.",
        )}
      />
      {profiles.status === "loading" && <Waiting label={t("pipeline.loading", "Loading the processing profiles")} lines={4} />}
      {profiles.status === "failed" && <ProblemState layout="section" problem={profiles.problem} />}
      {profiles.status === "ready" && (
        <ProfileScopedPanel
          kind="processing"
          profiles={profiles.data.map((profile) => ({
            id: profile.id,
            name: profile.name,
            enabled: profile.configuration.enabled !== false,
          }))}
          storageKey="raccoon.pipeline.profile"
          title={t("pipeline.scoped", "Layers of")}
          paths={[]}
          emptyText={t("pipeline.noProfiles", "No processing profile in this workspace yet. Create one under Profiles.")}
        >
          {(draft) => <LayerStrip draft={draft} />}
        </ProfileScopedPanel>
      )}
    </>
  );
}

function LayerStrip({ draft }: { draft: ProfileDraft }) {
  const configuration = draft.configuration;
  if (configuration === null) {
    return null;
  }
  const off = new Set(layersOffOf(configuration));
  return (
    <ol className={STRIP}>
      {PREPARATION_LAYERS.map((layer, index) => (
        <LayerRow
          key={layer.identifier}
          layer={layer}
          place={index + 1}
          on={!off.has(layer.identifier)}
          draft={draft}
          onSwitch={(on) => {
            draft.change(withLayer(configuration, layer.identifier, on));
          }}
        />
      ))}
    </ol>
  );
}

interface LayerRowProperties {
  layer: PreparationLayer;
  place: number;
  on: boolean;
  draft: ProfileDraft;
  onSwitch: (on: boolean) => void;
}

function LayerRow({ layer, place, on, draft, onSwitch }: LayerRowProperties) {
  const { t, say } = useTranslation();
  const configuration = draft.configuration;
  return (
    <li className={LAYER} data-off={!on}>
      <span className={PLACE} data-off={!on} aria-hidden="true">
        {place}
      </span>
      <div className="grid min-w-0 gap-1.5">
        <div className={LAYER_HEAD}>
          <strong className="text-sm text-ink">{say(layer.name)}</strong>
          {layer.mandatory ? (
            <Badge tone="neutral">{t("pipeline.mandatory", "Always on")}</Badge>
          ) : (
            <Checkbox
              label={on ? t("pipeline.on", "On") : t("pipeline.off", "Off — passes on unchanged")}
              checked={on}
              disabled={!draft.mayEdit || draft.saving}
              onChange={(event) => {
                onSwitch(event.target.checked);
              }}
            />
          )}
          <Link to={layer.page} className="ml-auto text-xs font-semibold text-accent-text hover:underline">
            {t("pipeline.mechanism", "How it works")}
          </Link>
        </div>
        <p className="m-0 text-xs text-secondary">{say(on || layer.whenOff === null ? layer.does : layer.whenOff)}</p>
        {layer.ruleStage !== null && on && configuration !== null && (
          <TextTransforms configuration={configuration} stages={[layer.ruleStage]} includeDecisions />
        )}
      </div>
    </li>
  );
}
