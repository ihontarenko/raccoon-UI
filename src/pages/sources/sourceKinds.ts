import type { SourceKind } from "../../lib/contracts";
import { declareText, translateDeclared, type DeclaredText } from "../../translations/translate";

// How each kind of source is named in the interface, what it is for, how its documents arrive, and what
// its location means — so a form asks for a folder path or a repository address in the person's terms
// rather than "location".

/** Scanned sources are walked by a scan; the others receive documents one at a time through Raccoon. */
export type SourceArrival = "scanned" | "direct";

/**
 * A kind's words, read in the viewer's language at the moment they are read: every text field is a getter over
 * a declared text, so a caller renders `SOURCE_KINDS[kind].label` as before and still follows a language change.
 */
interface SourceKindDescription {
  readonly label: string;
  /** One sentence: what a source of this kind is. */
  readonly explanation: string;
  readonly arrival: SourceArrival;
  /** Label for the location field, or null when this kind has no location to give. */
  readonly locationLabel: string | null;
  readonly locationHint: string | null;
}

interface SourceKindTexts {
  label: DeclaredText;
  explanation: DeclaredText;
  arrival: SourceArrival;
  locationLabel?: DeclaredText;
  locationHint?: DeclaredText;
}

function describeKind(texts: SourceKindTexts): SourceKindDescription {
  return {
    get label() {
      return translateDeclared(texts.label);
    },
    get explanation() {
      return translateDeclared(texts.explanation);
    },
    arrival: texts.arrival,
    get locationLabel() {
      return texts.locationLabel === undefined ? null : translateDeclared(texts.locationLabel);
    },
    get locationHint() {
      return texts.locationHint === undefined ? null : translateDeclared(texts.locationHint);
    },
  };
}

export const SOURCE_KINDS: Record<SourceKind, SourceKindDescription> = {
  LOCAL_FOLDER: describeKind({
    label: declareText("sourceSetup.kind.localFolder.label", "Local folder"),
    explanation: declareText(
      "sourceSetup.kind.localFolder.explanation",
      "A folder on the machine Raccoon runs on, read where it is — every scan takes what changed.",
    ),
    arrival: "scanned",
    locationLabel: declareText("sourceSetup.kind.localFolder.locationLabel", "Folder path"),
    locationHint: declareText(
      "sourceSetup.kind.localFolder.locationHint",
      "The full path of a folder on the machine Raccoon runs on — removable drives included. Type it, or choose it below.",
    ),
  }),
  GIT: describeKind({
    label: declareText("sourceSetup.kind.git.label", "Git repository"),
    explanation: declareText(
      "sourceSetup.kind.git.explanation",
      "A repository checked out fresh at every scan; each scan records the commit it read. A private GitHub or GitLab repository is read with an access token.",
    ),
    arrival: "scanned",
    locationLabel: declareText("sourceSetup.kind.git.locationLabel", "Repository address"),
    locationHint: declareText(
      "sourceSetup.kind.git.locationHint",
      "The https clone address, such as https://github.com/owner/name.git. ssh is not supported.",
    ),
  }),
  WEB: describeKind({
    label: declareText("sourceSetup.kind.web.label", "Web pages"),
    explanation: declareText(
      "sourceSetup.kind.web.explanation",
      "Pages fetched from public addresses and turned into Markdown — only the listed pages, or also the pages they link to within the same sites, as many links deep as the source says.",
    ),
    arrival: "scanned",
    locationLabel: declareText("sourceSetup.kind.web.locationLabel", "Start address"),
    locationHint: declareText(
      "sourceSetup.kind.web.locationHint",
      "The page the scan starts from. robots.txt is honoured, and only public addresses are fetched.",
    ),
  }),
  MANAGED_FOLDER: describeKind({
    label: declareText("sourceSetup.kind.managedFolder.label", "Uploaded files"),
    explanation: declareText(
      "sourceSetup.kind.managedFolder.explanation",
      "A folder that lives in Raccoon: you upload files into it from the Files page or the source page.",
    ),
    arrival: "direct",
  }),
  CUSTOM_TEXT: describeKind({
    label: declareText("sourceSetup.kind.customText.label", "Written text"),
    explanation: declareText("sourceSetup.kind.customText.explanation", "Notes typed into Raccoon itself, each kept with its versions."),
    arrival: "direct",
  }),
  PUSH: describeKind({
    label: declareText("sourceSetup.kind.push.label", "Pushed by another system"),
    explanation: declareText(
      "sourceSetup.kind.push.explanation",
      "Another system sends documents to Raccoon's API with a credential; each arrives judged by the same rules.",
    ),
    arrival: "direct",
  }),
  CONNECTED: describeKind({
    label: declareText("sourceSetup.kind.connected.label", "Knowledge base"),
    explanation: declareText(
      "sourceSetup.kind.connected.explanation",
      "Pages of a knowledge base such as Kiwi, read through a connection an administrator configured once: every scan lists the chosen sections, fetches only the pages that changed, and removes the ones deleted there.",
    ),
    arrival: "scanned",
  }),
};

export const SOURCE_KIND_ORDER: SourceKind[] = ["LOCAL_FOLDER", "GIT", "WEB", "CONNECTED", "MANAGED_FOLDER", "CUSTOM_TEXT", "PUSH"];

export function isScanned(kind: SourceKind): boolean {
  return SOURCE_KINDS[kind].arrival === "scanned";
}
