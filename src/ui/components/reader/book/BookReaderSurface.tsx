import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "../../../../translations/TranslationProvider";
import { Button, Select } from "../../../primitives";
import {
  BOOK,
  BOOK_FOOTER,
  BOOK_HEADER,
  BOOK_NAVIGATION,
  BOOK_NAVIGATION_ROW,
  BOOK_POSITION,
} from "./bookClasses";
import { bookFormatOf, closeBook, openBook, type Book, type ContentsEntry } from "./bookContainers";
import { domIdOf, renderBookMarkup } from "./BookMarkup";

type Opened =
  { status: "opening" } | { status: "failed"; reason: string } | { status: "open"; book: Book };

interface BookReaderProperties {
  /** The original's object URL. */
  address: string;
  name: string;
  /** Classes of the frame the reader scrolls in — the same frame prose is read in. */
  frameClassName: string;
}

/** Where a viewer stopped reading a book, kept in this browser only: a per-viewer convenience, never shared. */
function storedPosition(key: string): number {
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

function storePosition(key: string, chapter: number): void {
  try {
    window.localStorage.setItem(key, String(chapter));
  } catch {
    // A browser that refuses storage starts the book from its beginning next time.
  }
}

/**
 * A book read a chapter at a time — EPUB or FictionBook, with its pictures, its epigraphs and poems set apart, and its
 * note references followed to the note. The contents choose a chapter; the chapters before and after are a step away at
 * both ends of the page; and the chapter a viewer stopped at is where the book opens next time in this browser.
 */
export default function BookReaderSurface({ address, name, frameClassName }: BookReaderProperties) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState<Opened>({ status: "opening" });
  const positionKey = `raccoon.book.${name}`;
  const [chapter, setChapter] = useState(() => storedPosition(positionKey));
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null);
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let current = true;
    let book: Book | null = null;
    setOpened({ status: "opening" });
    fetch(address)
      .then(async (response) => {
        const blob = await response.blob();
        const format = bookFormatOf(name, blob.type);
        if (format === null) {
          throw new Error(t("reader.book.unknownFormat", "This is not a book this reader opens."));
        }
        book = openBook(format, new Uint8Array(await blob.arrayBuffer()));
        if (current) {
          setOpened({ status: "open", book });
        } else {
          closeBook(book);
        }
      })
      .catch((error: unknown) => {
        if (current) {
          setOpened({
            status: "failed",
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      });
    return () => {
      current = false;
      if (book !== null) {
        closeBook(book);
      }
    };
  }, [address, name, t]);

  const book = opened.status === "open" ? opened.book : null;
  const chapterCount = book?.chapters.length ?? 0;
  const shownChapter = Math.min(chapter, Math.max(0, chapterCount - 1));

  // A chapter opens at its top, or at the place a link or a contents entry pointed to.
  useEffect(() => {
    if (book === null) {
      return;
    }
    storePosition(positionKey, shownChapter);
    if (pendingAnchor !== null) {
      document.getElementById(domIdOf(pendingAnchor))?.scrollIntoView({ block: "start" });
      setPendingAnchor(null);
      return;
    }
    frame.current?.scrollTo({ top: 0 });
  }, [book, shownChapter, pendingAnchor, positionKey]);

  const go = (target: number, anchor: string | null = null) => {
    if (book === null || target < 0 || target >= book.chapters.length) {
      return;
    }
    setChapter(target);
    setPendingAnchor(anchor);
  };

  const follow = (anchor: string) => {
    const target = book?.anchors.get(anchor);
    if (target !== undefined) {
      go(target, anchor);
    }
  };

  const contents = useMemo<ContentsEntry[]>(() => {
    if (book === null) {
      return [];
    }
    return book.contents.length > 0
      ? book.contents
      : book.chapters.map((entry, index) => ({
          title: entry.title || `${index + 1}`,
          depth: 1,
          chapter: index,
          anchor: null,
        }));
  }, [book]);
  // The contents entry a viewer is in: the last one that opens at or before this chapter.
  const currentEntry = contents.reduce(
    (found, entry, index) => (entry.chapter <= shownChapter ? index : found),
    0,
  );

  if (opened.status === "opening") {
    return <p className="text-xs text-muted">{t("reader.book.opening", "Opening the book…")}</p>;
  }
  if (opened.status === "failed" || book === null) {
    return <p className="text-sm">{opened.status === "failed" ? opened.reason : ""}</p>;
  }
  const current = book.chapters[shownChapter];
  if (current === undefined) {
    return (
      <p className="text-sm text-muted">
        {t("reader.book.empty", "This book has no text to read.")}
      </p>
    );
  }
  const previous = book.chapters[shownChapter - 1];
  const next = book.chapters[shownChapter + 1];
  const context = {
    base: current.base,
    scopedAnchors: current.path !== "",
    path: current.path,
    pictures: book.pictures,
    onFollow: follow,
  };

  return (
    <div ref={frame} className={`${frameClassName} ${BOOK}`} data-reader-stage>
      <div className={BOOK_NAVIGATION} data-book-navigation>
        <div className={BOOK_NAVIGATION_ROW}>
          <Select
            aria-label={t("reader.book.contents", "Contents")}
            value={currentEntry}
            onChange={(event) => {
              const entry = contents[Number(event.target.value)];
              if (entry !== undefined) {
                go(entry.chapter, entry.anchor);
              }
            }}
          >
            {contents.map((entry, index) => (
              <option key={`${index}-${entry.title}`} value={index}>
                {" ".repeat(Math.max(0, entry.depth - 1))}
                {entry.title}
              </option>
            ))}
          </Select>
          <span className={BOOK_POSITION}>
            {t("reader.book.position", "Chapter {current} of {total}", {
              current: shownChapter + 1,
              total: chapterCount,
            })}
          </span>
          <Button
            variant="quiet"
            iconOnly
            icon="previous"
            disabled={previous === undefined}
            aria-label={t("reader.book.previous", "Previous chapter")}
            onClick={() => go(shownChapter - 1)}
          />
          <Button
            variant="quiet"
            iconOnly
            icon="chevron"
            disabled={next === undefined}
            aria-label={t("reader.book.next", "Next chapter")}
            onClick={() => go(shownChapter + 1)}
          />
        </div>
      </div>
      {shownChapter === 0 && (book.title !== null || book.authors.length > 0) && (
        <header className={BOOK_HEADER}>
          {book.authors.length > 0 && <p>{book.authors.join(", ")}</p>}
          {book.title !== null && <p className="text-lg font-semibold text-ink">{book.title}</p>}
        </header>
      )}
      <article className="rc-prose" key={shownChapter} aria-label={current.title}>
        {renderBookMarkup(current.body, context)}
      </article>
      <nav className={BOOK_FOOTER} aria-label={t("reader.book.chapters", "Chapters")}>
        {previous !== undefined ? (
          <Button variant="quiet" icon="previous" onClick={() => go(shownChapter - 1)}>
            {previous.title || t("reader.book.previous", "Previous chapter")}
          </Button>
        ) : (
          <span />
        )}
        {next !== undefined && (
          <Button variant="primary" onClick={() => go(shownChapter + 1)}>
            {next.title || t("reader.book.next", "Next chapter")} →
          </Button>
        )}
      </nav>
    </div>
  );
}
