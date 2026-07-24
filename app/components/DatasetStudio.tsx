"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { searchRecords } from "../lib/dataset.ts";
import { AnalysisProcess } from "./AnalysisProcess";
import { DatasetCanvas } from "./DatasetCanvas";
import { DatasetTabs } from "./DatasetTabs";
import { InspectorPanel } from "./InspectorPanel";
import { SchemaPanel } from "./SchemaPanel";
import { useDatasetWorkspace } from "./useDatasetWorkspace";
import { WorkspaceHeader } from "./WorkspaceHeader";

export function DatasetStudio() {
  const dataset = useDatasetWorkspace();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    workspace,
    query,
    activeIndex,
    viewKind,
    source,
    layoutGuidance,
    analysisFlow,
    tablePageSize,
  } = dataset.activeSession;

  const visibleRecords = useMemo(
    () => searchRecords(workspace.records, query),
    [workspace.records, query],
  );
  const activeRecord = visibleRecords[activeIndex];

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.getElementById("dataset-search")?.focus();
      }
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  return (
    <div
      className={`forma-app${isDragging ? " is-dragging" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setIsDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) void dataset.loadFile(file);
      }}
    >
      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept=".json,.jsonl,.ndjson,application/json"
        aria-label="选择 JSON 文件"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void dataset.loadFile(file);
          event.target.value = "";
        }}
      />
      <WorkspaceHeader
        fileName={workspace.fileName}
        query={query}
        onQueryChange={dataset.updateQuery}
        onOpenFile={() => fileInputRef.current?.click()}
        onAddress={dataset.loadAddress}
      />

      <DatasetTabs
        tabs={dataset.tabs}
        activeId={dataset.activeId}
        onActivate={dataset.activateDataset}
        onClose={dataset.closeDataset}
        onAdd={() => fileInputRef.current?.click()}
      />

      <div className="notice-bar" role="status" aria-live="polite">
        <span className={`notice-indicator tone-${dataset.noticeTone}`} aria-hidden="true" />
        <span>{dataset.notice}</span>
        <span className="notice-separator" aria-hidden="true">·</span>
        <span>完整文件不会上传</span>
        <AnalysisProcess flow={analysisFlow} />
      </div>

      <div
        id="dataset-workspace"
        className="workspace-grid"
        role="tabpanel"
        aria-labelledby={`dataset-tab-${dataset.activeId}`}
      >
        <SchemaPanel
          schema={workspace.schema}
          recordPath={workspace.recordPath}
          recordCount={workspace.records.length}
          format={workspace.format}
        />
        <DatasetCanvas
          blueprint={workspace.blueprint}
          records={visibleRecords}
          activeIndex={activeIndex}
          viewKind={viewKind}
          source={source}
          onViewKindChange={dataset.updateViewKind}
          onActiveIndexChange={dataset.updateActiveIndex}
          onAnalyze={() => void dataset.analyzeWithModel()}
          isAnalyzing={dataset.isAnalyzing}
          tablePageSize={tablePageSize}
          onTablePageSizeChange={dataset.updateTablePageSize}
        />
        <InspectorPanel
          blueprint={workspace.blueprint}
          record={activeRecord}
          source={source}
          layoutGuidance={layoutGuidance}
          isAnalyzing={dataset.isAnalyzing}
          onLayoutGuidanceChange={dataset.updateLayoutGuidance}
        />
      </div>

      {isDragging ? (
        <div className="drop-overlay" role="status">
          <div>
            <span aria-hidden="true">↓</span>
            <strong>松开即可新增数据集标签</strong>
            <p>支持 JSON、JSONL 与 NDJSON，最大 20 MB</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
