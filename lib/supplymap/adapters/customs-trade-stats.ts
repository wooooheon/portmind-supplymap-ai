import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { supplySource } from "@/lib/supplymap/data-sources";
import type { ProductIntent, Provenance, RiskSignalRecord, SupplyDataSourceRecord } from "@/lib/supplymap/types";

export type CustomsTradeStatsRecord = {
  balPayments?: string;
  expDlr?: string;
  expWgt?: string;
  hsCd?: string;
  impDlr?: string;
  impWgt?: string;
  statCd?: string;
  statCdCntnKor1?: string;
  statKor?: string;
  year?: string;
};

export type CustomsTradeStatsSummary = {
  hsCode: string;
  countryCode: string;
  countryName: string;
  itemName: string;
  startYymm: string;
  endYymm: string;
  monthlyRecords: CustomsTradeStatsRecord[];
  total: {
    importDollars: number;
    importWeightKg: number;
    exportDollars: number;
    exportWeightKg: number;
    tradeBalanceDollars: number;
  };
};

export type FetchCustomsTradeStatsOptions = {
  serviceKey?: string;
  endpoint?: string;
  startYymm: string;
  endYymm: string;
  hsCode: string;
  countryCode: string;
  timeoutMs?: number;
};

export type CustomsTradeStatsFetchResult = {
  records: CustomsTradeStatsRecord[];
  summary: CustomsTradeStatsSummary;
  endpoint: string;
  fetchedAt: string;
};

type CustomsTradeStatsAdapterOptions = {
  forceMock?: boolean;
  limit?: number;
  startYymm?: string;
  endYymm?: string;
};

type RawRecord = Record<string, unknown>;

const SOURCE_CODE = "customs_trade_stats";
const source = supplySource(SOURCE_CODE);
const DEFAULT_ENDPOINT = "https://apis.data.go.kr/1220000/nitemtrade/getNitemtradeList";
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
  return process.env.CUSTOMS_TRADE_STATS_SERVICE_KEY || process.env.CUSTOMS_API_KEY || process.env.DATA_GO_KR_SERVICE_KEY;
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

function stringValue(record: RawRecord, key: keyof CustomsTradeStatsRecord): string | undefined {
  const raw = record[key];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  return undefined;
}

function normalizeRecord(record: RawRecord): CustomsTradeStatsRecord {
  return {
    balPayments: stringValue(record, "balPayments"),
    expDlr: stringValue(record, "expDlr"),
    expWgt: stringValue(record, "expWgt"),
    hsCd: stringValue(record, "hsCd"),
    impDlr: stringValue(record, "impDlr"),
    impWgt: stringValue(record, "impWgt"),
    statCd: stringValue(record, "statCd"),
    statCdCntnKor1: stringValue(record, "statCdCntnKor1"),
    statKor: stringValue(record, "statKor"),
    year: stringValue(record, "year")
  };
}

function numberValue(value?: string): number {
  const parsed = Number((value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeHsCode(code?: string): string | undefined {
  const digits = (code ?? "").replace(/[^0-9]/g, "");
  if (![2, 4, 6, 10].includes(digits.length)) {
    if (digits.length > 10) return digits.slice(0, 10);
    if (digits.length >= 6) return digits.slice(0, 6);
    if (digits.length >= 4) return digits.slice(0, 4);
    if (digits.length >= 2) return digits.slice(0, 2);
    return undefined;
  }
  return digits;
}

function hsCandidates(intent: ProductIntent): string[] {
  return Array.from(
    new Set([intent.hsCode, ...intent.hsCodeCandidates].map(normalizeHsCode).filter(Boolean) as string[])
  ).slice(0, 5);
}

export function customsTradeCountryCode(country?: string): string {
  if (!country) return "CN";
  if (/^(CN|CHN|중국|china)$/i.test(country)) return "CN";
  if (/^(VN|VNM|베트남|vietnam)$/i.test(country)) return "VN";
  if (/^(US|USA|미국|united states)$/i.test(country)) return "US";
  if (/^(JP|JPN|일본|japan)$/i.test(country)) return "JP";
  if (/^(DE|DEU|독일|germany)$/i.test(country)) return "DE";
  if (/^(ID|IDN|인도네시아|indonesia)$/i.test(country)) return "ID";
  if (/^(TH|THA|태국|thailand)$/i.test(country)) return "TH";
  if (/^(IN|IND|인도|india)$/i.test(country)) return "IN";
  if (/^(MX|MEX|멕시코|mexico)$/i.test(country)) return "MX";
  if (/^(PL|POL|폴란드|poland)$/i.test(country)) return "PL";
  return country.slice(0, 2).toUpperCase();
}

function customsTradeCountryNames(country?: string): string[] {
  const code = customsTradeCountryCode(country);
  const names: Record<string, string[]> = {
    CN: ["CN", "중국", "China"],
    VN: ["VN", "베트남", "Vietnam"],
    US: ["US", "미국", "United States"],
    JP: ["JP", "일본", "Japan"],
    DE: ["DE", "독일", "Germany"],
    ID: ["ID", "인도네시아", "Indonesia"],
    TH: ["TH", "태국", "Thailand"],
    IN: ["IN", "인도", "India"],
    MX: ["MX", "멕시코", "Mexico"],
    PL: ["PL", "폴란드", "Poland"]
  };
  return names[code] ?? [code, country ?? code];
}

function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function yymm(date: Date): string {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}${month}`;
}

export function defaultCustomsTradeStatsPeriod(now = new Date()): { startYymm: string; endYymm: string } {
  const current = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = addMonths(current, now.getUTCDate() < 20 ? -2 : -1);
  return { startYymm: yymm(addMonths(end, -11)), endYymm: yymm(end) };
}

function formatDollar(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function buildSummary(
  records: CustomsTradeStatsRecord[],
  options: Pick<FetchCustomsTradeStatsOptions, "hsCode" | "countryCode" | "startYymm" | "endYymm">
): CustomsTradeStatsSummary {
  const monthlyRecords = records.filter((record) => record.year && record.year !== "총계");
  const totalRow = records.find((record) => record.year === "총계");
  const aggregate = {
    importDollars: numberValue(totalRow?.impDlr) || monthlyRecords.reduce((sum, record) => sum + numberValue(record.impDlr), 0),
    importWeightKg: numberValue(totalRow?.impWgt) || monthlyRecords.reduce((sum, record) => sum + numberValue(record.impWgt), 0),
    exportDollars: numberValue(totalRow?.expDlr) || monthlyRecords.reduce((sum, record) => sum + numberValue(record.expDlr), 0),
    exportWeightKg: numberValue(totalRow?.expWgt) || monthlyRecords.reduce((sum, record) => sum + numberValue(record.expWgt), 0),
    tradeBalanceDollars:
      numberValue(totalRow?.balPayments) || monthlyRecords.reduce((sum, record) => sum + numberValue(record.balPayments), 0)
  };
  const firstMonthly = monthlyRecords[0] ?? totalRow;
  return {
    hsCode: normalizeHsCode(options.hsCode) ?? options.hsCode,
    countryCode: options.countryCode.toUpperCase(),
    countryName: firstMonthly?.statCdCntnKor1 && firstMonthly.statCdCntnKor1 !== "-" ? firstMonthly.statCdCntnKor1 : options.countryCode,
    itemName: firstMonthly?.statKor && firstMonthly.statKor !== "-" ? firstMonthly.statKor : "품목명 확인 필요",
    startYymm: options.startYymm,
    endYymm: options.endYymm,
    monthlyRecords,
    total: aggregate
  };
}

export async function fetchCustomsTradeStats(
  options: FetchCustomsTradeStatsOptions
): Promise<CustomsTradeStatsFetchResult> {
  const serviceKey = options.serviceKey || serviceKeyFromEnv();
  if (!serviceKey) throw new Error("CUSTOMS_TRADE_STATS_SERVICE_KEY 또는 DATA_GO_KR_SERVICE_KEY가 없습니다.");
  const hsCode = normalizeHsCode(options.hsCode);
  if (!hsCode) throw new Error("유효한 HS 코드가 필요합니다.");
  const endpoint = options.endpoint || process.env.CUSTOMS_TRADE_STATS_ENDPOINT || DEFAULT_ENDPOINT;
  const url = new URL(endpoint);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("strtYymm", options.startYymm);
  url.searchParams.set("endYymm", options.endYymm);
  url.searchParams.set("hsSgn", hsCode);
  url.searchParams.set("cntyCd", customsTradeCountryCode(options.countryCode));

  const response = await fetch(url, {
    headers: { accept: "application/xml,application/json,text/plain,*/*" },
    signal: AbortSignal.timeout(options.timeoutMs ?? 20000)
  });
  if (!response.ok) throw new Error(`품목별 국가별 수출입실적 HTTP ${response.status}`);

  const raw = parsePayload(await response.text());
  const header = responseHeader(raw);
  const resultCode = String(header.resultCode ?? "00");
  if (resultCode !== "00" && resultCode !== "0") {
    throw new Error(`품목별 국가별 수출입실적 resultCode=${resultCode} ${String(header.resultMsg ?? "")}`);
  }
  const records = recordsFrom(raw).map(normalizeRecord);
  return {
    records,
    summary: buildSummary(records, {
      hsCode,
      countryCode: customsTradeCountryCode(options.countryCode),
      startYymm: options.startYymm,
      endYymm: options.endYymm
    }),
    endpoint,
    fetchedAt: new Date().toISOString()
  };
}

function signalSeverity(summary: CustomsTradeStatsSummary): {
  severity: RiskSignalRecord["severity"];
  status: RiskSignalRecord["status"];
  scoreImpact: number;
} {
  if (summary.monthlyRecords.length === 0 || summary.total.importDollars <= 0) {
    return { severity: "NEEDS_CHECK", status: "확인 필요", scoreImpact: -1 };
  }
  if (summary.total.importDollars >= 50_000_000 || summary.total.tradeBalanceDollars <= -50_000_000) {
    return { severity: "MEDIUM", status: "주의", scoreImpact: -2 };
  }
  return { severity: "LOW", status: "확인", scoreImpact: 0 };
}

export function stableCustomsTradeStatsId(summary: CustomsTradeStatsSummary): string {
  return createHash("sha1")
    .update(`${summary.hsCode}:${summary.countryCode}:${summary.startYymm}:${summary.endYymm}`)
    .digest("hex")
    .slice(0, 20);
}

export function customsTradeStatsToRiskSignal(summary: CustomsTradeStatsSummary): RiskSignalRecord {
  const risk = signalSeverity(summary);
  const period = `${summary.startYymm}~${summary.endYymm}`;
  return {
    id: `risk-customs-trade-stats-${stableCustomsTradeStatsId(summary)}`,
    kind: "MARKET",
    severity: risk.severity,
    status: risk.status,
    title: `HS ${summary.hsCode} ${summary.countryName} 수입실적 ${period}`,
    summary: [
      `관세청 품목별 국가별 수출입실적 기준 ${summary.countryName} ${summary.itemName}의 ${period} 수입액은 ${formatDollar(summary.total.importDollars)}, 수입중량은 ${Math.round(summary.total.importWeightKg).toLocaleString("ko-KR")}kg입니다.`,
      `동기간 수출액은 ${formatDollar(summary.total.exportDollars)}, 무역수지는 ${formatDollar(summary.total.tradeBalanceDollars)}입니다.`,
      "이는 시장 규모와 특정 국가 공급 의존도 검토용 보조 신호이며 가격, 계약 안정성, 수입 가능 여부를 단정하지 않습니다."
    ].join(" "),
    scoreImpact: risk.scoreImpact,
    hsCode: summary.hsCode,
    ...provenance(source)
  };
}

function mockCustomsTradeStatsSignals(intent: ProductIntent): RiskSignalRecord[] {
  const { startYymm, endYymm } = defaultCustomsTradeStatsPeriod();
  const countryCode = customsTradeCountryCode(intent.importCountry);
  return [
    {
      id: `risk-customs-trade-stats-mock-${countryCode}-${intent.hsCode ?? "unknown"}`,
      kind: "MARKET",
      severity: "NEEDS_CHECK",
      status: "확인 필요",
      title: "품목별 국가별 수출입실적 확인",
      summary: `HS 후보와 국가코드 기준으로 ${startYymm}~${endYymm} 수입액·중량·무역수지 조회가 필요합니다. 데이터가 없다는 뜻이 아니라 API 연결 또는 HS 확정이 필요하다는 의미입니다.`,
      scoreImpact: -1,
      hsCode: intent.hsCode,
      ...provenance(source)
    }
  ];
}

async function fetchTradeStatsSignals(
  intent: ProductIntent,
  options: CustomsTradeStatsAdapterOptions
): Promise<RiskSignalRecord[]> {
  const period = {
    ...defaultCustomsTradeStatsPeriod(),
    ...(options.startYymm ? { startYymm: options.startYymm } : {}),
    ...(options.endYymm ? { endYymm: options.endYymm } : {})
  };
  const signals: RiskSignalRecord[] = [];
  for (const hsCode of hsCandidates(intent)) {
    const result = await fetchCustomsTradeStats({
      hsCode,
      countryCode: customsTradeCountryCode(intent.importCountry),
      startYymm: period.startYymm,
      endYymm: period.endYymm,
      timeoutMs: 15000
    });
    if (result.summary.monthlyRecords.length > 0) signals.push(customsTradeStatsToRiskSignal(result.summary));
    if (signals.length >= (options.limit ?? 3)) break;
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

async function fetchStoredTradeStatsSignals(intent: ProductIntent, limit: number): Promise<RiskSignalRecord[]> {
  try {
    const { prisma } = await import("@/lib/db/prisma");
    const sourceRow = await prisma.supplyDataSource.findUnique({ where: { code: SOURCE_CODE }, select: { id: true } });
    if (!sourceRow) return [];
    const terms = hsCandidates(intent);
    if (terms.length === 0) return [];
    const countryTerms = customsTradeCountryNames(intent.importCountry);
    const rows = await prisma.riskSignal.findMany({
      where: {
        sourceId: sourceRow.id,
        AND: [
          {
            OR: terms.flatMap((term) => [
              { hsCode: { contains: term.slice(0, 6) } },
              { title: { contains: term.slice(0, 6) } }
            ])
          },
          { OR: countryTerms.map((term) => ({ title: { contains: term } })) }
        ]
      },
      orderBy: [{ fetchedAt: "desc" }, { updatedAt: "desc" }],
      take: limit
    });
    return rows.map((row) => ({
      id: row.id,
      kind: "MARKET",
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

export async function getCustomsTradeStatsRiskSignals(
  intent: ProductIntent,
  options: CustomsTradeStatsAdapterOptions = {}
): Promise<{ signals: RiskSignalRecord[]; usedMock: boolean }> {
  if (!options.forceMock) {
    try {
      const signals = await fetchTradeStatsSignals(intent, options);
      if (signals.length > 0) return { signals, usedMock: false };
    } catch {
      // Fall through to stored records, then mock fallback.
    }
    const stored = await fetchStoredTradeStatsSignals(intent, options.limit ?? 3);
    if (stored.length > 0) return { signals: stored, usedMock: false };
  }
  return { signals: mockCustomsTradeStatsSignals(intent), usedMock: true };
}
