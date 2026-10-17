import { useId, type ReactNode } from "react";
import { Badge } from "../primitives";

/* Choosing a starting point: every candidate open, the one in hand marked, and what it would do
   beside it. Columns of a fixed minimum, so a group of two and a group of five share one rhythm. */
const CHOICES = "grid grid-cols-[repeat(auto-fit,minmax(calc(260px*var(--ui-scale)),1fr))] gap-2";

/* The chosen one is marked by an edge and a stripe, the way a selected row is — never by colour
   alone. The radio itself is `sr-only`: it carries the state for assistive technology, and the card
   carries it for the eye, which is why the card shows the focus ring of a control inside it. */
const CHOICE = [
  "grid min-w-0 cursor-pointer content-start gap-1 rounded-control border border-line bg-surface p-3",
  "hover:border-line-strong",
  "data-[chosen=true]:border-accent data-[chosen=true]:shadow-[inset_3px_0_0_var(--accent)]",
  "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent",
].join(" ");

/**
 * One ready-made starting point a person may apply: a rule set for a source, a step for a content pipeline.
 * Everything in it is already said in the viewer's language — the picker renders, it does not translate.
 */
export interface PresetChoice {
  key: string;
  /** The heading this choice is listed under; choices sharing a group are drawn together. */
  group: string;
  name: string;
  description: string;
  /** Short facts about what applying it would do, as badges: "7 rules", "then takes the file". */
  facts?: string[];
}

interface PresetPickerProperties {
  /** Names the whole picker, and labels its radio group for a screen reader. */
  label: string;
  hint?: string;
  choices: PresetChoice[];
  selectedKey: string;
  onSelect: (key: string) => void;
  /** What applying the selection does — the caller owns the button and the confirmation. */
  action: ReactNode;
}

/**
 * A preset is a dozen settings, so it is chosen in the open: every candidate shows its name, what it is for
 * and what applying it would do, and the one in hand is marked rather than merely current in a closed list.
 *
 * ⚠️ This replaced a `<select>` whose descriptions lived in `title=` attributes — text that exists only for a
 * pointer that happens to rest on an option, which is to say for nobody. It is written for both of the
 * product's preset libraries: a source's scan rules, and a processing profile's content steps.
 */
export function PresetPicker({ label, hint, choices, selectedKey, onSelect, action }: PresetPickerProperties) {
  const labelId = useId();
  const hintId = useId();
  return (
    <section className="grid gap-4 rounded-surface border border-line bg-well p-4" aria-labelledby={labelId}>
      <div className="grid gap-1">
        <h3 id={labelId} className="m-0 text-sm font-[650]">
          {label}
        </h3>
        {hint !== undefined && (
          <p id={hintId} className="m-0 text-xs text-secondary">
            {hint}
          </p>
        )}
      </div>
      <PresetChoices
        labelledBy={labelId}
        describedBy={hint === undefined ? undefined : hintId}
        choices={choices}
        selectedKey={selectedKey}
        onSelect={onSelect}
      />
      <div className="flex flex-wrap gap-2">{action}</div>
    </section>
  );
}

interface PresetChoicesProperties {
  /** The id of whatever names the choice — a picker's heading, a form step's legend. */
  labelledBy: string;
  describedBy?: string;
  choices: PresetChoice[];
  selectedKey: string;
  onSelect: (key: string) => void;
}

/**
 * The choices alone, grouped, for a form that already frames them — a step of the new-source form has its own legend
 * and its own submit, and must not get a second heading and an empty action row. ⚠️ ONE DRAWING OF A PRESET: the
 * new-source form used to lay its presets out as a radio list of its own, so the same catalogue looked like two.
 */
export function PresetChoices({ labelledBy, describedBy, choices, selectedKey, onSelect }: PresetChoicesProperties) {
  const groupName = useId();
  const groups: string[] = [];
  for (const choice of choices) {
    if (!groups.includes(choice.group)) {
      groups.push(choice.group);
    }
  }
  return (
    <div className="grid gap-4" role="radiogroup" aria-labelledby={labelledBy} aria-describedby={describedBy}>
      {groups.map((group) => (
        <div key={group} className="grid gap-2">
          <h4 className="m-0 text-2xs font-semibold tracking-[0.06em] text-secondary uppercase">
            {group}
          </h4>
          <div className={CHOICES}>
            {choices
              .filter((choice) => choice.group === group)
              .map((choice) => (
                <label key={choice.key} className={CHOICE} data-chosen={choice.key === selectedKey}>
                  <input
                    type="radio"
                    name={groupName}
                    className="sr-only"
                    value={choice.key}
                    checked={choice.key === selectedKey}
                    onChange={() => onSelect(choice.key)}
                  />
                  <span className="text-sm font-[650]">{choice.name}</span>
                  <span className="text-xs leading-[1.5] text-secondary">{choice.description}</span>
                  {choice.facts !== undefined && choice.facts.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {choice.facts.map((fact) => (
                        <Badge key={fact}>{fact}</Badge>
                      ))}
                    </span>
                  )}
                </label>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
