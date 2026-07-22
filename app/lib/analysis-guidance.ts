export const MAX_LAYOUT_GUIDANCE_LENGTH = 2_000;

export function normalizeLayoutGuidance(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value !== "string") {
    throw new Error("展示指导必须是文本");
  }

  const normalized = value.trim();
  if (normalized.length > MAX_LAYOUT_GUIDANCE_LENGTH) {
    throw new Error(`展示指导不能超过 ${MAX_LAYOUT_GUIDANCE_LENGTH} 字`);
  }
  if (/[^\P{Cc}\n\r\t]/u.test(normalized)) {
    throw new Error("展示指导包含不支持的控制字符");
  }
  return normalized;
}
