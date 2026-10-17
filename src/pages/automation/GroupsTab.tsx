import { useEffect, useState } from "react";
import { usePermissions } from "../../access/PermissionsProvider";
import { PERMISSIONS } from "../../access/permissions";
import { shortIdentifier } from "../../application/format";
import { describeProblem, type Problem } from "../../application/problems";
import { usePagedList } from "../../application/usePagedList";
import { useResource } from "../../application/useResource";
import { collectAllPages } from "../../lib/api";
import {
  automationApi,
  type FailurePolicy,
  type ScriptBinding,
  type ScriptGroup,
  type StageView,
} from "../../lib/automation";
import { CONTENT_RULE_SCRIPT_STAGE, RULE_SCRIPT_STAGE, type ScriptView } from "../../lib/sourceContracts";
import { translate } from "../../translations/translate";
import { useTranslation } from "../../translations/TranslationProvider";
import {
  EmptyState,
  ListFooter,
  Notice,
  ProblemState,
  Waiting,
  useToaster,
} from "../../ui/components";
import { Badge, Button, Checkbox, Dialog, Field, Input, Select, Table } from "../../ui/primitives";
import { BINDINGS, CARD, CARD_HEAD, CARD_LIST, DIALOG_BODY, ORDER_INPUT, STACK, TOOLBAR } from "./automationClasses";

const NAME_LIMIT = 160;
const MAXIMUM_BINDINGS = 16;

/** What a binding can name: the event scripts, read whole because a group names any of them, and the stages. */
interface Catalogue {
  scripts: ScriptView[];
  stages: StageView[];
}

/**
 * A group binds published script versions to the stages they handle, in order. Profiles and rule sets
 * name groups, which is how a script comes to run.
 */
export function GroupsTab({ workspaceId }: { workspaceId: string }) {
  const { t, plural } = useTranslation();
  const mayManage = usePermissions().may(PERMISSIONS.automationManage);
  const [editing, setEditing] = useState<{ group: ScriptGroup | null } | null>(null);
  const { notify } = useToaster();
  const loaded = useResource<Catalogue>(async () => {
    const [scripts, stages] = await Promise.all([
      collectAllPages((page) => automationApi.scripts(workspaceId, page, "EVENT")),
      automationApi.stages(workspaceId),
    ]);
    return { scripts, stages };
  }, [workspaceId]);
  const groupPages = usePagedList((page) => automationApi.groups(workspaceId, page), [workspaceId]);

  if (loaded.status === "loading" || groupPages.status === "loading") {
    return <Waiting label={t("automation.groups.loading", "Loading groups")} lines={4} />;
  }
  const retry = (problem: Problem, reload: () => void) => (
    <ProblemState
      layout="section"
      problem={problem}
      actions={
        <Button icon="refresh" onClick={reload}>
          {t("common.tryAgain", "Try again")}
        </Button>
      }
    />
  );
  if (loaded.status === "failed") {
    return retry(loaded.problem, loaded.reload);
  }
  if (groupPages.status === "failed") {
    return retry(groupPages.problem, groupPages.reload);
  }
  const groups = groupPages.items;
  const { scripts } = loaded.data;
  const scriptOfVersion = (versionId: string) =>
    scripts.find((script) => script.activeVersionId === versionId) ?? null;

  return (
    <div className={STACK}>
      <div className={TOOLBAR}>
        <span className="text-xs text-muted">
          {t(
            "automation.groups.versionPinned",
            "A binding names a published version; publishing a newer one does not move a group until the group is saved again.",
          )}
        </span>
        {mayManage && (
          <Button icon="plus" onClick={() => setEditing({ group: null })}>
            {t("automation.groups.new", "New group")}
          </Button>
        )}
      </div>
      {groups.length === 0 ? (
        <EmptyState
          title={t("automation.groups.empty", "No groups yet")}
          description={t(
            "automation.groups.emptyDescription",
            "Publish an event script, then bind it here to the stage it handles.",
          )}
        />
      ) : (
        <ul className={CARD_LIST}>
          {groups.map((group) => (
            <li key={group.id} className={CARD}>
              <div className={CARD_HEAD}>
                <div>
                  <strong>{group.name}</strong>
                  <div className="text-xs text-muted">
                    {plural(
                      "automation.groups.summary",
                      group.configuration.bindings.length,
                      {
                        one: "revision {revision} · {count} binding",
                        other: "revision {revision} · {count} bindings",
                      },
                      { revision: group.revision },
                    )}
                  </div>
                </div>
                {mayManage && (
                  <Button variant="quiet" icon="edit" onClick={() => setEditing({ group })}>
                    {t("automation.groups.edit", "Edit")}
                  </Button>
                )}
              </div>
              <ol className={BINDINGS}>
                {[...group.configuration.bindings]
                  .sort((first, second) => first.order - second.order)
                  .map((binding) => {
                    const script = scriptOfVersion(binding.scriptVersionId);
                    return (
                      <li
                        key={`${binding.scriptVersionId}-${binding.order}`}
                        data-enabled={binding.enabled}
                      >
                        <span
                          className="numeric text-muted"
                          title={t("automation.groups.position", "Position in the group")}
                        >
                          {binding.order + 1}
                        </span>
                        <span className="numeric text-xs">{binding.stage}</span>
                        <span>
                          {script?.title ?? (
                            <span className="text-muted">
                              {t("automation.groups.earlierVersion", "an earlier version")}
                            </span>
                          )}{" "}
                          <span className="numeric text-xs text-muted">
                            {shortIdentifier(binding.scriptVersionId)}
                          </span>
                        </span>
                        <span>
                          {!binding.enabled && (
                            <Badge tone="neutral">{t("automation.groups.off", "Off")}</Badge>
                          )}{" "}
                          <Badge tone={binding.failurePolicy === "STOP" ? "warn" : "neutral"}>
                            {binding.failurePolicy === "STOP"
                              ? t("automation.groups.stopsOnFailure", "Stops on failure")
                              : t("automation.groups.ignoresFailure", "Ignores failure")}
                          </Badge>
                        </span>
                      </li>
                    );
                  })}
              </ol>
            </li>
          ))}
        </ul>
      )}
      {groups.length > 0 && (
        <ListFooter
          shown={groups.length}
          counted={plural("automation.groups.count", groups.length, {
            one: "{count} group",
            other: "{count} groups",
          })}
          hasMore={groupPages.hasMore}
          loadingMore={groupPages.loadingMore}
          moreProblem={groupPages.moreProblem}
          onLoadMore={groupPages.loadMore}
        />
      )}
      <GroupDialog
        editing={editing}
        workspaceId={workspaceId}
        catalogue={loaded.data}
        onClose={() => setEditing(null)}
        onSaved={(saved) => {
          setEditing(null);
          notify({
            tone: "good",
            title: t("automation.groups.savedNotice", "{name} saved", { name: saved.name }),
            description: t("automation.groups.savedRevision", "Revision {revision}", {
              revision: saved.revision,
            }),
          });
          groupPages.reload();
        }}
      />
    </div>
  );
}

function GroupDialog({
  editing,
  workspaceId,
  catalogue,
  onClose,
  onSaved,
}: {
  editing: { group: ScriptGroup | null } | null;
  workspaceId: string;
  catalogue: Catalogue;
  onClose: () => void;
  onSaved: (group: ScriptGroup) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [bindings, setBindings] = useState<ScriptBinding[]>([]);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [saving, setSaving] = useState(false);
  const group = editing?.group ?? null;

  useEffect(() => {
    if (editing !== null) {
      setName(editing.group?.name ?? "");
      setBindings(
        editing.group === null
          ? []
          : [...editing.group.configuration.bindings].sort(
              (first, second) => first.order - second.order,
            ),
      );
      setProblem(null);
      setSaving(false);
    }
  }, [editing]);

  const publishedEventScripts = catalogue.scripts.filter(
    (script) => script.activeVersionId !== null && script.stage !== RULE_SCRIPT_STAGE && script.stage !== CONTENT_RULE_SCRIPT_STAGE,
  );
  const observes = (stage: string) =>
    catalogue.stages.find((candidate) => candidate.name === stage)?.timing === "OBSERVATION";

  const update = (index: number, patch: Partial<ScriptBinding>) => {
    setBindings((current) =>
      current.map((binding, position) => (position === index ? { ...binding, ...patch } : binding)),
    );
  };

  const add = () => {
    const first = publishedEventScripts[0];
    if (first?.activeVersionId === null || first === undefined) {
      return;
    }
    setBindings((current) => [
      ...current,
      {
        scriptVersionId: first.activeVersionId ?? "",
        stage: first.stage,
        order: current.length === 0 ? 0 : Math.max(...current.map((binding) => binding.order)) + 1,
        enabled: true,
        failurePolicy: observes(first.stage) ? "IGNORE" : "STOP",
      },
    ]);
  };

  const save = async () => {
    if (name.trim().length === 0) {
      setProblem({
        kind: "invalid",
        title: translate("automation.groups.nameRequired", "Name the group"),
        description: translate(
          "automation.groups.nameRequiredDescription",
          "A profile or rule set names the group to run it.",
        ),
        detail: null,
        status: null,
      });
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      onSaved(
        group === null
          ? await automationApi.createGroup(workspaceId, name.trim(), bindings)
          : await automationApi.saveGroup(workspaceId, group, name.trim(), bindings),
      );
    } catch (error) {
      setProblem(describeProblem(error));
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={editing !== null}
      onClose={onClose}
      title={
        group === null
          ? t("automation.groups.newTitle", "New script group")
          : t("automation.groups.editTitle", "Edit {name}", { name: group.name })
      }
      size="wide"
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={saving}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button variant="primary" disabled={saving} onClick={() => void save()}>
            {saving ? t("common.saving", "Saving…") : t("automation.groups.save", "Save group")}
          </Button>
        </>
      }
    >
      <div className={DIALOG_BODY}>
        {problem !== null && (
          <Notice tone="error" title={problem.title}>
            {problem.detail ?? problem.description}
          </Notice>
        )}
        <Field label={t("automation.groups.name", "Name")} required>
          <Input
            value={name}
            maxLength={NAME_LIMIT}
            fullWidth
            autoFocus
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        {bindings.length === 0 ? (
          <p className="text-xs text-muted">
            {t("automation.groups.noBindings", "No bindings yet. A group with none runs nothing.")}
          </p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th scope="col" className="numeric">
                  {t("automation.groups.order", "Order")}
                </th>
                <th scope="col">{t("automation.groups.scriptVersion", "Script version")}</th>
                <th scope="col">{t("automation.groups.onFailure", "On failure")}</th>
                <th scope="col">
                  <span className="sr-only">{t("common.actions", "Actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {bindings.map((binding, index) => {
                const known = publishedEventScripts.some(
                  (script) => script.activeVersionId === binding.scriptVersionId,
                );
                return (
                  <tr key={index}>
                    <td>
                      <Input
                        type="number"
                        className={`numeric ${ORDER_INPUT}`}
                        min={0}
                        aria-label={t("automation.groups.order", "Order")}
                        value={String(binding.order)}
                        onChange={(event) =>
                          update(index, {
                            order: Math.max(0, Math.trunc(Number(event.target.value))),
                          })
                        }
                      />
                    </td>
                    <td>
                      <Select
                        aria-label={t("automation.groups.scriptVersion", "Script version")}
                        value={binding.scriptVersionId}
                        onChange={(event) => {
                          const script = publishedEventScripts.find(
                            (candidate) => candidate.activeVersionId === event.target.value,
                          );
                          if (script !== undefined) {
                            update(index, {
                              scriptVersionId: event.target.value,
                              stage: script.stage,
                              failurePolicy: observes(script.stage)
                                ? "IGNORE"
                                : binding.failurePolicy,
                            });
                          }
                        }}
                      >
                        {!known && (
                          <option value={binding.scriptVersionId}>
                            {t(
                              "automation.groups.earlierVersionAt",
                              "an earlier version · {stage}",
                              { stage: binding.stage },
                            )}
                          </option>
                        )}
                        {publishedEventScripts.map((script) => (
                          <option key={script.id} value={script.activeVersionId ?? ""}>
                            {script.title} · {script.stage}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td>
                      <Select
                        aria-label={t("automation.groups.onFailure", "On failure")}
                        value={binding.failurePolicy}
                        disabled={observes(binding.stage)}
                        title={
                          observes(binding.stage)
                            ? t(
                                "automation.groups.observationCannotStop",
                                "An observation stage cannot stop work already committed",
                              )
                            : undefined
                        }
                        onChange={(event) =>
                          update(index, { failurePolicy: event.target.value as FailurePolicy })
                        }
                      >
                        <option value="STOP">
                          {t("automation.groups.failurePolicy.stop", "Stop the work")}
                        </option>
                        <option value="IGNORE">
                          {t("automation.groups.failurePolicy.ignore", "Ignore")}
                        </option>
                      </Select>
                    </td>
                    <td className="actions">
                      <Checkbox
                        label={t("automation.groups.on", "On")}
                        checked={binding.enabled}
                        onChange={(event) => update(index, { enabled: event.target.checked })}
                      />
                      <Button
                        variant="quiet"
                        iconOnly
                        icon="trash"
                        aria-label={t("automation.groups.removeBinding", "Remove binding")}
                        onClick={() =>
                          setBindings((current) =>
                            current.filter((_unused, position) => position !== index),
                          )
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        {publishedEventScripts.length === 0 ? (
          <p className="text-xs text-muted">
            {t(
              "automation.groups.nothingPublished",
              "No event script is published yet; publish one to bind it.",
            )}
          </p>
        ) : (
          <Button
            variant="quiet"
            icon="plus"
            disabled={bindings.length >= MAXIMUM_BINDINGS}
            onClick={add}
          >
            {t("automation.groups.addBinding", "Add binding")}
          </Button>
        )}
      </div>
    </Dialog>
  );
}
