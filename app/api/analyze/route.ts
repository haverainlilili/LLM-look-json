import {
  buildProviderRequest,
  classifyModelOutputFailure,
  createRateLimiter,
  parseAnalyzeRequest,
  parseProviderBlueprint,
  providerStatusDetail,
  resolveAnalyzeRequestLimit,
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

function error(
  status: number,
  code: string,
  message: string,
  diagnostic: { stage: "prepare" | "provider" | "validation"; detail: string },
): Response {
  return json({ error: { code, message, ...diagnostic } }, status);
}

function isAbortError(caught: unknown): boolean {
  return (
    typeof caught === "object" &&
    caught !== null &&
    "name" in caught &&
    (caught as { name?: unknown }).name === "AbortError"
  );
}

function formatByteLimit(bytes: number): string {
  const mib = bytes / (1024 * 1024);
  return Number.isInteger(mib) ? `${mib} MiB` : `${bytes.toLocaleString("en-US")} 字节`;
}

function payloadTooLarge(maxBytes: number): Response {
  return error(413, "PAYLOAD_TOO_LARGE", `分析请求不能超过 ${formatByteLimit(maxBytes)}。`, {
    stage: "prepare",
    detail: "请减少字段或样本，或在 .env 中调整 LLM_MAX_INPUT_BYTES。",
  });
}

export async function POST(request: Request): Promise<Response> {
  const maxRequestBytes = resolveAnalyzeRequestLimit(process.env);
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > maxRequestBytes) {
    return payloadTooLarge(maxRequestBytes);
  }

  const clientKey =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local";
  if (!limiter.allow(clientKey)) {
    return error(429, "RATE_LIMITED", "分析请求过于频繁，请稍后再试。", {
      stage: "provider",
      detail: "本地分析接口一分钟最多接受 8 次请求。",
    });
  }

  let bodyText: string;
  try {
    bodyText = await request.text();
  } catch {
    return error(400, "INVALID_JSON", "请求体不是有效的 JSON。", {
      stage: "prepare",
      detail: "浏览器没有生成有效的分析摘要。",
    });
  }
  if (new TextEncoder().encode(bodyText).byteLength > maxRequestBytes) {
    return payloadTooLarge(maxRequestBytes);
  }

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return error(400, "INVALID_JSON", "请求体不是有效的 JSON。", {
      stage: "prepare",
      detail: "浏览器没有生成有效的分析摘要。",
    });
  }

  let input;
  try {
    input = parseAnalyzeRequest(body, maxRequestBytes);
  } catch {
    return error(422, "VALIDATION_ERROR", "文件摘要或 Schema 格式无效。", {
      stage: "prepare",
      detail: "Schema、文件名或样本未通过输入校验。",
    });
  }

  const modelConfig = resolveModelConfig(process.env);
  if (!modelConfig) {
    return error(
      503,
      "MODEL_NOT_CONFIGURED",
      "尚未配置大模型，当前仍可使用本地智能布局。",
      {
        stage: "provider",
        detail: "请检查 .env 中的 API Key、API Base 和模型名称。",
      },
    );
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), modelConfig.timeoutMs);
  let providerResponse: Response;

  try {
    providerResponse = await fetch(
      modelConfig.endpoint,
      buildProviderRequest(modelConfig, input, controller.signal),
    );
  } catch (caught) {
    if (isAbortError(caught)) {
      return error(504, "MODEL_TIMEOUT", "大模型分析超时，请稍后再试。", {
        stage: "provider",
        detail: `模型在 ${Math.round(modelConfig.timeoutMs / 1_000)} 秒内没有返回响应。`,
      });
    }
    return error(502, "MODEL_CONNECTION_ERROR", "无法连接大模型服务。", {
      stage: "provider",
      detail: "请检查 API Base、网络连接和 TLS 配置。",
    });
  } finally {
    clearTimeout(timeout);
  }

  if (providerResponse.status >= 300 && providerResponse.status < 400) {
    return error(502, "MODEL_PROVIDER_REDIRECT", "模型服务返回了重定向。", {
      stage: "provider",
      detail: `模型服务返回 HTTP ${providerResponse.status}；为避免凭据跨域转发，未自动跟随。`,
    });
  }
  if (!providerResponse.ok) {
    return error(502, "MODEL_PROVIDER_ERROR", "大模型服务拒绝了布局请求。", {
      stage: "provider",
      detail: providerStatusDetail(providerResponse.status),
    });
  }

  let providerJson: unknown;
  try {
    providerJson = await providerResponse.json();
  } catch {
    return error(502, "MODEL_RESPONSE_NOT_JSON", "大模型响应无法解析。", {
      stage: "validation",
      detail: "模型服务的 HTTP 响应体不是 JSON。",
    });
  }

  try {
    const blueprint = parseProviderBlueprint(providerJson, input.schema);
    return json({
      data: blueprint,
      meta: {
        source: "model",
        trace: {
          providerStatus: providerResponse.status,
          durationMs: Date.now() - startedAt,
        },
      },
    });
  } catch (caught) {
    const failure = classifyModelOutputFailure(caught);
    return error(502, failure.code, "大模型返回的布局无法安全使用。", {
      stage: "validation",
      detail: failure.detail,
    });
  }
}
