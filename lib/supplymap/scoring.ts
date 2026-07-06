import type {
  CandidateScore,
  CandidateScoreBreakdown,
  CandidateScoreComponent,
  ProductIntent,
  Provenance,
  RiskSignalRecord,
  SupplierCandidate,
  SupplySourceType,
  VerificationStatus
} from "./types";

export const SCORE_LIMITS = {
  productFit: 30,
  publicDataConfidence: 20,
  complianceReadiness: 20,
  locationLogistics: 15,
  countryPaymentRisk: 15,
  total: 100
} as const;

const SOURCE_CONFIDENCE_BASE: Record<SupplySourceType, number> = {
  MOTIE_PUBLIC: 18,
  OTHER_PUBLIC: 14,
  USER_UPLOAD: 8,
  PRIVATE: 4
};

const VERIFICATION_ADJUSTMENT: Record<VerificationStatus, number> = {
  VERIFIED: 2,
  PARTIAL: 0,
  CHECK_REQUIRED: -2,
  MOCK: -1
};

const COUNTRY_RISK_BASE: Record<string, number> = {
  KR: 13,
  대한민국: 13,
  한국: 13,
  CN: 9,
  중국: 9,
  China: 9,
  CHN: 9,
  VN: 10,
  베트남: 10,
  US: 11,
  미국: 11
};

const GLOBAL_LOGISTICS_HUBS = /Shenzhen|Dongguan|Guangzhou|Shanghai|Suzhou|Qingdao|Ningbo|Haiphong|Hai Phong|Hanoi|Ho Chi Minh/i;

export type CandidateScoringEvidenceSource = Pick<
  Provenance,
  "sourceType" | "verification" | "providerName" | "datasetName"
>;

export type CandidateScoringContext = {
  intent?: ProductIntent;
};

export type CandidateScoringResult = {
  totalScore: number;
  status: CandidateScore["status"];
  breakdown: CandidateScoreBreakdown;
  decisionSupportLabel: string;
  riskSummary: string;
};

function clamp(value: number, maxScore: number): number {
  return Math.max(0, Math.min(maxScore, Math.round(value)));
}

function normalizeText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase();
}

function tokens(value: string): string[] {
  return Array.from(new Set(normalizeText(value).match(/[\p{L}\p{N}]+/gu) ?? [])).filter((token) => token.length >= 2);
}

function component(
  score: number,
  maxScore: number,
  reason: string,
  status: CandidateScoreComponent["status"]
): CandidateScoreComponent {
  return { score: clamp(score, maxScore), maxScore, reason, status };
}

function candidateText(candidate: SupplierCandidate): string {
  return [
    candidate.name,
    candidate.products.join(" "),
    candidate.hsCodes.join(" "),
    candidate.description,
    candidate.matchReason,
    candidate.region,
    candidate.city,
    candidate.industrialComplex
  ]
    .filter(Boolean)
    .join(" ");
}

function intentTerms(intent?: ProductIntent): string[] {
  if (!intent) return [];
  return Array.from(
    new Set([
      ...tokens(intent.query),
      ...intent.keywords.flatMap(tokens),
      ...tokens(intent.category),
      ...intent.hsCodeCandidates.map((code) => code.replace(/[^0-9]/g, "").slice(0, 6)).filter(Boolean)
    ])
  ).filter((term) => term !== "품목" && term !== "확인" && term !== "필요");
}

function relevantSignals(candidate: SupplierCandidate, signals: readonly RiskSignalRecord[]): RiskSignalRecord[] {
  return signals.filter((signal) => !signal.supplierId || signal.supplierId === candidate.id);
}

export function calculateProductFitScore(
  candidate: SupplierCandidate,
  context: CandidateScoringContext = {}
): CandidateScoreComponent {
  const terms = intentTerms(context.intent);
  const haystack = normalizeText(candidateText(candidate));

  if (terms.length === 0) {
    const fallback = candidate.products.length > 0 ? 18 : 10;
    return component(
      fallback,
      SCORE_LIMITS.productFit,
      candidate.products.length > 0
        ? "제품명이 비어 있어 생산품 보유 여부만 보수적으로 반영"
        : "제품명·생산품 매칭 근거가 부족해 확인 필요",
      "확인 필요"
    );
  }

  const hits = terms.filter((term) => haystack.includes(normalizeText(term))).length;
  const hsHit = context.intent?.hsCodeCandidates.some((code) => {
    const normalized = code.replace(/[^0-9]/g, "").slice(0, 6);
    return normalized.length >= 4 && candidate.hsCodes.some((candidateCode) => candidateCode.includes(normalized));
  });
  const coverage = hits / Math.max(terms.length, 1);
  const score = 10 + coverage * 16 + (hsHit ? 4 : 0);
  const status: CandidateScoreComponent["status"] = coverage >= 0.55 || hsHit ? "확인" : coverage >= 0.25 ? "주의" : "확인 필요";
  const reason =
    coverage >= 0.55 || hsHit
      ? "생산품 키워드와 제품명이 높게 일치"
      : coverage >= 0.25
        ? "일부 생산품 키워드만 일치해 세부 사양 확인 필요"
        : "제품명과 생산품 텍스트의 직접 매칭이 약해 확인 필요";

  return component(score, SCORE_LIMITS.productFit, reason, status);
}

export function calculatePublicDataConfidenceScore(
  candidate: SupplierCandidate,
  evidenceSources: readonly CandidateScoringEvidenceSource[] = []
): CandidateScoreComponent {
  const sources = evidenceSources.length > 0
    ? evidenceSources
    : [
        {
          sourceType: candidate.sourceType,
          verification: candidate.verification,
          providerName: candidate.providerName,
          datasetName: candidate.datasetName
        }
      ];
  const best = sources
    .map((source) => ({
      source,
      score: SOURCE_CONFIDENCE_BASE[source.sourceType] + VERIFICATION_ADJUSTMENT[source.verification]
    }))
    .sort((left, right) => right.score - left.score)[0];
  const sourceType = best?.source.sourceType ?? candidate.sourceType;
  const score = best?.score ?? SOURCE_CONFIDENCE_BASE[candidate.sourceType];

  if (sourceType === "MOTIE_PUBLIC") {
    return component(
      score + (candidate.scope === "DOMESTIC" ? 1 : 0),
      SCORE_LIMITS.publicDataConfidence,
      "MOTIE_PUBLIC 출처에서 확인된 국내 공급망 근거",
      candidate.verification === "CHECK_REQUIRED" ? "주의" : "확인"
    );
  }
  if (sourceType === "OTHER_PUBLIC") {
    return component(score, SCORE_LIMITS.publicDataConfidence, "타 기관 공공데이터 출처이나 산업부 직접 데이터는 아님", "주의");
  }
  if (sourceType === "USER_UPLOAD") {
    return component(score, SCORE_LIMITS.publicDataConfidence, "사용자 업로드 자료로 원본 권한·최신성 확인 필요", "확인 필요");
  }
  return component(score, SCORE_LIMITS.publicDataConfidence, "PRIVATE 출처라 공공데이터 확인도에서 감점", "확인 필요");
}

export function calculateComplianceReadinessScore(
  candidate: SupplierCandidate,
  riskSignals: readonly RiskSignalRecord[] = []
): CandidateScoreComponent {
  const signals = relevantSignals(candidate, riskSignals).filter((signal) =>
    ["CERTIFICATION", "CUSTOMS", "RECALL", "STRATEGIC_GOODS", "TRADE_SECURITY"].includes(signal.kind)
  );
  if (signals.length === 0) {
    return component(
      candidate.scope === "DOMESTIC" ? 10 : 8,
      SCORE_LIMITS.complianceReadiness,
      "인증·통관 RiskSignal이 없어 낮은 리스크로 단정하지 않고 확인 필요 처리",
      "확인 필요"
    );
  }

  const high = signals.filter((signal) => signal.severity === "HIGH").length;
  const medium = signals.filter((signal) => signal.severity === "MEDIUM").length;
  const unknown = signals.filter((signal) => signal.severity === "UNKNOWN" || signal.severity === "NEEDS_CHECK" || signal.status === "확인 필요").length;
  const warnings = signals.filter((signal) => signal.status !== "확인").length;
  const score = 17 - high * 5 - medium * 2 - unknown * 2 - Math.max(0, warnings - 1);
  const status: CandidateScoreComponent["status"] = high > 0 || medium > 0 ? "주의" : unknown > 0 ? "확인 필요" : "확인";
  const reason =
    high > 0
      ? "고위험 인증·통관 신호가 있어 계약 전 원문 확인 필요"
      : medium > 0 || warnings > 0
        ? "인증·통관 관련 주의 신호가 있어 요건승인기관 확인 필요"
        : "조회된 인증·통관 신호 기준으로 중대 경고는 없으나 최종 판단은 아님";

  return component(score, SCORE_LIMITS.complianceReadiness, reason, status);
}

export function calculateLocationLogisticsScore(
  candidate: SupplierCandidate,
  context: CandidateScoringContext = {}
): CandidateScoreComponent {
  if (candidate.scope === "DOMESTIC") {
    if (
      context.intent?.preferredRegion &&
      context.intent.preferredRegion !== "전국" &&
      [candidate.region, candidate.city, candidate.address, candidate.industrialComplex].some((value) =>
        value?.includes(context.intent?.preferredRegion ?? "")
      )
    ) {
      return component(15, SCORE_LIMITS.locationLogistics, "희망 공급 권역과 국내 후보 위치가 일치", "확인");
    }
    if (candidate.region || candidate.address || candidate.industrialComplex) {
      return component(13, SCORE_LIMITS.locationLogistics, "국내 후보 위치와 산업단지 정보가 있어 물류 검토 가능", "주의");
    }
    return component(9, SCORE_LIMITS.locationLogistics, "국내 후보 위치 정보가 부족해 물류 적합도 확인 필요", "확인 필요");
  }

  const locationText = [candidate.city, candidate.region, candidate.address].filter(Boolean).join(" ");
  if (GLOBAL_LOGISTICS_HUBS.test(locationText)) {
    return component(9, SCORE_LIMITS.locationLogistics, "해외 주요 제조·항만 권역 후보이나 실제 운임·리드타임 확인 필요", "주의");
  }
  if (candidate.city || candidate.region || candidate.address) {
    return component(7, SCORE_LIMITS.locationLogistics, "해외 위치는 확인되나 항만·내륙물류 조건은 추가 확인 필요", "확인 필요");
  }
  return component(5, SCORE_LIMITS.locationLogistics, "해외 후보 위치 정보가 부족해 물류 적합도 확인 필요", "확인 필요");
}

export function calculateCountryPaymentRiskScore(
  candidate: SupplierCandidate,
  riskSignals: readonly RiskSignalRecord[] = []
): CandidateScoreComponent {
  const base = COUNTRY_RISK_BASE[candidate.countryCode] ?? COUNTRY_RISK_BASE[candidate.countryName] ?? 8;
  const signals = relevantSignals(candidate, riskSignals).filter((signal) =>
    ["COUNTRY", "PAYMENT", "NEWS", "COUNTRY_RISK", "MARKET"].includes(signal.kind)
  );

  if (signals.length === 0) {
    return component(
      candidate.scope === "DOMESTIC" ? Math.min(base, 12) : Math.min(base, 8),
      SCORE_LIMITS.countryPaymentRisk,
      "국가·거래위험 RiskSignal이 없어 낮은 리스크로 단정하지 않고 확인 필요 처리",
      "확인 필요"
    );
  }

  const high = signals.filter((signal) => signal.severity === "HIGH").length;
  const medium = signals.filter((signal) => signal.severity === "MEDIUM").length;
  const unknown = signals.filter((signal) => signal.severity === "UNKNOWN" || signal.severity === "NEEDS_CHECK" || signal.status === "확인 필요").length;
  const score = base - high * 4 - medium * 2 - unknown;
  const status: CandidateScoreComponent["status"] = high > 0 || medium > 0 ? "주의" : unknown > 0 ? "확인 필요" : "확인";
  const reason =
    candidate.scope === "DOMESTIC"
      ? "국내 거래 후보이나 지급조건·거래처 신용은 별도 확인 필요"
      : high > 0 || medium > 0
        ? "국가·시장 신호에 주의 요소가 있어 결제조건과 무역보험 검토 필요"
        : "조회된 국가·시장 신호 기준의 보조 점수이며 최신 리포트 확인 필요";

  return component(score, SCORE_LIMITS.countryPaymentRisk, reason, status);
}

function statusForTotal(totalScore: number): CandidateScore["status"] {
  if (totalScore >= 78) return "추천";
  if (totalScore >= 58) return "비교 검토";
  return "확인 필요";
}

function decisionSupportLabel(status: CandidateScore["status"]): string {
  if (status === "추천") return "의사결정 보조 점수: 추천";
  if (status === "비교 검토") return "의사결정 보조 점수: 비교 검토";
  return "의사결정 보조 점수: 확인 필요";
}

function riskSummary(breakdown: CandidateScoreBreakdown): string {
  const needsCheck = Object.values(breakdown).filter((item) => item.status === "확인 필요").length;
  const warnings = Object.values(breakdown).filter((item) => item.status === "주의").length;
  if (needsCheck > 0) return `확인 필요 ${needsCheck}개 항목이 있어 원문·증빙 확인 후 판단`;
  if (warnings > 0) return `주의 ${warnings}개 항목이 있어 조건 비교 후 판단`;
  return "조회된 근거 기준 보조 점수는 양호하나 최종 인증·계약 판단은 별도 확인";
}

export function calculateCandidateScore(
  candidate: SupplierCandidate,
  riskSignals: readonly RiskSignalRecord[] = [],
  evidenceSources: readonly CandidateScoringEvidenceSource[] = [],
  context: CandidateScoringContext = {}
): CandidateScoringResult {
  const breakdown: CandidateScoreBreakdown = {
    productFit: calculateProductFitScore(candidate, context),
    publicDataConfidence: calculatePublicDataConfidenceScore(candidate, evidenceSources),
    complianceReadiness: calculateComplianceReadinessScore(candidate, riskSignals),
    locationLogistics: calculateLocationLogisticsScore(candidate, context),
    countryPaymentRisk: calculateCountryPaymentRiskScore(candidate, riskSignals)
  };
  const totalScore = clamp(
    breakdown.productFit.score +
      breakdown.publicDataConfidence.score +
      breakdown.complianceReadiness.score +
      breakdown.locationLogistics.score +
      breakdown.countryPaymentRisk.score,
    SCORE_LIMITS.total
  );
  const status = statusForTotal(totalScore);
  return {
    totalScore,
    status,
    breakdown,
    decisionSupportLabel: decisionSupportLabel(status),
    riskSummary: riskSummary(breakdown)
  };
}

export function toCandidateScore(result: CandidateScoringResult): CandidateScore {
  return {
    productFit: result.breakdown.productFit.score,
    publicVerification: result.breakdown.publicDataConfidence.score,
    complianceReadiness: result.breakdown.complianceReadiness.score,
    logisticsFit: result.breakdown.locationLogistics.score,
    countryTransactionRisk: result.breakdown.countryPaymentRisk.score,
    total: result.totalScore,
    totalScore: result.totalScore,
    status: result.status,
    breakdown: result.breakdown,
    decisionSupportLabel: result.decisionSupportLabel,
    riskSummary: result.riskSummary
  };
}
