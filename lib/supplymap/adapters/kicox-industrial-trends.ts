import { supplySource } from "@/lib/supplymap/data-sources";
import type { IndustrialComplexSummary } from "@/lib/supplymap/types";
import { XMLParser } from "fast-xml-parser";

type KicoxIndustrialTrendsFetchOptions = {
  region?: string;
  mock?: boolean;
  strict?: boolean;
};

type KicoxIndustrialTrendsResult = {
  complexes: IndustrialComplexSummary[];
  usedMock: boolean;
  fetchedAt: string;
  evidenceUrl: string;
  warning?: string;
};

const source = supplySource("kicox_industrial_trends");
const DEFAULT_KICOX_TRENDS_BASE_URL = "https://apis.data.go.kr/B550624/indparkstats";
const DEFAULT_KICOX_TRENDS_ENDPOINT = `${DEFAULT_KICOX_TRENDS_BASE_URL}/kicoxMvnCmpnyStatsService`;
const DEFAULT_KICOX_TRENDS_PERIOD = "202312";
const INDUSTRY_FIELDS: Array<[string, string]> = [
  ["induty01", "음식료"],
  ["induty02", "섬유의복"],
  ["induty03", "목재종이"],
  ["induty04", "석유화학"],
  ["induty05", "비금속"],
  ["induty06", "철강"],
  ["induty07", "기계"],
  ["induty08", "전기전자"],
  ["induty09", "운송장비"],
  ["induty12", "기타"],
  ["induty131415", "비제조"]
];

const baseProvenance = {
  providerName: source.providerName,
  datasetName: source.datasetName,
  sourceType: source.sourceType,
  sourceUrl: source.sourceUrl,
  fetchedAt: source.fetchedAt,
  license: source.license,
  verification: source.verification
};

export const MOCK_KICOX_INDUSTRIAL_COMPLEXES: IndustrialComplexSummary[] = [
  {
    id: "complex-banwol-sihwa",
    code: "KICOX-DEMO-BSW",
    name: "반월·시화국가산업단지",
    region: "경기",
    city: "안산·시흥",
    latitude: 37.319,
    longitude: 126.733,
    industries: ["포장재", "플라스틱", "전기전자", "기계", "화장품 용기"],
    tenantCount: 20900,
    operatingCount: 19300,
    operationRate: 76.4,
    employeeCount: 154000,
    matchReason: "수도권 수요처와 가까운 포장재·플라스틱·전기전자 제조 집적 권역",
    ...baseProvenance
  },
  {
    id: "complex-namdong",
    code: "KICOX-DEMO-NAMDONG",
    name: "남동국가산업단지",
    region: "인천",
    city: "남동구",
    latitude: 37.405,
    longitude: 126.692,
    industries: ["소형가전", "전기히터", "LED 조명", "화장품 용기", "기계"],
    tenantCount: 7900,
    operatingCount: 7200,
    operationRate: 74.8,
    employeeCount: 98000,
    matchReason: "수도권 제조와 인천항 접근성이 좋은 전기·소형가전·패키징 권역",
    ...baseProvenance
  },
  {
    id: "complex-gumi",
    code: "KICOX-DEMO-GUMI",
    name: "구미국가산업단지",
    region: "경북",
    city: "구미",
    latitude: 36.119,
    longitude: 128.371,
    industries: ["전기전자", "LED 조명", "드론 전장", "PCB", "디스플레이"],
    tenantCount: 2500,
    operatingCount: 2200,
    operationRate: 72.8,
    employeeCount: 84000,
    matchReason: "전자부품·PCB·LED·드론 전장 부품 생산 기반",
    ...baseProvenance
  },
  {
    id: "complex-noksan",
    code: "KICOX-DEMO-NOKSAN",
    name: "명지·녹산국가산업단지",
    region: "부산",
    city: "강서구",
    latitude: 35.104,
    longitude: 128.856,
    industries: ["식품", "식품 포장", "기계", "운송장비", "포장재"],
    tenantCount: 1700,
    operatingCount: 1510,
    operationRate: 74.1,
    employeeCount: 41000,
    matchReason: "부산항 접근성과 식품·포장 연관 제조업 기반",
    ...baseProvenance
  },
  {
    id: "complex-osong",
    code: "KICOX-DEMO-OSONG",
    name: "오송생명과학단지",
    region: "충북",
    city: "청주",
    latitude: 36.6325,
    longitude: 127.3248,
    industries: ["화장품", "화장품 용기", "바이오", "의료기기", "진단"],
    tenantCount: 560,
    operatingCount: 515,
    operationRate: 78.2,
    employeeCount: 28000,
    matchReason: "바이오·화장품·의료기기 산업과 패키징 수요가 가까운 권역",
    ...baseProvenance
  },
  {
    id: "complex-changwon",
    code: "KICOX-DEMO-CHANGWON",
    name: "창원국가산업단지",
    region: "경남",
    city: "창원",
    latitude: 35.2182,
    longitude: 128.6711,
    industries: ["정밀기계", "드론 부품", "산업용 전기히터", "모터", "항공부품"],
    tenantCount: 2900,
    operatingCount: 2650,
    operationRate: 75.6,
    employeeCount: 126000,
    matchReason: "정밀기계·항공·모터 기반 드론 및 산업용 부품 제조 권역",
    ...baseProvenance
  },
  {
    id: "complex-daedeok",
    code: "KICOX-DEMO-DAEDEOK",
    name: "대덕연구개발특구",
    region: "대전",
    city: "유성구",
    latitude: 36.383,
    longitude: 127.36,
    industries: ["드론 부품", "센서", "통신 모듈", "제어보드", "연구개발"],
    tenantCount: 1800,
    operatingCount: 1690,
    operationRate: 80.1,
    employeeCount: 72000,
    matchReason: "드론 제어·센서·통신 모듈 R&D와 시제품 제조 기반",
    ...baseProvenance
  },
  {
    id: "complex-gwangju첨단",
    code: "KICOX-DEMO-GWANGJU-ADV",
    name: "광주첨단과학산업단지",
    region: "광주",
    city: "북구",
    latitude: 35.226,
    longitude: 126.848,
    industries: ["LED 조명", "광융합", "스마트 조명", "전자부품"],
    tenantCount: 980,
    operatingCount: 905,
    operationRate: 73.5,
    employeeCount: 35000,
    matchReason: "광융합·LED 조명 관련 기업과 시험·인증 인프라 연계 권역",
    ...baseProvenance
  },
  {
    id: "complex-seongseo",
    code: "KICOX-DEMO-SEONGSEO",
    name: "성서산업단지",
    region: "대구",
    city: "달서구",
    latitude: 35.833,
    longitude: 128.49,
    industries: ["식품 포장필름", "플라스틱", "기계", "섬유패키징"],
    tenantCount: 3200,
    operatingCount: 2960,
    operationRate: 76.9,
    employeeCount: 64000,
    matchReason: "포장필름·플라스틱·기계 가공 기반의 내륙 제조 권역",
    ...baseProvenance
  }
];

function stringValue(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function numberValue(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.replaceAll(",", "")) : Number.NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function splitIndustries(value?: string): string[] {
  if (!value) return [];
  return Array.from(new Set(value.split(/[,/|·ㆍ;]/).map((item) => item.trim()).filter(Boolean))).slice(0, 12);
}

function industriesFromIndustryFields(row: Record<string, unknown>): string[] {
  return INDUSTRY_FIELDS.filter(([key]) => Number(numberValue(row, [key]) ?? 0) > 0)
    .sort((a, b) => Number(numberValue(row, [b[0]]) ?? 0) - Number(numberValue(row, [a[0]]) ?? 0))
    .map(([, label]) => label)
    .slice(0, 6);
}

function regionFromComplexName(name: string): string {
  if (/서울|디지털/.test(name)) return "서울";
  if (/인천|남동/.test(name)) return "인천";
  if (/반월|시화|안산|시흥|평택|파주|판교|성남/.test(name)) return "경기";
  if (/부산|녹산|명지/.test(name)) return "부산";
  if (/대구|성서/.test(name)) return "대구";
  if (/광주/.test(name)) return "광주";
  if (/대전|대덕/.test(name)) return "대전";
  if (/울산|미포|온산/.test(name)) return "울산";
  if (/구미|포항|경북/.test(name)) return "경북";
  if (/창원|마산|진해|경남/.test(name)) return "경남";
  if (/오송|청주|충북/.test(name)) return "충북";
  if (/천안|아산|충남/.test(name)) return "충남";
  if (/군산|전북/.test(name)) return "전북";
  if (/여수|광양|전남/.test(name)) return "전남";
  return "전국";
}

function normalizeKicoxIndustrialTrendRecord(record: unknown, index: number, fetchedAt: string): IndustrialComplexSummary {
  const row = (record && typeof record === "object" ? record : {}) as Record<string, unknown>;
  const name =
    stringValue(row, ["complexName", "indutyComplexName", "cmplxNm", "irsttNm", "단지명", "산업단지명"]) ??
    `KICOX 산업단지 후보 ${index + 1}`;
  const industries =
    splitIndustries(stringValue(row, ["industries", "industryMix", "mainIndustry", "업종", "주요업종"]));
  const fieldIndustries = industriesFromIndustryFields(row);
  const idSeed = stringValue(row, ["id", "complexCode", "cmplxCd", "단지코드", "irsttNm"]) ?? `${name}-${index}`;
  const tenantCount = numberValue(row, ["tenantCount", "companyCount", "monthMvnCmpCnt", "mvnCmpnyCo", "입주업체수", "total"]);

  return {
    id: `complex-api-${Buffer.from(idSeed).toString("base64url").slice(0, 24)}`,
    code: stringValue(row, ["code", "complexCode", "cmplxCd", "단지코드"]) ?? `KICOX-API-${index + 1}`,
    name,
    region: stringValue(row, ["region", "sido", "시도"]) ?? regionFromComplexName(name),
    city: stringValue(row, ["city", "sigungu", "시군구"]),
    latitude: numberValue(row, ["latitude", "lat", "위도"]),
    longitude: numberValue(row, ["longitude", "lng", "lon", "경도"]),
    industries: industries.length > 0 ? industries : fieldIndustries,
    tenantCount,
    operatingCount: numberValue(row, ["operatingCount", "operationCompanyCount", "monthOpCmpCnt", "totalOpCmpnyCo", "opCmpnyCo", "가동업체수"]),
    operationRate: numberValue(row, ["operationRate", "monthOpRate", "opRate", "가동률", "total"]),
    exportAmount: numberValue(row, ["exportAmount", "monthXportactAmount", "totalXportactAmount", "exportRec", "수출액"]),
    employeeCount: numberValue(row, ["employeeCount", "monthTotal", "empCo", "고용인원"]),
    matchReason: "산업단지 산업동향 API 정규화 후보",
    ...baseProvenance,
    fetchedAt,
    verification: "PARTIAL"
  };
}

function extractRecords(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];
  const root = raw as Record<string, unknown>;
  const response =
    root.response && typeof root.response === "object" ? (root.response as Record<string, unknown>) : root;
  const body = response.body && typeof response.body === "object" ? (response.body as Record<string, unknown>) : response;
  const items = body.items && typeof body.items === "object" ? (body.items as Record<string, unknown>) : body.items;
  if (Array.isArray(items)) return items;
  if (items && typeof items === "object" && Array.isArray((items as Record<string, unknown>).item)) return (items as Record<string, unknown>).item as unknown[];
  if (items && typeof items === "object" && (items as Record<string, unknown>).item) return [(items as Record<string, unknown>).item];
  if (Array.isArray(body.item)) return body.item;
  if (body.item && typeof body.item === "object") return [body.item];
  if (Array.isArray(root.data)) return root.data;
  return [];
}

function sanitizeUrl(url: URL): string {
  const sanitized = new URL(url.toString());
  for (const key of ["serviceKey", "ServiceKey", "apiKey", "apikey"]) {
    if (sanitized.searchParams.has(key)) sanitized.searchParams.set(key, "REDACTED");
  }
  return sanitized.toString();
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true
});

function parseApiPayload(payload: string): unknown {
  const trimmed = payload.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return JSON.parse(trimmed);
  return xmlParser.parse(trimmed);
}

async function fetchKicoxIndustrialTrendsApi(options: KicoxIndustrialTrendsFetchOptions): Promise<KicoxIndustrialTrendsResult> {
  const endpoint = process.env.KICOX_INDUSTRIAL_TRENDS_ENDPOINT || DEFAULT_KICOX_TRENDS_ENDPOINT;
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey) throw new Error("DATA_GO_KR_SERVICE_KEY가 없습니다.");

  const fetchedAt = new Date().toISOString();
  const url = new URL(endpoint);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "100");
  url.searchParams.set("type", "json");
  url.searchParams.set("stdrYm", process.env.KICOX_TRENDS_PERIOD || DEFAULT_KICOX_TRENDS_PERIOD);
  if (options.region && options.region !== "전국") url.searchParams.set("region", options.region);

  const response = await fetch(url, { headers: { accept: "application/json,application/xml,text/plain,*/*" } });
  if (!response.ok) throw new Error(`KICOX industrial trends API HTTP ${response.status}`);
  const raw = parseApiPayload(await response.text());
  const records = extractRecords(raw);
  return {
    complexes: records.map((record, index) => normalizeKicoxIndustrialTrendRecord(record, index, fetchedAt)),
    usedMock: false,
    fetchedAt,
    evidenceUrl: sanitizeUrl(url)
  };
}

function mockResult(warning?: string): KicoxIndustrialTrendsResult {
  return {
    complexes: MOCK_KICOX_INDUSTRIAL_COMPLEXES,
    usedMock: true,
    fetchedAt: source.fetchedAt,
    evidenceUrl: source.sourceUrl,
    warning
  };
}

export async function fetchKicoxIndustrialTrends(options: KicoxIndustrialTrendsFetchOptions = {}): Promise<KicoxIndustrialTrendsResult> {
  if (options.mock) return mockResult();
  try {
    const result = await fetchKicoxIndustrialTrendsApi(options);
    return result.complexes.length > 0 ? result : mockResult("KICOX 산업동향 API 응답에 산업단지 레코드가 없어 fallback 데이터를 사용했습니다.");
  } catch (error) {
    if (options.strict) throw error;
    return mockResult(error instanceof Error ? error.message : "KICOX 산업동향 API 조회 실패");
  }
}
