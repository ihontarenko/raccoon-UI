import { useId, useMemo, useState, type FormEvent } from "react";
import { formatNumber } from "../../application/format";
import { describeProblem, type Problem } from "../../application/problems";
import {
  chunkersApi,
  type ChunkerOverview,
  type ChunkPreview,
  type ChunkSettings,
  type EntryUnit,
  type TableUnit,
  type UnitMerging,
  chainChoices,
  describeChain,
} from "../../lib/chunkers";
import { useTranslation } from "../../translations/TranslationProvider";
import { DocumentPicker, Notice, PageHelp, ProblemState, Segmented, Statistics, type PickedDocument } from "../../ui/components";
import { Badge, Button, Field, Input, Select } from "../../ui/primitives";
import { ENTRY_UNIT, TABLE_UNIT, UNIT_MERGING } from "./chunkSettingLabels";
import { CHOICE_LABEL, CHOICE_LABEL_LINE, HEADING_ROW, PANEL, PREVIEW_ACTIONS, PREVIEW_ACTIONS_ROW, PREVIEW_CHANGED, PREVIEW_CHOICE, PREVIEW_CHUNK, PREVIEW_CHUNKS, PREVIEW_CHUNK_HEAD, PREVIEW_FORM, PREVIEW_NUMBER, PREVIEW_RESULT, PREVIEW_SETTINGS, PREVIEW_SIGNATURE, PREVIEW_STRATEGY, PREVIEW_TARGET, PREVIEW_TEXT, PREVIEW_UNIT, SECTION_TITLE, UNIT_INPUT, UNIT_INPUT_CONTROL, UNIT_SUFFIX } from "./chunkingClasses";
import { SettingExplanation } from "./SettingExplanation";

const UNIT_MERGINGS: UnitMerging[] = ["AS_PARSED", "MERGE_SMALL"];
const ENTRY_UNITS: EntryUnit[] = ["VALUE", "OBJECT", "GROUP"];
const TABLE_UNITS: TableUnit[] = ["TABLE", "ROW_GROUP", "ROW", "CELL"];

/**
 * Try chunk settings on one document before changing a profile: it is parsed and chunked in memory with the
 * profile's parser and options and these settings. Nothing is stored and no model is called, so it costs nothing.
 */
export function ChunkPreviewSection({ workspaceId, overview }: { workspaceId: string; overview: ChunkerOverview }) {
  const { t, say } = useTranslation();
  const mergingLabelId = useId();
  const runReasonId = useId();
  const profiles = useMemo(() => overview.profiles.filter((profile) => profile.chunking !== null), [overview.profiles]);
  const chains = chainChoices(overview.chunkers);
  const [picked, setPicked] = useState<PickedDocument | null>(null);
  const [profileId, setProfileId] = useState(profiles[0]?.profileId ?? "");
  const [settings, setSettings] = useState<ChunkSettings | null>(profiles[0]?.chunking ?? null);
  const [preview, setPreview] = useState<ChunkPreview | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [pending, setPending] = useState(false);

  const profile = profiles.find((candidate) => candidate.profileId === profileId) ?? null;
  const changed = profile !== null && settings !== null && JSON.stringify(profile.chunking) !== JSON.stringify(settings);
  const overlapInvalid = settings !== null && settings.overlapCodePoints >= settings.maximumCodePoints;
  const asParsed = settings?.unitMerging === "AS_PARSED";

  if (profiles.length === 0) {
    return null;
  }

  const chooseProfile = (identifier: string) => {
    setProfileId(identifier);
    setSettings(profiles.find((candidate) => candidate.profileId === identifier)?.chunking ?? null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (picked === null || profileId === "" || settings === null || overlapInvalid) {
      return;
    }
    setPending(true);
    setProblem(null);
    chunkersApi
      .preview(workspaceId, { documentId: picked.id, profileId, chunking: settings })
      .then((result) => setPreview(result))
      .catch((error: unknown) => {
        setPreview(null);
        setProblem(describeProblem(error));
      })
      .finally(() => setPending(false));
  };

  const charactersUnit = t("chunking.preview.charactersUnit", "char.");
  const notUsedAsParsed = t(
    "chunking.preview.notUsedAsParsed",
    "Not used: as parsed, every row and value is already a chunk of its own.",
  );

  return (
    <section className={PANEL} aria-labelledby="chunking-preview">
      <div className={HEADING_ROW}>
        <h2 id="chunking-preview" className={SECTION_TITLE}>
          {t("chunking.preview.title", "Preview on a document")}
        </h2>
        <PageHelp
          title={t("chunking.preview.title", "Preview on a document")}
          help={
            <p>
              {t(
                "chunking.preview.lead",
                "The document is parsed and chunked in memory with the profile's parser and options and the settings below. Nothing is stored, nothing in search changes, and no model is called. Scripts that narrow chunking while a document is processed are not run here.",
              )}
            </p>
          }
        />
      </div>
      <form className={PREVIEW_FORM} onSubmit={submit}>
        <div className={PREVIEW_TARGET}>
          <DocumentPicker
            workspaceId={workspaceId}
            label={t("chunking.preview.document", "Document")}
            chosen={picked === null ? [] : [picked]}
            maximum={1}
            onPick={(document) => setPicked(document)}
            onRemove={() => setPicked(null)}
          />
          <Field label={t("chunking.preview.profile", "Processing profile")}>
            <Select value={profileId} onChange={(event) => chooseProfile(event.target.value)} fullWidth>
              {profiles.map((candidate) => (
                <option key={candidate.profileId} value={candidate.profileId}>
                  {candidate.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {settings !== null && (
          <>
            <div className={PREVIEW_SETTINGS}>
              <div className={PREVIEW_STRATEGY}>
                <Field label={t("chunking.preview.chain", "Chain of chunkers")} labelAside={<SettingExplanation setting="strategy" />}>
                  <Select
                    value={settings.chunkerIds.join(",")}
                    onChange={(event) => setSettings({ ...settings, chunkerIds: event.target.value.split(",") })}
                    fullWidth
                  >
                    {chains.map((chain) => (
                      <option key={chain.join(",")} value={chain.join(",")}>
                        {describeChain(chain, overview.chunkers)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className={PREVIEW_NUMBER}>
                <Field label={t("chunking.preview.sizeLabel", "Size")} labelAside={<SettingExplanation setting="size" />}>
                  <UnitInput
                    unit={charactersUnit}
                    min={2}
                    max={10000}
                    value={settings.maximumCodePoints}
                    onValue={(value) => setSettings({ ...settings, maximumCodePoints: value })}
                  />
                </Field>
              </div>
              <div className={PREVIEW_NUMBER}>
                <Field
                  label={t("chunking.preview.overlapLabel", "Overlap")}
                  labelAside={<SettingExplanation setting="overlap" />}
                  error={overlapInvalid ? t("chunking.preview.overlapInvalid", "Must be smaller than the size.") : undefined}
                >
                  <UnitInput
                    unit={charactersUnit}
                    min={0}
                    max={9999}
                    value={settings.overlapCodePoints}
                    onValue={(value) => setSettings({ ...settings, overlapCodePoints: value })}
                  />
                </Field>
              </div>
              <div className={PREVIEW_CHOICE}>
                <div className={CHOICE_LABEL_LINE}>
                  <span id={mergingLabelId} className={CHOICE_LABEL}>
                    {t("chunking.preview.merging", "Units")}
                  </span>
                  <SettingExplanation setting="merging" />
                </div>
                <Segmented<UnitMerging>
                  label={t("chunking.preview.merging", "Units")}
                  value={settings.unitMerging}
                  onChange={(value) => setSettings({ ...settings, unitMerging: value })}
                  options={UNIT_MERGINGS.map((value) => ({ value, label: say(UNIT_MERGING[value]) }))}
                />
              </div>
            </div>
            <div className={PREVIEW_SETTINGS}>
              <div className={PREVIEW_UNIT}>
                <Field label={t("chunking.preview.entryUnit", "Entry unit")} labelAside={<SettingExplanation setting="entryUnit" />} hint={asParsed ? notUsedAsParsed : undefined}>
                  <Select
                    value={settings.entryUnit}
                    disabled={asParsed}
                    onChange={(event) => setSettings({ ...settings, entryUnit: event.target.value as EntryUnit })}
                    fullWidth
                  >
                    {ENTRY_UNITS.map((value) => (
                      <option key={value} value={value}>
                        {say(ENTRY_UNIT[value])}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className={PREVIEW_UNIT}>
                <Field label={t("chunking.preview.tableUnit", "Table unit")} labelAside={<SettingExplanation setting="tableUnit" />} hint={asParsed ? notUsedAsParsed : undefined}>
                  <Select
                    value={settings.tableUnit}
                    disabled={asParsed}
                    onChange={(event) => setSettings({ ...settings, tableUnit: event.target.value as TableUnit })}
                    fullWidth
                  >
                    {TABLE_UNITS.map((value) => (
                      <option key={value} value={value}>
                        {say(TABLE_UNIT[value])}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>
            <div className={PREVIEW_ACTIONS_ROW}>
              {changed && profile !== null && (
                <div className={PREVIEW_CHANGED}>
                  <span className="text-xs text-muted">
                    {t("chunking.preview.changed", "Differs from the profile. To keep it, change the profile; this page saves nothing.")}
                  </span>
                  <Button type="button" variant="quiet" onClick={() => setSettings(profile.chunking)}>
                    {t("chunking.preview.reset", "Back to the profile's settings")}
                  </Button>
                </div>
              )}
              <div className={PREVIEW_ACTIONS}>
                {picked === null && (
                  <span id={runReasonId} className="text-xs text-muted">
                    {t("chunking.preview.chooseFirst", "Choose a document first.")}
                  </span>
                )}
                <Button
                  type="submit"
                  variant="primary"
                  icon="chunks"
                  disabled={pending || picked === null || overlapInvalid}
                  aria-describedby={picked === null ? runReasonId : undefined}
                >
                  {pending ? t("chunking.preview.running", "Cutting…") : t("chunking.preview.run", "Preview chunks")}
                </Button>
              </div>
            </div>
          </>
        )}
      </form>
      <div aria-live="polite">
        {problem !== null && <ProblemState layout="section" problem={problem} />}
        {preview !== null && <PreviewResult preview={preview} />}
      </div>
    </section>
  );
}

/** A narrow number field with its unit inside, after the number: «1200 char.». Field gives it its id and description. */
function UnitInput({
  unit,
  value,
  onValue,
  min,
  max,
  id,
  invalid,
  "aria-describedby": describedBy,
}: {
  unit: string;
  value: number;
  onValue: (value: number) => void;
  min: number;
  max: number;
  id?: string;
  invalid?: boolean;
  "aria-describedby"?: string;
}) {
  return (
    <span className={UNIT_INPUT}>
      <Input
        id={id}
        invalid={invalid}
        aria-describedby={describedBy}
        type="number"
        className={`numeric ${UNIT_INPUT_CONTROL}`}
        min={min}
        max={max}
        value={value}
        onChange={(event) => onValue(Number(event.target.value))}
        fullWidth
      />
      <span className={UNIT_SUFFIX} aria-hidden="true">
        {unit}
      </span>
    </span>
  );
}

function PreviewResult({ preview }: { preview: ChunkPreview }) {
  const { t } = useTranslation();
  return (
    <div className={PREVIEW_RESULT}>
      <Statistics
        label={t("chunking.result.statistics", "Preview in numbers")}
        items={[
          { label: t("chunking.result.chunks", "Chunks"), value: formatNumber(preview.chunkCount) },
          {
            label: t("chunking.result.now", "In search now"),
            value: preview.currentChunkCount === null ? "—" : formatNumber(preview.currentChunkCount),
          },
          { label: t("chunking.result.smallest", "Smallest"), value: formatNumber(preview.sizes.smallest) },
          { label: t("chunking.result.median", "Median"), value: formatNumber(preview.sizes.median) },
          { label: t("chunking.result.largest", "Largest"), value: formatNumber(preview.sizes.largest) },
          { label: t("chunking.result.blocks", "Parsed blocks"), value: formatNumber(preview.blockCount) },
        ]}
      />
      <p className="text-xs text-secondary">
        {t("chunking.result.howParsed", "Read by {parser}, cut by {chunker}. Sizes are in characters.", {
          parser: preview.parserId,
          chunker: preview.chunker,
        })}
      </p>
      {preview.structureFallback !== null && (
        <Notice tone="warn" title={t("chunking.result.fallback", "Read as text, not by its structure")}>
          <code>{preview.structureFallback.reason}</code> {preview.structureFallback.detail}
        </Notice>
      )}
      <ol className={PREVIEW_CHUNKS} aria-label={t("chunking.result.list", "Previewed chunks")}>
        {preview.chunks.map((chunk) => (
          <li key={chunk.number} className={PREVIEW_CHUNK}>
            <div className={PREVIEW_CHUNK_HEAD}>
              <strong className="numeric">{t("chunking.result.chunk", "Chunk {number}", { number: chunk.number })}</strong>
              <span className="text-xs text-muted numeric">
                {t("chunking.result.lines", "lines {start}–{end} · {size} characters, {indexed} indexed", {
                  start: chunk.startLine,
                  end: chunk.endLine,
                  size: formatNumber(chunk.codePoints),
                  indexed: formatNumber(chunk.indexedCodePoints),
                })}
              </span>
              {chunk.symbolKind !== null && <Badge tone="neutral">{chunk.symbolKind}</Badge>}
              {chunk.parts > 1 && (
                <span className="text-xs text-muted numeric">
                  {t("chunking.result.part", "part {part} of {parts}", { part: chunk.part, parts: chunk.parts })}
                </span>
              )}
            </div>
            {(chunk.signature ?? chunk.symbolId) !== null && <code className={PREVIEW_SIGNATURE}>{chunk.signature ?? chunk.symbolId}</code>}
            <pre className={PREVIEW_TEXT}>
              {chunk.excerpt}
              {chunk.excerptTruncated && "…"}
            </pre>
          </li>
        ))}
      </ol>
      {preview.chunksTruncated && (
        <p className="text-xs text-muted">
          {t("chunking.result.truncated", "The first {shown} of {count} chunks are shown.", {
            shown: formatNumber(preview.chunks.length),
            count: formatNumber(preview.chunkCount),
          })}
        </p>
      )}
    </div>
  );
}
