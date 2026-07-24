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
import {
  compareSchemaStructure,
  type SchemaDifference,
} from "../lib/schema-diff.ts";
import type { ViewKind } from "./DatasetCanvas";

export type DatasetOrigin =
  | { kind: "sample" }
  | { kind: "file" }
  | { kind: "address"; address: string };

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
  origin: DatasetOrigin;
}

export interface PendingSchemaChange {
  sessionId: string;
  workspace: WorkspaceData;
  origin: DatasetOrigin;
  difference: SchemaDifference;
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

function workspaceFromText(text: string, fileName: string): WorkspaceData {
  const parsed = parseDatasetText(text, fileName);
  const schema = inferSchema(parsed.records);
  return {
    fileName,
    format: parsed.format,
    recordPath: parsed.recordPath,
    records: parsed.records,
    schema,
    blueprint: createLocalBlueprint(fileName, schema, parsed.records),
  };
}

function fileValidationMessage(file: File): string | null {
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith(".json") && !lowerName.endsWith(".jsonl") && !lowerName.endsWith(".ndjson")) {
    return "请选择 .json、.jsonl 或 .ndjson 文件。";
  }
  if (file.size > MAX_DATASET_FILE_BYTES) {
    return "首版浏览器支持最大 20 MB 文件；更大的数据建议先转换为抽样 JSONL。";
  }
  return null;
}

function createDatasetSession(
  workspace: WorkspaceData,
  origin: DatasetOrigin,
): DatasetSession {
  return {
    workspace,
    query: "",
    activeIndex: 0,
    viewKind: workspace.blueprint.kind,
    source: "local",
    layoutGuidance: "",
    analysisFlow: createIdleAnalysisFlow(),
    tablePageSize: 25,
    origin,
  };
}

function initialSessions(): SessionState<DatasetSession> {
  return createSessionState({
    id: "sample",
    value: createDatasetSession(initialWorkspace(), { kind: "sample" }),
  });
}

export function useDatasetWorkspace() {
  const [sessions, setSessions] = useState<SessionState<DatasetSession>>(initialSessions);
  const [notice, setNotice] = useState("已载入示例数据；打开或拖入文件即可新增标签。");
  const [noticeTone, setNoticeTone] = useState<"neutral" | "success" | "error">("neutral");
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(() => new Set());
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(() => new Set());
  const [pendingSchemaChange, setPendingSchemaChange] = useState<PendingSchemaChange | null>(null);
  const analyzingIdsRef = useRef(new Set<string>());
  const refreshingIdsRef = useRef(new Set<string>());
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

  function applyDatasetText(
    text: string,
    fileName: string,
    sourceLabel: string,
    origin: DatasetOrigin,
  ) {
    const workspace = workspaceFromText(text, fileName);
    const id = `dataset-${sessionSequence.current}`;
    sessionSequence.current += 1;
    setSessions((current) => addSession(current, {
      id,
      value: createDatasetSession(workspace, origin),
    }));
    setNotice(
      `${sourceLabel}解析 ${workspace.records.length.toLocaleString("zh-CN")} 条记录，已新增标签。`,
    );
    setNoticeTone("success");
  }

  async function loadFile(file: File) {
    const validationMessage = fileValidationMessage(file);
    if (validationMessage) {
      setNotice(validationMessage);
      setNoticeTone("error");
      return;
    }

    try {
      applyDatasetText(await file.text(), file.name, "已在本机", { kind: "file" });
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
      applyDatasetText(dataset.text, dataset.fileName, "已从文件地址读取并", {
        kind: "address",
        address: address.trim(),
      });
    } catch (caught) {
      const error = caught instanceof Error ? caught : new Error("无法读取这个文件地址。");
      setNotice(error.message);
      setNoticeTone("error");
      throw error;
    }
  }

  function applyRefreshedWorkspace(
    sessionId: string,
    previous: DatasetSession,
    workspace: WorkspaceData,
    origin: DatasetOrigin,
  ) {
    const difference = compareSchemaStructure(previous.workspace.schema, workspace.schema);
    if (difference.changed) {
      setPendingSchemaChange({ sessionId, workspace, origin, difference });
      setNotice(`${workspace.fileName} 的数据结构发生变化，请确认是否重建模板。`);
      setNoticeTone("error");
      return;
    }

    updateDatasetSession(sessionId, (current) => ({
      ...current,
      workspace: {
        ...workspace,
        blueprint: {
          ...current.workspace.blueprint,
          description: workspace.blueprint.description,
        },
      },
      origin,
      activeIndex: 0,
    }));
    setNotice(
      `${workspace.fileName} 已刷新 ${workspace.records.length.toLocaleString("zh-CN")} 条记录，并保留当前模板。`,
    );
    setNoticeTone("success");
  }

  async function refreshActiveDataset(file?: File) {
    const sessionId = activeTab.id;
    const session = activeTab.value;
    if (session.origin.kind === "sample") {
      setNotice("示例数据无需刷新；请先打开自己的数据集。");
      setNoticeTone("neutral");
      return;
    }
    if (
      analyzingIdsRef.current.has(sessionId) ||
      refreshingIdsRef.current.has(sessionId)
    ) {
      return;
    }

    if (session.origin.kind === "file") {
      if (!file) {
        setNotice("请重新选择修改后的本地文件。");
        setNoticeTone("neutral");
        return;
      }
      const validationMessage = fileValidationMessage(file);
      if (validationMessage) {
        setNotice(validationMessage);
        setNoticeTone("error");
        return;
      }
    }

    refreshingIdsRef.current.add(sessionId);
    setRefreshingIds(new Set(refreshingIdsRef.current));
    setNotice(`${session.workspace.fileName}：正在检查最新数据与 Schema…`);
    setNoticeTone("neutral");

    try {
      if (session.origin.kind === "address") {
        const refreshed = await fetchDatasetFromAddress(session.origin.address);
        applyRefreshedWorkspace(
          sessionId,
          session,
          workspaceFromText(refreshed.text, refreshed.fileName),
          session.origin,
        );
      } else if (file) {
        applyRefreshedWorkspace(
          sessionId,
          session,
          workspaceFromText(await file.text(), file.name),
          { kind: "file" },
        );
      }
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "无法刷新这个数据集。");
      setNoticeTone("error");
    } finally {
      refreshingIdsRef.current.delete(sessionId);
      setRefreshingIds(new Set(refreshingIdsRef.current));
    }
  }

  function cancelSchemaRefresh() {
    if (!pendingSchemaChange) return;
    setNotice(`${pendingSchemaChange.workspace.fileName}：已取消刷新，当前数据保持不变。`);
    setNoticeTone("neutral");
    setPendingSchemaChange(null);
  }

  function confirmSchemaRefresh() {
    if (!pendingSchemaChange) return;
    const { sessionId, workspace, origin } = pendingSchemaChange;
    updateDatasetSession(sessionId, (current) => ({
      ...current,
      workspace,
      origin,
      query: "",
      activeIndex: 0,
      viewKind: workspace.blueprint.kind,
      source: "local",
      analysisFlow: createIdleAnalysisFlow(),
    }));
    setNotice(`${workspace.fileName}：已按新结构重建本地模板并完成刷新。`);
    setNoticeTone("success");
    setPendingSchemaChange(null);
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
    if (
      !target ||
      sessions.tabs.length === 1 ||
      analyzingIdsRef.current.has(id) ||
      refreshingIdsRef.current.has(id) ||
      pendingSchemaChange?.sessionId === id
    ) {
      return;
    }
    setSessions((current) => closeSession(current, id));
    setNotice(`已关闭 ${target.value.workspace.fileName}。`);
    setNoticeTone("neutral");
  }

  async function analyzeWithModel() {
    const sessionId = activeTab.id;
    const session = activeTab.value;
    if (
      analyzingIdsRef.current.has(sessionId) ||
      refreshingIdsRef.current.has(sessionId)
    ) {
      return;
    }
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
      isRefreshing: refreshingIds.has(tab.id),
    })),
    notice,
    noticeTone,
    isAnalyzing: analyzingIds.has(activeTab.id),
    isRefreshing: refreshingIds.has(activeTab.id),
    canRefresh: activeSession.origin.kind !== "sample",
    refreshRequiresFile: activeSession.origin.kind === "file",
    refreshHint:
      activeSession.origin.kind === "sample"
        ? "示例数据无需刷新"
        : activeSession.origin.kind === "file"
          ? "重新选择修改后的本地文件"
          : "从原文件地址重新读取",
    pendingSchemaChange,
    loadFile,
    loadAddress,
    refreshActiveDataset,
    cancelSchemaRefresh,
    confirmSchemaRefresh,
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
