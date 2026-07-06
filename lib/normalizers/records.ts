import type { NormalizedRecord, RawFetchResult } from "@/lib/connectors/types";
import { pickNumber, pickString, sourceRecordId } from "./helpers";

function now(raw: RawFetchResult): string {
  return raw.retrievedAt;
}

export function normalizeHsCode(raw: RawFetchResult): NormalizedRecord[] {
  return raw.records.map((record) => {
    const hsCode = pickString(record, ["hsCode", "hscode", "HS_CODE", "hsCd", "hs부호", "품목번호", "hsk"]);
    const productName =
      pickString(record, ["koreanName", "korName", "품명", "한글품명", "itemName", "prnm", "statKor"]) ??
      pickString(record, ["englishName", "engName", "영문품명", "statEng"]);
    return {
      type: "PRODUCT",
      sourceCode: raw.sourceCode,
      sourceRecordId: sourceRecordId(record, [hsCode, productName]),
      hsCode,
      productName,
      evidenceUrl: raw.evidenceUrl,
      rawJson: record,
      retrievedAt: now(raw),
      extra: {
        category: "HS Code"
      }
    };
  });
}

export function normalizeTradeRequirement(raw: RawFetchResult): NormalizedRecord[] {
  return raw.records.map((record) => {
    const hsCode = pickString(record, ["hsCode", "hscode", "HS_CODE", "hsCd", "품목번호", "hsk", "hsSgn"]);
    return {
      type: "TRADE_REQUIREMENT",
      sourceCode: raw.sourceCode,
      sourceRecordId: sourceRecordId(record, [hsCode, pickString(record, ["lawName", "법령명", "dcerCfrmLworNm"])]),
      hsCode,
      evidenceUrl: raw.evidenceUrl,
      rawJson: record,
      retrievedAt: now(raw),
      extra: {
        importExportType: pickString(record, ["importExportType", "수출입구분", "imexTp", "imexTpCd", "bfhnAffcRtmTpcd"]),
        lawName: pickString(record, ["lawName", "법령명", "lworNm", "dcerCfrmLworNm"]),
        agencyName: pickString(record, ["agencyName", "요건승인기관", "기관명", "ogzNm", "reqApreIttNm"]),
        requirementName: pickString(record, ["requirementName", "요건명", "확인사항", "reqNm", "reqCfrmIstmNm"]),
        lawCode: pickString(record, ["dcerCfrmLworCd"]),
        agencyCode: pickString(record, ["reqApreIttCd"]),
        applyStartDate: pickString(record, ["aplyStrtDt"])
      }
    };
  });
}

export function normalizeTradeStat(raw: RawFetchResult): NormalizedRecord[] {
  return raw.records.map((record) => {
    const hsCode = pickString(record, ["hsCode", "hscode", "HS_CODE", "hsCd", "품목번호"]);
    const country = pickString(record, ["country", "국가", "statCdCntnKor1", "cntyNm", "countryName"]);
    return {
      type: "TRADE_STAT",
      sourceCode: raw.sourceCode,
      sourceRecordId: sourceRecordId(record, [hsCode, country, pickString(record, ["year", "기간"])]),
      hsCode,
      country,
      evidenceUrl: raw.evidenceUrl,
      rawJson: record,
      retrievedAt: now(raw),
      extra: {
        importAmountUsd: pickNumber(record, ["importAmountUsd", "impDlr", "수입금액", "importAmount"]),
        exportAmountUsd: pickNumber(record, ["exportAmountUsd", "expDlr", "수출금액", "exportAmount"]),
        importWeightKg: pickNumber(record, ["impWgt", "수입중량"]),
        exportWeightKg: pickNumber(record, ["expWgt", "수출중량"])
      }
    };
  });
}

export function normalizeCertificate(raw: RawFetchResult, certType: string): NormalizedRecord[] {
  return raw.records.map((record) => {
    const manufacturer =
      pickString(record, [
        "manufacturerName",
        "제조자",
        "제조업체명",
        "제조사",
        "maker",
        "mnftrNm",
        "ENTP_NM",
        "PRMSN_ENTP_NM",
        "OCTR_MNFT_BSSH_NM",
        "ENTRPS",
        "MANUF_NM",
        "업체명"
      ]) ??
      pickString(record, ["factoryName", "업체명", "entrps"]);
    const productName = pickString(record, ["productName", "제품명", "기자재명", "prdlstNm", "PRDLST_NM", "ITEM_NM", "PRDUCT", "itemName", "품목명"]);
    const certNumber = pickString(record, ["certNumber", "인증번호", "등록번호", "허가번호", "certNo", "aplcNo", "PRMSN_NO", "PRDUCT_PRMISN_NO", "ITEM_SEQ", "인증/등록번호"]);
    return {
      type: "CERTIFICATE",
      sourceCode: raw.sourceCode,
      sourceRecordId: sourceRecordId(record, [certNumber, manufacturer, productName]),
      canonicalName: manufacturer,
      country: pickString(record, ["country", "제조국", "제조국가", "mnftrNtn", "NATN_NM", "NATN_CD"]),
      productName,
      certNumber,
      evidenceUrl: raw.evidenceUrl,
      rawJson: record,
      retrievedAt: now(raw),
      extra: {
        certType,
        modelName: pickString(record, ["modelName", "모델명", "model", "mldNm", "MODEL_NM"]),
        importerName: pickString(record, ["importerName", "수입자", "수입업체명", "IMPORTER_NM"]),
        status: pickString(record, ["status", "상태", "인증상태", "품목상태", "sttus", "PRDLST_STTS", "PRMISN_STTEMNT", "RTRCN_SUSP_NM", "FOOD_SAFE_MNG_SYS_CERT_YN"]),
        issueDate: pickString(record, ["issueDate", "인증일자", "등록일자", "허가일자", "issuDate", "PRMSN_DT", "CERT_INST_CERT_DT"]),
        expiryDate: pickString(record, ["expiryDate", "만료일자", "유효기간", "CERT_INST_EXPRN_DT"]),
        certName: pickString(record, ["CERT_NM", "certName"]),
        certInstituteName: pickString(record, ["CERT_INST_NM", "certInstituteName"])
      }
    };
  });
}

export function normalizeFactory(raw: RawFetchResult): NormalizedRecord[] {
  return raw.records.map((record) => {
    const canonicalName =
      pickString(record, [
        "canonicalName",
        "businessName",
        "factoryName",
        "업소명",
        "제조업소명",
        "제조업체명",
        "ovseaMnftBsshNm",
        "OCTR_MNFT_BSSH_NM",
        "ENTP_NM",
        "PRMSN_ENTP_NM",
        "BSSH_NM",
        "MNFTR_NM",
        "ENTRPS",
        "MANUF_NM"
      ]) ?? pickString(record, ["manufacturerName", "제조업체명"]);
    const country = pickString(record, [
      "country",
      "국가",
      "countryName",
      "ntnNm",
      "제조국",
      "제조국가",
      "NATN_NM",
      "NATN_CD",
      "MNFT_NATN_NM",
      "MNFTR_NATN_NM"
    ]);
    const address = pickString(record, [
      "address",
      "주소",
      "addr",
      "addressRaw",
      "ovseaMnftBsshAddr",
      "OCTR_MNFT_BSSH_ADDR",
      "ENTP_ADDR",
      "PRMSN_ENTP_ADDR",
      "BSSH_ADDR",
      "LOCPLC_ADDR",
      "LCTN_ADDR",
      "MNFT_ADDR",
      "MNFTR_ADDR"
    ]);
    return {
      type: "FACTORY",
      sourceCode: raw.sourceCode,
      sourceRecordId: sourceRecordId(record, [canonicalName, country, address]),
      canonicalName,
      country,
      address,
      evidenceUrl: raw.evidenceUrl,
      rawJson: record,
      retrievedAt: now(raw),
      extra: {
        province: pickString(record, ["province", "성", "state", "AREA_NM", "SIDO_NM"]),
        city: pickString(record, ["city", "도시", "ctyNm", "AREA_NM", "SIGUNGU_NM"]),
        productName: pickString(record, ["productName", "품목", "품목명", "제품명", "prdlstNm", "PRDLST_NM", "ITEM_NM", "PRDUCT", "FOOD_SE_NM"]),
        status: pickString(record, ["status", "상태", "중단여부", "RTRCN_SUSP_NM"]),
        permitNumber: pickString(record, ["PRMSN_NO", "허가번호", "ITEM_SEQ"]),
        permitDate: pickString(record, ["PRMSN_DT", "허가일자"]),
        businessType: pickString(record, ["OCTR_MNFT_ENTP_BSN_DIVS_NM"]),
        foodSafetyManagementSystemCertified: pickString(record, ["FOOD_SAFE_MNG_SYS_CERT_YN"]),
        foodSafetyCertificateName: pickString(record, ["CERT_NM"]),
        foodSafetyCertificateInstitute: pickString(record, ["CERT_INST_NM"]),
        foodValidityStartDate: pickString(record, ["FOOD_SLDT_BGNG_DT"]),
        foodValidityEndDate: pickString(record, ["FOOD_SLDT_END_DT"]),
        importSuspensionNo: pickString(record, ["IPRT_SUSP_NO"])
      }
    };
  });
}

export function normalizeRiskEvent(raw: RawFetchResult, eventType = "UNKNOWN"): NormalizedRecord[] {
  return raw.records.map((record) => {
    const title =
      pickString(record, ["title", "제목", "제품명", "recallTitle", "prdlstNm"]) ??
      `${raw.sourceCode} risk event`;
    const factoryName = pickString(record, ["factoryName", "업소명", "제조업소명", "manufacturerName"]);
    return {
      type: "RISK_EVENT",
      sourceCode: raw.sourceCode,
      sourceRecordId: sourceRecordId(record, [title, factoryName]),
      canonicalName: factoryName,
      country: pickString(record, ["country", "국가", "제조국"]),
      productName: pickString(record, ["productName", "제품명", "품목"]),
      eventType,
      evidenceUrl: raw.evidenceUrl,
      rawJson: record,
      retrievedAt: now(raw),
      extra: {
        title,
        description: pickString(record, ["description", "상세", "사유", "reason", "부적합항목"]),
        eventDate: pickString(record, ["eventDate", "등록일", "발생일", "중단일자"]),
        severity: pickString(record, ["severity", "위험도", "등급"])
      }
    };
  });
}

export function normalizeCosmeticIngredient(raw: RawFetchResult): NormalizedRecord[] {
  return raw.records.map((record) => {
    const koreanName = pickString(record, ["INGR_KOR_NAME", "ingredientKoreanName", "원료성분명", "한글명"]);
    const englishName = pickString(record, ["INGR_ENG_NAME", "ingredientEnglishName", "영문명"]);
    const casNo = pickString(record, ["CAS_NO", "CAS", "casNo"]);
    const synonym = pickString(record, ["INGR_SYNONYM", "synonym", "이명"]);
    const origin = pickString(record, ["ORIGIN_MAJOR_KOR_NAME", "origin", "기원"]);

    return {
      type: "LEGAL_DOC",
      sourceCode: raw.sourceCode,
      sourceRecordId: sourceRecordId(record, [koreanName, englishName, casNo]),
      productName: koreanName ?? englishName,
      evidenceUrl: raw.evidenceUrl,
      rawJson: record,
      retrievedAt: now(raw),
      extra: {
        koreanName,
        englishName,
        casNo,
        synonym,
        origin,
        domain: "cosmetic_ingredient"
      }
    };
  });
}

export function normalizeCosmeticRestriction(raw: RawFetchResult): NormalizedRecord[] {
  return raw.records.map((record) => {
    const standardName = pickString(record, ["INGR_STD_NAME", "ingredientStandardName", "표준성분명"]);
    const englishName = pickString(record, ["INGR_ENG_NAME", "ingredientEnglishName", "영문명"]);
    const casNo = pickString(record, ["CAS_NO", "CAS", "casNo"]);
    const countryName = pickString(record, ["COUNTRY_NAME", "countryName", "국가명"]);
    const regulateType = pickString(record, ["REGULATE_TYPE", "regulateType", "규제유형"]);

    return {
      type: "LEGAL_DOC",
      sourceCode: raw.sourceCode,
      sourceRecordId: sourceRecordId(record, [regulateType, standardName, englishName, casNo, countryName]),
      productName: standardName ?? englishName,
      country: countryName,
      evidenceUrl: raw.evidenceUrl,
      rawJson: record,
      retrievedAt: now(raw),
      extra: {
        regulateType,
        standardName,
        englishName,
        casNo,
        synonym: pickString(record, ["INGR_SYNONYM", "synonym", "이명"]),
        noticeIngredientName: pickString(record, ["NOTICE_INGR_NAME", "noticeIngredientName", "고시성분명"]),
        provisionArticle: pickString(record, ["PROVIS_ATRCL", "provisionArticle", "조항"]),
        limitCondition: pickString(record, ["LIMIT_COND", "limitCondition", "제한조건"]),
        domain: "cosmetic_restricted_ingredient"
      }
    };
  });
}
