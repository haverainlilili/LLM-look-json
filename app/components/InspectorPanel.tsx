"use client";

import { useState } from "react";

import type { LayoutBlueprint } from "../lib/blueprint.ts";
import type { JsonRecord } from "../lib/dataset.ts";

interface InspectorPanelProps {
  blueprint: LayoutBlueprint;
  record?: JsonRecord;
  source: "local" | "model";
}

export function InspectorPanel({ blueprint, record, source }: InspectorPanelProps) {
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
              <p>MING 分析只发送 Schema 与最多 5 条截断样本。</p>
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
