import type { Connector, NormalizedRecord, RawFetchResult } from "./types";
import { appendQuery, extractRecords, fetchWithRetry, parseResponse } from "./http";
import { mockRecordsForSource } from "./mock-data";

type PublicApiConnectorConfig = {
  sourceCode: string;
  displayName: string;
  category: string;
  endpoint: string;
  endpointEnvName?: string;
  requiresKey: boolean;
  keyEnvName?: string;
  docsUrl?: string;
  defaultParams?: Record<string, unknown>;
  prepareParams?: (params: Record<string, unknown>) => Record<string, unknown>;
  filterRecords?: (records: unknown[], params: Record<string, unknown>) => unknown[];
  normalize: (raw: RawFetchResult) => NormalizedRecord[];
  headers?: Record<string, string>;
};

function shouldUseMock(config: PublicApiConnectorConfig, params: Record<string, unknown>): boolean {
  if (params.mock === true || params.mock === "true") return true;
  if (process.env.MOCK_CONNECTORS === "true") return true;
  if (config.requiresKey && config.keyEnvName && !process.env[config.keyEnvName]) return true;
  return false;
}

function sanitizeEvidenceUrl(url: string): string {
  const target = new URL(url);
  for (const key of ["serviceKey", "ServiceKey", "apiKey", "apikey", "authKey"]) {
    if (target.searchParams.has(key)) {
      target.searchParams.set(key, "REDACTED");
    }
  }
  return target.toString();
}

export function createPublicApiConnector(config: PublicApiConnectorConfig): Connector {
  return {
    sourceCode: config.sourceCode,
    displayName: config.displayName,
    category: config.category,
    requiresKey: config.requiresKey,
    keyEnvName: config.keyEnvName,
    docsUrl: config.docsUrl,
    async fetchRaw(params) {
      const retrievedAt = new Date().toISOString();
      const endpoint = process.env[config.endpointEnvName ?? ""] || config.endpoint;
      const requestParams = config.prepareParams ? config.prepareParams(params) : params;

      if (shouldUseMock(config, params)) {
        return {
          sourceCode: config.sourceCode,
          retrievedAt,
          params: requestParams,
          raw: { mock: true, records: mockRecordsForSource(config.sourceCode, params) },
          records: mockRecordsForSource(config.sourceCode, params),
          evidenceUrl: config.docsUrl,
          usedMock: true
        };
      }

      const keyParam =
        config.keyEnvName === "FOODS_SAFETY_KOREA_KEY"
          ? {}
          : config.keyEnvName
            ? { serviceKey: process.env[config.keyEnvName] }
            : {};
      const requestUrl = appendQuery(endpoint, {
        numOfRows: 100,
        pageNo: 1,
        type: "json",
        resultType: "json",
        ...config.defaultParams,
        ...requestParams,
        ...keyParam
      });
      const evidenceUrl = sanitizeEvidenceUrl(requestUrl);

      try {
        const response = await fetchWithRetry(requestUrl, { headers: config.headers }, { retries: 2 });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
        const raw = await parseResponse(response);
        const records = extractRecords(raw);
        return {
          sourceCode: config.sourceCode,
          retrievedAt,
          params: requestParams,
          raw,
          records: config.filterRecords ? config.filterRecords(records, requestParams) : records,
          evidenceUrl,
          usedMock: false
        };
      } catch (error) {
        if (params.strict === true) throw error;
        const records = mockRecordsForSource(config.sourceCode, params);
        return {
          sourceCode: config.sourceCode,
          retrievedAt,
          params: { ...requestParams, fallbackReason: error instanceof Error ? error.message : "unknown error" },
          raw: { fallback: true, error: error instanceof Error ? error.message : String(error), records },
          records,
          evidenceUrl: config.docsUrl,
          usedMock: true
        };
      }
    },
    async normalize(raw) {
      return config.normalize(raw);
    }
  };
}
