// Single HTTP entry point to the Raccoon API. The dev server proxies `/v1` to the backend,
// so paths stay origin-relative and the bearer token is attached to every protected call.

import type {
  AccessAnswer,
  AccessQuestion,
  AvailableSearchProfile,
  ChangeSourceRequest,
  CredentialView,
  IssuedCredential,
  CreateSourceRequest,
  DocumentVersionView,
  DocumentView,
  IndexStatistics,
  JobAttemptView,
  JobView,
  LoginResponse,
  ManagedOriginalView,
  MemberView,
  SearchQuery,
  SearchResponse,
  SourceFolderListing,
  SourceLocationRoot,
  SourceRemoval,
  RepositoryAccessView,
  UploadOutcome,
  SourceView,
  SubjectView,
  NoticeView,
  TelegramConnection,
  TelegramInvitation,
  TelegramJournalPage,
  SystemParameterView,
  InstallationAddresses,
  WorkspaceRole,
  WorkspaceView,
} from "./contracts";
import type {
  ItemOutcome,
  ScannerBindingView,
  ScannerRunItem,
  ScannerRunView,
  ScannerView,
} from "./sourceContracts";

export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(status: number, detail: unknown) {
    super(describeFailure(status, detail));
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

// The backend answers with a ProblemDetail (`detail` / `title`) for domain refusals and with the
// framework's default body (`error`) for transport-level ones; the most specific text wins.
function describeFailure(status: number, detail: unknown): string {
  if (typeof detail === "string" && detail.length > 0) {
    return detail;
  }
  if (detail !== null && typeof detail === "object") {
    const body = detail as Record<string, unknown>;
    for (const field of ["detail", "title", "error"]) {
      const value = body[field];
      if (typeof value === "string" && value.length > 0) {
        return value;
      }
    }
  }
  return `Request failed with status ${status}`;
}

export function workspacePath(workspaceId: string, suffix: string): string {
  return `/v1/workspaces/${workspaceId}${suffix}`;
}

/** Every list route on the server accepts a page of 1…100 rows and refuses a larger one. */
export const LARGEST_PAGE = 100;

export interface PageRequest {
  limit: number;
  offset: number;
}

export function pageQuery(page: PageRequest): string {
  return `limit=${page.limit}&offset=${page.offset}`;
}

/** Reads a list to its end, one largest page at a time, for lists the interface needs whole. */
export async function collectAllPages<T>(
  fetchPage: (page: PageRequest) => Promise<T[]>,
): Promise<T[]> {
  const items: T[] = [];
  for (;;) {
    const page = await fetchPage({ limit: LARGEST_PAGE, offset: items.length });
    items.push(...page);
    if (page.length < LARGEST_PAGE) {
      return items;
    }
  }
}

export class RaccoonApi {
  private token: string | null = null;
  private unauthorizedListener: (() => void) | null = null;
  private mutationListener: (() => void) | null = null;

  setToken(token: string | null): void {
    this.token = token;
  }

  /** Called whenever a protected request is answered with 401, so the session can end itself. */
  onUnauthorized(listener: (() => void) | null): void {
    this.unauthorizedListener = listener;
  }

  /**
   * Called after every request that changed something and succeeded — whatever it was, it may have queued work, so
   * the shell's activity reads again at once and can say "the worker is not running" the moment something is run.
   */
  onMutation(listener: (() => void) | null): void {
    this.mutationListener = listener;
  }

  /** Reads that travel as POST — a search, an answer, a preview — queue nothing, so they announce nothing. */
  private announceMutation(method: string, path = ""): void {
    if (/\/(search|answers|preview|dry-run|context)(\?|$)/.test(path)) {
      return;
    }
    if (method !== "GET" && this.mutationListener !== null) {
      this.mutationListener();
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const headers: Record<string, string> = { ...extraHeaders };
    if (this.token !== null) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    const response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let payload: unknown = null;
    if (text.length > 0) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }
    if (!response.ok) {
      if (response.status === 401 && this.token !== null && this.unauthorizedListener !== null) {
        this.unauthorizedListener();
      }
      throw new ApiError(response.status, payload ?? response.statusText);
    }
    this.announceMutation(method, path);
    return payload as T;
  }

  /**
   * The transport every domain client under `lib/` speaks through, so a token, a refusal and an expired
   * session are handled once rather than per domain.
   */
  send<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    return this.request<T>(method, path, body, extraHeaders);
  }

  /** A multipart request with the session's token; the browser writes the boundary itself. */
  async sendForm<T>(path: string, form: FormData): Promise<T> {
    const response = await fetch(path, {
      method: "POST",
      headers: this.token === null ? {} : { Authorization: `Bearer ${this.token}` },
      body: form,
    });
    const text = await response.text();
    let payload: unknown = null;
    if (text.length > 0) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }
    if (!response.ok) {
      if (response.status === 401 && this.token !== null && this.unauthorizedListener !== null) {
        this.unauthorizedListener();
      }
      throw new ApiError(response.status, payload ?? response.statusText);
    }
    this.announceMutation("POST");
    return payload as T;
  }

  /**
   * Bytes rather than JSON, with the same token and the same end of an expired session. An `<img>` or a
   * link cannot carry a bearer token, so anything protected is fetched here and shown from an object URL.
   */
  async fetchBytes(path: string): Promise<Blob> {
    const response = await fetch(path, {
      headers: this.token === null ? {} : { Authorization: `Bearer ${this.token}` },
    });
    if (!response.ok) {
      if (response.status === 401 && this.token !== null && this.unauthorizedListener !== null) {
        this.unauthorizedListener();
      }
      const text = await response.text();
      let payload: unknown = text;
      try {
        payload = JSON.parse(text);
      } catch {
        // Not JSON: the status text is all there is.
      }
      throw new ApiError(response.status, payload || response.statusText);
    }
    return response.blob();
  }

  login(username: string, password: string): Promise<LoginResponse> {
    return this.request<LoginResponse>("POST", "/v1/auth/login", { username, password });
  }

  /** The signed-in account itself; readable by anybody signed in. */
  me(): Promise<SubjectView> {
    return this.request<SubjectView>("GET", "/v1/access/me");
  }

  /** Whether the signed-in account is connected to Telegram, and through which bots. */
  telegramConnection(): Promise<TelegramConnection> {
    return this.request<TelegramConnection>("GET", "/v1/me/telegram");
  }

  /** A one-time link to Raccoon's bot that connects the signed-in account; replaces an unused earlier one. */
  inviteTelegram(): Promise<TelegramInvitation> {
    return this.request<TelegramInvitation>("POST", "/v1/me/telegram/invitation");
  }

  disconnectTelegram(): Promise<TelegramConnection> {
    return this.request<TelegramConnection>("DELETE", "/v1/me/telegram");
  }

  /** Every call to Telegram, newest first — an installation administrator's. */
  telegramJournal(refusalsOnly = false): Promise<TelegramJournalPage> {
    return this.request<TelegramJournalPage>(
      "GET",
      `/v1/telegram/journal?limit=50${refusalsOnly ? "&outcome=REFUSED" : ""}`,
    );
  }

  /** What arrived for the signed-in account since this browser last asked — each notice once per browser. */
  notices(client: string): Promise<NoticeView[]> {
    return this.request<NoticeView[]>("GET", `/v1/me/notices?client=${encodeURIComponent(client)}`);
  }

  /** What the caller holds installation-wide, plus in the given workspace. */
  myPermissions(workspaceId: string | null): Promise<string[]> {
    const query = workspaceId === null ? "" : `?workspaceId=${workspaceId}`;
    return this.request<string[]>("GET", `/v1/access/mine${query}`);
  }

  /** A batch of "may I do this, in this workspace" questions, answered about the caller. */
  may(questions: AccessQuestion[]): Promise<AccessAnswer[]> {
    return this.request<AccessAnswer[]>("POST", "/v1/access/may", questions);
  }

  getWorkspace(workspaceId: string): Promise<WorkspaceView> {
    return this.request<WorkspaceView>("GET", `/v1/workspaces/${workspaceId}`);
  }

  listWorkspaces(page: PageRequest): Promise<WorkspaceView[]> {
    return this.request<WorkspaceView[]>("GET", `/v1/workspaces?${pageQuery(page)}`);
  }

  listMembers(workspaceId: string, page: PageRequest): Promise<MemberView[]> {
    return this.request<MemberView[]>(
      "GET",
      workspacePath(workspaceId, `/members?${pageQuery(page)}`),
    );
  }

  changeMember(
    workspaceId: string,
    subjectId: string,
    role: WorkspaceRole,
    revision: number,
  ): Promise<MemberView> {
    return this.request<MemberView>("PUT", workspacePath(workspaceId, `/members/${subjectId}`), {
      role,
      revision,
    });
  }

  /** Removal is revision-locked: a member changed since it was read is refused, not silently removed. */
  removeMember(workspaceId: string, member: MemberView): Promise<void> {
    return this.request<void>(
      "DELETE",
      workspacePath(workspaceId, `/members/${member.subjectId}?revision=${member.revision}`),
    );
  }

  createWorkspace(name: string): Promise<WorkspaceView> {
    return this.request<WorkspaceView>("POST", "/v1/workspaces", { name });
  }

  renameWorkspace(workspace: WorkspaceView, name: string): Promise<WorkspaceView> {
    return this.request<WorkspaceView>("PUT", `/v1/workspaces/${workspace.id}`, {
      name,
      revision: workspace.revision,
    });
  }

  listCredentials(subjectId: string, page: PageRequest): Promise<CredentialView[]> {
    return this.request<CredentialView[]>(
      "GET",
      `/v1/subjects/${subjectId}/credentials?${pageQuery(page)}`,
    );
  }

  /** The token comes back once, here, and is never readable again. */
  issueCredential(subjectId: string, label: string): Promise<IssuedCredential> {
    return this.request<IssuedCredential>("POST", `/v1/subjects/${subjectId}/credentials`, {
      label,
    });
  }

  revokeCredential(subjectId: string, credentialId: string): Promise<void> {
    return this.request<void>("DELETE", `/v1/subjects/${subjectId}/credentials/${credentialId}`);
  }

  getSubject(subjectId: string): Promise<SubjectView> {
    return this.request<SubjectView>("GET", `/v1/subjects/${subjectId}`);
  }

  listSubjects(page: PageRequest): Promise<SubjectView[]> {
    return this.request<SubjectView[]>("GET", `/v1/subjects?${pageQuery(page)}`);
  }

  createSubject(displayName: string): Promise<SubjectView> {
    return this.request<SubjectView>("POST", "/v1/subjects", { displayName });
  }

  setSubjectEnabled(subjectId: string, enabled: boolean, revision: number): Promise<SubjectView> {
    return this.request<SubjectView>("PUT", `/v1/subjects/${subjectId}/enabled`, {
      enabled,
      revision,
    });
  }

  availableSearchProfiles(workspaceId: string): Promise<AvailableSearchProfile[]> {
    return this.request<AvailableSearchProfile[]>(
      "GET",
      workspacePath(workspaceId, "/search-profiles/available"),
    );
  }

  search(workspaceId: string, query: SearchQuery): Promise<SearchResponse> {
    return this.request<SearchResponse>("POST", workspacePath(workspaceId, "/search"), query);
  }

  listSources(workspaceId: string, page: PageRequest): Promise<SourceView[]> {
    return this.request<SourceView[]>(
      "GET",
      workspacePath(workspaceId, `/sources?${pageQuery(page)}`),
    );
  }

  createSource(workspaceId: string, request: CreateSourceRequest): Promise<SourceView> {
    return this.request<SourceView>("POST", workspacePath(workspaceId, "/sources"), request);
  }

  changeSource(
    workspaceId: string,
    sourceId: string,
    request: ChangeSourceRequest,
  ): Promise<SourceView> {
    return this.request<SourceView>(
      "PUT",
      workspacePath(workspaceId, `/sources/${sourceId}`),
      request,
    );
  }

  /** Removes the source and every document in it from the corpus. Nothing captured is erased, and it cannot be undone. */
  removeSource(workspaceId: string, source: SourceView): Promise<SourceRemoval> {
    return this.request<SourceRemoval>(
      "DELETE",
      workspacePath(workspaceId, `/sources/${source.id}?revision=${source.revision}`),
    );
  }

  /** Replaces what the kind takes beside its location, under the source's revision. */
  changeSourceOptions(
    workspaceId: string,
    source: SourceView,
    options: Record<string, unknown>,
  ): Promise<SourceView> {
    return this.request<SourceView>(
      "PUT",
      workspacePath(workspaceId, `/sources/${source.id}/options`),
      { options, revision: source.revision },
    );
  }

  /** Gives a source that reads through no connection the one it will read through; its boundary judges the source as at creation. */
  chooseSourceConnection(
    workspaceId: string,
    source: SourceView,
    connectionId: string,
  ): Promise<SourceView> {
    return this.request<SourceView>(
      "PUT",
      workspacePath(workspaceId, `/sources/${source.id}/connection`),
      {
        connectionId,
        revision: source.revision,
      },
    );
  }

  /**
   * Whether a git source's connection has a token, and what its hosting last said. The token belongs to the connection
   * and never comes back.
   */
  repositoryAccess(workspaceId: string, sourceId: string): Promise<RepositoryAccessView> {
    return this.request<RepositoryAccessView>(
      "GET",
      workspacePath(workspaceId, `/sources/${sourceId}/repository-access`),
    );
  }

  /** Asks the hosting again about the repository and the connection's token. */
  checkRepositoryAccess(workspaceId: string, sourceId: string): Promise<RepositoryAccessView> {
    return this.request<RepositoryAccessView>(
      "POST",
      workspacePath(workspaceId, `/sources/${sourceId}/repository-access/check`),
    );
  }

  /** Uploads files into a managed folder source, under a folder of its own; each file is answered on its own. */
  async uploadToManagedFolder(
    workspaceId: string,
    sourceId: string,
    files: File[],
    folder: string,
  ): Promise<UploadOutcome[]> {
    const form = new FormData();
    for (const file of files) {
      form.append("files", file, file.name);
    }
    form.append("folder", folder);
    return this.sendForm<UploadOutcome[]>(
      workspacePath(workspaceId, `/sources/${sourceId}/uploads`),
      form,
    );
  }

  /** Where browsing starts: the roots of the local-folder connection named, or the machine's own. */
  sourceLocationRoots(workspaceId: string, connectionId?: string): Promise<SourceLocationRoot[]> {
    const query =
      connectionId === undefined ? "" : `?connectionId=${encodeURIComponent(connectionId)}`;
    return this.request<SourceLocationRoot[]>(
      "GET",
      workspacePath(workspaceId, `/source-locations/roots${query}`),
    );
  }

  /** The folders inside one, kept inside the named connection's roots. */
  sourceLocationFolders(
    workspaceId: string,
    path: string,
    connectionId?: string,
  ): Promise<SourceFolderListing> {
    const connection =
      connectionId === undefined ? "" : `&connectionId=${encodeURIComponent(connectionId)}`;
    return this.request<SourceFolderListing>(
      "GET",
      workspacePath(
        workspaceId,
        `/source-locations/folders?path=${encodeURIComponent(path)}${connection}`,
      ),
    );
  }

  listDocuments(workspaceId: string, page: PageRequest): Promise<DocumentView[]> {
    return this.request<DocumentView[]>(
      "GET",
      workspacePath(workspaceId, `/documents?${pageQuery(page)}`),
    );
  }

  /** The documents one source captured, not removed, a page at a time. */
  listDocumentsOfSource(
    workspaceId: string,
    sourceId: string,
    page: PageRequest,
  ): Promise<DocumentView[]> {
    return this.request<DocumentView[]>(
      "GET",
      workspacePath(workspaceId, `/documents?sourceId=${sourceId}&${pageQuery(page)}`),
    );
  }

  getDocument(workspaceId: string, documentId: string): Promise<DocumentView> {
    return this.request<DocumentView>(
      "GET",
      workspacePath(workspaceId, `/documents/${documentId}`),
    );
  }

  /** Takes a document out of the corpus; its revision is its version count, so a version captured meanwhile refuses. */
  /**
   * Captures text into a CUSTOM_TEXT source as a new document (revision 0) or a new version of one
   * (its current revision). Capturing the same text again answers with the existing version.
   */
  captureText(
    workspaceId: string,
    sourceId: string,
    capture: { externalId: string; title: string; text: string; revision: number },
  ): Promise<DocumentVersionView> {
    return this.request<DocumentVersionView>(
      "POST",
      workspacePath(workspaceId, `/sources/${sourceId}/documents/text`),
      capture,
    );
  }

  removeDocument(
    workspaceId: string,
    document: Pick<DocumentView, "id" | "revision">,
  ): Promise<DocumentView> {
    return this.request<DocumentView>(
      "DELETE",
      workspacePath(workspaceId, `/documents/${document.id}?revision=${document.revision}`),
    );
  }

  restoreDocument(workspaceId: string, documentId: string): Promise<DocumentView> {
    return this.request<DocumentView>(
      "POST",
      workspacePath(workspaceId, `/documents/${documentId}/restore`),
    );
  }

  listDocumentVersions(
    workspaceId: string,
    documentId: string,
    page: PageRequest,
  ): Promise<DocumentVersionView[]> {
    return this.request<DocumentVersionView[]>(
      "GET",
      workspacePath(workspaceId, `/documents/${documentId}/versions?${pageQuery(page)}`),
    );
  }

  indexStatistics(workspaceId: string): Promise<IndexStatistics> {
    return this.request<IndexStatistics>("GET", workspacePath(workspaceId, "/indexes/statistics"));
  }

  listJobs(page: PageRequest): Promise<JobView[]> {
    return this.request<JobView[]>("GET", `/v1/jobs?${pageQuery(page)}`);
  }

  jobAttempts(jobId: string): Promise<JobAttemptView[]> {
    return this.request<JobAttemptView[]>("GET", `/v1/jobs/${jobId}/attempts`);
  }

  jobFiles(jobId: string): Promise<ManagedOriginalView[]> {
    return this.request<ManagedOriginalView[]>("GET", `/v1/jobs/${jobId}/files`);
  }

  /** Re-reads every stored original and checks it against its recorded hash, as one background job. */
  startStorageVerification(idempotencyKey: string): Promise<JobView> {
    return this.request<JobView>("POST", "/v1/jobs/storage-verification", undefined, {
      "Idempotency-Key": idempotencyKey,
    });
  }

  cancelJob(jobId: string): Promise<JobView> {
    return this.request<JobView>("POST", `/v1/jobs/${jobId}/cancel`);
  }

  retryJob(jobId: string): Promise<JobView> {
    return this.request<JobView>("POST", `/v1/jobs/${jobId}/retry`);
  }

  // Source management: scanners, scans and rule scripts. Rule sets and their preview are in `ruleSets.ts`.

  getSource(workspaceId: string, sourceId: string): Promise<SourceView> {
    return this.request<SourceView>("GET", workspacePath(workspaceId, `/sources/${sourceId}`));
  }

  listScanners(workspaceId: string, page: PageRequest): Promise<ScannerView[]> {
    return this.request<ScannerView[]>(
      "GET",
      workspacePath(workspaceId, `/scanners?${pageQuery(page)}`),
    );
  }

  createScanner(workspaceId: string, name: string, maximumDepth: number): Promise<ScannerView> {
    return this.request<ScannerView>("POST", workspacePath(workspaceId, "/scanners"), {
      name,
      enabled: true,
      maximumDepth,
      revision: 0,
    });
  }

  changeScanner(
    workspaceId: string,
    scanner: ScannerView,
    maximumDepth: number,
  ): Promise<ScannerView> {
    return this.request<ScannerView>("PUT", workspacePath(workspaceId, `/scanners/${scanner.id}`), {
      name: scanner.name,
      enabled: scanner.enabled,
      maximumDepth,
      revision: scanner.revision,
    });
  }

  scannerBindingsOfSource(workspaceId: string, sourceId: string): Promise<ScannerBindingView[]> {
    return this.request<ScannerBindingView[]>(
      "GET",
      workspacePath(workspaceId, `/sources/${sourceId}/scanner-bindings`),
    );
  }

  bindScanner(
    workspaceId: string,
    scannerId: string,
    sourceId: string,
  ): Promise<ScannerBindingView> {
    return this.request<ScannerBindingView>(
      "POST",
      workspacePath(workspaceId, `/scanners/${scannerId}/bindings`),
      { sourceId },
    );
  }

  /** Starts a scan; the key makes a repeated press start one scan, not two. */
  startScan(workspaceId: string, bindingId: string, idempotencyKey: string): Promise<JobView> {
    return this.request<JobView>(
      "POST",
      workspacePath(workspaceId, `/scanner-bindings/${bindingId}/runs`),
      undefined,
      { "Idempotency-Key": idempotencyKey },
    );
  }

  scansOfSource(
    workspaceId: string,
    sourceId: string,
    page: PageRequest,
  ): Promise<ScannerRunView[]> {
    return this.request<ScannerRunView[]>(
      "GET",
      workspacePath(workspaceId, `/sources/${sourceId}/scanner-runs?${pageQuery(page)}`),
    );
  }

  scanItems(
    workspaceId: string,
    jobId: string,
    outcome: ItemOutcome | null,
    page: PageRequest,
  ): Promise<ScannerRunItem[]> {
    const filter = outcome === null ? "" : `outcome=${outcome}&`;
    return this.request<ScannerRunItem[]>(
      "GET",
      workspacePath(workspaceId, `/scanner-runs/${jobId}/items?${filter}${pageQuery(page)}`),
    );
  }

  listSystemParameters(): Promise<SystemParameterView[]> {
    return this.request<SystemParameterView[]>("GET", "/v1/system-parameters");
  }

  changeSystemParameter(
    key: string,
    value: number,
    revision: number,
  ): Promise<SystemParameterView> {
    return this.request<SystemParameterView>(
      "PUT",
      `/v1/system-parameters/${encodeURIComponent(key)}`,
      { value, revision },
    );
  }

  /** Sets an address setting; an empty text clears it. */
  changeSystemParameterText(
    key: string,
    text: string,
    revision: number,
  ): Promise<SystemParameterView> {
    return this.request<SystemParameterView>(
      "PUT",
      `/v1/system-parameters/${encodeURIComponent(key)}`,
      { text, revision },
    );
  }

  /** Where this installation is reached from outside; readable by anyone signed in. */
  installationAddresses(): Promise<InstallationAddresses> {
    return this.request<InstallationAddresses>("GET", "/v1/installation/addresses");
  }
}

export const api = new RaccoonApi();
