export type NormalizedRecordType =
  | "FACTORY"
  | "PRODUCT"
  | "CERTIFICATE"
  | "TRADE_REQUIREMENT"
  | "RISK_EVENT"
  | "TRADE_STAT"
  | "LEGAL_DOC"
  | "SEARCH_RESULT";

export type NormalizedRecord = {
  type: NormalizedRecordType;
  sourceCode: string;
  sourceRecordId?: string | null;
  canonicalName?: string | null;
  country?: string | null;
  address?: string | null;
  hsCode?: string | null;
  productName?: string | null;
  certNumber?: string | null;
  eventType?: string | null;
  evidenceUrl?: string | null;
  rawJson: unknown;
  retrievedAt: string;
  extra?: Record<string, unknown>;
};

export type RawFetchResult = {
  sourceCode: string;
  retrievedAt: string;
  params: Record<string, unknown>;
  raw: unknown;
  records: unknown[];
  evidenceUrl?: string;
  usedMock: boolean;
};

export interface Connector {
  sourceCode: string;
  displayName: string;
  category: string;
  requiresKey: boolean;
  keyEnvName?: string;
  docsUrl?: string;
  fetchRaw(params: Record<string, unknown>): Promise<RawFetchResult>;
  normalize(raw: RawFetchResult): Promise<NormalizedRecord[]>;
}

export type ApiSourceDefinition = {
  code: string;
  name: string;
  provider: string;
  category: string;
  baseUrl: string;
  requiresKey: boolean;
  keyEnvName?: string;
  status: "implemented" | "stub" | "optional";
  docsUrl?: string;
};
