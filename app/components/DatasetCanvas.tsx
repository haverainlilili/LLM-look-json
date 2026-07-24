"use client";

import type { LayoutBlueprint, LayoutKind } from "../lib/blueprint.ts";
import type { JsonRecord } from "../lib/dataset.ts";
import { pageStartIndex, paginationForIndex } from "../lib/pagination.ts";
import { DatasetTableView } from "./DatasetTableView";
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
  onRefresh: () => void;
  canRefresh: boolean;
  refreshHint: string;
  isRefreshing: boolean;
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
  onRefresh,
  canRefresh,
  refreshHint,
  isRefreshing,
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
        <div className="canvas-actions">
          <button
            className="refresh-button"
            type="button"
            onClick={onRefresh}
            disabled={!canRefresh || isRefreshing || isAnalyzing}
            title={refreshHint}
          >
            <span aria-hidden="true">↻</span>
            {isRefreshing ? "正在刷新…" : "刷新数据"}
          </button>
          <button
            className="ai-button"
            type="button"
            onClick={onAnalyze}
            disabled={isAnalyzing || isRefreshing}
          >
            <span aria-hidden="true">✦</span>
            {isAnalyzing ? "MING 正在分析…" : "MING 重组布局"}
          </button>
        </div>
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
          <DatasetTableView
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
