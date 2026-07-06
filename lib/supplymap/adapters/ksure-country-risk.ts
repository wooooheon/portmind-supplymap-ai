import { XMLParser } from "fast-xml-parser";
import { supplySource } from "@/lib/supplymap/data-sources";
import type { ProductIntent, Provenance, RiskSignalRecord, SupplyDataSourceRecord } from "@/lib/supplymap/types";

export type KsureRiskIndexRecord = {
  riskIdx: number;
  ctryCd: string;
  ctryNm: string;
  biztypCd: string;
  biztypNm: string;
};

export type FetchKsureRiskIndexOptions = {
  serviceKey?: string;
  endpoint?: string;
  pageNo?: number;
  rowsPerPage?: number;
  timeoutMs?: number;
};

export type KsureRiskIndexFetchResult = {
  records: KsureRiskIndexRecord[];
  totalCount: number;
  endpoint: string;
  fetchedAt: string;
};

type KsureCountryRiskAdapterOptions = {
  forceMock?: boolean;
  limit?: number;
};

type RawRecord = Record<string, unknown>;

const SOURCE_CODE = "ksure_country_trade";
const source = supplySource(SOURCE_CODE);
const DEFAULT_KSURE_RISK_INDEX_ENDPOINT = "https://apis.data.go.kr/B552696/ksight/riskindex";
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
  return process.env.KSURE_API_KEY || process.env.DATA_GO_KR_SERVICE_KEY;
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

function responseBody(raw: unknown): RawRecord {
  const root = raw && typeof raw === "object" ? (raw as RawRecord) : {};
  const response = root.response && typeof root.response === "object" ? (root.response as RawRecord) : root;
  return response.body && typeof response.body === "object" ? (response.body as RawRecord) : response;
}

function responseHeader(raw: unknown): RawRecord {
  const root = raw && typeof raw === "object" ? (raw as RawRecord) : {};
  const response = root.response && typeof root.response === "object" ? (root.response as RawRecord) : root;
  return response.header && typeof response.header === "object" ? (response.header as RawRecord) : {};
}

function recordsFrom(raw: unknown): RawRecord[] {
  const body = responseBody(raw);
  const items = body.items && typeof body.items === "object" ? (body.items as RawRecord) : undefined;
  return asArray(items?.item as RawRecord | RawRecord[] | undefined).filter(
    (record): record is RawRecord => Boolean(record && typeof record === "object")
  );
}

function stringValue(record: RawRecord, key: keyof KsureRiskIndexRecord): string {
  const raw = record[key];
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  return "";
}

function numberValue(record: RawRecord, key: keyof KsureRiskIndexRecord): number {
  const raw = record[key];
  const parsed = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.replaceAll(",", "")) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeRecord(record: RawRecord): KsureRiskIndexRecord {
  return {
    riskIdx: numberValue(record, "riskIdx"),
    ctryCd: stringValue(record, "ctryCd"),
    ctryNm: stringValue(record, "ctryNm"),
    biztypCd: stringValue(record, "biztypCd"),
    biztypNm: stringValue(record, "biztypNm")
  };
}

export async function fetchKsureRiskIndex(
  options: FetchKsureRiskIndexOptions = {}
): Promise<KsureRiskIndexFetchResult> {
  const serviceKey = options.serviceKey || serviceKeyFromEnv();
  if (!serviceKey) throw new Error("DATA_GO_KR_SERVICE_KEY 또는 KSURE_API_KEY가 없습니다.");

  const endpoint = options.endpoint || process.env.KSURE_RISK_INDEX_ENDPOINT || DEFAULT_KSURE_RISK_INDEX_ENDPOINT;
  const url = new URL(endpoint);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("pageNo", String(options.pageNo ?? 1));
  url.searchParams.set("numOfRows", String(options.rowsPerPage ?? 3000));

  const response = await fetch(url, {
    headers: { accept: "application/json,application/xml,text/plain,*/*" },
    signal: AbortSignal.timeout(options.timeoutMs ?? 20000)
  });
  if (!response.ok) throw new Error(`K-SURE 위험지수 HTTP ${response.status}`);

  const raw = parsePayload(await response.text());
  const header = responseHeader(raw);
  const resultCode = String(header.resultCode ?? "0");
  if (resultCode !== "0" && resultCode !== "00") throw new Error(`K-SURE 위험지수 resultCode=${resultCode}`);

  const body = responseBody(raw);
  const totalCount = Number(body.totalCount ?? 0);
  return {
    records: recordsFrom(raw).map(normalizeRecord).filter((record) => record.ctryCd && record.biztypCd),
    totalCount: Number.isFinite(totalCount) ? totalCount : 0,
    endpoint,
    fetchedAt: new Date().toISOString()
  };
}

function countryName(country?: string): string | undefined {
  if (!country) return undefined;
  if (/^(CN|CHN|중국|china)$/i.test(country)) return "중국";
  if (/^(VN|VNM|베트남|vietnam)$/i.test(country)) return "베트남";
  if (/^(US|USA|미국|united states)$/i.test(country)) return "미국";
  if (/^(JP|JPN|일본|japan)$/i.test(country)) return "일본";
  if (/^(DE|DEU|독일|germany)$/i.test(country)) return "독일";
  if (/^(IN|IND|인도|india)$/i.test(country)) return "인도";
  if (/^(ID|IDN|인도네시아|indonesia)$/i.test(country)) return "인도네시아";
  if (/^(MX|MEX|멕시코|mexico)$/i.test(country)) return "멕시코";
  if (/^(PL|POL|폴란드|poland)$/i.test(country)) return "폴란드";
  if (/^(TH|THA|태국|thailand)$/i.test(country)) return "태국";
  return country;
}

function countryCode(country?: string): string | undefined {
  if (!country) return undefined;
  if (/^(CN|CHN|중국|china)$/i.test(country)) return "CN";
  if (/^(VN|VNM|베트남|vietnam)$/i.test(country)) return "VN";
  if (/^(US|USA|미국|united states)$/i.test(country)) return "US";
  if (/^(JP|JPN|일본|japan)$/i.test(country)) return "JP";
  if (/^(DE|DEU|독일|germany)$/i.test(country)) return "DE";
  if (/^(IN|IND|인도|india)$/i.test(country)) return "IN";
  if (/^(ID|IDN|인도네시아|indonesia)$/i.test(country)) return "ID";
  if (/^(MX|MEX|멕시코|mexico)$/i.test(country)) return "MX";
  if (/^(PL|POL|폴란드|poland)$/i.test(country)) return "PL";
  if (/^(TH|THA|태국|thailand)$/i.test(country)) return "TH";
  return /^[A-Z]{2}$/i.test(country) ? country.toUpperCase() : undefined;
}

function industryHints(intent: ProductIntent): string[] {
  const text = [intent.query, intent.category, ...intent.keywords].join(" ");
  const hints: string[] = [];
  if (/식품|과자|음료|식료/i.test(text)) hints.push("식료품 제조업", "음료 제조업");
  if (/화장품|화학|원료|세정|향료/i.test(text)) hints.push("화학물질 및 화학제품 제조업");
  if (/용기|포장|플라스틱|필름|사출|고무/i.test(text)) hints.push("고무 및 플라스틱제품 제조업", "화학물질 및 화학제품 제조업");
  if (/LED|조명|전자|PCB|반도체|통신|센서|배터리/i.test(text)) {
    hints.push("전자부품, 컴퓨터, 영상, 음향 및 통신장비 제조업", "전기장비 제조업");
  }
  if (/히터|전기히터|전열|모터|기계/i.test(text)) hints.push("전기장비 제조업", "기타 기계 및 장비 제조업");
  if (/드론|항공|운송장비/i.test(text)) hints.push("기타 운송장비 제조업", "전자부품, 컴퓨터, 영상, 음향 및 통신장비 제조업");
  if (/의료기기|의료|정밀|광학/i.test(text)) hints.push("의료, 정밀, 광학기기 및 시계 제조업", "의료용 물질 및 의약품 제조업");
  if (hints.length === 0) hints.push("도매 및 상품 중개업");
  return Array.from(new Set(hints));
}

function industryMatchScore(record: KsureRiskIndexRecord, intent: ProductIntent): number {
  const hints = industryHints(intent);
  const industry = record.biztypNm.toLowerCase();
  const hintScore = hints.reduce((score, hint) => score + (industry.includes(hint.toLowerCase()) ? 10 : 0), 0);
  const textTerms = [intent.query, intent.category, ...intent.keywords]
    .map((term) => term.toLowerCase())
    .filter(Boolean);
  const directScore = textTerms.reduce((score, term) => score + (industry.includes(term) ? 2 : 0), 0);
  return hintScore + directScore;
}

function countryMatch(record: KsureRiskIndexRecord, intent: ProductIntent): boolean {
  const code = countryCode(intent.importCountry);
  const name = countryName(intent.importCountry);
  if (!code && !name) return false;
  return record.ctryCd === code || record.ctryNm === name;
}

export function ksureSeverityForRiskIndex(riskIdx: number): {
  severity: RiskSignalRecord["severity"];
  status: RiskSignalRecord["status"];
  scoreImpact: number;
  label: string;
} {
  if (riskIdx >= 5) return { severity: "HIGH", status: "확인 필요", scoreImpact: -4, label: "RI5 고위험" };
  if (riskIdx >= 4) return { severity: "HIGH", status: "확인 필요", scoreImpact: -3, label: "RI4 고위험" };
  if (riskIdx >= 3) return { severity: "MEDIUM", status: "주의", scoreImpact: -2, label: "RI3 주의" };
  if (riskIdx >= 2) return { severity: "LOW", status: "확인", scoreImpact: -1, label: "RI2 낮음" };
  return { severity: "LOW", status: "확인", scoreImpact: 0, label: "RI1 낮음" };
}

export function stableKsureRiskIndexId(record: KsureRiskIndexRecord): string {
  return `${record.ctryCd}-${record.biztypCd}`.toLowerCase();
}

export function ksureRiskIndexToRiskSignal(record: KsureRiskIndexRecord, intent: ProductIntent): RiskSignalRecord {
  const risk = ksureSeverityForRiskIndex(record.riskIdx);
  return {
    id: `risk-ksure-index-${stableKsureRiskIndexId(record)}`,
    kind: "COUNTRY",
    severity: risk.severity,
    status: risk.status,
    title: `${record.ctryNm} ${record.biztypNm} K-SURE 위험지수 ${risk.label}`,
    summary: [
      `한국무역보험공사 K-SURE RISK INDEX 기준 ${record.ctryNm}/${record.biztypNm} 위험지수는 RI${record.riskIdx}입니다.`,
      "RI 수치가 높을수록 거래 주의가 필요합니다.",
      "이는 국가·업종 단위 보조지표이며 개별 공급업체 신용등급이나 무역보험 인수 가능 여부를 의미하지 않습니다."
    ].join(" "),
    scoreImpact: risk.scoreImpact,
    hsCode: intent.hsCode,
    ...provenance(source)
  };
}

function mockCountryRisk(country?: string): { severity: RiskSignalRecord["severity"]; scoreImpact: number; reason: string } {
  if (country === "CN" || country === "중국") {
    return {
      severity: "MEDIUM",
      scoreImpact: -2,
      reason: "중국 조달은 공급망 집중도, 결제조건, 통관 일정 변동을 함께 점검해야 합니다."
    };
  }
  if (country === "VN" || country === "베트남") {
    return {
      severity: "LOW",
      scoreImpact: 0,
      reason: "베트남 조달은 대체 생산기지로 검토 가능하지만 업체별 결제·물류 조건 확인이 필요합니다."
    };
  }
  return {
    severity: "NEEDS_CHECK",
    scoreImpact: -1,
    reason: "대상국 국가위험 지표가 충분하지 않아 K-SURE 원문과 무역보험 조건 확인이 필요합니다."
  };
}

function mockKsureSignals(intent: ProductIntent): RiskSignalRecord[] {
  const risk = mockCountryRisk(intent.importCountry);
  return [
    {
      id: `risk-ksure-country-${intent.importCountry ?? "unknown"}`,
      kind: "COUNTRY",
      severity: risk.severity,
      status: risk.severity === "LOW" ? "확인" : "확인 필요",
      title: "국가위험 보조 신호",
      summary: `${risk.reason} 이 지표는 공급업체 개별 신용등급이나 무역보험 인수 가능 여부를 의미하지 않습니다.`,
      scoreImpact: risk.scoreImpact,
      hsCode: intent.hsCode,
      ...provenance(source)
    },
    {
      id: `risk-ksure-payment-${intent.importCountry ?? "unknown"}`,
      kind: "PAYMENT",
      severity: risk.severity === "LOW" ? "NEEDS_CHECK" : risk.severity,
      status: "확인 필요",
      title: "결제·거래조건 확인",
      summary: "선급금, 신용장, D/P·D/A, 보험 적용 가능성은 거래처와 계약조건별로 달라 최종 판단을 단정하지 않습니다.",
      scoreImpact: risk.scoreImpact,
      hsCode: intent.hsCode,
      ...provenance(source)
    }
  ];
}

async function fetchKsureSignals(intent: ProductIntent, limit: number): Promise<RiskSignalRecord[]> {
  const country = countryName(intent.importCountry);
  if (!country) return [];
  const result = await fetchKsureRiskIndex({
    rowsPerPage: Number(process.env.KSURE_RISK_INDEX_ROWS_PER_PAGE || 3000),
    pageNo: 1,
    timeoutMs: 20000
  });
  return result.records
    .filter((record) => countryMatch(record, intent))
    .map((record) => ({ record, score: industryMatchScore(record, intent) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || right.record.riskIdx - left.record.riskIdx)
    .slice(0, limit)
    .map((item) => ksureRiskIndexToRiskSignal(item.record, intent));
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

async function fetchStoredKsureSignals(intent: ProductIntent, limit: number): Promise<RiskSignalRecord[]> {
  try {
    const { prisma } = await import("@/lib/db/prisma");
    const sourceRow = await prisma.supplyDataSource.findUnique({
      where: { code: SOURCE_CODE },
      select: { id: true }
    });
    if (!sourceRow) return [];

    const country = countryName(intent.importCountry);
    if (!country) return [];
    const rows = await prisma.riskSignal.findMany({
      where: {
        sourceId: sourceRow.id,
        OR: [{ title: { contains: country } }, { summary: { contains: country } }]
      },
      orderBy: [{ fetchedAt: "desc" }, { updatedAt: "desc" }],
      take: 120
    });
    return rows
      .map((row) => ({
        row,
        score: industryHints(intent).reduce(
          (total, hint) => total + (row.productQuery?.includes(hint) || row.title.includes(hint) ? 10 : 0),
          0
        )
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || left.row.scoreImpact - right.row.scoreImpact)
      .slice(0, limit)
      .map(({ row }) => ({
        id: row.id,
        kind: "COUNTRY",
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

export async function getKsureCountryRiskSignals(
  intent: ProductIntent,
  options: KsureCountryRiskAdapterOptions = {}
): Promise<{ signals: RiskSignalRecord[]; usedMock: boolean }> {
  if (!options.forceMock) {
    try {
      const signals = await fetchKsureSignals(intent, options.limit ?? 3);
      if (signals.length > 0) return { signals, usedMock: false };
    } catch {
      // Fall through to stored records, then mock fallback.
    }
    const stored = await fetchStoredKsureSignals(intent, options.limit ?? 3);
    if (stored.length > 0) return { signals: stored, usedMock: false };
  }
  return { signals: mockKsureSignals(intent), usedMock: true };
}
