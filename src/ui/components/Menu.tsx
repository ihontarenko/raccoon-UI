import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { classNames } from "../../lib/classNames";
import { Icon, type IconName } from "../primitives";

/* `group` is what lets the trigger read the open state the container carries: an open menu keeps its
   button lit rather than letting it fade the moment the pointer moves onto the list. */
const TRIGGER = [
  "grid size-[calc(26px*var(--ui-scale))] place-items-center rounded-control border border-transparent",
  "bg-surface text-muted hover:border-line hover:text-ink",
  "group-data-[open=true]:border-line group-data-[open=true]:text-ink",
  "pointer-coarse:size-[40px] motion-reduce:transition-none",
].join(" ");

const LIST = [
  "absolute top-[calc(100%+4px)] z-30 grid min-w-[calc(190px*var(--ui-scale))] p-1",
  "rounded-control border border-line-strong bg-surface",
].join(" ");

const ITEM = [
  "flex min-h-(--control) items-center gap-2 rounded-[calc(4px*var(--ui-scale))] border-0 bg-transparent px-2",
  "text-left text-xs whitespace-nowrap not-disabled:hover:bg-well focus-visible:bg-well",
  "disabled:cursor-not-allowed disabled:text-muted pointer-coarse:min-h-[40px]",
].join(" ");

export interface MenuItem {
  label: string;
  icon?: IconName;
  /** A destructive item is drawn in the danger colour and kept last. */
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

interface MenuProperties {
  /** What the menu acts on, for the button's accessible name: "Actions for README.md". */
  label: string;
  items: MenuItem[];
  /** Opens to the left of the button instead of the right, near a right edge. */
  alignEnd?: boolean;
  className?: string;
}

/**
 * A small action menu behind a "⋯" button. Arrow keys move through the items, Escape and a click
 * outside close it and return focus to the button, and choosing an item closes it first.
 */
export function Menu({ label, items, alignEnd = false, className }: MenuProperties) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    const closeOutside = (event: PointerEvent) => {
      if (container.current !== null && !container.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    container.current?.querySelector<HTMLButtonElement>("[role=menuitem]:not(:disabled)")?.focus();
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const entries = [...(container.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not(:disabled)") ?? [])];
    const index = entries.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      entries[(index + 1) % entries.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      entries[(index - 1 + entries.length) % entries.length]?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className={classNames("group relative inline-flex", className)} ref={container} data-open={open}>
      <button
        ref={button}
        type="button"
        className={TRIGGER}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <Icon name="more" size="small" />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={classNames(LIST, alignEnd ? "right-0" : "left-0")}
          onKeyDown={moveFocus}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={classNames(ITEM, item.destructive === true ? "text-danger" : "text-ink")}
              disabled={item.disabled}
              onClick={(event) => {
                event.stopPropagation();
                close();
                item.onSelect();
              }}
            >
              {item.icon !== undefined ? (
                <Icon name={item.icon} size="small" />
              ) : (
                <span className="w-[calc(16px*var(--ui-scale))]" />
              )}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
