import { Link } from "@tanstack/react-router";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { classNames } from "../../../lib/classNames";
import { Icon, type IconName } from "../Icon/Icon";

export type ButtonVariant = "default" | "primary" | "quiet" | "danger";

interface SharedButtonProperties {
  variant?: ButtonVariant;
  /** An optional leading icon rendered before the label (or as the sole content when icon-only). */
  icon?: IconName;
  /** Renders only the icon; `aria-label` then becomes required for an accessible name. */
  iconOnly?: boolean;
  /**
   * For a quiet button that starts a line under text: its label lines up with that text instead of
   * sitting a padding's width in from it.
   */
  flush?: boolean;
  children?: ReactNode;
}

type ButtonElementProperties = SharedButtonProperties &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & { href?: undefined };

type AnchorElementProperties = SharedButtonProperties &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className"> & { href: string };

export type ButtonProperties = ButtonElementProperties | AnchorElementProperties;

/*
 * ⚠️ `not-disabled:hover:` RATHER THAN `enabled:hover:`, and the difference is not cosmetic. A
 * button with `href` renders as an anchor, and `:enabled` matches form controls only — an anchor
 * satisfies `:not(:disabled)` but never `:enabled`, so the whole hover look would be missing from
 * every link drawn as a button.
 */
const SHARED =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-control border font-medium no-underline";

/*
 * ⚠️ EACH VARIANT CARRIES ITS OWN DISABLED LOOK, INCLUDING THE OPACITY. Nothing is joined here by
 * `tailwind-merge` (see `lib/classNames`), so two classes setting one property both survive and the
 * stylesheet's own order decides which wins — unpredictable for `opacity-45` against
 * `opacity-100`. One declaration per property per variant is what keeps that from mattering.
 */
const VARIANT_CLASS: Record<ButtonVariant, string> = {
  default:
    "border-line-strong bg-surface text-ink not-disabled:hover:border-accent-text not-disabled:hover:bg-well disabled:opacity-45",
  /* A faded ink fill reads as grey-on-grey in both themes. A waiting primary action is drawn as an
     outlined well instead — still where the action will be, its label still legible. */
  primary:
    "border-ink bg-ink text-on-ink not-disabled:hover:border-accent-text not-disabled:hover:bg-accent-text disabled:cursor-not-allowed disabled:border-line-strong disabled:border-dashed disabled:bg-well disabled:text-muted",
  quiet:
    "border-transparent bg-transparent text-ink not-disabled:hover:border-transparent not-disabled:hover:bg-well disabled:opacity-45",
  danger:
    "border-line-strong bg-surface text-danger not-disabled:hover:border-danger not-disabled:hover:bg-danger-soft disabled:opacity-45",
};

/* No label to widen it, so it is the one control a finger can miss: it takes the touch floor in both
   directions rather than the ordinary control height. */
const ICON_ONLY_SIZE = "w-(--touch-target) min-h-(--touch-target) p-1.5";
const LABELLED_SIZE = "min-h-(--control) px-3 py-1";

/* Pulled back by its own padding and border, so the label starts on the text edge above it. */
const FLUSH = "[margin-left:calc(-12px*var(--ui-scale)-1px)]";

export function Button(properties: ButtonProperties) {
  const { variant = "default", icon, iconOnly = false, flush = false, children, ...rest } = properties;
  const className = classNames(
    SHARED,
    VARIANT_CLASS[variant],
    iconOnly ? ICON_ONLY_SIZE : LABELLED_SIZE,
    flush && FLUSH,
  );
  const content = (
    <>
      {icon !== undefined && <Icon name={icon} size="small" />}
      {!iconOnly && children}
    </>
  );

  if (rest.href !== undefined) {
    const { href, ...anchorRest } = rest as AnchorElementProperties;
    // An address inside the application navigates through the router, so the page is not reloaded.
    if (href.startsWith("/") && !href.startsWith("//")) {
      return (
        <Link className={className} data-variant={variant} to={href} {...anchorRest}>
          {content}
        </Link>
      );
    }
    return (
      <a className={className} data-variant={variant} href={href} {...anchorRest}>
        {content}
      </a>
    );
  }

  const { type = "button", ...buttonRest } = rest as ButtonElementProperties;
  return (
    <button className={className} data-variant={variant} type={type} {...buttonRest}>
      {content}
    </button>
  );
}
