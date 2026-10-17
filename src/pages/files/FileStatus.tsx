import type { FileEntry } from "../../lib/files";
import { useTranslation } from "../../translations/TranslationProvider";
import { Badge } from "../../ui/primitives";

/**
 * Where a file stands, in a reader's words: taken out of the corpus, found by search, or only kept. One badge for the
 * list, the tiles and the preview, so the three never disagree.
 */
export function FileStatus({ file }: { file: Pick<FileEntry, "removedAt" | "published"> }) {
  const { t } = useTranslation();
  if (file.removedAt !== null) {
    return <Badge tone="deny">{t("files.status.removed", "Removed")}</Badge>;
  }
  return file.published ? (
    <Badge tone="good">{t("files.status.searchable", "Searchable")}</Badge>
  ) : (
    <Badge tone="neutral">{t("files.status.stored", "Stored only")}</Badge>
  );
}
