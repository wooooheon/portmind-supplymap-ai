import { getCustomsRequirementRiskSignals } from "./adapters/customs-requirements";
import { getCustomsTradeStatsRiskSignals } from "./adapters/customs-trade-stats";
import { getKotraNewsRiskSignals } from "./adapters/kotra-news";
import { getKsureCountryRiskSignals } from "./adapters/ksure-country-risk";
import { getSafetyKoreaRiskSignals } from "./adapters/safety-korea";
import { getUnipassCustomsRiskSignals } from "./adapters/unipass-customs";
import { calculateCandidateScore, toCandidateScore } from "./scoring";
import type { ProductIntent, RiskSignalRecord, SupplierCandidate } from "./types";

function uniqueSignals(signals: RiskSignalRecord[]): RiskSignalRecord[] {
  return Array.from(new Map(signals.map((signal) => [signal.id, signal])).values());
}

export function scoreCandidate(
  candidate: SupplierCandidate,
  intent: ProductIntent,
  signals: RiskSignalRecord[]
): SupplierCandidate {
  const result = calculateCandidateScore(
    candidate,
    signals,
    [
      {
        sourceType: candidate.sourceType,
        verification: candidate.verification,
        providerName: candidate.providerName,
        datasetName: candidate.datasetName
      }
    ],
    { intent }
  );
  return { ...candidate, score: toCandidateScore(result) };
}

export async function analyzeRisks(intent: ProductIntent): Promise<RiskSignalRecord[]> {
  const results = await Promise.all([
    getSafetyKoreaRiskSignals(intent),
    getCustomsRequirementRiskSignals(intent),
    getCustomsTradeStatsRiskSignals(intent),
    getUnipassCustomsRiskSignals(intent),
    getKotraNewsRiskSignals(intent),
    getKsureCountryRiskSignals(intent)
  ]);
  return uniqueSignals(results.flatMap((result) => result.signals));
}

export function scoreCandidates(
  candidates: SupplierCandidate[],
  intent: ProductIntent,
  signals: RiskSignalRecord[]
): SupplierCandidate[] {
  return candidates
    .map((candidate) => scoreCandidate(candidate, intent, signals))
    .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0));
}
