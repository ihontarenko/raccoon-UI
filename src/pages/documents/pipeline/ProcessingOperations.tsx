import type { ProcessingRun } from "../../../lib/pipeline";
import { declareText } from "../../../translations/translate";
import { useTranslation } from "../../../translations/TranslationProvider";
import { Badge, Button, Checkbox } from "../../../ui/primitives";
import {
  OPERATION_DETAIL,
  OPERATION_LIST,
  OPERATION_ROW,
  OPERATION_TITLE,
} from "./processingClasses";

export type Operation = "parse" | "chunk" | "lexical" | "relations";

export const OPERATIONS = [
  {
    id: "parse",
    title: declareText("processing.operation.parse", "Read and parse"),
    description: declareText(
      "processing.operation.parseHelp",
      "Read the original into structured text. Other operations can reuse this result.",
    ),
  },
  {
    id: "chunk",
    title: declareText("processing.operation.chunk", "Prepare chunks"),
    description: declareText(
      "processing.operation.chunkHelp",
      "Split the parsed content into traceable fragments. Search publication is optional.",
    ),
  },
  {
    id: "lexical",
    title: declareText("processing.operation.lexical", "Prepare lexical search"),
    description: declareText(
      "processing.operation.lexicalHelp",
      "Build search entries from chunks using this run’s analyzer and publication settings.",
    ),
  },
  {
    id: "relations",
    title: declareText("processing.operation.relations", "Extract entities and relations"),
    description: declareText(
      "processing.operation.relationsHelp",
      "Select provider facts and rule-derived candidates. Resolve them with other documents under Relations.",
    ),
  },
] as const;

/** One capability, its saved state and its place in the next run. Also shown in the UI Kit. */
export function ProcessingOperations({
  steps,
  runs,
  disabled,
  onToggle,
  onOnly,
}: {
  steps: string[];
  runs: ProcessingRun[];
  disabled: boolean;
  onToggle: (operation: Operation, selected: boolean) => void;
  onOnly: (operation: Operation) => void;
}) {
  const { t, say } = useTranslation();
  return (
    <div className={OPERATION_LIST}>
      {OPERATIONS.map((operation) => {
        const prepared = runs.some(
          (run) =>
            run.job.status === "SUCCEEDED" &&
            (operation.id === "parse" || run.preparation.steps.includes(operation.id)),
        );
        return (
          <div className={OPERATION_ROW} key={operation.id}>
            <div className="min-w-0">
              <div className={OPERATION_TITLE}>
                <Checkbox
                  label={say(operation.title)}
                  checked={steps.includes(operation.id)}
                  disabled={disabled || operation.id === "parse"}
                  onChange={(event) => onToggle(operation.id, event.target.checked)}
                />
                <Badge tone={prepared ? "allow" : "neutral"}>
                  {prepared
                    ? t("processing.ready", "Prepared")
                    : t("processing.notPrepared", "Not prepared")}
                </Badge>
              </div>
              <p className={OPERATION_DETAIL}>{say(operation.description)}</p>
            </div>
            <div className="justify-self-end">
              <Button
                variant="quiet"
                disabled={disabled}
                onClick={() => onOnly(operation.id)}
                aria-label={t("processing.onlyNamed", "Choose only: {operation}", {
                  operation: say(operation.title),
                })}
              >
                {t("processing.only", "Only this")}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
