import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Can } from "../../access/Can";
import { usePermissions } from "../../access/PermissionsProvider";
import { PERMISSIONS } from "../../access/permissions";
import { describeProblem, type Problem } from "../../application/problems";
import { api } from "../../lib/api";
import type { SourceView, UploadOutcome } from "../../lib/contracts";
import type { ScannerRunView } from "../../lib/sourceContracts";
import { BrowserOriginNote, CopyableExample, Notice, useToaster, usePublicBaseAddress } from "../../ui/components";
import { Badge, Button, Field, Input, Table, TextArea } from "../../ui/primitives";
import { gitOptionsOf } from "./gitOptions";
import { RepositoryAccess } from "./RepositoryAccess";
import { ConnectedArrival } from "./ConnectedArrival";
import { ARRIVAL, ARRIVAL_ACTIONS, ARRIVAL_BODY, ARRIVAL_FACTS, ARRIVAL_FORM, ARRIVAL_HEAD, ARRIVAL_INLINE, REFUSALS } from "./sourcePageClasses";
import { useTranslation } from "../../translations/TranslationProvider";
import {
  WebCrawlFields,
  describeWebCrawl,
  validateWebCrawl,
  webCrawlDraftOf,
  webCrawlOptionsOf,
  type WebCrawlDraft,
  type WebCrawlErrors,
} from "./WebCrawlFields";

interface SourceArrivalProperties {
  workspaceId: string;
  source: SourceView;
  latestScan: ScannerRunView | null;
  onChanged: () => void;
}

/**
 * How documents reach this source, with the controls that kind needs: the branch and the commit last
 * scanned of a repository, the addresses and page budget of web pages, the address another system pushes
 * to, or the upload of files into a managed folder. A local folder and written notes need nothing here.
 */
export function SourceArrival({
  workspaceId,
  source,
  latestScan,
  onChanged,
}: SourceArrivalProperties) {
  if (source.removedAt !== null) {
    return null;
  }
  if (source.kind === "GIT") {
    return (
      <GitArrival
        workspaceId={workspaceId}
        source={source}
        latestScan={latestScan}
        onChanged={onChanged}
      />
    );
  }
  if (source.kind === "WEB") {
    return (
      <WebArrival
        workspaceId={workspaceId}
        source={source}
        latestScan={latestScan}
        onChanged={onChanged}
      />
    );
  }
  if (source.kind === "CONNECTED") {
    return <ConnectedArrival workspaceId={workspaceId} source={source} latestScan={latestScan} onChanged={onChanged} />;
  }
  if (source.kind === "PUSH") {
    return <PushArrival workspaceId={workspaceId} source={source} />;
  }
  if (source.kind === "MANAGED_FOLDER") {
    return <UploadArrival workspaceId={workspaceId} source={source} onChanged={onChanged} />;
  }
  return null;
}

function ArrivalSection({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <section className={ARRIVAL} aria-label={title}>
      <div className={ARRIVAL_HEAD}>
        <span className="eyebrow">{title}</span>
        <p className="text-xs text-secondary">{lead}</p>
      </div>
      <div className={ARRIVAL_BODY}>{children}</div>
    </section>
  );
}

/**
 * Saves a source's options. `afterSaved` runs once they are stored and before the page reloads — a git
 * source asks its hosting again, since the address it asks may have changed.
 */
function useOptionsSaver(workspaceId: string, source: SourceView, onChanged: () => void, afterSaved?: () => Promise<unknown>) {
  const { t } = useTranslation();
  const { notify } = useToaster();
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const save = async (options: Record<string, unknown>) => {
    setSaving(true);
    setProblem(null);
    try {
      await api.changeSourceOptions(workspaceId, source, options);
      notify({
        tone: "good",
        title: t("sourceSetup.arrival.saved", "Saved"),
        description: t("sourceSetup.arrival.savedDescription", "The next scan uses it."),
      });
      if (afterSaved !== undefined) {
        // Only a refresh of what the page shows; the saved options stand whether or not it answers.
        await afterSaved().catch(() => undefined);
      }
      onChanged();
    } catch (error) {
      setProblem(describeProblem(error));
    } finally {
      setSaving(false);
    }
  };
  return { save, saving, problem };
}

function GitArrival({ workspaceId, source, latestScan, onChanged }: SourceArrivalProperties) {
  const { t } = useTranslation();
  const mayManage = usePermissions().may(PERMISSIONS.sourceManage);
  const currentBranch = typeof source.options.branch === "string" ? source.options.branch : "";
  const [branch, setBranch] = useState(currentBranch);
  const { save, saving, problem } = useOptionsSaver(workspaceId, source, onChanged, () =>
    api.checkRepositoryAccess(workspaceId, source.id),
  );
  useEffect(() => setBranch(currentBranch), [currentBranch]);
  const detail = latestScan?.snapshotDetail ?? {};
  const unchanged = branch.trim() === currentBranch;

  return (
    <ArrivalSection
      title={t("sourceSetup.arrival.repository.title", "Repository")}
      lead={t(
        "sourceSetup.arrival.repository.lead",
        "Every scan clones the branch fresh and records the commit it read; the repository's own history is not indexed.",
      )}
    >
      <dl className={ARRIVAL_FACTS}>
        <dt>{t("sourceSetup.git.branch", "Branch")}</dt>
        <dd className="numeric">
          {currentBranch === "" ? (
            <span className="text-muted">{t("sourceSetup.arrival.repository.defaultBranch", "the repository's default")}</span>
          ) : (
            currentBranch
          )}
        </dd>
        <dt>{t("sourceSetup.arrival.repository.lastScanned", "Last scanned")}</dt>
        <dd className="numeric">
          {latestScan?.snapshotRevision === null || latestScan === null ? (
            <span className="text-muted">{t("sourceSetup.arrival.notScannedYet", "not scanned yet")}</span>
          ) : (
            <>
              {String(latestScan.snapshotRevision).slice(0, 12)}
              {typeof detail.branch === "string" && (
                <span className="text-muted">{t("sourceSetup.arrival.repository.onBranch", " on {branch}", { branch: detail.branch })}</span>
              )}
              {detail.credentials === "ACCESS_TOKEN" && (
                <span className="text-muted">{t("sourceSetup.arrival.repository.tokenOffered", " · token offered")}</span>
              )}
            </>
          )}
        </dd>
      </dl>
      <RepositoryAccess key={source.revision} workspaceId={workspaceId} source={source} />
      {mayManage && (
        <form
          className={ARRIVAL_FORM}
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void save(gitOptionsOf(branch));
          }}
        >
          {problem !== null && (
            <Notice tone="error" title={problem.title}>
              {problem.detail ?? problem.description}
            </Notice>
          )}
          <Field
            label={t("sourceSetup.arrival.repository.branchToScan", "Branch to scan")}
            hint={t("sourceSetup.arrival.repository.branchToScanHint", "Leave empty for the repository's default branch.")}
          >
            <Input
              className="numeric"
              value={branch}
              maxLength={200}
              spellCheck={false}
              onChange={(event) => setBranch(event.target.value)}
            />
          </Field>
          <div>
            <Button type="submit" disabled={saving || unchanged}>
              {saving ? t("common.saving", "Saving…") : t("sourceSetup.arrival.repository.save", "Save repository settings")}
            </Button>
          </div>
        </form>
      )}
    </ArrivalSection>
  );
}
function WebArrival({ workspaceId, source, latestScan, onChanged }: SourceArrivalProperties) {
  const { t, plural } = useTranslation();
  const storedUrls = Array.isArray(source.options.urls) ? (source.options.urls as string[]) : [];
  const storedCrawl = webCrawlDraftOf(source.options);
  const [urls, setUrls] = useState(storedUrls.join("\n"));
  const [crawl, setCrawl] = useState<WebCrawlDraft>(storedCrawl);
  const [crawlErrors, setCrawlErrors] = useState<WebCrawlErrors>({});
  const { save, saving, problem } = useOptionsSaver(workspaceId, source, onChanged);
  useEffect(() => {
    setUrls(storedUrls.join("\n"));
    setCrawl(webCrawlDraftOf(source.options));
    setCrawlErrors({});
    // The stored options change only when the source is saved; their identity follows its revision.
  }, [source.revision]);
  const detail = latestScan?.snapshotDetail ?? {};
  const refusals = Array.isArray(detail.refusals)
    ? (detail.refusals as { url: string; reason: string }[])
    : [];

  return (
    <ArrivalSection
      title={t("sourceSetup.arrival.pages.title", "Pages")}
      lead={t(
        "sourceSetup.arrival.pages.lead",
        "Every scan fetches the pages again, turns HTML into Markdown and keeps what the rules take. Only public addresses are fetched, and robots.txt is honoured.",
      )}
    >
      <dl className={ARRIVAL_FACTS}>
        <dt>{t("sourceSetup.arrival.pages.startsAt", "Starts at")}</dt>
        <dd className="numeric">{source.location}</dd>
        <dt>{t("sourceSetup.summary.fetches", "Fetches")}</dt>
        <dd>
          {describeWebCrawl(storedCrawl)}
          <span className="text-muted">
            {plural("sourceSetup.arrival.pages.budget", Number(storedCrawl.maximumPages), {
              one: " · at most {count} page per scan",
              other: " · at most {count} pages per scan",
            })}
          </span>
        </dd>
        <dt>{t("sourceSetup.arrival.pages.lastFetched", "Last fetched")}</dt>
        <dd>
          {latestScan === null || latestScan.snapshotRevision === null ? (
            <span className="text-muted">{t("sourceSetup.arrival.notScannedYet", "not scanned yet")}</span>
          ) : (
            <span className={ARRIVAL_INLINE}>
              <span className="numeric">
                {plural("sourceSetup.arrival.pages.fetched", Number(detail.fetched ?? 0), { one: "{count} page", other: "{count} pages" })}
              </span>
              {Number(detail.refused ?? 0) > 0 && (
                <Badge tone="deny">
                  {plural("sourceSetup.arrival.pages.refused", Number(detail.refused), {
                    one: "{count} refusal",
                    other: "{count} refusals",
                  })}
                </Badge>
              )}
            </span>
          )}
        </dd>
      </dl>
      {refusals.length > 0 && (
        <details className={REFUSALS}>
          <summary className="text-xs">{t("sourceSetup.arrival.pages.leftOut", "What the last fetch left out")}</summary>
          <ul>
            {refusals.slice(0, 20).map((refusal) => (
              <li key={refusal.url + refusal.reason} className="text-xs">
                <span className="numeric">{refusal.url}</span> — {refusal.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
      <Can permission={PERMISSIONS.sourceManage}>
        <form
          className={ARRIVAL_FORM}
          noValidate
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            const errors = validateWebCrawl(crawl);
            setCrawlErrors(errors);
            if (errors.linkDepth !== undefined || errors.maximumPages !== undefined) {
              return;
            }
            void save({
              urls: urls
                .split(/\s+/)
                .map((address) => address.trim())
                .filter((address) => address.length > 0),
              ...webCrawlOptionsOf(crawl),
            });
          }}
        >
          {problem !== null && (
            <Notice tone="error" title={problem.title}>
              {problem.detail ?? problem.description}
            </Notice>
          )}
          <Field
            label={t("sourceSetup.web.furtherAddresses", "Further start addresses")}
            hint={t("sourceSetup.arrival.pages.furtherAddressesHint", "One per line, at most 20.")}
          >
            <TextArea
              code
              rows={3}
              value={urls}
              onChange={(event) => setUrls(event.target.value)}
            />
          </Field>
          <WebCrawlFields
            draft={crawl}
            errors={crawlErrors}
            onChange={(next) => {
              setCrawl(next);
              setCrawlErrors({});
            }}
          />
          <div>
            <Button type="submit" disabled={saving}>
              {saving ? t("common.saving", "Saving…") : t("sourceSetup.arrival.pages.save", "Save pages")}
            </Button>
          </div>
        </form>
      </Can>
    </ArrivalSection>
  );
}

function PushArrival({ workspaceId, source }: { workspaceId: string; source: SourceView }) {
  const { t } = useTranslation();
  const publicAddress = usePublicBaseAddress();
  if (publicAddress === null) {
    return null;
  }
  const endpoint = `${publicAddress.base}/v1/workspaces/${workspaceId}/sources/${source.id}/push`;
  const textExample = [
    `curl -X POST "${endpoint}" \\`,
    `  -H "Authorization: Bearer $RACCOON_TOKEN" -H "Content-Type: application/json" \\`,
    `  -d '{"externalId": "tickets/1042", "title": "Export fails at midnight", "text": "…"}'`,
  ].join("\n");
  const fileExample = [
    `curl -X POST "${endpoint}/files" \\`,
    `  -H "Authorization: Bearer $RACCOON_TOKEN" \\`,
    `  -F "file=@runbook.md" -F "externalId=wiki/runbook.md"`,
  ].join("\n");
  const removeExample = `curl -X DELETE "${endpoint}?externalId=tickets/1042" -H "Authorization: Bearer $RACCOON_TOKEN"`;

  return (
    <ArrivalSection
      title={t("sourceSetup.arrival.push.title", "Push address")}
      lead={t(
        "sourceSetup.arrival.push.lead",
        "Another system sends documents here with an API credential of an account that may write documents in this workspace. Its own identifiers are the documents' identities: pushing again adds a version, pushing the same text answers the existing one.",
      )}
    >
      <dl className={ARRIVAL_FACTS}>
        <dt>{t("sourceSetup.arrival.push.address", "Address")}</dt>
        <dd className="numeric">{endpoint}</dd>
        <dt>{t("sourceSetup.arrival.push.credential", "Credential")}</dt>
        <dd>
          {t("sourceSetup.arrival.push.credentialHint", "Issue one under {accounts}, for an account that is a member here with document writing.", {
            accounts: <Link to="/administration/accounts">{t("sourceSetup.arrival.push.accountsLink", "Administration › Accounts")}</Link>,
          })}
        </dd>
      </dl>
      {[
        { key: "text", label: t("sourceSetup.arrival.push.text", "Push text"), example: textExample },
        { key: "file", label: t("sourceSetup.arrival.push.file", "Push a file"), example: fileExample },
        { key: "remove", label: t("sourceSetup.arrival.push.remove", "Take a document back"), example: removeExample },
      ].map((sample) => (
        <CopyableExample key={sample.key} label={sample.label} example={sample.example} />
      ))}
      {!publicAddress.configured && <BrowserOriginNote />}
      <p className="text-xs text-secondary">
        {t(
          "sourceSetup.arrival.push.textOnly",
          "Text only for now — Markdown, plain text, JSON, YAML, code. A removed document refuses new pushes until it is restored in Raccoon.",
        )}
      </p>
    </ArrivalSection>
  );
}

function UploadArrival({
  workspaceId,
  source,
  onChanged,
}: {
  workspaceId: string;
  source: SourceView;
  onChanged: () => void;
}) {
  const { t, plural } = useTranslation();
  const { notify } = useToaster();
  const mayWrite = usePermissions().may(PERMISSIONS.documentWrite);
  const input = useRef<HTMLInputElement>(null);
  const [folder, setFolder] = useState("");
  const [uploading, setUploading] = useState(false);
  const [outcomes, setOutcomes] = useState<UploadOutcome[]>([]);
  const [problem, setProblem] = useState<Problem | null>(null);
  const publicAddress = usePublicBaseAddress();
  const uploadExample =
    publicAddress === null
      ? null
      : [
          `curl -X POST "${publicAddress.base}/v1/workspaces/${workspaceId}/sources/${source.id}/uploads" \\`,
          `  -H "Authorization: Bearer $RACCOON_TOKEN" \\`,
          `  -F "folder=team/handbook" -F "files=@runbook.md" -F "files=@onboarding.md"`,
        ].join("\n");

  const upload = async (files: FileList | null) => {
    if (files === null || files.length === 0) {
      return;
    }
    setUploading(true);
    setProblem(null);
    try {
      const answered = await api.uploadToManagedFolder(
        workspaceId,
        source.id,
        [...files],
        folder.trim(),
      );
      setOutcomes(answered);
      const taken = answered.filter((outcome) => outcome.version !== null).length;
      notify({
        tone: taken === answered.length ? "good" : "error",
        title: plural("sourceSetup.arrival.upload.uploaded", taken, { one: "{count} file uploaded", other: "{count} files uploaded" }),
        description:
          taken === answered.length
            ? undefined
            : plural("sourceSetup.arrival.upload.refused", answered.length - taken, {
                one: "{count} file refused — see why below.",
                other: "{count} files refused — see why below.",
              }),
      });
      onChanged();
    } catch (error) {
      setProblem(describeProblem(error));
    } finally {
      setUploading(false);
      if (input.current !== null) {
        input.current.value = "";
      }
    }
  };

  return (
    <ArrivalSection
      title={t("sourceSetup.arrival.upload.title", "Uploads")}
      lead={t(
        "sourceSetup.arrival.upload.lead",
        "Files uploaded here live in Raccoon. Uploading a file again over the same path adds a version. Accepted: text (Markdown, plain text, JSON, YAML, code), PDF, and scans as PNG, JPEG or TIFF.",
      )}
    >
      {mayWrite && (
        <div className={ARRIVAL_FORM}>
          {problem !== null && (
            <Notice tone="error" title={problem.title}>
              {problem.detail ?? problem.description}
            </Notice>
          )}
          <Field
            label={t("sourceSetup.arrival.upload.folder", "Into folder")}
            hint={t("sourceSetup.arrival.upload.folderHint", "A path inside this source, such as team/handbook. Empty puts files at the top.")}
          >
            <Input
              className="numeric"
              value={folder}
              maxLength={512}
              spellCheck={false}
              onChange={(event) => setFolder(event.target.value)}
            />
          </Field>
          <div className={ARRIVAL_ACTIONS}>
            <input
              ref={input}
              type="file"
              multiple
              hidden
              onChange={(event) => void upload(event.target.files)}
            />
            <Button
              variant="primary"
              icon="upload"
              disabled={uploading}
              onClick={() => input.current?.click()}
            >
              {uploading ? t("sourceSetup.arrival.upload.uploading", "Uploading…") : t("sourceSetup.arrival.upload.choose", "Choose files")}
            </Button>
            <Link to="/files" search={{ source: source.id }} className="text-xs">
              {t("sourceSetup.arrival.upload.browse", "Browse its files")}
            </Link>
          </div>
        </div>
      )}
      {uploadExample !== null && publicAddress !== null && (
        <>
          <CopyableExample label={t("sourceSetup.arrival.upload.fromScript", "Upload from a script")} example={uploadExample} />
          {!publicAddress.configured && <BrowserOriginNote />}
        </>
      )}
      {outcomes.length > 0 && (
        <Table>
          <thead>
            <tr>
              <th scope="col">{t("sourceSetup.arrival.upload.file", "File")}</th>
              <th scope="col">{t("sourceSetup.arrival.upload.path", "Path")}</th>
              <th scope="col">{t("sourceSetup.arrival.upload.outcome", "Outcome")}</th>
            </tr>
          </thead>
          <tbody>
            {outcomes.map((outcome) => (
              <tr key={outcome.fileName + outcome.path}>
                <td>{outcome.fileName}</td>
                <td className="numeric text-xs">{outcome.path}</td>
                <td className="wraps">
                  {outcome.version !== null ? (
                    <Badge tone="allow">
                      {t("sourceSetup.arrival.upload.version", "Version {number}", { number: outcome.version.versionNumber })}
                    </Badge>
                  ) : (
                    <>
                      <Badge tone="deny">{t("sourceSetup.arrival.upload.refusedBadge", "Refused")}</Badge>{" "}
                      <span className="text-xs text-secondary">{outcome.refusal}</span>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </ArrivalSection>
  );
}
