"use client";

import { useEffect, useMemo, useState } from "react";

import {
  completeAnalysisFlow,
  createIdleAnalysisFlow,
  failAnalysisFlow,
  parseAnalysisFailure,
  parseAnalysisTrace,
  startAnalysisFlow,
  type AnalysisFlow,
  type AnalysisStage,
} from "../lib/analysis-flow.ts";
import { parseBlueprint, createLocalBlueprint, type LayoutBlueprint } from "../lib/blueprint.ts";
import {
  createModelSamples,
  inferSchema,
  parseDatasetText,
  searchRecords,
  type DatasetFormat,
  type JsonRecord,
  type SchemaField,
} from "../lib/dataset.ts";
import { SAMPLE_FILE_NAME, SAMPLE_RECORDS } from "../lib/sample-data.ts";
import { AnalysisProcess } from "./AnalysisProcess";
import { DatasetCanvas, type ViewKind } from "./DatasetCanvas";
import { InspectorPanel } from "./InspectorPanel";
import { SchemaPanel } from "./SchemaPanel";
import { WorkspaceHeader } from "./WorkspaceHeader";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

interface WorkspaceData {
  fileName: string;
  format: DatasetFormat;
  recordPath: string;
  records: JsonRecord[];
  schema: SchemaField[];
  blueprint: LayoutBlueprint;
}

function initialWorkspace(): WorkspaceData {
  const schema = inferSchema(SAMPLE_RECORDS);
  return {
    fileName: SAMPLE_FILE_NAME,
    format: "jsonl",
    recordPath: "$",
    records: SAMPLE_RECORDS,
    schema,
    blueprint: createLocalBlueprint(SAMPLE_FILE_NAME, schema, SAMPLE_RECORDS),
  };
}

export function DatasetStudio() {
  const [workspace, setWorkspace] = useState<WorkspaceData>(initialWorkspace);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewKind, setViewKind] = useState<ViewKind>(workspace.blueprint.kind);
  const [source, setSource] = useState<"local" | "model">("local");
  const [notice, setNotice] = useState("已载入示例数据；拖入文件即可替换。");
  const [noticeTone, setNoticeTone] = useState<"neutral" | "success" | "error">("neutral");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [analysisFlow, setAnalysisFlow] = useState<AnalysisFlow>(createIdleAnalysisFlow);

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

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);
    setActiveIndex(0);
  }

  async function loadFile(file: File) {
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".json") && !lowerName.endsWith(".jsonl") && !lowerName.endsWith(".ndjson")) {
      setNotice("请选择 .json、.jsonl 或 .ndjson 文件。");
      setNoticeTone("error");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setNotice("首版浏览器支持最大 20 MB 文件；更大的数据建议先转换为抽样 JSONL。");
      setNoticeTone("error");
      return;
    }

    try {
      const parsed = parseDatasetText(await file.text(), file.name);
      const schema = inferSchema(parsed.records);
      const blueprint = createLocalBlueprint(file.name, schema, parsed.records);
      setWorkspace({
        fileName: file.name,
        format: parsed.format,
        recordPath: parsed.recordPath,
        records: parsed.records,
        schema,
        blueprint,
      });
      setQuery("");
      setActiveIndex(0);
      setViewKind(blueprint.kind);
      setSource("local");
      setAnalysisFlow(createIdleAnalysisFlow());
      setNotice(`已在本机解析 ${parsed.records.length.toLocaleString("zh-CN")} 条记录。`);
      setNoticeTone("success");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "无法读取这个文件。");
      setNoticeTone("error");
    }
  }

  async function analyzeWithModel() {
    if (isAnalyzing) return;
    const samples = createModelSamples(workspace.records);
    let recordedFailure = false;
    const recordFailure = (stage: AnalysisStage, detail: string) => {
      recordedFailure = true;
      setAnalysisFlow(failAnalysisFlow(stage, detail));
    };
    setIsAnalyzing(true);
    setAnalysisFlow(startAnalysisFlow(workspace.schema.length, samples.length));
    setNotice("MING 正在分析 Schema 与少量截断样本…");
    setNoticeTone("neutral");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: workspace.fileName,
          schema: workspace.schema.slice(0, 120),
          samples,
        }),
      });
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        recordFailure("validation", "分析接口没有返回有效的 JSON 响应。");
        throw new Error("无法读取模型分析结果。");
      }
      if (!response.ok) {
        const failure = parseAnalysisFailure(payload);
        if (failure) {
          recordFailure(failure.stage, failure.detail);
          throw new Error(failure.message);
        }
        recordFailure("provider", `分析接口返回 HTTP ${response.status}。`);
        throw new Error("模型暂时无法分析布局。");
      }
      if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
        recordFailure("validation", "分析接口返回了未知的数据结构。");
        throw new Error("模型返回了未知响应。");
      }
      let blueprint: LayoutBlueprint;
      try {
        blueprint = parseBlueprint(
          (payload as Record<string, unknown>).data,
          workspace.schema,
        );
      } catch {
        recordFailure("apply", "浏览器未能把已验证的蓝图应用到当前 Schema。");
        throw new Error("布局无法应用到当前数据集。");
      }
      setWorkspace((current) => ({ ...current, blueprint }));
      setViewKind(blueprint.kind);
      setSource("model");
      setAnalysisFlow(completeAnalysisFlow(parseAnalysisTrace(payload) ?? undefined));
      setNotice("MING 布局已通过安全校验并应用。");
      setNoticeTone("success");
    } catch (caught) {
      if (!recordedFailure) {
        recordFailure("provider", "浏览器无法完成请求，请检查本地服务和网络连接。");
      }
      setNotice(
        caught instanceof Error
          ? `${caught.message} 已保留本地布局。`
          : "模型分析失败，已保留本地布局。",
      );
      setNoticeTone("error");
    } finally {
      setIsAnalyzing(false);
    }
  }

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
        if (file) void loadFile(file);
      }}
    >
      <WorkspaceHeader
        fileName={workspace.fileName}
        query={query}
        onQueryChange={updateQuery}
        onFile={(file) => void loadFile(file)}
      />

      <div className="notice-bar" role="status" aria-live="polite">
        <span className={`notice-indicator tone-${noticeTone}`} aria-hidden="true" />
        <span>{notice}</span>
        <span className="notice-separator" aria-hidden="true">·</span>
        <span>完整文件不会上传</span>
        <AnalysisProcess flow={analysisFlow} />
      </div>

      <div className="workspace-grid">
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
          onViewKindChange={setViewKind}
          onActiveIndexChange={setActiveIndex}
          onAnalyze={() => void analyzeWithModel()}
          isAnalyzing={isAnalyzing}
        />
        <InspectorPanel blueprint={workspace.blueprint} record={activeRecord} source={source} />
      </div>

      {isDragging ? (
        <div className="drop-overlay" role="status">
          <div>
            <span aria-hidden="true">↓</span>
            <strong>松开即可打开数据集</strong>
            <p>支持 JSON、JSONL 与 NDJSON，最大 20 MB</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
