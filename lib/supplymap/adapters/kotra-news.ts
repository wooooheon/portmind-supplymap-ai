import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { supplySource } from "@/lib/supplymap/data-sources";
import type { ProductIntent, Provenance, RiskSignalRecord, SupplyDataSourceRecord } from "@/lib/supplymap/types";

export type KotraMarketNewsRecord = {
  othbcDt?: string;
  newsWrterNm?: string;
  indstCdList?: string;
  jobSeNm?: string;
  natn?: string;
  cmdltNmEng?: string;
  cntntSumar?: string;
  bbsSn?: string;
  ovrofInfo?: string;
  hsCdNm?: string;
  cmdltNmKorn?: string;
  newsTitl?: string;
  indstCl?: string;
  bbstxSn?: string;
  infoCl?: string;
  newsBdt?: string;
  regn?: string;
  dataType?: string;
  kwrd?: string;
  kotraNewsUrl?: string;
  fileLink?: string;
};

export type FetchKotraMarketNewsOptions = {
  serviceKey?: string;
  endpoint?: string;
  country?: string;
  title?: string;
  industryCode?: string;
  hotClip?: string;
  startDate?: string;
  endDate?: string;
  pageNo?: number;
  rowsPerPage?: number;
  timeoutMs?: number;
};

export type KotraMarketNewsFetchResult = {
  records: KotraMarketNewsRecord[];
  totalCount: number;
  endpoint: string;
  fetchedAt: string;
};

type KotraNewsAdapterOptions = {
  forceMock?: boolean;
  limit?: number;
};

type RawRecord = Record<string, unknown>;

const source = supplySource("kotra_market_news");
const DEFAULT_KOTRA_NEWS_ENDPOINTS = [
  "https://apis.data.go.kr/B410001/kotra_overseasMarketNews/ovseaMrktNews/ovseaMrktNews",
  "https://dream.kotra.or.kr/openapi/ovseaMrktNews"
];
const SOURCE_CODE = "kotra_market_news";
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

function targetCountryName(country?: string): string {
  if (!country) return "대상국";
  if (/^(CN|CHN|중국|china)$/i.test(country)) return "중국";
  if (/^(VN|VNM|베트남|vietnam)$/i.test(country)) return "베트남";
  if (/^(US|USA|미국|united states)$/i.test(country)) return "미국";
  if (/^(JP|JPN|일본|japan)$/i.test(country)) return "일본";
  if (/^(DE|DEU|독일|germany)$/i.test(country)) return "독일";
  return country;
}

function productSearchTerm(intent: ProductIntent): string {
  const terms = [intent.category, intent.query, ...intent.keywords]
    .map((term) => term.trim())
    .filter((term) => term && term !== "품목 확인 필요");
  return terms[0] ?? intent.query;
}

function searchTerms(intent: ProductIntent): string[] {
  return Array.from(
    new Set(
      [intent.query, intent.category, ...intent.keywords, targetCountryName(intent.importCountry)]
        .map((term) => term.trim())
        .filter((term) => term && term !== "품목 확인 필요")
    )
  ).slice(0, 6);
}

function hash(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 16);
}

function decodeHtmlEntities(value?: string): string | undefined {
  if (!value) return undefined;
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&lsquo;", "'")
    .replaceAll("&rsquo;", "'")
    .replaceAll("&ldquo;", "\"")
    .replaceAll("&rdquo;", "\"")
    .replaceAll("&middot;", "·")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stringValue(record: RawRecord, key: keyof KotraMarketNewsRecord): string | undefined {
  const raw = record[key];
  if (typeof raw === "string") return decodeHtmlEntities(raw);
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  return undefined;
}

function normalizeRecord(record: RawRecord): KotraMarketNewsRecord {
  return {
    othbcDt: stringValue(record, "othbcDt"),
    newsWrterNm: stringValue(record, "newsWrterNm"),
    indstCdList: stringValue(record, "indstCdList"),
    jobSeNm: stringValue(record, "jobSeNm"),
    natn: stringValue(record, "natn"),
    cmdltNmEng: stringValue(record, "cmdltNmEng"),
    cntntSumar: stringValue(record, "cntntSumar"),
    bbsSn: stringValue(record, "bbsSn"),
    ovrofInfo: stringValue(record, "ovrofInfo"),
    hsCdNm: stringValue(record, "hsCdNm"),
    cmdltNmKorn: stringValue(record, "cmdltNmKorn"),
    newsTitl: stringValue(record, "newsTitl"),
    indstCl: stringValue(record, "indstCl"),
    bbstxSn: stringValue(record, "bbstxSn"),
    infoCl: stringValue(record, "infoCl"),
    newsBdt: stringValue(record, "newsBdt"),
    regn: stringValue(record, "regn"),
    dataType: stringValue(record, "dataType"),
    kwrd: stringValue(record, "kwrd"),
    kotraNewsUrl: stringValue(record, "kotraNewsUrl"),
    fileLink: stringValue(record, "fileLink")
  };
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
  const itemList = body.itemList && typeof body.itemList === "object" ? (body.itemList as RawRecord) : undefined;
  const items = body.items && typeof body.items === "object" ? (body.items as RawRecord) : undefined;
  const item = itemList?.item ?? items?.item;
  return asArray(item as RawRecord | RawRecord[] | undefined).filter(
    (record): record is RawRecord => Boolean(record && typeof record === "object")
  );
}

function availableEndpoints(endpoint?: string): string[] {
  return endpoint ? [endpoint, ...DEFAULT_KOTRA_NEWS_ENDPOINTS.filter((item) => item !== endpoint)] : DEFAULT_KOTRA_NEWS_ENDPOINTS;
}

function serviceKeyFromEnv(): string | undefined {
  return process.env.DATA_GO_KR_SERVICE_KEY || process.env.KOTRA_API_KEY;
}

export async function fetchKotraMarketNews(
  options: FetchKotraMarketNewsOptions = {}
): Promise<KotraMarketNewsFetchResult> {
  const serviceKey = options.serviceKey || serviceKeyFromEnv();
  if (!serviceKey) throw new Error("DATA_GO_KR_SERVICE_KEY 또는 KOTRA_API_KEY가 없습니다.");

  let lastError: unknown;
  for (const endpoint of availableEndpoints(options.endpoint || process.env.KOTRA_MARKET_NEWS_ENDPOINT)) {
    const url = new URL(endpoint);
    url.searchParams.set("serviceKey", serviceKey);
    url.searchParams.set("type", "json");
    url.searchParams.set("numOfRows", String(options.rowsPerPage ?? 20));
    url.searchParams.set("pageNo", String(options.pageNo ?? 1));
    if (options.country) url.searchParams.set("search1", options.country);
    if (options.title) url.searchParams.set("search2", options.title);
    if (options.startDate) url.searchParams.set("search4", options.startDate);
    if (options.industryCode) url.searchParams.set("search5", options.industryCode);
    if (options.hotClip) url.searchParams.set("search6", options.hotClip);
    if (options.endDate) url.searchParams.set("search7", options.endDate);

    try {
      const response = await fetch(url, {
        headers: { accept: "application/json,application/xml,text/plain,*/*" },
        signal: AbortSignal.timeout(options.timeoutMs ?? 20000)
      });
      if (!response.ok) {
        lastError = new Error(`KOTRA 해외시장뉴스 HTTP ${response.status}`);
        continue;
      }
      const raw = parsePayload(await response.text());
      const header = responseHeader(raw);
      const resultCode = String(header.resultCode ?? "00");
      if (resultCode !== "00" && resultCode !== "0") {
        lastError = new Error(`KOTRA 해외시장뉴스 resultCode=${resultCode}`);
        continue;
      }
      const body = responseBody(raw);
      const totalCount = Number(body.totalCnt ?? body.totalCount ?? 0);
      return {
        records: recordsFrom(raw).map(normalizeRecord),
        totalCount: Number.isFinite(totalCount) ? totalCount : 0,
        endpoint,
        fetchedAt: new Date().toISOString()
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("KOTRA 해외시장뉴스 호출 실패");
}

function relevanceScore(record: KotraMarketNewsRecord, intent: ProductIntent): number {
  const haystack = [
    record.newsTitl,
    record.cntntSumar,
    record.newsBdt,
    record.cmdltNmKorn,
    record.cmdltNmEng,
    record.hsCdNm,
    record.kwrd,
    record.indstCl
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const terms = [intent.query, intent.category, ...intent.keywords]
    .map((term) => term.toLowerCase())
    .filter((term) => term && term !== "품목 확인 필요");
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

export function kotraMarketNewsSeverity(record: KotraMarketNewsRecord): {
  severity: RiskSignalRecord["severity"];
  status: RiskSignalRecord["status"];
  scoreImpact: number;
  reason: string;
} {
  const text = [
    record.newsTitl,
    record.cntntSumar,
    record.newsBdt,
    record.infoCl,
    record.kwrd,
    record.hsCdNm
  ]
    .filter(Boolean)
    .join(" ");
  if (/수입금지|금지|제재|리콜|분쟁|전쟁|반덤핑|상계관세|수입중단|통관\s*보류|검역\s*강화/i.test(text)) {
    return {
      severity: "HIGH",
      status: "확인 필요",
      scoreImpact: -4,
      reason: "금지·제재·리콜·분쟁·반덤핑 등 즉시 확인해야 할 키워드가 포함됨"
    };
  }
  if (/규제|인증|통관|관세|검역|수입규제|표준|라벨|허가|신고|공급망|물류|환율|결제|계약/i.test(text)) {
    return {
      severity: "MEDIUM",
      status: "주의",
      scoreImpact: -2,
      reason: "규제·인증·통관·물류·거래조건 관련 키워드가 포함됨"
    };
  }
  return {
    severity: "LOW",
    status: "확인",
    scoreImpact: 0,
    reason: "시장동향 참고 신호이며 현재 제목·요약 기준 중대 경고 키워드는 제한적"
  };
}

function severityRank(severity: RiskSignalRecord["severity"]): number {
  if (severity === "HIGH") return 4;
  if (severity === "MEDIUM") return 3;
  if (severity === "NEEDS_CHECK" || severity === "UNKNOWN") return 2;
  return 1;
}

function compactSnippet(record: KotraMarketNewsRecord): string {
  const snippet = record.cntntSumar || record.newsBdt || record.kwrd || record.infoCl || "원문 확인 필요";
  return decodeHtmlEntities(snippet)?.slice(0, 260) || "원문 확인 필요";
}

export function stableKotraNewsId(record: KotraMarketNewsRecord): string {
  return record.bbstxSn || hash([record.natn, record.newsTitl, record.othbcDt, record.kotraNewsUrl].join("|"));
}

export function kotraNewsToRiskSignal(record: KotraMarketNewsRecord, intent: ProductIntent): RiskSignalRecord {
  const risk = kotraMarketNewsSeverity(record);
  const country = record.natn || targetCountryName(intent.importCountry);
  const title = record.newsTitl || `${country} 해외시장뉴스`;
  const articleUrl = record.kotraNewsUrl || source.sourceUrl;
  const hsCandidate = record.hsCdNm?.match(/\d{4,10}/)?.[0] ?? intent.hsCode;
  return {
    id: `risk-kotra-news-${stableKotraNewsId(record)}`,
    kind: "NEWS",
    severity: risk.severity,
    status: risk.status,
    title: `${country} 시장뉴스: ${title}`,
    summary: [
      compactSnippet(record),
      `분류: ${[record.infoCl, record.indstCl, record.cmdltNmKorn || record.hsCdNm].filter(Boolean).join(" · ") || "확인 필요"}.`,
      `${risk.reason}. 최종 규제·통관 판단은 원문과 관계기관 확인 필요.`
    ].join(" "),
    scoreImpact: risk.scoreImpact,
    hsCode: hsCandidate,
    ...provenance(source, articleUrl)
  };
}

function mockKotraNewsSignals(intent: ProductIntent): RiskSignalRecord[] {
  const country = targetCountryName(intent.importCountry);
  const regulated = /전기|전자|배터리|드론|의료|화장품|식품|포장/i.test(intent.query + " " + intent.category);
  return [
    {
      id: `risk-kotra-news-${intent.importCountry ?? "global"}-${intent.hsCode ?? "unknown"}`,
      kind: "NEWS",
      severity: regulated ? "MEDIUM" : "LOW",
      status: regulated ? "주의" : "확인",
      title: `${country} 시장·규제 뉴스 확인`,
      summary: regulated
        ? `${country} 관련 시장뉴스에서 규제·인증·통관 변경 가능성을 추적해야 하는 품목군입니다. 최신 원문 확인 후 RFQ 조건에 반영하세요.`
        : `${country} 시장정보는 보조 리스크 신호로 사용되며, 현재 mock 데이터에서는 중대 경고를 확정하지 않습니다.`,
      scoreImpact: regulated ? -2 : 0,
      hsCode: intent.hsCode,
      ...provenance(source)
    }
  ];
}

async function fetchKotraNewsSignals(intent: ProductIntent, limit: number): Promise<RiskSignalRecord[]> {
  const country = targetCountryName(intent.importCountry);
  const term = productSearchTerm(intent);
  const startDate = process.env.KOTRA_MARKET_NEWS_START_DATE || "20240101";
  const endDate =
    process.env.KOTRA_MARKET_NEWS_END_DATE ||
    new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const searches = [
    { country, title: term },
    { country, title: intent.keywords[0] },
    { country, title: "규제" }
  ].filter((item, index, all) => item.title && all.findIndex((candidate) => candidate.title === item.title) === index);

  const signals = new Map<string, RiskSignalRecord>();
  for (const search of searches) {
    const result = await fetchKotraMarketNews({
      country: search.country,
      title: search.title,
      startDate,
      endDate,
      rowsPerPage: Number(process.env.KOTRA_MARKET_NEWS_ROWS_PER_PAGE || 10),
      pageNo: 1,
      timeoutMs: 15000
    });
    for (const record of result.records) {
      const signal = kotraNewsToRiskSignal(record, intent);
      signals.set(signal.id, signal);
    }
    if (signals.size >= limit) break;
  }

  return Array.from(signals.values())
    .sort((left, right) => {
      const leftRecordScore = relevanceScore(
        { newsTitl: left.title, cntntSumar: left.summary, natn: targetCountryName(intent.importCountry) },
        intent
      );
      const rightRecordScore = relevanceScore(
        { newsTitl: right.title, cntntSumar: right.summary, natn: targetCountryName(intent.importCountry) },
        intent
      );
      return (
        severityRank(right.severity) - severityRank(left.severity) ||
        rightRecordScore - leftRecordScore ||
        left.scoreImpact - right.scoreImpact ||
        left.title.localeCompare(right.title, "ko")
      );
    })
    .slice(0, limit);
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

async function fetchStoredKotraNewsSignals(intent: ProductIntent, limit: number): Promise<RiskSignalRecord[]> {
  try {
    const { prisma } = await import("@/lib/db/prisma");
    const sourceRow = await prisma.supplyDataSource.findUnique({
      where: { code: SOURCE_CODE },
      select: { id: true }
    });
    if (!sourceRow) return [];
    const terms = searchTerms(intent);
    const rows = await prisma.riskSignal.findMany({
      where: {
        sourceId: sourceRow.id,
        ...(terms.length > 0
          ? {
              OR: terms.flatMap((term) => [
                { productQuery: { contains: term } },
                { title: { contains: term } },
                { summary: { contains: term } }
              ])
            }
          : {})
      },
      orderBy: [{ fetchedAt: "desc" }, { updatedAt: "desc" }],
      take: limit
    });
    return rows
      .map((row) => ({
        id: row.id,
        kind: (row.kind === "MARKET" ? "NEWS" : row.kind) as RiskSignalRecord["kind"],
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
      }))
      .sort(
        (left, right) =>
          severityRank(right.severity) - severityRank(left.severity) ||
          left.scoreImpact - right.scoreImpact ||
          left.title.localeCompare(right.title, "ko")
      );
  } catch {
    return [];
  }
}

export async function getKotraNewsRiskSignals(
  intent: ProductIntent,
  options: KotraNewsAdapterOptions = {}
): Promise<{ signals: RiskSignalRecord[]; usedMock: boolean }> {
  if (!options.forceMock) {
    try {
      const signals = await fetchKotraNewsSignals(intent, options.limit ?? 4);
      if (signals.length > 0) return { signals, usedMock: false };
    } catch {
      // Fall through to mock fallback.
    }
    const stored = await fetchStoredKotraNewsSignals(intent, options.limit ?? 4);
    if (stored.length > 0) return { signals: stored, usedMock: false };
  }
  return { signals: mockKotraNewsSignals(intent), usedMock: true };
}
