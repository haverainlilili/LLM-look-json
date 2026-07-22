export type AnalysisStage = "prepare" | "provider" | "validation" | "apply";
export type AnalysisStepStatus = "pending" | "active" | "complete" | "error";

export interface AnalysisStep {
  id: AnalysisStage;
  label: string;
  status: AnalysisStepStatus;
  detail: string;
}

export interface AnalysisFlow {
  status: "idle" | "running" | "success" | "error";
  steps: AnalysisStep[];
}

export interface AnalysisFailure {
  code: string;
  message: string;
  stage: AnalysisStage;
  detail: string;
}

const STEP_LABELS: Record<AnalysisStage, string> = {
  prepare: "准备摘要",
  provider: "调用 MING",
  validation: "安全校验",
  apply: "应用布局",
};

const STAGES = Object.keys(STEP_LABELS) as AnalysisStage[];

function stepsWithStatus(
  statuses: AnalysisStepStatus[],
  details: Partial<Record<AnalysisStage, string>> = {},
): AnalysisStep[] {
  return STAGES.map((id, index) => ({
    id,
    label: STEP_LABELS[id],
    status: statuses[index],
    detail: details[id] ?? "等待前一步完成",
  }));
}

export function createIdleAnalysisFlow(): AnalysisFlow {
  return {
    status: "idle",
    steps: stepsWithStatus(["pending", "pending", "pending", "pending"], {
      prepare: "点击“MING 重组布局”后开始",
    }),
  };
}

export function startAnalysisFlow(schemaCount: number, sampleCount: number): AnalysisFlow {
  return {
    status: "running",
    steps: stepsWithStatus(["complete", "active", "pending", "pending"], {
      prepare: `已整理 ${schemaCount} 个字段和 ${sampleCount} 条样本`,
      provider: "正在等待模型返回布局蓝图",
    }),
  };
}

export function completeAnalysisFlow(trace?: {
  providerStatus?: number;
  durationMs?: number;
}): AnalysisFlow {
  const status = Number.isInteger(trace?.providerStatus) ? trace?.providerStatus : 200;
  const duration = Number.isFinite(trace?.durationMs)
    ? ` · ${Math.max(0, Math.round(trace?.durationMs ?? 0))} ms`
    : "";
  return {
    status: "success",
    steps: stepsWithStatus(["complete", "complete", "complete", "complete"], {
      prepare: "Schema 与样本摘要已准备",
      provider: `模型返回 HTTP ${status}${duration}`,
      validation: "布局蓝图通过字段与视图白名单",
      apply: "新布局已应用，原始数据未改动",
    }),
  };
}

export function failAnalysisFlow(stage: AnalysisStage, detail: string): AnalysisFlow {
  const failedIndex = STAGES.indexOf(stage);
  return {
    status: "error",
    steps: stepsWithStatus(
      STAGES.map((_, index) =>
        index < failedIndex ? "complete" : index === failedIndex ? "error" : "pending",
      ),
      { [stage]: detail.slice(0, 240) },
    ),
  };
}

function boundedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > maxLength || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) {
    return null;
  }
  return text;
}

export function parseAnalysisFailure(value: unknown): AnalysisFailure | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const error = (value as Record<string, unknown>).error;
  if (typeof error !== "object" || error === null || Array.isArray(error)) return null;
  const raw = error as Record<string, unknown>;
  const code = boundedText(raw.code, 64);
  const message = boundedText(raw.message, 180);
  const detail = boundedText(raw.detail, 240);
  if (
    !code ||
    !/^[A-Z][A-Z0-9_]+$/.test(code) ||
    !message ||
    !detail ||
    typeof raw.stage !== "string" ||
    !STAGES.includes(raw.stage as AnalysisStage)
  ) {
    return null;
  }
  return { code, message, detail, stage: raw.stage as AnalysisStage };
}

export function parseAnalysisTrace(value: unknown): {
  providerStatus: number;
  durationMs: number;
} | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const meta = (value as Record<string, unknown>).meta;
  if (typeof meta !== "object" || meta === null || Array.isArray(meta)) return null;
  const trace = (meta as Record<string, unknown>).trace;
  if (typeof trace !== "object" || trace === null || Array.isArray(trace)) return null;
  const raw = trace as Record<string, unknown>;
  if (
    !Number.isInteger(raw.providerStatus) ||
    (raw.providerStatus as number) < 100 ||
    (raw.providerStatus as number) > 599 ||
    typeof raw.durationMs !== "number" ||
    !Number.isFinite(raw.durationMs) ||
    raw.durationMs < 0 ||
    raw.durationMs > 120_000
  ) {
    return null;
  }
  return {
    providerStatus: raw.providerStatus as number,
    durationMs: raw.durationMs,
  };
}
