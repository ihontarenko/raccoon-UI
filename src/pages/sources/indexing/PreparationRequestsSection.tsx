import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { usePermissions } from "../../../access/PermissionsProvider";
import { PERMISSIONS } from "../../../access/permissions";
import { formatDateTime, labelOfCode, shortIdentifier, type CodeLabels } from "../../../application/format";
import { describeProblem } from "../../../application/problems";
import { usePagedList } from "../../../application/usePagedList";
import { usePolling } from "../../../application/usePolling";
import { useResource } from "../../../application/useResource";
import { collectAllPages } from "../../../lib/api";
import {
  pipelineApi,
  type PreparationAuditEvent,
  type PreparationRequest,
  type PreparationRequestReason,
  type PreparationRequestState,
} from "../../../lib/pipeline";
import { declareText, type DeclaredText } from "../../../translations/translate";
import { useTranslation } from "../../../translations/TranslationProvider";
import { ListFooter, ProblemState, Waiting, useToaster } from "../../../ui/components";
import { Badge, Button, Table, type BadgeTone } from "../../../ui/primitives";
import { BLOCK, BLOCK_HEAD, BLOCK_TITLE, DOCUMENT_LINK, TABLE_SURFACE, TRAIL, TRAIL_CELL } from "./sourceIndexingClasses";

const STATE_TONE: Record<PreparationRequestState, BadgeTone> = {
  PENDING: "active",
  SUBMITTED: "good",
  SKIPPED: "neutral",
  FAILED: "error",
  CANCELLED: "warn",
};

const REQUEST_STATES: CodeLabels = {
  PENDING: declareText("sources.requestState.pending", "Pending"),
  SUBMITTED: declareText("sources.requestState.submitted", "Submitted"),
  SKIPPED: declareText("sources.requestState.skipped", "Skipped"),
  FAILED: declareText("sources.requestState.failed", "Failed"),
  CANCELLED: declareText("sources.requestState.cancelled", "Cancelled"),
} satisfies Record<PreparationRequestState, DeclaredText>;

const REQUEST_REASONS: CodeLabels = {
  BINDING_DISABLED: declareText("sources.requestReason.bindingDisabled", "automatic preparation was off"),
  PROFILE_DISABLED: declareText("sources.requestReason.profileDisabled", "the profile was disabled"),
  MEDIA_TYPE_EXCLUDED: declareText("sources.requestReason.mediaTypeExcluded", "its media type is not in the list"),
  ACCESS_DENIED: declareText("sources.requestReason.accessDenied", "the capturing account may not process it"),
  ORIGINAL_TOO_LARGE: declareText("sources.requestReason.originalTooLarge", "the original is larger than the profile allows"),
  INVALID_CONFIGURATION: declareText("sources.requestReason.invalidConfiguration", "the profile's configuration was refused"),
  SUBMISSION_FAILED: declareText("sources.requestReason.submissionFailed", "the job could not be queued"),
  NO_PARSER: declareText("sources.requestReason.noParser", "no parser in the profile reads this type — add one on the profile"),
  PARSER_UNAVAILABLE: declareText(
    "sources.requestReason.parserUnavailable",
    "its parser cannot run here — the OCR engine is not installed (see Parsers)",
  ),
} satisfies Record<PreparationRequestReason, DeclaredText>;

/** What happened to a request, one step of its trail. */
const REQUEST_ACTIONS: CodeLabels = {
  BINDING_SAVED: declareText("sources.requestAction.bindingSaved", "Setting saved"),
  REQUESTED: declareText("sources.requestAction.requested", "Requested"),
  SUBMITTED: declareText("sources.requestAction.submitted", "Submitted"),
  SKIPPED: declareText("sources.requestAction.skipped", "Skipped"),
  FAILED: declareText("sources.requestAction.failed", "Failed"),
  RETRIED: declareText("sources.requestAction.retried", "Retried"),
  CANCELLED: declareText("sources.requestAction.cancelled", "Cancelled"),
} satisfies Record<PreparationAuditEvent["action"], DeclaredText>;

/**
 * Every version the automatic preparation queued, skipped or failed, newest first, with the way out of
 * a failure — retry or cancel — and the audit trail of each.
 */
export function PreparationRequestsSection({ workspaceId, sourceId, titles }: { workspaceId: string; sourceId: string; titles: Map<string, string> }) {
  const { t, plural } = useTranslation();
  const { notify } = useToaster();
  const mayManage = usePermissions().may(PERMISSIONS.automationManage);
  const requests = usePagedList((page) => pipelineApi.preparationRequests(workspaceId, sourceId, page), [workspaceId, sourceId]);
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const pending = requests.status === "ready" && requests.items.some((request) => request.state === "PENDING");
  usePolling(pending, requests.reload, requests.status === "ready" ? requests.items : null, 4000);

  const act = async (request: PreparationRequest, action: "retry" | "cancel") => {
    setBusyId(request.id);
    try {
      const saved = action === "retry" ? await pipelineApi.retryPreparationRequest(workspaceId, request) : await pipelineApi.cancelPreparationRequest(workspaceId, request);
      if (requests.status === "ready") {
        requests.replaceItem((candidate) => candidate.id === saved.id, saved);
      }
      notify({
        tone: "good",
        title: action === "retry" ? t("sources.requests.queuedAgain", "Queued again") : t("sources.requests.cancelled", "Cancelled"),
      });
    } catch (error) {
      const problem = describeProblem(error);
      notify({ tone: "error", title: problem.title, description: problem.detail ?? problem.description });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className={BLOCK} aria-labelledby="preparation-requests">
      <header className={BLOCK_HEAD}>
        <div>
          <h2 id="preparation-requests" className={BLOCK_TITLE}>
            {t("sources.requests.title", "What the automatic preparation did")}
          </h2>
          <p className="text-xs text-secondary">
            {t("sources.requests.lead", "A pending request becomes a processing job on the worker's next round.")}
          </p>
        </div>
        <Button variant="quiet" icon="refresh" onClick={requests.reload}>
          {t("sources.requests.refresh", "Refresh")}
        </Button>
      </header>
      {requests.status === "loading" && <Waiting label={t("sources.requests.loading", "Loading requests")} lines={3} />}
      {requests.status === "failed" && <ProblemState layout="section" problem={requests.problem} />}
      {requests.status === "ready" &&
        (requests.items.length === 0 ? (
          <p className="text-xs text-muted">
            {t(
              "sources.requests.empty",
              "Nothing yet. Requests appear as scans capture new versions while automatic preparation is on.",
            )}
          </p>
        ) : (
          <div className={TABLE_SURFACE}>
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t("sources.requests.document", "Document")}</th>
                  <th scope="col">{t("sources.requests.state", "State")}</th>
                  <th scope="col">{t("sources.requests.job", "Job")}</th>
                  <th scope="col">{t("sources.requests.queued", "Queued")}</th>
                  <th scope="col">
                    <span className="sr-only">{t("common.actions", "Actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {requests.items.map((request) => (
                  <RequestRow
                    key={request.id}
                    workspaceId={workspaceId}
                    request={request}
                    title={titles.get(request.documentId) ?? shortIdentifier(request.documentId)}
                    opened={openedId === request.id}
                    onToggle={() => {
                      setOpenedId(openedId === request.id ? null : request.id);
                    }}
                    actions={
                      mayManage && (request.state === "FAILED" || request.state === "PENDING") ? (
                        <>
                          {request.state === "FAILED" && (
                            <Button variant="quiet" icon="refresh" disabled={busyId === request.id} onClick={() => void act(request, "retry")}>
                              {t("sources.requests.retry", "Retry")}
                            </Button>
                          )}
                          <Button variant="quiet" disabled={busyId === request.id} onClick={() => void act(request, "cancel")}>
                            {t("common.cancel", "Cancel")}
                          </Button>
                        </>
                      ) : null
                    }
                  />
                ))}
              </tbody>
            </Table>
            <ListFooter
              shown={requests.items.length}
              counted={plural("sources.requests.count", requests.items.length, { one: "{count} request", other: "{count} requests" })}
              hasMore={requests.hasMore}
              loadingMore={requests.loadingMore}
              moreProblem={requests.moreProblem}
              onLoadMore={requests.loadMore}
            />
          </div>
        ))}
    </section>
  );
}

interface RequestRowProperties {
  workspaceId: string;
  request: PreparationRequest;
  title: string;
  opened: boolean;
  onToggle: () => void;
  actions: ReactNode;
}

function RequestRow({ workspaceId, request, title, opened, onToggle, actions }: RequestRowProperties) {
  const { t } = useTranslation();
  return (
    <>
      <tr>
        <td>
          <Link to="/documents/$documentId" params={{ documentId: request.documentId }} className={DOCUMENT_LINK}>
            {title}
          </Link>
          <div className="text-xs text-muted">
            {t("sources.requests.profileRevision", "profile revision {revision}", { revision: request.profileRevision })}
          </div>
        </td>
        <td>
          <Badge tone={STATE_TONE[request.state]}>{labelOfCode(REQUEST_STATES, request.state)}</Badge>
          {request.reason !== null && <div className="text-xs text-secondary">{labelOfCode(REQUEST_REASONS, request.reason)}</div>}
        </td>
        <td className="numeric text-xs">{request.jobId === null ? "—" : shortIdentifier(request.jobId)}</td>
        <td className="text-xs text-secondary">{formatDateTime(request.createdAt)}</td>
        <td className="actions">
          {actions}
          <Button variant="quiet" aria-expanded={opened} onClick={onToggle}>
            {opened ? t("sources.requests.hideTrail", "Hide trail") : t("sources.requests.trail", "Trail")}
          </Button>
        </td>
      </tr>
      {opened && (
        <tr>
          <td colSpan={5} className={TRAIL_CELL}>
            <RequestTrail workspaceId={workspaceId} requestId={request.id} />
          </td>
        </tr>
      )}
    </>
  );
}

function RequestTrail({ workspaceId, requestId }: { workspaceId: string; requestId: string }) {
  const { t } = useTranslation();
  const trail = useResource(() => collectAllPages((page) => pipelineApi.preparationRequestEvents(workspaceId, requestId, page)), [workspaceId, requestId]);
  if (trail.status === "loading") {
    return <Waiting label={t("sources.requests.loadingTrail", "Loading the trail")} lines={2} />;
  }
  if (trail.status === "failed") {
    return <ProblemState layout="section" problem={trail.problem} />;
  }
  return (
    <ol className={TRAIL}>
      {trail.data.map((event) => (
        <li key={event.id}>
          <span className="numeric text-muted">r{event.revision}</span> <strong>{labelOfCode(REQUEST_ACTIONS, event.action)}</strong>{" "}
          <span className="text-xs text-secondary">
            {t("sources.requests.by", "by {actor} · {time}", {
              actor: <span className="numeric">{event.actorId}</span>,
              time: formatDateTime(event.createdAt),
            })}
          </span>
        </li>
      ))}
    </ol>
  );
}
