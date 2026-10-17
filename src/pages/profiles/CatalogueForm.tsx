import { useId, useState } from "react";
import { CHANGE_EFFECTS } from "../../application/codeLabels";
import { labelOfCode } from "../../application/format";
import { explainParameter, hasWrittenExplanation, type ExplanationScope } from "../../application/parameterExplanations";
import type { CatalogueParameter, ProfileConfiguration } from "../../lib/profiles";
import { translate, translateDeclared } from "../../translations/translate";
import { useTranslation } from "../../translations/TranslationProvider";
import type { ExplanationText } from "../../ui/components/ParameterExplanation";
import {
  ChipInput,
  ExplainParameter,
  ParameterFindings,
  type ParameterFact,
  type ParameterFinding,
} from "../../ui/components";
import { Badge, Button, Checkbox, Input, Select, TextArea } from "../../ui/primitives";
import { sectionOf, valueAt, withSectionFilled, withValueAt } from "./configurationPaths";
import type { ProfileReferences, ReferenceOption } from "./profileReferences";
import type { OverriddenParameter, RequiredSection } from "./profileRules";
import { PARAMETER_TYPES, PARAMETER_UNITS, SECTION_TITLES, UNWRITTEN_PARAMETERS } from "./catalogueFormTexts";
import { ABSENT_ROW, CHECKS, CHOICE_LINE, EFFECT, FIELD, FIELDS, FIELD_BOUNDS, FIELD_ERROR, FIELD_HEAD, FIELD_HINT, FIELD_LABEL, FIELD_OVERRIDDEN, FORM, SECTION, SECTION_NOTE, SECTION_TITLE } from "./profilesClasses";

interface CatalogueFormProperties {
  parameters: CatalogueParameter[];
  configuration: ProfileConfiguration;
  onChange: (configuration: ProfileConfiguration) => void;
  references: ProfileReferences;
  optionalSections: string[];
  requiredSections: RequiredSection[];
  /** Fields whose identifier may be left empty, meaning "none": an answer profile without a model. */
  nullableReferences?: string[];
  /** Which explanations the "About …" buttons open: the profile kind. */
  explanationScope: ExplanationScope;
  /** Findings on the values as they stand, by parameter path, shown under the field and in its explanation. */
  findings?: Map<string, ParameterFinding[]>;
  /** Settings another choice makes irrelevant: shown read-only with the reason. */
  overriddenParameters?: OverriddenParameter[];
  disabled: boolean;
}

/** "maximumCodePoints" → "Maximum code points"; "retrieval.semantic" → "Retrieval · semantic". */
export function humanisePath(path: string): string {
  return path
    .split(".")
    .map((segment, index) => {
      const words = segment.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
      return index === 0 ? words.charAt(0).toUpperCase() + words.slice(1) : words;
    })
    .join(" · ");
}

function lastSegment(path: string): string {
  return path.slice(path.lastIndexOf(".") + 1);
}

/** A label made from a path: its last segment in words, without the "id" a person never needs to read. */
function labelFromPath(path: string): string {
  return humanisePath(lastSegment(path).replace(/Ids$/, "s").replace(/Id$/, ""));
}

/** A section's title in the viewer's language; a section no table lists yet is named from its path. */
function sectionTitle(section: string): string {
  const declared = SECTION_TITLES[section];
  return declared === undefined ? humanisePath(section) : translateDeclared(declared);
}

/**
 * A field's label and the short help under it. A parameter with a written explanation is named by it, and its
 * "About …" button carries the help; one without is named by the table of unwritten parameters, or by its path
 * and the server's own note when even that table does not know it yet.
 */
function describeField(scope: ExplanationScope, parameter: CatalogueParameter): { title: ExplanationText; hint: string | null } {
  if (hasWrittenExplanation(scope, parameter.path)) {
    return { title: explainParameter(scope, parameter.path, { title: parameter.path }).title, hint: null };
  }
  const unwritten = UNWRITTEN_PARAMETERS[parameter.path];
  if (unwritten !== undefined) {
    return { title: unwritten.title, hint: translateDeclared(unwritten.hint) };
  }
  return { title: labelFromPath(parameter.path), hint: parameter.description };
}

/** The server's unit word in the viewer's language; "a; b" units are worded part by part. */
function unitText(unit: string): string {
  return unit
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const declared = PARAMETER_UNITS[part];
      return declared === undefined ? part : translateDeclared(declared);
    })
    .join("; ");
}

/**
 * A profile's configuration drawn from its kind's catalogue: one section per object in the
 * configuration, one field per parameter, each typed, bounded and described by the server. An optional
 * section the configuration leaves out is offered with a switch rather than as empty fields.
 */
export function CatalogueForm({
  parameters,
  configuration,
  onChange,
  references,
  optionalSections,
  requiredSections,
  nullableReferences = [],
  explanationScope,
  findings = new Map(),
  overriddenParameters = [],
  disabled,
}: CatalogueFormProperties) {
  const { t } = useTranslation();
  const sections = new Map<string, CatalogueParameter[]>();
  for (const parameter of parameters) {
    const section = sectionOf(parameter.path);
    sections.set(section, [...(sections.get(section) ?? []), parameter]);
  }
  // Top-level settings first, then nested sections in catalogue order.
  const ordered = [...sections.entries()].sort(([first], [second]) =>
    first === "" ? -1 : second === "" ? 1 : 0,
  );
  const effects = [
    ...new Set(
      parameters
        .map((parameter) => parameter.effect)
        .filter((effect): effect is string => effect !== null),
    ),
  ];

  return (
    <div className={FORM}>
      {effects.length > 0 && (
        <p className={EFFECT}>
          {t(
            "profiles.form.effects",
            "When changes apply: {effects}. Work already started keeps the revision it froze.",
            { effects: effects.map((effect) => labelOfCode(CHANGE_EFFECTS, effect)).join(", ") },
          )}
        </p>
      )}
      {ordered.map(([section, sectionParameters]) => {
        const optional = optionalSections.includes(section);
        const required = requiredSections.find((candidate) => candidate.section === section);
        const sectionValue = section === "" ? configuration : valueAt(configuration, section);
        const absent = section !== "" && (sectionValue === null || sectionValue === undefined);
        return (
          // Each control is disabled on its own: a disabled fieldset would also disable the "About …" buttons,
          // and a reader who may not edit needs those most.
          <fieldset key={section} className={SECTION}>
            <legend className={SECTION_TITLE}>
              {sectionTitle(section)}
              {required !== undefined && (
                <span className={SECTION_NOTE}>
                  {t("profiles.form.neededBecause", "needed because {reason}", { reason: required.because })}
                </span>
              )}
            </legend>
            {absent ? (
              <div className={ABSENT_ROW}>
                <span className="text-xs text-secondary">
                  {optional
                    ? t("profiles.form.notUsed", "Not used.")
                    : t("profiles.form.notUsedRequired", "Not used — the server will ask for it.")}
                </span>
                <Button
                  variant="quiet"
                  icon="plus"
                  disabled={disabled}
                  onClick={() => {
                    onChange(withSectionFilled(configuration, section, parameters));
                  }}
                >
                  {t("profiles.form.useSection", "Use: {section}", { section: sectionTitle(section) })}
                </Button>
              </div>
            ) : (
              <>
                {optional && required === undefined && (
                  <div className={ABSENT_ROW}>
                    <span className="text-xs text-secondary">
                      {t("profiles.form.optionalSection", "Optional; nothing chosen needs it.")}
                    </span>
                    <Button
                      variant="quiet"
                      disabled={disabled}
                      onClick={() => {
                        onChange(withValueAt(configuration, section, null));
                      }}
                    >
                      {t("profiles.form.stopUsing", "Stop using")}
                    </Button>
                  </div>
                )}
                <div className={FIELDS}>
                  {sectionParameters.map((parameter) => (
                    <ParameterField
                      key={parameter.path}
                      parameter={parameter}
                      value={valueAt(configuration, parameter.path)}
                      options={references.options[lastSegment(parameter.path)]}
                      nullable={nullableReferences.includes(parameter.path)}
                      explanationScope={explanationScope}
                      findings={findings.get(parameter.path) ?? []}
                      overriddenBecause={
                        overriddenParameters.find((overridden) => overridden.path === parameter.path)?.because ?? null
                      }
                      disabled={disabled}
                      onChange={(value) => {
                        onChange(withValueAt(configuration, parameter.path, value));
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}

interface ParameterFieldProperties {
  parameter: CatalogueParameter;
  value: unknown;
  options: ReferenceOption[] | undefined;
  nullable: boolean;
  explanationScope: ExplanationScope;
  findings: ParameterFinding[];
  /** Why another choice makes this setting irrelevant, or null when it applies. */
  overriddenBecause?: string | null;
  disabled: boolean;
  onChange: (value: unknown) => void;
}

/** What the server declares about a parameter, for the bottom of its explanation. */
function declaredFacts(parameter: CatalogueParameter, bounds: string | null): ParameterFact[] {
  const facts: ParameterFact[] = [
    { label: translate("profiles.form.fact.type", "Type"), value: labelOfCode(PARAMETER_TYPES, parameter.type) },
  ];
  if (bounds !== null) {
    facts.push({ label: translate("profiles.form.fact.allowed", "Allowed"), value: bounds });
  }
  if (parameter.choices.length > 0) {
    facts.push({ label: translate("profiles.form.fact.choices", "Choices"), value: parameter.choices.join(", ") });
  }
  if (
    parameter.suggestion !== null &&
    parameter.suggestion !== undefined &&
    parameter.suggestion !== ""
  ) {
    facts.push({
      label: translate("profiles.form.fact.suggested", "Suggested"),
      value:
        typeof parameter.suggestion === "string"
          ? parameter.suggestion
          : JSON.stringify(parameter.suggestion),
    });
  }
  if (parameter.effect !== null) {
    facts.push({ label: translate("profiles.form.fact.takesEffect", "Takes effect"), value: labelOfCode(CHANGE_EFFECTS, parameter.effect) });
  }
  if (parameter.description !== null) {
    facts.push({ label: translate("profiles.form.fact.serverNote", "Server note"), value: parameter.description });
  }
  return facts;
}

/** Why a number is outside what the catalogue allows, or null; the page also reads it to find the tab that holds an error. */
export function outOfBounds(parameter: CatalogueParameter, value: unknown): string | null {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  if (parameter.minimum !== null && value < parameter.minimum) {
    return translate("profiles.form.atLeast", "At least {minimum}.", { minimum: parameter.minimum });
  }
  if (parameter.maximum !== null && value > parameter.maximum) {
    return translate("profiles.form.atMost", "At most {maximum}.", { maximum: parameter.maximum });
  }
  return null;
}

function ParameterField({
  parameter,
  value,
  options,
  nullable,
  explanationScope,
  findings,
  overriddenBecause = null,
  disabled: notEditable,
  onChange,
}: ParameterFieldProperties) {
  const { say } = useTranslation();
  const controlId = useId();
  const hintId = `${controlId}-hint`;
  const overriddenId = `${controlId}-overridden`;
  const disabled = notEditable || overriddenBecause !== null;
  // A setting another choice makes irrelevant is not an error — nothing is broken — so it is amber
  // rather than red, and it says so in a word beside the label as well as in colour.
  const overriddenMark =
    overriddenBecause === null ? null : <Badge tone="warn">{translate("profiles.form.notInEffect", "Not in effect")}</Badge>;
  const overriddenNote =
    overriddenBecause === null ? null : (
      <span id={overriddenId} className={FIELD_OVERRIDDEN}>
        {overriddenBecause}
      </span>
    );
  const findingsId = `${controlId}-findings`;
  const described = describeField(explanationScope, parameter);
  const label = typeof described.title === "string" ? described.title : say(described.title);
  const hint = described.hint !== null && described.hint !== "" ? described.hint : null;
  const unit = parameter.unit === null ? null : unitText(parameter.unit);
  const bounds =
    parameter.minimum !== null || parameter.maximum !== null
      ? `${parameter.minimum ?? "…"} – ${parameter.maximum ?? "…"}${unit === null ? "" : ` ${unit}`}`
      : unit;
  const error = outOfBounds(parameter, value);
  const chosen =
    options !== undefined && typeof value === "string"
      ? options.find((option) => option.value === value)
      : undefined;
  const choiceId = `${controlId}-choice`;
  const explanation = (
    <ExplainParameter
      name={label}
      identifier={parameter.path}
      explanation={explainParameter(explanationScope, parameter.path, {
        title: label,
        description: hint ?? parameter.description,
      })}
      facts={declaredFacts(parameter, bounds)}
      findings={findings}
    />
  );
  const wide =
    parameter.type === "OBJECT" ||
    /instructions|prefix/i.test(parameter.path) ||
    (parameter.type === "UUID_LIST" && options !== undefined);

  if (parameter.type === "BOOLEAN") {
    return (
      <div className={FIELD} data-wide="false">
        <div className={FIELD_HEAD}>
          <Checkbox
            label={label}
            hint={hint ?? undefined}
            checked={value === true}
            disabled={disabled}
            aria-describedby={[findings.length > 0 ? findingsId : null, overriddenBecause !== null ? overriddenId : null]
              .filter((identifier): identifier is string => identifier !== null)
              .join(" ") || undefined}
            onChange={(event) => {
              onChange(event.target.checked);
            }}
          />
          {overriddenMark}
          {explanation}
        </div>
        {overriddenNote}
        <ParameterFindings id={findingsId} findings={findings} />
      </div>
    );
  }

  return (
    <div className={FIELD} data-wide={wide}>
      <div className={FIELD_HEAD}>
        <label htmlFor={controlId} className={FIELD_LABEL}>
          <span>{label}</span>
          {bounds !== null && <span className={FIELD_BOUNDS}>{bounds}</span>}
        </label>
        {overriddenMark}
        {explanation}
      </div>
      <FieldControl
        id={controlId}
        describedBy={[
          hint !== null ? hintId : null,
          chosen?.detail !== undefined || chosen?.verdict !== undefined ? choiceId : null,
          findings.length > 0 ? findingsId : null,
          overriddenBecause !== null ? overriddenId : null,
        ]
          .filter((identifier): identifier is string => identifier !== null)
          .join(" ")}
        parameter={parameter}
        value={value}
        options={options}
        nullable={nullable}
        explanationScope={explanationScope}
        findings={findings}
        disabled={disabled}
        onChange={onChange}
      />
      {overriddenNote}
      {error !== null && <span className={FIELD_ERROR}>{error}</span>}
      <ParameterFindings id={findingsId} findings={findings} />
      {chosen !== undefined && (chosen.detail !== undefined || chosen.verdict !== undefined) && (
        <span id={choiceId} className={CHOICE_LINE}>
          {chosen.verdict !== undefined && (
            <Badge tone={chosen.verdict.tone}>{chosen.verdict.text}</Badge>
          )}
          {chosen.detail !== undefined && <span>{chosen.detail}</span>}
        </span>
      )}
      {hint !== null && (
        <span id={hintId} className={FIELD_HINT}>
          {hint}
        </span>
      )}
    </div>
  );
}

function FieldControl({
  id,
  describedBy,
  parameter,
  value,
  options,
  nullable,
  disabled,
  onChange,
}: ParameterFieldProperties & { id: string; describedBy: string }) {
  const { t } = useTranslation();
  const common = { id, "aria-describedby": describedBy, disabled };

  if (options !== undefined && (parameter.type === "UUID" || parameter.type === "TEXT")) {
    const current = typeof value === "string" ? value : "";
    const known = options.some((option) => option.value === current);
    return (
      <Select
        {...common}
        fullWidth
        value={current}
        onChange={(event) => {
          onChange(event.target.value === "" ? (nullable ? null : "") : event.target.value);
        }}
      >
        <option value="">
          {nullable
            ? t("profiles.form.choice.none", "None")
            : options.length === 0
              ? t("profiles.form.choice.nothingYet", "Nothing to choose yet")
              : t("profiles.form.choice.choose", "Choose…")}
        </option>
        {!known && current !== "" && (
          <option value={current}>{t("profiles.form.choice.notFound", "{value} (not found)", { value: current })}</option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
            {option.note === undefined || option.note === "" ? "" : ` — ${option.note}`}
          </option>
        ))}
      </Select>
    );
  }

  switch (parameter.type) {
    case "INTEGER":
    case "DECIMAL":
      return (
        <Input
          {...common}
          type="number"
          className="numeric"
          step={parameter.type === "INTEGER" ? 1 : "any"}
          min={parameter.minimum ?? undefined}
          max={parameter.maximum ?? undefined}
          value={typeof value === "number" ? String(value) : ""}
          placeholder={value === null ? t("profiles.form.noLimit", "No limit") : undefined}
          fullWidth
          onChange={(event) => {
            const text = event.target.value;
            onChange(
              text === ""
                ? null
                : parameter.type === "INTEGER"
                  ? Math.trunc(Number(text))
                  : Number(text),
            );
          }}
        />
      );
    case "CHOICE":
      if (parameter.choices.length === 0) {
        break;
      }
      return (
        <Select
          {...common}
          fullWidth
          value={typeof value === "string" ? value : ""}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        >
          {parameter.choices.map((choice) => (
            <option key={choice} value={choice}>
              {choice}
            </option>
          ))}
        </Select>
      );
    case "CHOICE_LIST": {
      const chosen = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className={CHECKS} role="group" aria-describedby={describedBy}>
          {parameter.choices.map((choice) => (
            <Checkbox
              key={choice}
              label={choice}
              disabled={disabled}
              checked={chosen.includes(choice)}
              onChange={(event) => {
                // The catalogue's order is the meaningful one (parse before chunk), so it is kept.
                const next = event.target.checked
                  ? [...chosen, choice]
                  : chosen.filter((candidate) => candidate !== choice);
                onChange(parameter.choices.filter((candidate) => next.includes(candidate)));
              }}
            />
          ))}
        </div>
      );
    }
    case "UUID_LIST":
      if (options !== undefined) {
        const chosen = Array.isArray(value) ? (value as string[]) : [];
        return options.length === 0 ? (
          <span className="text-xs text-muted">{t("profiles.form.choice.nothingToChooseFrom", "Nothing to choose from yet.")}</span>
        ) : (
          <div className={CHECKS} role="group" aria-describedby={describedBy}>
            {options.map((option) => (
              <Checkbox
                key={option.value}
                label={option.label}
                hint={option.note}
                disabled={disabled}
                checked={chosen.includes(option.value)}
                onChange={(event) => {
                  onChange(
                    event.target.checked
                      ? [...chosen, option.value]
                      : chosen.filter((candidate) => candidate !== option.value),
                  );
                }}
              />
            ))}
          </div>
        );
      }
      return (
        <ListControl
          {...common}
          value={value}
          onChange={onChange}
          code
          listLabel={t("profiles.form.list.identifiers", "Identifiers")}
          addLabel={t("profiles.form.list.addIdentifier", "Add an identifier")}
          removeLabel={(item) => t("profiles.form.list.removeIdentifier", "Remove identifier {value}", { value: item })}
        />
      );
    case "TEXT_LIST":
      return /stopWords/.test(parameter.path) ? (
        <ListControl
          {...common}
          value={value}
          onChange={onChange}
          listLabel={t("profiles.form.list.stopWords", "Stop words")}
          addLabel={t("profiles.form.list.addStopWord", "Add a stop word")}
          removeLabel={(item) => t("profiles.form.list.removeStopWord", "Remove stop word {value}", { value: item })}
        />
      ) : (
        <ListControl
          {...common}
          value={value}
          onChange={onChange}
          listLabel={t("profiles.form.list.values", "Values")}
          addLabel={t("profiles.form.list.addValue", "Add a value")}
          removeLabel={(item) => t("profiles.form.list.removeValue", "Remove value {value}", { value: item })}
        />
      );
    case "OBJECT":
      return <ObjectControl {...common} value={value} onChange={onChange} />;
    default:
      break;
  }

  const text =
    typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
  if (/instructions|prefix/i.test(parameter.path)) {
    return (
      <TextArea
        {...common}
        rows={/instructions/i.test(parameter.path) ? 10 : 2}
        value={text}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    );
  }
  return (
    <Input
      {...common}
      className={parameter.type === "URI" || parameter.type === "UUID" ? "mono" : undefined}
      value={text}
      fullWidth
      onChange={(event) => {
        onChange(parameter.type === "URI" && event.target.value === "" ? null : event.target.value);
      }}
    />
  );
}

function ListControl({
  id,
  "aria-describedby": describedBy,
  value,
  onChange,
  listLabel,
  addLabel,
  removeLabel,
  code = false,
  disabled,
}: {
  id: string;
  "aria-describedby": string;
  disabled: boolean;
  value: unknown;
  onChange: (value: unknown) => void;
  listLabel: string;
  addLabel: string;
  removeLabel: (value: string) => string;
  code?: boolean;
}) {
  return (
    <ChipInput
      id={id}
      aria-describedby={describedBy}
      values={Array.isArray(value) ? (value as string[]) : []}
      onChange={onChange}
      listLabel={listLabel}
      addLabel={addLabel}
      removeLabel={removeLabel}
      code={code}
      disabled={disabled}
    />
  );
}

/** The JSON half of the object placeholder: code, the same in every language. */
const OBJECT_EXAMPLE = [
  '{ "currency": "USD", "perMillionInputTokens": 0.02,',
  '  "validFrom": "2026-01-01", "validUntil": "2027-01-01" }',
].join("\n");

/** An object the catalogue does not break down further, such as pricing: edited as JSON, null when empty. */
function ObjectControl({
  id,
  "aria-describedby": describedBy,
  value,
  onChange,
  disabled,
}: {
  id: string;
  "aria-describedby": string;
  disabled: boolean;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const [text, setText] = useState(() =>
    value === null || value === undefined ? "" : JSON.stringify(value, null, 2),
  );
  const [invalid, setInvalid] = useState(false);
  const { t } = useTranslation();
  return (
    <>
      <TextArea
        id={id}
        aria-describedby={describedBy}
        code
        rows={5}
        disabled={disabled}
        invalid={invalid}
        value={text}
        placeholder={`${t("profiles.form.objectEmpty", "Empty means none, for example:")}\n${OBJECT_EXAMPLE}`}
        onChange={(event) => {
          setText(event.target.value);
        }}
        onBlur={() => {
          if (text.trim() === "") {
            setInvalid(false);
            onChange(null);
            return;
          }
          try {
            onChange(JSON.parse(text));
            setInvalid(false);
          } catch {
            setInvalid(true);
          }
        }}
      />
      {invalid && (
        <span className={FIELD_ERROR}>{t("profiles.form.invalidJson", "Not valid JSON; the last valid value is kept.")}</span>
      )}
    </>
  );
}
