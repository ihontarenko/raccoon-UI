import { useState } from "react";
import { Can } from "../../access/Can";
import { PERMISSIONS } from "../../access/permissions";
import { describeProblem } from "../../application/problems";
import { useResource } from "../../application/useResource";
import { api } from "../../lib/api";
import { connectionsApi, type ConnectionChoice } from "../../lib/connections";
import type { SourceView } from "../../lib/contracts";
import { useTranslation } from "../../translations/TranslationProvider";
import { Facts, useToaster } from "../../ui/components";
import { Button } from "../../ui/primitives";
import { SourceConnectionField } from "./SourceConnectionField";
import { CONNECTION_CHOICE } from "./sourcePageClasses";

/**
 * The connection a source reads through — its name, or, for a source that has none yet, the choice of one. The chosen
 * connection's boundary judges the source exactly as when a source is added, so a folder outside its roots is refused
 * with the reason. Once chosen, a source keeps its connection.
 */
export function SourceConnectionSetting({
  workspaceId,
  source,
  onChanged,
}: {
  workspaceId: string;
  source: SourceView;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const { notify } = useToaster();
  const choices = useResource<ConnectionChoice[]>(() => connectionsApi.choices(workspaceId), [workspaceId]);
  const [chosen, setChosen] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  if (choices.status !== "ready") {
    return null;
  }
  if (source.connectionId !== null) {
    const connection = choices.data.find((choice) => choice.id === source.connectionId);
    return <Facts rows={[[t("sources.connection.name", "Reads through"), connection?.name ?? t("sources.connection.unavailable", "A connection this workspace cannot use")]]} />;
  }

  const ofKind = choices.data.filter((choice) => choice.kind === source.kind);
  const save = async () => {
    if (chosen === "") {
      setError(t("sources.connection.required", "Choose the connection this source reads through."));
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await api.chooseSourceConnection(workspaceId, source, chosen);
      notify({ tone: "good", title: t("sources.connection.chosen", "{name} now reads through a connection", { name: source.name }) });
      onChanged();
    } catch (failure) {
      const problem = describeProblem(failure);
      setError(problem.detail ?? problem.description);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={CONNECTION_CHOICE}>
      <p className="text-xs text-secondary">
        {t("sources.connection.choose", "Choose a connection. Until then this source is not scanned; its documents stay readable.")}
      </p>
      <Can
        permission={PERMISSIONS.sourceManage}
        fallback={<p className="text-xs text-muted">{t("sources.connection.askManager", "Someone who manages sources chooses it.")}</p>}
      >
        <SourceConnectionField choices={ofKind} value={chosen} error={error} onChange={setChosen} />
        {ofKind.length > 0 && (
          <div>
            <Button variant="primary" disabled={saving} onClick={() => void save()}>
              {saving ? t("sources.connection.saving", "Saving…") : t("sources.connection.save", "Use this connection")}
            </Button>
          </div>
        )}
      </Can>
    </div>
  );
}
