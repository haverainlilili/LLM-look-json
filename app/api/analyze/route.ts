import {
  buildAnalysisMessages,
  createRateLimiter,
  parseAnalyzeRequest,
  parseProviderBlueprint,
  resolveModelConfig,
} from "../../lib/analyze.ts";

const limiter = createRateLimiter({ limit: 8, windowMs: 60_000 });

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function error(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status);
}

export async function POST(request: Request): Promise<Response> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 64_000) {
    return error(413, "PAYLOAD_TOO_LARGE", "分析请求不能超过 64 KB。");
  }

  const clientKey =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local";
  if (!limiter.allow(clientKey)) {
    return error(429, "RATE_LIMITED", "分析请求过于频繁，请稍后再试。");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "INVALID_JSON", "请求体不是有效的 JSON。");
  }

  let input;
  try {
    input = parseAnalyzeRequest(body);
  } catch {
    return error(422, "VALIDATION_ERROR", "文件摘要或 Schema 格式无效。");
  }

  const modelConfig = resolveModelConfig(process.env);
  if (!modelConfig) {
    return error(
      503,
      "MODEL_NOT_CONFIGURED",
      "尚未配置大模型，当前仍可使用本地智能布局。",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const providerResponse = await fetch(modelConfig.endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${modelConfig.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: modelConfig.model,
        messages: buildAnalysisMessages(input),
        temperature: 0.1,
        max_tokens: 1_200,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
      redirect: "error",
    });

    if (!providerResponse.ok) {
      return error(502, "MODEL_PROVIDER_ERROR", "大模型服务暂时无法完成布局分析。");
    }

    const providerJson = await providerResponse.json();
    const blueprint = parseProviderBlueprint(providerJson, input.schema);
    return json({ data: blueprint, meta: { source: "model" } });
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === "AbortError") {
      return error(504, "MODEL_TIMEOUT", "大模型分析超时，请稍后再试。");
    }
    return error(502, "INVALID_MODEL_OUTPUT", "大模型返回的布局无法安全使用。");
  } finally {
    clearTimeout(timeout);
  }
}
