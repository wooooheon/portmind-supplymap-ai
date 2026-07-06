import { summarizeScores } from "./compare";
import { supplySource } from "./data-sources";
import { findDomesticSupply } from "./domestic";
import { findGlobalSupply } from "./global";
import { extractProductIntent } from "./intent";
import { MOCK_COMPLEXES, MOCK_DOMESTIC_SUPPLIERS, mockEvidence } from "./mock-data";
import { analyzeRisks, scoreCandidates } from "./risk";
import { callLlmProviderChat, normalizeLlmProvider, type LlmChatResult, type LlmProvider } from "@/lib/llm/providers";
import type {
  EvidenceRecord,
  IndustrialComplexSummary,
  ProductIntent,
  Provenance,
  RiskSignalRecord,
  ScoreSummary,
  SupplierCandidate,
  SupplyMapAnalysisRequest,
  SupplySourceType
} from "./types";

export type SupplyMapRagRequest = SupplyMapAnalysisRequest & {
  useDeepSeek?: boolean;
};

export type SupplyMapChatRequest = {
  productName?: string;
  hsCode?: string;
  country?: string;
  preferredRegion?: string;
  question: string;
  currentAnalysisId?: string;
  analysisContext?: unknown;
  judgeDemo?: boolean;
  useDeepSeek?: boolean;
  llmProvider?: LlmProvider;
};

export type SupplyMapChatEvidenceRecord = EvidenceRecord & {
  evidenceKey: string;
  sourceCode: string;
  sessionId?: string;
};

export type SupplyMapChatResponse = {
  answer: string;
  model: string;
  provider: LlmProvider;
  usedLLM: boolean;
  confidence: number;
  needsVerification: boolean;
  evidence: SupplyMapChatEvidenceRecord[];
  warnings: string[];
  intent: ProductIntent;
  domesticCandidates: GroundedSupplierCandidate[];
  globalCandidates: GroundedSupplierCandidate[];
  riskSignals: GroundedRiskSignal[];
};

export type SupplyMapRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
export type SupplyMapVerificationStatus = "grounded" | "needs_verification";

export type GroundedStatement = {
  id: string;
  text: string;
  evidenceIds: string[];
  verificationStatus: SupplyMapVerificationStatus;
};

export type SupplyMapEvidence = {
  id: string;
  sourceCode: string;
  sourceName: string;
  sourceKind: "public-data" | "qa" | "news" | "country" | "database";
  scope: "domestic" | "global" | "cross-border";
  title: string;
  snippet: string;
  url?: string;
  publishedAt?: string;
  retrievedAt: string;
  isMock: boolean;
  tags: string[];
};

export type SupplyMapCandidate = {
  id: string;
  type: "domestic-cluster" | "global-factory";
  priority: "primary" | "secondary";
  rank: number;
  name: string;
  location: string;
  capability: string;
  matchScore: number;
  matchReasons: GroundedStatement[];
  riskLevel: SupplyMapRiskLevel;
  riskSignals: GroundedStatement[];
  evidenceIds: string[];
  verificationStatus: SupplyMapVerificationStatus;
  unverifiedFields: string[];
  isMock: boolean;
};

export type GroundedSupplierCandidate = SupplierCandidate & {
  evidenceIds: string[];
  priority: "PRIMARY" | "SECONDARY";
};

export type GroundedIndustrialComplex = IndustrialComplexSummary & {
  evidenceIds: string[];
};

export type GroundedRiskSignal = RiskSignalRecord & {
  evidenceIds: string[];
};

export type GroundedScoreSummary = ScoreSummary & {
  evidenceIds: string[];
};

export type SupplyMapOrchestrationContext = {
  request: SupplyMapRagRequest;
  intent: ProductIntent;
  demoMode: boolean;
  domesticCandidates: GroundedSupplierCandidate[];
  globalCandidates: GroundedSupplierCandidate[];
  industrialComplexes: GroundedIndustrialComplex[];
  riskSignals: GroundedRiskSignal[];
  scoreSummary: GroundedScoreSummary;
  evidence: EvidenceRecord[];
  dataSourceCounts: Record<SupplySourceType, number>;
  notices: string[];
  generatedAt: string;
};

export type LegacySupplyMapRagContext = {
  input: {
    query: string;
    productName?: string;
    hsCode?: string;
    targetCountry?: string;
    mode: "mock" | "hybrid";
    useDeepSeek?: boolean;
  };
  domesticCandidates: SupplyMapCandidate[];
  globalCandidates: SupplyMapCandidate[];
  evidence: SupplyMapEvidence[];
  warnings: string[];
  generatedAt: string;
};

export type SupplyMapRagContext = SupplyMapOrchestrationContext | LegacySupplyMapRagContext;

const COMPATIBILITY_SNAPSHOT_DATE = "2026-06-20T00:00:00.000Z";

// Compatibility corpus for the shared analyze module. All synthetic records are
// explicitly marked mock and therefore cannot be mistaken for current company facts.
export const SUPPLYMAP_MOCK_EVIDENCE: SupplyMapEvidence[] = [
  {
    id: "KICOX-DOM-001",
    sourceCode: "kicox_factory_registry",
    sourceName: "한국산업단지공단",
    sourceKind: "public-data",
    scope: "domestic",
    title: "국내 공장등록생산정보 데모 스냅샷",
    snippet: "국내 후보의 회사명·주소·업종·생산품을 검색하는 mock 근거이며 현재 공장 상태는 확인 필요입니다.",
    url: "https://www.data.go.kr/data/15100060/standard.do",
    retrievedAt: COMPATIBILITY_SNAPSHOT_DATE,
    isMock: true,
    tags: ["국내", "공장", "생산품"]
  },
  {
    id: "MOTIE-SC-001",
    sourceCode: "motie_supply_chain_support_2025",
    sourceName: "산업통상자원부",
    sourceKind: "public-data",
    scope: "domestic",
    title: "2025년도 소부장 공급망안정 종합지원 사업 공고",
    snippet: "소재·부품·장비 공급망 안정, 수입처 다변화 및 공급망 컨설팅 지원 근거입니다.",
    url: "https://www.motie.go.kr/kor/article/ATCL2826a2625/69980/view",
    publishedAt: "2025-01-23",
    retrievedAt: COMPATIBILITY_SNAPSHOT_DATE,
    isMock: false,
    tags: ["공급망", "소부장", "다변화"]
  },
  {
    id: "KOTRA-QA-001",
    sourceCode: "kotra_trade_qa",
    sourceName: "KOTRA 무역투자 질의응답",
    sourceKind: "qa",
    scope: "cross-border",
    title: "해외 공급선 검증 데모 Q&A",
    snippet: "사업자 실재성, 생산능력, 인증서 원문, 거래조건과 샘플 검증이 필요하다는 mock 근거입니다.",
    url: "https://www.kotra.or.kr/bigdata/main",
    retrievedAt: COMPATIBILITY_SNAPSHOT_DATE,
    isMock: true,
    tags: ["실사", "계약", "인증"]
  },
  ...(["CN", "VN", "PL"] as const).flatMap((country) => {
    const names = { CN: "중국", VN: "베트남", PL: "폴란드" } as const;
    return [
      {
        id: `KOTRA-NEWS-${country}-001`,
        sourceCode: `kotra_trade_news_${country.toLowerCase()}`,
        sourceName: "KOTRA 해외시장뉴스",
        sourceKind: "news" as const,
        scope: "global" as const,
        title: `${names[country]} 해외시장뉴스 데모 스냅샷`,
        snippet: "시장·규제·통관·물류 변화는 최신 원문으로 다시 확인해야 한다는 mock 검색 결과입니다.",
        url: "https://www.kotra.or.kr/bigdata/main",
        retrievedAt: COMPATIBILITY_SNAPSHOT_DATE,
        isMock: true,
        tags: [names[country], country]
      },
      {
        id: `KOTRA-COUNTRY-${country}-001`,
        sourceCode: `kotra_country_${country.toLowerCase()}`,
        sourceName: "KOTRA 국가정보",
        sourceKind: "country" as const,
        scope: "global" as const,
        title: `${names[country]} 국가정보 데모 스냅샷`,
        snippet: "국가정보는 개별 공급업체 신용평가가 아니며 기업 실사와 함께 확인해야 한다는 mock 근거입니다.",
        url: "https://www.kotra.or.kr/bigdata/main",
        retrievedAt: COMPATIBILITY_SNAPSHOT_DATE,
        isMock: true,
        tags: [names[country], country]
      }
    ];
  })
];

const KOTRA_QA_EVIDENCE_ID = "EV-KOTRA-QA";
const KOTRA_NEWS_EVIDENCE_ID = "EV-KOTRA-NEWS";
const KOTRA_COUNTRY_EVIDENCE_ID = "EV-KOTRA-COUNTRY";
const SCORING_EVIDENCE_ID = "EV-SCORING-POLICY";

function provenance(sourceCode: string): Provenance {
  const source = supplySource(sourceCode);
  return {
    providerName: source.providerName,
    datasetName: source.datasetName,
    sourceType: source.sourceType,
    sourceUrl: source.sourceUrl,
    fetchedAt: source.fetchedAt,
    license: source.license,
    verification: source.verification
  };
}

function evidenceIdForCandidate(candidate: SupplierCandidate): string {
  return `EV-CANDIDATE-${candidate.id}`;
}

function evidenceIdForRisk(signal: RiskSignalRecord): string {
  return `EV-RISK-${signal.id}`;
}

function normalizeCountry(intent: ProductIntent): { code: string; name: string; region?: string; city?: string } {
  const country = intent.importCountry || "CN";
  if (/^(CN|CHN|중국|china)$/i.test(country)) {
    return { code: "CN", name: "중국", region: "Guangdong", city: "Shenzhen" };
  }
  if (/^(VN|VNM|베트남|vietnam)$/i.test(country)) {
    return { code: "VN", name: "베트남", region: "Bac Ninh", city: "Bac Ninh" };
  }
  if (/^(US|USA|미국|united states)$/i.test(country)) {
    return { code: "US", name: "미국" };
  }
  return { code: country.toUpperCase(), name: country };
}

function productLabel(intent: ProductIntent): string {
  return intent.category === "품목 확인 필요" ? intent.query : intent.category;
}

function mockGlobalCandidates(intent: ProductIntent): SupplierCandidate[] {
  const country = normalizeCountry(intent);
  const source = provenance("private_global_factory");
  const location = [country.city, country.region, country.name].filter(Boolean).join(", ");
  const label = productLabel(intent);

  return ["A", "B"].map((suffix, index) => ({
    id: `global-demo-${country.code.toLowerCase()}-${suffix.toLowerCase()}`,
    name: `${country.name} ${label} 공급사 후보 ${suffix} (데모)`,
    scope: "GLOBAL" as const,
    countryCode: country.code,
    countryName: country.name,
    region: country.region,
    city: country.city,
    address: location || undefined,
    products: [label, ...intent.keywords].filter(Boolean).slice(0, 4),
    hsCodes: intent.hsCodeCandidates,
    description: "샘플 fallback 후보입니다. 실제 기업, 생산능력, 인증 및 거래조건은 확인 필요입니다.",
    matchReason:
      index === 0
        ? "요청 품목과 희망 수입국을 기준으로 만든 해외 비교용 mock 후보"
        : "해외 공급선 다변화 비교를 위한 보조 mock 후보",
    ...source
  }));
}

function matchesIntent(candidate: SupplierCandidate, intent: ProductIntent): boolean {
  const haystack = [candidate.products.join(" "), candidate.description, candidate.matchReason]
    .join(" ")
    .toLowerCase();
  const terms = [intent.category, ...intent.keywords]
    .filter((term) => term && term !== "품목 확인 필요")
    .map((term) => term.toLowerCase());
  return terms.length === 0 || terms.some((term) => haystack.includes(term));
}

function rankMockComplexes(intent: ProductIntent): IndustrialComplexSummary[] {
  const terms = [intent.category, ...intent.keywords]
    .filter((term) => term && term !== "품목 확인 필요")
    .map((term) => term.toLowerCase());
  return MOCK_COMPLEXES.map((complex) => {
    const text = `${complex.industries.join(" ")} ${complex.matchReason}`.toLowerCase();
    const score = terms.filter((term) => text.includes(term)).length;
    return { complex, score };
  })
    .sort((left, right) => right.score - left.score || left.complex.id.localeCompare(right.complex.id))
    .slice(0, 3)
    .map((item) => item.complex);
}

function kotraEvidence(intent: ProductIntent): EvidenceRecord[] {
  const qa = provenance("kotra_trade_qa");
  const market = provenance("kotra_market_news");
  const country = normalizeCountry(intent);
  return [
    {
      id: KOTRA_QA_EVIDENCE_ID,
      title: "KOTRA 무역투자 질의응답 RAG 데모 문서",
      snippet:
        "해외 공급선 계약 전 사업자 실재성, 생산능력, 품질인증 원문, 거래조건과 샘플 검증이 필요하다는 확인 절차를 담은 mock 근거입니다.",
      claim: "해외 후보는 계약 전 개별 실사와 증빙 확인이 필요합니다.",
      url: qa.sourceUrl,
      ...qa
    },
    {
      id: KOTRA_NEWS_EVIDENCE_ID,
      title: `KOTRA ${country.name} 해외시장뉴스 RAG 데모 문서`,
      snippet:
        "시장·규제·통관·물류 변화는 고정 스냅샷으로 단정하지 않고 최신 해외시장뉴스 원문을 다시 확인해야 한다는 mock 검색 결과입니다.",
      claim: "국가별 시장·규제 신호는 최신 원문 재확인 대상입니다.",
      url: market.sourceUrl,
      ...market
    },
    {
      id: KOTRA_COUNTRY_EVIDENCE_ID,
      title: `KOTRA ${country.name} 국가정보 RAG 데모 문서`,
      snippet:
        "국가별 거래환경은 공급업체 개별 신용평가가 아니며 국가정보와 기업 실사를 함께 확인해야 한다는 mock 근거입니다.",
      claim: "국가정보는 해외 후보 비교의 보조 근거로만 사용합니다.",
      url: market.sourceUrl,
      ...market
    }
  ];
}

function evidenceSearchTerms(intent: ProductIntent): string[] {
  return Array.from(
    new Set(
      [intent.query, intent.category, ...intent.keywords, intent.importCountry]
        .map((term) => (term ?? "").trim())
        .filter((term) => term && term !== "품목 확인 필요")
    )
  ).slice(0, 6);
}

async function storedKotraEvidence(intent: ProductIntent): Promise<EvidenceRecord[]> {
  try {
    const { prisma } = await import("@/lib/db/prisma");
    const source = await prisma.supplyDataSource.findUnique({
      where: { code: "kotra_market_news" },
      select: { id: true }
    });
    if (!source) return [];
    const terms = evidenceSearchTerms(intent);
    const rows = await prisma.chatEvidence.findMany({
      where: {
        sourceId: source.id,
        ...(terms.length > 0
          ? {
              OR: terms.flatMap((term) => [
                { title: { contains: term } },
                { snippet: { contains: term } },
                { claim: { contains: term } }
              ])
            }
          : {})
      },
      orderBy: { fetchedAt: "desc" },
      take: 6
    });
    return rows.map((row) => ({
      id: row.evidenceKey,
      title: row.title,
      snippet: row.snippet,
      claim: row.claim ?? "KOTRA 해외시장뉴스 원문 근거",
      url: row.sourceUrl,
      providerName: row.providerName,
      datasetName: row.datasetName,
      sourceType: row.sourceType,
      sourceUrl: row.sourceUrl,
      fetchedAt: row.fetchedAt.toISOString(),
      license: row.license,
      verification: row.verification
    }));
  } catch {
    return [];
  }
}

function candidateEvidence(candidate: SupplierCandidate): EvidenceRecord {
  return {
    id: evidenceIdForCandidate(candidate),
    title: `${candidate.name} 후보 레코드`,
    snippet: [candidate.countryName, candidate.region, candidate.city, candidate.products.join(", ")]
      .filter(Boolean)
      .join(" · "),
    claim: candidate.matchReason,
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

function riskEvidence(signal: RiskSignalRecord): EvidenceRecord {
  return {
    id: evidenceIdForRisk(signal),
    title: signal.title,
    snippet: signal.summary,
    claim: `${signal.status}: ${signal.title}`,
    url: signal.sourceUrl,
    providerName: signal.providerName,
    datasetName: signal.datasetName,
    sourceType: signal.sourceType,
    sourceUrl: signal.sourceUrl,
    fetchedAt: signal.fetchedAt,
    license: signal.license,
    verification: signal.verification
  };
}

function scoringEvidence(): EvidenceRecord {
  const source = provenance("kicox_factory_registry");
  return {
    id: SCORING_EVIDENCE_ID,
    title: "SupplyMap 후보 점수 정책",
    snippet:
      "제품 적합도, 공공데이터 확인도, 인증·통관 준비도, 입지·물류, 국가·거래위험을 합산하며 국내 MOTIE 공공데이터 후보를 우선합니다.",
    claim: "점수는 후보 우선순위용이며 거래 적격성이나 인증을 보증하지 않습니다.",
    url: source.sourceUrl,
    ...source
  };
}

function dedupeEvidence(records: EvidenceRecord[]): EvidenceRecord[] {
  return Array.from(new Map(records.map((record) => [record.id, record])).values());
}

function sourceCounts(records: Array<{ sourceType: SupplySourceType }>): Record<SupplySourceType, number> {
  const counts: Record<SupplySourceType, number> = {
    MOTIE_PUBLIC: 0,
    OTHER_PUBLIC: 0,
    PRIVATE: 0,
    USER_UPLOAD: 0
  };
  for (const record of records) counts[record.sourceType] += 1;
  return counts;
}

function attachCandidateEvidence(candidates: SupplierCandidate[]): GroundedSupplierCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    evidenceIds: [evidenceIdForCandidate(candidate)],
    priority: candidate.scope === "DOMESTIC" ? "PRIMARY" : "SECONDARY"
  }));
}

function attachRiskEvidence(signals: RiskSignalRecord[]): GroundedRiskSignal[] {
  return signals.map((signal) => ({ ...signal, evidenceIds: [evidenceIdForRisk(signal)] }));
}

export async function retrieveSupplyMapContext(request: SupplyMapRagRequest): Promise<SupplyMapOrchestrationContext> {
  const normalizedRequest: SupplyMapRagRequest = {
    ...request,
    productName: request.productName.trim(),
    judgeDemo: request.judgeDemo ?? true
  };
  const intent = extractProductIntent(normalizedRequest);
  const riskSignals = await analyzeRisks(intent);
  let domestic: { candidates: SupplierCandidate[]; complexes: IndustrialComplexSummary[]; usedMock: boolean };
  let global: { candidates: SupplierCandidate[]; usedMock: boolean };

  if (normalizedRequest.judgeDemo) {
    domestic = {
      candidates: MOCK_DOMESTIC_SUPPLIERS.filter((candidate) => matchesIntent(candidate, intent)),
      complexes: rankMockComplexes(intent),
      usedMock: true
    };
    global = { candidates: mockGlobalCandidates(intent), usedMock: true };
  } else {
    [domestic, global] = await Promise.all([findDomesticSupply(intent), findGlobalSupply(intent)]);
  }

  const scoredDomestic = scoreCandidates(domestic.candidates, intent, riskSignals).slice(0, 4);
  const scoredGlobal = scoreCandidates(global.candidates, intent, riskSignals).slice(0, 4);
  const domesticCandidates = attachCandidateEvidence(scoredDomestic);
  const globalCandidates = attachCandidateEvidence(scoredGlobal);
  const groundedRisks = attachRiskEvidence(riskSignals);
  const industrialComplexes: GroundedIndustrialComplex[] = domestic.complexes.map((complex) => ({
    ...complex,
    evidenceIds: ["EV-KICOX-TREND"]
  }));
  const rawScoreSummary = summarizeScores(scoredDomestic, scoredGlobal);
  const scoreSummary: GroundedScoreSummary = {
    ...rawScoreSummary,
    evidenceIds: [
      SCORING_EVIDENCE_ID,
      ...domesticCandidates.flatMap((candidate) => candidate.evidenceIds),
      ...globalCandidates.flatMap((candidate) => candidate.evidenceIds)
    ]
  };
  const liveKotraEvidence = await storedKotraEvidence(intent);
  const evidence = dedupeEvidence([
    ...mockEvidence(),
    ...kotraEvidence(intent),
    ...liveKotraEvidence,
    scoringEvidence(),
    ...scoredDomestic.map(candidateEvidence),
    ...scoredGlobal.map(candidateEvidence),
    ...riskSignals.map(riskEvidence)
  ]);
  const notices = [
    "국내 MOTIE·KICOX 공공데이터 후보를 우선하고 해외 후보는 보조 레이어로 제공합니다.",
    "MOCK 표시는 실시간 API 응답이 아닌 fallback 데이터이며 실제 거래 전 원문 API, 인증서와 현장 실사를 확인해야 합니다."
  ];
  if (!normalizedRequest.judgeDemo && (domestic.usedMock || global.usedMock)) {
    notices.push("실데이터 후보가 부족한 영역은 결정론적 mock 레코드로 대체했습니다.");
  }
  if (domesticCandidates.length === 0) {
    notices.push("요청 품목과 직접 일치하는 국내 mock 후보는 확인 필요입니다.");
  }

  return {
    request: normalizedRequest,
    intent,
    demoMode: Boolean(normalizedRequest.judgeDemo || domestic.usedMock || global.usedMock),
    domesticCandidates,
    globalCandidates,
    industrialComplexes,
    riskSignals: groundedRisks,
    scoreSummary,
    evidence,
    dataSourceCounts: sourceCounts([
      ...domesticCandidates,
      ...globalCandidates,
      ...industrialComplexes,
      ...groundedRisks,
      ...evidence
    ]),
    notices,
    generatedAt: new Date().toISOString()
  };
}

function sourceCodeForEvidence(evidence: EvidenceRecord): string {
  const known = SUPPLYMAP_MOCK_EVIDENCE.find(
    (item) => item.sourceName === evidence.providerName || item.title === evidence.title
  );
  if (known) return known.sourceCode;
  const source = [
    "kicox_factory_registry",
    "kicox_industrial_trends",
    "kotra_trade_qa",
    "kotra_market_news",
    "ksure_country_trade",
    "safety_korea",
    "customs_requirements",
    "customs_trade_stats",
    "unipass_hs_code",
    "unipass_customs_requirements",
    "unipass_tariff_rate",
    "unipass_fx_rate",
    "unipass_hs_navigation",
    "private_global_factory"
  ]
    .map((code) => supplySource(code))
    .find((item) => item.providerName === evidence.providerName && item.datasetName === evidence.datasetName);
  return source?.code ?? evidence.datasetName;
}

export function normalizeChatEvidence(
  evidence: readonly EvidenceRecord[],
  sessionId?: string
): SupplyMapChatEvidenceRecord[] {
  return evidence.map((item) => ({
    ...item,
    evidenceKey: item.id,
    sourceCode: sourceCodeForEvidence(item),
    sessionId
  }));
}

function compactEvidenceForQuestion(context: SupplyMapOrchestrationContext): EvidenceRecord[] {
  const candidateIds = [
    ...context.domesticCandidates.slice(0, 3).flatMap((candidate) => candidate.evidenceIds),
    ...context.globalCandidates.slice(0, 2).flatMap((candidate) => candidate.evidenceIds)
  ];
  const riskIds = context.riskSignals.slice(0, 8).flatMap((signal) => signal.evidenceIds);
  const priorityRiskIds = context.riskSignals
    .filter(
      (signal) =>
        signal.providerName === "한국무역보험공사" ||
        signal.providerName === "대한무역투자진흥공사" ||
        signal.providerName === "관세청"
    )
    .slice(0, 6)
    .flatMap((signal) => signal.evidenceIds);
  const documentIds = [
    "EV-KICOX-FACTORY",
    "EV-KICOX-TREND",
    "EV-SAFETY",
    "EV-CUSTOMS",
    "EV-CUSTOMS-TRADE",
    "EV-KSURE",
    KOTRA_QA_EVIDENCE_ID,
    KOTRA_NEWS_EVIDENCE_ID,
    KOTRA_COUNTRY_EVIDENCE_ID,
    SCORING_EVIDENCE_ID
  ];
  const wantedIds = new Set([...candidateIds, ...riskIds, ...priorityRiskIds, ...documentIds]);
  const selected = context.evidence.filter((item) => wantedIds.has(item.id));
  const kotraNews = context.evidence.filter(
    (item) => item.providerName === "대한무역투자진흥공사" && item.datasetName === "해외시장뉴스"
  );
  return dedupeEvidence(selected.length > 0 ? [...selected, ...kotraNews.slice(0, 4)] : context.evidence.slice(0, 12));
}

function evidenceContext(evidence: readonly SupplyMapChatEvidenceRecord[]): string {
  if (evidence.length === 0) return "근거 없음";
  return evidence
    .slice(0, 14)
    .map(
      (item, index) =>
        `${index + 1}. [${item.id}] ${item.providerName} / ${item.datasetName} / ${item.sourceType}: ${item.title} - ${item.snippet}`
    )
    .join("\n");
}

function structuredContext(context: SupplyMapOrchestrationContext): string {
  const domestic = context.domesticCandidates
    .slice(0, 4)
    .map(
      (candidate, index) =>
        `${index + 1}. ${candidate.name} / ${candidate.countryName} ${candidate.region ?? ""} ${candidate.city ?? ""} / ${candidate.products.join(", ") || "생산품 확인 필요"} / score=${candidate.score?.total ?? "확인 필요"} / evidence=${candidate.evidenceIds.join(", ")}`
    )
    .join("\n");
  const global = context.globalCandidates
    .slice(0, 4)
    .map(
      (candidate, index) =>
        `${index + 1}. ${candidate.name} / ${candidate.countryName} ${candidate.region ?? ""} ${candidate.city ?? ""} / ${candidate.products.join(", ") || "생산품 확인 필요"} / sourceType=${candidate.sourceType} / score=${candidate.score?.total ?? "확인 필요"} / evidence=${candidate.evidenceIds.join(", ")}`
    )
    .join("\n");
  const risks = context.riskSignals
    .slice(0, 8)
    .map(
      (signal, index) =>
        `${index + 1}. ${signal.kind} / ${signal.severity} / ${signal.status}: ${signal.title} - ${signal.summary} / evidence=${signal.evidenceIds.join(", ")}`
    )
    .join("\n");

  return [
    `제품: ${context.intent.query}`,
    `HS 후보: ${context.intent.hsCodeCandidates.join(", ") || "확인 필요"}`,
    `수입 희망국: ${context.intent.importCountry ?? "확인 필요"}`,
    `국내 후보:\n${domestic || "확인 필요"}`,
    `중국/해외 베타 후보:\n${global || "확인 필요"}`,
    `리스크 신호:\n${risks || "확인 필요"}`,
    `점수 정책: ${context.scoreSummary.methodology}`
  ].join("\n\n");
}

function confidenceForContext(context: SupplyMapOrchestrationContext, evidence: readonly SupplyMapChatEvidenceRecord[]): number {
  const sourceKinds = new Set(evidence.map((item) => item.sourceType));
  const base = evidence.length === 0 ? 20 : 45;
  const domestic = context.domesticCandidates.length > 0 ? 15 : 0;
  const risk = context.riskSignals.length > 0 ? 15 : 0;
  const publicData = sourceKinds.has("MOTIE_PUBLIC") ? 15 : 0;
  return Math.min(92, base + domestic + risk + publicData);
}

function needsVerificationForContext(context: SupplyMapOrchestrationContext, evidence: readonly SupplyMapChatEvidenceRecord[]): boolean {
  if (evidence.length === 0) return true;
  return context.riskSignals.some((signal) => signal.status !== "확인" || signal.severity === "NEEDS_CHECK" || signal.severity === "UNKNOWN");
}

function fallbackSupplyMapChatAnswer(args: {
  question: string;
  context: SupplyMapOrchestrationContext;
  evidence: SupplyMapChatEvidenceRecord[];
  warning: string;
  provider: LlmProvider;
}): LlmChatResult {
  const domestic = args.context.domesticCandidates[0];
  const global = args.context.globalCandidates[0];
  const questionText = args.question.toLowerCase();
  const wantsCustoms = /통관|세관|hs|수입요건|관세|요건승인/.test(questionText);
  const wantsSafety = /인증|kc|리콜|안전|전기용품|생활용품/.test(questionText);
  const wantsMarket = /수입액|수입실적|무역수지|시장|수요|의존|국가별|거래규모/.test(questionText);
  const firstRisk =
    (wantsCustoms ? args.context.riskSignals.find((signal) => signal.kind === "CUSTOMS") : undefined) ??
    (wantsMarket
      ? args.context.riskSignals.find((signal) => signal.providerName === "관세청" && signal.kind === "MARKET")
      : undefined) ??
    (wantsSafety
      ? args.context.riskSignals.find((signal) => signal.kind === "CERTIFICATION" || signal.kind === "RECALL")
      : undefined) ??
    args.context.riskSignals[0];
  const evidenceIds = args.evidence.slice(0, 6).map((item) => `[${item.id}]`).join(" ");

  if (args.evidence.length === 0) {
    return {
      model: "supplymap-fallback",
      provider: args.provider,
      usedLLM: false,
      warning: args.warning,
      answer: [
        "근거 부족: 현재 질문에 직접 연결된 SupplyMap 근거가 충분하지 않습니다.",
        "제품명, HS코드 후보, 수입 희망국을 먼저 좁힌 뒤 국내 공장등록생산정보, 인증·리콜, 세관장확인대상, 국가위험 데이터를 다시 확인해야 합니다."
      ].join("\n")
    };
  }

  return {
    model: "supplymap-fallback",
    provider: args.provider,
    usedLLM: false,
    warning: args.warning,
    answer: [
      `1. 결론\n현재 확보된 근거 기준으로는 국내 공장 후보와 중국/해외 베타 후보를 같은 품목 기준으로 비교하는 접근이 적절합니다. ${evidenceIds}`,
      "",
      "2. 국내 공장 후보",
      domestic
        ? `${domestic.name}은 국내 비교 후보입니다. 생산품 근거는 ${domestic.products.slice(0, 3).join(", ") || "확인 필요"}이며, 점수는 ${domestic.score?.total ?? "확인 필요"}점입니다. ${domestic.evidenceIds.map((id) => `[${id}]`).join(" ")}`
        : "국내 후보는 현재 확인 필요입니다.",
      "",
      "3. 중국/해외 베타 후보",
      global
        ? `${global.name}을 중국/해외 베타 후보로 비교할 수 있습니다. 다만 sourceType=${global.sourceType}이므로 사업자 실재성, 인증서 원문, 거래조건 확인이 필요합니다. ${global.evidenceIds.map((id) => `[${id}]`).join(" ")}`
        : "해외 후보는 현재 확인 필요입니다.",
      "",
      "4. 인증·통관·국가위험 확인사항",
      firstRisk
        ? firstRisk.kind === "MARKET"
          ? `${firstRisk.title} 항목이 먼저 확인 대상입니다. 이는 시장 규모와 특정 국가 거래 흐름을 보는 보조 신호이며 계약 안정성이나 수입 가능 여부를 단정하지 않습니다. ${firstRisk.evidenceIds.map((id) => `[${id}]`).join(" ")}`
          : `${firstRisk.title} 항목이 먼저 확인 대상입니다. 이는 최종 법률·통관 판단이 아니라 관계기관 확인 전 단계의 리스크 신호입니다. ${firstRisk.evidenceIds.map((id) => `[${id}]`).join(" ")}`
        : "리스크 신호가 없더라도 안전하다는 뜻은 아니며, 최종 인증·통관 판단은 관계기관 확인이 필요합니다.",
      "",
      "5. 다음 액션",
      `HS코드 확정, KC·제품안전/리콜 원문 확인, 세관장확인대상과 요건승인기관 확인, 국내 후보 RFQ와 중국/해외 후보 실사를 병행하세요. ${evidenceIds}`
    ].join("\n")
  };
}

async function callSupplyMapChatLLM(args: {
  request: SupplyMapChatRequest;
  context: SupplyMapOrchestrationContext;
  evidence: SupplyMapChatEvidenceRecord[];
}): Promise<LlmChatResult> {
  const provider = normalizeLlmProvider(args.request.llmProvider);
  const enabled = provider !== "deepseek" || (args.request.useDeepSeek !== false && process.env.SUPPLYMAP_DEEPSEEK_ENABLED !== "false");
  if (!enabled) {
    return fallbackSupplyMapChatAnswer({
      question: args.request.question,
      context: args.context,
      evidence: args.evidence,
      warning: "DeepSeek disabled.",
      provider
    });
  }

  const system = [
    "You are SupplyMap AI, a Korean trade copilot for SME import and sourcing decisions.",
    "Use only the supplied structured context and evidence records. Do not invent facts, companies, certifications, customs decisions, or legal conclusions.",
    "If evidence is missing or weak, write '확인 필요' clearly.",
    "HS code, product certification, customs requirement, recall, strategic goods, and country/payment risk must be described only as candidates or verification items.",
    "Clearly distinguish sourceType: MOTIE_PUBLIC, OTHER_PUBLIC, PRIVATE, USER_UPLOAD.",
    "Overseas factory data is auxiliary and must not be presented as government-verified.",
    "Every material claim must cite evidence ids in square brackets.",
    "Answer in Korean, concise, practical, and smooth."
  ].join("\n");

  const user = [
    `사용자 질문: ${args.request.question}`,
    "",
    "구조화된 SupplyMap 분석 컨텍스트:",
    structuredContext(args.context),
    "",
    "Evidence records:",
    evidenceContext(args.evidence),
    "",
    "응답 형식:",
    "1. 결론",
    "2. 국내 공장 후보",
    "3. 중국/해외 베타 후보 비교",
    "4. 인증·통관·리콜·국가/결제 리스크",
    "5. 다음 확인 액션",
    "각 문장에 가능한 근거 ID를 붙이세요."
  ].join("\n");

  return callLlmProviderChat({
    provider,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    maxTokens: 1400,
    timeoutMs: 35_000,
    fallback: (warning, fallbackProvider) =>
      fallbackSupplyMapChatAnswer({
        question: args.request.question,
        context: args.context,
        evidence: args.evidence,
        warning,
        provider: fallbackProvider
      })
  });
}

export async function runSupplyMapChat(request: SupplyMapChatRequest): Promise<SupplyMapChatResponse> {
  const context = await retrieveSupplyMapContext({
    productName: (request.productName || request.question).trim(),
    hsCode: request.hsCode,
    importCountry: request.country,
    preferredRegion: request.preferredRegion,
    judgeDemo: request.judgeDemo ?? true,
    useDeepSeek: request.useDeepSeek
  });
  const sessionId = request.currentAnalysisId ?? `supplymap-chat-${Date.now().toString(36)}`;
  const evidence = normalizeChatEvidence(compactEvidenceForQuestion(context), sessionId);
  const llm = await callSupplyMapChatLLM({ request, context, evidence });
  const warnings = [
    ...context.notices,
    ...(llm.warning ? [llm.warning] : []),
    ...(evidence.length === 0 ? ["근거 부족: 답변에 사용할 evidence가 없습니다."] : [])
  ];

  return {
    answer: llm.answer,
    model: llm.model,
    provider: llm.provider,
    usedLLM: llm.usedLLM,
    confidence: confidenceForContext(context, evidence),
    needsVerification: needsVerificationForContext(context, evidence),
    evidence,
    warnings,
    intent: context.intent,
    domesticCandidates: context.domesticCandidates,
    globalCandidates: context.globalCandidates,
    riskSignals: context.riskSignals
  };
}
