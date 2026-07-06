import type { RiskLevel } from "@prisma/client";

type ScoreInput = {
  officialMatches?: number;
  certificates?: number;
  tradeRequirements?: number;
  riskEvents?: Array<{ eventType?: string | null; severity?: string | null }>;
  hasHighConfidenceGeocode?: boolean;
  negativeSearchSignals?: number;
};

export function calculateImportReadinessScore(input: ScoreInput): number {
  let score = 0;

  if ((input.officialMatches ?? 0) > 0) score += 25;
  if ((input.certificates ?? 0) > 0) score += 20;
  if ((input.tradeRequirements ?? 0) > 0) score += 15;
  if ((input.riskEvents ?? []).length === 0) score += 20;
  if (input.hasHighConfidenceGeocode) score += 10;
  if ((input.negativeSearchSignals ?? 0) === 0) score += 10;

  for (const event of input.riskEvents ?? []) {
    if (["RECALL", "SUSPENSION", "NON_COMPLIANCE", "CERT_CANCELLED"].includes(event.eventType ?? "")) {
      score -= 25;
    }
    if (["HIGH", "CRITICAL"].includes((event.severity ?? "").toUpperCase())) {
      score -= 15;
    }
  }

  return Math.max(0, Math.min(100, score));
}

export function calculateRiskLevel(events: Array<{ eventType?: string | null; severity?: string | null }>): RiskLevel {
  if (events.some((event) => (event.severity ?? "").toUpperCase() === "CRITICAL")) return "CRITICAL";
  if (events.some((event) => ["RECALL", "SUSPENSION", "CERT_CANCELLED"].includes(event.eventType ?? ""))) return "HIGH";
  if (events.some((event) => ["NON_COMPLIANCE", "ADMIN_PENALTY", "IP_RISK"].includes(event.eventType ?? ""))) {
    return "MEDIUM";
  }
  return events.length === 0 ? "LOW" : "UNKNOWN";
}
