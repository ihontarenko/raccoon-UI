import { useTranslation } from "../../../translations/TranslationProvider";
import { Table } from "../../primitives";
import { formatDecimal, type Closeness } from "./closeness";

/*
 * The exact numbers behind the pictures, for the reader who wants to compare two hits to the third decimal: the
 * keyword share of the best, the meaning distance and similarity, and the score the list was ordered by.
 */
interface ClosenessTableProperties {
  closenesses: Closeness[];
  titles: string[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

const ROW = "cursor-pointer";

export function ClosenessTable({ closenesses, titles, selectedIndex, onSelect }: ClosenessTableProperties) {
  const { t } = useTranslation();
  const dash = <span className="text-muted">—</span>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <thead>
          <tr>
            <th scope="col" className="numeric">#</th>
            <th scope="col">{t("closeness.table.hit", "Hit")}</th>
            <th scope="col" className="numeric">{t("closeness.table.words", "Words, of best")}</th>
            <th scope="col" className="numeric">{t("closeness.table.distance", "Distance")}</th>
            <th scope="col" className="numeric">{t("closeness.table.similarity", "Similarity")}</th>
            <th scope="col" className="numeric">{t("closeness.table.score", "Score")}</th>
          </tr>
        </thead>
        <tbody>
          {closenesses.map((closeness, index) => (
            <tr
              key={index}
              className={ROW}
              data-selected={selectedIndex === index}
              aria-selected={selectedIndex === index}
              onClick={() => onSelect(index)}
            >
              <td className="numeric">{index + 1}</td>
              <td className="max-w-[calc(320px*var(--ui-scale))] truncate">{titles[index]}</td>
              <td className="numeric">
                {closeness.keywords === null ? dash : `${Math.round(closeness.keywords.relativeToBest * 100)}%`}
              </td>
              <td className="numeric">
                {closeness.meaning === null ? dash : formatDecimal(closeness.meaning.distance, 3)}
              </td>
              <td className="numeric">
                {closeness.meaning?.similarity === null || closeness.meaning === null ? dash : formatDecimal(closeness.meaning.similarity, 3)}
              </td>
              <td className="numeric">{formatDecimal(closeness.rankingScore, 3)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
