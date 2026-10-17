import { useMemo, useState } from "react";
import { formatDateTime, shortIdentifier } from "../../../application/format";
import { describeProblem } from "../../../application/problems";
import { useResource } from "../../../application/useResource";
import { useStoredChoice } from "../../../application/useStoredChoice";
import { aiApi } from "../../../lib/ai";
import { collectAllPages, api } from "../../../lib/api";
import { accessAdministrationApi, jmpLineOf, type AccessRule, type RuleKind } from "../../../lib/accessAdministration";
import { useTranslation } from "../../../translations/TranslationProvider";
import { ConfirmDialog, EmptyState, ProblemState, Segmented, Waiting, useToaster } from "../../../ui/components";
import { Badge, Button, Select, Table, type BadgeTone } from "../../../ui/primitives";
import { RuleDialog } from "./RuleDialog";

type SliceKind = "subject" | "workspace" | "permission";

/* The slice on top — which question the table answers — and the one action on the right. */
const TOOLBAR = "flex flex-wrap items-end gap-3 border-b border-line pb-4";

const PICK = "grid min-w-[calc(200px*var(--ui-scale))] gap-1.5 [&>span]:text-xs [&>span]:font-[550] [&>span]:text-secondary";

/* Rules beside what they add up to, when the slice is a person; the rules alone otherwise. */
const LAYOUT = [
  "grid grid-cols-[minmax(0,1fr)_calc(300px*var(--ui-scale))] items-start gap-6",
  "max-[1100px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

const SURFACE = "overflow-x-auto rounded-surface border border-line bg-surface";

const SIDE = "grid gap-4 rounded-surface border border-line bg-surface p-4";

const SIDE_TITLE = "m-0 text-sm font-[650]";

const NAMESPACE = "grid gap-1 [&>h4]:m-0 [&>h4]:text-2xs [&>h4]:font-semibold [&>h4]:tracking-[0.06em] [&>h4]:text-muted [&>h4]:uppercase";

const CHIPS = "flex flex-wrap gap-1";

/* The jMP line on one line, cut to the column — whole in its tooltip; a wrapped identifier made every row five tall. */
const JMP = "mt-1 block max-w-[calc(240px*var(--ui-scale))] truncate font-mono text-2xs text-muted";

const AGENTS = "m-0 border-l-2 border-l-accent bg-well px-3 py-2 text-xs text-secondary";

const KIND_TONE: Record<RuleKind, BadgeTone> = { ROLE: "neutral", ALLOW: "allow", DENY: "deny" };

/**
 * Who may do what, and where. One table read by three slices — a person, a workspace, a permission — so the same
 * question ("why can they?", "who can here?", "who holds this?") is one choice away. Roles come from membership and are
 * shown; the exceptions — allow and deny — are written here by form, and each row says the jMP line it is.
 */
export function AccessPanel() {
  const { t } = useTranslation();
  const { notify } = useToaster();
  const [sliceKind, setSliceKind] = useStoredChoice<SliceKind>("raccoon.access.slice", "subject", ["subject", "workspace", "permission"]);
  const [subjectId, setSubjectId] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [permission, setPermission] = useState("");
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<AccessRule | null>(null);

  const reference = useResource(async () => {
    const [catalogue, subjects, workspaces, agents] = await Promise.all([
      accessAdministrationApi.catalogue(),
      collectAllPages((page) => api.listSubjects(page)),
      collectAllPages((page) => api.listWorkspaces(page)),
      aiApi.agents().catch(() => []),
    ]);
    return { catalogue, subjects, workspaces, agents };
  }, []);

  const chosenSubject = sliceKind === "subject" ? subjectId : "";
  const chosenWorkspace = sliceKind === "workspace" ? workspaceId : sliceKind === "subject" ? workspaceId : "";
  const chosenPermission = sliceKind === "permission" ? permission : "";

  const rules = useResource(
    () =>
      accessAdministrationApi.rules({
        subjectId: chosenSubject || undefined,
        workspaceId: sliceKind === "workspace" ? chosenWorkspace || undefined : undefined,
        permission: chosenPermission || undefined,
      }),
    [chosenSubject, sliceKind, chosenWorkspace, chosenPermission],
  );
  const effective = useResource(
    async () => (chosenSubject === "" ? null : accessAdministrationApi.effective(chosenSubject, workspaceId === "" ? null : workspaceId)),
    [chosenSubject, workspaceId],
  );

  const data = reference.status === "ready" ? reference.data : null;
  const subjectName = useMemo(() => new Map((data?.subjects ?? []).map((subject) => [subject.id, subject.displayName])), [data]);
  const workspaceName = useMemo(() => new Map((data?.workspaces ?? []).map((workspace) => [workspace.id, workspace.name])), [data]);
  const describe = useMemo(() => new Map((data?.catalogue.permissions ?? []).map((declaration) => [declaration.name, declaration.description])), [data]);

  if (reference.status === "loading") {
    return <Waiting label={t("access.loading", "Loading access rules")} lines={5} />;
  }
  if (reference.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={reference.problem}
        actions={
          <Button icon="refresh" onClick={reference.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }
  const { catalogue, subjects, workspaces, agents } = reference.data;
  const kindWord: Record<RuleKind, string> = {
    ROLE: t("access.kind.role", "Role"),
    ALLOW: t("access.kind.allow", "Allow"),
    DENY: t("access.kind.deny", "Deny"),
  };
  const ownAgents = agents.filter((agent) => agent.ownerReference === chosenSubject);

  const remove = async (rule: AccessRule) => {
    try {
      await accessAdministrationApi.remove({ subjectId: rule.subjectId, permission: rule.name, workspaceId: rule.workspaceId });
      notify({ tone: "good", title: t("access.removed", "Rule removed") });
      rules.reload();
      effective.reload();
    } catch (error) {
      notify({ tone: "error", title: describeProblem(error).title });
    }
  };

  return (
    <div className="grid gap-5">
      <div className={TOOLBAR}>
        <div className={PICK}>
          <span>{t("access.slice", "Read the rules by")}</span>
          <Segmented<SliceKind>
            label={t("access.slice", "Read the rules by")}
            value={sliceKind}
            onChange={setSliceKind}
            options={[
              { value: "subject", label: t("access.slice.subject", "Person") },
              { value: "workspace", label: t("access.slice.workspace", "Workspace") },
              { value: "permission", label: t("access.slice.permission", "Permission") },
            ]}
          />
        </div>
        {sliceKind === "subject" && (
          <label className={PICK}>
            <span>{t("access.pick.subject", "Person")}</span>
            <Select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
              <option value="">{t("access.pick.everyone", "Everyone")}</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.displayName}
                </option>
              ))}
            </Select>
          </label>
        )}
        {(sliceKind === "workspace" || sliceKind === "subject") && (
          <label className={PICK}>
            <span>{sliceKind === "subject" ? t("access.pick.in", "Effective in") : t("access.pick.workspace", "Workspace")}</span>
            <Select value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)}>
              <option value="">{sliceKind === "subject" ? t("access.pick.installation", "The installation") : t("access.pick.everyWorkspace", "Every workspace")}</option>
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </Select>
          </label>
        )}
        {sliceKind === "permission" && (
          <label className={PICK}>
            <span>{t("access.pick.permission", "Permission")}</span>
            <Select value={permission} onChange={(event) => setPermission(event.target.value)}>
              <option value="">{t("access.pick.anyPermission", "Any permission")}</option>
              {catalogue.permissions.map((declaration) => (
                <option key={declaration.name} value={declaration.name}>
                  {declaration.name}
                </option>
              ))}
            </Select>
          </label>
        )}
        <span className="ml-auto self-end">
          <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
            {t("access.newRule", "New rule")}
          </Button>
        </span>
      </div>

      {ownAgents.length > 0 && (
        <p className={AGENTS}>
          {t("access.agentsUnder", "Agents of this person act as them: {agents}. A denial of channel:mcp reaches them all.", {
            agents: ownAgents.map((agent) => agent.name).join(", "),
          })}
        </p>
      )}

      <div className={chosenSubject === "" ? "grid" : LAYOUT}>
        <div className={SURFACE}>
          {rules.status === "loading" ? (
            <Waiting label={t("access.loadingRules", "Loading rules")} lines={4} />
          ) : rules.status === "failed" ? (
            <ProblemState layout="section" problem={rules.problem} />
          ) : rules.data.length === 0 ? (
            <EmptyState
              title={t("access.empty", "No rules in this slice")}
              description={t("access.emptyDescription", "Nothing is granted or denied here beyond what the roles say elsewhere.")}
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t("access.column.effect", "Effect")}</th>
                  <th scope="col">{t("access.column.who", "Who")}</th>
                  <th scope="col">{t("access.column.what", "What")}</th>
                  <th scope="col">{t("access.column.where", "Where")}</th>
                  <th scope="col">
                    <span className="sr-only">{t("common.actions", "Actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rules.data.map((rule) => (
                  <tr key={`${rule.kind}:${rule.subjectId}:${rule.name}:${rule.workspaceId ?? "*"}:${rule.origin}`}>
                    <td>
                      <Badge tone={KIND_TONE[rule.kind]}>{kindWord[rule.kind]}</Badge>
                    </td>
                    <td className="wraps">
                      <strong className="text-sm">{subjectName.get(rule.subjectId) ?? shortIdentifier(rule.subjectId)}</strong>
                    </td>
                    <td className="wraps">
                      <span className="font-mono text-xs">{rule.name}</span>
                      {rule.kind !== "ROLE" && describe.get(rule.name) && <div className="max-w-[calc(240px*var(--ui-scale))] text-xs text-secondary">{describe.get(rule.name)}</div>}
                      <code className={JMP} title={jmpLineOf(rule)}>{jmpLineOf(rule)}</code>
                      {rule.reason !== null && <div className="mt-1 text-xs text-ink">{rule.reason}</div>}
                      <div className="text-2xs text-muted">
                        {rule.origin === "POLICY_FILE"
                          ? t("access.origin.file", "Policy file · read-only")
                          : rule.kind === "ROLE"
                            ? t("access.origin.membership", "Membership")
                            : rule.since === null
                              ? t("access.origin.stored", "Written here")
                              : formatDateTime(rule.since)}
                      </div>
                    </td>
                    <td>
                      {rule.workspaceId === null ? (
                        <Badge tone="neutral">{t("access.everywhere", "Every workspace")}</Badge>
                      ) : (
                        <Badge tone="door">{workspaceName.get(rule.workspaceId) ?? shortIdentifier(rule.workspaceId)}</Badge>
                      )}
                    </td>
                    <td className="actions">
                      {rule.origin === "STORED" && rule.kind !== "ROLE" && (
                        <Button
                          variant="quiet"
                          iconOnly
                          icon="trash"
                          aria-label={t("access.removeNamed", "Remove the rule {rule}", { rule: rule.name })}
                          onClick={() => setRemoving(rule)}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>

        {chosenSubject !== "" && (
          <aside className={SIDE} aria-labelledby="access-effective">
            <h3 id="access-effective" className={SIDE_TITLE}>
              {workspaceId === ""
                ? t("access.effective.installation", "What they hold installation-wide")
                : t("access.effective.workspace", "What they hold in {workspace}", { workspace: workspaceName.get(workspaceId) ?? "" })}
            </h3>
            {effective.status === "ready" && effective.data !== null ? (
              groupByNamespace(effective.data).map(([namespace, names]) => (
                <div key={namespace} className={NAMESPACE}>
                  <h4>{namespace}</h4>
                  <span className={CHIPS}>
                    {names.map((name) => (
                      <Badge key={name} tone={namespace === "channel" || namespace === "parser" ? "pipeline" : "good"}>
                        {name.slice(namespace.length + 1)}
                      </Badge>
                    ))}
                  </span>
                </div>
              ))
            ) : (
              <Waiting label={t("access.loadingEffective", "Working out what they hold")} lines={3} />
            )}
            {effective.status === "ready" && effective.data !== null && effective.data.length === 0 && (
              <p className="m-0 text-xs text-muted">{t("access.effective.nothing", "Nothing — they cannot even see it.")}</p>
            )}
          </aside>
        )}
      </div>

      <RuleDialog
        open={creating}
        catalogue={catalogue}
        subjects={subjects.filter((subject) => subject.enabled)}
        workspaces={workspaces}
        initialSubjectId={chosenSubject}
        initialWorkspaceId={sliceKind === "permission" ? "" : workspaceId}
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false);
          notify({ tone: "good", title: t("access.saved", "Rule written") });
          rules.reload();
          effective.reload();
        }}
      />
      <ConfirmDialog
        open={removing !== null}
        title={t("access.removeTitle", "Remove this rule")}
        confirmLabel={t("access.remove", "Remove")}
        destructive
        onConfirm={() => {
          if (removing !== null) {
            const target = removing;
            setRemoving(null);
            void remove(target);
          }
        }}
        onCancel={() => setRemoving(null)}
      >
        <p>
          {t("access.removeExplained", "Whatever the roles say about {permission} applies again.", {
            permission: <code>{removing?.name}</code>,
          })}
        </p>
      </ConfirmDialog>
    </div>
  );
}

function groupByNamespace(names: string[]): [string, string[]][] {
  const groups = new Map<string, string[]>();
  for (const name of names) {
    const namespace = name.includes(":") ? name.slice(0, name.indexOf(":")) : name;
    groups.set(namespace, [...(groups.get(namespace) ?? []), name]);
  }
  return [...groups.entries()];
}
