import { MOCK_DOMESTIC_SUPPLIERS } from "@/lib/supplymap/mock-data";
import { calculateCandidateScore } from "@/lib/supplymap/scoring";
import { extractProductIntent } from "@/lib/supplymap/intent";
import { mockRiskSignals } from "@/lib/supplymap/mock-data";
import type { SupplierCandidate } from "@/lib/supplymap/types";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const intent = extractProductIntent({
    productName: "식품용 플라스틱 포장용기",
    hsCode: "392330",
    importCountry: "CN",
    preferredRegion: "경기"
  });
  const domestic = MOCK_DOMESTIC_SUPPLIERS.find((candidate) => candidate.id === "domestic-packaging-ansan") ?? MOCK_DOMESTIC_SUPPLIERS[0];
  const privateGlobal: SupplierCandidate = {
    ...domestic,
    id: "verify-private-global",
    name: "Private Global Demo Factory",
    scope: "GLOBAL",
    countryCode: "CN",
    countryName: "중국",
    region: "Guangdong",
    city: "Shenzhen",
    industrialComplex: undefined,
    sourceType: "PRIVATE",
    providerName: "민간·해외 공급망 데이터",
    datasetName: "해외 Factory 보조 데이터",
    verification: "CHECK_REQUIRED"
  };

  const riskSignals = mockRiskSignals(intent.hsCode, intent.importCountry);
  const domesticScore = calculateCandidateScore(domestic, riskSignals, [domestic], { intent });
  const privateScore = calculateCandidateScore(privateGlobal, riskSignals, [privateGlobal], { intent });
  const noRiskScore = calculateCandidateScore(domestic, [], [domestic], { intent });

  assert(domesticScore.totalScore <= 100, "domestic total score must not exceed 100");
  assert(privateScore.totalScore <= 100, "private total score must not exceed 100");
  assert(
    domesticScore.breakdown.publicDataConfidence.score > privateScore.breakdown.publicDataConfidence.score,
    "MOTIE_PUBLIC domestic candidate should receive higher public-data confidence than PRIVATE global candidate"
  );
  assert(
    noRiskScore.breakdown.complianceReadiness.status === "확인 필요",
    "missing RiskSignal must be marked as check-required, not low-risk"
  );
  assert(
    noRiskScore.breakdown.complianceReadiness.reason.includes("단정하지 않고"),
    "missing RiskSignal reason should explicitly avoid low-risk certainty"
  );

  console.log(
    JSON.stringify(
      {
        productName: intent.query,
        domestic: {
          totalScore: domesticScore.totalScore,
          status: domesticScore.status,
          publicDataConfidence: domesticScore.breakdown.publicDataConfidence,
          complianceReadiness: domesticScore.breakdown.complianceReadiness
        },
        privateGlobal: {
          totalScore: privateScore.totalScore,
          status: privateScore.status,
          publicDataConfidence: privateScore.breakdown.publicDataConfidence,
          countryPaymentRisk: privateScore.breakdown.countryPaymentRisk
        },
        noRiskSignalCompliance: noRiskScore.breakdown.complianceReadiness
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
