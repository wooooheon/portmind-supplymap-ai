export type SupplySourceType = "MOTIE_PUBLIC" | "OTHER_PUBLIC" | "PRIVATE" | "USER_UPLOAD";
export type VerificationStatus = "VERIFIED" | "PARTIAL" | "CHECK_REQUIRED" | "MOCK";
export type SupplierScope = "DOMESTIC" | "GLOBAL";
export type RiskSignalKind =
  | "CERTIFICATION"
  | "RECALL"
  | "CUSTOMS"
  | "COUNTRY"
  | "PAYMENT"
  | "NEWS"
  | "STRATEGIC_GOODS"
  | "COUNTRY_RISK"
  | "MARKET"
  | "TRADE_SECURITY";

export type Provenance = {
  providerName: string;
  datasetName: string;
  sourceType: SupplySourceType;
  sourceUrl: string;
  fetchedAt: string;
  license: string;
  verification: VerificationStatus;
};

export type SupplyDataSourceRecord = Provenance & {
  code: string;
  description: string;
  status: "connected" | "mock" | "planned";
  updateCycle: string;
  role: string;
};

export type ProductIntent = {
  query: string;
  keywords: string[];
  category: string;
  hsCode?: string;
  hsCodeCandidates: string[];
  importCountry?: string;
  preferredRegion?: string;
};

export type IndustrialComplexSummary = Provenance & {
  id: string;
  code: string;
  name: string;
  region: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  industries: string[];
  tenantCount?: number;
  operatingCount?: number;
  operationRate?: number;
  exportAmount?: number;
  employeeCount?: number;
  matchReason: string;
};

export type CandidateScore = {
  productFit: number;
  publicVerification: number;
  complianceReadiness: number;
  logisticsFit: number;
  countryTransactionRisk: number;
  total: number;
  status: "추천" | "비교 검토" | "확인 필요";
  totalScore?: number;
  breakdown?: CandidateScoreBreakdown;
  decisionSupportLabel?: string;
  riskSummary?: string;
};

export type CandidateScoreComponent = {
  score: number;
  maxScore: number;
  reason: string;
  status: "확인" | "주의" | "확인 필요";
};

export type CandidateScoreBreakdown = {
  productFit: CandidateScoreComponent;
  publicDataConfidence: CandidateScoreComponent;
  complianceReadiness: CandidateScoreComponent;
  locationLogistics: CandidateScoreComponent;
  countryPaymentRisk: CandidateScoreComponent;
};

export type SupplierCandidate = Provenance & {
  id: string;
  name: string;
  scope: SupplierScope;
  countryCode: string;
  countryName: string;
  region?: string;
  city?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  products: string[];
  hsCodes: string[];
  industrialComplex?: string;
  description: string;
  matchReason: string;
  score?: CandidateScore;
};

export type SupplyMapCandidateType = "DOMESTIC_SUPPLIER" | "GLOBAL_FACTORY";

export type SupplyMapComparableCandidate = {
  id: string;
  candidateType: SupplyMapCandidateType;
  name: string;
  country: string;
  countryCode: string;
  region?: string;
  city?: string;
  address?: string;
  productText: string;
  industrialComplex?: string;
  matchScore: number;
  sourceType: SupplySourceType;
  sourceName: string;
  datasetName: string;
  verification: VerificationStatus;
  riskSummary: string;
  scoreBreakdown?: CandidateScoreBreakdown;
  evidenceIds: string[];
  latitude?: number;
  longitude?: number;
};

export type RiskSignalRecord = Provenance & {
  id: string;
  kind: RiskSignalKind;
  severity: "LOW" | "MEDIUM" | "HIGH" | "NEEDS_CHECK" | "UNKNOWN";
  status: "확인" | "주의" | "확인 필요";
  title: string;
  summary: string;
  scoreImpact: number;
  hsCode?: string;
  supplierId?: string;
};

export type EvidenceRecord = Provenance & {
  id: string;
  title: string;
  snippet: string;
  claim?: string;
  url?: string;
};

export type GroundedAnswerSection = {
  title: string;
  body: string;
  evidenceIds: string[];
};

export type ScoreSummary = {
  domesticAverage: number | null;
  globalAverage: number | null;
  recommendation: string;
  methodology: string;
};

export type SupplyMapAnalysisRequest = {
  productName: string;
  hsCode?: string;
  importCountry?: string;
  preferredRegion?: string;
  judgeDemo?: boolean;
};

export type SupplyMapAnalysisResponse = {
  analysisId: string;
  generatedAt: string;
  demoMode: boolean;
  intent: ProductIntent;
  domesticCandidates: SupplierCandidate[];
  globalCandidates: SupplierCandidate[];
  comparisonCandidates: SupplyMapComparableCandidate[];
  industrialComplexes: IndustrialComplexSummary[];
  riskSignals: RiskSignalRecord[];
  scoreSummary: ScoreSummary;
  answer: {
    headline: string;
    summary: string;
    sections: GroundedAnswerSection[];
    model: string;
    grounded: true;
  };
  evidence: EvidenceRecord[];
  dataSourceCounts: Record<SupplySourceType, number>;
  notices: string[];
};
