import type { EvidenceRecord, GroundedAnswerSection } from "./types";
import type {
  GroundedStatement,
  LegacySupplyMapRagContext,
  SupplyMapOrchestrationContext,
  SupplyMapRagContext
} from "./rag";

export type SupplyMapAnswerSection = {
  id: SectionId;
  title: string;
  statements: GroundedStatement[];
};

export type GroundedAnswerResult = {
  headline: string;
  summary: string;
  sections: GroundedAnswerSection[];
  answerSections: SupplyMapAnswerSection[];
  evidenceIds: string[];
  model: string;
  usedLLM: boolean;
  grounded: true;
  warnings: string[];
  grounding: {
    policy: string;
    materialStatementCount: number;
    citedStatementCount: number;
    needsVerificationCount: number;
    coverage: number;
  };
};

type SectionId = "summary" | "domestic" | "global" | "risk" | "next-actions";

type GroundedSection = GroundedAnswerSection & {
  id: SectionId;
};

type DeepSeekSelection = {
  orderedSectionIds?: string[];
};

function uniqueKnownIds(ids: string[], evidence: Map<string, EvidenceRecord>): string[] {
  return Array.from(new Set(ids)).filter((id) => evidence.has(id));
}

function section(
  id: SectionId,
  title: string,
  body: string,
  evidenceIds: string[],
  evidence: Map<string, EvidenceRecord>
): GroundedSection {
  const knownIds = uniqueKnownIds(evidenceIds, evidence);
  if (!body.trim() || knownIds.length === 0) {
    return { id, title, body: "확인 필요", evidenceIds: [] };
  }
  return { id, title, body, evidenceIds: knownIds };
}

function candidateLines(context: SupplyMapOrchestrationContext, scope: "domestic" | "global"): string {
  const candidates = scope === "domestic" ? context.domesticCandidates : context.globalCandidates;
  if (candidates.length === 0) return "확인 필요";
  return candidates
    .map(
      (candidate, index) => {
        const breakdown = candidate.score?.breakdown;
        const scoreReason = breakdown
          ? `제품적합 ${breakdown.productFit.score}/${breakdown.productFit.maxScore}, 공공확인 ${breakdown.publicDataConfidence.score}/${breakdown.publicDataConfidence.maxScore}, 인증통관 ${breakdown.complianceReadiness.score}/${breakdown.complianceReadiness.maxScore}`
          : "세부 점수 확인 필요";
        return `${index + 1}. ${candidate.name} (${candidate.score?.total ?? "확인 필요"}점, 의사결정 보조 점수) - ${candidate.matchReason} · ${scoreReason}`;
      }
    )
    .join("\n");
}

function riskLines(context: SupplyMapOrchestrationContext): string {
  if (context.riskSignals.length === 0) return "확인 필요";
  return context.riskSignals
    .map((signal) => `${signal.status} · ${signal.title}: ${signal.summary}`)
    .join("\n");
}

function buildSections(context: SupplyMapOrchestrationContext): GroundedSection[] {
  const evidence = new Map(context.evidence.map((item) => [item.id, item]));
  const domesticIds = context.domesticCandidates.flatMap((candidate) => candidate.evidenceIds);
  const globalIds = context.globalCandidates.flatMap((candidate) => candidate.evidenceIds);
  const riskIds = context.riskSignals.flatMap((signal) => signal.evidenceIds);
  const summaryIds = uniqueKnownIds(context.scoreSummary.evidenceIds, evidence);

  return [
    section("summary", "분석 요약", context.scoreSummary.recommendation, summaryIds, evidence),
    section("domestic", "국내 공장 후보", candidateLines(context, "domestic"), domesticIds, evidence),
    section(
      "global",
      "중국/해외 베타 후보",
      candidateLines(context, "global"),
      [...globalIds, "EV-KOTRA-QA", "EV-KOTRA-NEWS", "EV-KOTRA-COUNTRY"],
      evidence
    ),
    section("risk", "리스크와 확인 필요", riskLines(context), riskIds, evidence),
    section(
      "next-actions",
      "다음 확인",
      [
        "KICOX 원문에서 국내 후보의 현재 등록, 생산품과 공장 상태를 대조합니다.",
        "KOTRA Q&A·해외시장뉴스·국가정보의 최신 원문을 확인합니다.",
        "가격·납기·생산능력·인증서 원문과 샘플 실사 결과는 확인 필요입니다."
      ].join("\n"),
      ["EV-KICOX-FACTORY", "EV-KOTRA-QA", "EV-KOTRA-NEWS", "EV-KOTRA-COUNTRY"],
      evidence
    )
  ];
}

function buildLegacySections(context: LegacySupplyMapRagContext): GroundedSection[] {
  const evidence = new Map(context.evidence.map((item) => [item.id, item as unknown as EvidenceRecord]));
  const domesticIds = context.domesticCandidates.flatMap((candidate) => candidate.evidenceIds);
  const globalIds = context.globalCandidates.flatMap((candidate) => candidate.evidenceIds);
  const riskIds = context.domesticCandidates
    .concat(context.globalCandidates)
    .flatMap((candidate) => candidate.riskSignals.flatMap((signal) => signal.evidenceIds));
  const domesticBody = context.domesticCandidates.length
    ? context.domesticCandidates
        .map((candidate) => `${candidate.rank}. ${candidate.name} - ${candidate.matchReasons[0]?.text ?? "확인 필요"}`)
        .join("\n")
    : "확인 필요";
  const globalBody = context.globalCandidates.length
    ? context.globalCandidates
        .map((candidate) => `${candidate.rank}. ${candidate.name} - ${candidate.matchReasons[0]?.text ?? "확인 필요"}`)
        .join("\n")
    : "확인 필요";

  return [
    section(
      "summary",
      "분석 요약",
      "국내 공장 후보와 중국/해외 베타 후보를 같은 품목 기준으로 비교합니다.",
      [...domesticIds, "MOTIE-SC-001"],
      evidence
    ),
    section("domestic", "국내 공장 후보", domesticBody, domesticIds, evidence),
    section(
      "global",
      "중국/해외 베타 후보",
      globalBody,
      [...globalIds, "KOTRA-QA-001"],
      evidence
    ),
    section(
      "risk",
      "리스크와 확인 필요",
      "사업자 실재성, 생산능력, 인증서 원문, 거래조건과 최신 국가정보를 계약 전에 확인해야 합니다.",
      [...riskIds, "KOTRA-QA-001"],
      evidence
    ),
    section(
      "next-actions",
      "다음 확인",
      "KICOX·MOTIE 국내 원문과 KOTRA Q&A·해외시장뉴스·국가정보 최신 원문을 대조합니다.",
      context.evidence.map((item) => item.id),
      evidence
    )
  ];
}

function parseSelection(text: string): DeepSeekSelection | undefined {
  const normalized = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(normalized) as DeepSeekSelection;
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

async function orderSectionsWithDeepSeek(
  query: string,
  sections: GroundedSection[],
  enabled: boolean
): Promise<{ sections: GroundedSection[]; model: string; usedLLM: boolean; warning?: string }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const configured = Boolean(apiKey) && process.env.SUPPLYMAP_DEEPSEEK_ENABLED !== "false";
  if (!enabled || !configured) {
    return {
      sections,
      model: "supplymap-grounded-fallback",
      usedLLM: false,
      warning: enabled && !configured ? "DeepSeek가 구성되지 않아 결정론적 근거 답변을 사용했습니다." : undefined
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 180,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "You only order pre-approved answer section IDs.",
              "Never add, rewrite, summarize, or infer facts.",
              "Return JSON only: {\"orderedSectionIds\":[\"existing-id\"]}."
            ].join("\n")
          },
          {
            role: "user",
            content: JSON.stringify({
              query,
              sections: sections.map((item) => ({ id: item.id, title: item.title }))
            })
          }
        ]
      })
    });

    if (!response.ok) {
      return {
        sections,
        model: "supplymap-grounded-fallback",
        usedLLM: false,
        warning: `DeepSeek HTTP ${response.status}; 결정론적 근거 답변으로 대체했습니다.`
      };
    }

    const payload = (await response.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
    };
    const selection = parseSelection(payload.choices?.[0]?.message?.content ?? "");
    const known = new Map(sections.map((item) => [item.id, item]));
    const selectedIds = Array.from(new Set(selection?.orderedSectionIds ?? [])).filter((id) => known.has(id as SectionId));
    if (selectedIds.length === 0) {
      return {
        sections,
        model: "supplymap-grounded-fallback",
        usedLLM: false,
        warning: "DeepSeek section ID 응답을 검증하지 못해 결정론적 순서를 사용했습니다."
      };
    }

    const fixedIds: SectionId[] = ["summary", "domestic", "global"];
    const selectedTailIds = selectedIds.filter((id) => !fixedIds.includes(id as SectionId));
    const selected = new Set([...fixedIds, ...selectedTailIds]);
    return {
      sections: [
        ...fixedIds.map((id) => known.get(id)!),
        ...selectedTailIds.map((id) => known.get(id as SectionId)!),
        ...sections.filter((item) => !selected.has(item.id))
      ],
      model: payload.model ?? model,
      usedLLM: true
    };
  } catch (error) {
    return {
      sections,
      model: "supplymap-grounded-fallback",
      usedLLM: false,
      warning: `DeepSeek 선택 단계를 건너뛰었습니다: ${error instanceof Error ? error.message : "확인 필요"}`
    };
  } finally {
    clearTimeout(timeout);
  }
}

function withoutInternalId(item: GroundedSection): GroundedAnswerSection {
  return { title: item.title, body: item.body, evidenceIds: item.evidenceIds };
}

function toAnswerSection(item: GroundedSection): SupplyMapAnswerSection {
  return {
    id: item.id,
    title: item.title,
    statements: [
      {
        id: `claim-${item.id}`,
        text: item.body,
        evidenceIds: item.evidenceIds,
        verificationStatus: item.evidenceIds.length > 0 ? "grounded" : "needs_verification"
      }
    ]
  };
}

function isLegacyContext(context: SupplyMapRagContext): context is LegacySupplyMapRagContext {
  return "input" in context;
}

export async function buildGroundedAnswer(
  context: SupplyMapRagContext,
  options: { useDeepSeek?: boolean } = {}
): Promise<GroundedAnswerResult> {
  const legacy = isLegacyContext(context);
  const baseSections = legacy ? buildLegacySections(context) : buildSections(context);
  const ordered = await orderSectionsWithDeepSeek(
    legacy ? context.input.query : context.intent.query,
    baseSections,
    options.useDeepSeek ?? true
  );
  const answerEvidenceIds = Array.from(
    new Set(ordered.sections.flatMap((item) => item.evidenceIds))
  );
  const citedStatementCount = ordered.sections.filter((item) => item.evidenceIds.length > 0).length;
  const needsVerificationCount = ordered.sections.filter(
    (item) => item.evidenceIds.length === 0 && item.body === "확인 필요"
  ).length;
  const headline = context.domesticCandidates.length
    ? "국내 공장 후보와 중국/해외 베타 후보를 같은 품목 기준으로 비교합니다."
    : "확인 필요";
  const summary = ordered.sections.find((item) => item.id === "summary")?.body ?? "확인 필요";

  return {
    headline,
    summary,
    sections: ordered.sections.map(withoutInternalId),
    answerSections: ordered.sections.map(toAnswerSection),
    evidenceIds: answerEvidenceIds,
    model: ordered.model,
    usedLLM: ordered.usedLLM,
    grounded: true,
    warnings: ordered.warning ? [ordered.warning] : [],
    grounding: {
      policy: "모든 답변 섹션은 존재하는 evidence ID를 가져야 하며 근거가 없으면 '확인 필요'로 대체됩니다.",
      materialStatementCount: ordered.sections.length,
      citedStatementCount,
      needsVerificationCount,
      coverage: ordered.sections.length
        ? (citedStatementCount + needsVerificationCount) / ordered.sections.length
        : 1
    }
  };
}
