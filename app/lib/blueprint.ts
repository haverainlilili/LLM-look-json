import { getValueAtPath, type JsonRecord, type SchemaField } from "./dataset.ts";

export const LAYOUT_KINDS = [
  "conversation",
  "comparison",
  "gallery",
  "table",
  "cards",
] as const;

export const FIELD_ROLES = [
  "title",
  "subtitle",
  "body",
  "badge",
  "media",
  "meta",
  "messages",
  "chosen",
  "rejected",
] as const;

export type LayoutKind = (typeof LAYOUT_KINDS)[number];
export type FieldRole = (typeof FIELD_ROLES)[number];

export interface LayoutField {
  path: string;
  label: string;
  role: FieldRole;
}

export interface LayoutBlueprint {
  version: 1;
  title: string;
  description: string;
  kind: LayoutKind;
  fields: LayoutField[];
  rationale: string;
}

const kindSet = new Set<string>(LAYOUT_KINDS);
const roleSet = new Set<string>(FIELD_ROLES);

const LABELS: Record<string, string> = {
  id: "编号",
  title: "标题",
  prompt: "提示词",
  instruction: "指令",
  input: "输入",
  output: "输出",
  answer: "回答",
  response: "回答",
  text: "文本",
  content: "内容",
  messages: "对话",
  chosen: "优选回答",
  rejected: "对照回答",
  label: "标签",
  score: "分数",
  image: "图像",
  image_url: "图像",
  caption: "说明",
};

function topLevelFields(schema: SchemaField[]): SchemaField[] {
  return schema.filter((field) => field.depth === 0);
}

function findPath(schema: SchemaField[], names: string[]): string | undefined {
  const lowered = names.map((name) => name.toLowerCase());
  return topLevelFields(schema).find((field) => {
    const key = field.path.toLowerCase();
    return lowered.includes(key) || lowered.some((name) => key.endsWith(`_${name}`));
  })?.path;
}

function field(path: string, role: FieldRole): LayoutField {
  const key = path.split(".").at(-1)?.replace(/\[\]/g, "") ?? path;
  return { path, role, label: LABELS[key.toLowerCase()] ?? key };
}

function hasMessageShape(records: JsonRecord[], path: string): boolean {
  return records.slice(0, 8).some((record) => {
    const value = getValueAtPath(record, path);
    return (
      Array.isArray(value) &&
      value.some(
        (message) =>
          typeof message === "object" &&
          message !== null &&
          "role" in message &&
          ("content" in message || "text" in message || "value" in message),
      )
    );
  });
}

export function createLocalBlueprint(
  fileName: string,
  schema: SchemaField[],
  records: JsonRecord[],
): LayoutBlueprint {
  const messagePath = findPath(schema, ["messages", "conversation", "conversations"]);
  const chosenPath = findPath(schema, ["chosen", "preferred", "accepted"]);
  const rejectedPath = findPath(schema, ["rejected", "dispreferred", "rejected_answer"]);
  const mediaPath = findPath(schema, ["image", "image_url", "media", "thumbnail"]);
  const titlePath = findPath(schema, ["title", "name", "prompt", "instruction", "question"]);
  const bodyPath = findPath(schema, ["text", "content", "output", "answer", "response", "caption"]);
  const idPath = findPath(schema, ["id", "uuid", "key"]);

  if (messagePath && hasMessageShape(records, messagePath)) {
    return {
      version: 1,
      title: "对话数据集",
      description: `${fileName} · ${records.length.toLocaleString("zh-CN")} 条记录`,
      kind: "conversation",
      fields: [
        ...(idPath ? [field(idPath, "meta")] : []),
        field(messagePath, "messages"),
      ],
      rationale: "检测到带有角色和内容字段的消息序列，使用对话视图更容易审阅轮次与回答。",
    };
  }

  if (chosenPath && rejectedPath) {
    return {
      version: 1,
      title: "偏好对比数据集",
      description: `${fileName} · ${records.length.toLocaleString("zh-CN")} 组比较`,
      kind: "comparison",
      fields: [
        ...(titlePath ? [field(titlePath, "title")] : []),
        field(chosenPath, "chosen"),
        field(rejectedPath, "rejected"),
      ],
      rationale: "检测到优选与对照回答字段，采用并排比较以突出质量差异。",
    };
  }

  if (mediaPath) {
    return {
      version: 1,
      title: "多媒体数据集",
      description: `${fileName} · ${records.length.toLocaleString("zh-CN")} 条记录`,
      kind: "gallery",
      fields: [
        field(mediaPath, "media"),
        ...(titlePath ? [field(titlePath, "title")] : []),
        ...(bodyPath ? [field(bodyPath, "body")] : []),
      ],
      rationale: "检测到媒体引用，将媒体位置与主要文本组合展示；外部地址不会自动请求。",
    };
  }

  const visible = topLevelFields(schema).slice(0, 8);
  const isFlat = visible.every((item) => !item.types.includes("object"));
  const kind: LayoutKind = isFlat && visible.length <= 7 ? "table" : "cards";
  return {
    version: 1,
    title: "结构化数据集",
    description: `${fileName} · ${records.length.toLocaleString("zh-CN")} 条记录`,
    kind,
    fields: visible.map((item, index) =>
      field(
        item.path,
        item.path === titlePath || index === 0
          ? "title"
          : item.types.some((type) => type === "string")
            ? "body"
            : "meta",
      ),
    ),
    rationale:
      kind === "table"
        ? "字段结构较扁平，表格适合快速扫描和比较。"
        : "字段存在嵌套结构，卡片视图能保留每条记录的上下文。",
  };
}

function fail(reason: string): never {
  throw new Error(`布局蓝图无效：${reason}`);
}

function safeText(value: unknown, name: string, maxLength: number): string {
  if (typeof value !== "string") fail(`${name} 必须是文本`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) fail(`${name} 长度不符合要求`);
  if (/[<>\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(trimmed)) {
    fail(`${name} 包含不允许的标记`);
  }
  return trimmed;
}

export function parseBlueprint(
  input: unknown,
  schema: SchemaField[],
): LayoutBlueprint {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    fail("响应必须是对象");
  }

  const candidate = input as Record<string, unknown>;
  if (candidate.version !== 1) fail("仅支持 version 1");
  if (typeof candidate.kind !== "string" || !kindSet.has(candidate.kind)) {
    fail("未知的视图类型");
  }
  if (!Array.isArray(candidate.fields) || candidate.fields.length < 1 || candidate.fields.length > 12) {
    fail("字段数量必须在 1 到 12 之间");
  }

  const allowedPaths = new Set(schema.map((item) => item.path));
  const fields = candidate.fields.map((item, index) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      fail(`第 ${index + 1} 个字段格式错误`);
    }
    const raw = item as Record<string, unknown>;
    const path = safeText(raw.path, "字段路径", 120);
    const label = safeText(raw.label, "字段标签", 48);
    if (!allowedPaths.has(path) || /(^|\.)(__proto__|prototype|constructor)(\.|$)/.test(path)) {
      fail(`字段路径 ${path} 不在数据 Schema 中`);
    }
    if (typeof raw.role !== "string" || !roleSet.has(raw.role)) {
      fail(`字段 ${path} 使用了未知角色`);
    }
    return { path, label, role: raw.role as FieldRole };
  });

  return {
    version: 1,
    title: safeText(candidate.title, "标题", 80),
    description: safeText(candidate.description, "描述", 180),
    kind: candidate.kind as LayoutKind,
    fields,
    rationale: safeText(candidate.rationale, "布局说明", 280),
  };
}
