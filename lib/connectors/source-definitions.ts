import type { ApiSourceDefinition } from "./types";

export const API_SOURCE_DEFINITIONS: ApiSourceDefinition[] = [
  {
    code: "customs_hs_code",
    name: "관세청 HS부호 파일/데이터",
    provider: "Korea Customs Service",
    category: "관세/통관/무역통계",
    baseUrl: "https://apis.data.go.kr",
    requiresKey: true,
    keyEnvName: "DATA_GO_KR_SERVICE_KEY",
    status: "implemented",
    docsUrl: "https://www.data.go.kr"
  },
  {
    code: "customs_trade_stats_by_hs_country",
    name: "관세청 품목별 국가별 수출입실적",
    provider: "Korea Customs Service",
    category: "관세/통관/무역통계",
    baseUrl: "https://apis.data.go.kr/1220000/nitemtrade/getNitemtradeList",
    requiresKey: true,
    keyEnvName: "DATA_GO_KR_SERVICE_KEY",
    status: "implemented",
    docsUrl: "https://www.data.go.kr/data/15101602/openapi.do"
  },
  {
    code: "customs_confirmation_items",
    name: "세관장확인대상물품",
    provider: "Korea Customs Service",
    category: "관세/통관/무역통계",
    baseUrl: "https://apis.data.go.kr/1220000/retrieveCcctLworCd",
    requiresKey: true,
    keyEnvName: "CUSTOMS_CONFIRMATION_ITEMS_SERVICE_KEY",
    status: "implemented",
    docsUrl: "https://www.data.go.kr/data/15101589/openapi.do"
  },
  {
    code: "customs_tariff_table",
    name: "품목번호별 관세율표",
    provider: "Korea Customs Service",
    category: "관세/통관/무역통계",
    baseUrl: "https://apis.data.go.kr",
    requiresKey: true,
    keyEnvName: "DATA_GO_KR_SERVICE_KEY",
    status: "stub",
    docsUrl: "https://www.data.go.kr"
  },
  {
    code: "unipass_cargo_tracking",
    name: "화물통관진행정보",
    provider: "UNI-PASS",
    category: "관세/통관/무역통계",
    baseUrl: "https://unipass.customs.go.kr",
    requiresKey: true,
    keyEnvName: "UNIPASS_API_KEY",
    status: "stub",
    docsUrl: "https://unipass.customs.go.kr"
  },
  {
    code: "safety_korea_cert_recall",
    name: "KC 제품 안전인증 및 리콜정보",
    provider: "Safety Korea",
    category: "제품안전/KC/RRA/에너지",
    baseUrl: "https://www.safetykorea.kr",
    requiresKey: false,
    status: "implemented",
    docsUrl: "https://www.safetykorea.kr"
  },
  {
    code: "rra_conformity",
    name: "국립전파연구원 적합성평가 DB",
    provider: "RRA",
    category: "제품안전/KC/RRA/에너지",
    baseUrl: "https://www.rra.go.kr",
    requiresKey: false,
    status: "implemented",
    docsUrl: "https://www.rra.go.kr/ko/license/A_b_popup.do"
  },
  {
    code: "rra_self_conformity",
    name: "자기적합확인 DB",
    provider: "RRA",
    category: "제품안전/KC/RRA/에너지",
    baseUrl: "https://www.rra.go.kr",
    requiresKey: false,
    status: "stub",
    docsUrl: "https://www.rra.go.kr"
  },
  {
    code: "energy_efficiency_products",
    name: "에너지소비효율등급 제품정보",
    provider: "Korea Energy Agency",
    category: "제품안전/KC/RRA/에너지",
    baseUrl: "https://apis.data.go.kr/B553530/eep",
    requiresKey: true,
    keyEnvName: "DATA_GO_KR_SERVICE_KEY",
    status: "implemented",
    docsUrl: "https://www.data.go.kr/data/15100647/openapi.do"
  },
  {
    code: "standby_power_products",
    name: "대기전력저감 프로그램 신고제품",
    provider: "Korea Energy Agency",
    category: "제품안전/KC/RRA/에너지",
    baseUrl: "https://apis.data.go.kr/B553530/ELEC",
    requiresKey: true,
    keyEnvName: "DATA_GO_KR_SERVICE_KEY",
    status: "implemented",
    docsUrl: "https://www.data.go.kr/data/15118834/openapi.do"
  },
  {
    code: "mfds_import_food_foreign_manufacturers",
    name: "수입식품 해외제조업소 정보",
    provider: "MFDS",
    category: "식약처/식품/화장품/의료기기/건기식",
    baseUrl: "https://apis.data.go.kr/1471000",
    requiresKey: true,
    keyEnvName: "MFDS_IMPORT_FOOD_FOREIGN_MANUFACTURERS_SERVICE_KEY",
    status: "implemented",
    docsUrl: "https://www.data.go.kr/data/15073967/openapi.do"
  },
  {
    code: "mfds_import_food_suspended_manufacturers",
    name: "해외제조업소 중단정보",
    provider: "MFDS",
    category: "식약처/식품/화장품/의료기기/건기식",
    baseUrl: "https://apis.data.go.kr/1471000",
    requiresKey: true,
    keyEnvName: "DATA_GO_KR_SERVICE_KEY",
    status: "implemented",
    docsUrl: "https://www.data.go.kr"
  },
  {
    code: "mfds_import_food_suspended_items",
    name: "해외제조업소 중단품목 정보",
    provider: "MFDS",
    category: "식약처/식품/화장품/의료기기/건기식",
    baseUrl: "https://apis.data.go.kr/1471000",
    requiresKey: true,
    keyEnvName: "DATA_GO_KR_SERVICE_KEY",
    status: "stub",
    docsUrl: "https://www.data.go.kr"
  },
  {
    code: "mfds_import_food_foreign_establishments",
    name: "해외작업장 품목 및 중단정보",
    provider: "MFDS",
    category: "식약처/식품/화장품/의료기기/건기식",
    baseUrl: "https://apis.data.go.kr/1471000",
    requiresKey: true,
    keyEnvName: "DATA_GO_KR_SERVICE_KEY",
    status: "stub",
    docsUrl: "https://www.data.go.kr"
  },
  {
    code: "mfds_food_non_compliance",
    name: "검사 부적합 식품정보",
    provider: "MFDS",
    category: "식약처/식품/화장품/의료기기/건기식",
    baseUrl: "https://apis.data.go.kr/1471000",
    requiresKey: true,
    keyEnvName: "DATA_GO_KR_SERVICE_KEY",
    status: "stub",
    docsUrl: "https://www.data.go.kr"
  },
  {
    code: "foodsafety_recall_stop_sale",
    name: "식품안전나라 회수·판매중지 정보",
    provider: "Food Safety Korea",
    category: "식약처/식품/화장품/의료기기/건기식",
    baseUrl: "https://openapi.foodsafetykorea.go.kr",
    requiresKey: true,
    keyEnvName: "FOODS_SAFETY_KOREA_KEY",
    status: "stub",
    docsUrl: "https://www.foodsafetykorea.go.kr/apiMain.do"
  },
  {
    code: "mfds_cosmetic_ingredients",
    name: "화장품 원료성분정보",
    provider: "MFDS",
    category: "식약처/식품/화장품/의료기기/건기식",
    baseUrl: "https://apis.data.go.kr/1471000/CsmtcsIngdCpntInfoService01",
    requiresKey: true,
    keyEnvName: "MFDS_COSMETICS_SERVICE_KEY",
    status: "implemented",
    docsUrl: "https://www.data.go.kr/data/15057235/openapi.do"
  },
  {
    code: "mfds_cosmetic_restricted_ingredients",
    name: "화장품 사용제한 원료정보",
    provider: "MFDS",
    category: "식약처/식품/화장품/의료기기/건기식",
    baseUrl: "https://apis.data.go.kr/1471000/CsmtcsUseRstrcInfoService",
    requiresKey: true,
    keyEnvName: "MFDS_COSMETICS_SERVICE_KEY",
    status: "implemented",
    docsUrl: "https://www.data.go.kr/data/15111772/openapi.do"
  },
  {
    code: "mfds_medical_device_items",
    name: "의료기기 품목정보/품목허가정보",
    provider: "MFDS",
    category: "식약처/식품/화장품/의료기기/건기식",
    baseUrl: "https://apis.data.go.kr/1471000/MdlpPrdlstPrmisnInfoService05",
    requiresKey: true,
    keyEnvName: "MFDS_MEDICAL_DEVICE_SERVICE_KEY",
    status: "implemented",
    docsUrl: "https://www.data.go.kr/data/15057456/openapi.do"
  },
  {
    code: "mfds_health_functional_food",
    name: "건강기능식품 품목/업소 관련 정보",
    provider: "MFDS",
    category: "식약처/식품/화장품/의료기기/건기식",
    baseUrl: "https://apis.data.go.kr/1471000",
    requiresKey: true,
    keyEnvName: "DATA_GO_KR_SERVICE_KEY",
    status: "stub",
    docsUrl: "https://www.data.go.kr"
  },
  {
    code: "ecolife_chemical_products",
    name: "초록누리 생활화학제품 정보",
    provider: "초록누리",
    category: "화학/환경/산업안전",
    baseUrl: "https://ecolife.me.go.kr",
    requiresKey: false,
    status: "stub",
    docsUrl: "https://ecolife.me.go.kr"
  },
  {
    code: "keco_chemical_substance",
    name: "한국환경공단 화학물질 정보 조회",
    provider: "KECO",
    category: "화학/환경/산업안전",
    baseUrl: "https://apis.data.go.kr",
    requiresKey: true,
    keyEnvName: "DATA_GO_KR_SERVICE_KEY",
    status: "stub",
    docsUrl: "https://www.data.go.kr"
  },
  {
    code: "kosha_msds",
    name: "KOSHA MSDS 조회 서비스",
    provider: "KOSHA",
    category: "화학/환경/산업안전",
    baseUrl: "https://msds.kosha.or.kr",
    requiresKey: false,
    status: "stub",
    docsUrl: "https://msds.kosha.or.kr"
  },
  {
    code: "kosha_protective_equipment",
    name: "보호구 안전인증 현황",
    provider: "KOSHA",
    category: "화학/환경/산업안전",
    baseUrl: "https://apis.data.go.kr",
    requiresKey: true,
    keyEnvName: "DATA_GO_KR_SERVICE_KEY",
    status: "stub",
    docsUrl: "https://www.data.go.kr"
  },
  {
    code: "qia_plant_quarantine",
    name: "수입식물검역정보",
    provider: "QIA",
    category: "검역/농축수산",
    baseUrl: "https://apis.data.go.kr",
    requiresKey: true,
    keyEnvName: "DATA_GO_KR_SERVICE_KEY",
    status: "stub",
    docsUrl: "https://www.data.go.kr"
  },
  {
    code: "qia_import_livestock_trace",
    name: "수입축산물 이력정보",
    provider: "QIA",
    category: "검역/농축수산",
    baseUrl: "https://apis.data.go.kr",
    requiresKey: true,
    keyEnvName: "DATA_GO_KR_SERVICE_KEY",
    status: "stub",
    docsUrl: "https://www.data.go.kr"
  },
  {
    code: "nfqs_fishery_quarantine_stats",
    name: "수산물 수출입 검역통계",
    provider: "NFQS",
    category: "검역/농축수산",
    baseUrl: "https://apis.data.go.kr",
    requiresKey: true,
    keyEnvName: "DATA_GO_KR_SERVICE_KEY",
    status: "stub",
    docsUrl: "https://www.data.go.kr"
  },
  {
    code: "nts_business_status",
    name: "국세청 사업자등록정보 진위확인 및 상태조회",
    provider: "NTS",
    category: "사업자/IP/소비자/법령",
    baseUrl: "https://api.odcloud.kr",
    requiresKey: true,
    keyEnvName: "DATA_GO_KR_SERVICE_KEY",
    status: "stub",
    docsUrl: "https://www.data.go.kr/data/15081808/openapi.do"
  },
  {
    code: "ftc_mail_order_business",
    name: "공정거래위원회 통신판매사업자 등록상세",
    provider: "FTC",
    category: "사업자/IP/소비자/법령",
    baseUrl: "https://apis.data.go.kr",
    requiresKey: true,
    keyEnvName: "DATA_GO_KR_SERVICE_KEY",
    status: "stub",
    docsUrl: "https://www.data.go.kr"
  },
  {
    code: "kipris_ip_search",
    name: "KIPRIS Plus 특허/상표/디자인 검색",
    provider: "KIPRIS",
    category: "사업자/IP/소비자/법령",
    baseUrl: "https://plus.kipris.or.kr",
    requiresKey: true,
    keyEnvName: "KIPRIS_PLUS_KEY",
    status: "stub",
    docsUrl: "https://plus.kipris.or.kr"
  },
  {
    code: "consumer24_recall",
    name: "소비자24 리콜정보",
    provider: "Consumer24",
    category: "사업자/IP/소비자/법령",
    baseUrl: "https://www.consumer.go.kr",
    requiresKey: false,
    status: "stub",
    docsUrl: "https://www.consumer.go.kr"
  },
  {
    code: "law_open_data",
    name: "법제처 국가법령정보",
    provider: "MOLEG",
    category: "사업자/IP/소비자/법령",
    baseUrl: "https://www.law.go.kr",
    requiresKey: true,
    keyEnvName: "LAW_OPEN_DATA_OC",
    status: "stub",
    docsUrl: "https://open.law.go.kr"
  },
  {
    code: "kotra_trade_news",
    name: "KOTRA 단신속보뉴스/무역투자 질의응답",
    provider: "KOTRA",
    category: "사업자/IP/소비자/법령",
    baseUrl: "https://www.kotra.or.kr",
    requiresKey: false,
    status: "stub",
    docsUrl: "https://www.kotra.or.kr"
  },
  {
    code: "brave_search",
    name: "Brave Search API",
    provider: "Brave",
    category: "검색엔진/웹 인텔리전스",
    baseUrl: "https://api.search.brave.com",
    requiresKey: true,
    keyEnvName: "BRAVE_SEARCH_API_KEY",
    status: "stub",
    docsUrl: "https://api-dashboard.search.brave.com/app/documentation"
  },
  {
    code: "tavily_search",
    name: "Tavily API",
    provider: "Tavily",
    category: "검색엔진/웹 인텔리전스",
    baseUrl: "https://api.tavily.com",
    requiresKey: true,
    keyEnvName: "TAVILY_API_KEY",
    status: "stub",
    docsUrl: "https://docs.tavily.com"
  },
  {
    code: "google_custom_search",
    name: "Google Custom Search JSON API",
    provider: "Google",
    category: "검색엔진/웹 인텔리전스",
    baseUrl: "https://customsearch.googleapis.com",
    requiresKey: true,
    keyEnvName: "GOOGLE_CUSTOM_SEARCH_API_KEY",
    status: "optional",
    docsUrl: "https://developers.google.com/custom-search/v1/overview"
  }
];

export function getSourceDefinition(sourceCode: string): ApiSourceDefinition | undefined {
  return API_SOURCE_DEFINITIONS.find((source) => source.code === sourceCode);
}
