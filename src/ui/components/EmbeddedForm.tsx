import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../translations/TranslationProvider";
import { Button } from "../primitives";
import { Notice } from "./Notice";

/* The form inside chose its own design, which is light and paints itself transparent — so the frame
   supplies the light ground it expects in both themes; on a dark page it reads as the other
   product sheet. The reported height is the content height, and the border is added outside it
   (`box-content`) so nothing is clipped. */
const FRAME = [
  "block box-content w-[calc(100%-2px)] min-w-0 rounded-control border border-line",
  "bg-embedded-ground [color-scheme:light] transition-[height] duration-120 motion-reduce:transition-none",
].join(" ");

// A form that lives in another product, shown in place through that product's embed surface.
//
// The iframe is the boundary: the other product renders, validates and stores the submission, and
// this page never sees what was typed. The frame keeps exactly the height the page inside reports —
// Innoventa's embed contract — and a frame that never reports is treated as unreachable rather than
// left as an empty rectangle.

/** Innoventa's resize message, from its `embedContract.ts`. */
const RESIZE_MESSAGE = "innoventa:embed-resize";
/** The floor applied to a reported height, so a page measuring itself mid-load does not collapse. */
const SMALLEST_HEIGHT = 240;
/** What the frame reserves before the page inside has said anything. */
const STARTING_HEIGHT = 420;
/** How long a silent frame is given before it is reported as unreachable. */
const ANSWER_DEADLINE_MILLISECONDS = 15000;

interface EmbeddedFormProperties {
  /** Names the frame for assistive technology. */
  title: string;
  /** The embed surface's address. */
  address: string;
  /** The origin resize messages must come from; any other sender is ignored. */
  origin: string;
  /** The same form as a page of its own, offered beside the frame and when it cannot be shown. */
  standaloneAddress: string;
}

type FrameState = "waiting" | "answered" | "silent";

export function EmbeddedForm({ title, address, origin, standaloneAddress }: EmbeddedFormProperties) {
  const { t } = useTranslation();
  const frameReference = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(STARTING_HEIGHT);
  const [state, setState] = useState<FrameState>("waiting");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const receiveMessage = (event: MessageEvent<unknown>) => {
      // Both checks: the origin says it is Innoventa, the source says it is this frame and not a
      // second form on the same page.
      if (event.origin !== origin || event.source !== frameReference.current?.contentWindow) {
        return;
      }
      const message = event.data as { type?: unknown; height?: unknown } | null;
      if (message === null || typeof message !== "object" || message.type !== RESIZE_MESSAGE) {
        return;
      }
      if (typeof message.height !== "number" || !Number.isFinite(message.height)) {
        return;
      }
      setHeight(Math.max(SMALLEST_HEIGHT, Math.ceil(message.height)));
      setState("answered");
    };
    window.addEventListener("message", receiveMessage);
    return () => {
      window.removeEventListener("message", receiveMessage);
    };
  }, [origin]);

  useEffect(() => {
    if (state !== "waiting") {
      return;
    }
    const deadline = window.setTimeout(() => {
      setState("silent");
    }, ANSWER_DEADLINE_MILLISECONDS);
    return () => {
      window.clearTimeout(deadline);
    };
  }, [state, attempt]);

  if (state === "silent") {
    return (
      <Notice
        tone="warn"
        title={t("embeddedForm.notLoaded", "The form did not load")}
        action={
          <Button
            icon="refresh"
            onClick={() => {
              setHeight(STARTING_HEIGHT);
              setState("waiting");
              setAttempt((current) => current + 1);
            }}
          >
            {t("common.tryAgain", "Try again")}
          </Button>
        }
      >
        {t("embeddedForm.noAnswer", "Innoventa, which serves this form, did not answer. It may be offline. You can also {link}.", {
          link: (
            <a href={standaloneAddress} target="_blank" rel="noopener noreferrer">
              {t("embeddedForm.openOnOwnPage", "open the form on its own page")}
            </a>
          ),
        })}
      </Notice>
    );
  }

  return (
    <div className="grid min-w-0 gap-2">
      <iframe
        key={attempt}
        ref={frameReference}
        className={FRAME}
        src={address}
        title={title}
        style={{ height: `${height}px` }}
        aria-busy={state === "waiting"}
      />
      <p className="m-0 text-xs text-muted">
        <a href={standaloneAddress} target="_blank" rel="noopener noreferrer">
          {t("embeddedForm.openInNewTab", "Open this form in a new tab")}
        </a>
      </p>
    </div>
  );
}
