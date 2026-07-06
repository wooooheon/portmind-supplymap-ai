import { supplySource } from "@/lib/supplymap/data-sources";
import type { SupplierCandidate } from "@/lib/supplymap/types";

type KicoxFactoryFetchOptions = {
  query?: string;
  region?: string;
  mock?: boolean;
  strict?: boolean;
};

type KicoxFactoryResult = {
  suppliers: SupplierCandidate[];
  usedMock: boolean;
  fetchedAt: string;
  evidenceUrl: string;
  warning?: string;
};

const source = supplySource("kicox_factory_registry");
const DEFAULT_KICOX_FACTORY_ENDPOINT =
  "https://apis.data.go.kr/B550624/fctryRegistInfo/getFctryPrdctnService_v2";
const KICOX_FACTORY_BY_COMPLEX_ENDPOINT =
  "https://apis.data.go.kr/B550624/fctryRegistInfo/getFctryListInIrsttService_v2";

const baseProvenance = {
  providerName: source.providerName,
  datasetName: source.datasetName,
  sourceType: source.sourceType,
  sourceUrl: source.sourceUrl,
  fetchedAt: source.fetchedAt,
  license: source.license,
  verification: source.verification
};

export const MOCK_KICOX_FACTORY_SUPPLIERS: SupplierCandidate[] = [
  {
    id: "kicox-packaging-banwol-01",
    name: "KICOX 데모 식품포장 제조사 A",
    scope: "DOMESTIC",
    countryCode: "KR",
    countryName: "대한민국",
    region: "경기",
    city: "안산",
    address: "경기도 안산시 단원구 반월·시화국가산업단지",
    latitude: 37.321,
    longitude: 126.731,
    products: ["식품용 플라스틱 포장용기", "밀폐용기", "용기 뚜껑"],
    hsCodes: ["392330", "392350", "392390"],
    industrialComplex: "반월·시화국가산업단지",
    description: "플라스틱 사출·압출 기반 식품 포장용기 제조 mock 레코드",
    matchReason: "식품 포장용기 생산품과 수도권 산업단지 입지 일치",
    ...baseProvenance
  },
  {
    id: "kicox-packaging-noksan-02",
    name: "KICOX 데모 식품패키징 제조사 B",
    scope: "DOMESTIC",
    countryCode: "KR",
    countryName: "대한민국",
    region: "부산",
    city: "강서구",
    address: "부산광역시 강서구 명지·녹산국가산업단지",
    latitude: 35.106,
    longitude: 128.858,
    products: ["식품 소분 포장", "플라스틱 트레이", "포장 부자재"],
    hsCodes: ["392390", "190590"],
    industrialComplex: "명지·녹산국가산업단지",
    description: "식품 가공·포장과 부산항 물류 접근성을 가진 mock 레코드",
    matchReason: "식품·포장 키워드와 항만 물류 입지 일치",
    ...baseProvenance
  },
  {
    id: "kicox-packaging-daegu-03",
    name: "KICOX 데모 패키징 필름 제조사 C",
    scope: "DOMESTIC",
    countryCode: "KR",
    countryName: "대한민국",
    region: "대구",
    city: "달서구",
    address: "대구광역시 달서구 성서산업단지",
    latitude: 35.833,
    longitude: 128.49,
    products: ["식품 포장필름", "플라스틱 용기", "라벨 패키지"],
    hsCodes: ["392010", "392330", "392390"],
    industrialComplex: "성서산업단지",
    description: "필름·용기·라벨 패키징 공정을 보유한 mock 레코드",
    matchReason: "포장재·용기 생산품 키워드 일치",
    ...baseProvenance
  },
  {
    id: "kicox-heater-gumi-01",
    name: "KICOX 데모 전열기기 제조사 A",
    scope: "DOMESTIC",
    countryCode: "KR",
    countryName: "대한민국",
    region: "경북",
    city: "구미",
    address: "경상북도 구미시 구미국가산업단지",
    latitude: 36.117,
    longitude: 128.374,
    products: ["전기히터", "PTC 히터 모듈", "전열 부품"],
    hsCodes: ["851629", "851680"],
    industrialComplex: "구미국가산업단지",
    description: "전기전자 부품 기반 전열기기 제조 mock 레코드",
    matchReason: "전기히터·전열 부품 생산품과 전기전자 집적단지 일치",
    ...baseProvenance
  },
  {
    id: "kicox-heater-namdong-02",
    name: "KICOX 데모 소형가전 제조사 B",
    scope: "DOMESTIC",
    countryCode: "KR",
    countryName: "대한민국",
    region: "인천",
    city: "남동구",
    address: "인천광역시 남동구 남동국가산업단지",
    latitude: 37.405,
    longitude: 126.692,
    products: ["전기히터 완제품", "온풍기", "온도조절기"],
    hsCodes: ["851629", "851610", "903210"],
    industrialComplex: "남동국가산업단지",
    description: "소형 전열가전 조립·검사 기반 mock 레코드",
    matchReason: "전기히터 완제품과 수도권 조달 입지 일치",
    ...baseProvenance
  },
  {
    id: "kicox-heater-changwon-03",
    name: "KICOX 데모 산업용히터 제조사 C",
    scope: "DOMESTIC",
    countryCode: "KR",
    countryName: "대한민국",
    region: "경남",
    city: "창원",
    address: "경상남도 창원시 창원국가산업단지",
    latitude: 35.218,
    longitude: 128.671,
    products: ["산업용 전기히터", "열교환 부품", "히팅 모듈"],
    hsCodes: ["851680", "841950"],
    industrialComplex: "창원국가산업단지",
    description: "기계·전장 융합 산업용 히터 제조 mock 레코드",
    matchReason: "히터·열교환 부품과 기계 산업단지 역량 일치",
    ...baseProvenance
  },
  {
    id: "kicox-led-gumi-01",
    name: "KICOX 데모 LED 모듈 제조사 A",
    scope: "DOMESTIC",
    countryCode: "KR",
    countryName: "대한민국",
    region: "경북",
    city: "구미",
    address: "경상북도 구미시 구미국가산업단지",
    latitude: 36.118,
    longitude: 128.37,
    products: ["LED 조명 모듈", "PCB 실장", "조명 제어보드"],
    hsCodes: ["940542", "853950", "853400"],
    industrialComplex: "구미국가산업단지",
    description: "전자부품·조명 모듈 생산 기반 mock 레코드",
    matchReason: "LED 조명·PCB 생산품과 전기전자 집적 일치",
    ...baseProvenance
  },
  {
    id: "kicox-led-gwangju-02",
    name: "KICOX 데모 광융합 조명 제조사 B",
    scope: "DOMESTIC",
    countryCode: "KR",
    countryName: "대한민국",
    region: "광주",
    city: "북구",
    address: "광주광역시 북구 첨단과학산업단지",
    latitude: 35.226,
    longitude: 126.848,
    products: ["LED 실내조명", "광학렌즈", "스마트 조명"],
    hsCodes: ["940542", "940549"],
    industrialComplex: "광주첨단과학산업단지",
    description: "광융합·LED 조명 완제품 제조 mock 레코드",
    matchReason: "LED 조명 완제품과 광융합 산업단지 일치",
    ...baseProvenance
  },
  {
    id: "kicox-led-namdong-03",
    name: "KICOX 데모 조명기구 제조사 C",
    scope: "DOMESTIC",
    countryCode: "KR",
    countryName: "대한민국",
    region: "인천",
    city: "남동구",
    address: "인천광역시 남동구 남동국가산업단지",
    latitude: 37.407,
    longitude: 126.69,
    products: ["LED 등기구", "방열 하우징", "전원공급장치"],
    hsCodes: ["940542", "850440"],
    industrialComplex: "남동국가산업단지",
    description: "LED 조명기구 조립과 방열부품 제조 mock 레코드",
    matchReason: "LED 등기구·전원부 생산품과 수도권 입지 일치",
    ...baseProvenance
  },
  {
    id: "kicox-cosmetic-container-banwol-01",
    name: "KICOX 데모 화장품용기 제조사 A",
    scope: "DOMESTIC",
    countryCode: "KR",
    countryName: "대한민국",
    region: "경기",
    city: "안산",
    address: "경기도 안산시 단원구 반월·시화국가산업단지",
    latitude: 37.318,
    longitude: 126.735,
    products: ["화장품 플라스틱 용기", "펌프캡", "크림 자 용기"],
    hsCodes: ["392330", "392350", "392390"],
    industrialComplex: "반월·시화국가산업단지",
    description: "화장품 패키징 사출·조립 기반 mock 레코드",
    matchReason: "화장품 용기·캡 생산품과 수도권 패키징 집적 일치",
    ...baseProvenance
  },
  {
    id: "kicox-cosmetic-container-osong-02",
    name: "KICOX 데모 바이오패키징 제조사 B",
    scope: "DOMESTIC",
    countryCode: "KR",
    countryName: "대한민국",
    region: "충북",
    city: "청주",
    address: "충청북도 청주시 오송생명과학단지",
    latitude: 36.632,
    longitude: 127.325,
    products: ["화장품 용기", "기능성 세럼 패키지", "클린룸 포장"],
    hsCodes: ["392330", "392390", "330499"],
    industrialComplex: "오송생명과학단지",
    description: "바이오·화장품 연관 패키징 mock 레코드",
    matchReason: "화장품 용기와 바이오·화장품 산업단지 연계",
    ...baseProvenance
  },
  {
    id: "kicox-cosmetic-container-namdong-03",
    name: "KICOX 데모 튜브용기 제조사 C",
    scope: "DOMESTIC",
    countryCode: "KR",
    countryName: "대한민국",
    region: "인천",
    city: "남동구",
    address: "인천광역시 남동구 남동국가산업단지",
    latitude: 37.406,
    longitude: 126.691,
    products: ["화장품 튜브 용기", "라벨링", "펌프 디스펜서"],
    hsCodes: ["392330", "392350"],
    industrialComplex: "남동국가산업단지",
    description: "화장품 튜브·디스펜서 부품 제조 mock 레코드",
    matchReason: "화장품 용기·펌프 디스펜서 생산품 일치",
    ...baseProvenance
  },
  {
    id: "kicox-drone-daedeok-01",
    name: "KICOX 데모 드론제어부품 제조사 A",
    scope: "DOMESTIC",
    countryCode: "KR",
    countryName: "대한민국",
    region: "대전",
    city: "유성구",
    address: "대전광역시 유성구 대덕연구개발특구",
    latitude: 36.383,
    longitude: 127.36,
    products: ["드론 제어보드", "통신 모듈", "센서 보드"],
    hsCodes: ["880790", "852990", "854231"],
    industrialComplex: "대덕연구개발특구",
    description: "드론 전장·센서 모듈 개발 기반 mock 레코드",
    matchReason: "드론 부품·제어보드와 연구개발 집적지 일치",
    ...baseProvenance
  },
  {
    id: "kicox-drone-changwon-02",
    name: "KICOX 데모 드론기체부품 제조사 B",
    scope: "DOMESTIC",
    countryCode: "KR",
    countryName: "대한민국",
    region: "경남",
    city: "창원",
    address: "경상남도 창원시 창원국가산업단지",
    latitude: 35.219,
    longitude: 128.672,
    products: ["드론 프레임", "정밀 가공 부품", "모터 하우징"],
    hsCodes: ["880790", "850131", "761699"],
    industrialComplex: "창원국가산업단지",
    description: "정밀기계·항공부품 가공 기반 mock 레코드",
    matchReason: "드론 프레임·정밀가공 부품과 기계 산업단지 일치",
    ...baseProvenance
  },
  {
    id: "kicox-drone-gumi-03",
    name: "KICOX 데모 드론전장 제조사 C",
    scope: "DOMESTIC",
    countryCode: "KR",
    countryName: "대한민국",
    region: "경북",
    city: "구미",
    address: "경상북도 구미시 구미국가산업단지",
    latitude: 36.116,
    longitude: 128.372,
    products: ["드론 배터리팩", "ESC 모듈", "소형 전자부품"],
    hsCodes: ["880790", "850760", "853710"],
    industrialComplex: "구미국가산업단지",
    description: "드론 전장·배터리팩 조립 기반 mock 레코드",
    matchReason: "드론 전장부품과 구미 전기전자 산업 집적 일치",
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

function splitProducts(value?: string): string[] {
  if (!value) return [];
  return Array.from(new Set(value.split(/[,/|·ㆍ;]/).map((item) => item.trim()).filter(Boolean))).slice(0, 8);
}

function regionFromAddress(address?: string): string | undefined {
  if (!address) return undefined;
  const match = address.match(/^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주|[가-힣]+도|[가-힣]+광역시)/);
  if (!match) return undefined;
  return match[1]
    .replace("광역시", "")
    .replace("특별시", "")
    .replace("특별자치시", "")
    .replace("특별자치도", "")
    .replace("도", "");
}

function normalizeKicoxFactoryRecord(record: unknown, index: number, fetchedAt: string): SupplierCandidate {
  const row = (record && typeof record === "object" ? record : {}) as Record<string, unknown>;
  const name =
    stringValue(row, ["factoryName", "fctryNm", "FCTRY_NM", "cmpnyNm", "CMPNY_NM", "companyName", "업체명", "공장명"]) ??
    `KICOX 공장등록 후보 ${index + 1}`;
  const address =
    stringValue(row, ["address", "factoryAddress", "FCTRY_ADDR", "rnAdres", "rdnmadr", "소재지", "주소"]) ??
    stringValue(row, ["lotnoAddr", "지번주소"]);
  const productText =
    stringValue(row, ["products", "productName", "PRDLST_NM", "mainProductCn", "mainProduct", "생산품", "주요생산품"]) ??
    stringValue(row, ["industryName", "업종명"]);
  const industrialComplex = stringValue(row, ["industrialComplex", "complexName", "irsttNm", "단지명", "산업단지명"]);
  const idSeed = stringValue(row, ["id", "factoryId", "FCTRY_ID", "fctryManageNo", "MNG_NO", "관리번호"]) ?? `${name}-${address ?? index}`;

  return {
    id: `kicox-api-${Buffer.from(idSeed).toString("base64url").slice(0, 24)}`,
    name,
    scope: "DOMESTIC",
    countryCode: "KR",
    countryName: "대한민국",
    region: stringValue(row, ["region", "시도"]) ?? regionFromAddress(address),
    city: stringValue(row, ["city", "시군구"]),
    address,
    latitude: Number(stringValue(row, ["latitude", "lat", "위도"]) ?? Number.NaN) || undefined,
    longitude: Number(stringValue(row, ["longitude", "lng", "lon", "경도"]) ?? Number.NaN) || undefined,
    products: splitProducts(productText),
    hsCodes: splitProducts(stringValue(row, ["hsCodes", "hsCode", "HS_CODE", "품목번호"])),
    industrialComplex,
    description: "한국산업단지공단 공장등록생산정보 API 정규화 후보",
    matchReason: "공장등록생산정보 생산품·주소 기반 후보",
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

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .trim();
}

function parseKicoxXml(xml: string): Record<string, unknown> {
  const resultCode = xml.match(/<resultCode>([\s\S]*?)<\/resultCode>/)?.[1];
  const resultMsg = xml.match(/<resultMsg>([\s\S]*?)<\/resultMsg>/)?.[1];
  const totalCount = xml.match(/<totalCount>([\s\S]*?)<\/totalCount>/)?.[1];
  const itemMatches = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g));
  const item = itemMatches.map((match) => {
    const record: Record<string, string> = {};
    for (const field of match[1].matchAll(/<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g)) {
      record[field[1]] = decodeXml(field[2]);
    }
    return record;
  });

  return {
    response: {
      header: {
        resultCode: resultCode ? decodeXml(resultCode) : undefined,
        resultMsg: resultMsg ? decodeXml(resultMsg) : undefined
      },
      body: {
        items: { item },
        totalCount: totalCount ? decodeXml(totalCount) : String(item.length)
      }
    }
  };
}

function sanitizeUrl(url: URL): string {
  const sanitized = new URL(url.toString());
  for (const key of ["serviceKey", "ServiceKey", "apiKey", "apikey"]) {
    if (sanitized.searchParams.has(key)) sanitized.searchParams.set(key, "REDACTED");
  }
  return sanitized.toString();
}

function uniqueValues(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

function queryTerms(query?: string): string[] {
  if (!query) return [];
  const stopWords = new Set(["수입", "무역", "공장", "업체", "후보", "찾아줘", "관련", "제품", "부품"]);
  const tokens = query
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !stopWords.has(token));
  return uniqueValues([query, ...tokens]).slice(0, 4);
}

function industrialComplexNames(region?: string): string[] {
  if (!region || region === "전국") return [];
  if (/안산|경기|반월/i.test(region)) return ["반월국가산업단지"];
  if (/시흥|시화/i.test(region)) return ["시화국가산업단지"];
  if (/인천|남동/i.test(region)) return ["남동국가산업단지"];
  if (/구미|경북/i.test(region)) return ["구미국가산업단지"];
  if (/창원|경남/i.test(region)) return ["창원국가산업단지"];
  if (/서울|구로|가산/i.test(region)) return ["서울디지털국가산업단지"];
  if (/부산|녹산/i.test(region)) return ["명지녹산국가산업단지"];
  return [];
}

async function fetchKicoxUrl(url: URL): Promise<unknown> {
  const response = await fetch(url, { headers: { accept: "application/json,application/xml,text/plain,*/*" } });
  if (!response.ok) throw new Error(`KICOX factory API HTTP ${response.status}`);
  const text = await response.text();
  const trimmed = text.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return JSON.parse(trimmed);
  return parseKicoxXml(trimmed);
}

function hasNormalService(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const root = raw as Record<string, unknown>;
  const response =
    root.response && typeof root.response === "object" ? (root.response as Record<string, unknown>) : root;
  const header = response.header && typeof response.header === "object" ? (response.header as Record<string, unknown>) : {};
  return header.resultCode === "00" || !header.resultCode;
}

function dedupeSuppliers(suppliers: SupplierCandidate[]): SupplierCandidate[] {
  const seen = new Set<string>();
  return suppliers.filter((supplier) => {
    const key = `${supplier.name}|${supplier.address ?? ""}|${supplier.industrialComplex ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchKicoxFactoryApi(options: KicoxFactoryFetchOptions): Promise<KicoxFactoryResult> {
  const endpoint = process.env.KICOX_FACTORY_REGISTRY_ENDPOINT || DEFAULT_KICOX_FACTORY_ENDPOINT;
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey) throw new Error("DATA_GO_KR_SERVICE_KEY가 없습니다.");

  const fetchedAt = new Date().toISOString();
  const urls: URL[] = [];

  for (const term of queryTerms(options.query)) {
    const url = new URL(endpoint);
    url.searchParams.set("serviceKey", serviceKey);
    url.searchParams.set("pageNo", "1");
    url.searchParams.set("numOfRows", "50");
    url.searchParams.set("type", "json");
    url.searchParams.set("cmpnyNm", term);
    url.searchParams.set("mainProductCn", term);
    urls.push(url);
  }

  for (const irsttNm of industrialComplexNames(options.region)) {
    const url = new URL(KICOX_FACTORY_BY_COMPLEX_ENDPOINT);
    url.searchParams.set("serviceKey", serviceKey);
    url.searchParams.set("pageNo", "1");
    url.searchParams.set("numOfRows", "100");
    url.searchParams.set("type", "json");
    url.searchParams.set("irsttNm", irsttNm);
    urls.push(url);
  }

  if (urls.length === 0) {
    const url = new URL(endpoint);
    url.searchParams.set("serviceKey", serviceKey);
    url.searchParams.set("pageNo", "1");
    url.searchParams.set("numOfRows", "50");
    url.searchParams.set("type", "json");
    url.searchParams.set("cmpnyNm", "제조");
    urls.push(url);
  }

  const records: unknown[] = [];
  let evidenceUrl = sanitizeUrl(urls[0]);
  for (const url of urls) {
    const raw = await fetchKicoxUrl(url);
    if (!hasNormalService(raw)) continue;
    records.push(...extractRecords(raw));
    evidenceUrl = sanitizeUrl(url);
  }
  const suppliers = dedupeSuppliers(records.map((record, index) => normalizeKicoxFactoryRecord(record, index, fetchedAt)));
  return {
    suppliers,
    usedMock: false,
    fetchedAt,
    evidenceUrl
  };
}

function mockResult(warning?: string): KicoxFactoryResult {
  return {
    suppliers: MOCK_KICOX_FACTORY_SUPPLIERS,
    usedMock: true,
    fetchedAt: source.fetchedAt,
    evidenceUrl: source.sourceUrl,
    warning
  };
}

export async function fetchKicoxFactorySuppliers(options: KicoxFactoryFetchOptions = {}): Promise<KicoxFactoryResult> {
  if (options.mock) return mockResult();
  try {
    const result = await fetchKicoxFactoryApi(options);
    return result.suppliers.length > 0 ? result : mockResult("KICOX 공장등록 API 응답에 후보 레코드가 없어 fallback 데이터를 사용했습니다.");
  } catch (error) {
    if (options.strict) throw error;
    return mockResult(error instanceof Error ? error.message : "KICOX 공장등록 API 조회 실패");
  }
}
