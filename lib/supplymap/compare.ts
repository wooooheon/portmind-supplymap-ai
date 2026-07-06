import type { CandidateScore, ScoreSummary, SupplierCandidate } from "./types";

export type SupplyPairRecommendation = "DOMESTIC_FIRST" | "OVERSEAS_BACKUP" | "REVIEW_REQUIRED";

export type DomesticOverseasComparison = {
  id: string;
  domesticId: string;
  overseasId: string;
  domesticName: string;
  overseasName: string;
  compatibilityScore: number;
  domesticScore: number;
  overseasScore: number;
  recommendation: SupplyPairRecommendation;
  productSimilarity: number;
  hsCodeMatch: number;
  reasons: string[];
};

export type ComparisonOptions = {
  limitPerDomestic?: number;
  minimumCompatibility?: number;
};

function average(values: Array<number | undefined>): number | null {
  const valid = values.filter((value): value is number => typeof value === "number");
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

export function summarizeScores(domestic: SupplierCandidate[], global: SupplierCandidate[]): ScoreSummary {
  const domesticAverage = average(domestic.map((candidate) => candidate.score?.total));
  const globalAverage = average(global.map((candidate) => candidate.score?.total));
  let recommendation = "근거가 충분하지 않아 국내외 후보를 함께 확인해야 합니다.";

  if (domesticAverage !== null && globalAverage !== null) {
    recommendation =
      domesticAverage >= globalAverage
        ? "국내 공장 후보의 근거가 강합니다. 중국/해외 후보는 가격·물량 벤치마크로 함께 비교하세요."
        : "중국/해외 후보의 제품 적합도가 높지만 인증·통관·거래위험 확인을 완료한 뒤 계약해야 합니다.";
  }

  return {
    domesticAverage,
    globalAverage,
    recommendation,
    methodology: "제품 적합도 30 + 공공데이터 확인도 20 + 인증·통관 준비도 20 + 입지·물류 15 + 국가·거래위험 15"
  };
}

export function scoreStatus(total: number): CandidateScore["status"] {
  if (total >= 78) return "추천";
  if (total >= 58) return "비교 검토";
  return "확인 필요";
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}

function productTokens(candidate: SupplierCandidate): Set<string> {
  return new Set(
    candidate.products
      .flatMap((product) => normalize(product).match(/[\p{L}\p{N}]+/gu) ?? [])
      .filter((token) => token.length > 1)
  );
}

function productSimilarity(domestic: SupplierCandidate, overseas: SupplierCandidate): number {
  const domesticTokens = productTokens(domestic);
  const overseasTokens = productTokens(overseas);
  if (domesticTokens.size === 0 || overseasTokens.size === 0) return 35;

  let matches = 0;
  for (const token of domesticTokens) {
    if (overseasTokens.has(token)) matches += 1;
  }
  return Math.round((matches / Math.max(domesticTokens.size, overseasTokens.size)) * 100);
}

function normalizedHsCodes(candidate: SupplierCandidate): string[] {
  return candidate.hsCodes.map((code) => code.replace(/[^0-9]/g, "").slice(0, 10)).filter(Boolean);
}

function hsCodeMatch(domestic: SupplierCandidate, overseas: SupplierCandidate): number {
  const domesticCodes = normalizedHsCodes(domestic);
  const overseasCodes = normalizedHsCodes(overseas);
  if (domesticCodes.length === 0 || overseasCodes.length === 0) return 40;
  if (domesticCodes.some((code) => overseasCodes.includes(code))) return 100;
  if (domesticCodes.some((left) => overseasCodes.some((right) => left.slice(0, 6) === right.slice(0, 6)))) return 85;
  if (domesticCodes.some((left) => overseasCodes.some((right) => left.slice(0, 4) === right.slice(0, 4)))) return 70;
  return 0;
}

function candidateQuality(candidate: SupplierCandidate): number {
  if (candidate.score) return clamp(candidate.score.total);
  if (candidate.sourceType === "MOTIE_PUBLIC") return candidate.verification === "VERIFIED" ? 82 : 74;
  if (candidate.sourceType === "OTHER_PUBLIC") return 64;
  if (candidate.sourceType === "USER_UPLOAD") return 50;
  return candidate.verification === "MOCK" ? 42 : 46;
}

export function compareSupplierPair(
  domestic: SupplierCandidate,
  overseas: SupplierCandidate
): DomesticOverseasComparison {
  const products = productSimilarity(domestic, overseas);
  const hsCodes = hsCodeMatch(domestic, overseas);
  const compatibilityScore = Math.round(products * 0.65 + hsCodes * 0.35);
  const domesticScore = Math.round(clamp(compatibilityScore * 0.45 + candidateQuality(domestic) * 0.55 + 8));
  const overseasScore = Math.round(clamp(compatibilityScore * 0.45 + candidateQuality(overseas) * 0.55));
  const recommendation: SupplyPairRecommendation =
    compatibilityScore < 35
      ? "REVIEW_REQUIRED"
      : overseasScore >= domesticScore + 12
        ? "OVERSEAS_BACKUP"
        : "DOMESTIC_FIRST";
  const reasons: string[] = [];
  if (products >= 60) reasons.push("생산품 키워드가 유사합니다.");
  if (hsCodes >= 70) reasons.push("HS 코드 계열이 일치합니다.");
  if (recommendation === "DOMESTIC_FIRST") reasons.push("국내 공공데이터 후보의 확인 근거가 더 강합니다.");
  if (recommendation === "OVERSEAS_BACKUP") reasons.push("중국/해외 후보는 베타 비교 후보로 검토합니다.");
  if (recommendation === "REVIEW_REQUIRED") reasons.push("자동 비교를 위한 제품 근거가 부족합니다.");

  return {
    id: `${domestic.id}::${overseas.id}`,
    domesticId: domestic.id,
    overseasId: overseas.id,
    domesticName: domestic.name,
    overseasName: overseas.name,
    compatibilityScore,
    domesticScore,
    overseasScore,
    recommendation,
    productSimilarity: products,
    hsCodeMatch: hsCodes,
    reasons
  };
}

export function rankOverseasAlternatives(
  domestic: SupplierCandidate,
  overseasCandidates: readonly SupplierCandidate[],
  options: ComparisonOptions = {}
): DomesticOverseasComparison[] {
  const limit = Math.max(1, Math.min(20, Math.trunc(options.limitPerDomestic ?? 3)));
  const minimumCompatibility = clamp(options.minimumCompatibility ?? 0);
  return overseasCandidates
    .map((overseas) => compareSupplierPair(domestic, overseas))
    .filter((comparison) => comparison.compatibilityScore >= minimumCompatibility)
    .sort(
      (left, right) =>
        right.compatibilityScore - left.compatibilityScore ||
        right.overseasScore - left.overseasScore ||
        left.overseasId.localeCompare(right.overseasId)
    )
    .slice(0, limit);
}

export function compareDomesticVsOverseas(
  domesticCandidates: readonly SupplierCandidate[],
  overseasCandidates: readonly SupplierCandidate[],
  options: ComparisonOptions = {}
): DomesticOverseasComparison[] {
  return [...domesticCandidates]
    .sort((left, right) => left.id.localeCompare(right.id))
    .flatMap((domestic) => rankOverseasAlternatives(domestic, overseasCandidates, options));
}
