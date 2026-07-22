"use client";

import { useState } from "react";

import type { LayoutBlueprint } from "../lib/blueprint.ts";
import type { JsonRecord } from "../lib/dataset.ts";
import { MAX_LAYOUT_GUIDANCE_LENGTH } from "../lib/analysis-guidance.ts";

interface InspectorPanelProps {
  blueprint: LayoutBlueprint;
  record?: JsonRecord;
  source: "local" | "model";
  layoutGuidance: string;
  isAnalyzing: boolean;
  onLayoutGuidanceChange: (guidance: string) => void;
}

export function InspectorPanel({
  blueprint,
  record,
  source,
  layoutGuidance,
  isAnalyzing,
  onLayoutGuidanceChange,
}: InspectorPanelProps) {
  const [tab, setTab] = useState<"blueprint" | "raw">("blueprint");

  return (
    <aside className="inspector-panel" aria-labelledby="inspector-heading">
      <div className="inspector-tabs" role="tablist" aria-label="数据检查器">
        <button
          id="blueprint-tab"
          role="tab"
          type="button"
          aria-selected={tab === "blueprint"}
          aria-controls="blueprint-panel"
          onClick={() => setTab("blueprint")}
        >
          布局蓝图
        </button>
        <button
          id="raw-tab"
          role="tab"
          type="button"
          aria-selected={tab === "raw"}
          aria-controls="raw-panel"
          onClick={() => setTab("raw")}
        >
          当前 JSON
        </button>
      </div>

      <section className="model-guidance" aria-labelledby="model-guidance-heading">
        <div className="model-guidance-heading">
          <div>
            <p className="eyebrow">MING 输入</p>
            <h2 id="model-guidance-heading">展示指导</h2>
          </div>
          <span aria-label={`已输入 ${layoutGuidance.length} 字`}>
            {layoutGuidance.length} / {MAX_LAYOUT_GUIDANCE_LENGTH}
          </span>
        </div>
        <label className="visually-hidden" htmlFor="layout-guidance">
          指导 MING 如何拆析和展示数据集
        </label>
        <textarea
          id="layout-guidance"
          value={layoutGuidance}
          maxLength={MAX_LAYOUT_GUIDANCE_LENGTH}
          rows={5}
          disabled={isAnalyzing}
          aria-describedby="model-guidance-help"
          placeholder="例如：优先展示 prompt 和 response；按 score 分组；隐藏技术字段。"
          onChange={(event) => onLayoutGuidanceChange(event.target.value)}
        />
        <p id="model-guidance-help">
          点击“MING 重组布局”时一并发送。它只影响展示偏好，不能绕过安全规则。
        </p>
      </section>

      {tab === "blueprint" ? (
        <div id="blueprint-panel" role="tabpanel" aria-labelledby="blueprint-tab">
          <div className="panel-heading-row inspector-title">
            <div>
              <p className="eyebrow">决策依据</p>
              <h2 id="inspector-heading">为什么这样展示</h2>
            </div>
            <span className={`source-chip source-${source}`}>
              {source === "model" ? "MING" : "LOCAL"}
            </span>
          </div>
          <p className="rationale">{blueprint.rationale}</p>

          <div className="blueprint-kind">
            <span>主视图</span>
            <strong>{blueprint.kind}</strong>
          </div>

          <div className="mapping-list">
            <p className="section-label">字段映射</p>
            {blueprint.fields.map((field) => (
              <div key={`${field.path}-${field.role}`}>
                <span>{field.label}</span>
                <code>{field.path}</code>
                <small>{field.role}</small>
              </div>
            ))}
          </div>

          <div className="privacy-note">
            <span aria-hidden="true">⌂</span>
            <div>
              <strong>数据默认留在本机</strong>
              <p>MING 分析只发送 Schema、最多 5 条截断样本及你填写的展示指导。</p>
            </div>
          </div>
        </div>
      ) : (
        <div id="raw-panel" role="tabpanel" aria-labelledby="raw-tab">
          <div className="raw-heading">
            <p className="eyebrow">原始记录</p>
            <h2 id="inspector-heading">当前 JSON</h2>
          </div>
          <pre className="inspector-raw">{record ? JSON.stringify(record, null, 2) : "没有匹配记录"}</pre>
        </div>
      )}
    </aside>
  );
}
