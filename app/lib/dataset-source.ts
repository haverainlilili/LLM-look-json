export const MAX_DATASET_FILE_BYTES = 20 * 1024 * 1024;

export interface DatasetAddress {
  url: URL;
  fileName: string;
}

export interface AddressDataset {
  text: string;
  fileName: string;
}

export type DatasetFetcher = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

const MAX_ADDRESS_LENGTH = 2_048;
const ADDRESS_TIMEOUT_MS = 30_000;
const LOCAL_HTTP_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

class DatasetSourceError extends Error {}

function sourceError(message: string): DatasetSourceError {
  return new DatasetSourceError(message);
}

function byteLimitLabel(maxBytes: number): string {
  const mebibytes = maxBytes / (1024 * 1024);
  return Number.isInteger(mebibytes) ? `${mebibytes} MiB` : `${maxBytes} 字节`;
}

function addressFileName(url: URL): string {
  const encodedName = url.pathname.split("/").filter(Boolean).at(-1) ?? "";
  let decodedName = encodedName;
  try {
    decodedName = decodeURIComponent(encodedName);
  } catch {
    decodedName = encodedName;
  }
  const safeName = decodedName
    .replace(/[\\/]/g, "_")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .trim()
    .slice(0, 180);
  return safeName || "remote-dataset.json";
}

export function normalizeDatasetAddress(value: string): DatasetAddress {
  const address = value.trim();
  if (!address || address.length > MAX_ADDRESS_LENGTH) {
    throw sourceError("请输入不超过 2048 字的文件地址。");
  }
  if (/^[A-Za-z]:[\\/]/.test(address) || /^(?:file:|~?\/)/i.test(address)) {
    throw sourceError("浏览器不能直接读取本地路径，请使用系统文件选择器打开文件。");
  }
  if (/[\u0000-\u001F\u007F-\u009F]/.test(address)) {
    throw sourceError("文件地址包含不支持的控制字符。");
  }

  let url: URL;
  try {
    url = new URL(address);
  } catch {
    throw sourceError("请输入完整的 HTTPS JSON 文件地址。");
  }
  if (url.username || url.password) {
    throw sourceError("文件地址不能包含用户名或密码。");
  }
  if (url.protocol === "http:" && !LOCAL_HTTP_HOSTS.has(url.hostname)) {
    throw sourceError("远程文件地址必须使用 HTTPS。");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw sourceError("仅支持 HTTPS 地址和本机 HTTP 地址。");
  }
  url.hash = "";
  return { url, fileName: addressFileName(url) };
}

async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  const declaredBytes = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
    throw sourceError(`地址文件不能超过 ${byteLimitLabel(maxBytes)}。`);
  }

  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw sourceError(`地址文件不能超过 ${byteLimitLabel(maxBytes)}。`);
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let byteLength = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maxBytes) {
        await reader.cancel();
        throw sourceError(`地址文件不能超过 ${byteLimitLabel(maxBytes)}。`);
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export async function fetchDatasetFromAddress(
  value: string,
  maxBytes = MAX_DATASET_FILE_BYTES,
  fetcher: DatasetFetcher = fetch,
): Promise<AddressDataset> {
  const source = normalizeDatasetAddress(value);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ADDRESS_TIMEOUT_MS);

  try {
    const response = await fetcher(source.url, {
      method: "GET",
      headers: { accept: "application/json, application/x-ndjson, text/plain" },
      cache: "no-store",
      credentials: "omit",
      redirect: "follow",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw sourceError(`文件地址返回 HTTP ${response.status}。`);
    }
    return {
      text: await readBoundedText(response, maxBytes),
      fileName: source.fileName,
    };
  } catch (caught) {
    if (caught instanceof DatasetSourceError) throw caught;
    if (controller.signal.aborted) {
      throw sourceError("读取文件地址超时，请稍后重试。");
    }
    throw sourceError("无法读取这个文件地址，请确认地址可访问且允许浏览器跨域读取。");
  } finally {
    clearTimeout(timeout);
  }
}
