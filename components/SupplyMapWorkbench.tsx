"use client";

import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Database,
  Factory,
  FileText,
  Info,
  Loader2,
  Map,
  MapPin,
  PackageSearch,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Truck
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EvidenceDrawer, type SupplyEvidence } from "@/components/EvidenceDrawer";
import { ChinaFactoryBetaHeatmap } from "@/components/ChinaFactoryBetaHeatmap";
import { JudgeDemoBanner } from "@/components/JudgeDemoBanner";
import { KakaoDomesticHeatmap } from "@/components/KakaoDomesticHeatmap";
import { SourceBadge } from "@/components/SourceBadge";
import { SupplyMapCopilot } from "@/components/SupplyMapCopilot";
import { SupplyMapCandidateTable, type SupplyMapCandidateTableRow } from "@/components/SupplyMapCandidateTable";
import { SupplyMapReportPreview } from "@/components/SupplyMapReportPreview";
import { SupplyMapRiskPanel, type SupplyMapRiskPanelSignal } from "@/components/SupplyMapRiskPanel";
import { buildSupplyMapReport, type SupplyMapReport } from "@/lib/supplymap/report";
import type {
  CandidateScoreBreakdown,
  CandidateScoreComponent,
  EvidenceRecord,
  RiskSignalKind,
  RiskSignalRecord,
  SupplierCandidate,
  SupplyMapAnalysisResponse,
  SupplyMapCandidateType,
  SupplySourceType,
  VerificationStatus
} from "@/lib/supplymap/types";

type Layer = "domestic" | "overseas";
type ViewTab = "overview" | "comparison" | "report";
type RiskLevel = "높음" | "보통" | "낮음";

type ProductInput = {
  productName: string;
  hsCode?: string;
  importCountry?: string;
  preferredRegion?: string;
  industry: string;
  annualDemand: string;
  priorities: string[];
};

type Candidate = {
  id: string;
  scope: Layer;
  name: string;
  region: string;
  complex: string;
  address?: string;
  products?: string[];
  matchReason?: string;
  score: number;
  capability: string;
  annualCapacity: string;
  leadTime: string;
  costIndex: number;
  risk: RiskLevel;
  dataMatch: string;
  sourceType?: SupplySourceType;
  tags: string[];
  evidenceIds: string[];
  x: number;
  y: number;
};

type SupplyRisk = {
  level: RiskLevel;
  title: string;
  detail: string;
  mitigation: string;
  evidenceId: string;
  sourceType?: SupplySourceType;
};

type AnalysisResult = {
  requestId: string;
  analyzedAt: string;
  dataMode: "mock" | "api";
  connectionNote: string;
  domestic: Candidate[];
  overseas: Candidate[];
  comparison: SupplyMapCandidateTableRow[];
  risks: SupplyRisk[];
  riskSignals: SupplyMapRiskPanelSignal[];
  answer: string;
  evidence: SupplyEvidence[];
  report: SupplyMapReport;
};

const priorityOptions = ["국내 공급", "중국 비교", "납기", "원가", "리스크", "인증"];

const JUDGE_DEMO_PRODUCTS: ProductInput[] = [
  {
    productName: "식품 포장용기",
    hsCode: "392330",
    importCountry: "CN",
    preferredRegion: "경기",
    industry: "소재·화학",
    annualDemand: "120000",
    priorities: ["국내 공급", "중국 비교", "납기", "리스크"]
  },
  {
    productName: "전기히터",
    hsCode: "851629",
    importCountry: "CN",
    preferredRegion: "인천",
    industry: "전기전자",
    annualDemand: "45000",
    priorities: ["인증", "리스크", "납기"]
  },
  {
    productName: "LED 조명",
    hsCode: "940542",
    importCountry: "VN",
    preferredRegion: "경북",
    industry: "전기전자",
    annualDemand: "80000",
    priorities: ["국내 공급", "중국 비교", "원가", "납기"]
  },
  {
    productName: "화장품 용기",
    hsCode: "392330",
    importCountry: "CN",
    preferredRegion: "충북",
    industry: "바이오·헬스",
    annualDemand: "200000",
    priorities: ["국내 공급", "중국 비교", "리스크", "원가"]
  },
  {
    productName: "드론 부품",
    hsCode: "880790",
    importCountry: "CN",
    preferredRegion: "대전",
    industry: "기계·로봇",
    annualDemand: "30000",
    priorities: ["리스크", "납기", "중국 비교"]
  }
];

const SAMPLE_INPUT: ProductInput = JUDGE_DEMO_PRODUCTS[0];

const defaultEvidence: SupplyEvidence[] = [
  {
    id: "ev-kicox-ansan",
    citation: "[D1]",
    title: "반월·시화 국가산업단지 업종 집적",
    provider: "한국산업단지공단(KICOX)",
    dataset: "전국산업단지 현황통계 · 입주업체 및 생산 업종",
    recordId: "KICOX-NIC-ANSAN-2026Q2",
    updatedAt: "2026.06 샘플 스냅샷",
    scope: "domestic",
    confidence: 96,
    fields: [
      { label: "산업단지", value: "반월·시화 국가산업단지" },
      { label: "주요 업종", value: "금속가공, 자동차부품, 전기·전자" },
      { label: "입지", value: "경기 안산·시흥 / 수도권 서남부" },
      { label: "분석 활용", value: "동종 업종 집적도와 수요처 접근성 계산" }
    ],
    url: "https://www.kicox.or.kr"
  },
  {
    id: "ev-motie-factory",
    citation: "[D2]",
    title: "알루미늄 가공·자동차부품 공장등록 매칭",
    provider: "산업통상자원부(MOTIE)",
    dataset: "공장등록 현황 · 한국표준산업분류 기반 생산품 정보",
    recordId: "MOTIE-FEM-30399-24222",
    updatedAt: "2026.06 샘플 스냅샷",
    scope: "domestic",
    confidence: 94,
    fields: [
      { label: "매칭 업종", value: "자동차용 기타 신품 부품 제조업" },
      { label: "연관 공정", value: "알루미늄 압연·압출, 정밀가공, 브레이징" },
      { label: "후보 권역", value: "경기 서남권, 경남 창원, 경북 구미" },
      { label: "분석 활용", value: "제품 요구 공정과 등록 생산품 간 의미 유사도" }
    ],
    url: "https://www.data.go.kr"
  },
  {
    id: "ev-kicox-changwon",
    citation: "[D3]",
    title: "창원 국가산업단지 기계·수송장비 기반",
    provider: "한국산업단지공단(KICOX)",
    dataset: "산업단지별 입주·고용·생산 현황",
    recordId: "KICOX-NIC-CHANGWON-2026Q2",
    updatedAt: "2026.06 샘플 스냅샷",
    scope: "domestic",
    confidence: 92,
    fields: [
      { label: "산업단지", value: "창원 국가산업단지" },
      { label: "주요 업종", value: "기계, 운송장비, 금속가공" },
      { label: "물류", value: "부산신항·마산항 연계" },
      { label: "분석 활용", value: "양산 역량과 항만 접근성 비교" }
    ],
    url: "https://www.kicox.or.kr"
  },
  {
    id: "ev-customs-trade",
    citation: "[D4]",
    title: "HS 연관품목 국가별 수입 의존도",
    provider: "관세청",
    dataset: "품목별 국가별 수출입실적",
    recordId: "KCS-HS761699-2025",
    updatedAt: "2025 연간 샘플 스냅샷",
    scope: "domestic",
    confidence: 91,
    fields: [
      { label: "연관 HS", value: "7616.99 · 기타 알루미늄 제품" },
      { label: "분석 단위", value: "국가별 수입금액·중량" },
      { label: "관찰 신호", value: "중국 공급 비중 집중" },
      { label: "분석 활용", value: "공급국 집중도와 대체 필요성 계산" }
    ],
    url: "https://www.customs.go.kr"
  },
  {
    id: "ev-overseas-jiangsu",
    citation: "[O1]",
    title: "장쑤성 자동차부품 제조거점 보조 매칭",
    provider: "공개 제조거점 통합 스냅샷",
    dataset: "해외 제조사 위치·생산품 보조 색인",
    recordId: "OS-CN-JS-ALU-0041",
    updatedAt: "2026.06 샘플 스냅샷",
    scope: "overseas",
    confidence: 78,
    fields: [
      { label: "권역", value: "중국 장쑤성 쑤저우" },
      { label: "공정", value: "알루미늄 브레이징·열교환 부품" },
      { label: "사용 범위", value: "국내 후보 비교를 위한 보조 벤치마크" },
      { label: "주의", value: "계약 전 기업 실사와 최신 인증 확인 필요" }
    ]
  },
  {
    id: "ev-logistics",
    citation: "[O2]",
    title: "해외 조달 리드타임 가정",
    provider: "SupplyMap AI 샘플 모델",
    dataset: "항만 구간·통관·내륙운송 시나리오",
    recordId: "MODEL-LEADTIME-CN-KR-V1",
    updatedAt: "2026.06 모델 기준",
    scope: "overseas",
    confidence: 72,
    fields: [
      { label: "운송 구간", value: "중국 동부항 → 부산/인천항 → 국내 수요처" },
      { label: "가정 리드타임", value: "통상 17~24일" },
      { label: "포함 항목", value: "해상운송, 통관, 국내 내륙운송" },
      { label: "주의", value: "운임·항만 적체에 따라 변동" }
    ]
  }
];

function fallbackAnalysis(input: ProductInput, note = "샘플 스냅샷 사용 중") : AnalysisResult {
  const domestic: Candidate[] = [
    {
      id: "domestic-ansan",
      scope: "domestic",
      name: "경기 서남권 정밀가공 클러스터",
      region: "경기 안산·시흥",
      complex: "반월·시화 국가산업단지",
      score: 92,
      capability: "알루미늄 압출·CNC·진공 브레이징",
      annualCapacity: "15만 개 추정",
      leadTime: "7~10일",
      costIndex: 104,
      risk: "낮음",
      dataMatch: "KICOX + MOTIE 2개 근거",
      tags: ["자동차부품", "금속가공", "수도권 물류"],
      evidenceIds: ["ev-kicox-ansan", "ev-motie-factory"],
      x: 38,
      y: 38
    },
    {
      id: "domestic-changwon",
      scope: "domestic",
      name: "창원 모빌리티 부품 클러스터",
      region: "경남 창원",
      complex: "창원 국가산업단지",
      score: 87,
      capability: "대형 프레스·정밀가공·열교환 조립",
      annualCapacity: "20만 개 추정",
      leadTime: "9~12일",
      costIndex: 101,
      risk: "낮음",
      dataMatch: "KICOX + MOTIE 2개 근거",
      tags: ["기계", "수송장비", "부산신항"],
      evidenceIds: ["ev-kicox-changwon", "ev-motie-factory"],
      x: 63,
      y: 71
    },
    {
      id: "domestic-gumi",
      scope: "domestic",
      name: "구미 전장·소재 융합 클러스터",
      region: "경북 구미",
      complex: "구미 국가산업단지",
      score: 81,
      capability: "알루미늄 가공·표면처리·품질검사",
      annualCapacity: "11만 개 추정",
      leadTime: "10~14일",
      costIndex: 98,
      risk: "보통",
      dataMatch: "KICOX 1개 + 모델 보강",
      tags: ["전기전자", "소재부품", "품질인프라"],
      evidenceIds: ["ev-motie-factory"],
      x: 64,
      y: 52
    },
    {
      id: "domestic-gwangju",
      scope: "domestic",
      name: "광주 미래차 생산권역",
      region: "광주 광산구",
      complex: "빛그린 국가산업단지",
      score: 76,
      capability: "자동차부품 조립·검사·완성차 연계",
      annualCapacity: "9만 개 추정",
      leadTime: "12~15일",
      costIndex: 96,
      risk: "보통",
      dataMatch: "MOTIE 1개 + 입지 모델",
      tags: ["미래차", "완성차 인접", "확장 여력"],
      evidenceIds: ["ev-motie-factory"],
      x: 39,
      y: 76
    }
  ];

  const overseas: Candidate[] = [
    {
      id: "overseas-suzhou",
      scope: "overseas",
      name: "Jiangsu Thermal Parts Co.",
      region: "중국 장쑤성 쑤저우",
      complex: "Suzhou Industrial Park",
      score: 84,
      capability: "알루미늄 브레이징·열교환 모듈",
      annualCapacity: "35만 개 추정",
      leadTime: "17~22일",
      costIndex: 89,
      risk: "보통",
      dataMatch: "해외 공개정보 + 물류 모델",
      tags: ["대량양산", "원가우위", "수입통관"],
      evidenceIds: ["ev-overseas-jiangsu", "ev-logistics"],
      x: 66,
      y: 49
    },
    {
      id: "overseas-aichi",
      scope: "overseas",
      name: "Aichi Mobility Metals",
      region: "일본 아이치현",
      complex: "Nagoya Manufacturing Belt",
      score: 79,
      capability: "고정밀 냉각부품·자동차 품질관리",
      annualCapacity: "18만 개 추정",
      leadTime: "16~21일",
      costIndex: 118,
      risk: "낮음",
      dataMatch: "해외 공개정보 + 물류 모델",
      tags: ["고정밀", "품질우위", "비용상승"],
      evidenceIds: ["ev-logistics"],
      x: 81,
      y: 52
    },
    {
      id: "overseas-haiphong",
      scope: "overseas",
      name: "Hai Phong EV Components",
      region: "베트남 하이퐁",
      complex: "Dinh Vu Industrial Zone",
      score: 72,
      capability: "프레스·CNC·부품 조립",
      annualCapacity: "24만 개 추정",
      leadTime: "22~28일",
      costIndex: 83,
      risk: "보통",
      dataMatch: "해외 공개정보 + 물류 모델",
      tags: ["원가우위", "증설가능", "장거리물류"],
      evidenceIds: ["ev-logistics"],
      x: 55,
      y: 74
    }
  ];
  const risks: SupplyRisk[] = [
    {
      level: "높음",
      title: "해외 단일국가 집중",
      detail: "연관 HS 품목의 중국 공급 비중이 높아 가격·통관 변동에 노출됩니다.",
      mitigation: "한국 후보와 중국 후보를 나누어 RFQ를 보내고 단일 국가 의존도를 낮춤",
      evidenceId: "ev-customs-trade"
    },
    {
      level: "보통",
      title: "브레이징 공정 검증 필요",
      detail: "공장등록 업종만으로 기밀·내압 성능을 확정할 수 없습니다.",
      mitigation: "RFQ 단계에서 설비·PPAP·누설검사 증빙 요청",
      evidenceId: "ev-motie-factory"
    },
    {
      level: "낮음",
      title: "국내 물류 리드타임",
      detail: "국내 권역은 수요처와 항만 접근성이 좋아 긴급 증산 대응이 유리합니다.",
      mitigation: "안산·창원 2개 권역에 샘플 발주",
      evidenceId: "ev-kicox-ansan"
    }
  ];
  const comparison = [...domestic, ...overseas].map(candidateToComparisonRow);
  const riskSignals = risks.map((risk, index) => riskToPanelSignal(risk, index));
  const answer = `${input.productName}은 한국 공장과 중국 베타 공장을 같은 품목 기준으로 나누어 비교할 수 있습니다. 국내 후보는 산업단지·생산품·주소 근거가 상대적으로 상세하고, 중국 후보는 현재 확보된 해외 제조업소 데이터로 지역 분포와 품목군을 보는 베타 레이어입니다. RFQ 전에는 국내 후보의 생산 가능 품목과 중국 후보의 사업자 실재성·좌표 신뢰도·인증 자료를 각각 확인해야 합니다.`;

  const baseResult: Omit<AnalysisResult, "report"> = {
    requestId: "SM-DEMO-0620-A01",
    analyzedAt: "2026.06.20 14:30",
    dataMode: "mock",
    connectionNote: note,
    domestic,
    overseas,
    comparison,
    risks,
    riskSignals,
    answer,
    evidence: defaultEvidence
  };
  return { ...baseResult, report: buildWorkbenchReport(input, baseResult) };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function firstString(record: Record<string, unknown>, keys: string[], fallback: string) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

function firstNumber(record: Record<string, unknown>, keys: string[], fallback: number) {
  for (const key of keys) {
    const value = record[key];
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asSourceType(value: string | undefined, fallback: SupplySourceType): SupplySourceType {
  if (value === "MOTIE_PUBLIC" || value === "OTHER_PUBLIC" || value === "PRIVATE" || value === "USER_UPLOAD") {
    return value;
  }
  return fallback;
}

function sourceTypeForCandidate(candidate: Candidate): SupplySourceType {
  return candidate.sourceType ?? (candidate.scope === "domestic" ? "MOTIE_PUBLIC" : "PRIVATE");
}

function sourceTypeForRisk(risk: SupplyRisk): SupplySourceType {
  return risk.sourceType ?? "OTHER_PUBLIC";
}

function severityForRiskLevel(level: RiskLevel): SupplyMapRiskPanelSignal["severity"] {
  if (level === "높음") return "HIGH";
  if (level === "낮음") return "LOW";
  return "MEDIUM";
}

function kindForRiskTitle(title: string): RiskSignalKind {
  if (/인증|KC|리콜|검증/.test(title)) return "CERTIFICATION";
  if (/통관|HS|세관/.test(title)) return "CUSTOMS";
  if (/국가|시장/.test(title)) return "COUNTRY";
  if (/결제|거래/.test(title)) return "PAYMENT";
  return "NEWS";
}

function riskToPanelSignal(risk: SupplyRisk, index: number): SupplyMapRiskPanelSignal {
  return {
    id: `fallback-risk-${index}`,
    kind: kindForRiskTitle(risk.title),
    severity: severityForRiskLevel(risk.level),
    status: risk.level === "낮음" ? "확인" : "확인 필요",
    title: risk.title,
    summary: `${risk.detail} 완화: ${risk.mitigation}`,
    scoreImpact: risk.level === "높음" ? -3 : risk.level === "보통" ? -1 : 0,
    providerName: "SupplyMap AI 샘플 모델",
    datasetName: "리스크 요약 스냅샷",
    sourceType: sourceTypeForRisk(risk),
    evidenceId: risk.evidenceId
  };
}

function asRiskKind(value: string | undefined, fallback: RiskSignalKind): RiskSignalKind {
  const allowed: RiskSignalKind[] = [
    "CERTIFICATION",
    "RECALL",
    "CUSTOMS",
    "COUNTRY",
    "PAYMENT",
    "NEWS",
    "STRATEGIC_GOODS",
    "COUNTRY_RISK",
    "MARKET",
    "TRADE_SECURITY"
  ];
  return allowed.includes(value as RiskSignalKind) ? (value as RiskSignalKind) : fallback;
}

function asRiskSeverity(value: string | undefined, fallback: SupplyMapRiskPanelSignal["severity"]): SupplyMapRiskPanelSignal["severity"] {
  if (value === "LOW" || value === "MEDIUM" || value === "HIGH" || value === "NEEDS_CHECK" || value === "UNKNOWN") {
    return value;
  }
  return fallback;
}

function verificationForCandidate(candidate: Candidate): VerificationStatus {
  const sourceType = sourceTypeForCandidate(candidate);
  if (sourceType === "MOTIE_PUBLIC") return "VERIFIED";
  if (sourceType === "OTHER_PUBLIC") return "PARTIAL";
  return candidate.scope === "domestic" ? "PARTIAL" : "CHECK_REQUIRED";
}

function candidateTypeForScope(scope: Layer): SupplyMapCandidateType {
  return scope === "domestic" ? "DOMESTIC_SUPPLIER" : "GLOBAL_FACTORY";
}

function riskSummaryForCandidate(candidate: Candidate): string {
  if (candidate.scope === "domestic") {
    return candidate.risk === "낮음"
      ? "국내 공공데이터 근거가 강한 비교 후보입니다."
      : "국내 후보이나 생산능력·단가·납기는 계약 전 확인 필요";
  }
  return "중국/해외 베타 후보입니다. 사업자 실재성·인증서·거래조건 확인 필요";
}

function sourceNameForCandidate(candidate: Candidate): string {
  const sourceType = sourceTypeForCandidate(candidate);
  if (sourceType === "MOTIE_PUBLIC") return "한국산업단지공단·산업통상자원부";
  if (sourceType === "OTHER_PUBLIC") return "타 기관 공공데이터";
  if (sourceType === "USER_UPLOAD") return "사용자 업로드";
  return "민간·해외 공급망 데이터";
}

function scoreComponent(score: number, maxScore: number, reason: string, status: CandidateScoreComponent["status"]): CandidateScoreComponent {
  return { score, maxScore, reason, status };
}

function fallbackScoreBreakdown(candidate: Candidate): CandidateScoreBreakdown {
  const sourceType = sourceTypeForCandidate(candidate);
  return {
    productFit: scoreComponent(Math.min(30, Math.max(14, Math.round(candidate.score * 0.3))), 30, candidate.matchReason ?? "샘플 후보 생산품 매칭", "주의"),
    publicDataConfidence: scoreComponent(
      sourceType === "MOTIE_PUBLIC" ? 18 : sourceType === "OTHER_PUBLIC" ? 14 : sourceType === "USER_UPLOAD" ? 8 : 4,
      20,
      sourceType === "MOTIE_PUBLIC" ? "MOTIE_PUBLIC 출처에서 확인" : "공공데이터 직접 확인도 제한",
      sourceType === "MOTIE_PUBLIC" ? "확인" : "확인 필요"
    ),
    complianceReadiness: scoreComponent(candidate.scope === "domestic" ? 11 : 8, 20, "인증·통관 원문 확인 필요", "확인 필요"),
    locationLogistics: scoreComponent(candidate.scope === "domestic" ? 13 : 7, 15, candidate.address ?? candidate.region, candidate.scope === "domestic" ? "주의" : "확인 필요"),
    countryPaymentRisk: scoreComponent(candidate.scope === "domestic" ? 12 : 8, 15, "거래·결제 조건은 계약 전 확인 필요", "확인 필요")
  };
}

function candidateToComparisonRow(candidate: Candidate): SupplyMapCandidateTableRow {
  return {
    id: candidate.id,
    candidateType: candidateTypeForScope(candidate.scope),
    name: candidate.name,
    country: candidate.scope === "domestic" ? "대한민국" : candidate.region.split(/\s+/)[0] || "해외",
    region: candidate.region,
    address: candidate.address ?? candidate.region,
    productText: (candidate.products?.length ? candidate.products : [candidate.capability]).slice(0, 6).join(", "),
    industrialComplex: candidate.complex,
    matchScore: candidate.score,
    sourceType: sourceTypeForCandidate(candidate),
    sourceName: sourceNameForCandidate(candidate),
    datasetName: candidate.scope === "domestic" ? "KICOX 공장등록생산정보·산업동향" : "해외 Factory 통합 보조 데이터",
    verification: verificationForCandidate(candidate),
    riskSummary: riskSummaryForCandidate(candidate),
    scoreBreakdown: fallbackScoreBreakdown(candidate),
    evidenceIds: candidate.evidenceIds
  };
}

function evidenceToRecord(evidence: SupplyEvidence): EvidenceRecord {
  const sourceType = evidence.sourceType ?? (evidence.scope === "domestic" ? "MOTIE_PUBLIC" : "PRIVATE");
  return {
    id: evidence.id,
    title: evidence.title,
    snippet: evidence.fields.map((field) => `${field.label}: ${field.value}`).join(" · "),
    claim: evidence.scope === "domestic" ? "국내 공급망 분석 근거" : "중국/해외 베타 후보 분석 근거",
    url: evidence.url,
    providerName: evidence.provider,
    datasetName: evidence.dataset,
    sourceType,
    sourceUrl: evidence.url ?? "about:blank",
    fetchedAt: evidence.updatedAt,
    license: sourceType === "MOTIE_PUBLIC" ? "공공데이터·공공누리 원천 이용조건 준수" : "원천 이용조건 확인 필요",
    verification: evidence.confidence >= 90 ? "VERIFIED" : evidence.confidence >= 80 ? "PARTIAL" : "MOCK"
  };
}

function candidateToSupplier(candidate: Candidate): SupplierCandidate {
  const sourceType = sourceTypeForCandidate(candidate);
  const breakdown = fallbackScoreBreakdown(candidate);
  return {
    id: candidate.id,
    name: candidate.name,
    scope: candidate.scope === "domestic" ? "DOMESTIC" : "GLOBAL",
    countryCode: candidate.scope === "domestic" ? "KR" : candidate.region.includes("일본") ? "JP" : candidate.region.includes("베트남") ? "VN" : "CN",
    countryName: candidate.scope === "domestic" ? "대한민국" : candidate.region.split(/\s+/)[0] || "해외",
    region: candidate.region,
    city: candidate.region.split(/\s+/)[1],
    address: candidate.address ?? candidate.region,
    products: candidate.products?.length ? candidate.products : [candidate.capability],
    hsCodes: [],
    industrialComplex: candidate.complex,
    description: candidate.capability,
    matchReason: candidate.matchReason ?? candidate.capability,
    score: {
      productFit: breakdown.productFit.score,
      publicVerification: breakdown.publicDataConfidence.score,
      complianceReadiness: breakdown.complianceReadiness.score,
      logisticsFit: breakdown.locationLogistics.score,
      countryTransactionRisk: breakdown.countryPaymentRisk.score,
      total: candidate.score,
      totalScore: candidate.score,
      status: candidate.score >= 85 ? "추천" : candidate.score >= 70 ? "비교 검토" : "확인 필요",
      breakdown,
      decisionSupportLabel: "의사결정 보조 점수",
      riskSummary: riskSummaryForCandidate(candidate)
    },
    providerName: sourceNameForCandidate(candidate),
    datasetName: candidate.scope === "domestic" ? "KICOX 공장등록생산정보·산업동향" : "해외 Factory 통합 보조 데이터",
    sourceType,
    sourceUrl: candidate.scope === "domestic" ? "https://www.kicox.or.kr" : "about:blank",
    fetchedAt: "2026.06 샘플 스냅샷",
    license: sourceType === "MOTIE_PUBLIC" ? "공공데이터·공공누리 원천 이용조건 준수" : "원천 이용조건 확인 필요",
    verification: verificationForCandidate(candidate)
  };
}

function panelSignalToRiskRecord(signal: SupplyMapRiskPanelSignal): RiskSignalRecord {
  return {
    id: signal.id,
    kind: asRiskKind(String(signal.kind), "NEWS"),
    severity: signal.severity,
    status: signal.status === "확인" || signal.status === "주의" || signal.status === "확인 필요" ? signal.status : "확인 필요",
    title: signal.title,
    summary: signal.summary,
    scoreImpact: signal.scoreImpact,
    providerName: signal.providerName,
    datasetName: signal.datasetName,
    sourceType: signal.sourceType,
    sourceUrl: "about:blank",
    fetchedAt: "2026.06 샘플 스냅샷",
    license: signal.sourceType === "MOTIE_PUBLIC" ? "공공데이터·공공누리 원천 이용조건 준수" : "원천 이용조건 확인 필요",
    verification: signal.severity === "NEEDS_CHECK" || signal.severity === "UNKNOWN" ? "MOCK" : "PARTIAL"
  };
}

function sourceCounts(evidence: EvidenceRecord[]): Record<SupplySourceType, number> {
  const counts: Record<SupplySourceType, number> = {
    MOTIE_PUBLIC: 0,
    OTHER_PUBLIC: 0,
    PRIVATE: 0,
    USER_UPLOAD: 0
  };
  for (const item of evidence) counts[item.sourceType] += 1;
  return counts;
}

function buildWorkbenchReport(input: ProductInput, result: Omit<AnalysisResult, "report">): SupplyMapReport {
  const candidateEvidenceRecords: EvidenceRecord[] = [...result.domestic, ...result.overseas].map((candidate) => {
    const sourceType = sourceTypeForCandidate(candidate);
    return {
      id: "EV-CAND-" + candidate.id,
      title: candidate.name,
      snippet: `${candidate.matchReason ?? candidate.capability} · ${candidate.products?.join(", ") || candidate.capability}`,
    claim: candidate.scope === "domestic" ? "국내 공장 비교 후보" : "중국/해외 베타 비교 후보",
      providerName: sourceNameForCandidate(candidate),
      datasetName: candidate.scope === "domestic" ? "KICOX 공장등록생산정보·산업동향" : "해외 Factory 통합 보조 데이터",
      sourceType,
      sourceUrl: candidate.scope === "domestic" ? "https://www.kicox.or.kr" : "about:blank",
      fetchedAt: "2026.06 샘플 스냅샷",
      license: sourceType === "MOTIE_PUBLIC" ? "공공데이터·공공누리 원천 이용조건 준수" : "원천 이용조건 확인 필요",
      verification: verificationForCandidate(candidate)
    };
  });
  const riskEvidenceRecords: EvidenceRecord[] = result.riskSignals.map((signal) => ({
    id: "EV-RISK-" + signal.id,
    title: signal.title,
    snippet: signal.summary,
    claim: signal.status,
    providerName: signal.providerName,
    datasetName: signal.datasetName,
    sourceType: signal.sourceType,
    sourceUrl: "about:blank",
    fetchedAt: "2026.06 샘플 스냅샷",
    license: signal.sourceType === "MOTIE_PUBLIC" ? "공공데이터·공공누리 원천 이용조건 준수" : "원천 이용조건 확인 필요",
    verification: signal.severity === "NEEDS_CHECK" || signal.severity === "UNKNOWN" ? "MOCK" : "PARTIAL"
  }));
  const evidence = [...candidateEvidenceRecords, ...riskEvidenceRecords, ...result.evidence.map(evidenceToRecord)].filter(
    (item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index
  );
  const analysisForReport: SupplyMapAnalysisResponse = {
    analysisId: result.requestId,
    generatedAt: result.analyzedAt,
    demoMode: result.dataMode === "mock",
    intent: {
      query: input.productName,
      keywords: input.productName.split(/\s+/).filter(Boolean),
      category: input.industry,
      hsCode: input.hsCode,
      hsCodeCandidates: input.hsCode ? [input.hsCode] : [],
      importCountry: input.importCountry,
      preferredRegion: input.preferredRegion
    },
    domesticCandidates: result.domestic.map(candidateToSupplier),
    globalCandidates: result.overseas.map(candidateToSupplier),
    comparisonCandidates: result.comparison.map((row) => ({
      ...row,
      countryCode: row.countryCode ?? (row.candidateType === "DOMESTIC_SUPPLIER" ? "KR" : "확인 필요")
    })),
    industrialComplexes: [],
    riskSignals: result.riskSignals.map(panelSignalToRiskRecord),
    scoreSummary: {
      domesticAverage: result.domestic.length
        ? Math.round(result.domestic.reduce((sum, candidate) => sum + candidate.score, 0) / result.domestic.length)
        : null,
      globalAverage: result.overseas.length
        ? Math.round(result.overseas.reduce((sum, candidate) => sum + candidate.score, 0) / result.overseas.length)
        : null,
      recommendation: result.answer,
      methodology: "제품 적합도 30, 공공데이터 확인도 20, 인증·통관 20, 입지·물류 15, 국가·거래위험 15"
    },
    answer: {
      headline: "한국 공장과 중국 베타 공장을 같은 품목 기준으로 비교하세요.",
      summary: result.answer,
      sections: [
        {
          title: "권고",
          body: result.answer,
          evidenceIds: result.evidence.slice(0, 4).map((item) => item.id)
        }
      ],
      model: "SupplyMap evidence fallback",
      grounded: true
    },
    evidence,
    dataSourceCounts: sourceCounts(evidence),
    notices: [
      "샘플 데이터 모드는 API 키 없이 재현 가능한 고정 데이터입니다.",
      "해외 공장 데이터는 보조 후보이며 정부가 안전성이나 거래 신뢰를 보증한다는 의미가 아닙니다.",
      "최종 인증·통관 판단은 관계기관 확인이 필요합니다."
    ]
  };
  return buildSupplyMapReport(analysisForReport);
}

function reportFromApiPayload(value: unknown): SupplyMapReport | undefined {
  const record = asRecord(value);
  if (!record || !record.intent || !Array.isArray(record.domesticCandidates) || !Array.isArray(record.comparisonCandidates)) {
    return undefined;
  }
  try {
    return buildSupplyMapReport(value as SupplyMapAnalysisResponse);
  } catch {
    return undefined;
  }
}

function firstArray(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return null;
}

function firstStringArray(record: Record<string, unknown>, keys: string[], fallback: string[]): string[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    if (typeof value === "string" && value.trim()) {
      return value.split(/[,/|·ㆍ;]/).map((item) => item.trim()).filter(Boolean);
    }
  }
  return fallback;
}

function asCandidateType(value: string | undefined, fallback: SupplyMapCandidateType): SupplyMapCandidateType {
  if (value === "DOMESTIC_SUPPLIER" || value === "GLOBAL_FACTORY") return value;
  return fallback;
}

function asVerificationStatus(value: string | undefined, fallback: VerificationStatus): VerificationStatus {
  if (value === "VERIFIED" || value === "PARTIAL" || value === "CHECK_REQUIRED" || value === "MOCK") return value;
  return fallback;
}

function asScoreComponent(value: unknown, fallback: CandidateScoreComponent): CandidateScoreComponent {
  const record = asRecord(value);
  if (!record) return fallback;
  const statusText = firstString(record, ["status"], fallback.status);
  const status: CandidateScoreComponent["status"] =
    statusText === "확인" || statusText === "주의" || statusText === "확인 필요" ? statusText : fallback.status;
  return {
    score: Math.max(0, Math.min(firstNumber(record, ["maxScore"], fallback.maxScore), firstNumber(record, ["score"], fallback.score))),
    maxScore: firstNumber(record, ["maxScore"], fallback.maxScore),
    reason: firstString(record, ["reason"], fallback.reason),
    status
  };
}

function normalizeScoreBreakdown(value: unknown, fallback: CandidateScoreBreakdown): CandidateScoreBreakdown {
  const record = asRecord(value);
  if (!record) return fallback;
  return {
    productFit: asScoreComponent(record.productFit, fallback.productFit),
    publicDataConfidence: asScoreComponent(record.publicDataConfidence, fallback.publicDataConfidence),
    complianceReadiness: asScoreComponent(record.complianceReadiness, fallback.complianceReadiness),
    locationLogistics: asScoreComponent(record.locationLogistics, fallback.locationLogistics),
    countryPaymentRisk: asScoreComponent(record.countryPaymentRisk, fallback.countryPaymentRisk)
  };
}

function normalizeComparisonCandidates(raw: unknown[] | null, fallback: SupplyMapCandidateTableRow[]): SupplyMapCandidateTableRow[] {
  const sourceRows = raw?.length ? raw.slice(0, 12) : null;
  if (!sourceRows) {
    return fallback.sort((left, right) =>
      (left.candidateType === "DOMESTIC_SUPPLIER" ? 0 : 1) -
        (right.candidateType === "DOMESTIC_SUPPLIER" ? 0 : 1) ||
      right.matchScore - left.matchScore
    );
  }

  return sourceRows.map((value, index) => {
    const record = asRecord(value) ?? {};
    const fallbackRow = fallback[index % Math.max(fallback.length, 1)];
    const sourceType = asSourceType(firstString(record, ["sourceType"], fallbackRow?.sourceType ?? "PRIVATE"), fallbackRow?.sourceType ?? "PRIVATE");
    const candidateType = asCandidateType(
      firstString(record, ["candidateType"], sourceType === "MOTIE_PUBLIC" ? "DOMESTIC_SUPPLIER" : "GLOBAL_FACTORY"),
      sourceType === "MOTIE_PUBLIC" ? "DOMESTIC_SUPPLIER" : "GLOBAL_FACTORY"
    );
    const evidenceIds = Array.isArray(record.evidenceIds)
      ? record.evidenceIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : fallbackRow?.evidenceIds ?? [];

    return {
      id: firstString(record, ["id"], fallbackRow?.id ?? `comparison-${index}`),
      candidateType,
      name: firstString(record, ["name"], fallbackRow?.name ?? "후보 확인 필요"),
      country: firstString(record, ["country", "countryName"], fallbackRow?.country ?? "확인 필요"),
      countryCode: firstString(record, ["countryCode"], fallbackRow?.countryCode ?? ""),
      region: firstString(record, ["region"], fallbackRow?.region ?? ""),
      city: firstString(record, ["city"], fallbackRow?.city ?? ""),
      address: firstString(record, ["address"], fallbackRow?.address ?? ""),
      productText: firstString(record, ["productText", "products"], fallbackRow?.productText ?? "생산품 확인 필요"),
      industrialComplex: firstString(record, ["industrialComplex", "complex"], fallbackRow?.industrialComplex ?? ""),
      matchScore: Math.max(0, Math.min(100, firstNumber(record, ["matchScore", "score"], fallbackRow?.matchScore ?? 0))),
      sourceType,
      sourceName: firstString(record, ["sourceName", "providerName"], fallbackRow?.sourceName ?? "출처 확인 필요"),
      datasetName: firstString(record, ["datasetName"], fallbackRow?.datasetName ?? "데이터셋 확인 필요"),
      verification: asVerificationStatus(firstString(record, ["verification"], fallbackRow?.verification ?? "CHECK_REQUIRED"), fallbackRow?.verification ?? "CHECK_REQUIRED"),
      riskSummary: firstString(record, ["riskSummary"], fallbackRow?.riskSummary ?? "계약 전 원문 확인 필요"),
      scoreBreakdown: normalizeScoreBreakdown(record.scoreBreakdown ?? record.breakdown, fallbackRow?.scoreBreakdown ?? fallbackScoreBreakdown({
        id: `comparison-${index}`,
        scope: candidateType === "DOMESTIC_SUPPLIER" ? "domestic" : "overseas",
        name: firstString(record, ["name"], "후보 확인 필요"),
        region: firstString(record, ["region"], ""),
        complex: firstString(record, ["industrialComplex", "complex"], ""),
        score: firstNumber(record, ["matchScore", "score"], 0),
        capability: firstString(record, ["productText"], "생산품 확인 필요"),
        annualCapacity: "확인 필요",
        leadTime: "확인 필요",
        costIndex: 100,
        risk: "보통",
        dataMatch: firstString(record, ["datasetName"], "데이터셋 확인 필요"),
        sourceType,
        tags: [],
        evidenceIds,
        x: 50,
        y: 50
      })),
      evidenceIds
    };
  }).sort((left, right) =>
    (left.candidateType === "DOMESTIC_SUPPLIER" ? 0 : 1) -
      (right.candidateType === "DOMESTIC_SUPPLIER" ? 0 : 1) ||
    right.matchScore - left.matchScore
  );
}

function normalizeCandidates(raw: unknown[] | null, scope: Layer, fallbacks: Candidate[]) {
  if (!raw?.length) return fallbacks;
  return raw.slice(0, scope === "domestic" ? 6 : 4).map((value, index) => {
    const record = asRecord(value) ?? {};
    const fallback = fallbacks[index % fallbacks.length];
    const nestedScore = asRecord(record.score);
    const apiEvidenceIds = Array.isArray(record.evidenceIds)
      ? record.evidenceIds.filter((id): id is string => typeof id === "string")
      : [];
    const sourceType = asSourceType(
      firstString(record, ["sourceType"], scope === "domestic" ? "MOTIE_PUBLIC" : "PRIVATE"),
      scope === "domestic" ? "MOTIE_PUBLIC" : "PRIVATE"
    );
    const riskText = firstString(record, ["risk", "riskLevel", "risk_level"], fallback.risk);
    const risk: RiskLevel = riskText.includes("높") || riskText.toLowerCase() === "high"
      ? "높음"
      : riskText.includes("낮") || riskText.toLowerCase() === "low"
        ? "낮음"
        : "보통";
    return {
      ...fallback,
      id: firstString(record, ["id", "candidateId", "factoryId"], `${scope}-api-${index}`),
      name: firstString(record, ["name", "candidateName", "factoryName", "clusterName", "title"], fallback.name),
      region: firstString(record, ["region", "location", "address", "city"], fallback.region),
      complex: firstString(record, ["complex", "industrialComplex", "industrialComplexName", "site"], fallback.complex),
      address: firstString(record, ["address", "addressRaw", "addressNormalized"], fallback.address ?? fallback.region),
      products: firstStringArray(record, ["products", "productNames", "productionItems"], fallback.products ?? fallback.tags ?? []),
      matchReason: firstString(record, ["matchReason", "reason"], fallback.matchReason ?? fallback.capability),
      score: Math.max(
        0,
        Math.min(100, nestedScore ? firstNumber(nestedScore, ["total"], fallback.score) : firstNumber(record, ["score", "fitScore", "matchScore"], fallback.score))
      ),
      capability: firstString(record, ["capability", "capabilities", "productionCapability", "matchReason", "reason", "description"], fallback.capability),
      annualCapacity: firstString(record, ["annualCapacity", "capacity", "estimatedCapacity"], fallback.annualCapacity),
      leadTime: firstString(record, ["leadTime", "lead_time", "delivery"], fallback.leadTime),
      costIndex: firstNumber(record, ["costIndex", "cost_index", "relativeCost"], fallback.costIndex),
      risk,
      dataMatch: firstString(record, ["dataMatch", "sourceSummary", "evidenceSummary", "datasetName"], fallback.dataMatch),
      sourceType,
      evidenceIds: apiEvidenceIds.length ? apiEvidenceIds : fallback.evidenceIds
    };
  });
}

function normalizeEvidence(raw: unknown[] | null): SupplyEvidence[] {
  if (!raw?.length) return [];
  return raw.map((value, index) => {
    const record = asRecord(value) ?? {};
    const sourceType = asSourceType(firstString(record, ["sourceType"], "OTHER_PUBLIC"), "OTHER_PUBLIC");
    const scope: Layer = sourceType === "PRIVATE" ? "overseas" : "domestic";
    const verification = firstString(record, ["verification"], "PARTIAL");
    const confidence = verification === "VERIFIED" ? 96 : verification === "MOCK" ? 82 : verification === "PARTIAL" ? 88 : 72;
    const id = firstString(record, ["id"], `API-EVIDENCE-${index + 1}`);
    const provider = firstString(record, ["providerName", "provider"], "공공데이터 제공기관");
    const dataset = firstString(record, ["datasetName", "dataset"], "SupplyMap 분석 근거");
    const snippet = firstString(record, ["snippet", "summary"], "원문 필드 확인 필요");
    const claim = firstString(record, ["claim"], "분석 후보와 연결된 근거 레코드");
    return {
      id,
      citation: `${scope === "domestic" ? "[D" : "[O"}${index + 1}]`,
      title: firstString(record, ["title", "name"], dataset),
      provider,
      dataset,
      recordId: id,
      updatedAt: firstString(record, ["fetchedAt", "updatedAt"], "API 응답 시점"),
      scope,
      sourceType,
      confidence,
      fields: [
        { label: "근거 요약", value: snippet },
        { label: "분석 주장", value: claim },
        { label: "검증 상태", value: verification },
        { label: "출처 유형", value: sourceType }
      ],
      url: firstString(record, ["url", "sourceUrl"], "") || undefined
    };
  });
}

function normalizeRisks(raw: unknown[] | null, fallback: SupplyRisk[]): SupplyRisk[] {
  if (!raw?.length) return fallback;
  return raw.slice(0, 4).map((value, index) => {
    const record = asRecord(value) ?? {};
    const severity = firstString(record, ["severity", "riskLevel"], "MEDIUM").toUpperCase();
    const sourceType = asSourceType(firstString(record, ["sourceType"], "OTHER_PUBLIC"), "OTHER_PUBLIC");
    const evidenceIds = Array.isArray(record.evidenceIds)
      ? record.evidenceIds.filter((id): id is string => typeof id === "string")
      : [];
    return {
      level: severity === "HIGH" ? "높음" : severity === "LOW" ? "낮음" : "보통",
      title: firstString(record, ["title", "name"], fallback[index % fallback.length].title),
      detail: firstString(record, ["summary", "detail", "description"], fallback[index % fallback.length].detail),
      mitigation: firstString(record, ["mitigation", "recommendation"], "원문 확인 후 RFQ 조건에 반영"),
      evidenceId: evidenceIds[0] ?? fallback[index % fallback.length].evidenceId,
      sourceType
    };
  });
}

function normalizeRiskPanelSignals(raw: unknown[] | null, fallback: SupplyRisk[]): SupplyMapRiskPanelSignal[] {
  if (!raw?.length) return fallback.map((risk, index) => riskToPanelSignal(risk, index));
  return raw.slice(0, 10).map((value, index) => {
    const record = asRecord(value) ?? {};
    const id = firstString(record, ["id"], `risk-signal-${index}`);
    const status = firstString(record, ["status"], "확인 필요");
    const sourceType = asSourceType(firstString(record, ["sourceType"], "OTHER_PUBLIC"), "OTHER_PUBLIC");
    const evidenceIds = Array.isArray(record.evidenceIds)
      ? record.evidenceIds.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
    return {
      id,
      kind: asRiskKind(firstString(record, ["kind", "type"], "NEWS"), "NEWS"),
      severity: asRiskSeverity(
        firstString(record, ["severity"], status === "확인 필요" ? "NEEDS_CHECK" : "MEDIUM"),
        status === "확인 필요" ? "NEEDS_CHECK" : "MEDIUM"
      ),
      status,
      title: firstString(record, ["title", "name"], fallback[index % Math.max(fallback.length, 1)]?.title ?? "리스크 확인 필요"),
      summary: firstString(record, ["summary", "detail", "description"], fallback[index % Math.max(fallback.length, 1)]?.detail ?? "원문 확인 필요"),
      scoreImpact: firstNumber(record, ["scoreImpact"], 0),
      providerName: firstString(record, ["providerName", "provider"], "공공데이터 제공기관"),
      datasetName: firstString(record, ["datasetName", "dataset"], "SupplyMap RiskSignal"),
      sourceType,
      evidenceId: evidenceIds[0] ?? `EV-RISK-${id}`
    };
  });
}

function normalizeApiResult(payload: unknown, input: ProductInput): AnalysisResult {
  const fallback = fallbackAnalysis(input, "API 응답을 샘플 데이터로 보강");
  const root = asRecord(payload) ?? {};
  const nested = asRecord(root.analysis) ?? asRecord(root.result) ?? asRecord(root.data) ?? root;
  const domesticRaw = firstArray(nested, ["domesticCandidates", "domestic", "domesticSites", "koreanCandidates"]);
  const overseasRaw = firstArray(nested, ["globalCandidates", "overseasCandidates", "overseas", "overseasFactories", "foreignCandidates"]);
  const comparisonRaw = firstArray(nested, ["comparisonCandidates", "candidates", "candidateComparison"]);
  const riskRaw = firstArray(nested, ["riskSignals", "risks", "riskItems"]);
  const evidenceRaw = firstArray(nested, ["evidence", "evidenceRecords", "sources"]);
  const answerRecord = asRecord(nested.answer);
  const answer = answerRecord
    ? [
        firstString(answerRecord, ["headline"], ""),
        firstString(answerRecord, ["summary"], "")
      ].filter(Boolean).join(" ") || fallback.answer
    : firstString(nested, ["ragAnswer", "answer", "recommendation", "summary", "narrative"], fallback.answer);
  const apiEvidence = normalizeEvidence(evidenceRaw);
  const mergedEvidence = [
    ...apiEvidence,
    ...fallback.evidence.filter((item) => !apiEvidence.some((apiItem) => apiItem.id === item.id))
  ];
  const domestic = normalizeCandidates(domesticRaw, "domestic", fallback.domestic);
  const overseas = normalizeCandidates(overseasRaw, "overseas", fallback.overseas);
  const comparison = normalizeComparisonCandidates(
    comparisonRaw,
    [...domestic, ...overseas].map(candidateToComparisonRow)
  );
  const risks = normalizeRisks(riskRaw, fallback.risks);

  const baseResult: Omit<AnalysisResult, "report"> = {
    ...fallback,
    requestId: firstString(nested, ["requestId", "analysisId", "id"], fallback.requestId),
    analyzedAt: firstString(nested, ["analyzedAt", "generatedAt", "createdAt"], new Date().toLocaleString("ko-KR")),
    dataMode: "api",
    connectionNote: "분석 API 연결 · 누락 필드는 샘플 데이터로 보강",
    domestic,
    overseas,
    comparison,
    risks,
    riskSignals: normalizeRiskPanelSignals(riskRaw, risks),
    answer,
    evidence: mergedEvidence
  };
  return {
    ...baseResult,
    report: reportFromApiPayload(nested) ?? buildWorkbenchReport(input, baseResult)
  };
}

function riskClass(level: RiskLevel) {
  if (level === "높음") return "bg-danger/10 text-danger";
  if (level === "낮음") return "bg-teal/10 text-teal";
  return "bg-amber/10 text-amber";
}

function scoreColor(score: number) {
  if (score >= 85) return "bg-teal";
  if (score >= 75) return "bg-cobalt";
  return "bg-amber";
}

function CandidateRanking({
  candidates,
  selectedId,
  onSelect,
  onEvidence
}: {
  candidates: Candidate[];
  selectedId: string;
  onSelect: (candidate: Candidate) => void;
  onEvidence: (id: string) => void;
}) {
  return (
    <div className="divide-y divide-line">
      {candidates.map((candidate, index) => {
        const selected = selectedId === candidate.id;
        return (
          <button
            key={candidate.id}
            type="button"
            onClick={() => onSelect(candidate)}
            className={`w-full px-4 py-3.5 text-left transition-colors hover:bg-panel ${selected ? "bg-[#eef4fb]" : "bg-white"}`}
          >
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white ${scoreColor(candidate.score)}`}>
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-2">
                  <span className="text-sm font-bold leading-5 text-ink">{candidate.name}</span>
                  <span className="shrink-0 text-base font-bold text-cobalt">{candidate.score}</span>
                </span>
                <span className="mt-1 flex items-center gap-1 text-xs text-muted">
                  <MapPin className="h-3 w-3 shrink-0" /> {candidate.region}
                </span>
                <span className="mt-2 block text-xs leading-5 text-ink">{candidate.matchReason ?? candidate.capability}</span>
                <span className="mt-2 block text-[11px] leading-5 text-muted">
                  {candidate.complex} · {candidate.address ?? candidate.region}
                </span>
                {candidate.products?.length ? (
                  <span className="mt-2 flex flex-wrap gap-1">
                    {candidate.products.slice(0, 3).map((product) => (
                      <span key={product} className="rounded bg-panel px-1.5 py-0.5 text-[10px] text-muted">{product}</span>
                    ))}
                  </span>
                ) : null}
                <span className="mt-2 flex flex-wrap items-center gap-2">
                  <SourceBadge sourceType={sourceTypeForCandidate(candidate)} compact />
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${riskClass(candidate.risk)}`}>리스크 {candidate.risk}</span>
                  <span
                    role="link"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      onEvidence(candidate.evidenceIds[0]);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        onEvidence(candidate.evidenceIds[0]);
                      }
                    }}
                    className="font-mono text-[10px] font-bold text-cobalt hover:underline"
                  >
                    근거 {candidate.evidenceIds.length}개
                  </span>
                </span>
              </span>
              <ChevronRight className={`mt-1 h-4 w-4 shrink-0 ${selected ? "text-cobalt" : "text-line"}`} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DecisionSummary({
  analysis,
  domesticAverage,
  overseasAverage,
  highRiskCount,
  onEvidence
}: {
  analysis: AnalysisResult;
  domesticAverage: number;
  overseasAverage: number;
  highRiskCount: number;
  onEvidence: (id: string) => void;
}) {
  const topDomestic = analysis.domestic[0];
  const scoreDelta = domesticAverage - overseasAverage;
  const topOverseas = analysis.overseas[0];
  const evidenceId = topDomestic?.evidenceIds[0];

  return (
    <article className="mt-5 overflow-hidden border border-teal/25 bg-white shadow-soft" aria-label="SupplyMap AI 핵심 결론">
      <div className="grid gap-px bg-line lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(130px,0.65fr))]">
        <div className="bg-[#edf8f6] p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-teal px-2 py-0.5 text-[10px] font-bold text-white">비교 액션</span>
            <SourceBadge sourceType="MOTIE_PUBLIC" compact />
          </div>
          <h3 className="mt-3 text-lg font-bold leading-7 text-ink">
            {topDomestic && topOverseas ? `${topDomestic.name}와 ${topOverseas.name}를 비교하세요` : "한국·중국 후보 확인 필요"}
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            국내 공장은 공공데이터 근거가 상세하고, 중국 베타 공장은 해외 후보 탐색과 가격·물량 벤치마크에 활용합니다.
          </p>
          {evidenceId ? (
            <button
              type="button"
              onClick={() => onEvidence(evidenceId)}
              className="mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-md bg-white px-3 text-xs font-bold text-cobalt shadow-sm hover:bg-panel"
            >
              핵심 근거 보기 <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        {[
          ["국내 후보", `${analysis.domestic.length}곳`, topDomestic?.region ?? "전국"],
          ["중국/해외 후보", `${analysis.overseas.length}곳`, topOverseas?.region ?? "확인 필요"],
          ["평균 차이", `${scoreDelta >= 0 ? "+" : ""}${scoreDelta}점`, `국내 ${domesticAverage} · 해외 ${overseasAverage}`],
          ["핵심 리스크", `${highRiskCount}건`, "확인 필요 항목 표시"]
        ].map(([label, value, detail]) => (
          <div key={label} className="bg-white p-5">
            <p className="text-[11px] font-bold text-muted">{label}</p>
            <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
            <p className="mt-2 text-[11px] leading-5 text-muted">{detail}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

export function SupplyMapWorkbench() {
  const [input, setInput] = useState<ProductInput>(SAMPLE_INPUT);
  const [analysis, setAnalysis] = useState<AnalysisResult>(() => fallbackAnalysis(SAMPLE_INPUT));
  const [selectedId, setSelectedId] = useState("domestic-ansan");
  const [activeTab, setActiveTab] = useState<ViewTab>("overview");
  const [demoMode, setDemoMode] = useState(true);
  const [currentStep, setCurrentStep] = useState(2);
  const [analyzing, setAnalyzing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState(defaultEvidence[0].id);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedCandidate = useMemo(
    () => analysis.domestic.find((candidate) => candidate.id === selectedId) ?? analysis.domestic[0],
    [analysis, selectedId]
  );
  const selectedComparison = useMemo(
    () =>
      analysis.comparison.find((candidate) => candidate.id === selectedId) ??
      analysis.comparison.find((candidate) => candidate.id === selectedCandidate?.id) ??
      analysis.comparison[0],
    [analysis.comparison, selectedCandidate?.id, selectedId]
  );

  function openEvidence(id: string) {
    setSelectedEvidenceId(id);
    setDrawerOpen(true);
    setCurrentStep(3);
  }

  function selectCandidate(candidate: Candidate) {
    setSelectedId(candidate.id);
  }

  function startJudgeDemo(product: ProductInput = SAMPLE_INPUT) {
    setInput(product);
    setSelectedId("domestic-ansan");
    setActiveTab("overview");
    setDemoMode(true);
    setCurrentStep(1);
    setNotice(`${product.productName} 샘플 분석을 실행합니다.`);
    void runAnalysis(product, true);
  }

  function loadSample() {
    startJudgeDemo(SAMPLE_INPUT);
  }

  function togglePriority(priority: string) {
    setInput((current) => ({
      ...current,
      priorities: current.priorities.includes(priority)
        ? current.priorities.filter((item) => item !== priority)
        : [...current.priorities, priority]
    }));
  }

  async function runAnalysis(targetInput: ProductInput = input, forceDemoMode = demoMode) {
    if (!targetInput.productName.trim()) {
      setNotice("제품명을 입력해 주세요.");
      return;
    }

    setAnalyzing(true);
    setNotice(null);
    setCurrentStep(2);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), forceDemoMode ? 1400 : 5000);

    try {
      const response = await fetch("/api/supplymap/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productName: targetInput.productName,
          hsCode: targetInput.hsCode?.trim() || undefined,
          importCountry: targetInput.importCountry?.trim() || undefined,
          preferredRegion: targetInput.preferredRegion?.trim() || undefined,
          query: `${targetInput.productName} · ${targetInput.industry} · 연간 ${Number(targetInput.annualDemand) || 0}개 · ${targetInput.priorities.join(", ")}`,
          judgeDemo: forceDemoMode,
          mode: forceDemoMode ? "mock" : "hybrid",
          useDeepSeek: false
        }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`API ${response.status}`);
      const payload: unknown = await response.json();
      const normalized = normalizeApiResult(payload, targetInput);
      setAnalysis(normalized);
      setSelectedId(normalized.domestic[0]?.id ?? normalized.overseas[0]?.id ?? "");
      setNotice("공공데이터 분석 API 결과를 반영했습니다.");
    } catch {
      const fallback = fallbackAnalysis(targetInput, "API 지연 · 안정형 로컬 분석으로 전환");
      setAnalysis(fallback);
      setSelectedId(fallback.domestic[0]?.id ?? "");
      setNotice("안정형 로컬 분석으로 즉시 전환했습니다.");
    } finally {
      window.clearTimeout(timeout);
      setActiveTab("overview");
      setAnalyzing(false);
    }
  }

  useEffect(() => {
    void runAnalysis();
    // Initial demo hydration should run once with the bundled sample input.
    // Subsequent analysis is user-driven through the form submit button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function copySummary() {
    const summary = `SupplyMap AI 분석 요약\n제품: ${input.productName}\n추천: ${analysis.domestic[0]?.name}\n적합도: ${analysis.domestic[0]?.score}점\n\n${analysis.answer}`;
    try {
      await navigator.clipboard.writeText(summary);
      setNotice("분석 요약을 클립보드에 복사했습니다.");
    } catch {
      setNotice("브라우저에서 클립보드 권한을 확인해 주세요.");
    }
  }

  function downloadReport() {
    const report = JSON.stringify(analysis.report, null, 2);
    const href = URL.createObjectURL(new Blob([report], { type: "application/json;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "supplymap-report-preview.json";
    anchor.click();
    URL.revokeObjectURL(href);
    setNotice("리포트 JSON 미리보기를 생성했습니다.");
  }

  const domesticAverage = analysis.domestic.length
    ? Math.round(analysis.domestic.reduce((sum, candidate) => sum + candidate.score, 0) / analysis.domestic.length)
    : 0;
  const overseasAverage = analysis.overseas.length
    ? Math.round(analysis.overseas.reduce((sum, candidate) => sum + candidate.score, 0) / analysis.overseas.length)
    : 0;
  const highRiskCount = analysis.risks.filter((risk) => risk.level === "높음").length;

  return (
    <>
      <JudgeDemoBanner
        enabled={demoMode}
        currentStep={currentStep}
        onEnabledChange={setDemoMode}
        onLoadSample={loadSample}
      />

      {notice ? (
        <div className="mb-4 flex items-center justify-between gap-3 border-l-4 border-cobalt bg-[#eef4fb] px-4 py-2.5 text-xs text-ink" role="status">
          <span className="flex items-center gap-2"><Info className="h-4 w-4 text-cobalt" /> {notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="font-semibold text-muted hover:text-ink" aria-label="알림 닫기">닫기</button>
        </div>
      ) : null}

      <section id="supplymap-judge-demo" className="mb-5 border border-cobalt/20 bg-[#f7fbff] p-4 shadow-soft" aria-labelledby="judge-demo-title">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles className="h-4 w-4 text-cobalt" />
              <h2 id="judge-demo-title" className="text-base font-bold text-ink">빠른 샘플 분석</h2>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-cobalt">API key 없이 실행</span>
            </div>
            <p className="mt-2 text-lg font-bold leading-7 text-ink">한국 공장과 중국 베타 공장을 같은 품목 기준으로 비교하세요</p>
            <p className="mt-1 text-sm leading-6 text-muted">공공데이터 기반 공장 탐색·수입 리스크 분석·무역 AI 코파일럿</p>
            <p className="mt-1 text-xs leading-5 text-muted">국내 공장은 상세 근거 중심으로, 중국 베타 공장은 해외 후보 탐색용으로 구분해 제공합니다.</p>
          </div>
          <button
            type="button"
            onClick={() => startJudgeDemo(SAMPLE_INPUT)}
            disabled={analyzing}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-cobalt px-5 text-sm font-bold text-white hover:bg-[#1d4788] disabled:cursor-wait disabled:opacity-70"
          >
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            샘플 분석 시작
          </button>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {JUDGE_DEMO_PRODUCTS.map((product) => (
            <button
              key={product.productName}
              type="button"
              onClick={() => startJudgeDemo(product)}
              disabled={analyzing}
              className={`min-h-10 shrink-0 rounded-md border px-3 text-xs font-bold transition-colors ${
                input.productName === product.productName
                  ? "border-cobalt bg-white text-cobalt shadow-sm"
                  : "border-line bg-white text-ink hover:bg-panel"
              }`}
            >
              {product.productName}
            </button>
          ))}
        </div>
      </section>

      <section className="border border-line bg-white shadow-soft" aria-labelledby="analysis-form-title">
        <div className="border-b border-line px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <PackageSearch className="h-5 w-5 text-cobalt" />
                <h2 id="analysis-form-title" className="text-base font-bold text-ink">제품 기반 공급망 탐색</h2>
              </div>
              <p className="mt-1 text-xs text-muted">제품명과 HS 코드 기준으로 국내 공장과 중국 베타 공장을 함께 탐색합니다.</p>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-muted">
              <span className="h-2 w-2 rounded-full bg-teal" /> 국내 공공데이터 + 중국 베타
            </div>
          </div>
        </div>

        <form
          className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(260px,1.5fr)_minmax(140px,0.65fr)_minmax(140px,0.65fr)_minmax(180px,0.8fr)_auto] lg:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            void runAnalysis();
          }}
        >
          <label className="block min-w-0">
            <span className="mb-1.5 block text-xs font-bold text-ink">제품명 / 핵심 부품</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={input.productName}
                onChange={(event) => setInput((current) => ({ ...current, productName: event.target.value }))}
                className="h-11 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm outline-none transition focus:border-cobalt focus:ring-2 focus:ring-cobalt/10"
                placeholder="예: 배터리 냉각판"
              />
            </span>
          </label>

          <label className="block min-w-0">
            <span className="mb-1.5 block text-xs font-bold text-ink">HS 코드 후보</span>
            <input
              value={input.hsCode ?? ""}
              onChange={(event) => setInput((current) => ({ ...current, hsCode: event.target.value.replace(/\D/g, "").slice(0, 10) }))}
              className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm outline-none transition focus:border-cobalt focus:ring-2 focus:ring-cobalt/10"
              placeholder="예: 392330"
              inputMode="numeric"
            />
          </label>

          <label className="block min-w-0">
            <span className="mb-1.5 block text-xs font-bold text-ink">수입 희망 국가</span>
            <select
              value={input.importCountry ?? "CN"}
              onChange={(event) => setInput((current) => ({ ...current, importCountry: event.target.value }))}
              className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/10"
            >
              <option value="CN">중국</option>
              <option value="VN">베트남</option>
              <option value="JP">일본</option>
              <option value="PL">폴란드</option>
              <option value="US">미국</option>
            </select>
          </label>

          <label className="block min-w-0">
            <span className="mb-1.5 block text-xs font-bold text-ink">국내 희망 권역</span>
            <input
              value={input.preferredRegion ?? ""}
              onChange={(event) => setInput((current) => ({ ...current, preferredRegion: event.target.value }))}
              className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm outline-none transition focus:border-cobalt focus:ring-2 focus:ring-cobalt/10"
              placeholder="예: 경기, 충북, 대전"
            />
          </label>

          <button
            type="submit"
            disabled={analyzing}
            className="inline-flex h-11 min-w-32 items-center justify-center gap-2 rounded-md bg-cobalt px-5 text-sm font-bold text-white transition-colors hover:bg-[#1d4788] disabled:cursor-wait disabled:opacity-70"
          >
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {analyzing ? "분석 중" : "AI 분석"}
          </button>

          <details className="rounded-md border border-line bg-panel/50 lg:col-span-5">
            <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-muted hover:text-ink">
              고급 조건: 산업군, 수요량, 조달 우선순위
            </summary>
            <div className="grid gap-4 border-t border-line bg-white p-3 sm:grid-cols-2 xl:grid-cols-[180px_180px_minmax(0,1fr)]">
              <label className="block min-w-0">
                <span className="mb-1.5 block text-xs font-bold text-ink">산업군</span>
                <select
                  value={input.industry}
                  onChange={(event) => setInput((current) => ({ ...current, industry: event.target.value }))}
                  className="h-10 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/10"
                >
                  <option>미래차·이차전지</option>
                  <option>반도체·디스플레이</option>
                  <option>바이오·헬스</option>
                  <option>기계·로봇</option>
                  <option>소재·화학</option>
                </select>
              </label>

              <label className="block min-w-0">
                <span className="mb-1.5 block text-xs font-bold text-ink">연간 수요량</span>
                <span className="relative block">
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={input.annualDemand}
                    onChange={(event) => setInput((current) => ({ ...current, annualDemand: event.target.value }))}
                    className="h-10 w-full rounded-md border border-line bg-white px-3 pr-9 text-sm outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/10"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">개</span>
                </span>
              </label>

              <fieldset className="min-w-0">
                <legend className="mb-1.5 text-xs font-bold text-ink">조달 우선순위</legend>
                <div className="flex min-h-10 items-center gap-3 overflow-x-auto rounded-md border border-line px-3">
                  {priorityOptions.map((priority) => (
                    <label key={priority} className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs font-medium text-ink">
                      <input
                        type="checkbox"
                        checked={input.priorities.includes(priority)}
                        onChange={() => togglePriority(priority)}
                        className="h-3.5 w-3.5 accent-[#2457a6]"
                      />
                      {priority}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </details>
        </form>
      </section>

      <section className="mt-5" aria-labelledby="analysis-result-title">
        <div className="flex flex-col gap-4 border-b border-line pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="analysis-result-title" className="text-xl font-bold text-ink">분석 결과</h2>
              <span className="rounded-full bg-teal/10 px-2.5 py-1 text-[11px] font-bold text-teal">KR/CN 비교</span>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${analysis.dataMode === "api" ? "bg-cobalt/10 text-cobalt" : "bg-panel text-muted"}`}>
                {analysis.dataMode === "api" ? "API 연결" : "Mock 안정 모드"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">{analysis.connectionNote} · 분석 ID {analysis.requestId}</p>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto rounded-md bg-[#e8edf1] p-1" role="tablist" aria-label="분석 결과 보기">
            {[
              ["overview", "추천·지도", Map],
              ["comparison", "후보 비교", BarChart3],
              ["report", "보고서", FileText]
            ].map(([value, label, Icon]) => {
              const TabIcon = Icon as typeof Map;
              return (
                <button
                  key={String(value)}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === value}
                  onClick={() => {
                    setActiveTab(value as ViewTab);
                    if (value === "report") setCurrentStep(3);
                  }}
                  className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded px-3 py-1.5 text-xs font-bold ${
                    activeTab === value ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
                  }`}
                >
                  <TabIcon className="h-3.5 w-3.5" /> {String(label)}
                </button>
              );
            })}
          </div>
        </div>

        <DecisionSummary
          analysis={analysis}
          domesticAverage={domesticAverage}
          overseasAverage={overseasAverage}
          highRiskCount={highRiskCount}
          onEvidence={openEvidence}
        />

        {activeTab === "overview" ? (
          <div className="mt-5 space-y-5">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,0.75fr)]">
              <div className="space-y-5">
                <article className="overflow-hidden border border-line bg-white shadow-soft">
                  <header className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-cobalt" />
                      <h3 className="text-sm font-bold text-ink">국내 공장 지도</h3>
                    </div>
                    <span className="inline-flex min-h-8 w-fit items-center gap-1.5 rounded-md bg-teal/10 px-3 text-xs font-bold text-teal">
                      <Factory className="h-3.5 w-3.5" /> 카테고리별 국내 공장
                    </span>
                  </header>
                  <KakaoDomesticHeatmap
                    productName={input.productName}
                    hsCode={input.hsCode}
                    analysisCandidates={analysis.domestic.map((candidate) => ({
                      id: candidate.id,
                      name: candidate.name,
                      products: candidate.products,
                      score: candidate.score
                    }))}
                  />

                  {selectedCandidate ? (
                    <div className="grid gap-4 border-t border-line bg-white px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${selectedCandidate.scope === "domestic" ? "bg-teal/10 text-teal" : "bg-amber/10 text-amber"}`}>
                            {selectedCandidate.scope === "domestic" ? "국내 산업단지/공장" : "중국/해외 베타"}
                          </span>
                          <SourceBadge sourceType={sourceTypeForCandidate(selectedCandidate)} compact />
                          <h4 className="text-sm font-bold text-ink">{selectedCandidate.name}</h4>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-muted">
                          {selectedCandidate.complex} · {selectedCandidate.address ?? selectedCandidate.region}
                        </p>
                        <p className="mt-2 text-xs leading-5 text-ink">{selectedCandidate.matchReason ?? selectedCandidate.capability}</p>
                        {selectedCandidate.products?.length ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {selectedCandidate.products.slice(0, 5).map((product) => (
                              <span key={product} className="rounded border border-line bg-panel px-2 py-0.5 text-[11px] text-muted">{product}</span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs">
                        <span><b className="text-ink">{selectedCandidate.leadTime}</b><span className="ml-1 text-muted">납기</span></span>
                        <span><b className="text-ink">{selectedCandidate.annualCapacity}</b><span className="ml-1 text-muted">생산능력</span></span>
                        <button
                          type="button"
                          onClick={() => openEvidence(selectedCandidate.evidenceIds[0])}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 font-bold text-cobalt hover:bg-panel"
                        >
                          근거 보기 <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              </div>

              <article className="overflow-hidden border border-line bg-white shadow-soft">
                <header className="flex items-center justify-between border-b border-line px-4 py-3">
                  <div>
                    <h3 className="text-sm font-bold text-ink">국내 추천 순위</h3>
                    <p className="mt-0.5 text-[11px] text-muted">적합도 · 리스크 · 공공데이터 근거</p>
                  </div>
                  <span className="font-mono text-[11px] font-bold text-muted">FIT / 100</span>
                </header>
                <CandidateRanking candidates={analysis.domestic} selectedId={selectedId} onSelect={selectCandidate} onEvidence={openEvidence} />
              </article>
            </div>

            <ChinaFactoryBetaHeatmap productName={input.productName} />

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
              <article className="border border-line bg-white shadow-soft">
                <header className="flex flex-col gap-2 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-cobalt" />
                    <h3 className="text-sm font-bold text-ink">AI 조달 권고</h3>
                    <span className="rounded-full bg-[#eef4fb] px-2 py-0.5 text-[10px] font-bold text-cobalt">RAG</span>
                  </div>
                  <button type="button" onClick={() => openEvidence("ev-kicox-ansan")} className="inline-flex items-center gap-1.5 text-xs font-bold text-cobalt hover:underline">
                    <Database className="h-3.5 w-3.5" /> 전체 근거 {analysis.evidence.length}개
                  </button>
                </header>
                <div className="p-5">
                  <p className="text-sm leading-7 text-ink">{analysis.answer}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {analysis.evidence.slice(0, 4).map((evidence) => (
                      <button
                        key={evidence.id}
                        type="button"
                        onClick={() => openEvidence(evidence.id)}
                        className="inline-flex items-center gap-1.5 rounded border border-line px-2 py-1 font-mono text-[10px] font-bold text-ink hover:bg-panel"
                        title={evidence.title}
                      >
                        <SourceBadge sourceType={evidence.sourceType ?? (evidence.scope === "domestic" ? "MOTIE_PUBLIC" : "PRIVATE")} compact />
                        {evidence.citation} {evidence.provider.split("(")[0]}
                      </button>
                    ))}
                  </div>
                </div>
              </article>

              <SupplyMapRiskPanel
                signals={analysis.riskSignals}
                selectedName={selectedComparison?.name}
                selectedScore={selectedComparison?.matchScore}
                scoreBreakdown={selectedComparison?.scoreBreakdown}
                onEvidence={openEvidence}
              />
            </div>
          </div>
        ) : null}

        {activeTab === "comparison" ? (
          <div className="mt-5 space-y-5">
            <SupplyMapCandidateTable rows={analysis.comparison} onEvidence={openEvidence} />

            <div className="grid gap-5 md:grid-cols-3">
              {[
                { icon: Truck, title: "납기", value: "국내 7~12일", note: "중국/해외 후보는 운송·통관 기간 확인", color: "text-cobalt" },
                { icon: ShieldCheck, title: "회복탄력성", value: "KR/CN 분산 검토", note: "국내 권역 + 중국 베타 후보 비교", color: "text-teal" },
                { icon: ArrowDown, title: "비용", value: "중국 후보 벤치마크", note: "재고·통관비 포함 재검증 필요", color: "text-amber" }
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="border border-line bg-white p-5 shadow-soft">
                    <Icon className={`h-5 w-5 ${item.color}`} />
                    <p className="mt-4 text-xs font-semibold text-muted">{item.title}</p>
                    <h4 className="mt-1 text-lg font-bold text-ink">{item.value}</h4>
                    <p className="mt-2 text-xs text-muted">{item.note}</p>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}

        {activeTab === "report" ? (
          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_290px]">
            <SupplyMapReportPreview
              report={analysis.report}
              onEvidence={openEvidence}
              onCopy={() => void copySummary()}
              onDownload={downloadReport}
            />

            <aside className="space-y-4">
              <div className="border border-line bg-white p-4 shadow-soft">
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-teal" /><h3 className="text-sm font-bold text-ink">보고서 준비 완료</h3></div>
                <dl className="mt-4 space-y-3 text-xs">
                  <div className="flex justify-between gap-3"><dt className="text-muted">국내 후보</dt><dd className="font-bold text-ink">{analysis.domestic.length}곳</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted">근거 레코드</dt><dd className="font-bold text-ink">{analysis.evidence.length}건</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted">리스크</dt><dd className="font-bold text-ink">{analysis.risks.length}건</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted">데이터 모드</dt><dd className="font-bold text-ink">{analysis.dataMode === "api" ? "API" : "Mock"}</dd></div>
                </dl>
              </div>
              <div className="border border-line bg-white p-4 shadow-soft">
                <h3 className="text-sm font-bold text-ink">출처 구성</h3>
                <div className="mt-3 space-y-2">
                  {analysis.report.sourceSummary.slice(0, 6).map((source) => (
                    <button
                      key={source.id}
                      type="button"
                      onClick={() => openEvidence(analysis.report.evidence.find((item) => item.providerName === source.providerName && item.datasetName === source.datasetName)?.id ?? analysis.evidence[0]?.id)}
                      className="block w-full border-t border-line py-2 text-left"
                    >
                      <span className="flex items-center gap-2">
                        <SourceBadge sourceType={source.sourceType} compact />
                        <span className="text-xs font-bold text-ink">{source.providerName}</span>
                      </span>
                      <span className="mt-1 block text-[11px] leading-5 text-muted">{source.datasetName} · {source.evidenceCount}건</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="border border-[#d7b24c] bg-[#fff9e8] p-4">
                <div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-amber" /><h3 className="text-sm font-bold text-ink">검토 유의사항</h3></div>
                <p className="mt-2 text-xs leading-5 text-[#735f2c]">{analysis.report.advisory}</p>
              </div>
            </aside>
          </div>
        ) : null}
      </section>

      <SupplyMapCopilot
        productName={input.productName}
        hsCode={input.hsCode}
        analysisId={analysis.requestId}
        country={input.importCountry ?? "CN"}
        preferredRegion={input.preferredRegion ?? analysis.domestic[0]?.region}
      />

      <EvidenceDrawer
        open={drawerOpen}
        evidence={analysis.evidence}
        selectedId={selectedEvidenceId}
        onSelect={setSelectedEvidenceId}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}
