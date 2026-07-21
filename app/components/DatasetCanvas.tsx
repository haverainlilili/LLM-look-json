import type { LayoutBlueprint, LayoutKind } from "../lib/blueprint.ts";
import { getValueAtPath, type JsonRecord } from "../lib/dataset.ts";
import { RecordRenderer } from "./RecordRenderer";

export type ViewKind = LayoutKind | "raw";

interface DatasetCanvasProps {
  blueprint: LayoutBlueprint;
  records: JsonRecord[];
  activeIndex: number;
  viewKind: ViewKind;
  source: "local" | "model";
  onViewKindChange: (kind: ViewKind) => void;
  onActiveIndexChange: (index: number) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

const VIEW_LABELS: Record<ViewKind, string> = {
  conversation: "对话",
  comparison: "对比",
  gallery: "媒体",
  table: "表格",
  cards: "卡片",
  raw: "原始",
};

function compact(value: unknown): string {
  const result =
    typeof value === "string"
      ? value
      : value === undefined
        ? "—"
        : JSON.stringify(value);
  return result.length > 88 ? `${result.slice(0, 88)}…` : result;
}

function TableView({
  blueprint,
  records,
  activeIndex,
  onSelect,
}: {
  blueprint: LayoutBlueprint;
  records: JsonRecord[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
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
          {records.slice(0, 100).map((record, index) => (
            <tr className={activeIndex === index ? "is-selected" : undefined} key={index}>
              <th scope="row">
                <button type="button" onClick={() => onSelect(index)} aria-label={`查看第 ${index + 1} 条`}>
                  {String(index + 1).padStart(2, "0")}
                </button>
              </th>
              {fields.map((field) => (
                <td key={field.path}>{compact(getValueAtPath(record, field.path))}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {records.length > 100 ? <p className="table-limit">表格先展示前 100 条，使用搜索缩小范围。</p> : null}
    </div>
  );
}

export function DatasetCanvas({
  blueprint,
  records,
  activeIndex,
  viewKind,
  source,
  onViewKindChange,
  onActiveIndexChange,
  onAnalyze,
  isAnalyzing,
}: DatasetCanvasProps) {
  const activeRecord = records[activeIndex];
  const viewOptions: ViewKind[] = Array.from(
    new Set<ViewKind>([blueprint.kind, "cards", "table", "raw"]),
  );

  return (
    <main className="dataset-canvas">
      <div className="canvas-heading">
        <div>
          <div className="title-line">
            <h1>{blueprint.title}</h1>
            <span className={`analysis-badge source-${source}`}>
              {source === "model" ? "AI 布局" : "本地布局"}
            </span>
          </div>
          <p>{blueprint.description}</p>
        </div>
        <button className="ai-button" type="button" onClick={onAnalyze} disabled={isAnalyzing}>
          <span aria-hidden="true">✦</span>
          {isAnalyzing ? "正在分析…" : "AI 重组布局"}
        </button>
      </div>

      <div className="canvas-toolbar">
        <div className="view-switcher" aria-label="选择数据视图">
          {viewOptions.map((kind) => (
            <button
              className={viewKind === kind ? "is-active" : undefined}
              type="button"
              aria-pressed={viewKind === kind}
              onClick={() => onViewKindChange(kind)}
              key={kind}
            >
              {VIEW_LABELS[kind]}
            </button>
          ))}
        </div>
        <div className="record-navigation" aria-label="记录导航">
          <button
            type="button"
            onClick={() => onActiveIndexChange(Math.max(0, activeIndex - 1))}
            disabled={activeIndex === 0 || records.length === 0}
            aria-label="上一条记录"
          >
            ←
          </button>
          <span>
            <strong>{records.length === 0 ? 0 : activeIndex + 1}</strong> / {records.length}
          </span>
          <button
            type="button"
            onClick={() => onActiveIndexChange(Math.min(records.length - 1, activeIndex + 1))}
            disabled={records.length === 0 || activeIndex >= records.length - 1}
            aria-label="下一条记录"
          >
            →
          </button>
        </div>
      </div>

      <div className="canvas-content">
        {records.length === 0 || !activeRecord ? (
          <div className="empty-results" role="status">
            <span aria-hidden="true">⌕</span>
            <h2>没有匹配的记录</h2>
            <p>换一个关键词，或清空搜索条件。</p>
          </div>
        ) : viewKind === "table" ? (
          <TableView
            blueprint={blueprint}
            records={records}
            activeIndex={activeIndex}
            onSelect={onActiveIndexChange}
          />
        ) : (
          <RecordRenderer blueprint={blueprint} kind={viewKind} record={activeRecord} />
        )}
      </div>
    </main>
  );
}
