import { declareText } from "../../translations/translate";

/** The metric names, shared by the editor's thresholds and the run report. */
export const METRIC_LABELS = {
  hitRate: declareText("quality.metric.hitRate", "Hit rate"),
  recall: declareText("quality.metric.recall", "Recall"),
  meanReciprocalRank: declareText("quality.metric.reciprocalRank", "Reciprocal rank"),
  unexpected: declareText("quality.metric.unexpected", "Unexpected answers"),
};
