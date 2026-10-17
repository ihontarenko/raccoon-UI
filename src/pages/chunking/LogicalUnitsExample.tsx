import { useTranslation } from "../../translations/TranslationProvider";

/*
 * A worked example rather than a definition: the same four units a parser emitted, cut the two ways the setting
 * offers. The first row lists the units; below, each numbered box is one chunk, holding the units it took.
 */
const FIGURE = "grid gap-3 rounded-control border border-line bg-well p-3";
const ROW = "grid grid-cols-[calc(150px*var(--ui-scale))_minmax(0,1fr)] items-start gap-3 max-[700px]:grid-cols-1";
const ROW_LABEL = "pt-1 text-xs font-semibold text-ink";
const ROW_ITEMS = "flex flex-wrap items-stretch gap-2";
const UNIT = "font-mono text-[11px] text-secondary";
const UNIT_TAG = "rounded-[2px] bg-surface px-1.5 py-0.5 font-mono text-[11px] text-secondary";
const CHUNK = "grid content-start gap-0.5 rounded-[3px] border-2 border-accent bg-surface px-2 pt-1 pb-1.5";
const CHUNK_NUMBER = "text-[10px] font-semibold tracking-[0.04em] text-accent-text uppercase";

interface ExampleChunk {
  units: string[];
}

export function LogicalUnitsExample() {
  const { t } = useTranslation();
  const units = ["name: raccoon", "port: 8150", "debug: false", "class JavaParser { … 3 000 chars … }"];
  const asParsed: ExampleChunk[] = [
    { units: ["name: raccoon"] },
    { units: ["port: 8150"] },
    { units: ["debug: false"] },
    { units: ["class JavaParser { … part 1"] },
    { units: ["… part 2 }"] },
  ];
  const merged: ExampleChunk[] = [
    { units: ["name: raccoon", "port: 8150", "debug: false"] },
    { units: ["class JavaParser { … part 1"] },
    { units: ["… part 2 }"] },
  ];
  const chunks = (list: ExampleChunk[]) => (
    <span className={ROW_ITEMS}>
      {list.map((chunk, index) => (
        <span key={index} className={CHUNK}>
          <span className={CHUNK_NUMBER}>{t("chunking.example.chunk", "Chunk {number}", { number: index + 1 })}</span>
          {chunk.units.map((unit) => (
            <span key={unit} className={UNIT}>
              {unit}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
  return (
    <figure className={FIGURE} aria-label={t("chunking.example.label", "How logical units become chunks")}>
      <div className={ROW}>
        <span className={ROW_LABEL}>{t("chunking.example.parsed", "The parser emits 4 units")}</span>
        <span className={ROW_ITEMS}>
          {units.map((unit) => (
            <span key={unit} className={UNIT_TAG}>
              {unit}
            </span>
          ))}
        </span>
      </div>
      <div className={ROW}>
        <span className={ROW_LABEL}>{t("chunking.example.asParsed", "As parsed → 5 chunks")}</span>
        {chunks(asParsed)}
      </div>
      <div className={ROW}>
        <span className={ROW_LABEL}>{t("chunking.example.merged", "Merge small → 3 chunks")}</span>
        {chunks(merged)}
      </div>
      <figcaption className="text-xs text-secondary">
        {t(
          "chunking.example.captionChain",
          "The parser decides what a unit is — a key of a config file, a declaration of code, a table row, a paragraph. This chunker decides how units become chunks: each alone, or small neighbours together up to the chunk size. A unit larger than the size (the class) is cut into parts either way, and each part keeps the unit's name. A document without units — plain text, a PDF read line by line — is passed on to the next chunker of the chain, a window chunker.",
        )}
      </figcaption>
    </figure>
  );
}
