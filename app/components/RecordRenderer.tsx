import type { LayoutBlueprint, LayoutKind } from "../lib/blueprint.ts";
import { getValueAtPath, type JsonRecord } from "../lib/dataset.ts";

interface RecordRendererProps {
  blueprint: LayoutBlueprint;
  kind: LayoutKind | "raw";
  record: JsonRecord;
}

function readable(value: unknown): string {
  if (value === undefined) return "未提供";
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

function roleName(role: unknown): string {
  const value = String(role ?? "unknown").toLowerCase();
  if (["user", "human"].includes(value)) return "用户";
  if (["assistant", "gpt", "bot"].includes(value)) return "助手";
  if (value === "system") return "系统";
  return String(role ?? "消息");
}

function messageContent(message: Record<string, unknown>): string {
  return readable(message.content ?? message.text ?? message.value ?? message.message);
}

function ConversationView({ blueprint, record }: Omit<RecordRendererProps, "kind">) {
  const messageField = blueprint.fields.find((field) => field.role === "messages");
  const value = messageField ? getValueAtPath(record, messageField.path) : undefined;
  const messages = Array.isArray(value) ? value : [];

  if (messages.length === 0) {
    return <GenericCard blueprint={blueprint} record={record} />;
  }

  return (
    <div className="conversation-view">
      {messages.map((message, index) => {
        const item: Record<string, unknown> =
          typeof message === "object" && message !== null
            ? (message as Record<string, unknown>)
            : { content: message };
        const role = String(item.role ?? item.from ?? "message").toLowerCase();
        return (
          <article className={`message message-${role}`} key={`${role}-${index}`}>
            <header>
              <span className="message-avatar" aria-hidden="true">
                {roleName(role).slice(0, 1)}
              </span>
              <strong>{roleName(role)}</strong>
              <span>#{index + 1}</span>
            </header>
            <p>{messageContent(item)}</p>
          </article>
        );
      })}
    </div>
  );
}

function ComparisonView({ blueprint, record }: Omit<RecordRendererProps, "kind">) {
  const prompt = blueprint.fields.find((field) => field.role === "title");
  const chosen = blueprint.fields.find((field) => field.role === "chosen");
  const rejected = blueprint.fields.find((field) => field.role === "rejected");

  return (
    <div className="comparison-view">
      {prompt ? (
        <section className="prompt-block">
          <span>{prompt.label}</span>
          <p>{readable(getValueAtPath(record, prompt.path))}</p>
        </section>
      ) : null}
      <div className="comparison-columns">
        <section className="comparison-choice chosen-choice">
          <header>
            <span aria-hidden="true">✓</span>
            <h3>{chosen?.label ?? "优选回答"}</h3>
          </header>
          <p>{readable(chosen ? getValueAtPath(record, chosen.path) : undefined)}</p>
        </section>
        <section className="comparison-choice rejected-choice">
          <header>
            <span aria-hidden="true">×</span>
            <h3>{rejected?.label ?? "对照回答"}</h3>
          </header>
          <p>{readable(rejected ? getValueAtPath(record, rejected.path) : undefined)}</p>
        </section>
      </div>
    </div>
  );
}

function GalleryView({ blueprint, record }: Omit<RecordRendererProps, "kind">) {
  const media = blueprint.fields.find((field) => field.role === "media");
  const textFields = blueprint.fields.filter((field) => field.role !== "media");

  return (
    <div className="gallery-view">
      <div className="media-reference">
        <span className="media-glyph" aria-hidden="true">◫</span>
        <p>媒体引用</p>
        <code>{readable(media ? getValueAtPath(record, media.path) : undefined)}</code>
        <small>出于隐私考虑，外部地址不会自动请求</small>
      </div>
      <div className="gallery-copy">
        {textFields.map((field) => (
          <section key={field.path}>
            <span>{field.label}</span>
            <p>{readable(getValueAtPath(record, field.path))}</p>
          </section>
        ))}
      </div>
    </div>
  );
}

function GenericCard({ blueprint, record }: Omit<RecordRendererProps, "kind">) {
  return (
    <div className="record-card-view">
      {blueprint.fields.map((field) => {
        const value = getValueAtPath(record, field.path);
        return (
          <section className={`record-field field-${field.role}`} key={`${field.path}-${field.role}`}>
            <span>{field.label}</span>
            {field.role === "badge" ? (
              <strong className="value-badge">{readable(value)}</strong>
            ) : (
              <p>{readable(value)}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function RecordRenderer({ blueprint, kind, record }: RecordRendererProps) {
  if (kind === "raw") {
    return <pre className="raw-record">{JSON.stringify(record, null, 2)}</pre>;
  }
  if (kind === "conversation") {
    return <ConversationView blueprint={blueprint} record={record} />;
  }
  if (kind === "comparison") {
    return <ComparisonView blueprint={blueprint} record={record} />;
  }
  if (kind === "gallery") {
    return <GalleryView blueprint={blueprint} record={record} />;
  }
  return <GenericCard blueprint={blueprint} record={record} />;
}
