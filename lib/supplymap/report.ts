import type {
  EvidenceRecord,
  RiskSignalKind,
  RiskSignalRecord,
  SupplierCandidate,
  SupplyMapAnalysisResponse,
  SupplyMapComparableCandidate,
  SupplySourceType
} from "./types";

export type SupplyMapReportItem = {
  id: string;
  label: string;
  value: string;
  detail?: string;
  score?: number;
  sourceType?: SupplySourceType;
  sourceName?: string;
  datasetName?: string;
  evidenceIds?: string[];
};

export type SupplyMapReportSection = {
  id: string;
  title: string;
  summary: string;
  items: SupplyMapReportItem[];
};

export type SupplyMapReportSource = {
  id: string;
  providerName: string;
  datasetName: string;
  sourceType: SupplySourceType;
  sourceUrl: string;
  fetchedAt: string;
  license: string;
  evidenceCount: number;
};

export type SupplyMapReport = {
  reportId: string;
  generatedAt: string;
  title: string;
  subtitle: string;
  advisory: string;
  dataMode: "mock" | "api" | "hybrid";
  input: {
    productName: string;
    category: string;
    hsCode?: string;
    hsCodeCandidates: string[];
    importCountry?: string;
    preferredRegion?: string;
    keywords: string[];
  };
  executiveSummary: string;
  sections: SupplyMapReportSection[];
  sourceSummary: SupplyMapReportSource[];
  evidence: EvidenceRecord[];
  notices: string[];
};

const REPORT_ADVISORY =
  "본 리포트는 의사결정 보조용이며 최종 인증·통관 판단은 관계기관 확인 필요";

const COMPLIANCE_KINDS: RiskSignalKind[] = ["CERTIFICATION", "RECALL", "CUSTOMS", "STRATEGIC_GOODS", "TRADE_SECURITY"];
const COUNTRY_RISK_KINDS: RiskSignalKind[] = ["COUNTRY", "COUNTRY_RISK", "PAYMENT", "NEWS", "MARKET"];

function compact(items: Array<string | undefined | null | false>) {
  return items.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function asDisplayDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function candidateItem(candidate: SupplierCandidate, index: number): SupplyMapReportItem {
  const total = candidate.score?.total ?? candidate.score?.totalScore ?? 0;
  const productFit = candidate.score?.breakdown?.productFit;
  const publicConfidence = candidate.score?.breakdown?.publicDataConfidence;
  return {
    id: candidate.id,
    label: `${index + 1}. ${candidate.name}`,
    value: `${total}점 · ${candidate.countryName}${candidate.region ? " " + candidate.region : ""}`,
    detail: compact([
      candidate.industrialComplex,
      candidate.products.slice(0, 4).join(", "),
      candidate.matchReason,
      productFit ? `제품 적합도 ${productFit.score}/${productFit.maxScore}` : undefined,
      publicConfidence ? `공공데이터 확인도 ${publicConfidence.score}/${publicConfidence.maxScore}` : undefined
    ]).join(" · "),
    score: total,
    sourceType: candidate.sourceType,
    sourceName: candidate.providerName,
    datasetName: candidate.datasetName,
    evidenceIds: ["EV-CAND-" + candidate.id]
  };
}

function comparisonItem(candidate: SupplyMapComparableCandidate, index: number): SupplyMapReportItem {
  const breakdown = candidate.scoreBreakdown;
  return {
    id: candidate.id,
    label: `${index + 1}. ${candidate.candidateType === "DOMESTIC_SUPPLIER" ? "국내" : "해외"} · ${candidate.name}`,
    value: `${candidate.matchScore}점`,
    detail: breakdown
      ? compact([
          `제품 ${breakdown.productFit.score}/30`,
          `공공 ${breakdown.publicDataConfidence.score}/20`,
          `인증·통관 ${breakdown.complianceReadiness.score}/20`,
          `입지·물류 ${breakdown.locationLogistics.score}/15`,
          `국가·거래 ${breakdown.countryPaymentRisk.score}/15`,
          candidate.riskSummary
        ]).join(" · ")
      : compact([candidate.productText, candidate.riskSummary]).join(" · "),
    score: candidate.matchScore,
    sourceType: candidate.sourceType,
    sourceName: candidate.sourceName,
    datasetName: candidate.datasetName,
    evidenceIds: candidate.evidenceIds
  };
}

function riskItem(signal: RiskSignalRecord, index: number): SupplyMapReportItem {
  return {
    id: signal.id,
    label: `${index + 1}. ${signal.title}`,
    value: `${signal.severity} · ${signal.status}`,
    detail: signal.summary,
    score: signal.scoreImpact,
    sourceType: signal.sourceType,
    sourceName: signal.providerName,
    datasetName: signal.datasetName,
    evidenceIds: ["EV-RISK-" + signal.id]
  };
}

function answerItems(analysis: SupplyMapAnalysisResponse): SupplyMapReportItem[] {
  const sections = analysis.answer.sections.length
    ? analysis.answer.sections
    : [{ title: analysis.answer.headline, body: analysis.answer.summary, evidenceIds: [] }];
  return sections.slice(0, 4).map((section, index) => ({
    id: `answer-${index}`,
    label: section.title,
    value: section.body,
    evidenceIds: section.evidenceIds
  }));
}

function buildSourceSummary(evidence: EvidenceRecord[]): SupplyMapReportSource[] {
  const sourceMap = new Map<string, SupplyMapReportSource>();
  for (const item of evidence) {
    const key = [item.providerName, item.datasetName, item.sourceType].join("::");
    const current = sourceMap.get(key);
    if (current) {
      current.evidenceCount += 1;
      continue;
    }
    sourceMap.set(key, {
      id: key,
      providerName: item.providerName,
      datasetName: item.datasetName,
      sourceType: item.sourceType,
      sourceUrl: item.url ?? item.sourceUrl,
      fetchedAt: item.fetchedAt,
      license: item.license,
      evidenceCount: 1
    });
  }
  return Array.from(sourceMap.values()).sort(
    (left, right) =>
      sourceWeight(left.sourceType) - sourceWeight(right.sourceType) ||
      left.providerName.localeCompare(right.providerName, "ko")
  );
}

function sourceWeight(sourceType: SupplySourceType) {
  if (sourceType === "MOTIE_PUBLIC") return 0;
  if (sourceType === "OTHER_PUBLIC") return 1;
  if (sourceType === "USER_UPLOAD") return 2;
  return 3;
}

function inputItems(analysis: SupplyMapAnalysisResponse): SupplyMapReportItem[] {
  const intent = analysis.intent;
  return [
    {
      id: "input-product",
      label: "입력 제품",
      value: intent.query,
      detail: compact([intent.category, intent.keywords.length ? `키워드: ${intent.keywords.join(", ")}` : undefined]).join(" · ")
    },
    {
      id: "input-hs",
      label: "HS 후보",
      value: intent.hsCode ?? intent.hsCodeCandidates[0] ?? "확인 필요",
      detail: intent.hsCodeCandidates.length ? `후보 ${unique(intent.hsCodeCandidates).join(", ")}` : "제품 사양 기준 재확인 필요"
    },
    {
      id: "input-country",
      label: "수입 희망 국가",
      value: intent.importCountry ?? "확인 필요",
      detail: intent.preferredRegion ? `국내 희망 권역: ${intent.preferredRegion}` : "국내 희망 권역 미지정"
    }
  ];
}

export function buildSupplyMapReport(analysis: SupplyMapAnalysisResponse): SupplyMapReport {
  const complianceSignals = analysis.riskSignals.filter((signal) => COMPLIANCE_KINDS.includes(signal.kind));
  const countrySignals = analysis.riskSignals.filter((signal) => COUNTRY_RISK_KINDS.includes(signal.kind));
  const domesticItems = analysis.domesticCandidates.slice(0, 5).map(candidateItem);
  const globalItems = analysis.globalCandidates.slice(0, 5).map(candidateItem);
  const comparisonItems = analysis.comparisonCandidates.slice(0, 8).map(comparisonItem);
  const publicSources = buildSourceSummary(analysis.evidence);
  const sourceItems = publicSources.map((source) => ({
    id: source.id,
    label: source.providerName,
    value: `${source.datasetName} · 근거 ${source.evidenceCount}건`,
    detail: compact([source.license, `수집시점: ${source.fetchedAt}`]).join(" · "),
    sourceType: source.sourceType,
    sourceName: source.providerName,
    datasetName: source.datasetName,
    evidenceIds: analysis.evidence
      .filter(
        (item) =>
          item.providerName === source.providerName &&
          item.datasetName === source.datasetName &&
          item.sourceType === source.sourceType
      )
      .map((item) => item.id)
  }));

  const sections: SupplyMapReportSection[] = [
    {
      id: "input",
      title: "입력 제품 정보",
      summary: "제품명, HS 후보, 수입 희망 국가와 국내 희망 권역을 분석 기준으로 고정합니다.",
      items: inputItems(analysis)
    },
    {
      id: "domestic",
      title: "국내 공장 후보",
      summary: "한국산업단지공단 공장등록생산정보와 산업동향 기반 국내 후보를 제시합니다.",
      items: domesticItems.length
        ? domesticItems
        : [{ id: "domestic-empty", label: "확인 필요", value: "국내 후보 부족", detail: "생산품 키워드 또는 HS 후보를 보강해 재조회 필요" }]
    },
    {
      id: "global",
      title: "중국/해외 베타 후보",
      summary: "중국/해외 공장 후보는 현재 확보된 베타 데이터로 품목군과 지역 분포를 비교합니다.",
      items: globalItems.length
        ? globalItems
        : [{ id: "global-empty", label: "확인 필요", value: "해외 후보 부족", detail: "민간·해외 데이터는 계약 전 별도 실사 필요" }]
    },
    {
      id: "comparison",
      title: "후보 비교 점수",
      summary: "총점 100점의 의사결정 보조 점수로 제품 적합도, 공공데이터 확인도, 인증·통관, 입지·물류, 국가·거래위험을 비교합니다.",
      items: comparisonItems
    },
    {
      id: "compliance",
      title: "인증·리콜·통관 체크리스트",
      summary: "RiskSignal에 통합된 인증, 리콜, HS·세관장확인, 전략물자 확인 항목입니다.",
      items: complianceSignals.length
        ? complianceSignals.map(riskItem)
        : [{ id: "compliance-empty", label: "확인 필요", value: "확보된 리스크 신호 없음", detail: "리스크가 없다는 뜻이 아니며 관계기관 원문 확인 필요" }]
    },
    {
      id: "country-risk",
      title: "국가·거래위험",
      summary: "KOTRA·K-SURE 등 문서 근거를 기반으로 국가, 시장, 결제 위험을 후보 검토에 반영합니다.",
      items: countrySignals.length
        ? countrySignals.map(riskItem)
        : [{ id: "country-empty", label: "확인 필요", value: "국가·거래위험 근거 부족", detail: "수입 국가와 거래조건 확정 후 재조회 필요" }]
    },
    {
      id: "ai-summary",
      title: "AI 요약",
      summary: "RAG 기반 AI 무역 코파일럿은 조회된 구조화 데이터와 문서 근거만 사용합니다.",
      items: answerItems(analysis)
    },
    {
      id: "sources",
      title: "사용한 공공데이터 출처",
      summary: "MOTIE_PUBLIC과 OTHER_PUBLIC 출처를 명확히 표시하고, PRIVATE·USER_UPLOAD는 베타·보조 데이터로 구분합니다.",
      items: sourceItems
    }
  ];

  return {
    reportId: "SMR-" + analysis.analysisId,
    generatedAt: asDisplayDate(analysis.generatedAt),
    title: `${analysis.intent.query} 공급망·수입 리스크 분석 리포트`,
    subtitle: "공공데이터 기반 한국·중국 공장 비교 및 무역 AI 코파일럿",
    advisory: REPORT_ADVISORY,
    dataMode: analysis.demoMode ? "mock" : "api",
    input: {
      productName: analysis.intent.query,
      category: analysis.intent.category,
      hsCode: analysis.intent.hsCode,
      hsCodeCandidates: unique(analysis.intent.hsCodeCandidates),
      importCountry: analysis.intent.importCountry,
      preferredRegion: analysis.intent.preferredRegion,
      keywords: unique(analysis.intent.keywords)
    },
    executiveSummary: compact([analysis.answer.headline, analysis.answer.summary]).join(" "),
    sections,
    sourceSummary: publicSources,
    evidence: analysis.evidence,
    notices: [REPORT_ADVISORY, ...analysis.notices]
  };
}
