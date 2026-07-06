import { XMLParser } from "fast-xml-parser";

type FetchOptions = {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: true
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  options: FetchOptions = {}
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const retries = options.retries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 700;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          "user-agent": "Trade Intelligence Map MVP/0.1",
          accept: "application/json, application/xml, text/xml, */*",
          ...(init.headers ?? {})
        }
      });
      clearTimeout(timeout);

      if (response.ok || attempt === retries || response.status < 500) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status} ${response.statusText}`);
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      if (attempt === retries) break;
    }
    await delay(retryDelayMs * (attempt + 1));
  }

  throw lastError instanceof Error ? lastError : new Error("Request failed");
}

export async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  if (!text) return null;

  if (contentType.includes("json") || text.trim().startsWith("{") || text.trim().startsWith("[")) {
    return JSON.parse(text);
  }

  return xmlParser.parse(text);
}

export function extractRecords(raw: unknown): unknown[] {
  if (Array.isArray(raw)) {
    if (
      raw.every(
        (item) =>
          item &&
          typeof item === "object" &&
          "item" in (item as Record<string, unknown>) &&
          Object.keys(item as Record<string, unknown>).length === 1
      )
    ) {
      return raw.map((item) => (item as { item: unknown }).item);
    }
    return raw;
  }
  if (!raw || typeof raw !== "object") return [];

  const value = raw as Record<string, unknown>;
  const directCandidates = [
    value.items,
    value.item,
    value.data,
    value.result,
    value.list,
    value.rows,
    value.response
  ];

  for (const candidate of directCandidates) {
    const records = extractRecords(candidate);
    if (records.length > 0) return records;
  }

  const body = value.body as Record<string, unknown> | undefined;
  if (body) {
    const records = extractRecords(body.items ?? body.item ?? body.data ?? body);
    if (records.length > 0) return records;
  }

  const nestedItems = (value as { response?: { body?: { items?: unknown; item?: unknown } } }).response?.body;
  if (nestedItems) {
    const records = extractRecords(nestedItems.items ?? nestedItems.item);
    if (records.length > 0) return records;
  }

  return Object.keys(value).length > 0 ? [value] : [];
}

export function appendQuery(url: string, params: Record<string, unknown>): string {
  const target = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    target.searchParams.set(key, String(value));
  }
  return target.toString();
}
