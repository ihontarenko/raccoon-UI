import { INTERFACE_BUILD } from "../application/build";

// The two forms the About page embeds. They are Innoventa forms: Innoventa renders them inside an
// iframe, stores what is sent as entries, and is where the author reads them. Nothing here talks to
// Innoventa's API; the page only frames its public embed surface.

/** Where Innoventa's interface answers. `VITE_INNOVENTA_ORIGIN` overrides the development address. */
export const INNOVENTA_ORIGIN: string =
  (import.meta.env.VITE_INNOVENTA_ORIGIN as string | undefined) ?? "http://localhost:5010";

export interface FeedbackForm {
  /** Anchor on the About page, also used to build element IDs. */
  key: "contact" | "bug-report";
  title: string;
  description: string;
  /** The form's share token in Innoventa. */
  shareToken: string;
  /**
   * Values the form opens with, by Innoventa field name. The person sees and may change every one,
   * so this only saves typing; it is how an entry says it came from Raccoon.
   */
  prefill: Record<string, string>;
}

const RACCOON_LABEL = `Raccoon ${INTERFACE_BUILD.version}`;

// ⚠️ For now these are Innoventa's own seeded public forms ("Contact Us", "Bug Report"), tagged as
// Raccoon's through the prefill. Dedicated "Raccoon — contact" / "Raccoon — bug report" forms replace
// them by changing the two share tokens and the prefill field names below — nothing else here.

export const FEEDBACK_FORMS: readonly FeedbackForm[] = [
  {
    key: "contact",
    title: "Contact",
    description: "A question, an idea, or a source you would like Raccoon to read.",
    shareToken: "contact-form",
    prefill: { contact_topic: "Raccoon" },
  },
  {
    key: "bug-report",
    title: "Bug report",
    description: "What happened, how to get there, and what you expected instead.",
    shareToken: "bug-report-form",
    prefill: { bug_environment: RACCOON_LABEL, bug_context: `${RACCOON_LABEL} — page or address: ` },
  },
];

/** The address of a form's embed surface, carrying this page's origin and the prefilled values. */
export function embedAddressOf(form: FeedbackForm): string {
  const parameters = new URLSearchParams({ ancestor: window.location.origin });
  if (Object.keys(form.prefill).length > 0) {
    parameters.set("prefill", JSON.stringify(form.prefill));
  }
  return `${INNOVENTA_ORIGIN}/_/form/${encodeURIComponent(form.shareToken)}/embed?${parameters.toString()}`;
}

/** The same form as a page of its own, for when the frame cannot be shown. */
export function standaloneAddressOf(form: FeedbackForm): string {
  return `${INNOVENTA_ORIGIN}/_/form/${encodeURIComponent(form.shareToken)}`;
}
