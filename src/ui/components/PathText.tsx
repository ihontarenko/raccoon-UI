import { Fragment } from "react";

interface PathTextProperties {
  path: string;
  /**
   * `wrap` breaks only after a separator, so a long path never strands one letter on its own line;
   * `end` keeps one line and cuts from the start, because the end of a path is the part that tells
   * two of them apart; `middle` keeps one line and cuts from the middle, so both where it starts and its last
   * folder and name stay readable — `system/apps_…/streamer/ringbuf.h`.
   */
  fit?: "wrap" | "end" | "middle";
}

/** A file-system path or address, in the monospace face, laid out to keep its meaningful end visible. */
export function PathText({ path, fit = "wrap" }: PathTextProperties) {
  if (fit === "middle") {
    const segments = path.split(/(?<=[\\/])/);
    // The name never shrinks; its folder gives way only after everything before it has.
    const name = segments[segments.length - 1];
    const folder = segments.length > 1 ? segments[segments.length - 2] : "";
    const head = segments.slice(0, Math.max(0, segments.length - 2)).join("");
    return (
      // One line cut from the middle: the start of the path gives way first, then the last folder;
      // the name never does unless it alone is wider than the line.
      <span className="numeric flex min-w-0 overflow-hidden whitespace-nowrap" title={path}>
        {head !== "" && (
          <span className="min-w-[calc(2ch+1px)] overflow-hidden text-ellipsis [flex:0_1000_auto]">
            {head}
          </span>
        )}
        {folder !== "" && (
          <span className="min-w-0 overflow-hidden text-ellipsis [flex:0_1_auto]">{folder}</span>
        )}
        <span className="max-w-full min-w-0 flex-none overflow-hidden text-ellipsis">{name}</span>
      </span>
    );
  }
  if (fit === "end") {
    return (
      <span className="numeric keep-end" title={path}>
        <bdi>{path}</bdi>
      </span>
    );
  }
  const segments = path.split(/(?<=[\\/])/);
  return (
    <span className="numeric">
      {segments.map((segment, index) => (
        <Fragment key={index}>
          {segment}
          {index < segments.length - 1 && <wbr />}
        </Fragment>
      ))}
    </span>
  );
}
