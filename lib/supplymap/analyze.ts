import { summarizeScores } from "./compare";
import { findDomesticSupply } from "./domestic";
import { findGlobalSupply } from "./global";
import { buildGroundedAnswer } from "./grounded-answer";
import { extractProductIntent } from "./intent";
import { mockEvidence } from "./mock-data";
import {
  SUPPLYMAP_MOCK_EVIDENCE,
  type SupplyMapCandidate,
  type SupplyMapEvidence,
  type SupplyMapRagContext
} from "./rag";
import { analyzeRisks, scoreCandidates } from "./risk";
import type {
  EvidenceRecord,
  SupplierCandidate,
  SupplyMapAnalysisRequest,
  SupplyMapAnalysisResponse,
  SupplyMapComparableCandidate,
  SupplySourceType
} from "./types";

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function candidateEvidence(candidate: SupplierCandidate): EvidenceRecord {
  return {
    id: "EV-CAND-" + candidate.id,
    title: candidate.name,
    snippet:
      candidate.matchReason +
      " · " +
      (candidate.products.join(", ") || "생산품 확인 필요") +
      " · 의사결정 보조 점수 " +
      (candidate.score?.total ?? "확인 필요") +
      " · " +
      (candidate.score?.riskSummary ?? "점수 사유 확인 필요"),
    claim: candidate.scope === "DOMESTIC" ? "국내 공장 비교 후보" : "중국/해외 베타 비교 후보",
    url: candidate.sourceUrl,
    providerName: candidate.providerName,
    datasetName: candidate.datasetName,
    sourceType: candidate.sourceType,
    sourceUrl: candidate.sourceUrl,
    fetchedAt: candidate.fetchedAt,
    license: candidate.license,
    verification: candidate.verification
  };
}

function evidenceSourceType(sourceName: string): SupplySourceType {
  if (/산업통상|KICOX|산업단지|KOTRA|무역보험/i.test(sourceName)) return "MOTIE_PUBLIC";
  if (/식약|관세|Safety/i.test(sourceName)) return "OTHER_PUBLIC";
  return "PRIVATE";
}

function ragEvidenceToRecord(evidence: SupplyMapEvidence): EvidenceRecord {
  const sourceType = evidenceSourceType(evidence.sourceName);
  return {
    id: evidence.id,
    title: evidence.title,
    snippet: evidence.snippet,
    claim: evidence.isMock ? "샘플 fallback 스냅샷" : "공개 원문 근거",
    url: evidence.url,
    providerName: evidence.sourceName,
    datasetName: evidence.title,
    sourceType,
    sourceUrl: evidence.url ?? "about:blank",
    fetchedAt: evidence.retrievedAt,
    license: sourceType === "MOTIE_PUBLIC" ? "공공데이터·공공누리 원천 이용조건 준수" : "원천 이용조건 확인 필요",
    verification: evidence.isMock ? "MOCK" : "PARTIAL"
  };
}

function evidenceRecordToRag(evidence: EvidenceRecord, scope: SupplyMapEvidence["scope"]): SupplyMapEvidence {
  return {
    id: evidence.id,
    sourceCode: evidence.datasetName,
    sourceName: evidence.providerName,
    sourceKind: evidence.sourceType === "MOTIE_PUBLIC" ? "public-data" : "database",
    scope,
    title: evidence.title,
    snippet: evidence.snippet,
    url: evidence.url ?? evidence.sourceUrl,
    retrievedAt: evidence.fetchedAt,
    isMock: evidence.verification === "MOCK",
    tags: []
  };
}

function countryEvidenceIds(country?: string): string[] {
  if (country === "VN" || country === "베트남") return ["KOTRA-NEWS-VN-001", "KOTRA-COUNTRY-VN-001"];
  if (country === "PL" || country === "폴란드") return ["KOTRA-NEWS-PL-001", "KOTRA-COUNTRY-PL-001"];
  return ["KOTRA-NEWS-CN-001", "KOTRA-COUNTRY-CN-001"];
}

function toRagCandidate(
  candidate: SupplierCandidate,
  rank: number,
  extraEvidenceIds: string[]
): SupplyMapCandidate {
  const evidenceIds = unique(["EV-CAND-" + candidate.id, ...extraEvidenceIds]);
  return {
    id: candidate.id,
    type: candidate.scope === "DOMESTIC" ? "domestic-cluster" : "global-factory",
    priority: candidate.scope === "DOMESTIC" ? "primary" : "secondary",
    rank,
    name: candidate.name,
    location: [candidate.countryName, candidate.region, candidate.city].filter(Boolean).join(" "),
    capability: candidate.products.join(", ") || "생산품 확인 필요",
    matchScore: candidate.score?.total ?? 0,
    matchReasons: [
      {
        id: candidate.id + "-match",
        text:
          candidate.matchReason +
          (candidate.score?.breakdown
            ? ` · 제품 적합도 ${candidate.score.breakdown.productFit.score}/${candidate.score.breakdown.productFit.maxScore}: ${candidate.score.breakdown.productFit.reason}`
            : ""),
        evidenceIds,
        verificationStatus: "grounded"
      }
    ],
    riskLevel: candidate.score && candidate.score.total >= 75 ? "LOW" : candidate.score && candidate.score.total >= 55 ? "MEDIUM" : "UNKNOWN",
    riskSignals: [
      {
        id: candidate.id + "-risk",
        text:
          candidate.scope === "DOMESTIC"
            ? `공장등록·생산품 원문과 현재 생산능력은 계약 전에 재확인해야 합니다. ${
                candidate.score?.breakdown?.complianceReadiness.reason ?? ""
              }`
            : `해외 후보는 사업자 실재성, 생산능력, 인증서 원문과 거래조건 확인이 필요합니다. ${
                candidate.score?.breakdown?.countryPaymentRisk.reason ?? ""
              }`,
        evidenceIds,
        verificationStatus: "grounded"
      }
    ],
    evidenceIds,
    verificationStatus: "grounded",
    unverifiedFields: ["현재 생산능력", "가격·납기", "인증서 원문"],
    isMock: candidate.verification === "MOCK"
  };
}

function candidateType(candidate: SupplierCandidate): SupplyMapComparableCandidate["candidateType"] {
  return candidate.scope === "DOMESTIC" ? "DOMESTIC_SUPPLIER" : "GLOBAL_FACTORY";
}

function candidateRiskSummary(candidate: SupplierCandidate): string {
  if (candidate.score?.riskSummary) return candidate.score.riskSummary;
  if (candidate.scope === "DOMESTIC") {
    if ((candidate.score?.total ?? 0) >= 78) return "국내 공공데이터 근거가 강한 비교 후보입니다.";
    return "국내 공공데이터 후보이나 생산능력·단가·납기는 계약 전 확인 필요합니다.";
  }
  if (candidate.sourceType === "OTHER_PUBLIC") {
    return "타 기관 공공데이터 기반 해외 제조업소입니다. 인증서 원문과 거래조건 확인 필요";
  }
  if (candidate.sourceType === "USER_UPLOAD") {
    return "사용자 업로드 해외 후보입니다. 원본 권한·최신성·사업자 실재성 확인 필요";
  }
  return "민간·중국/해외 베타 데이터 후보입니다. 공장 실사, 인증서, 거래신용 확인 필요";
}

function toComparableCandidate(candidate: SupplierCandidate): SupplyMapComparableCandidate {
  return {
    id: candidate.id,
    candidateType: candidateType(candidate),
    name: candidate.name,
    country: candidate.countryName,
    countryCode: candidate.countryCode,
    region: candidate.region,
    city: candidate.city,
    address: candidate.address,
    productText: candidate.products.slice(0, 6).join(", ") || "생산품 확인 필요",
    industrialComplex: candidate.industrialComplex,
    matchScore: candidate.score?.total ?? 0,
    sourceType: candidate.sourceType,
    sourceName: candidate.providerName,
    datasetName: candidate.datasetName,
    verification: candidate.verification,
    riskSummary: candidateRiskSummary(candidate),
    scoreBreakdown: candidate.score?.breakdown,
    evidenceIds: ["EV-CAND-" + candidate.id],
    latitude: candidate.latitude,
    longitude: candidate.longitude
  };
}

function countSourceTypes(evidence: EvidenceRecord[]): Record<SupplySourceType, number> {
  const result: Record<SupplySourceType, number> = {
    MOTIE_PUBLIC: 0,
    OTHER_PUBLIC: 0,
    PRIVATE: 0,
    USER_UPLOAD: 0
  };
  for (const item of evidence) result[item.sourceType] += 1;
  return result;
}

export async function analyzeSupplyMap(request: SupplyMapAnalysisRequest): Promise<SupplyMapAnalysisResponse> {
  const intent = extractProductIntent(request);
  const [domestic, global, riskSignals] = await Promise.all([
    findDomesticSupply(intent),
    findGlobalSupply(intent),
    analyzeRisks(intent)
  ]);
  const domesticCandidates = scoreCandidates(domestic.candidates, intent, riskSignals);
  const globalCandidates = scoreCandidates(global.candidates, intent, riskSignals);
  const comparisonCandidates = [
    ...domesticCandidates.map(toComparableCandidate),
    ...globalCandidates.map(toComparableCandidate)
  ].sort(
    (left, right) =>
      (left.candidateType === "DOMESTIC_SUPPLIER" ? 0 : 1) -
        (right.candidateType === "DOMESTIC_SUPPLIER" ? 0 : 1) ||
      right.matchScore - left.matchScore ||
      left.name.localeCompare(right.name)
  );
  const scoreSummary = summarizeScores(domesticCandidates, globalCandidates);

  const candidateEvidenceRecords = [...domesticCandidates, ...globalCandidates].map(candidateEvidence);
  const riskEvidenceRecords: EvidenceRecord[] = riskSignals.map((signal) => ({
    id: "EV-RISK-" + signal.id,
    title: signal.title,
    snippet: signal.summary,
    claim: signal.status,
    url: signal.sourceUrl,
    providerName: signal.providerName,
    datasetName: signal.datasetName,
    sourceType: signal.sourceType,
    sourceUrl: signal.sourceUrl,
    fetchedAt: signal.fetchedAt,
    license: signal.license,
    verification: signal.verification
  }));
  const countryIds = countryEvidenceIds(intent.importCountry);
  const ragCorpus = SUPPLYMAP_MOCK_EVIDENCE.filter(
    (item) =>
      ["MOTIE-SC-001", "KOTRA-QA-001", ...countryIds].includes(item.id) ||
      item.id.startsWith("KICOX-DOM-")
  );
  const evidence = [
    ...candidateEvidenceRecords,
    ...riskEvidenceRecords,
    ...mockEvidence(),
    ...ragCorpus.map(ragEvidenceToRecord)
  ].filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index);

  const ragEvidence = [
    ...candidateEvidenceRecords.map((item) =>
      evidenceRecordToRag(item, item.sourceType === "MOTIE_PUBLIC" ? "domestic" : "global")
    ),
    ...ragCorpus
  ].filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index);
  const ragContext: SupplyMapRagContext = {
    input: {
      query: intent.query,
      productName: intent.query,
      hsCode: intent.hsCode,
      targetCountry: intent.importCountry,
      mode: request.judgeDemo ? "mock" : "hybrid",
      useDeepSeek: !request.judgeDemo
    },
    domesticCandidates: domesticCandidates.map((candidate, index) =>
      toRagCandidate(candidate, index + 1, ["MOTIE-SC-001", "KICOX-DOM-001"])
    ),
    globalCandidates: globalCandidates.map((candidate, index) =>
      toRagCandidate(candidate, index + 1, ["KOTRA-QA-001", ...countryIds])
    ),
    evidence: ragEvidence,
    warnings: [],
    generatedAt: new Date().toISOString()
  };
  const grounded = await buildGroundedAnswer(ragContext, { useDeepSeek: !request.judgeDemo });

  return {
    analysisId: "SMA-" + Date.now().toString(36).toUpperCase(),
    generatedAt: ragContext.generatedAt,
    demoMode: Boolean(request.judgeDemo || domestic.usedMock || global.usedMock),
    intent,
    domesticCandidates,
    globalCandidates,
    comparisonCandidates,
    industrialComplexes: domestic.complexes,
    riskSignals,
    scoreSummary,
    answer: {
      headline:
        domesticCandidates.length > 0
          ? "국내 공장 후보와 중국/해외 베타 후보를 같은 품목 기준으로 비교하세요."
          : "국내 생산품 근거를 추가 확인하면서 중국/해외 후보 검증을 병행하세요.",
      summary: scoreSummary.recommendation,
      sections: grounded.answerSections.map((section) => ({
        title: section.title,
        body: section.statements
          .map(
            (statement) =>
              statement.text +
              (statement.evidenceIds.length > 0 ? " [" + statement.evidenceIds.join(", ") + "]" : "")
          )
          .join("\n"),
        evidenceIds: unique(section.statements.flatMap((statement) => statement.evidenceIds))
      })),
      model: grounded.model,
      grounded: true
    },
    evidence,
    dataSourceCounts: countSourceTypes(evidence),
    notices: [
      "샘플 데이터 모드와 MOCK 표시는 실제 API 응답이 아니라 fallback 데이터임을 의미합니다.",
      "해외 공장 데이터는 보조 후보이며 정부가 안전성이나 거래 신뢰를 보증한다는 의미가 아닙니다.",
      "현재 확보된 데이터에서는 확인된 리스크가 적더라도 안전하다는 뜻은 아니며, 최종 인증·통관 판단은 관계기관 확인이 필요합니다.",
      "HS코드·인증·수입요건은 최종 제품 사양을 기준으로 관할기관에 재확인해야 합니다.",
      ...grounded.warnings
    ]
  };
}
