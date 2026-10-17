// Composite components: built from primitives, shared by every page and the shell.

export { PageHeader, PageHelp } from "./PageHeader";
export { Notice, type NoticeTone } from "./Notice";
export { EmbeddedForm } from "./EmbeddedForm";
export { EmptyState } from "./EmptyState";
export { Waiting } from "./Waiting";
export { Inspector, InspectorSection, InspectorActions, Facts, Workbench, SectionBar, ListHead } from "./Inspector";
export { DetailSurface, DetailSection, DetailList, DetailTokens, StackedValues } from "./DetailSections";
export { ProblemState } from "./ProblemState";
export { ToasterProvider, useToaster, type ToastTone } from "./Toaster";
export { ConfirmDialog } from "./ConfirmDialog";
export { ListFooter } from "./ListFooter";
export { RowName } from "./RowName";
export { RowLink } from "./RowLink";
export { Tabs, TabPanel, type TabItem, type TabMarker } from "./Tabs";
export { Segmented, type SegmentOption } from "./Segmented";
export { ChipInput } from "./ChipInput";
export { Statistics, type Statistic } from "./Statistics";
export { revealActiveItem } from "./revealActiveItem";
export { PathText } from "./PathText";
export {
  EditorCard,
  EditorCardFields,
  EditorCardList,
  EditorCardWide,
  type EditorCardActions,
} from "./EditorCard";
export { PresetChoices, PresetPicker, type PresetChoice } from "./PresetPicker";
export { TabToolbar } from "./TabToolbar";
export { DocumentPicker, pickedOf, type PickedDocument } from "./DocumentPicker";
export { DateRangeField } from "./DateRangeField";
export { CopyButton } from "./CopyButton";
export { CopyableExample } from "./CopyableExample";
export { usePublicBaseAddress, BrowserOriginNote } from "./InstallationAddress";
export { Menu, type MenuItem } from "./Menu";
export {
  ExplainParameter,
  ParameterFindings,
  type ExplanationExtreme,
  type ParameterExplanationContent,
  type ParameterFact,
  type ParameterFinding,
} from "./ParameterExplanation";
export { CodeEditor, HighlightedScript, type CodeEditorProperties } from "./code/CodeEditor";
export { ClosenessGauge } from "./closeness/ClosenessGauge";
export { ClosenessOverview } from "./closeness/ClosenessOverview";
export { HitCloseness } from "./closeness/HitCloseness";
export { PhaseWave } from "./closeness/PhaseWave";
export { closenessOfHits, describeCloseness, distanceScaleEnd, type Closeness } from "./closeness/closeness";
export { FoundBy } from "./explanation/FoundBy";
export { HighlightedExcerpt } from "./explanation/HighlightedExcerpt";
export { RankLadder } from "./explanation/RankLadder";
export { RankShift } from "./explanation/RankShift";
export { RecognizedInQuery, hasRecognition } from "./explanation/RecognizedInQuery";
export { TermPresence } from "./explanation/TermPresence";
export { explainHit, termPresence, type HitExplanation } from "./explanation/explanation";
