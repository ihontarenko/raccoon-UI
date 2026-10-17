import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { useTranslation } from "../../../translations/TranslationProvider";

interface FieldProperties {
  label: ReactNode;
  /** The single form control this field wraps; it receives id and aria wiring automatically. */
  children: ReactElement<{
    id?: string;
    invalid?: boolean;
    "aria-describedby"?: string;
  }>;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  /**
   * Something that belongs on the label line without being part of the label — an "About …" button. It sits
   * outside the <label>, so activating it never focuses or toggles the control.
   */
  labelAside?: ReactNode;
}

/* One explicit column: an implicit track is sized by the control intrinsic width, so a number input
   in a narrow form column would run out of its field and under the next control. Rows pack to the
   top — a field beside a taller one (a hint, an error) must not stretch its control to match. */
const FIELD = "grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-1.5";

const LABEL = "text-xs font-[550] text-secondary";

export function Field({ label, children, hint, error, required = false, labelAside }: FieldProperties) {
  const { t } = useTranslation();
  const controlId = useId();
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const describedBy = [hint !== undefined ? hintId : null, error !== undefined ? errorId : null]
    .filter((value): value is string => value !== null)
    .join(" ");

  // The control owns its accessible name through the bound label; here it only gains the generated
  // id, the invalid state and the association to its hint and error text.
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: controlId,
        invalid: error !== undefined ? true : undefined,
        "aria-describedby": describedBy.length > 0 ? describedBy : undefined,
      })
    : children;

  const labelElement = (
    <label className={LABEL} htmlFor={controlId}>
      {label}
      {required && (
        <span className="font-medium text-muted"> {t("components.field.required", "(required)")}</span>
      )}
    </label>
  );

  return (
    <div className={FIELD}>
      {labelAside === undefined ? (
        labelElement
      ) : (
        <div className="flex min-w-0 items-center gap-1">
          {labelElement}
          {labelAside}
        </div>
      )}
      {control}
      {hint !== undefined && (
        // A div, not a p: a hint may carry block content such as a list of findings.
        <div id={hintId} className="text-xs text-muted">
          {hint}
        </div>
      )}
      {error !== undefined && (
        <p id={errorId} className="flex items-center gap-1.5 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
