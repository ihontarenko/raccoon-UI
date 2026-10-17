import { formatNumber } from "../../../application/format";
import { useTranslation } from "../../../translations/TranslationProvider";
import { PROGRESS, PROGRESS_FILL, PROGRESS_TRACK } from "./translationsClasses";

/** How much of the catalogue a language covers: a bar for the eye, the counts and the share for reading. */
export function TranslationProgress({ translated, total }: { translated: number; total: number }) {
  const { t, locale } = useTranslation();
  const share = total === 0 ? 1 : translated / total;
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(share);
  return (
    <div className={PROGRESS}>
      <span className={PROGRESS_TRACK} aria-hidden="true">
        <span className={PROGRESS_FILL} data-complete={translated >= total} style={{ width: `${share * 100}%` }} />
      </span>
      <span className="text-xs numeric">
        {t("translations.progressCount", "{translated} of {total} · {percent}", {
          translated: formatNumber(translated),
          total: formatNumber(total),
          percent,
        })}
      </span>
    </div>
  );
}
