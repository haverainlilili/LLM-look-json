import type { AnalysisFlow, AnalysisStepStatus } from "../lib/analysis-flow.ts";

interface AnalysisProcessProps {
  flow: AnalysisFlow;
}

const FLOW_LABELS: Record<AnalysisFlow["status"], string> = {
  idle: "未运行",
  running: "进行中",
  success: "已完成",
  error: "有错误",
};

const STEP_LABELS: Record<AnalysisStepStatus, string> = {
  pending: "等待",
  active: "进行中",
  complete: "完成",
  error: "失败",
};

export function AnalysisProcess({ flow }: AnalysisProcessProps) {
  return (
    <details
      className={`analysis-process flow-${flow.status}`}
      open={flow.status === "running" || flow.status === "error"}
    >
      <summary>
        <span aria-hidden="true">⌁</span>
        <strong>MING 分析流程</strong>
        <small>{FLOW_LABELS[flow.status]}</small>
      </summary>
      <div className="analysis-process-popover" aria-live="polite">
        <div className="process-heading">
          <div>
            <p className="eyebrow">最近一次请求</p>
            <h2>布局分析进度</h2>
          </div>
          <span className={`process-result result-${flow.status}`}>
            {FLOW_LABELS[flow.status]}
          </span>
        </div>
        <ol className="process-steps">
          {flow.steps.map((step, index) => (
            <li className={`step-${step.status}`} key={step.id}>
              <span className="process-marker" aria-hidden="true">
                {step.status === "complete" ? "✓" : step.status === "error" ? "!" : index + 1}
              </span>
              <div>
                <strong>{step.label}</strong>
                <p>{step.detail}</p>
              </div>
              <small>{STEP_LABELS[step.status]}</small>
            </li>
          ))}
        </ol>
        <p className="process-privacy">
          只显示脱敏诊断；不会展示 API Key、提示词或模型原始输出。
        </p>
      </div>
    </details>
  );
}
