import { lazy, Suspense } from "react";
import type { CodeEditorProperties } from "./CodeEditorSurface";
/* While the code surface loads, the same box at the same height, so nothing moves when it arrives. */
const PLACEHOLDER = [
  "m-0 overflow-hidden rounded-control border border-line bg-surface px-4 py-3",
  "font-mono text-xs leading-[1.6] whitespace-pre-wrap text-secondary",
].join(" ");

// The editor and the highlighter are loaded only where code is shown, so every other page stays light.
const LazyEditor = lazy(() => import("./CodeEditorSurface"));
const LazyHighlighted = lazy(() => import("./HighlightedScriptSurface"));

/** A jMS editor. Until CodeMirror arrives the source shows as plain text in the same box. */
export function CodeEditor(properties: CodeEditorProperties) {
  return (
    <Suspense
      fallback={
        <pre className={PLACEHOLDER} style={{ height: properties.height ?? "clamp(320px, calc(100dvh - 22rem), 760px)" }} aria-busy="true">
          {properties.value}
        </pre>
      }
    >
      <LazyEditor {...properties} />
    </Suspense>
  );
}

/** A jMS document to read. Until the highlighter arrives it shows as plain text, so nothing moves. */
export function HighlightedScript({ code }: { code: string }) {
  return (
    <Suspense fallback={<pre className={PLACEHOLDER}>{code}</pre>}>
      <LazyHighlighted code={code} />
    </Suspense>
  );
}

export type { CodeEditorProperties };
