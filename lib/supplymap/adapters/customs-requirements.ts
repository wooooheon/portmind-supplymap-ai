import { XMLParser } from "fast-xml-parser";
import { supplySource } from "@/lib/supplymap/data-sources";
import type { ProductIntent, Provenance, RiskSignalRecord, SupplyDataSourceRecord } from "@/lib/supplymap/types";

export type CustomsRequirementRecord = {
  aplyStrtDt?: string;
  bfhnAffcRtmTpcd?: string;
  dcerCfrmLworCd?: string;
  dcerCfrmLworNm?: string;
  hsSgn?: string;
  reqApreIttCd?: string;
  reqApreIttNm?: string;
  reqCfrmIstmNm?: string;
};

export type FetchCustomsRequirementsOptions = {
  serviceKey?: string;
  endpoint?: string;
  hsCode: string;
  importExportType?: "1" | "2";
  timeoutMs?: number;
};

export type CustomsRequirementsFetchResult = {
  records: CustomsRequirementRecord[];
  hsCode: string;
  endpoint: string;
  fetchedAt: string;
};

type CustomsRequirementsAdapterOptions = {
  forceMock?: boolean;
  limit?: number;
};

type RawRecord = Record<string, unknown>;

const SOURCE_CODE = "customs_requirements";
const source = supplySource(SOURCE_CODE);
const DEFAULT_CUSTOMS_CONFIRMATION_ENDPOINT =
  "https://apis.data.go.kr/1220000/retrieveCcctLworCd/getRetrieveCcctLworCd";
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true
});

function provenance(sourceRecord: SupplyDataSourceRecord, url?: string): Provenance {
  return {
    providerName: sourceRecord.providerName,
    datasetName: sourceRecord.datasetName,
    sourceType: sourceRecord.sourceType,
    sourceUrl: url || sourceRecord.sourceUrl,
    fetchedAt: new Date().toISOString(),
    license: sourceRecord.license,
    verification: sourceRecord.verification === "MOCK" ? "PARTIAL" : sourceRecord.verification
  };
}

function serviceKeyFromEnv(): string | undefined {
  return (
    process.env.CUSTOMS_CONFIRMATION_ITEMS_SERVICE_KEY ||
    process.env.CUSTOMS_API_KEY ||
    process.env.DATA_GO_KR_SERVICE_KEY
  );
}

function parsePayload(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return JSON.parse(trimmed);
  return xmlParser.parse(trimmed);
}

function asArray<T>(input: T | T[] | undefined): T[] {
  if (!input) return [];
  return Array.isArray(input) ? input : [input];
}

function responseHeader(raw: unknown): RawRecord {
  const root = raw && typeof raw === "object" ? (raw as RawRecord) : {};
  const response = root.response && typeof root.response === "object" ? (root.response as RawRecord) : root;
  return response.header && typeof response.header === "object" ? (response.header as RawRecord) : {};
}

function responseBody(raw: unknown): RawRecord {
  const root = raw && typeof raw === "object" ? (raw as RawRecord) : {};
  const response = root.response && typeof root.response === "object" ? (root.response as RawRecord) : root;
  return response.body && typeof response.body === "object" ? (response.body as RawRecord) : response;
}

function recordsFrom(raw: unknown): RawRecord[] {
  const body = responseBody(raw);
  const items = body.items && typeof body.items === "object" ? (body.items as RawRecord) : undefined;
  return asArray(items?.item as RawRecord | RawRecord[] | undefined).filter(
    (record): record is RawRecord => Boolean(record && typeof record === "object")
  );
}

function stringValue(record: RawRecord, key: keyof CustomsRequirementRecord): string | undefined {
  const raw = record[key];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  return undefined;
}

function normalizeRecord(record: RawRecord): CustomsRequirementRecord {
  return {
    aplyStrtDt: stringValue(record, "aplyStrtDt"),
    bfhnAffcRtmTpcd: stringValue(record, "bfhnAffcRtmTpcd"),
    dcerCfrmLworCd: stringValue(record, "dcerCfrmLworCd"),
    dcerCfrmLworNm: stringValue(record, "dcerCfrmLworNm"),
    hsSgn: stringValue(record, "hsSgn"),
    reqApreIttCd: stringValue(record, "reqApreIttCd"),
    reqApreIttNm: stringValue(record, "reqApreIttNm"),
    reqCfrmIstmNm: stringValue(record, "reqCfrmIstmNm")
  };
}

function normalizeHsCode(code?: string): string | undefined {
  const digits = (code ?? "").replace(/[^0-9]/g, "");
  if (digits.length < 4) return undefined;
  if (digits.length >= 10) return digits.slice(0, 10);
  return digits.padEnd(10, "0");
}

function hsCandidates(intent: ProductIntent): string[] {
  return Array.from(
    new Set([intent.hsCode, ...intent.hsCodeCandidates].map(normalizeHsCode).filter(Boolean) as string[])
  ).slice(0, 8);
}

export async function fetchCustomsRequirements(
  options: FetchCustomsRequirementsOptions
): Promise<CustomsRequirementsFetchResult> {
  const serviceKey = options.serviceKey || serviceKeyFromEnv();
  if (!serviceKey) throw new Error("CUSTOMS_CONFIRMATION_ITEMS_SERVICE_KEY 또는 DATA_GO_KR_SERVICE_KEY가 없습니다.");

  const endpoint =
    options.endpoint || process.env.CUSTOMS_CONFIRMATION_ITEMS_ENDPOINT || DEFAULT_CUSTOMS_CONFIRMATION_ENDPOINT;
  const hsCode = normalizeHsCode(options.hsCode);
  if (!hsCode) throw new Error("유효한 HS 코드가 필요합니다.");

  const url = new URL(endpoint);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("hsSgn", hsCode);
  url.searchParams.set("imexTpcd", options.importExportType ?? "2");

  const response = await fetch(url, {
    headers: { accept: "application/xml,application/json,text/plain,*/*" },
    signal: AbortSignal.timeout(options.timeoutMs ?? 20000)
  });
  if (!response.ok) throw new Error(`세관장확인대상물품 HTTP ${response.status}`);

  const raw = parsePayload(await response.text());
  const header = responseHeader(raw);
  const resultCode = String(header.resultCode ?? "00");
  if (resultCode !== "00" && resultCode !== "0") {
    throw new Error(`세관장확인대상물품 resultCode=${resultCode} ${String(header.resultMsg ?? "")}`);
  }

  return {
    records: recordsFrom(raw).map(normalizeRecord),
    hsCode,
    endpoint,
    fetchedAt: new Date().toISOString()
  };
}

function uniqueJoin(values: Array<string | undefined>, separator = ", "): string {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])).join(separator);
}

function requirementSeverity(records: CustomsRequirementRecord[]): {
  severity: RiskSignalRecord["severity"];
  status: RiskSignalRecord["status"];
  scoreImpact: number;
} {
  const text = records.map((record) => `${record.dcerCfrmLworNm ?? ""} ${record.reqCfrmIstmNm ?? ""}`).join(" ");
  if (/마약|총포|화학무기|폐기물|멸종위기|전략물자|방사|유해화학/i.test(text)) {
    return { severity: "HIGH", status: "확인 필요", scoreImpact: -5 };
  }
  if (records.length >= 3 || /약사법|전기용품|생활용품|수입식품|식품|의료기기|전파법|화장품법/i.test(text)) {
    return { severity: "MEDIUM", status: "확인 필요", scoreImpact: -3 };
  }
  return { severity: "MEDIUM", status: "주의", scoreImpact: -2 };
}

export function stableCustomsRequirementId(hsCode: string, records: CustomsRequirementRecord[]): string {
  const lawCodes = uniqueJoin(records.map((record) => record.dcerCfrmLworCd), "-") || "none";
  return `${normalizeHsCode(hsCode) ?? hsCode}-${lawCodes}`.toLowerCase();
}

export function customsRecordsToRiskSignal(hsCode: string, records: CustomsRequirementRecord[]): RiskSignalRecord {
  const risk = requirementSeverity(records);
  const laws = uniqueJoin(records.map((record) => record.dcerCfrmLworNm));
  const agencies = uniqueJoin(records.map((record) => record.reqApreIttNm));
  const documents = uniqueJoin(records.map((record) => record.reqCfrmIstmNm));
  const normalizedHs = normalizeHsCode(hsCode) ?? hsCode;
  return {
    id: `risk-customs-confirmation-${stableCustomsRequirementId(normalizedHs, records)}`,
    kind: "CUSTOMS",
    severity: risk.severity,
    status: risk.status,
    title: `HS ${normalizedHs} 세관장확인대상 수입요건`,
    summary: [
      `관세청 세관장확인대상물품 조회 결과 ${records.length}개 요건이 확인되었습니다.`,
      laws ? `확인법령: ${laws}.` : "확인법령: 확인 필요.",
      agencies ? `요건승인기관: ${agencies}.` : "요건승인기관: 확인 필요.",
      documents ? `확인서류: ${documents}.` : "확인서류: 확인 필요.",
      "이는 HS 후보 기준의 조회 결과이며 최종 품목분류와 수입 가능 여부는 관계기관 확인 필요."
    ].join(" "),
    scoreImpact: risk.scoreImpact,
    hsCode: normalizedHs,
    ...provenance(source)
  };
}

function hasRegulatedHsPrefix(intent: ProductIntent, prefixes: readonly string[]): boolean {
  return intent.hsCodeCandidates.some((code) => prefixes.some((prefix) => code.startsWith(prefix)));
}

function mockCustomsSignals(intent: ProductIntent): RiskSignalRecord[] {
  const likelyInspection = hasRegulatedHsPrefix(intent, ["85", "88", "90", "94", "39", "33", "19"]);
  return [
    {
      id: `risk-customs-hs-${intent.hsCode ?? "unknown"}`,
      kind: "CUSTOMS",
      severity: likelyInspection ? "MEDIUM" : "NEEDS_CHECK",
      status: "확인 필요",
      title: "HS부호 및 수입요건 확인",
      summary: likelyInspection
        ? `HS 후보 ${intent.hsCodeCandidates.slice(0, 3).join(", ")} 기준으로 세관장확인대상·요건승인기관 재조회가 필요합니다. 후보 HS만으로 수입 가능 여부를 단정하지 않습니다.`
        : "HS 후보가 불명확해 품목분류와 수입요건을 먼저 확인해야 합니다.",
      scoreImpact: likelyInspection ? -3 : -2,
      hsCode: intent.hsCode,
      ...provenance(source)
    },
    {
      id: `risk-customs-strategic-${intent.hsCode ?? "unknown"}`,
      kind: "STRATEGIC_GOODS",
      severity: /드론|배터리|센서|통신|반도체|레이저/i.test(intent.query + " " + intent.category) ? "NEEDS_CHECK" : "LOW",
      status: /드론|배터리|센서|통신|반도체|레이저/i.test(intent.query + " " + intent.category) ? "확인 필요" : "확인",
      title: "전략물자·수출입 통제 가능성",
      summary: "전략물자 해당 여부는 세부 사양, 성능, 용도 기준으로 확인해야 하며 본 점수는 최종 법적 판단이 아닙니다.",
      scoreImpact: /드론|배터리|센서|통신|반도체|레이저/i.test(intent.query + " " + intent.category) ? -2 : 0,
      hsCode: intent.hsCode,
      ...provenance(source)
    }
  ];
}

async function fetchCustomsSignals(intent: ProductIntent, limit: number): Promise<RiskSignalRecord[]> {
  const signals: RiskSignalRecord[] = [];
  for (const hsCode of hsCandidates(intent)) {
    const result = await fetchCustomsRequirements({
      hsCode,
      importExportType: "2",
      timeoutMs: 15000
    });
    if (result.records.length > 0) signals.push(customsRecordsToRiskSignal(hsCode, result.records));
    if (signals.length >= limit) break;
  }
  return signals;
}

function normalizeStoredSeverity(value: string): RiskSignalRecord["severity"] {
  if (value === "LOW" || value === "MEDIUM" || value === "HIGH" || value === "NEEDS_CHECK" || value === "UNKNOWN") {
    return value;
  }
  return "NEEDS_CHECK";
}

function normalizeStoredStatus(value: string): RiskSignalRecord["status"] {
  if (value === "확인" || value === "주의" || value === "확인 필요") return value;
  return "확인 필요";
}

async function fetchStoredCustomsSignals(intent: ProductIntent, limit: number): Promise<RiskSignalRecord[]> {
  try {
    const { prisma } = await import("@/lib/db/prisma");
    const sourceRow = await prisma.supplyDataSource.findUnique({ where: { code: SOURCE_CODE }, select: { id: true } });
    if (!sourceRow) return [];
    const terms = hsCandidates(intent);
    if (terms.length === 0) return [];
    const rows = await prisma.riskSignal.findMany({
      where: {
        sourceId: sourceRow.id,
        OR: terms.flatMap((term) => [{ hsCode: { contains: term.slice(0, 6) } }, { title: { contains: term.slice(0, 6) } }])
      },
      orderBy: [{ fetchedAt: "desc" }, { updatedAt: "desc" }],
      take: limit
    });
    return rows.map((row) => ({
      id: row.id,
      kind: "CUSTOMS",
      severity: normalizeStoredSeverity(row.severity),
      status: normalizeStoredStatus(row.status),
      title: row.title,
      summary: row.summary,
      scoreImpact: row.scoreImpact,
      hsCode: row.hsCode ?? undefined,
      supplierId: row.supplierId ?? undefined,
      providerName: row.providerName,
      datasetName: row.datasetName,
      sourceType: row.sourceType,
      sourceUrl: row.sourceUrl,
      fetchedAt: row.fetchedAt.toISOString(),
      license: row.license,
      verification: row.verification
    }));
  } catch {
    return [];
  }
}

export async function getCustomsRequirementRiskSignals(
  intent: ProductIntent,
  options: CustomsRequirementsAdapterOptions = {}
): Promise<{ signals: RiskSignalRecord[]; usedMock: boolean }> {
  if (!options.forceMock) {
    try {
      const signals = await fetchCustomsSignals(intent, options.limit ?? 4);
      if (signals.length > 0) return { signals, usedMock: false };
    } catch {
      // Fall through to stored records, then mock fallback.
    }
    const stored = await fetchStoredCustomsSignals(intent, options.limit ?? 4);
    if (stored.length > 0) return { signals: stored, usedMock: false };
  }
  return { signals: mockCustomsSignals(intent), usedMock: true };
}
