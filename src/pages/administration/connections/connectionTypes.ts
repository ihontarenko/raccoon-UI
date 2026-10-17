import type { ConnectionTypeDescriptor } from "../../../lib/connections";
import { declareText, translateDeclared, type DeclaredText } from "../../../translations/translate";

// The words for each built-in connection type, in the viewer's language. A knowledge-base connector's own words come
// from the server and are shown as it writes them.

const BUILT_IN_TYPE_NAMES: Record<string, DeclaredText> = {
  LOCAL_FOLDER: declareText("connections.type.localFolder", "Local folder"),
  GIT: declareText("connections.type.git", "Git"),
  WEB: declareText("connections.type.web", "Web"),
  PUSH: declareText("connections.type.push", "Push"),
};

const BUILT_IN_TYPE_DESCRIPTIONS: Record<string, DeclaredText> = {
  LOCAL_FOLDER: declareText(
    "connections.type.localFolder.description",
    "This machine and the folders sources may read on it. Each source picks one folder inside a root.",
  ),
  GIT: declareText(
    "connections.type.git.description",
    "A hosting — GitHub, GitLab or another https host — and, optionally, the access token and owners repositories are read with.",
  ),
  WEB: declareText(
    "connections.type.web.description",
    "The public hosts sources may fetch from, and the limits every crawl keeps: the pause between requests, link depth and pages.",
  ),
  PUSH: declareText(
    "connections.type.push.description",
    "Other systems push documents to this installation's address with an API credential. Nothing else to configure.",
  ),
};

/** The flat order the interface lists types in: built-in kinds first, then knowledge bases as the server lists them. */
export const BUILT_IN_TYPE_ORDER = ["LOCAL_FOLDER", "GIT", "WEB", "PUSH"];

export function typeName(type: string, descriptors: ConnectionTypeDescriptor[]): string {
  const declared = BUILT_IN_TYPE_NAMES[type];
  if (declared !== undefined) {
    return translateDeclared(declared);
  }
  return descriptors.find((descriptor) => descriptor.type === type)?.displayName ?? type;
}

export function typeDescription(descriptor: ConnectionTypeDescriptor): string {
  const declared = BUILT_IN_TYPE_DESCRIPTIONS[descriptor.type];
  return declared === undefined ? descriptor.description : translateDeclared(declared);
}

/** The types in the order the interface shows them. */
export function orderedTypes(descriptors: ConnectionTypeDescriptor[]): ConnectionTypeDescriptor[] {
  const rank = (descriptor: ConnectionTypeDescriptor) => {
    const index = BUILT_IN_TYPE_ORDER.indexOf(descriptor.type);
    return index < 0 ? BUILT_IN_TYPE_ORDER.length : index;
  };
  return [...descriptors].sort((left, right) => rank(left) - rank(right));
}
