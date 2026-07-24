import type { LayoutBlueprint } from "../lib/blueprint.ts";
import { getValueAtPath, type JsonRecord } from "../lib/dataset.ts";

interface DatasetTableViewProps {
  blueprint: LayoutBlueprint;
  records: JsonRecord[];
  activeIndex: number;
  start: number;
  end: number;
  onSelect: (index: number) => void;
}

function compact(value: unknown): string {
  const result =
    typeof value === "string"
      ? value
      : value === undefined
        ? "—"
        : JSON.stringify(value);
  return result.length > 88 ? `${result.slice(0, 88)}…` : result;
}

export function DatasetTableView({
  blueprint,
  records,
  activeIndex,
  start,
  end,
  onSelect,
}: DatasetTableViewProps) {
  const fields = blueprint.fields.slice(0, 6);
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">#</th>
            {fields.map((field) => (
              <th scope="col" key={field.path}>{field.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.slice(start, end).map((record, pageIndex) => {
            const recordIndex = start + pageIndex;
            return (
              <tr
                className={activeIndex === recordIndex ? "is-selected" : undefined}
                key={recordIndex}
              >
                <th scope="row">
                  <button
                    type="button"
                    onClick={() => onSelect(recordIndex)}
                    aria-label={`查看第 ${recordIndex + 1} 条`}
                  >
                    {String(recordIndex + 1).padStart(2, "0")}
                  </button>
                </th>
                {fields.map((field) => (
                  <td key={field.path}>{compact(getValueAtPath(record, field.path))}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="table-limit">
        第 {start + 1}–{end} 条，共 {records.length.toLocaleString("zh-CN")} 条
      </p>
    </div>
  );
}
