import { Link, useBlocker, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { usePermissions } from "../../access/PermissionsProvider";
import { PERMISSIONS } from "../../access/permissions";
import { describeProblem, problemOf, type Problem } from "../../application/problems";
import { useReadySession } from "../../application/session";
import { usePageTitle } from "../../application/usePageTitle";
import { useResource } from "../../application/useResource";
import { collectAllPages } from "../../lib/api";
import {
  isProfileKind,
  profileKind,
  profilesApi,
  type Profile,
  type ProfileCatalogue,
  type ProfileConfiguration,
  type ProfileKind,
  type ProfileVersion,
} from "../../lib/profiles";
import { useTranslation } from "../../translations/TranslationProvider";
import {
  ConfirmDialog,
  Notice,
  PageHeader,
  ProblemState,
  TabPanel,
  Tabs,
  Waiting,
  useToaster,
  type TabItem,
} from "../../ui/components";
import { Badge, Button, Field, Input } from "../../ui/primitives";
import { CatalogueForm, outOfBounds } from "./CatalogueForm";
import { valueAt } from "./configurationPaths";
import { ContentPipelineSection } from "./ContentPipelineSection";
import { ParserSettingsSection } from "./ParserSettingsSection";
import { findingsByPath, profileHazards } from "./configurationHazards";
import { ProfileFlow, planFor } from "./ProfileFlow";
import { ProfileHistory } from "./ProfileHistory";
import { loadProfileReferences, type ProfileReferences } from "./profileReferences";
import {
  changedTabs,
  parameterNamedBy,
  parametersOfTab,
  settingsTabsOf,
  tabOfPath,
  type ProfileRecordTab,
} from "./profileTabs";
import { ProfileUsedBy } from "./ProfileUsedBy";
import {
  loadProfileWiring,
  publishedVectorsOf,
  stateOf,
  usedBy,
  usedBySentence,
  type ProfileWiring,
} from "./profileWiring";
import {
  OPTIONAL_SECTIONS,
  alignApproximateTokens,
  newConfiguration,
  overriddenParameters,
  reconcile,
  requiredSections,
} from "./profileRules";
import { CRUMB, EDITOR_MAIN, EDITOR_TOP, PROBLEM_LIST, SAVE_STATE, SECTION, SECTION_TITLE, USED_LINE } from "./profilesClasses";
import { useAddressChange } from "../../application/useAddressChange";

const NAME_LIMIT = 160;
const NEW_PROFILE = "new";
const RECORD_TABS: ProfileRecordTab[] = ["used-by", "history"];

interface Loaded {
  catalogue: ProfileCatalogue;
  references: ProfileReferences;
  wiring: ProfileWiring;
  profile: Profile | null;
  versions: ProfileVersion[];
}

/** Opens a profile of any kind — or a new one — at `/profiles/$kind/$profileId`, its tab in `?tab=`. */
export function ProfileEditorPage() {
  const { t } = useTranslation();
  const { kind, profileId } = useParams({ strict: false }) as { kind: string; profileId: string };
  const { workspace } = useReadySession();
  const workspaceId = workspace?.id ?? "";

  const loaded = useResource<Loaded | null>(async () => {
    if (!isProfileKind(kind)) {
      return null;
    }
    const wiring = await loadProfileWiring(workspaceId);
    const [catalogue, references, profile, versions] = await Promise.all([
      profilesApi.catalogue(workspaceId, kind),
      loadProfileReferences(workspaceId, kind, wiring),
      profileId === NEW_PROFILE ? Promise.resolve(null) : profilesApi.get(workspaceId, kind, profileId),
      profileId === NEW_PROFILE
        ? Promise.resolve([])
        : collectAllPages((page) => profilesApi.versions(workspaceId, kind, profileId, page)),
    ]);
    return { catalogue, references, wiring, profile, versions };
  }, [workspaceId, kind, profileId]);

  if (!isProfileKind(kind)) {
    return <ProblemState problem={problemOf("not-found")} />;
  }
  if (loaded.status === "loading") {
    return <Waiting label={t("profiles.editor.loading", "Loading the profile")} lines={8} />;
  }
  if (loaded.status === "failed" || loaded.data === null) {
    return (
      <ProblemState
        problem={loaded.status === "failed" ? loaded.problem : problemOf("not-found")}
        actions={
          <Button href={`/profiles?kind=${kind}`} variant="quiet">
            {t("profiles.editor.all", "All profiles")}
          </Button>
        }
      />
    );
  }
  return (
    <ProfileEditor
      key={`${kind}:${profileId}:${loaded.data.profile?.revision ?? 0}`}
      workspaceId={workspaceId}
      kind={kind}
      loaded={loaded.data}
      onSaved={loaded.reload}
    />
  );
}

function ProfileEditor({
  workspaceId,
  kind,
  loaded,
  onSaved,
}: {
  workspaceId: string;
  kind: ProfileKind;
  loaded: Loaded;
  onSaved: () => void;
}) {
  const { t, say } = useTranslation();
  const description = profileKind(kind);
  const navigate = useNavigate();
  const changeAddress = useAddressChange();
  const search = useSearch({ strict: false }) as { tab?: string };
  const { notify } = useToaster();
  const permissions = usePermissions();
  const mayEdit = permissions.may(PERMISSIONS.automationManage);
  const { catalogue, references, wiring, profile, versions } = loaded;
  const publishedVectors =
    kind === "embedding" && profile !== null ? (publishedVectorsOf(wiring, profile) ?? []) : [];
  const state = profile === null ? null : stateOf(wiring, kind, profile);
  const settingsTabs = settingsTabsOf(kind);
  const generalTab = settingsTabs[0].key;

  const initialConfiguration = useMemo(
    () => profile?.configuration ?? newConfiguration(kind, catalogue.parameters, catalogue.suggestedInstructions),
    [profile, kind, catalogue],
  );
  const [name, setName] = useState(profile?.name ?? "");
  const [configuration, setConfiguration] = useState<ProfileConfiguration>(initialConfiguration);
  // Whether a save was tried: a name left empty is only an error once somebody tries to save without one.
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  // The tab holding what the server refused, when its words name a parameter.
  const [refusedTab, setRefusedTab] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Why the editor changed a value by itself, said until the next save or discard.
  const [alignmentNote, setAlignmentNote] = useState<string | null>(null);
  // Set just before the page leaves on purpose — after creating a profile — so the guard does not ask.
  const leavingOnPurpose = useRef(false);
  const title = profile === null ? say(description.newProfile) : profile.name;
  usePageTitle(title);

  const tabKeys = [...settingsTabs.map((tab) => tab.key), ...(profile === null ? [] : RECORD_TABS)];
  const activeTab = tabKeys.find((key) => key === search.tab) ?? generalTab;

  const selectTab = (next: string) => {
    void changeAddress({
      to: "/profiles/$kind/$profileId",
      params: { kind, profileId: profile?.id ?? NEW_PROFILE },
      search: next === generalTab ? {} : { tab: next },
    });
  };

  // The flow reads what is on screen, unsaved edits included, so a change shows its effect before it is saved.
  const flow =
    kind === "search" || kind === "answer"
      ? planFor(wiring, kind, {
          id: profile?.id ?? "new",
          name: name.trim() === "" ? t("profiles.editor.thisProfile", "This profile") : name.trim(),
          revision: profile?.revision ?? 0,
          configuration,
        })
      : null;

  // The same values, judged field by field: what the flow strip routes around is flagged where it is set.
  const findings = useMemo(
    () => findingsByPath(profileHazards(wiring, kind, configuration, profile?.id ?? null)),
    [wiring, kind, configuration, profile],
  );

  const nameChanged = name !== (profile?.name ?? "");
  const tabsWithChanges = useMemo(() => {
    const changed = changedTabs(settingsTabs, initialConfiguration, configuration);
    if (nameChanged) {
      changed.add(generalTab);
    }
    return changed;
  }, [settingsTabs, initialConfiguration, configuration, nameChanged, generalTab]);
  const hasChanges = tabsWithChanges.size > 0;

  const nameMissing = name.trim().length === 0;
  const tabsWithErrors = useMemo(() => {
    const invalid = new Set<string>();
    for (const parameter of catalogue.parameters) {
      if (outOfBounds(parameter, valueAt(configuration, parameter.path)) !== null) {
        invalid.add(tabOfPath(settingsTabs, parameter.path));
      }
    }
    if (saveAttempted && nameMissing) {
      invalid.add(generalTab);
    }
    if (refusedTab !== null) {
      invalid.add(refusedTab);
    }
    return invalid;
  }, [catalogue, configuration, settingsTabs, saveAttempted, nameMissing, refusedTab, generalTab]);

  // Leaving for another page asks first; moving between this page's tabs keeps the draft and never asks.
  const leaving = useBlocker({
    shouldBlockFn: ({ current, next }) => !leavingOnPurpose.current && hasChanges && current.pathname !== next.pathname,
    enableBeforeUnload: () => !leavingOnPurpose.current && hasChanges,
    withResolver: true,
  });

  const change = (next: ProfileConfiguration) => {
    const reconciled = reconcile(kind, next, catalogue.parameters, references.providers);
    setRefusedTab(null);
    if (kind !== "search") {
      setConfiguration(reconciled);
      return;
    }
    const aligned = alignApproximateTokens(configuration, reconciled, wiring.profiles.embedding);
    setConfiguration(aligned.configuration);
    if (aligned.note !== null) {
      setAlignmentNote(aligned.note);
    }
  };

  const discard = () => {
    if (profile === null) {
      return;
    }
    setName(profile.name);
    setConfiguration(initialConfiguration);
    setAlignmentNote(null);
    setProblem(null);
    setRefusedTab(null);
    setSaveAttempted(false);
  };

  /** The first tab, in the strip's order, that holds a value that cannot be saved. */
  const firstInvalidTab = (invalid: Set<string>) => tabKeys.find((key) => invalid.has(key)) ?? null;

  const save = async () => {
    setSaveAttempted(true);
    const invalid = new Set(tabsWithErrors);
    if (nameMissing) {
      invalid.add(generalTab);
    }
    const first = firstInvalidTab(invalid);
    if (first !== null) {
      selectTab(first);
      return;
    }
    setSaving(true);
    setProblem(null);
    setRefusedTab(null);
    try {
      const saved =
        profile === null
          ? await profilesApi.create(workspaceId, kind, name.trim(), configuration)
          : await profilesApi.save(workspaceId, kind, profile, name.trim(), configuration);
      notify({
        tone: "good",
        title:
          profile === null
            ? t("profiles.editor.created", "{name} created", { name: saved.name })
            : t("profiles.editor.saved", "{name} saved as settings revision {revision}", {
                name: saved.name,
                revision: saved.revision,
              }),
      });
      if (profile === null) {
        leavingOnPurpose.current = true;
        void navigate({
          to: "/profiles/$kind/$profileId",
          params: { kind, profileId: saved.id },
          replace: true,
        });
      } else {
        onSaved();
      }
    } catch (error) {
      const described = describeProblem(error);
      setProblem(described);
      setSaving(false);
      const named = parameterNamedBy(`${described.detail ?? ""} ${described.description}`, catalogue.parameters);
      if (named !== null) {
        const holder = tabOfPath(settingsTabs, named.path);
        setRefusedTab(holder);
        selectTab(holder);
      }
    }
  };

  const links = profile === null ? [] : usedBy(wiring, kind, profile.id);
  const tabItems: TabItem<string>[] = [
    ...settingsTabs.map((tab) => ({
      key: tab.key,
      label: say(tab.label),
      marker: tabsWithErrors.has(tab.key)
        ? ("invalid" as const)
        : tabsWithChanges.has(tab.key)
          ? ("changed" as const)
          : undefined,
    })),
    ...(profile === null
      ? []
      : [
          {
            key: "used-by",
            label: t("profiles.tab.usedBy", "Used by"),
            count: kind === "processing" || kind === "answer" ? undefined : links.length,
          },
          { key: "history", label: t("profiles.tab.history", "History"), count: versions.length },
        ]),
  ];

  const activeSettingsTab = settingsTabs.find((tab) => tab.key === activeTab);
  const tabParameters =
    activeSettingsTab === undefined ? [] : parametersOfTab(settingsTabs, activeSettingsTab.key, catalogue.parameters);

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Link to="/profiles" search={{ kind }} className={CRUMB}>
              {t("profiles.title", "Profiles")}
            </Link>{" "}
            / {description.label}
          </>
        }
        title={title}
        status={
          profile === null ? undefined : (
            <>
              <Badge tone="neutral">
                {t("profiles.settingsRevision", "Settings revision {revision}", { revision: profile.revision })}
              </Badge>{" "}
              {state !== null && <Badge tone={state.verdict.tone}>{state.verdict.text}</Badge>}
            </>
          )
        }
        lead={description.decides}
        actions={
          mayEdit ? (
            <>
              <span className={SAVE_STATE} data-changed={hasChanges} aria-live="polite">
                {profile === null
                  ? t("profiles.editor.notCreated", "Not created yet")
                  : hasChanges
                    ? t("profiles.editor.unsaved", "Unsaved changes")
                    : t("profiles.editor.savedState", "Saved")}
              </span>
              {profile !== null && (
                <Button variant="quiet" disabled={!hasChanges || saving} onClick={discard}>
                  {t("profiles.editor.discard", "Discard")}
                </Button>
              )}
              <Button
                variant="primary"
                disabled={saving || (profile !== null && !hasChanges)}
                onClick={() => void save()}
              >
                {saving
                  ? t("profiles.editor.saving", "Saving…")
                  : profile === null
                    ? t("profiles.editor.create", "Create profile")
                    : t("profiles.editor.save", "Save revision")}
              </Button>
            </>
          ) : undefined
        }
      />

      <div className={EDITOR_TOP}>
        <p className={USED_LINE}>
          {profile === null
            ? t("profiles.editor.unusedUntilSaved", "Nothing uses it until it is saved and chosen.")
            : usedBySentence(wiring, kind, profile.id)}
        </p>
        {!mayEdit && (
          <Notice tone="information" title={t("profiles.editor.readOnly", "Read only")}>
            {t("profiles.editor.readOnlyText", "Changing profiles needs automation management access in this workspace.")}
          </Notice>
        )}
        {description.callsModel && mayEdit && !permissions.may(PERMISSIONS.systemWrite) && (
          <Notice tone="warn" title={t("profiles.editor.mayBeRefused", "Saving may be refused")}>
            {t(
              "profiles.editor.mayBeRefusedText",
              "A profile that calls a model also needs installation-wide write access, which you do not hold.",
            )}
          </Notice>
        )}
        {state !== null && state.problems.length > 0 && (
          <Notice tone="error" title={t("profiles.editor.cannotWork", "This profile cannot work as it is")}>
            <ul className={PROBLEM_LIST}>
              {state.problems.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          </Notice>
        )}
        {publishedVectors.length > 0 && (
          <Notice
            tone="warn"
            title={t(
              "profiles.editor.revectorise",
              "Changing the provider, model or dimensions means vectorising again",
            )}
          >
            {t(
              "profiles.editor.revectoriseText",
              "{count} vectors are published for this model. Vectors belong to the model that made them: after such a change, searches reading this profile find nothing by vectors until documents are vectorised with it again.",
              {
                count: publishedVectors.reduce(
                  (sum, generation) => sum + generation.storedRecords - generation.removedRecords,
                  0,
                ),
              },
            )}
          </Notice>
        )}
        {alignmentNote !== null && (
          <Notice tone="information" title={t("profiles.editor.aligned", "Set for the chosen embedding profile")}>
            {alignmentNote}
          </Notice>
        )}
        {problem !== null && (
          <Notice tone="error" title={problem.title}>
            {problem.detail ?? problem.description}
          </Notice>
        )}
        {flow !== null && (
          <ProfileFlow
            plan={flow}
            note={
              hasChanges
                ? t("profiles.editor.flowDraft", "Computed from the values on screen, unsaved changes included.")
                : t("profiles.editor.flowSaved", "Computed from the saved revision and what is in force now.")
            }
          />
        )}
      </div>

      <Tabs<string>
        label={t("profiles.editor.tabs", "Profile settings")}
        active={activeTab}
        onSelect={selectTab}
        items={tabItems}
      />

      {activeSettingsTab !== undefined && (
        <TabPanel tabKey={activeSettingsTab.key}>
          <div className={EDITOR_MAIN}>
            {activeSettingsTab.key === generalTab && (
              <fieldset className={SECTION} disabled={!mayEdit}>
                <legend className={SECTION_TITLE}>{t("profiles.editor.profile", "Profile")}</legend>
                <Field
                  label={t("profiles.editor.name", "Name")}
                  required
                  error={saveAttempted && nameMissing ? t("profiles.editor.nameMissing", "Name the profile.") : undefined}
                >
                  <Input
                    value={name}
                    maxLength={NAME_LIMIT}
                    fullWidth
                    autoFocus={profile === null}
                    onChange={(event) => {
                      setName(event.target.value);
                    }}
                  />
                </Field>
              </fieldset>
            )}
            {tabParameters.length > 0 && (
              <CatalogueForm
                parameters={tabParameters}
                configuration={configuration}
                onChange={change}
                references={references}
                optionalSections={OPTIONAL_SECTIONS[kind]}
                requiredSections={requiredSections(kind, configuration)}
                nullableReferences={kind === "answer" ? ["providerConfigurationId"] : []}
                explanationScope={kind}
                findings={findings}
                overriddenParameters={overriddenParameters(kind, configuration)}
                disabled={!mayEdit}
              />
            )}
            {kind === "processing" && activeSettingsTab.key === "parsing" && (
              <ParserSettingsSection
                workspaceId={workspaceId}
                configuration={configuration}
                onChange={change}
                disabled={!mayEdit}
              />
            )}
            {kind === "processing" && activeSettingsTab.key === "content" && (
              <ContentPipelineSection
                workspaceId={workspaceId}
                profileId={profile?.id ?? null}
                configuration={configuration}
                onChange={change}
                disabled={!mayEdit}
              />
            )}
          </div>
        </TabPanel>
      )}
      {activeTab === "used-by" && profile !== null && (
        <TabPanel tabKey="used-by">
          <ProfileUsedBy workspaceId={workspaceId} kind={kind} profile={profile} wiring={wiring} />
        </TabPanel>
      )}
      {activeTab === "history" && profile !== null && (
        <TabPanel tabKey="history">
          <ProfileHistory
            versions={versions}
            currentRevision={profile.revision}
            draft={configuration}
            mayEdit={mayEdit}
            onLoadRevision={(version) => {
              setConfiguration(version.configuration);
              notify({
                tone: "neutral",
                title: t("profiles.history.loaded", "Settings revision {revision} loaded", { revision: version.revision }),
                description: t("profiles.history.loadedText", "Save to make it the current one."),
              });
            }}
          />
        </TabPanel>
      )}

      <ConfirmDialog
        open={leaving.status === "blocked"}
        title={t("profiles.editor.leaveTitle", "Leave without saving?")}
        confirmLabel={t("profiles.editor.leave", "Leave and lose the changes")}
        destructive
        onConfirm={() => {
          leaving.proceed?.();
        }}
        onCancel={() => {
          leaving.reset?.();
        }}
      >
        <p>
          {t(
            "profiles.editor.leaveText",
            "This profile has unsaved changes in: {tabs}. Leaving discards them; saving writes a new settings revision.",
            {
              tabs: settingsTabs
                .filter((tab) => tabsWithChanges.has(tab.key))
                .map((tab) => say(tab.label))
                .join(", "),
            },
          )}
        </p>
      </ConfirmDialog>
    </>
  );
}
