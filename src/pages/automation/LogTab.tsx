import { useState } from "react";
import { formatDateTime, labelOfCode, type CodeLabels } from "../../application/format";
import { usePolling } from "../../application/usePolling";
import { useResource } from "../../application/useResource";
import { automationApi } from "../../lib/automation";
import { declareText } from "../../translations/translate";
import { useTranslation } from "../../translations/TranslationProvider";
import { EmptyState, ProblemState, Waiting } from "../../ui/components";
import { Badge, Button, Checkbox, Input } from "../../ui/primitives";
import { LOG, LOG_MESSAGE, STACK, TOOLBAR, TOOLBAR_ACTIONS } from "./automationClasses";

/** A log line's level, as `ScriptLogLine.level` carries it. */
const LOG_LEVELS: CodeLabels = {
  INFO: declareText("automation.log.level.info", "info"),
  WARN: declareText("automation.log.level.warn", "warn"),
};

/**
 * What scripts wrote with `@log`, newest first. The log lives in the server's memory: it is quick to
 * read and is lost when the server restarts, which the page says rather than hides.
 */
export function LogTab({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const log = useResource(() => automationApi.log(workspaceId), [workspaceId]);
  const [following, setFollowing] = useState(true);
  const [filter, setFilter] = useState("");
  usePolling(following && log.status === "ready", log.reload, log.status === "ready" ? log.data : null, 3000);

  if (log.status === "loading") {
    return <Waiting label={t("automation.log.loading", "Loading the log")} lines={5} />;
  }
  if (log.status === "failed") {
    return (
      <ProblemState
        layout="section"
        problem={log.problem}
        actions={
          <Button icon="refresh" onClick={log.reload}>
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      />
    );
  }
  const needle = filter.trim().toLowerCase();
  const lines = needle === "" ? log.data : log.data.filter((line) => `${line.rule} ${line.stage} ${line.message}`.toLowerCase().includes(needle));

  return (
    <div className={STACK}>
      <div className={TOOLBAR}>
        <Input
          aria-label={t("automation.log.filterLabel", "Filter the log")}
          placeholder={t("automation.log.filterPlaceholder", "Filter by script, stage or text")}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        <div className={TOOLBAR_ACTIONS}>
          <Checkbox label={t("automation.log.follow", "Follow")} checked={following} onChange={(event) => setFollowing(event.target.checked)} />
          <span className="text-xs text-muted">{t("automation.log.inMemory", "Kept in memory; a restart clears it.")}</span>
        </div>
      </div>
      {lines.length === 0 ? (
        <EmptyState
          title={log.data.length === 0 ? t("automation.log.empty", "Nothing logged yet") : t("automation.log.noMatch", "No line matches")}
          description={t("automation.log.emptyDescription", "Scripts write here with {info} and {warn} as they run.", {
            info: "@log.info",
            warn: "@log.warn",
          })}
        />
      ) : (
        <ol className={LOG}>
          {lines.map((line, index) => (
            <li key={`${line.at}-${index}`} data-level={line.level}>
              <span className="text-xs text-muted numeric">{formatDateTime(line.at)}</span>
              <Badge tone={line.level === "WARN" ? "warn" : "neutral"}>{labelOfCode(LOG_LEVELS, line.level)}</Badge>
              <span className="numeric text-xs">{line.rule.split("/").at(-1)}</span>
              <span className="numeric text-xs text-muted">{line.stage}</span>
              <span className={LOG_MESSAGE}>{line.message}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
