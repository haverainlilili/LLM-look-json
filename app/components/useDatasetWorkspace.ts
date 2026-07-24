"use client";

import { useRef, useState } from "react";

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
import { MAX_LAYOUT_GUIDANCE_LENGTH } from "../lib/analysis-guidance.ts";
import { parseBlueprint, createLocalBlueprint, type LayoutBlueprint } from "../lib/blueprint.ts";
import {
  createModelSamples,
  inferSchema,
  parseDatasetText,
  type DatasetFormat,
  type JsonRecord,
  type SchemaField,
} from "../lib/dataset.ts";
import {
  fetchDatasetFromAddress,
  MAX_DATASET_FILE_BYTES,
} from "../lib/dataset-source.ts";
import {
  activateSession,
  addSession,
  closeSession,
  createSessionState,
  updateSession,
  type SessionState,
} from "../lib/dataset-sessions.ts";
import { SAMPLE_FILE_NAME, SAMPLE_RECORDS } from "../lib/sample-data.ts";
import type { ViewKind } from "./DatasetCanvas";

export interface WorkspaceData {
  fileName: string;
  format: DatasetFormat;
  recordPath: string;
  records: JsonRecord[];
  schema: SchemaField[];
  blueprint: LayoutBlueprint;
}

export interface DatasetSession {
  workspace: WorkspaceData;
  query: string;
  activeIndex: number;
  viewKind: ViewKind;
  source: "local" | "model";
  layoutGuidance: string;
  analysisFlow: AnalysisFlow;
  tablePageSize: number;
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

function createDatasetSession(workspace: WorkspaceData): DatasetSession {
  return {
    workspace,
    query: "",
    activeIndex: 0,
    viewKind: workspace.blueprint.kind,
    source: "local",
    layoutGuidance: "",
    analysisFlow: createIdleAnalysisFlow(),
    tablePageSize: 25,
  };
}

function initialSessions(): SessionState<DatasetSession> {
  return createSessionState({ id: "sample", value: createDatasetSession(initialWorkspace()) });
}

export function useDatasetWorkspace() {
  const [sessions, setSessions] = useState<SessionState<DatasetSession>>(initialSessions);
  const [notice, setNotice] = useState("已载入示例数据；打开或拖入文件即可新增标签。");
  const [noticeTone, setNoticeTone] = useState<"neutral" | "success" | "error">("neutral");
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(() => new Set());
  const analyzingIdsRef = useRef(new Set<string>());
  const sessionSequence = useRef(1);

  const activeTab = sessions.tabs.find((tab) => tab.id === sessions.activeId) ?? sessions.tabs[0];
  const activeSession = activeTab.value;

  function updateDatasetSession(
    id: string,
    update: (session: DatasetSession) => DatasetSession,
  ) {
    setSessions((current) => updateSession(current, id, update));
  }

  function updateActiveSession(update: (session: DatasetSession) => DatasetSession) {
    updateDatasetSession(activeTab.id, update);
  }

  function applyDatasetText(text: string, fileName: string, sourceLabel: string) {
    const parsed = parseDatasetText(text, fileName);
    const schema = inferSchema(parsed.records);
    const blueprint = createLocalBlueprint(fileName, schema, parsed.records);
    const id = `dataset-${sessionSequence.current}`;
    sessionSequence.current += 1;
    setSessions((current) => addSession(current, {
      id,
      value: createDatasetSession({
        fileName,
        format: parsed.format,
        recordPath: parsed.recordPath,
        records: parsed.records,
        schema,
        blueprint,
      }),
    }));
    setNotice(
      `${sourceLabel}解析 ${parsed.records.length.toLocaleString("zh-CN")} 条记录，已新增标签。`,
    );
    setNoticeTone("success");
  }

  async function loadFile(file: File) {
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".json") && !lowerName.endsWith(".jsonl") && !lowerName.endsWith(".ndjson")) {
      setNotice("请选择 .json、.jsonl 或 .ndjson 文件。");
      setNoticeTone("error");
      return;
    }
    if (file.size > MAX_DATASET_FILE_BYTES) {
      setNotice("首版浏览器支持最大 20 MB 文件；更大的数据建议先转换为抽样 JSONL。");
      setNoticeTone("error");
      return;
    }

    try {
      applyDatasetText(await file.text(), file.name, "已在本机");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "无法读取这个文件。");
      setNoticeTone("error");
    }
  }

  async function loadAddress(address: string): Promise<void> {
    setNotice("正在从文件地址读取 JSON…");
    setNoticeTone("neutral");

    try {
      const dataset = await fetchDatasetFromAddress(address);
      applyDatasetText(dataset.text, dataset.fileName, "已从文件地址读取并");
    } catch (caught) {
      const error = caught instanceof Error ? caught : new Error("无法读取这个文件地址。");
      setNotice(error.message);
      setNoticeTone("error");
      throw error;
    }
  }

  function activateDataset(id: string) {
    const target = sessions.tabs.find((tab) => tab.id === id);
    if (!target || id === sessions.activeId) return;
    setSessions((current) => activateSession(current, id));
    setNotice(`已切换到 ${target.value.workspace.fileName}。`);
    setNoticeTone("neutral");
  }

  function closeDataset(id: string) {
    const target = sessions.tabs.find((tab) => tab.id === id);
    if (!target || sessions.tabs.length === 1 || analyzingIdsRef.current.has(id)) return;
    setSessions((current) => closeSession(current, id));
    setNotice(`已关闭 ${target.value.workspace.fileName}。`);
    setNoticeTone("neutral");
  }

  async function analyzeWithModel() {
    const sessionId = activeTab.id;
    const session = activeTab.value;
    if (analyzingIdsRef.current.has(sessionId)) return;
    const samples = createModelSamples(session.workspace.records);
    let recordedFailure = false;
    const recordFailure = (stage: AnalysisStage, detail: string) => {
      recordedFailure = true;
      updateDatasetSession(sessionId, (current) => ({
        ...current,
        analysisFlow: failAnalysisFlow(stage, detail),
      }));
    };

    analyzingIdsRef.current.add(sessionId);
    setAnalyzingIds(new Set(analyzingIdsRef.current));
    updateDatasetSession(sessionId, (current) => ({
      ...current,
      analysisFlow: startAnalysisFlow(session.workspace.schema.length, samples.length),
    }));
    setNotice(
      session.layoutGuidance.trim()
        ? `${session.workspace.fileName}：MING 正在根据展示指导分析…`
        : `${session.workspace.fileName}：MING 正在分析 Schema 与少量截断样本…`,
    );
    setNoticeTone("neutral");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: session.workspace.fileName,
          schema: session.workspace.schema.slice(0, 120),
          samples,
          layoutGuidance: session.layoutGuidance.slice(0, MAX_LAYOUT_GUIDANCE_LENGTH),
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
          session.workspace.schema,
        );
      } catch {
        recordFailure("apply", "浏览器未能把已验证的蓝图应用到当前 Schema。");
        throw new Error("布局无法应用到当前数据集。");
      }
      updateDatasetSession(sessionId, (current) => ({
        ...current,
        workspace: { ...current.workspace, blueprint },
        viewKind: blueprint.kind,
        source: "model",
        analysisFlow: completeAnalysisFlow(parseAnalysisTrace(payload) ?? undefined),
      }));
      setNotice(`${session.workspace.fileName}：MING 布局已通过安全校验并应用。`);
      setNoticeTone("success");
    } catch (caught) {
      if (!recordedFailure) {
        recordFailure("provider", "浏览器无法完成请求，请检查本地服务和网络连接。");
      }
      setNotice(
        caught instanceof Error
          ? `${session.workspace.fileName}：${caught.message} 已保留本地布局。`
          : `${session.workspace.fileName}：模型分析失败，已保留本地布局。`,
      );
      setNoticeTone("error");
    } finally {
      analyzingIdsRef.current.delete(sessionId);
      setAnalyzingIds(new Set(analyzingIdsRef.current));
    }
  }

  return {
    activeId: activeTab.id,
    activeSession,
    tabs: sessions.tabs.map((tab) => ({
      id: tab.id,
      fileName: tab.value.workspace.fileName,
      recordCount: tab.value.workspace.records.length,
      isAnalyzing: analyzingIds.has(tab.id),
    })),
    notice,
    noticeTone,
    isAnalyzing: analyzingIds.has(activeTab.id),
    loadFile,
    loadAddress,
    activateDataset,
    closeDataset,
    analyzeWithModel,
    updateQuery: (query: string) => updateActiveSession((current) => ({
      ...current,
      query,
      activeIndex: 0,
    })),
    updateViewKind: (viewKind: ViewKind) => updateActiveSession((current) => ({
      ...current,
      viewKind,
    })),
    updateActiveIndex: (activeIndex: number) => updateActiveSession((current) => ({
      ...current,
      activeIndex,
    })),
    updateTablePageSize: (tablePageSize: number) => updateActiveSession((current) => ({
      ...current,
      tablePageSize,
      activeIndex: 0,
    })),
    updateLayoutGuidance: (layoutGuidance: string) => updateActiveSession((current) => ({
      ...current,
      layoutGuidance,
    })),
  };
}
