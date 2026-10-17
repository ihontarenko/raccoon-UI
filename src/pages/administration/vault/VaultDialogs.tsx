import { useEffect, useState, type FormEvent } from "react";
import { describeProblem } from "../../../application/problems";
import {
  SECRET_NAME_PATTERN,
  vaultApi,
  type CredentialKind,
  type RevealedSecret,
  type VaultCredential,
} from "../../../lib/vault";
import { useTranslation } from "../../../translations/TranslationProvider";
import { CopyButton, Notice } from "../../../ui/components";
import { Button, Checkbox, Dialog, Field, Input, Select, TextArea } from "../../../ui/primitives";
import { FORM, TWO_COLUMNS } from "../ai/aiClasses";

/* A revealed value: monospace, selectable whole, wrapped rather than scrolled. */
const REVEALED = [
  "m-0 rounded-control border border-line bg-well p-3",
  "font-mono text-xs leading-[1.6] select-all [overflow-wrap:anywhere]",
].join(" ");

/* One extra field of an open-ended credential: name, value, secret, remove. */
const EXTRA_ROW = [
  "grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto_auto] items-end gap-2",
  "max-[700px]:grid-cols-[minmax(0,1fr)]",
].join(" ");

/* ── Set a secret ─────────────────────────────────────────────────────────────────────────────── */

interface SecretDialogProperties {
  open: boolean;
  /** The name being changed, or null to add one. */
  name: string | null;
  description: string | null;
  /** Where the secret answers from now, when it is not the database — setting it here overrides that. */
  overriding: string | null;
  onClose: () => void;
  onSaved: (name: string) => void;
}

export function SecretDialog({ open, name, description, overriding, onClose, onSaved }: SecretDialogProperties) {
  const { t } = useTranslation();
  const [secretName, setSecretName] = useState("");
  const [value, setValue] = useState("");
  const [about, setAbout] = useState("");
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSecretName(name ?? "");
      setValue("");
      setAbout(description ?? "");
      setFailure(null);
    }
  }, [open, name, description]);

  const nameInvalid = secretName !== "" && !SECRET_NAME_PATTERN.test(secretName);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFailure(null);
    try {
      await vaultApi.setSecret(secretName, value, about.trim() === "" ? null : about.trim());
      onSaved(secretName);
    } catch (problem) {
      const described = describeProblem(problem);
      setFailure(described.detail ?? described.title);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={name === null ? t("vault.secret.addTitle", "Add secret") : t("vault.secret.setTitle", "Set {name}", { name })}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={saving}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="submit" form="vault-secret-form" variant="primary" disabled={saving || nameInvalid || value === ""}>
            {saving ? t("vault.saving", "Saving…") : t("vault.save", "Save")}
          </Button>
        </>
      }
    >
      <form id="vault-secret-form" className={FORM} onSubmit={submit}>
        {overriding !== null && (
          <Notice tone="information">
            {t(
              "vault.secret.overriding",
              "This secret now comes from {source}. A value saved here is kept in the database and answers first; the {source} value stays where it is, unused.",
              { source: overriding },
            )}
          </Notice>
        )}
        {name === null && (
          <Field
            label={t("vault.secret.name", "Name")}
            required
            hint={t("vault.secret.nameHint", "Lower-case words joined by hyphens, sections by slashes: ai/voyage/api-key.")}
            error={nameInvalid ? t("vault.secret.nameInvalid", "Use lower-case letters, digits, hyphens and slashes.") : undefined}
          >
            <Input value={secretName} onChange={(event) => setSecretName(event.target.value.trim())} autoComplete="off" fullWidth />
          </Field>
        )}
        <Field label={t("vault.secret.value", "Value")} required hint={t("vault.secret.valueHint", "Stored sealed. It is never shown again unless somebody with the right to reveal asks.")}>
          <Input type="password" value={value} onChange={(event) => setValue(event.target.value)} autoComplete="new-password" fullWidth />
        </Field>
        <Field label={t("vault.secret.description", "What it is for")}>
          <TextArea rows={2} value={about} onChange={(event) => setAbout(event.target.value)} />
        </Field>
        {failure !== null && <Notice tone="error">{failure}</Notice>}
      </form>
    </Dialog>
  );
}

/* ── Save a credential ───────────────────────────────────────────────────────────────────────── */

interface ExtraField {
  name: string;
  value: string;
  secret: boolean;
}

interface CredentialDialogProperties {
  open: boolean;
  /** The credential being changed, or null to add one. */
  credential: VaultCredential | null;
  kinds: CredentialKind[];
  onClose: () => void;
  onSaved: (credential: VaultCredential) => void;
}

export function CredentialDialog({ open, credential, kinds, onClose, onSaved }: CredentialDialogProperties) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [kindName, setKindName] = useState("");
  const [description, setDescription] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<ExtraField[]>([]);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setFailure(null);
    if (credential === null) {
      setName("");
      setKindName(kinds.find((kind) => kind.name === "http-api")?.name ?? kinds[0]?.name ?? "");
      setDescription("");
      setValues({});
      setExtras([]);
      return;
    }
    const kind = kinds.find((candidate) => candidate.name === credential.kind);
    const declared = new Set(kind?.fields.map((field) => field.name) ?? []);
    setName(credential.name);
    setKindName(credential.kind);
    setDescription(credential.description ?? "");
    setValues({ ...credential.fields });
    setExtras([
      ...Object.entries(credential.fields)
        .filter(([field]) => !declared.has(field))
        .map(([field, value]) => ({ name: field, value, secret: false })),
      ...credential.secretFields.filter((field) => !declared.has(field)).map((field) => ({ name: field, value: "", secret: true })),
    ]);
  }, [open, credential, kinds]);

  const kind = kinds.find((candidate) => candidate.name === kindName);
  const nameInvalid = name !== "" && !SECRET_NAME_PATTERN.test(name);
  const editing = credential !== null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (kind === undefined) {
      return;
    }
    const fields: Record<string, string> = {};
    const secrets: Record<string, string> = {};
    const secretFields: string[] = [];
    for (const field of kind.fields) {
      const value = values[field.name] ?? "";
      if (field.secret) {
        secrets[field.name] = value;
      } else if (value.trim() !== "") {
        fields[field.name] = value.trim();
      }
    }
    for (const extra of extras) {
      if (extra.name.trim() === "") {
        continue;
      }
      if (extra.secret) {
        secretFields.push(extra.name.trim());
        secrets[extra.name.trim()] = extra.value;
      } else if (extra.value.trim() !== "") {
        fields[extra.name.trim()] = extra.value.trim();
      }
    }
    setSaving(true);
    setFailure(null);
    try {
      onSaved(
        await vaultApi.saveCredential(name, {
          kind: kind.name,
          description: description.trim() === "" ? null : description.trim(),
          fields,
          secrets,
          secretFields,
        }),
      );
    } catch (problem) {
      const described = describeProblem(problem);
      setFailure(described.detail ?? described.title);
    } finally {
      setSaving(false);
    }
  }

  const stored = (field: string) => credential?.secrets[field] != null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="wide"
      title={editing ? t("vault.credential.editTitle", "Edit {name}", { name: credential.name }) : t("vault.credential.addTitle", "Add credential")}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={saving}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="submit" form="vault-credential-form" variant="primary" disabled={saving || nameInvalid || name === "" || kind === undefined}>
            {saving ? t("vault.saving", "Saving…") : t("vault.save", "Save")}
          </Button>
        </>
      }
    >
      <form id="vault-credential-form" className={FORM} onSubmit={submit}>
        <div className={TWO_COLUMNS}>
          <Field
            label={t("vault.credential.name", "Name")}
            required
            hint={t("vault.credential.nameHint", "Its secrets are stored under it: ai/openai/primary → ai/openai/primary/api-key.")}
            error={nameInvalid ? t("vault.secret.nameInvalid", "Use lower-case letters, digits, hyphens and slashes.") : undefined}
          >
            <Input value={name} disabled={editing} onChange={(event) => setName(event.target.value.trim())} autoComplete="off" fullWidth />
          </Field>
          <Field label={t("vault.credential.kind", "Kind")} required hint={kind?.description}>
            <Select value={kindName} disabled={editing} onChange={(event) => setKindName(event.target.value)}>
              {kinds.map((candidate) => (
                <option key={candidate.name} value={candidate.name}>
                  {candidate.title}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {kind?.fields.map((field) => (
          <Field
            key={field.name}
            label={field.title}
            required={field.required && !(field.secret && stored(field.name))}
            hint={
              field.secret && stored(field.name)
                ? t("vault.credential.keepHint", "Stored. Leave empty to keep it.")
                : field.hint ?? undefined
            }
          >
            <Input
              type={field.secret ? "password" : "text"}
              autoComplete={field.secret ? "new-password" : "off"}
              value={values[field.name] ?? ""}
              onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
              fullWidth
            />
          </Field>
        ))}

        {kind?.openEnded && (
          <fieldset className="m-0 grid gap-2 border-0 p-0">
            <legend className="mb-2 text-sm font-[550]">{t("vault.credential.extraFields", "Other fields")}</legend>
            {extras.map((extra, index) => (
              <div key={index} className={EXTRA_ROW}>
                <Field label={t("vault.credential.fieldName", "Field")}>
                  <Input
                    value={extra.name}
                    onChange={(event) => setExtras(extras.map((item, position) => (position === index ? { ...item, name: event.target.value.trim() } : item)))}
                    autoComplete="off"
                    fullWidth
                  />
                </Field>
                <Field label={t("vault.credential.fieldValue", "Value")} hint={extra.secret && stored(extra.name) ? t("vault.credential.keepHint", "Stored. Leave empty to keep it.") : undefined}>
                  <Input
                    type={extra.secret ? "password" : "text"}
                    autoComplete={extra.secret ? "new-password" : "off"}
                    value={extra.value}
                    onChange={(event) => setExtras(extras.map((item, position) => (position === index ? { ...item, value: event.target.value } : item)))}
                    fullWidth
                  />
                </Field>
                <Checkbox
                  label={t("vault.credential.fieldSecret", "Secret")}
                  checked={extra.secret}
                  onChange={(event) => setExtras(extras.map((item, position) => (position === index ? { ...item, secret: event.target.checked } : item)))}
                />
                <Button
                  variant="quiet"
                  iconOnly
                  icon="trash"
                  aria-label={t("vault.credential.removeField", "Remove field {name}", { name: extra.name })}
                  onClick={() => setExtras(extras.filter((_, position) => position !== index))}
                />
              </div>
            ))}
            <div>
              <Button variant="quiet" icon="plus" onClick={() => setExtras([...extras, { name: "", value: "", secret: true }])}>
                {t("vault.credential.addField", "Add field")}
              </Button>
            </div>
          </fieldset>
        )}

        <Field label={t("vault.credential.description", "What it is for")}>
          <TextArea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        {failure !== null && <Notice tone="error">{failure}</Notice>}
      </form>
    </Dialog>
  );
}

/* ── A revealed value ────────────────────────────────────────────────────────────────────────── */

interface RevealDialogProperties {
  revealed: RevealedSecret | null;
  onClose: () => void;
}

/** Shown once, in a dialog that forgets it on close; the reveal itself is already in the audit trail. */
export function RevealDialog({ revealed, onClose }: RevealDialogProperties) {
  const { t } = useTranslation();

  return (
    <Dialog
      open={revealed !== null}
      onClose={onClose}
      title={revealed === null ? "" : revealed.name}
      footer={
        <Button variant="primary" onClick={onClose}>
          {t("vault.reveal.close", "Close")}
        </Button>
      }
    >
      {revealed !== null && (
        <div className={FORM}>
          <p className="m-0 text-xs text-muted">
            {t("vault.reveal.from", "From {source}. This was recorded in the audit trail.", { source: revealed.source })}
          </p>
          <pre className={REVEALED}>{revealed.value}</pre>
          <div>
            <CopyButton value={revealed.value} label={t("vault.reveal.copyLabel", "Copy the value")} />
          </div>
        </div>
      )}
    </Dialog>
  );
}
