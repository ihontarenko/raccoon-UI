import type { CallState } from "../../lib/answers";
import type { BadgeTone } from "../../ui/primitives";

/**
 * How a model call's state reads wherever a call is listed. FAILED charged nothing and needs no
 * acknowledgement; UNKNOWN might have charged and blocks its query until it is acknowledged.
 */
export const CALL_TONE: Record<CallState, BadgeTone> = {
  RESERVED: "active",
  COMPLETED: "good",
  FAILED: "warn",
  UNKNOWN: "error",
  ACKNOWLEDGED: "neutral",
};
