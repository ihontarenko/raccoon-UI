import { useEffect, useState, type FormEvent } from "react";
import { describeProblem, type Problem } from "../../../application/problems";
import {
  connectionsApi,
  type ConnectionDraft,
  type ConnectionTypeDescriptor,
  type ConnectionView,
  type GitHosting,
} from "../../../lib/connections";
import { useTranslation } from "../../../translations/TranslationProvider";
import { Notice } from "../../../ui/components";
import { Button, Checkbox, Dialog, Field, Input, Select, TextArea } from "../../../ui/primitives";
import { orderedTypes, typeDescription, typeName } from "./connectionTypes";
import { FORM, TWO_COLUMNS } from "../ai/aiClasses";

const NAME_LIMIT = 160;
const ADDRESS_LIMIT = 2048;
const CREDENTIAL_LIMIT = 1024;

/** Everything any type's form holds; each type reads only its own part. */
interface FormState {
  type: string;
  name: string;
  enabled: boolean;
  credential: string;
  // A knowledge base.
  address: string;
  settings: Record<string, string>;
  // A local folder.
  roots: string;
  wholeComputer: boolean;
  // Git.
  hosting: GitHosting;
  baseAddress: string;
  allowedOwners: string;
  // Web.
  allowedHosts: string;
  pauseMilliseconds: string;
  maximumLinkDepth: string;
  maximumPages: string;
}

type Errors = Partial<Record<"name" | "address" | "credential" | "roots" | "baseAddress" | "allowedHosts", string>>;

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function textOf(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function listOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function initialState(connection: ConnectionView | null, types: ConnectionTypeDescriptor[], startingType?: string): FormState {
  const blank: FormState = {
    type: startingType ?? orderedTypes(types)[0]?.type ?? "LOCAL_FOLDER",
    name: "",
    enabled: true,
    credential: "",
    address: "",
    settings: {},
    roots: "",
    wholeComputer: false,
    hosting: "GITHUB",
    baseAddress: "",
    allowedOwners: "",
    allowedHosts: "",
    pauseMilliseconds: "300",
    maximumLinkDepth: "5",
    maximumPages: "500",
  };
  if (connection === null) {
    return blank;
  }
  const boundary = connection.boundary;
  const roots = Array.isArray(boundary.roots) ? (boundary.roots as Record<string, unknown>[]) : [];
  return {
    ...blank,
    type: connection.type,
    name: connection.name,
    enabled: connection.enabled,
    address: connection.address ?? "",
    settings: { ...connection.settings },
    roots: roots.map((root) => textOf(root.path)).filter((path) => path.length > 0).join("\n"),
    wholeComputer: roots.some((root) => root.wholeComputer === true),
    hosting: (textOf(boundary.hosting) as GitHosting) || "GITHUB",
    baseAddress: textOf(boundary.baseAddress),
    allowedOwners: listOf(boundary.allowedOwners).join("\n"),
    allowedHosts: listOf(boundary.allowedHosts).join("\n"),
    pauseMilliseconds: textOf(boundary.pauseMilliseconds) || blank.pauseMilliseconds,
    maximumLinkDepth: textOf(boundary.maximumLinkDepth) || blank.maximumLinkDepth,
    maximumPages: textOf(boundary.maximumPages) || blank.maximumPages,
  };
}

/** The boundary a built-in type's form describes, as the server takes it. */
function boundaryOf(form: FormState, kind: string): Record<string, unknown> {
  switch (kind) {
    case "LOCAL_FOLDER":
      return {
        roots: [
          ...(form.wholeComputer ? [{ wholeComputer: true }] : []),
          ...lines(form.roots).map((path) => ({ path })),
        ],
      };
    case "GIT":
      return {
        hosting: form.hosting,
        ...(form.hosting !== "GITHUB" && form.baseAddress.trim().length > 0 ? { baseAddress: form.baseAddress.trim() } : {}),
        allowedOwners: lines(form.allowedOwners),
      };
    case "WEB":
      return {
        allowedHosts: lines(form.allowedHosts),
        pauseMilliseconds: form.pauseMilliseconds.trim(),
        maximumLinkDepth: form.maximumLinkDepth.trim(),
        maximumPages: form.maximumPages.trim(),
      };
    default:
      return {};
  }
}

/**
 * Adds or changes a connection of any type: the type first, then what that type is configured with. A light type
 * asks for little — push for nothing but its name. A credential is write-only: a stored one is never shown, a blank
 * field keeps it, and a change of where it is sent asks for it again — the server refuses to send a stored
 * credential somewhere new.
 *
 * A knowledge-base connector's own words — its name, descriptions, setting labels, credential label — come from the
 * server and are shown as it writes them.
 */
export function ConnectionDialog({
  open,
  connection,
  startingType,
  types,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** The connection being changed; null adds a new one. */
  connection: ConnectionView | null;
  /** The type a new connection starts as, when it was added from that type's row. */
  startingType?: string;
  types: ConnectionTypeDescriptor[];
  onClose: () => void;
  onSaved: (saved: ConnectionView, created: boolean) => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(() => initialState(connection, types, startingType));
  const [errors, setErrors] = useState<Errors>({});
  const [problem, setProblem] = useState<Problem | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initialState(connection, types, startingType));
      setErrors({});
      setProblem(null);
      setSaving(false);
    }
  }, [open, connection, types, startingType]);

  const descriptor = types.find((candidate) => candidate.type === form.type) ?? null;
  const kind = descriptor?.kind ?? "LOCAL_FOLDER";
  const connector = descriptor?.connector ?? null;
  const update = (patch: Partial<FormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  };
  const takesCredential = descriptor !== null && descriptor.takesCredential && !(kind === "GIT" && form.hosting === "OTHER");
  const destinationChanged =
    connection !== null &&
    (kind === "CONNECTED"
      ? form.address.trim().replace(/\/+$/, "") !== (connection.address ?? "")
      : kind === "GIT" &&
        (form.hosting !== textOf(connection.boundary.hosting) || form.baseAddress.trim() !== textOf(connection.boundary.baseAddress)));
  const credentialNeededAgain = destinationChanged && connection?.credentialSet === true;

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found: Errors = {};
    if (form.name.trim().length === 0) {
      found.name = t("connections.dialog.nameRequired", "Give the connection a name.");
    }
    if (kind === "CONNECTED" && form.address.trim().length === 0) {
      found.address = t("connections.dialog.addressRequired", "Give the address the knowledge base answers at.");
    }
    if (kind === "CONNECTED" && connection === null && form.credential.trim().length === 0) {
      found.credential = t("connections.dialog.namedCredentialRequired", "Paste the {credential}; nothing can be read without it.", {
        credential: (descriptor?.credentialLabel ?? t("connections.dialog.credential", "Credential")).toLowerCase(),
      });
    }
    if (kind === "LOCAL_FOLDER" && !form.wholeComputer && lines(form.roots).length === 0) {
      found.roots = t("connections.dialog.rootsRequired", "Give at least one folder sources may read inside.");
    }
    if (kind === "GIT" && form.hosting === "OTHER" && form.baseAddress.trim().length === 0) {
      found.baseAddress = t("connections.dialog.baseAddressRequired", "Give the https address repositories on this host start with.");
    }
    if (kind === "WEB" && lines(form.allowedHosts).length === 0) {
      found.allowedHosts = t("connections.dialog.hostsRequired", "Give at least one host sources may fetch from.");
    }
    if (credentialNeededAgain && takesCredential && form.credential.trim().length === 0) {
      found.credential = t(
        "connections.dialog.credentialForNewAddress",
        "Where the credential is sent has changed; give it again, so the stored one is never sent somewhere new.",
      );
    }
    setErrors(found);
    if (Object.keys(found).length > 0) {
      return;
    }
    const settings = Object.fromEntries(
      Object.entries(form.settings)
        .map(([key, value]) => [key, value.trim()] as const)
        .filter(([, value]) => value.length > 0),
    );
    const draft: ConnectionDraft = {
      name: form.name.trim(),
      address: kind === "CONNECTED" ? form.address.trim() : null,
      settings: kind === "CONNECTED" ? settings : {},
      boundary: kind === "CONNECTED" ? {} : boundaryOf(form, kind),
      credential: takesCredential && form.credential.trim().length > 0 ? form.credential.trim() : null,
    };
    setSaving(true);
    setProblem(null);
    try {
      const saved =
        connection === null ? await connectionsApi.create(form.type, draft) : await connectionsApi.change(connection, draft, form.enabled);
      onSaved(saved, connection === null);
    } catch (error) {
      setProblem(describeProblem(error));
      setSaving(false);
    }
  };

  const credentialHint =
    connection?.credentialSet === true
      ? t(
          "connections.dialog.credentialStoredHint",
          "A credential is stored and is never shown. Leave blank to keep it; paste a new one to replace it.",
        )
      : (descriptor?.credentialDescription ??
        t("connections.dialog.credentialWriteOnlyHint", "Stored write-only: once saved it is never shown again, to anyone."));

  const credentialField = takesCredential && (
    <Field
      label={
        kind === "GIT"
          ? t("connections.dialog.accessToken", "Access token")
          : (descriptor?.credentialLabel ?? t("connections.dialog.credential", "Credential"))
      }
      required={(kind === "CONNECTED" && connection === null) || credentialNeededAgain}
      error={errors.credential}
      hint={
        kind === "GIT" && connection?.credentialSet !== true
          ? t(
              "connections.dialog.accessTokenHint",
              "A GitHub or GitLab personal access token that may read repositories. Leave it empty for public repositories only; with one, the repositories it sees are listed for sources to pick.",
            )
          : credentialHint
      }
    >
      <Input
        type="password"
        autoComplete="new-password"
        className="numeric"
        value={form.credential}
        maxLength={CREDENTIAL_LIMIT}
        spellCheck={false}
        fullWidth
        placeholder={connection?.credentialSet === true ? t("connections.dialog.credentialStoredPlaceholder", "•••••••• stored") : undefined}
        onChange={(event) => update({ credential: event.target.value })}
      />
    </Field>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={connection === null ? t("connections.dialog.addTitle", "Add connection") : t("connections.dialog.editTitle", "Edit connection")}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={saving}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="submit" form="connection-form" variant="primary" disabled={saving}>
            {saving
              ? t("connections.dialog.savingAndChecking", "Saving and checking…")
              : connection === null
                ? t("connections.dialog.addAndCheck", "Add and check")
                : t("common.save", "Save")}
          </Button>
        </>
      }
    >
      <form id="connection-form" className={FORM} onSubmit={(event) => void save(event)} noValidate>
        {problem !== null && (
          <Notice tone="error" title={problem.title}>
            {problem.detail ?? problem.description}
          </Notice>
        )}
        <Field label={t("connections.dialog.type", "Type")} hint={descriptor === null ? undefined : typeDescription(descriptor)}>
          <Select
            value={form.type}
            fullWidth
            disabled={connection !== null}
            onChange={(event) => update({ type: event.target.value, settings: {}, credential: "" })}
          >
            {orderedTypes(types).map((candidate) => (
              <option key={candidate.type} value={candidate.type}>
                {typeName(candidate.type, types)}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label={t("connections.dialog.name", "Name")}
          required
          error={errors.name}
          hint={t("connections.dialog.nameHint", "How workspaces see it when they choose where a source reads from.")}
        >
          <Input value={form.name} maxLength={NAME_LIMIT} fullWidth onChange={(event) => update({ name: event.target.value })} />
        </Field>

        {kind === "LOCAL_FOLDER" && (
          <>
            <Field
              label={t("connections.dialog.roots", "Allowed folders")}
              required={!form.wholeComputer}
              error={errors.roots}
              hint={t(
                "connections.dialog.rootsHint",
                "One full folder path per line. A source reads one folder inside one of them; nothing outside, and no link leading out.",
              )}
            >
              <TextArea code rows={4} value={form.roots} spellCheck={false} onChange={(event) => update({ roots: event.target.value })} />
            </Field>
            <Checkbox
              label={t("connections.dialog.wholeComputer", "Also allow the whole computer")}
              hint={t(
                "connections.dialog.wholeComputerHint",
                "Every folder on this machine, removable drives included. Only for a machine that is yours alone.",
              )}
              checked={form.wholeComputer}
              onChange={(event) => update({ wholeComputer: event.target.checked })}
            />
            {form.wholeComputer && (
              <Notice tone="error" title={t("connections.dialog.wholeComputerTitle", "The whole computer is open")}>
                {t(
                  "connections.dialog.wholeComputerWarning",
                  "Any source reading through this connection may import any folder this machine can read. Prefer listing the folders.",
                )}
              </Notice>
            )}
          </>
        )}

        {kind === "GIT" && (
          <>
            <Field label={t("connections.dialog.hosting", "Hosting")}>
              <Select
                value={form.hosting}
                fullWidth
                onChange={(event) => update({ hosting: event.target.value as GitHosting })}
              >
                <option value="GITHUB">GitHub</option>
                <option value="GITLAB">GitLab</option>
                <option value="OTHER">{t("connections.dialog.hostingOther", "Another https host")}</option>
              </Select>
            </Field>
            {form.hosting !== "GITHUB" && (
              <Field
                label={t("connections.dialog.baseAddress", "Base address")}
                required={form.hosting === "OTHER"}
                error={errors.baseAddress}
                hint={
                  form.hosting === "GITLAB"
                    ? t("connections.dialog.baseAddressGitlabHint", "Only for a self-hosted GitLab, such as https://gitlab.example.com; empty means gitlab.com.")
                    : t(
                        "connections.dialog.baseAddressOtherHint",
                        "The https address repositories start with, such as https://git.example.org. Cloned anonymously; no token is sent.",
                      )
                }
              >
                <Input
                  className="numeric"
                  value={form.baseAddress}
                  maxLength={ADDRESS_LIMIT}
                  spellCheck={false}
                  fullWidth
                  onChange={(event) => update({ baseAddress: event.target.value })}
                />
              </Field>
            )}
            {credentialField}
            <Field
              label={t("connections.dialog.allowedOwners", "Allowed owners")}
              hint={t("connections.dialog.allowedOwnersHint", "Users, organisations or groups, one per line. Empty allows any owner.")}
            >
              <TextArea code rows={2} value={form.allowedOwners} spellCheck={false} onChange={(event) => update({ allowedOwners: event.target.value })} />
            </Field>
          </>
        )}

        {kind === "WEB" && (
          <>
            <Field
              label={t("connections.dialog.allowedHosts", "Allowed hosts")}
              required
              error={errors.allowedHosts}
              hint={t("connections.dialog.allowedHostsHint", "One host per line, such as docs.example.org. Sources start only from addresses on them.")}
            >
              <TextArea code rows={3} value={form.allowedHosts} spellCheck={false} onChange={(event) => update({ allowedHosts: event.target.value })} />
            </Field>
            <div className={TWO_COLUMNS}>
              <Field label={t("connections.dialog.pause", "Pause between requests, ms")} hint={t("connections.dialog.pauseHint", "0-60000; never shorter than the installation's own.")}>
                <Input
                  className="numeric"
                  inputMode="numeric"
                  value={form.pauseMilliseconds}
                  onChange={(event) => update({ pauseMilliseconds: event.target.value })}
                />
              </Field>
              <Field label={t("connections.dialog.linkDepth", "Deepest link depth")} hint={t("connections.dialog.linkDepthHint", "1-5 links away from a start address.")}>
                <Input
                  className="numeric"
                  inputMode="numeric"
                  value={form.maximumLinkDepth}
                  onChange={(event) => update({ maximumLinkDepth: event.target.value })}
                />
              </Field>
              <Field label={t("connections.dialog.pageCeiling", "Most pages a scan")} hint={t("connections.dialog.pageCeilingHint", "1-500, whatever a source asks for.")}>
                <Input
                  className="numeric"
                  inputMode="numeric"
                  value={form.maximumPages}
                  onChange={(event) => update({ maximumPages: event.target.value })}
                />
              </Field>
            </div>
          </>
        )}

        {kind === "PUSH" && (
          <p className="text-xs text-secondary">
            {t(
              "connections.dialog.pushNothingElse",
              "Nothing else to configure: other systems push to this installation's address with an API credential. The source page shows the address.",
            )}
          </p>
        )}

        {kind === "CONNECTED" && (
          <>
            <Field
              label={t("connections.dialog.address", "Address")}
              required
              error={errors.address}
              hint={
                connector === null
                  ? undefined
                  : t("connections.dialog.addressHint", "{description} For example {example}.", {
                      description: connector.addressDescription,
                      example: connector.addressExample,
                    })
              }
            >
              <Input
                className="numeric"
                value={form.address}
                maxLength={ADDRESS_LIMIT}
                spellCheck={false}
                fullWidth
                onChange={(event) => update({ address: event.target.value })}
              />
            </Field>
            {connector?.settings.map((setting) => (
              <Field
                key={setting.key}
                label={setting.label}
                required={setting.required}
                hint={
                  setting.defaultValue === null
                    ? setting.description
                    : t("connections.dialog.settingDefaultHint", "{description} Empty means {value}.", {
                        description: setting.description,
                        value: setting.defaultValue,
                      })
                }
              >
                <Input
                  className={setting.type === "ADDRESS" ? "mono" : undefined}
                  value={form.settings[setting.key] ?? ""}
                  maxLength={setting.type === "ADDRESS" ? ADDRESS_LIMIT : 512}
                  spellCheck={false}
                  fullWidth
                  onChange={(event) => update({ settings: { ...form.settings, [setting.key]: event.target.value } })}
                />
              </Field>
            ))}
            {credentialField}
            <Notice tone="error" title={t("connections.dialog.scopeWarningTitle", "The credential decides what is imported")}>
              {t(
                "connections.dialog.scopeWarning",
                "Every page it may read in the sections a source chooses is imported and kept, and Raccoon's workspace access governs it from then on. Grant it the narrowest sections that will do.",
              )}
            </Notice>
          </>
        )}

        {connection !== null && (
          <Checkbox
            label={t("connections.dialog.inUse", "In use")}
            hint={t("connections.dialog.inUseHint", "Switched off, no source can be scanned through it and no workspace can choose it.")}
            checked={form.enabled}
            onChange={(event) => update({ enabled: event.target.checked })}
          />
        )}
      </form>
    </Dialog>
  );
}
