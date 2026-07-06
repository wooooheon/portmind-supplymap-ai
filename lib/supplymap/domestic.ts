import { prisma } from "@/lib/db/prisma";
import { MOCK_COMPLEXES, MOCK_DOMESTIC_SUPPLIERS } from "./mock-data";
import { fetchKicoxFactorySuppliers } from "./adapters/kicox-factory";
import { fetchKicoxIndustrialTrends } from "./adapters/kicox-industrial-trends";
import type {
  IndustrialComplexSummary,
  ProductIntent,
  SupplierCandidate,
  SupplySourceType,
  VerificationStatus
} from "./types";

const PRODUCT_ALIASES = [
  ["포장", "용기", "보틀", "병", "캡", "뚜껑", "패키지", "packaging"],
  ["화장품용기", "화장품 용기", "펌프캡", "튜브용기", "디스펜서", "cosmeticcontainer"],
  ["전기히터", "전열기", "온풍기", "ptc히터", "히팅", "heater", "heating"],
  ["led", "조명", "등기구", "스마트조명", "광융합", "lighting"],
  ["드론", "무인기", "제어보드", "센서", "esc", "프레임", "drone"],
  ["과자", "비스킷", "스낵", "가공식품", "식품", "food"],
  ["전자", "전자제품", "전자부품", "블루투스", "스피커", "pcb"],
  ["화장품", "크림", "로션", "세럼", "코스메틱", "cosmetic"],
  ["의료기기", "체온계", "진단", "임플란트", "medical"],
  ["이차전지", "2차전지", "배터리", "리튬이온", "battery"],
  ["자동차부품", "자동차 부품", "전장", "전기차", "모빌리티", "ev"],
  ["반도체", "웨이퍼", "전력반도체", "semiconductor"],
  ["산업용로봇", "산업용 로봇", "로봇", "자동화", "스마트팩토리"]
].map((group) => group.map(normalizeText));

const REGION_ALIASES: Record<string, string> = {
  서울특별시: "서울",
  부산광역시: "부산",
  대구광역시: "대구",
  인천광역시: "인천",
  광주광역시: "광주",
  대전광역시: "대전",
  울산광역시: "울산",
  세종특별자치시: "세종",
  경기도: "경기",
  강원특별자치도: "강원",
  강원도: "강원",
  충청북도: "충북",
  충청남도: "충남",
  전북특별자치도: "전북",
  전라북도: "전북",
  전라남도: "전남",
  경상북도: "경북",
  경상남도: "경남",
  제주특별자치도: "제주"
};

const MOTIE_FACTORY_PROVENANCE = {
  providerName: "한국산업단지공단",
  datasetName: "공장등록생산정보조회서비스",
  sourceType: "MOTIE_PUBLIC" as const,
  sourceUrl: "https://www.data.go.kr/data/15100060/standard.do",
  fetchedAt: "2026-07-04T00:00:00.000Z",
  license: "공공데이터포털 이용조건 준수",
  verification: "MOCK" as const
};

const MOTIE_COMPLEX_PROVENANCE = {
  providerName: "한국산업단지공단",
  datasetName: "산업동향조사 통계 조회 서비스",
  sourceType: "MOTIE_PUBLIC" as const,
  sourceUrl: "https://www.data.go.kr/data/15152884/openapi.do",
  fetchedAt: "2026-07-04T00:00:00.000Z",
  license: "공공데이터포털 이용조건 준수",
  verification: "MOCK" as const
};

const SECTOR_DEMO_SUPPLIERS: SupplierCandidate[] = [
  {
    id: "domestic-battery-ochang",
    name: "KICOX 데모 이차전지 제조사 D",
    scope: "DOMESTIC",
    countryCode: "KR",
    countryName: "대한민국",
    region: "충북",
    city: "청주",
    address: "충청북도 청주시 오창과학산업단지",
    latitude: 36.7138,
    longitude: 127.4324,
    products: ["리튬이온 이차전지", "배터리 셀 부품", "양극재"],
    hsCodes: ["850760", "284190"],
    industrialComplex: "오창과학산업단지",
    description: "샘플 fallback 기업입니다. 실제 생산품과 공급능력은 원문 재조회가 필요합니다.",
    matchReason: "이차전지·배터리 생산품 키워드 일치",
    ...MOTIE_FACTORY_PROVENANCE
  },
  {
    id: "domestic-robot-changwon",
    name: "KICOX 데모 정밀로봇 제조사 E",
    scope: "DOMESTIC",
    countryCode: "KR",
    countryName: "대한민국",
    region: "경남",
    city: "창원",
    address: "경상남도 창원시 창원국가산업단지",
    latitude: 35.2182,
    longitude: 128.6711,
    products: ["산업용 로봇", "정밀 감속기", "자동화 설비"],
    hsCodes: ["847950", "848340"],
    industrialComplex: "창원국가산업단지",
    description: "샘플 fallback 기업입니다. 실제 생산품과 공급능력은 원문 재조회가 필요합니다.",
    matchReason: "로봇·자동화 생산품 키워드 일치",
    ...MOTIE_FACTORY_PROVENANCE
  },
  {
    id: "domestic-auto-ulsan",
    name: "KICOX 데모 모빌리티부품 제조사 F",
    scope: "DOMESTIC",
    countryCode: "KR",
    countryName: "대한민국",
    region: "울산",
    city: "울산",
    address: "울산광역시 울산·미포국가산업단지",
    latitude: 35.516,
    longitude: 129.3685,
    products: ["자동차 전장부품", "전기차 구동부품", "배터리 팩"],
    hsCodes: ["870899", "850760"],
    industrialComplex: "울산·미포국가산업단지",
    description: "샘플 fallback 기업입니다. 실제 생산품과 공급능력은 원문 재조회가 필요합니다.",
    matchReason: "자동차·전기차 부품 생산 키워드 일치",
    ...MOTIE_FACTORY_PROVENANCE
  },
  {
    id: "domestic-semiconductor-gumi",
    name: "KICOX 데모 전력반도체 제조사 G",
    scope: "DOMESTIC",
    countryCode: "KR",
    countryName: "대한민국",
    region: "경북",
    city: "구미",
    address: "경상북도 구미시 구미국가산업단지",
    latitude: 36.117,
    longitude: 128.374,
    products: ["전력반도체", "다이오드", "반도체 모듈"],
    hsCodes: ["854110", "854129"],
    industrialComplex: "구미국가산업단지",
    description: "샘플 fallback 기업입니다. 실제 생산품과 공급능력은 원문 재조회가 필요합니다.",
    matchReason: "반도체·전자부품 생산 키워드 일치",
    ...MOTIE_FACTORY_PROVENANCE
  },
  {
    id: "domestic-medical-osong",
    name: "KICOX 데모 바이오의료 제조사 H",
    scope: "DOMESTIC",
    countryCode: "KR",
    countryName: "대한민국",
    region: "충북",
    city: "청주",
    address: "충청북도 청주시 오송생명과학단지",
    latitude: 36.6325,
    longitude: 127.3248,
    products: ["의료기기", "체외진단기기", "바이오 진단시약"],
    hsCodes: ["901890", "382200"],
    industrialComplex: "오송생명과학단지",
    description: "샘플 fallback 기업입니다. 실제 생산품과 인허가는 원문 재조회가 필요합니다.",
    matchReason: "의료기기·진단 생산품 키워드 일치",
    ...MOTIE_FACTORY_PROVENANCE
  },
  {
    id: "domestic-cosmetics-osong",
    name: "KICOX 데모 바이오화장품 제조사 I",
    scope: "DOMESTIC",
    countryCode: "KR",
    countryName: "대한민국",
    region: "충북",
    city: "청주",
    address: "충청북도 청주시 오송생명과학단지",
    latitude: 36.6325,
    longitude: 127.3248,
    products: ["기초 화장품", "보습 크림", "기능성 세럼"],
    hsCodes: ["330499"],
    industrialComplex: "오송생명과학단지",
    description: "샘플 fallback 기업입니다. 실제 생산품과 인허가는 원문 재조회가 필요합니다.",
    matchReason: "화장품·크림 생산품 키워드 일치",
    ...MOTIE_FACTORY_PROVENANCE
  }
];

const SECTOR_DEMO_COMPLEXES: IndustrialComplexSummary[] = [
  {
    id: "complex-ochang",
    code: "KICOX-DEMO-OCHANG",
    name: "오창과학산업단지",
    region: "충북",
    city: "청주",
    latitude: 36.7138,
    longitude: 127.4324,
    industries: ["이차전지", "전자부품", "정밀화학"],
    matchReason: "이차전지·전자부품 산업 집적 기반",
    ...MOTIE_COMPLEX_PROVENANCE
  },
  {
    id: "complex-changwon",
    code: "KICOX-DEMO-CHANGWON",
    name: "창원국가산업단지",
    region: "경남",
    city: "창원",
    latitude: 35.2182,
    longitude: 128.6711,
    industries: ["산업용 로봇", "자동화", "정밀기계"],
    matchReason: "기계·로봇·자동화 산업 집적 기반",
    ...MOTIE_COMPLEX_PROVENANCE
  },
  {
    id: "complex-ulsan-mipo",
    code: "KICOX-DEMO-ULSAN-MIPO",
    name: "울산·미포국가산업단지",
    region: "울산",
    city: "울산",
    latitude: 35.516,
    longitude: 129.3685,
    industries: ["자동차부품", "전기차", "운송장비"],
    matchReason: "자동차·모빌리티 산업 집적 기반",
    ...MOTIE_COMPLEX_PROVENANCE
  },
  {
    id: "complex-osong",
    code: "KICOX-DEMO-OSONG",
    name: "오송생명과학단지",
    region: "충북",
    city: "청주",
    latitude: 36.6325,
    longitude: 127.3248,
    industries: ["의료기기", "바이오", "진단", "화장품"],
    matchReason: "바이오·의료기기 산업 집적 기반",
    ...MOTIE_COMPLEX_PROVENANCE
  }
];

const DOMESTIC_DEMO_SUPPLIERS = [...MOCK_DOMESTIC_SUPPLIERS, ...SECTOR_DEMO_SUPPLIERS];
const DOMESTIC_DEMO_COMPLEXES = [...MOCK_COMPLEXES, ...SECTOR_DEMO_COMPLEXES];

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/\(주\)|주식회사|㈜/g, "")
    .replace(/[^0-9a-z가-힣]+/g, "");
}

function normalizeRegion(value: string): string {
  let normalized = value.normalize("NFKC").replace(/\s+/g, "");
  for (const [longName, shortName] of Object.entries(REGION_ALIASES)) {
    normalized = normalized.replaceAll(longName, shortName);
  }
  return normalizeText(normalized);
}

function normalizeHsCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

function expandedKeywords(intent: ProductIntent): string[] {
  const queryTerms = [intent.query, intent.category, ...intent.keywords].map(normalizeText).filter((term) => term.length >= 2);
  const expanded = new Set(queryTerms);
  for (const group of PRODUCT_ALIASES) {
    if (group.some((alias) => queryTerms.some((term) => term.includes(alias) || alias.includes(term)))) {
      group.forEach((alias) => expanded.add(alias));
    }
  }
  return [...expanded];
}

function parseArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function textScore(text: string, intent: ProductIntent): number {
  const normalized = normalizeText(text);
  return expandedKeywords(intent).reduce((score, keyword) => score + (normalized.includes(keyword) ? 1 : 0), 0);
}

function matchesRegion(region: string | undefined, preferredRegion: string | undefined): boolean {
  if (!preferredRegion || preferredRegion === "전국") return true;
  if (!region) return false;
  const candidate = normalizeRegion(region);
  const requested = normalizeRegion(preferredRegion);
  return candidate.includes(requested) || requested.includes(candidate);
}

function hsMatch(candidate: SupplierCandidate, intent: ProductIntent): string | null {
  const requested = Array.from(new Set([intent.hsCode, ...intent.hsCodeCandidates].filter(Boolean) as string[]))
    .map(normalizeHsCode)
    .filter((code) => code.length >= 4);
  if (requested.length === 0) return "";

  return (
    candidate.hsCodes
      .map(normalizeHsCode)
      .find((candidateCode) =>
        requested.some(
          (requestedCode) =>
            candidateCode === requestedCode || candidateCode.startsWith(requestedCode) || requestedCode.startsWith(candidateCode)
        )
      ) ?? null
  );
}

function inferIndustrialComplexFromText(text: string): string | undefined {
  if (/안산|단원구|성곡동|원시동|목내동|초지동/.test(text)) return "반월국가산업단지";
  if (/시흥|정왕동|시화|군자천로/.test(text)) return "시화국가산업단지";
  if (/인천|남동구|남촌동|고잔동/.test(text)) return "남동국가산업단지";
  if (/구로|가산|금천/.test(text)) return "서울디지털국가산업단지";
  if (/구미/.test(text)) return "구미국가산업단지";
  if (/창원|성산구|의창구/.test(text)) return "창원국가산업단지";
  if (/녹산|명지|부산광역시 강서구/.test(text)) return "명지녹산국가산업단지";
  if (/오송|청주.*오송/.test(text)) return "오송생명과학단지";
  if (/광주.*첨단|첨단과학/.test(text)) return "광주첨단과학국가산업단지";
  return undefined;
}

function sameComplexName(left: string, right: string): boolean {
  const a = normalizeText(left);
  const b = normalizeText(right);
  return a === b || a.includes(b) || b.includes(a);
}

function sourcePriority(candidate: Pick<SupplierCandidate, "sourceType">): number {
  if (candidate.sourceType === "MOTIE_PUBLIC") return 0;
  if (candidate.sourceType === "OTHER_PUBLIC") return 1;
  if (candidate.sourceType === "USER_UPLOAD") return 2;
  return 3;
}

function verificationPriority(candidate: Pick<SupplierCandidate | IndustrialComplexSummary, "verification">): number {
  if (candidate.verification === "VERIFIED") return 0;
  if (candidate.verification === "PARTIAL") return 1;
  if (candidate.verification === "CHECK_REQUIRED") return 2;
  return 3;
}

function rankDomestic(candidates: SupplierCandidate[], intent: ProductIntent): SupplierCandidate[] {
  return candidates
    .map((candidate) => {
      const productText = [candidate.products.join(" "), candidate.description, candidate.industrialComplex].filter(Boolean).join(" ");
      const keywordHits = textScore(productText, intent);
      const regionMatched = matchesRegion(
        [candidate.region, candidate.city, candidate.address, candidate.industrialComplex].filter(Boolean).join(" "),
        intent.preferredRegion
      );
      const matchedHsCode = hsMatch(candidate, intent);
      const rank = keywordHits * 10 + (matchedHsCode ? 6 : 0) + (regionMatched && intent.preferredRegion !== "전국" ? 5 : 0);
      return { candidate, keywordHits, matchedHsCode, regionMatched, rank };
    })
    .filter((item) => item.keywordHits > 0 && (item.matchedHsCode !== null || item.candidate.hsCodes.length === 0))
    .sort(
      (a, b) =>
        sourcePriority(a.candidate) - sourcePriority(b.candidate) ||
        verificationPriority(a.candidate) - verificationPriority(b.candidate) ||
        b.rank - a.rank ||
        a.candidate.name.localeCompare(b.candidate.name, "ko") ||
        a.candidate.id.localeCompare(b.candidate.id)
    )
    .map((item) => ({
      ...item.candidate,
      matchReason: [
        item.candidate.sourceType === "MOTIE_PUBLIC" ? "산업부·KICOX 공공데이터 우선" : null,
        `국내 매칭점수 ${Math.min(100, 45 + item.keywordHits * 12 + (item.matchedHsCode ? 10 : 0) + (item.regionMatched ? 8 : 0))}점`,
        `생산품 키워드 ${item.keywordHits}개 일치`,
        item.matchedHsCode ? `HS ${item.matchedHsCode} 계열 일치` : "HS 매핑 확인 필요",
        intent.preferredRegion !== "전국"
          ? item.regionMatched
            ? `${intent.preferredRegion} 지역 일치`
            : `${intent.preferredRegion} 지역 조건은 추가 확인`
          : null
      ]
        .filter(Boolean)
        .join(" · ")
    }))
    .slice(0, 6);
}

function rankComplexes(complexes: IndustrialComplexSummary[], intent: ProductIntent): IndustrialComplexSummary[] {
  return complexes
    .map((complex) => {
      const keywordHits = textScore(complex.industries.join(" ") + " " + complex.matchReason, intent);
      const regionMatched = matchesRegion(`${complex.region} ${complex.city ?? ""}`, intent.preferredRegion);
      return { complex, keywordHits, regionMatched, rank: keywordHits * 10 + (regionMatched ? 5 : 0) };
    })
    .filter((item) => item.keywordHits > 0)
    .sort(
      (a, b) =>
        sourcePriority(a.complex) - sourcePriority(b.complex) ||
        verificationPriority(a.complex) - verificationPriority(b.complex) ||
        Math.log10((b.complex.tenantCount ?? 0) + 1) - Math.log10((a.complex.tenantCount ?? 0) + 1) ||
        b.rank - a.rank ||
        a.complex.name.localeCompare(b.complex.name, "ko")
    )
    .map((item) => item.complex)
    .slice(0, 4);
}

function linkedComplexesForCandidates(
  candidates: SupplierCandidate[],
  complexes: IndustrialComplexSummary[]
): IndustrialComplexSummary[] {
  const candidateComplexes = candidates
    .map((candidate) => candidate.industrialComplex)
    .filter((name): name is string => Boolean(name));

  return candidateComplexes
    .flatMap((name) =>
      complexes
        .filter((complex) => sameComplexName(name, complex.name))
        .map((complex) => ({
          ...complex,
          matchReason: `상위 국내 후보가 입주한 산업단지 통계 · ${complex.matchReason}`
        }))
    )
    .sort(
      (a, b) =>
        verificationPriority(a) - verificationPriority(b) ||
        Math.log10((b.tenantCount ?? 0) + 1) - Math.log10((a.tenantCount ?? 0) + 1) ||
        a.name.localeCompare(b.name, "ko")
    );
}

function mergeComplexes(
  linkedComplexes: IndustrialComplexSummary[],
  rankedComplexes: IndustrialComplexSummary[]
): IndustrialComplexSummary[] {
  const seen = new Set<string>();
  return [...linkedComplexes, ...rankedComplexes]
    .filter((complex) => {
      const key = complex.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4);
}

type DomesticSupplierRow = {
  id: string;
  name: string;
  countryCode: string;
  region: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  productsJson: string;
  hsCodesJson: string;
  description: string | null;
  providerName: string;
  datasetName: string;
  sourceType: SupplySourceType;
  sourceUrl: string;
  fetchedAt: Date | string;
  license: string;
  verification: VerificationStatus;
  industrialComplexName: string | null;
};

type IndustrialComplexRow = {
  id: string;
  code: string;
  name: string;
  region: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  industryMixJson: string;
  tenantCount: number | null;
  operatingCount: number | null;
  operationRate: number | null;
  exportAmount: number | null;
  employeeCount: number | null;
  providerName: string;
  datasetName: string;
  sourceType: SupplySourceType;
  sourceUrl: string;
  fetchedAt: Date | string;
  license: string;
  verification: VerificationStatus;
};

function isoDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

async function queryDomesticDatabase(): Promise<{ suppliers: SupplierCandidate[]; complexes: IndustrialComplexSummary[] }> {
  const tableRows = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT "name"
    FROM "sqlite_master"
    WHERE "type" = 'table' AND "name" IN ('Supplier', 'IndustrialComplex')
  `;
  const tableNames = new Set(tableRows.map((row) => row.name));
  if (!tableNames.has("Supplier") || !tableNames.has("IndustrialComplex")) {
    return { suppliers: [], complexes: [] };
  }

  const suppliers = await prisma.$queryRaw<DomesticSupplierRow[]>`
    SELECT
      s."id", s."name", s."countryCode", s."region", s."city", s."address",
      s."latitude", s."longitude", s."productsJson", s."hsCodesJson", s."description",
      s."providerName", s."datasetName", s."sourceType", s."sourceUrl", s."fetchedAt",
      s."license", s."verification", ic."name" AS "industrialComplexName"
    FROM "Supplier" s
    LEFT JOIN "IndustrialComplex" ic ON ic."id" = s."industrialComplexId"
    WHERE s."scope" = 'DOMESTIC'
    ORDER BY
      CASE s."sourceType"
        WHEN 'MOTIE_PUBLIC' THEN 0
        WHEN 'OTHER_PUBLIC' THEN 1
        WHEN 'USER_UPLOAD' THEN 2
        ELSE 3
      END,
      s."name", s."id"
    LIMIT 3000
  `;
  const complexes = await prisma.$queryRaw<IndustrialComplexRow[]>`
    SELECT
      "id", "code", "name", "region", "city", "latitude", "longitude", "industryMixJson",
      "tenantCount", "operatingCount", "operationRate", "exportAmount", "employeeCount",
      "providerName", "datasetName", "sourceType", "sourceUrl", "fetchedAt", "license", "verification"
    FROM "IndustrialComplex"
    ORDER BY
      CASE "sourceType"
        WHEN 'MOTIE_PUBLIC' THEN 0
        WHEN 'OTHER_PUBLIC' THEN 1
        WHEN 'USER_UPLOAD' THEN 2
        ELSE 3
      END,
      "name", "id"
    LIMIT 500
  `;

  return {
    suppliers: suppliers.map((supplier) => ({
      id: supplier.id,
      name: supplier.name,
      scope: "DOMESTIC",
      countryCode: supplier.countryCode,
      countryName: "대한민국",
      region: supplier.region ?? undefined,
      city: supplier.city ?? undefined,
      address: supplier.address ?? undefined,
      latitude: supplier.latitude ?? undefined,
      longitude: supplier.longitude ?? undefined,
      products: parseArray(supplier.productsJson),
      hsCodes: parseArray(supplier.hsCodesJson),
      industrialComplex:
        supplier.industrialComplexName ??
        inferIndustrialComplexFromText([supplier.region, supplier.city, supplier.address].filter(Boolean).join(" ")) ??
        undefined,
      description: supplier.description ?? "공장등록생산정보 기반 국내 후보",
      matchReason: "생산품·업종 키워드 매칭",
      providerName: supplier.providerName,
      datasetName: supplier.datasetName,
      sourceType: supplier.sourceType,
      sourceUrl: supplier.sourceUrl,
      fetchedAt: isoDate(supplier.fetchedAt),
      license: supplier.license,
      verification: supplier.verification
    })),
    complexes: complexes.map((complex) => ({
      id: complex.id,
      code: complex.code,
      name: complex.name,
      region: complex.region,
      city: complex.city ?? undefined,
      latitude: complex.latitude ?? undefined,
      longitude: complex.longitude ?? undefined,
      industries: parseArray(complex.industryMixJson),
      tenantCount: complex.tenantCount ?? undefined,
      operatingCount: complex.operatingCount ?? undefined,
      operationRate: complex.operationRate ?? undefined,
      exportAmount: complex.exportAmount ?? undefined,
      employeeCount: complex.employeeCount ?? undefined,
      matchReason: "산업단지 업종·가동 현황 매칭",
      providerName: complex.providerName,
      datasetName: complex.datasetName,
      sourceType: complex.sourceType,
      sourceUrl: complex.sourceUrl,
      fetchedAt: isoDate(complex.fetchedAt),
      license: complex.license,
      verification: complex.verification
    }))
  };
}

export async function findDomesticSupply(intent: ProductIntent): Promise<{
  candidates: SupplierCandidate[];
  complexes: IndustrialComplexSummary[];
  usedMock: boolean;
}> {
  try {
    const database = await queryDomesticDatabase();
    const candidates = rankDomestic(database.suppliers, intent);
    if (candidates.length > 0) {
      return {
        candidates,
        complexes: mergeComplexes(linkedComplexesForCandidates(candidates, database.complexes), rankComplexes(database.complexes, intent)),
        usedMock: false
      };
    }
  } catch {
    // Schema may be present before the optional demo seed is applied.
  }

  const [factoryResult, trendResult] = await Promise.all([
    fetchKicoxFactorySuppliers({ query: intent.query, region: intent.preferredRegion }),
    fetchKicoxIndustrialTrends({ region: intent.preferredRegion })
  ]);
  const adapterCandidates = rankDomestic(factoryResult.suppliers, intent);
  const adapterComplexes = rankComplexes(trendResult.complexes, intent);

  return {
    candidates: adapterCandidates.length > 0 ? adapterCandidates : rankDomestic(DOMESTIC_DEMO_SUPPLIERS, intent),
    complexes:
      adapterComplexes.length > 0
        ? mergeComplexes(linkedComplexesForCandidates(adapterCandidates, trendResult.complexes), adapterComplexes)
        : mergeComplexes(
            linkedComplexesForCandidates(rankDomestic(DOMESTIC_DEMO_SUPPLIERS, intent), DOMESTIC_DEMO_COMPLEXES),
            rankComplexes(DOMESTIC_DEMO_COMPLEXES, intent)
          ),
    usedMock: factoryResult.usedMock || trendResult.usedMock
  };
}
