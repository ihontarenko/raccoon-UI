import { Link } from "@tanstack/react-router";
import { Can } from "../../access/Can";
import { PERMISSIONS } from "../../access/permissions";
import { isHealthy, type ConnectionChoice } from "../../lib/connections";
import { useTranslation } from "../../translations/TranslationProvider";
import { Notice } from "../../ui/components";
import { Badge } from "../../ui/primitives";
import { KINDS, KIND_OPTION, KIND_TEXT } from "./newSourceClasses";

/**
 * Which connection of the chosen type a new source reads through: each with its health — blue when it works, red with
 * the reason when it does not. With none of the type yet, says who adds one and where.
 */
export function SourceConnectionField({
  choices,
  value,
  error,
  onChange,
}: {
  /** The connections of the chosen type only. */
  choices: ConnectionChoice[];
  value: string;
  error: string | undefined;
  onChange: (connectionId: string) => void;
}) {
  const { t } = useTranslation();

  if (choices.length === 0) {
    return (
      <Notice tone="warn" title={t("sourceSetup.connection.noneOfType.title", "No connection of this type yet")}>
        {t(
          "sourceSetup.connection.noneOfType.description",
          "An installation administrator adds one once — what it may offer, and its credential where it takes one — and every workspace can then add sources through it.",
        )}{" "}
        <Can permission={PERMISSIONS.systemRead}>
          <Link to="/administration/$section" params={{ section: "connections" }}>
            {t("sourceSetup.connected.noConnection.open", "Open Connections")}
          </Link>
        </Can>
      </Notice>
    );
  }
  const errorId = "source-connection-error";
  return (
    <div role="radiogroup" aria-label={t("sourceSetup.step.connection.label", "Connection")} aria-describedby={error === undefined ? undefined : errorId}>
      <div className={KINDS}>
        {choices.map((choice) => (
          <label key={choice.id} className={KIND_OPTION}>
            <input
              type="radio"
              name="connection"
              value={choice.id}
              checked={value === choice.id}
              aria-invalid={error === undefined ? undefined : true}
              onChange={() => onChange(choice.id)}
            />
            <span className={KIND_TEXT}>
              <span>{choice.name}</span>
              {choice.health === null ? (
                <Badge tone="neutral">{t("connections.health.notChecked", "Not checked")}</Badge>
              ) : (
                <Badge tone={isHealthy(choice.health) ? "active" : "error"}>
                  {isHealthy(choice.health) ? t("connections.health.healthy", "Works") : t("sourceSetup.connection.broken", "Broken")}
                </Badge>
              )}
            </span>
          </label>
        ))}
      </div>
      {(() => {
        const chosen = choices.find((choice) => choice.id === value);
        return chosen?.healthSentence == null ? null : <p className="text-xs text-secondary">{chosen.healthSentence}</p>;
      })()}
      {error !== undefined && (
        <p id={errorId} className="m-0 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
