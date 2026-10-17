import { explainParameter } from "../../application/parameterExplanations";
import { declareText } from "../../translations/translate";
import { useTranslation } from "../../translations/TranslationProvider";
import { ExplainParameter } from "../../ui/components";

/** The chunk settings a profile holds, each explained from the processing catalogue. */
const SETTINGS = {
  strategy: { path: "preparation.chunking.strategyId", title: declareText("chunking.setting.strategy", "Strategy") },
  size: { path: "preparation.chunking.maximumCodePoints", title: declareText("chunking.setting.size", "Chunk size") },
  overlap: { path: "preparation.chunking.overlapCodePoints", title: declareText("chunking.setting.overlap", "Chunk overlap") },
  merging: { path: "preparation.chunking.unitMerging", title: declareText("chunking.setting.merging", "Unit merging") },
  entryUnit: { path: "preparation.chunking.entryUnit", title: declareText("chunking.setting.entryUnit", "Entry unit") },
  tableUnit: { path: "preparation.chunking.tableUnit", title: declareText("chunking.setting.tableUnit", "Table unit") },
} as const;

export type ChunkSetting = keyof typeof SETTINGS;

/** The explanation of one chunk setting, placed beside whatever names that setting — a column header, a field label. */
export function SettingExplanation({ setting }: { setting: ChunkSetting }) {
  const { say } = useTranslation();
  const { path, title } = SETTINGS[setting];
  return <ExplainParameter name={say(title)} identifier={path} explanation={explainParameter("processing", path, { title: say(title) })} />;
}
