export type JsonRecord = Record<string, unknown>;

export type DatasetFormat = "json" | "jsonl";

export interface ParsedDataset {
  format: DatasetFormat;
  root: unknown;
  records: JsonRecord[];
  recordPath: string;
}

export interface SchemaField {
  path: string;
  type: string;
  types: string[];
  presence: number;
  sample: string;
  depth: number;
}

const COMMON_RECORD_KEYS = new Set([
  "data",
  "records",
  "items",
  "rows",
  "results",
  "samples",
  "examples",
  "instances",
]);

const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function isObject(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeRecord(value: unknown): JsonRecord {
  return isObject(value) ? value : { value };
}

interface ArrayCandidate {
  path: string;
  value: unknown[];
  score: number;
}

function findRecordArray(root: unknown): ArrayCandidate | null {
  const candidates: ArrayCandidate[] = [];

  function visit(value: unknown, path: string, depth: number): void {
    if (depth > 4) return;

    if (Array.isArray(value)) {
      const objectCount = value.filter(isObject).length;
      const objectRatio = value.length === 0 ? 0 : objectCount / value.length;
      const key = path.split(".").at(-1)?.toLowerCase() ?? "";
      const isRoot = path === "$";
      const conventional = COMMON_RECORD_KEYS.has(key) ? 500 : 0;
      const score =
        (isRoot ? 1_000 : 0) +
        conventional +
        objectRatio * 120 +
        Math.min(value.length, 100) -
        depth * 8;
      candidates.push({ path, value, score });

      if (!isRoot) {
        value.slice(0, 3).forEach((item, index) => {
          if (isObject(item)) visit(item, `${path}[${index}]`, depth + 1);
        });
      }
      return;
    }

    if (!isObject(value)) return;
    for (const [key, child] of Object.entries(value)) {
      if (DANGEROUS_KEYS.has(key)) continue;
      visit(child, path === "$" ? `$.${key}` : `${path}.${key}`, depth + 1);
    }
  }

  visit(root, "$", 0);
  return candidates.sort((a, b) => b.score - a.score)[0] ?? null;
}

function parseJsonLines(text: string): unknown[] {
  const lines = text.split(/\r?\n/);
  const values: unknown[] = [];

  lines.forEach((line, index) => {
    if (!line.trim()) return;
    try {
      values.push(JSON.parse(line));
    } catch {
      throw new Error(`无法解析 JSONL 第 ${index + 1} 行。`);
    }
  });

  if (values.length === 0) throw new Error("文件中没有可读取的 JSON 记录。");
  return values;
}

export function parseDatasetText(text: string, fileName = "dataset.json"): ParsedDataset {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("文件为空，请选择包含 JSON 数据的文件。");

  const lowerName = fileName.toLowerCase();
  const prefersJsonLines =
    lowerName.endsWith(".jsonl") || lowerName.endsWith(".ndjson");

  let root: unknown;
  let format: DatasetFormat = "json";

  if (prefersJsonLines) {
    root = parseJsonLines(text);
    format = "jsonl";
  } else {
    try {
      root = JSON.parse(trimmed);
    } catch {
      root = parseJsonLines(text);
      format = "jsonl";
    }
  }

  const candidate = findRecordArray(root);
  const values = candidate ? candidate.value : [root];
  const records = values.map(normalizeRecord);

  if (records.length === 0) {
    throw new Error("没有发现可浏览的数据记录。");
  }

  return {
    format,
    root,
    records,
    recordPath: candidate?.path ?? "$",
  };
}

function valueType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") {
    return Number.isInteger(value) ? "integer" : "number";
  }
  return typeof value === "object" ? "object" : typeof value;
}

function previewValue(value: unknown): string {
  if (typeof value === "string") {
    return value.length > 72 ? `${value.slice(0, 72)}…` : value;
  }
  if (value === null) return "null";
  if (Array.isArray(value)) return `${value.length} 项`;
  if (isObject(value)) return `${Object.keys(value).length} 个字段`;
  return String(value);
}

export function inferSchema(records: JsonRecord[]): SchemaField[] {
  const sample = records.slice(0, 200);
  const fields = new Map<
    string,
    { types: Set<string>; recordIndexes: Set<number>; sample: string; depth: number }
  >();

  function add(path: string, value: unknown, recordIndex: number, depth: number): void {
    const current = fields.get(path) ?? {
      types: new Set<string>(),
      recordIndexes: new Set<number>(),
      sample: previewValue(value),
      depth,
    };
    current.types.add(valueType(value));
    current.recordIndexes.add(recordIndex);
    fields.set(path, current);
  }

  function visit(value: unknown, path: string, recordIndex: number, depth: number): void {
    if (depth > 5 || !path) return;
    add(path, value, recordIndex, depth);

    if (Array.isArray(value)) {
      value.slice(0, 4).forEach((item) => {
        if (!isObject(item)) return;
        for (const [key, child] of Object.entries(item)) {
          if (DANGEROUS_KEYS.has(key)) continue;
          visit(child, `${path}[].${key}`, recordIndex, depth + 1);
        }
      });
      return;
    }

    if (!isObject(value)) return;
    for (const [key, child] of Object.entries(value)) {
      if (DANGEROUS_KEYS.has(key)) continue;
      visit(child, `${path}.${key}`, recordIndex, depth + 1);
    }
  }

  sample.forEach((record, recordIndex) => {
    for (const [key, value] of Object.entries(record)) {
      if (DANGEROUS_KEYS.has(key)) continue;
      visit(value, key, recordIndex, 0);
    }
  });

  return [...fields.entries()]
    .map(([path, field]) => {
      const types = [...field.types].sort();
      return {
        path,
        types,
        type: types.length === 1 ? types[0] : types.join(" | "),
        presence: sample.length === 0 ? 0 : field.recordIndexes.size / sample.length,
        sample: field.sample,
        depth: field.depth,
      };
    })
    .sort((a, b) => a.depth - b.depth || a.path.localeCompare(b.path));
}

export function searchRecords(records: JsonRecord[], query: string): JsonRecord[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return records;
  return records.filter((record) =>
    JSON.stringify(record).toLocaleLowerCase().includes(normalized),
  );
}

export function getValueAtPath(record: JsonRecord, path: string): unknown {
  const segments = path.split(".");
  if (segments.some((segment) => DANGEROUS_KEYS.has(segment.replace(/\[\]$/, "")))) {
    return undefined;
  }

  let values: unknown[] = [record];
  for (const segment of segments) {
    const isArraySegment = segment.endsWith("[]");
    const key = isArraySegment ? segment.slice(0, -2) : segment;
    const next: unknown[] = [];

    for (const value of values) {
      if (!isObject(value)) continue;
      const child = value[key];
      if (isArraySegment && Array.isArray(child)) next.push(...child);
      else if (child !== undefined) next.push(child);
    }
    values = next;
  }

  if (values.length === 0) return undefined;
  return values.length === 1 ? values[0] : values;
}

function truncateValue(value: unknown, depth: number): unknown {
  if (typeof value === "string") {
    return value.length > 400 ? `${value.slice(0, 400)}…` : value;
  }
  if (value === null || typeof value !== "object") return value;
  if (depth >= 4) return Array.isArray(value) ? `[${value.length} 项]` : "{已截断}";

  if (Array.isArray(value)) {
    return value.slice(0, 8).map((item) => truncateValue(item, depth + 1));
  }

  const result: JsonRecord = Object.create(null) as JsonRecord;
  Object.entries(value as JsonRecord)
    .filter(([key]) => !DANGEROUS_KEYS.has(key))
    .slice(0, 30)
    .forEach(([key, child]) => {
      result[key] = truncateValue(child, depth + 1);
    });
  return result;
}

export function createModelSamples(records: JsonRecord[]): unknown[] {
  return records.slice(0, 5).map((record) => truncateValue(record, 0));
}
