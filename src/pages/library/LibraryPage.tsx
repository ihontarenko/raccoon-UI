import { useSearch } from "@tanstack/react-router";
import { useAddressChange } from "../../application/useAddressChange";
import { useTranslation } from "../../translations/TranslationProvider";
import { Segmented } from "../../ui/components";
import { FilesPage } from "../files/FilesPage";
import { ExplorerView } from "./ExplorerView";
import type { LibraryMode, LibrarySearch } from "./librarySearch";

/**
 * The Library: the workspace's material in two ways. Files answers what is filed where and lets it be managed;
 * the explorer is for reading it. Both keep the place in the address, so switching keeps where you are.
 */
export function LibraryPage() {
  const { t } = useTranslation();
  const search = useSearch({ strict: false }) as LibrarySearch;
  const changeAddress = useAddressChange();
  const mode: LibraryMode = search.mode === "files" ? "files" : "explorer";

  const modeSwitch = (
    <Segmented<LibraryMode>
      label={t("library.mode", "Show the library as")}
      value={mode}
      onChange={(next) => void changeAddress({ to: "/library", search: { ...search, mode: next === "files" ? "files" : undefined } })}
      options={[
        { value: "explorer", label: t("library.mode.explorer", "Explorer") },
        { value: "files", label: t("library.mode.files", "Files") },
      ]}
    />
  );

  return mode === "files" ? <FilesPage modeSwitch={modeSwitch} /> : <ExplorerView modeSwitch={modeSwitch} />;
}
