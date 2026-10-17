import { useState } from "react";
import { useReadySession } from "../../application/session";
import { useTranslation } from "../../translations/TranslationProvider";
import { DocumentPicker, type PickedDocument } from "../components";

/** The shared document picker against the workspace's real catalogue, as the suite editor uses it. */
export function DocumentPickerSample() {
  const { t } = useTranslation();
  const { workspace } = useReadySession();
  const [chosen, setChosen] = useState<PickedDocument[]>([]);
  return (
    <DocumentPicker
      workspaceId={workspace?.id ?? ""}
      label={t("uiKit.documentPicker.label", "Expected documents")}
      hint={t("uiKit.documentPicker.hint", "Searches titles and paths on the server; at most 20 matches at a time.")}
      chosen={chosen}
      maximum={3}
      onPick={(document) => setChosen((current) => [...current, document])}
      onRemove={(documentId) => setChosen((current) => current.filter((document) => document.id !== documentId))}
    />
  );
}
