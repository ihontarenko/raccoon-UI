import { useTranslation } from "../translations/TranslationProvider";
import { classNames } from "../lib/classNames";
import {
  SEGMENT,
  SEGMENTED_STRIP,
  SEGMENT_PRESSED_BY_PEER,
} from "../ui/components/Segmented";
import { stillMarkAddress } from "../ui/brand/brandFaces";
import { Icon } from "../ui/primitives";
import {
  APPEARANCE_AXES,
  APPEARANCE_LABELS,
  VIVID_SCHEMES,
  type AppearanceAxis,
  type AppearanceState,
} from "./appearance";

const FIELD = "m-0 min-w-0 border-0 p-0";

const LEGEND = "mb-2 p-0 text-2xs font-[550] tracking-[0.09em] text-muted uppercase";

/*
 * ⚠️ THE SAME STRIP THE REST OF THE INTERFACE FILTERS WITH — IMPORTED, NOT COPIED. Only the markup
 * differs: a setting that is SAVED is a fieldset of radios, so an option is a label wrapping its
 * input rather than a button, and the chosen state is read off that input as its peer. The
 * appearance menu once kept its own copy of these rules and drifted into a taller strip; the two
 * constants from `Segmented` are what stop that happening again.
 */
const STRIP = classNames(SEGMENTED_STRIP, "items-stretch");

const OPTION = "group relative flex min-w-0 cursor-pointer";

/*
 * Off screen but still the control: it takes the focus and the keyboard, the label shows the state.
 * Not `sr-only` — the ring the label draws is positioned against this box, so it keeps its place in
 * the strip rather than being clipped out of the layout.
 *
 * ⚠️ `peer` IS NOT DECORATION, IT IS THE WHOLE MECHANISM. The label reads this input's checked and
 * focused states as `peer-checked:` and `peer-focus-visible:`, and those variants compile to
 * `.peer:checked ~ …` — with no `peer` here there is no sibling to match, so the strip renders with
 * nothing marked and no error anywhere. The CSS this replaced said `:checked + .segment`, which
 * needed no marker on the input at all; that is exactly why it was easy to drop.
 */
const OPTION_INPUT = "peer absolute m-0 size-[1px] min-h-0 p-0 opacity-0";

const OPTION_LABEL = classNames(SEGMENT, SEGMENT_PRESSED_BY_PEER, "justify-center group-hover:text-ink");

/**
 * The values of one axis the menu offers.
 *
 * Every axis offers all of them but the colour scheme: the schemes that arrived with the vivid set
 * are shown while vivid is on, and whichever one is in force is always shown — so turning the
 * intensity down leaves the scheme where it was rather than taking its own option off the row.
 */
const VIVID_SCHEME_NAMES = new Set<string>(VIVID_SCHEMES);

function optionsOf(axis: AppearanceAxis, state: AppearanceState): readonly string[] {
  const values: readonly string[] = APPEARANCE_AXES[axis];
  if (axis !== "palette" || state.intensity === "vivid") {
    return values;
  }
  return values.filter((value) => value === state.palette || !VIVID_SCHEME_NAMES.has(value));
}

interface AppearanceControlsProperties {
  state: AppearanceState;
  onChange: (axis: AppearanceAxis, value: string) => void;
}

export function AppearanceControls({ state, onChange }: AppearanceControlsProperties) {
  const { t, say, language, choices, choose } = useTranslation();
  const axes = Object.keys(APPEARANCE_AXES) as AppearanceAxis[];
  return (
    <form
      className="grid gap-6"
      aria-label={t("appearance.settings", "Appearance settings")}
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      {choices.length > 1 && (
        <fieldset className={FIELD}>
          <legend className={LEGEND}>{t("appearance.language", "Language")}</legend>
          <div className={STRIP}>
            {choices.map((choice) => (
              <label key={choice.code} className={OPTION}>
                <input
                  type="radio"
                  className={OPTION_INPUT}
                  name="appearance-language"
                  value={choice.code}
                  checked={language === choice.code}
                  onChange={() => {
                    void choose(choice.code);
                  }}
                />
                <span className={OPTION_LABEL} lang={choice.code}>
                  {choice.nativeName}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {axes.map((axis) => (
        <fieldset key={axis} className={FIELD}>
          <legend className={LEGEND}>{say(APPEARANCE_LABELS[axis].legend)}</legend>
          <div className={STRIP}>
            {optionsOf(axis, state).map((value) => {
              const label = APPEARANCE_LABELS[axis].options[value];
              return (
                <label key={value} className={OPTION}>
                  <input
                    type="radio"
                    className={OPTION_INPUT}
                    name={`appearance-${axis}`}
                    value={value}
                    checked={state[axis] === value}
                    onChange={() => {
                      onChange(axis, value);
                    }}
                  />
                  <span className={OPTION_LABEL}>
                    {axis === "palette" && (
                      <i
                        className="size-[calc(10px*var(--ui-scale))] flex-none rounded-[2px]"
                        style={{ background: `var(--swatch-${value})` }}
                        aria-hidden="true"
                      />
                    )}
                    {axis === "theme" && <Icon name={value === "light" ? "sun" : "moon"} size="small" />}
                    {axis === "mark" && (
                      <img
                        src={stillMarkAddress(value)}
                        alt=""
                        className="size-[calc(16px*var(--ui-scale))] flex-none [image-rendering:pixelated]"
                      />
                    )}
                    {label === undefined ? value : typeof label === "string" ? label : say(label)}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </form>
  );
}
