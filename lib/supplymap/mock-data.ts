import { supplySource } from "./data-sources";
import { MOCK_KICOX_FACTORY_SUPPLIERS } from "./adapters/kicox-factory";
import { MOCK_KICOX_INDUSTRIAL_COMPLEXES } from "./adapters/kicox-industrial-trends";
import type {
  EvidenceRecord,
  IndustrialComplexSummary,
  Provenance,
  RiskSignalRecord,
  SupplierCandidate,
  SupplyDataSourceRecord
} from "./types";

const kicoxFactory = supplySource("kicox_factory_registry");
const kicoxTrend = supplySource("kicox_industrial_trends");
const safety = supplySource("safety_korea");
const customs = supplySource("customs_requirements");
const customsTrade = supplySource("customs_trade_stats");
const ksure = supplySource("ksure_country_trade");
const kotra = supplySource("kotra_market_news");

function provenance(source: SupplyDataSourceRecord): Provenance {
  return {
    providerName: source.providerName,
    datasetName: source.datasetName,
    sourceType: source.sourceType,
    sourceUrl: source.sourceUrl,
    fetchedAt: source.fetchedAt,
    license: source.license,
    verification: source.verification
  };
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

const BASE_MOCK_COMPLEXES: IndustrialComplexSummary[] = [
  {
    id: "complex-banwol-sihwa",
    code: "KICOX-DEMO-BSW",
    name: "반월·시화국가산업단지",
    region: "경기",
    city: "안산·시흥",
    latitude: 37.319,
    longitude: 126.733,
    industries: ["기계", "전기전자", "석유화학", "포장재"],
    tenantCount: 20900,
    operatingCount: 19300,
    operationRate: 76.4,
    employeeCount: 154000,
    matchReason: "포장·플라스틱·전기전자 관련 업종 집적도가 높은 국내 공장 비교 권역",
    ...provenance(kicoxTrend)
  },
  {
    id: "complex-gumi",
    code: "KICOX-DEMO-GUMI",
    name: "구미국가산업단지",
    region: "경북",
    city: "구미",
    latitude: 36.119,
    longitude: 128.371,
    industries: ["전기전자", "기계", "디스플레이"],
    tenantCount: 2500,
    operatingCount: 2200,
    operationRate: 72.8,
    employeeCount: 84000,
    matchReason: "전자부품·완제품 생산 기반을 활용할 수 있는 국내 공급 권역",
    ...provenance(kicoxTrend)
  },
  {
    id: "complex-noksan",
    code: "KICOX-DEMO-NOKSAN",
    name: "명지·녹산국가산업단지",
    region: "부산",
    city: "강서구",
    latitude: 35.104,
    longitude: 128.856,
    industries: ["기계", "식품", "운송장비", "포장재"],
    tenantCount: 1700,
    operatingCount: 1510,
    operationRate: 74.1,
    employeeCount: 41000,
    matchReason: "부산항 접근성과 식품·포장 연관 업종을 함께 고려한 조달 권역",
    ...provenance(kicoxTrend)
  }
];

const BASE_MOCK_DOMESTIC_SUPPLIERS: SupplierCandidate[] = [
  {
    id: "domestic-packaging-ansan",
    name: "KICOX 데모 포장용기 제조사 A",
    scope: "DOMESTIC",
    countryCode: "KR",
    countryName: "대한민국",
    region: "경기",
    city: "안산",
    address: "경기도 안산시 단원구 반월·시화국가산업단지",
    latitude: 37.321,
    longitude: 126.731,
    products: ["식품용 플라스틱 용기", "밀폐용기", "포장 부자재"],
    hsCodes: ["392330", "392350", "392390"],
    industrialComplex: "반월·시화국가산업단지",
    description: "샘플 fallback 기업입니다. 실제 거래 전 공장등록생산정보 API 재조회가 필요합니다.",
    matchReason: "생산품 키워드 포장·용기 일치, 수도권 공급 희망지역과 근접",
    ...provenance(kicoxFactory)
  },
  {
    id: "domestic-food-busan",
    name: "KICOX 데모 식품가공 제조사 B",
    scope: "DOMESTIC",
    countryCode: "KR",
    countryName: "대한민국",
    region: "부산",
    city: "강서구",
    address: "부산광역시 강서구 명지·녹산국가산업단지",
    latitude: 35.106,
    longitude: 128.858,
    products: ["가공식품", "스낵류", "식품 소분·포장"],
    hsCodes: ["190531", "190590"],
    industrialComplex: "명지·녹산국가산업단지",
    description: "샘플 fallback 기업입니다. 실제 생산범위와 인증은 확인이 필요합니다.",
    matchReason: "가공식품 생산품 일치, 부산항 연계 물류 가능성",
    ...provenance(kicoxFactory)
  },
  {
    id: "domestic-electronics-gumi",
    name: "KICOX 데모 전자부품 제조사 C",
    scope: "DOMESTIC",
    countryCode: "KR",
    countryName: "대한민국",
    region: "경북",
    city: "구미",
    address: "경상북도 구미시 구미국가산업단지",
    latitude: 36.117,
    longitude: 128.374,
    products: ["블루투스 모듈", "PCB 조립", "소형 전자제품"],
    hsCodes: ["851821", "851822", "851829"],
    industrialComplex: "구미국가산업단지",
    description: "샘플 fallback 기업입니다. KC·RRA 적용 모델은 별도 확인이 필요합니다.",
    matchReason: "전자제품 생산품 일치, 구미 전기전자 산업 집적",
    ...provenance(kicoxFactory)
  }
];

export const MOCK_COMPLEXES: IndustrialComplexSummary[] = uniqueById([
  ...BASE_MOCK_COMPLEXES,
  ...MOCK_KICOX_INDUSTRIAL_COMPLEXES
]);

export const MOCK_DOMESTIC_SUPPLIERS: SupplierCandidate[] = uniqueById([
  ...BASE_MOCK_DOMESTIC_SUPPLIERS,
  ...MOCK_KICOX_FACTORY_SUPPLIERS
]);

export function mockRiskSignals(hsCode?: string, country = "CN"): RiskSignalRecord[] {
  return [
    {
      id: "risk-kc-demo",
      kind: "CERTIFICATION",
      severity: "UNKNOWN",
      status: "확인 필요",
      title: "KC 인증 대상 여부",
      summary: "제품의 전기·생활용품 분류와 모델 사양이 확정되지 않아 Safety Korea 상세 조회가 필요합니다.",
      scoreImpact: 0,
      hsCode,
      ...provenance(safety)
    },
    {
      id: "risk-customs-demo",
      kind: "CUSTOMS",
      severity: "MEDIUM",
      status: "주의",
      title: "세관장확인대상 및 수입요건",
      summary: "HS 후보 기준으로 확인법령과 요건승인기관을 재조회해야 합니다. 후보 HS만으로 신고하면 안 됩니다.",
      scoreImpact: -3,
      hsCode,
      ...provenance(customs)
    },
    {
      id: "risk-country-demo",
      kind: "COUNTRY_RISK",
      severity: country === "CN" ? "MEDIUM" : "UNKNOWN",
      status: "확인 필요",
      title: "국가·거래위험 신호",
      summary: "K-SURE 국가별 무역지표를 거래위험 참고 신호로 사용하며 개별 공급업체의 신용등급을 의미하지 않습니다.",
      scoreImpact: country === "CN" ? -2 : 0,
      ...provenance(ksure)
    },
    {
      id: "risk-market-demo",
      kind: "MARKET",
      severity: "LOW",
      status: "확인",
      title: "KOTRA 시장정보 확인",
      summary: "해외시장뉴스와 국가정보를 검색해 규제 변경과 거래 관행을 답변 근거로 사용합니다.",
      scoreImpact: 0,
      ...provenance(kotra)
    },
    {
      id: "risk-customs-trade-stats-demo",
      kind: "MARKET",
      severity: "NEEDS_CHECK",
      status: "확인 필요",
      title: "품목별 국가별 수출입실적 확인",
      summary: "HS 후보와 국가코드 기준 수입액, 수입중량, 무역수지를 확인해 시장 규모와 특정 국가 공급 의존도를 보조 판단합니다.",
      scoreImpact: -1,
      hsCode,
      ...provenance(customsTrade)
    }
  ];
}

export function mockEvidence(): EvidenceRecord[] {
  return [
    {
      id: "EV-KICOX-FACTORY",
      title: "국내 등록공장 생산품 매칭",
      snippet: "공장등록생산정보의 회사명·주소·업종·생산품을 이용하는 국내 후보 검색 구조입니다. 현재 레코드는 mock adapter 결과입니다.",
      claim: "국내 공장 후보를 제품명·생산품 기준으로 탐색합니다.",
      url: kicoxFactory.sourceUrl,
      ...provenance(kicoxFactory)
    },
    {
      id: "EV-KICOX-TREND",
      title: "산업단지 업종·가동 현황",
      snippet: "산업단지별 입주·가동·생산·수출·고용 지표를 지역 공급역량 보조지표로 사용합니다.",
      claim: "산업단지 집적도와 지역 공급 가능성을 비교합니다.",
      url: kicoxTrend.sourceUrl,
      ...provenance(kicoxTrend)
    },
    {
      id: "EV-SAFETY",
      title: "제품안전 인증·리콜 확인",
      snippet: "제품명과 모델이 확정된 이후 KC 인증 및 리콜 상세조회가 필요합니다.",
      claim: "인증 근거가 없으면 확인 필요로 표시합니다.",
      url: safety.sourceUrl,
      ...provenance(safety)
    },
    {
      id: "EV-CUSTOMS",
      title: "HS 및 세관장확인대상",
      snippet: "HS 후보는 분석 시작점이며 최종 품목분류와 수입요건은 관세청 자료로 다시 확인해야 합니다.",
      claim: "수입 신고 전 확인법령과 요건승인기관을 확인합니다.",
      url: customs.sourceUrl,
      ...provenance(customs)
    },
    {
      id: "EV-CUSTOMS-TRADE",
      title: "품목별 국가별 수출입실적",
      snippet: "HS코드와 국가코드 기준 월별 수입액·수입중량·무역수지를 조회해 시장 규모와 특정 국가 공급 의존도를 보조 판단합니다.",
      claim: "수입 전 시장 규모와 국가별 거래 흐름을 확인합니다.",
      url: customsTrade.sourceUrl,
      ...provenance(customsTrade)
    },
    {
      id: "EV-KSURE",
      title: "K-SURE 국가별 업종별 위험지수",
      snippet: "국가·업종별 RI1~RI5 위험지수는 거래위험 참고 신호이며 공급업체 신용평가나 무역보험 인수 가능성을 대체하지 않습니다.",
      claim: "국가·거래위험은 보조지표로만 제공합니다.",
      url: ksure.sourceUrl,
      ...provenance(ksure)
    }
  ];
}
