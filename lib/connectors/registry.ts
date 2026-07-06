import { API_SOURCE_DEFINITIONS, getSourceDefinition } from "./source-definitions";
import type { Connector, RawFetchResult } from "./types";
import { createPublicApiConnector } from "./data-go-kr";
import { mockRecordsForSource } from "./mock-data";
import {
  normalizeCertificate,
  normalizeCosmeticIngredient,
  normalizeCosmeticRestriction,
  normalizeFactory,
  normalizeHsCode,
  normalizeRiskEvent,
  normalizeTradeRequirement,
  normalizeTradeStat
} from "@/lib/normalizers/records";

function sourceMeta(sourceCode: string) {
  const source = getSourceDefinition(sourceCode);
  if (!source) throw new Error(`Unknown source ${sourceCode}`);
  return source;
}

function digitsOnly(value: unknown): string | undefined {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? digits : undefined;
}

function countryNameForApi(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  if (/^(CN|CHN)$/i.test(text) || /중국|china/i.test(text)) return "중국";
  if (/^(US|USA)$/i.test(text) || /미국|united states|america/i.test(text)) return "미국";
  if (/^(VN|VNM)$/i.test(text) || /베트남|vietnam/i.test(text)) return "베트남";
  if (/^(KR|KOR)$/i.test(text) || /한국|대한민국|korea/i.test(text)) return "한국";
  return text;
}

function queryTerm(params: Record<string, unknown>): string | undefined {
  const term = String(params.query ?? params.productName ?? "").trim();
  if (!term || term.length < 2) return undefined;
  if (/수입|무역|관련|확인|필요|가능|찾아|알려|중국|한국|미국|베트남|관세|통관|화장품|식품/.test(term)) {
    return undefined;
  }
  return term;
}

function cosmeticNameParams(params: Record<string, unknown>, koreanKey: string): Record<string, unknown> {
  const term = queryTerm(params);
  if (!term) return params;
  if (/^\d{2,7}-\d{2}-\d$/.test(term)) return { ...params, CAS_NO: term };
  if (/[가-힣]/.test(term)) return { ...params, [koreanKey]: term };
  return { ...params, INGR_ENG_NAME: term };
}

function filterCosmeticRestrictions(records: unknown[], params: Record<string, unknown>): unknown[] {
  const term = String(params.CAS_NO ?? params.INGR_STD_NAME ?? params.INGR_ENG_NAME ?? params.query ?? "").trim().toLowerCase();
  if (!term) return records;

  return records.filter((record) => {
    const item = record as Record<string, unknown>;
    return [
      item.CAS_NO,
      item.INGR_STD_NAME,
      item.INGR_ENG_NAME,
      item.INGR_SYNONYM,
      item.NOTICE_INGR_NAME
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });
}

function implementedConnectors(): Connector[] {
  return [
    createPublicApiConnector({
      sourceCode: "customs_hs_code",
      displayName: "관세청 HS부호 파일/데이터",
      category: "관세/통관/무역통계",
      endpoint:
        process.env.CUSTOMS_HS_CODE_ENDPOINT ||
        "https://apis.data.go.kr/1220000/ItemInfoService/getItemInfo",
      endpointEnvName: "CUSTOMS_HS_CODE_ENDPOINT",
      requiresKey: true,
      keyEnvName: "DATA_GO_KR_SERVICE_KEY",
      docsUrl: sourceMeta("customs_hs_code").docsUrl,
      normalize: normalizeHsCode
    }),
    createPublicApiConnector({
      sourceCode: "customs_confirmation_items",
      displayName: "세관장확인대상물품",
      category: "관세/통관/무역통계",
      endpoint:
        process.env.CUSTOMS_CONFIRMATION_ITEMS_ENDPOINT ||
        "https://apis.data.go.kr/1220000/retrieveCcctLworCd/getRetrieveCcctLworCd",
      endpointEnvName: "CUSTOMS_CONFIRMATION_ITEMS_ENDPOINT",
      requiresKey: true,
      keyEnvName: "CUSTOMS_CONFIRMATION_ITEMS_SERVICE_KEY",
      docsUrl: sourceMeta("customs_confirmation_items").docsUrl,
      prepareParams: (params) => ({
        ...params,
        hsSgn: digitsOnly(params.hsSgn ?? params.hsCode ?? params.query) ?? "1905310000",
        imexTpCd: params.imexTpCd ?? params.imExTpCd ?? "2"
      }),
      normalize: normalizeTradeRequirement
    }),
    createPublicApiConnector({
      sourceCode: "customs_trade_stats_by_hs_country",
      displayName: "품목별 국가별 수출입실적",
      category: "관세/통관/무역통계",
      endpoint:
        process.env.CUSTOMS_TRADE_STATS_BY_HS_COUNTRY_ENDPOINT ||
        "https://apis.data.go.kr/1220000/nitemtrade/getNitemtradeList",
      endpointEnvName: "CUSTOMS_TRADE_STATS_BY_HS_COUNTRY_ENDPOINT",
      requiresKey: true,
      keyEnvName: "DATA_GO_KR_SERVICE_KEY",
      docsUrl: sourceMeta("customs_trade_stats_by_hs_country").docsUrl,
      normalize: normalizeTradeStat
    }),
    createPublicApiConnector({
      sourceCode: "safety_korea_cert_recall",
      displayName: "KC 제품 안전인증 및 리콜정보",
      category: "제품안전/KC/RRA/에너지",
      endpoint:
        process.env.SAFETY_KOREA_CERT_RECALL_ENDPOINT ||
        "https://www.safetykorea.kr/openapi/api/cert/certificationList.json",
      endpointEnvName: "SAFETY_KOREA_CERT_RECALL_ENDPOINT",
      requiresKey: false,
      docsUrl: sourceMeta("safety_korea_cert_recall").docsUrl,
      normalize: (raw) => [
        ...normalizeCertificate(
          { ...raw, records: raw.records.filter((record) => !("reason" in (record as Record<string, unknown>))) },
          "KC"
        ),
        ...normalizeRiskEvent(
          { ...raw, records: raw.records.filter((record) => "reason" in (record as Record<string, unknown>)) },
          "RECALL"
        )
      ]
    }),
    createPublicApiConnector({
      sourceCode: "rra_conformity",
      displayName: "국립전파연구원 적합성평가 DB",
      category: "제품안전/KC/RRA/에너지",
      endpoint: process.env.RRA_CONFORMITY_ENDPOINT || "https://www.rra.go.kr/ko/license/openapi.do",
      endpointEnvName: "RRA_CONFORMITY_ENDPOINT",
      requiresKey: false,
      docsUrl: sourceMeta("rra_conformity").docsUrl,
      normalize: (raw) => normalizeCertificate(raw, "RRA")
    }),
    createPublicApiConnector({
      sourceCode: "mfds_import_food_foreign_manufacturers",
      displayName: "수입식품 해외제조업소 정보",
      category: "식약처/식품/화장품/의료기기/건기식",
      endpoint:
        process.env.MFDS_IMPORT_FOOD_FOREIGN_MANUFACTURERS_ENDPOINT ||
        "https://apis.data.go.kr/1471000/IprtFoodOvseaMnftBsshInfoService02/getIprtFoodOvseaMnftBsshInfoInq02",
      endpointEnvName: "MFDS_IMPORT_FOOD_FOREIGN_MANUFACTURERS_ENDPOINT",
      requiresKey: true,
      keyEnvName: "MFDS_IMPORT_FOOD_FOREIGN_MANUFACTURERS_SERVICE_KEY",
      docsUrl: sourceMeta("mfds_import_food_foreign_manufacturers").docsUrl,
      prepareParams: (params) => ({
        ...params,
        NATN_NM: countryNameForApi(params.NATN_NM ?? params.country),
        OCTR_MNFT_BSSH_NM: params.OCTR_MNFT_BSSH_NM ?? queryTerm(params)
      }),
      normalize: (raw) => [
        ...normalizeFactory(raw),
        ...normalizeCertificate(
          {
            ...raw,
            records: raw.records.filter(
              (record) => Boolean((record as Record<string, unknown>).CERT_NM)
            )
          },
          "FSSC"
        )
      ]
    }),
    createPublicApiConnector({
      sourceCode: "mfds_import_food_suspended_manufacturers",
      displayName: "해외제조업소 중단정보",
      category: "식약처/식품/화장품/의료기기/건기식",
      endpoint:
        process.env.MFDS_IMPORT_FOOD_SUSPENDED_MANUFACTURERS_ENDPOINT ||
        "https://apis.data.go.kr/1471000/IprtFoodOvseaStopInfoService/getIprtFoodOvseaStopInfoInq",
      endpointEnvName: "MFDS_IMPORT_FOOD_SUSPENDED_MANUFACTURERS_ENDPOINT",
      requiresKey: true,
      keyEnvName: "DATA_GO_KR_SERVICE_KEY",
      docsUrl: sourceMeta("mfds_import_food_suspended_manufacturers").docsUrl,
      normalize: (raw) => normalizeRiskEvent(raw, "SUSPENSION")
    }),
    createPublicApiConnector({
      sourceCode: "mfds_cosmetic_ingredients",
      displayName: "화장품 원료성분정보",
      category: "식약처/식품/화장품/의료기기/건기식",
      endpoint:
        process.env.MFDS_COSMETIC_INGREDIENTS_ENDPOINT ||
        "https://apis.data.go.kr/1471000/CsmtcsIngdCpntInfoService01/getCsmtcsIngdCpntInfoService01",
      endpointEnvName: "MFDS_COSMETIC_INGREDIENTS_ENDPOINT",
      requiresKey: true,
      keyEnvName: "MFDS_COSMETICS_SERVICE_KEY",
      docsUrl: sourceMeta("mfds_cosmetic_ingredients").docsUrl,
      prepareParams: (params) => cosmeticNameParams(params, "INGR_KOR_NAME"),
      normalize: normalizeCosmeticIngredient
    }),
    createPublicApiConnector({
      sourceCode: "mfds_cosmetic_restricted_ingredients",
      displayName: "화장품 사용제한 원료정보",
      category: "식약처/식품/화장품/의료기기/건기식",
      endpoint:
        process.env.MFDS_COSMETIC_RESTRICTED_INGREDIENTS_ENDPOINT ||
        "https://apis.data.go.kr/1471000/CsmtcsUseRstrcInfoService/getCsmtcsUseRstrcInfoService",
      endpointEnvName: "MFDS_COSMETIC_RESTRICTED_INGREDIENTS_ENDPOINT",
      requiresKey: true,
      keyEnvName: "MFDS_COSMETICS_SERVICE_KEY",
      defaultParams: { numOfRows: 500 },
      docsUrl: sourceMeta("mfds_cosmetic_restricted_ingredients").docsUrl,
      prepareParams: (params) => cosmeticNameParams(params, "INGR_STD_NAME"),
      filterRecords: filterCosmeticRestrictions,
      normalize: normalizeCosmeticRestriction
    }),
    createPublicApiConnector({
      sourceCode: "mfds_medical_device_items",
      displayName: "의료기기 품목정보/품목허가정보",
      category: "식약처/식품/화장품/의료기기/건기식",
      endpoint:
        process.env.MFDS_MEDICAL_DEVICE_ITEMS_ENDPOINT ||
        "https://apis.data.go.kr/1471000/MdlpPrdlstPrmisnInfoService05/getMdlpPrdlstPrmisnList04",
      endpointEnvName: "MFDS_MEDICAL_DEVICE_ITEMS_ENDPOINT",
      requiresKey: true,
      keyEnvName: "MFDS_MEDICAL_DEVICE_SERVICE_KEY",
      docsUrl: sourceMeta("mfds_medical_device_items").docsUrl,
      normalize: (raw) => [
        ...normalizeFactory(raw).filter((record) => Boolean(record.canonicalName && record.address)),
        ...normalizeCertificate(raw, "MFDS").map((record) => ({
          ...record,
          extra: {
            ...record.extra,
            category: "의료기기"
          }
        }))
      ]
    }),
    createPublicApiConnector({
      sourceCode: "energy_efficiency_products",
      displayName: "에너지소비효율등급 제품정보",
      category: "제품안전/KC/RRA/에너지",
      endpoint:
        process.env.ENERGY_EFFICIENCY_PRODUCTS_ENDPOINT ||
        "https://apis.data.go.kr/B553530/eep/EEP_01_LIST",
      endpointEnvName: "ENERGY_EFFICIENCY_PRODUCTS_ENDPOINT",
      requiresKey: true,
      keyEnvName: "DATA_GO_KR_SERVICE_KEY",
      docsUrl: sourceMeta("energy_efficiency_products").docsUrl,
      normalize: (raw) => normalizeCertificate(raw, "ENERGY")
    }),
    createPublicApiConnector({
      sourceCode: "standby_power_products",
      displayName: "대기전력저감 프로그램 신고제품",
      category: "제품안전/KC/RRA/에너지",
      endpoint:
        process.env.STANDBY_POWER_PRODUCTS_ENDPOINT ||
        "https://apis.data.go.kr/B553530/ELEC/ELEC_01_LIST",
      endpointEnvName: "STANDBY_POWER_PRODUCTS_ENDPOINT",
      requiresKey: true,
      keyEnvName: "DATA_GO_KR_SERVICE_KEY",
      docsUrl: sourceMeta("standby_power_products").docsUrl,
      normalize: (raw) => normalizeCertificate(raw, "ENERGY")
    })
  ];
}

function createStubConnector(sourceCode: string): Connector {
  const source = sourceMeta(sourceCode);
  return {
    sourceCode,
    displayName: source.name,
    category: source.category,
    requiresKey: source.requiresKey,
    keyEnvName: source.keyEnvName,
    docsUrl: source.docsUrl,
    async fetchRaw(params) {
      const records = mockRecordsForSource(sourceCode, params);
      return {
        sourceCode,
        retrievedAt: new Date().toISOString(),
        params,
        raw: { stub: true, records },
        records,
        evidenceUrl: source.docsUrl,
        usedMock: true
      };
    },
    async normalize(raw: RawFetchResult) {
      return raw.records.map((record) => ({
        type: "SEARCH_RESULT",
        sourceCode,
        sourceRecordId: sourceCode,
        evidenceUrl: raw.evidenceUrl,
        rawJson: record,
        retrievedAt: raw.retrievedAt,
        extra: { note: "Stub connector output" }
      }));
    }
  };
}

const realConnectors = implementedConnectors();

export function getConnector(sourceCode: string): Connector {
  return realConnectors.find((connector) => connector.sourceCode === sourceCode) ?? createStubConnector(sourceCode);
}

export function listConnectors(): Connector[] {
  const realCodes = new Set(realConnectors.map((connector) => connector.sourceCode));
  return [
    ...realConnectors,
    ...API_SOURCE_DEFINITIONS.filter((source) => !realCodes.has(source.code)).map((source) => createStubConnector(source.code))
  ];
}
