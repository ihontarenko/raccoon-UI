import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Can } from "../../access/Can";
import { PERMISSIONS } from "../../access/permissions";
import { CHANGE_EFFECTS } from "../../application/codeLabels";
import { formatNumber, labelOfCode, type CodeLabels } from "../../application/format";
import { explainParameter } from "../../application/parameterExplanations";
import { describeProblem, type Problem } from "../../application/problems";
import { useResource } from "../../application/useResource";
import { api } from "../../lib/api";
import type { SystemParameterView } from "../../lib/contracts";
import { declareText, translate } from "../../translations/translate";
import { useTranslation } from "../../translations/TranslationProvider";
import {
  EmptyState,
  ExplainParameter,
  Notice,
  ParameterFindings,
  ProblemState,
  Waiting,
  useToaster,
  type ParameterFinding,
} from "../../ui/components";
import { Badge, Button, Dialog, Field, Input, Select, Table } from "../../ui/primitives";
import { PANEL_FORM, PANEL_TOOLBAR, PARAMETER_ACTION_COLUMN, PARAMETER_ALLOWED_COLUMN, PARAMETER_DESCRIPTION, PARAMETER_EFFECT_COLUMN, PARAMETER_GROUP, PARAMETER_GROUP_TITLE, PARAMETER_KEY, PARAMETER_KEY_LINE, PARAMETER_TABLE, PARAMETER_VALUE_COLUMN, TEXT_VALUE_CELL, VALUE_CELL } from "./administrationClasses";

function formatValue(parameter: SystemParameterView, value: number): string {
  if (parameter.type === "BOOLEAN") {
    return value === 1 ? translate("administration.settings.on", "On") : translate("administration.settings.off", "Off");
  }
  return formatNumber(value);
}

/** An address setting holds text, not a number. */
function holdsText(parameter: SystemParameterView): boolean {
  return parameter.type === "URI";
}

/** An address setting with no address. */
function isUnset(parameter: SystemParameterView): boolean {
  return holdsText(parameter) && (parameter.effectiveText === null || parameter.effectiveText === "");
}

/** What a setting holds, as one line: a number, On/Off, an address, or "Not set". */
function describeSetting(parameter: SystemParameterView): string {
  if (holdsText(parameter)) {
    return isUnset(parameter)
      ? translate("administration.settings.notSet", "Not set")
      : (parameter.effectiveText ?? "");
  }
  return formatValue(parameter, parameter.effectiveValue);
}

/** What values a setting accepts, as one line. */
function allowedOf(parameter: SystemParameterView): string {
  if (parameter.type === "BOOLEAN") {
    return translate("administration.settings.onOff", "On / Off");
  }
  if (holdsText(parameter)) {
    return translate("administration.settings.httpAddress", "http(s) address");
  }
  return `${formatNumber(parameter.minimum)} – ${formatNumber(parameter.maximum)}`;
}

/** An absolute http or https address, or empty for "not set"; the server judges it again. */
function validateAddress(text: string): string | undefined {
  const candidate = text.trim();
  if (candidate.length === 0) {
    return undefined;
  }
  try {
    const address = new URL(candidate);
    if (address.protocol !== "http:" && address.protocol !== "https:") {
      return translate("administration.settings.addressScheme", "Start with http:// or https://.");
    }
    if (address.search !== "" || address.hash !== "" || address.username !== "") {
      return translate("administration.settings.addressPlain", "An address without a query, fragment or credentials.");
    }
  } catch {
    return translate("administration.settings.addressFull", "Enter a full address, such as https://raccoon.example.com.");
  }
  return undefined;
}

/**
 * Settings whose value, alone or against a neighbour, switches something off for the whole installation —
 * the same comparisons the answer and search services make with these values.
 */
function settingFindings(
  parameter: SystemParameterView,
  all: SystemParameterView[],
): ParameterFinding[] {
  const valueOf = (key: string): number | undefined =>
    all.find((candidate) => candidate.key === key)?.effectiveValue;
  const value = parameter.effectiveValue;
  switch (parameter.key) {
    case "answer.maximum-calls":
      return value === 0
        ? [
            {
              tone: "warn",
              text: translate(
                "administration.settings.finding.answerCalls",
                "0: every answer in every workspace returns sources only — no model is ever called.",
              ),
            },
          ]
        : [];
    case "mcp.enabled":
      return value === 0
        ? [{ tone: "warn", text: translate("administration.settings.finding.mcp", "Off: every assistant request is refused.") }]
        : [];
    case "processing.automatic-submission-enabled":
      return value === 0
        ? [
            {
              tone: "warn",
              text: translate(
                "administration.settings.finding.automaticSubmission",
                "Off: scans find changes, but nothing is processed until it is switched back on.",
              ),
            },
          ]
        : [];
    case "answer.maximum-total-tokens": {
      const output = valueOf("answer.maximum-output-tokens");
      return output !== undefined && output >= value
        ? [
            {
              tone: "deny",
              text: translate(
                "administration.settings.finding.outputAllowance",
                "The output allowance ({output}) leaves no room for a prompt — every answer is refused.",
                { output: formatNumber(output) },
              ),
            },
          ]
        : [];
    }
    case "answer.maximum-duration-milliseconds": {
      const model = valueOf("answer.maximum-model-milliseconds");
      return model !== undefined && value <= model
        ? [
            {
              tone: "deny",
              text: translate(
                "administration.settings.finding.answerDeadline",
                "Not above the chat deadline ({milliseconds} ms): no time is left for the model call, so answers are refused.",
                { milliseconds: formatNumber(model) },
              ),
            },
          ]
        : [];
    }
    case "provider.chat-minimum-spacing-milliseconds":
    case "provider.embedding-minimum-spacing-milliseconds":
    case "provider.rerank-minimum-spacing-milliseconds": {
      const window = valueOf(parameter.key.replace("minimum-spacing", "window"));
      return window !== undefined && value >= window && value > 0
        ? [
            {
              tone: "warn",
              text: translate(
                "administration.settings.finding.spacing",
                "As long as the window: one call per window under the defaults.",
              ),
            },
          ]
        : [];
    }
    default:
      return [];
  }
}

/** The "About …" button of one setting, with what the server declares about it. */
function AboutSetting({
  parameter,
  findings,
}: {
  parameter: SystemParameterView;
  findings: ParameterFinding[];
}) {
  return (
    <ExplainParameter
      name={parameter.key}
      identifier={parameter.key}
      explanation={explainParameter("system", parameter.key, {
        title: parameter.key,
        description: parameter.description,
      })}
      findings={findings}
      facts={[
        { label: translate("administration.settings.allowed", "Allowed"), value: allowedOf(parameter) },
        ...(holdsText(parameter)
          ? []
          : [
              {
                label: translate("administration.settings.default", "Default"),
                value: formatValue(parameter, parameter.defaultValue),
              },
            ]),
        { label: translate("administration.settings.now", "Now"), value: describeSetting(parameter) },
        { label: translate("administration.settings.takesEffect", "Takes effect"), value: labelOfCode(CHANGE_EFFECTS, parameter.changeEffect) },
        { label: translate("administration.settings.serverNote", "Server note"), value: parameter.description },
      ]}
    />
  );
}

/** The first segment of a system parameter's key, as `settings/SystemParameterCatalogue` names them. */
const SETTING_GROUPS: CodeLabels = {
  answer: declareText("codes.settingGroup.answer", "Answer"),
  automation: declareText("codes.settingGroup.automation", "Automation"),
  connector: declareText("codes.settingGroup.connector", "Connector"),
  context: declareText("codes.settingGroup.context", "Context"),
  documents: declareText("codes.settingGroup.documents", "Documents"),
  embedding: declareText("codes.settingGroup.embedding", "Embedding"),
  evaluation: declareText("codes.settingGroup.evaluation", "Evaluation"),
  identity: declareText("codes.settingGroup.identity", "Identity"),
  index: declareText("codes.settingGroup.index", "Index"),
  jobs: declareText("codes.settingGroup.jobs", "Jobs"),
  processing: declareText("codes.settingGroup.processing", "Processing"),
  provider: declareText("codes.settingGroup.provider", "Provider"),
  scanner: declareText("codes.settingGroup.scanner", "Scanner"),
  search: declareText("codes.settingGroup.search", "Search"),
  storage: declareText("codes.settingGroup.storage", "Storage"),
  worker: declareText("codes.settingGroup.worker", "Worker"),
};

function groupOf(key: string): string {
  return key.split(".")[0] ?? key;
}

/** Group names that are acronyms, which humanising would turn into "Mcp" and "Ui". */
function groupTitleOf(group: string): string {
  if (group === "mcp") {
    return "MCP";
  }
  if (group === "ai") {
    return "AI";
  }
  if (group === "ui") {
    return translate("administration.settings.group.interface", "Interface");
  }
  return labelOfCode(SETTING_GROUPS, group);
}

export function SystemSettingsPanel() {
  const { notify } = useToaster();
  const { t } = useTranslation();
  const parameters = useResource(() => api.listSystemParameters(), []);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<SystemParameterView | null>(null);

  const groups = useMemo(() => {
    if (parameters.status !== "ready") {
      return [];
    }
    const needle = filter.trim().toLowerCase();
    const matching = parameters.data.filter(
      (parameter) =>
        needle.length === 0 ||
        parameter.key.toLowerCase().includes(needle) ||
        parameter.description.toLowerCase().includes(needle),
    );
    const byGroup = new Map<string, SystemParameterView[]>();
    for (const parameter of matching) {
      const group = groupOf(parameter.key);
      byGroup.set(group, [...(byGroup.get(group) ?? []), parameter]);
    }
    return [...byGroup.entries()]
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([name, members]) => ({
        name,
        parameters: [...members].sort((first, second) => first.key.localeCompare(second.key)),
      }));
  }, [parameters, filter]);

  if (parameters.status === "loading") {
    return <Waiting label={t("administration.settings.loading", "Loading system settings")} lines={6} />;
  }
  if (parameters.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={parameters.problem}
        actions={
          <Button icon="refresh" onClick={parameters.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }

  const changedCount = parameters.data.filter(
    (parameter) => parameter.valueOrigin !== "DEFAULT",
  ).length;
  const shownCount = groups.reduce((sum, group) => sum + group.parameters.length, 0);

  return (
    <>
      <div className={PANEL_TOOLBAR}>
        <Field label={t("administration.settings.filter", "Filter settings")}>
          <Input
            type="search"
            value={filter}
            placeholder={t("administration.settings.filterPlaceholder", "Key or description")}
            onChange={(event) => {
              setFilter(event.target.value);
            }}
          />
        </Field>
        <span className="text-xs text-secondary" aria-live="polite">
          {t("administration.settings.summary", "{shown} of {total} settings · {changed} changed from default", {
            shown: <span className="numeric">{shownCount}</span>,
            total: <span className="numeric">{parameters.data.length}</span>,
            changed: <span className="numeric">{changedCount}</span>,
          })}
        </span>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title={t("administration.settings.noMatch", "No setting matches")}
          description={t("administration.settings.noMatchDescription", "Try part of a key, such as “search” or “limit”.")}
          action={
            <Button
              onClick={() => {
                setFilter("");
              }}
            >
              {t("administration.settings.clearFilter", "Clear filter")}
            </Button>
          }
        />
      ) : (
        groups.map((group) => (
          <section
            key={group.name}
            className={PARAMETER_GROUP}
            aria-labelledby={`settings-${group.name}`}
          >
            <h2 id={`settings-${group.name}`} className={PARAMETER_GROUP_TITLE}>
              {groupTitleOf(group.name)}
            </h2>
            <Table className={PARAMETER_TABLE}>
              <colgroup>
                <col />
                <col className={PARAMETER_VALUE_COLUMN} />
                <col className={PARAMETER_ALLOWED_COLUMN} />
                <col className={PARAMETER_EFFECT_COLUMN} />
                <col className={PARAMETER_ACTION_COLUMN} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" className="w-[46%]">{t("administration.settings.setting", "Setting")}</th>
                  <th scope="col" className="numeric">
                    {t("administration.settings.value", "Value")}
                  </th>
                  <th scope="col" className="numeric">
                    {t("administration.settings.allowed", "Allowed")}
                  </th>
                  <th scope="col">{t("administration.settings.takesEffect", "Takes effect")}</th>
                  <th scope="col">
                    <span className="sr-only">{t("common.actions", "Actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.parameters.map((parameter) => {
                  const findings = settingFindings(parameter, parameters.data);
                  return (
                    <tr key={parameter.key}>
                      <td>
                        <div className={PARAMETER_KEY_LINE}>
                          <span className={PARAMETER_KEY}>{parameter.key}</span>
                          <AboutSetting parameter={parameter} findings={findings} />
                        </div>
                        <p className={PARAMETER_DESCRIPTION}>{parameter.description}</p>
                        <ParameterFindings findings={findings} />
                      </td>
                      <td
                        className={
                          holdsText(parameter)
                            ? `mono small ${TEXT_VALUE_CELL}`
                            : `numeric ${VALUE_CELL}`
                        }
                      >
                        {parameter.valueOrigin !== "DEFAULT" && (
                          <Badge tone="active">{t("administration.settings.changed", "Changed")}</Badge>
                        )}{" "}
                        {isUnset(parameter) ? (
                          <span className="text-muted">{t("administration.settings.notSet", "Not set")}</span>
                        ) : (
                          describeSetting(parameter)
                        )}
                      </td>
                      <td className="numeric text-xs text-secondary">
                        {allowedOf(parameter)}
                      </td>
                      <td className="text-xs text-secondary wraps">
                        {labelOfCode(CHANGE_EFFECTS, parameter.changeEffect)}
                      </td>
                      <td className="numeric">
                        <Can permission={PERMISSIONS.systemWrite}>
                          <Button
                            variant="quiet"
                            aria-label={t("administration.settings.changeNamed", "Change {key}", { key: parameter.key })}
                            onClick={() => {
                              setEditing(parameter);
                            }}
                          >
                            {t("administration.settings.change", "Change")}
                          </Button>
                        </Can>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </section>
        ))
      )}

      <ParameterDialog
        parameter={editing}
        onClose={() => {
          setEditing(null);
        }}
        onSaved={(saved) => {
          setEditing(null);
          parameters.replace(
            parameters.data.map((candidate) => (candidate.key === saved.key ? saved : candidate)),
          );
          notify({
            tone: "good",
            title: isUnset(saved)
              ? t("administration.settings.clearedNotice", "{key} cleared", { key: saved.key })
              : t("administration.settings.setNotice", "{key} set to {value}", {
                  key: saved.key,
                  value: describeSetting(saved),
                }),
          });
        }}
      />
    </>
  );
}

interface ParameterDialogProperties {
  parameter: SystemParameterView | null;
  onClose: () => void;
  onSaved: (parameter: SystemParameterView) => void;
}

function ParameterDialog({ parameter, onClose, onSaved }: ParameterDialogProperties) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const [valueError, setValueError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  useEffect(() => {
    if (parameter !== null) {
      setValue(
        holdsText(parameter) ? (parameter.effectiveText ?? "") : String(parameter.effectiveValue),
      );
      setValueError(undefined);
      setProblem(null);
      setSaving(false);
    }
  }, [parameter]);

  const validate = (candidate: SystemParameterView, text: string): number | string => {
    if (!/^-?\d+$/.test(text.trim())) {
      return t("administration.settings.wholeNumber", "Enter a whole number.");
    }
    const number = Number(text.trim());
    if (number < candidate.minimum || number > candidate.maximum) {
      return t("administration.settings.between", "Must be between {minimum} and {maximum}.", {
        minimum: formatNumber(candidate.minimum),
        maximum: formatNumber(candidate.maximum),
      });
    }
    return number;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (parameter === null) {
      return;
    }
    if (holdsText(parameter)) {
      const addressError = validateAddress(value);
      setValueError(addressError);
      if (addressError !== undefined) {
        return;
      }
      setSaving(true);
      setProblem(null);
      try {
        onSaved(
          await api.changeSystemParameterText(parameter.key, value.trim(), parameter.revision),
        );
      } catch (error) {
        setProblem(describeProblem(error));
        setSaving(false);
      }
      return;
    }
    const checked = validate(parameter, value);
    if (typeof checked === "string") {
      setValueError(checked);
      return;
    }
    setValueError(undefined);
    setSaving(true);
    setProblem(null);
    try {
      onSaved(await api.changeSystemParameter(parameter.key, checked, parameter.revision));
    } catch (error) {
      setProblem(describeProblem(error));
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={parameter !== null}
      onClose={onClose}
      title={t("administration.settings.changeSetting", "Change setting")}
      footer={
        <>
          {parameter !== null && holdsText(parameter) && value.trim() !== "" && (
            <Button
              variant="quiet"
              disabled={saving}
              onClick={() => {
                setValue("");
                setValueError(undefined);
              }}
            >
              {t("administration.settings.clear", "Clear")}
            </Button>
          )}
          {parameter !== null &&
            !holdsText(parameter) &&
            parameter.effectiveValue !== parameter.defaultValue && (
              <Button
                variant="quiet"
                disabled={saving}
                onClick={() => {
                  setValue(String(parameter.defaultValue));
                }}
              >
                {t("administration.settings.useDefault", "Use default ({value})", {
                  value: formatValue(parameter, parameter.defaultValue),
                })}
              </Button>
            )}
          <Button variant="quiet" onClick={onClose} disabled={saving}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="submit" form="parameter-form" variant="primary" disabled={saving}>
            {saving ? t("common.saving", "Saving…") : t("common.save", "Save")}
          </Button>
        </>
      }
    >
      {parameter !== null && (
        <form
          id="parameter-form"
          className={PANEL_FORM}
          onSubmit={(event) => void handleSubmit(event)}
          noValidate
        >
          <div>
            <div className={PARAMETER_KEY_LINE}>
              <span className={PARAMETER_KEY}>{parameter.key}</span>
              <AboutSetting parameter={parameter} findings={[]} />
            </div>
            <p className={PARAMETER_DESCRIPTION}>{parameter.description}</p>
          </div>
          {problem !== null && (
            <Notice tone="error" title={problem.title}>
              {problem.detail ?? problem.description}
            </Notice>
          )}
          {holdsText(parameter) ? (
            <Field
              label={t("administration.settings.address", "Address")}
              error={valueError}
              hint={t(
                "administration.settings.addressHint",
                "Scheme, host and, behind a proxy, a path — such as https://raccoon.example.com. Empty: not set.",
              )}
            >
              <Input
                type="url"
                inputMode="url"
                className="numeric"
                spellCheck={false}
                maxLength={2048}
                fullWidth
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                }}
                autoFocus
              />
            </Field>
          ) : parameter.type === "BOOLEAN" ? (
            <Field label={t("administration.settings.value", "Value")}>
              <Select
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                }}
              >
                <option value="1">{t("administration.settings.on", "On")}</option>
                <option value="0">{t("administration.settings.off", "Off")}</option>
              </Select>
            </Field>
          ) : (
            <Field
              label={t("administration.settings.value", "Value")}
              required
              error={valueError}
              hint={t("administration.settings.valueHint", "Between {minimum} and {maximum}. Default {default}.", {
                minimum: formatNumber(parameter.minimum),
                maximum: formatNumber(parameter.maximum),
                default: formatNumber(parameter.defaultValue),
              })}
            >
              <Input
                type="number"
                inputMode="numeric"
                className="numeric"
                min={parameter.minimum}
                max={parameter.maximum}
                step={1}
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                }}
                autoFocus
              />
            </Field>
          )}
          <p className="text-xs text-muted">
            {t("administration.settings.takesEffectLine", "Takes effect: {effect}.", {
              effect: labelOfCode(CHANGE_EFFECTS, parameter.changeEffect).toLowerCase(),
            })}
          </p>
        </form>
      )}
    </Dialog>
  );
}
