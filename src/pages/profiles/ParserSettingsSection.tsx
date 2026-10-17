import { Link } from "@tanstack/react-router";
import { useId, useState, type ReactNode } from "react";
import { useResource } from "../../application/useResource";
import type { ProfileConfiguration } from "../../lib/profiles";
import {
  AUTOMATIC_PARSER,
  isDefaultValue,
  parsersApi,
  type Parser,
  type ParserOption,
  type ParserOverview,
} from "../../lib/parsers";
import { explainParameter } from "../../application/parameterExplanations";
import { ExplainParameter, ProblemState, Waiting } from "../../ui/components";
import { Badge, Button, Checkbox, Input, Select, TextArea } from "../../ui/primitives";
import { SECTION, SECTION_LINK, SECTION_TITLE, UNUSED_ROW } from "./sectionClasses";

const POSITION = [
  "inline-grid h-[calc(22px*var(--ui-scale))] min-w-[calc(22px*var(--ui-scale))] place-items-center",
  "rounded-control border border-line-strong text-xs",
].join(" ");

/* A value changed from the parser default is marked on its leading edge, so a profile departures
   read at a glance rather than by comparing it with the parser page. */
const OPTION = [
  "grid min-w-0 content-start gap-1 border-l-2 border-l-transparent pl-2",
  "data-[changed=true]:border-l-accent",
].join(" ");

interface ParserSettingsSectionProperties {
  workspaceId: string;
  configuration: ProfileConfiguration;
  onChange: (configuration: ProfileConfiguration) => void;
  disabled: boolean;
  /** On a parser's own page: only that parser — its options in this profile and its place in the order. */
  onlyParser?: string;
}

type OptionValues = Record<string, unknown>;

function automaticOrderOf(configuration: ProfileConfiguration, overview: ParserOverview): string[] {
  const stored = configuration.automaticParserIds;
  return Array.isArray(stored) && stored.length > 0
    ? (stored as string[])
    : overview.defaultAutomaticOrder;
}

function optionsOf(configuration: ProfileConfiguration, parserId: string): OptionValues {
  const all = configuration.parserOptions;
  if (all === null || typeof all !== "object") {
    return {};
  }
  const values = (all as Record<string, unknown>)[parserId];
  return values !== null && typeof values === "object" ? (values as OptionValues) : {};
}

/**
 * The parsers a processing profile reads documents with, and their options — what each indexes and what it
 * only keeps for reading. Under automatic selection the order matters: the first parser that accepts a
 * document reads it. The server completes the options on save, so what is saved is what runs.
 */
export function ParserSettingsSection({
  workspaceId,
  configuration,
  onChange,
  disabled,
  onlyParser,
}: ParserSettingsSectionProperties) {
  const overview = useResource<ParserOverview>(
    () => parsersApi.overview(workspaceId),
    [workspaceId],
  );

  if (overview.status === "loading") {
    return <Waiting label="Loading the parsers" lines={3} />;
  }
  if (overview.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={overview.problem}
        actions={
          <Button icon="refresh" onClick={overview.reload}>
            Try again
          </Button>
        }
      />
    );
  }

  const parsers = overview.data.parsers;
  const byIdentifier = new Map(parsers.map((parser) => [parser.identifier, parser]));
  const automatic = configuration.parserId === AUTOMATIC_PARSER;
  const order = automaticOrderOf(configuration, overview.data);
  const used = automatic
    ? order
        .map((identifier) => byIdentifier.get(identifier))
        .filter((parser): parser is Parser => parser !== undefined)
    : [];
  const fixed = automatic ? undefined : byIdentifier.get(String(configuration.parserId));
  const unused = automatic ? parsers.filter((parser) => !order.includes(parser.identifier)) : [];

  const setOrder = (next: string[]) => {
    onChange({ ...configuration, automaticParserIds: next });
  };
  const move = (identifier: string, step: -1 | 1) => {
    const index = order.indexOf(identifier);
    const target = index + step;
    if (index < 0 || target < 0 || target >= order.length) {
      return;
    }
    const next = [...order];
    next[index] = order[target] ?? identifier;
    next[target] = identifier;
    setOrder(next);
  };
  const setOption = (parserId: string, option: ParserOption, value: unknown) => {
    const all =
      configuration.parserOptions !== null && typeof configuration.parserOptions === "object"
        ? (configuration.parserOptions as Record<string, OptionValues>)
        : {};
    onChange({
      ...configuration,
      parserOptions: {
        ...all,
        [parserId]: { ...optionsOf(configuration, parserId), [option.name]: value },
      },
    });
  };

  if (onlyParser !== undefined) {
    const parser = byIdentifier.get(onlyParser);
    if (parser === undefined) {
      return null;
    }
    const position = automatic ? order.indexOf(onlyParser) : -1;
    const sendsHere = automatic ? position >= 0 : fixed?.identifier === onlyParser;
    return (
      <fieldset className={SECTION} disabled={disabled}>
        <p className="m-0 text-xs text-secondary">
          {automatic
            ? position >= 0
              ? `Automatic selection: it is choice ${position + 1} of ${order.length} — a document goes to the first parser in the profile's order that accepts it.`
              : "Automatic selection, and this parser is not in the profile's order: no document of this profile reaches it."
            : fixed?.identifier === onlyParser
              ? "Fixed: every document of this profile goes to this parser."
              : `Fixed: every document of this profile goes to ${fixed?.descriptor.name ?? String(configuration.parserId)}, never here.`}{" "}
          Options decide what goes into keyword entries and vectors; chunks keep the whole text either way.
        </p>
        {sendsHere ? (
          <ol className="m-0 grid list-none gap-2 p-0" aria-label="This parser in the profile">
            <ParserRow
              parser={parser}
              position={automatic ? position + 1 : null}
              values={optionsOf(configuration, parser.identifier)}
              onOption={(option, value) => {
                setOption(parser.identifier, option, value);
              }}
            />
          </ol>
        ) : (
          automatic && (
            <div>
              <Button
                variant="quiet"
                icon="plus"
                onClick={() => {
                  setOrder([...order, parser.identifier]);
                }}
              >
                Use it in this profile, last in the order
              </Button>
            </div>
          )
        )}
      </fieldset>
    );
  }

  return (
    <fieldset className={SECTION} disabled={disabled}>
      <legend className={SECTION_TITLE}>Parsers and what they index</legend>
      <p className="text-xs text-secondary">
        {automatic
          ? "Automatic: each document goes to the first parser below that accepts its media type or extension. A document none accepts is refused with that reason."
          : "Fixed: every document goes through the parser chosen under General, and a document whose type that parser does not read is refused with that reason rather than run through it."}{" "}
        Options decide what goes into keyword entries and vectors; chunks keep the whole text either
        way, so it stays readable and citable. Saving writes a new revision: documents prepared with
        an older one are prepared again by processing them again.{" "}
        <Link to="/parsers" className={SECTION_LINK}>
          All parsers
        </Link>
      </p>

      {automatic && (
        <ol className="m-0 grid list-none gap-2 p-0" aria-label="Parsers in order of preference">
          {used.map((parser, index) => (
            <ParserRow
              key={parser.identifier}
              parser={parser}
              position={index + 1}
              values={optionsOf(configuration, parser.identifier)}
              onOption={(option, value) => {
                setOption(parser.identifier, option, value);
              }}
              controls={
                <span className="ml-auto flex gap-1">
                  <Button
                    variant="quiet"
                    icon="arrowUp"
                    iconOnly
                    aria-label={`Prefer ${parser.descriptor.name} earlier`}
                    disabled={index === 0}
                    onClick={() => {
                      move(parser.identifier, -1);
                    }}
                  />
                  <Button
                    variant="quiet"
                    icon="arrowDown"
                    iconOnly
                    aria-label={`Prefer ${parser.descriptor.name} later`}
                    disabled={index === used.length - 1}
                    onClick={() => {
                      move(parser.identifier, 1);
                    }}
                  />
                  <Button
                    variant="quiet"
                    icon="close"
                    iconOnly
                    aria-label={`Stop using ${parser.descriptor.name}`}
                    disabled={used.length === 1}
                    onClick={() => {
                      setOrder(order.filter((identifier) => identifier !== parser.identifier));
                    }}
                  />
                </span>
              }
            />
          ))}
        </ol>
      )}
      {automatic && unused.length > 0 && (
        <div className={UNUSED_ROW}>
          <span className="text-xs text-muted">Not used by this profile:</span>
          {unused.map((parser) => (
            <Button
              key={parser.identifier}
              variant="quiet"
              icon="plus"
              onClick={() => {
                setOrder([...order, parser.identifier]);
              }}
            >
              {parser.descriptor.name}
            </Button>
          ))}
        </div>
      )}
      {!automatic && fixed !== undefined && (
        <>
          {/* What it reads, beside the choice: fixing a parser a document's type does not match now refuses the
              document, so the types are the difference between a profile that works and one that refuses everything. */}
          <p className="text-xs text-secondary">
            It reads {fixed.descriptor.mediaTypes.join(", ")}
            {fixed.descriptor.extensions.length > 0 && <> · {fixed.descriptor.extensions.join(" ")}</>}
          </p>
          <ol className="m-0 grid list-none gap-2 p-0" aria-label="The parser">
            <ParserRow
              parser={fixed}
              position={null}
              values={optionsOf(configuration, fixed.identifier)}
              onOption={(option, value) => {
                setOption(fixed.identifier, option, value);
              }}
            />
          </ol>
        </>
      )}
    </fieldset>
  );
}

interface ParserRowProperties {
  parser: Parser;
  position: number | null;
  values: OptionValues;
  onOption: (option: ParserOption, value: unknown) => void;
  controls?: ReactNode;
}

function ParserRow({ parser, position, values, onOption, controls }: ParserRowProperties) {
  const { descriptor } = parser;
  return (
    <li className="grid min-w-0 gap-2 rounded-control border border-line bg-well p-3">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        {position !== null && <span className={`numeric ${POSITION}`}>{position}</span>}
        <strong>{descriptor.name}</strong>
        <span className="text-xs text-muted">
          {[
            ...descriptor.extensions,
            ...descriptor.mediaTypes.filter((type) => !type.endsWith("/*")),
          ]
            .slice(0, 4)
            .join(" · ")}
        </span>
        {!parser.availability.available && <Badge tone="deny">Cannot run here</Badge>}
        {controls}
      </div>
      {!parser.availability.available && (
        <p className="m-0 text-xs text-deny">{parser.availability.detail}</p>
      )}
      {descriptor.options.length > 0 && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 max-[720px]:grid-cols-[minmax(0,1fr)]">
          {descriptor.options.map((option) => (
            <OptionField
              key={option.name}
              parserId={parser.identifier}
              option={option}
              value={option.name in values ? values[option.name] : option.defaultValue}
              onChange={(value) => {
                onOption(option, value);
              }}
            />
          ))}
        </div>
      )}
    </li>
  );
}

function OptionField({
  parserId,
  option,
  value,
  onChange,
}: {
  parserId: string;
  option: ParserOption;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const controlId = useId();
  const changed = !isDefaultValue(option, value);
  const path = `parserOptions.${parserId}.${option.name}`;
  const explanation = (
    <ExplainParameter
      name={option.label}
      identifier={path}
      explanation={explainParameter("processing", path, {
        title: option.label,
        description: option.description,
      })}
    />
  );
  if (option.type === "BOOLEAN") {
    return (
      <div className={OPTION} data-changed={changed}>
        <div className="flex flex-wrap justify-between gap-x-2 gap-y-0 text-xs font-semibold">
          <Checkbox
            label={option.label}
            hint={option.description}
            checked={value === true}
            onChange={(event) => {
              onChange(event.target.checked);
            }}
          />
          {explanation}
        </div>
      </div>
    );
  }
  if (option.type === "INTEGER") {
    const hintId = `${controlId}-hint`;
    return (
      <div className={OPTION} data-changed={changed}>
        <label htmlFor={controlId} className="flex flex-wrap justify-between gap-x-2 gap-y-0 text-xs font-semibold">
          {option.label}
          <span className="text-xs text-muted numeric">
            {option.minimum}–{option.maximum}
          </span>
        </label>
        {explanation}
        <Input
          id={controlId}
          type="number"
          className="numeric"
          min={option.minimum ?? undefined}
          max={option.maximum ?? undefined}
          step={1}
          aria-describedby={hintId}
          value={typeof value === "number" ? String(value) : ""}
          onChange={(event) => {
            onChange(
              event.target.value === ""
                ? option.defaultValue
                : Math.trunc(Number(event.target.value)),
            );
          }}
        />
        <span id={hintId} className="text-xs leading-[1.45] text-muted">
          {option.description}
        </span>
      </div>
    );
  }
  if (option.type === "CHOICE") {
    const hintId = `${controlId}-hint`;
    return (
      <div className={OPTION} data-changed={changed}>
        <label htmlFor={controlId} className="flex flex-wrap justify-between gap-x-2 gap-y-0 text-xs font-semibold">
          {option.label}
        </label>
        {explanation}
        <Select
          id={controlId}
          aria-describedby={hintId}
          value={typeof value === "string" ? value : String(option.defaultValue)}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        >
          {option.choices.map((choice) => (
            <option key={choice} value={choice}>
              {choice}
            </option>
          ))}
        </Select>
        <span id={hintId} className="text-xs leading-[1.45] text-muted">
          {option.description}
        </span>
      </div>
    );
  }
  if (option.type === "TEXT_LIST") {
    const hintId = `${controlId}-hint`;
    const lines = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className={OPTION} data-changed={changed}>
        <label htmlFor={controlId} className="flex flex-wrap justify-between gap-x-2 gap-y-0 text-xs font-semibold">
          {option.label}
        </label>
        {explanation}
        <TextListArea id={controlId} describedBy={hintId} lines={lines} onChange={onChange} />
        <span id={hintId} className="text-xs leading-[1.45] text-muted">
          {option.description}
        </span>
      </div>
    );
  }
  const chosen = Array.isArray(value) ? (value as string[]) : [];
  return (
    <div className={OPTION} data-changed={changed}>
      <span className="flex flex-wrap justify-between gap-x-2 gap-y-0 text-xs font-semibold">{option.label}</span>
      <div className="flex flex-wrap gap-x-4 gap-y-2" role="group" aria-label={option.label}>
        {option.choices.map((choice) => (
          <Checkbox
            key={choice}
            label={choice}
            checked={chosen.includes(choice)}
            onChange={(event) => {
              const next = event.target.checked
                ? [...chosen, choice]
                : chosen.filter((candidate) => candidate !== choice);
              onChange(option.choices.filter((candidate) => next.includes(candidate)));
            }}
          />
        ))}
      </div>
      <span className="text-xs leading-[1.45] text-muted">{option.description}</span>
    </div>
  );
}

/**
 * A list of texts edited one per line. The draft keeps what is being typed — a new empty line, a trailing space — and
 * the value it stands for is the non-empty lines, trimmed.
 */
function TextListArea({ id, describedBy, lines, onChange }: { id: string; describedBy: string; lines: string[]; onChange: (value: unknown) => void }) {
  const [draft, setDraft] = useState(lines.join("\n"));
  return (
    <TextArea
      id={id}
      code
      rows={Math.min(8, Math.max(2, lines.length + 1))}
      aria-describedby={describedBy}
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
        onChange(
          event.target.value
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0),
        );
      }}
    />
  );
}
