import type { SchemaField } from "../lib/dataset.ts";

interface SchemaPanelProps {
  schema: SchemaField[];
  recordPath: string;
  recordCount: number;
  format: string;
}

const TYPE_LABELS: Record<string, string> = {
  string: "文本",
  integer: "整数",
  number: "数值",
  boolean: "布尔",
  array: "数组",
  object: "对象",
  null: "空值",
};

function typeLabel(type: string): string {
  return type
    .split(" | ")
    .map((item) => TYPE_LABELS[item] ?? item)
    .join(" / ");
}

export function SchemaPanel({ schema, recordPath, recordCount, format }: SchemaPanelProps) {
  return (
    <aside className="schema-panel" aria-labelledby="schema-heading">
      <div className="panel-heading-row">
        <div>
          <p className="eyebrow">结构</p>
          <h2 id="schema-heading">Schema</h2>
        </div>
        <span className="count-pill">{schema.length}</span>
      </div>

      <dl className="dataset-facts">
        <div>
          <dt>记录</dt>
          <dd>{recordCount.toLocaleString("zh-CN")}</dd>
        </div>
        <div>
          <dt>格式</dt>
          <dd>{format.toUpperCase()}</dd>
        </div>
      </dl>

      <div className="path-block">
        <span>记录路径</span>
        <code>{recordPath}</code>
      </div>

      <div className="schema-list">
        {schema.map((field) => (
          <article className="schema-field" key={field.path}>
            <div className="schema-field-topline">
              <code title={field.path}>{field.path}</code>
              <span>{typeLabel(field.type)}</span>
            </div>
            <p title={field.sample}>{field.sample || "—"}</p>
            <div className="presence-row">
              <progress value={field.presence} max={1} aria-label={`${field.path} 出现率`} />
              <span>{Math.round(field.presence * 100)}%</span>
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}
