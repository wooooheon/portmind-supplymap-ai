import { analyzeSupplyMap } from "@/lib/supplymap/analyze";

async function main() {
  const scenarios = [
    { productName: "식품용 플라스틱 포장용기", hsCode: "392330", preferredRegion: "경기" },
    { productName: "전기히터", hsCode: "851629", preferredRegion: "인천" },
    { productName: "LED 조명", hsCode: "940542", preferredRegion: "경북" },
    { productName: "화장품 용기", hsCode: "392330", preferredRegion: "충북" },
    { productName: "드론 부품", hsCode: "880790", preferredRegion: "대전" }
  ];

  const results = await Promise.all(
    scenarios.map((scenario) =>
      analyzeSupplyMap({
        ...scenario,
        importCountry: "CN",
        judgeDemo: true
      })
    )
  );

  const checks = results.map((result, index) => ({
    productName: scenarios[index].productName,
    analysisId: result.analysisId,
    domesticCandidates: result.domesticCandidates.length >= 3,
    globalCandidates: result.globalCandidates.length > 0,
    scored: result.domesticCandidates.every((candidate) => candidate.score && candidate.score.total <= 100),
    scoreBreakdown: result.comparisonCandidates.every((candidate) => Boolean(candidate.scoreBreakdown)),
    grounded: result.answer.grounded && result.answer.sections.every((section) => section.evidenceIds.length > 0),
    motieEvidence: result.evidence.some((evidence) => evidence.sourceType === "MOTIE_PUBLIC"),
    mockDisclosure: result.demoMode && result.notices.some((notice) => notice.includes("MOCK"))
  }));
  const failed = checks.flatMap((check) =>
    Object.entries(check)
      .filter(([name, passed]) => !["productName", "analysisId"].includes(name) && !passed)
      .map(([name]) => `${check.productName}:${name}`)
  );
  console.log(JSON.stringify({ checks }, null, 2));
  if (failed.length > 0) throw new Error("SupplyMap verification failed: " + failed.join(", "));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
