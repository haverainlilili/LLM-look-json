"use client";

import type { LayoutBlueprint, LayoutKind } from "../lib/blueprint.ts";
import { getValueAtPath, type JsonRecord } from "../lib/dataset.ts";
import { pageStartIndex, paginationForIndex } from "../lib/pagination.ts";
import { PaginationControls } from "./PaginationControls";
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
  tablePageSize: number;
  onTablePageSizeChange: (pageSize: number) => void;
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
  start,
  end,
  onSelect,
}: {
  blueprint: LayoutBlueprint;
  records: JsonRecord[];
  activeIndex: number;
  start: number;
  end: number;
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
  tablePageSize,
  onTablePageSizeChange,
}: DatasetCanvasProps) {
  const activeRecord = records[activeIndex];
  const viewOptions: ViewKind[] = Array.from(
    new Set<ViewKind>([blueprint.kind, "cards", "table", "raw"]),
  );
  const pageSize = viewKind === "table" ? tablePageSize : 1;
  const pagination = paginationForIndex(records.length, pageSize, activeIndex);

  function selectPage(page: number) {
    onActiveIndexChange(pageStartIndex(records.length, pageSize, page));
  }

  return (
    <main className="dataset-canvas">
      <div className="canvas-heading">
        <div>
          <div className="title-line">
            <h1>{blueprint.title}</h1>
            <span className={`analysis-badge source-${source}`}>
              {source === "model" ? "MING 布局" : "本地布局"}
            </span>
          </div>
          <p>{blueprint.description}</p>
        </div>
        <button className="ai-button" type="button" onClick={onAnalyze} disabled={isAnalyzing}>
          <span aria-hidden="true">✦</span>
          {isAnalyzing ? "MING 正在分析…" : "MING 重组布局"}
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
        <PaginationControls
          page={pagination.page}
          pageCount={pagination.pageCount}
          tablePageSize={viewKind === "table" ? tablePageSize : undefined}
          onPageChange={selectPage}
          onTablePageSizeChange={onTablePageSizeChange}
        />
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
            start={pagination.start}
            end={pagination.end}
            onSelect={onActiveIndexChange}
          />
        ) : (
          <RecordRenderer blueprint={blueprint} kind={viewKind} record={activeRecord} />
        )}
      </div>
    </main>
  );
}
