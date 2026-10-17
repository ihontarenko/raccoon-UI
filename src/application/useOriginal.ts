import { useEffect, useState } from "react";
import { LARGEST_TEXT_FETCHED_BYTES, readOriginal, type OriginalContent } from "../lib/files";
import { isReadAsText, type ReadingFormat } from "../ui/components/reader/readingFormat";
import { describeProblem, type Problem } from "./problems";

export type LoadedOriginal =
  | { status: "loading" }
  | { status: "failed"; problem: Problem }
  /** Nothing to fetch: the reader cannot show this kind, or the text is too large to read here. */
  | { status: "skipped"; reason: "not-shown" | "too-large" }
  | { status: "ready"; content: OriginalContent };

interface OriginalRequest {
  workspaceId: string;
  versionId: string;
  format: ReadingFormat;
  /** The type it is shown as, which an object URL must carry for the browser to show it. */
  mediaType: string;
  sizeBytes: number;
}

/**
 * One original, fetched once per version for the reader that shows it. An object URL lives as long as
 * the version is open and is revoked when another opens or the reader closes.
 */
export function useOriginal({ workspaceId, versionId, format, mediaType, sizeBytes }: OriginalRequest): LoadedOriginal {
  const [loaded, setLoaded] = useState<LoadedOriginal>({ status: "loading" });
  const asText = isReadAsText(format.kind);
  const shown = format.kind !== "none";
  const shownAs = mediaType.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";
  const tooLarge = asText && sizeBytes > LARGEST_TEXT_FETCHED_BYTES;

  useEffect(() => {
    let current = true;
    let address: string | null = null;
    if (!shown) {
      setLoaded({ status: "skipped", reason: "not-shown" });
      return;
    }
    if (tooLarge) {
      setLoaded({ status: "skipped", reason: "too-large" });
      return;
    }
    setLoaded({ status: "loading" });
    readOriginal(workspaceId, versionId, asText, shownAs)
      .then((content) => {
        if (content.form === "bytes") {
          address = content.address;
        }
        if (current) {
          setLoaded({ status: "ready", content });
        } else if (address !== null) {
          URL.revokeObjectURL(address);
        }
      })
      .catch((error: unknown) => {
        if (current) {
          setLoaded({ status: "failed", problem: describeProblem(error) });
        }
      });
    return () => {
      current = false;
      if (address !== null) {
        URL.revokeObjectURL(address);
      }
    };
  }, [workspaceId, versionId, asText, shown, shownAs, tooLarge]);

  return loaded;
}
