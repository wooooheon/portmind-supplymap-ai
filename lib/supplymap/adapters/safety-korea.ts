import { supplySource } from "@/lib/supplymap/data-sources";
import type { ProductIntent, Provenance, RiskSignalRecord, SupplyDataSourceRecord } from "@/lib/supplymap/types";

export type SafetyKoreaCertificationRecord = {
  certUid?: string | number;
  certOrganName?: string | null;
  certNum?: string | null;
  certState?: string | null;
  certDiv?: string | null;
  certDate?: string | null;
  firstCertNum?: string | null;
  productName?: string | null;
  brandName?: string | null;
  modelName?: string | null;
  categoryName?: string | null;
  importDiv?: string | null;
  makerName?: string | null;
  makerCntryName?: string | null;
  importerName?: string | null;
  remark?: string | null;
  signDate?: string | null;
};

export type SafetyKoreaRecallRecord = {
  recallUid?: string | number;
  recallProductName?: string | null;
  recallBrandName?: string | null;
  recallModelName?: string | null;
  recallTypeName?: string | null;
  recallMeans?: string | null;
  barcodeNum?: string | null;
  categoryName?: string | null;
  certNum?: string | null;
  productItemName?: string | null;
  recallCmpnyDivName?: string | null;
  recallCmpnyName?: string | null;
  recallFrgnCmpnyName?: string | null;
  makerCntryName?: string | null;
  makerName?: string | null;
  makingCntryName?: string | null;
  publishDate?: string | null;
  harmDscr?: string | null;
  accidentCaseDscr?: string | null;
  publishActionDscr?: string | null;
};

export type SafetyKoreaForeignRecallRecord = {
  fRecallUid?: string | number;
  recallModelName?: string | null;
  recallProductName?: string | null;
  recallBrandName?: string | null;
  makerName?: string | null;
  makingCntryName?: string | null;
  recallTypeName?: string | null;
  recallPblshCntryName?: string | null;
  recallPblshOrgnName?: string | null;
  recallMeans?: string | null;
  violateDscr?: string | null;
  accidentCaseDscr?: string | null;
  publishActionDscr?: string | null;
  recallProductDscr?: string | null;
  recallUrl?: string | null;
  publishDate?: string | null;
  signDttm?: string | null;
  imageUrl?: string | null;
};

export type SafetyKoreaBundle = {
  term: string;
  certificationRecords: SafetyKoreaCertificationRecord[];
  domesticRecallRecords: SafetyKoreaRecallRecord[];
  foreignRecallRecords: SafetyKoreaForeignRecallRecord[];
  fetchedAt: string;
};

export type FetchSafetyKoreaBundleOptions = {
  apiKey?: string;
  term: string;
  timeoutMs?: number;
};

type SafetyKoreaAdapterOptions = {
  forceMock?: boolean;
  limit?: number;
};

type RawObject = Record<string, unknown>;

const SOURCE_CODE = "safety_korea";
const source = supplySource(SOURCE_CODE);
const DEFAULT_BASE_URL = "http://www.safetykorea.kr/openapi/api";

function provenance(sourceRecord: SupplyDataSourceRecord, verification?: Provenance["verification"]): Provenance {
  return {
    providerName: sourceRecord.providerName,
    datasetName: sourceRecord.datasetName,
    sourceType: sourceRecord.sourceType,
    sourceUrl: sourceRecord.sourceUrl,
    fetchedAt: new Date().toISOString(),
    license: sourceRecord.license,
    verification: verification ?? (sourceRecord.verification === "MOCK" ? "PARTIAL" : sourceRecord.verification)
  };
}

function apiKeyFromEnv(): string | undefined {
  return process.env.SAFETY_KOREA_API_KEY || process.env.KATS_SAFETY_KOREA_API_KEY;
}

function cleanText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const cleaned = value.replace(/\s+/g, " ").trim();
    return cleaned || undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function normalizeRecord<T extends RawObject>(record: RawObject): T {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, cleanText(value) ?? value])) as T;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function resultDataArray<T extends RawObject>(payload: unknown): T[] {
  const root = payload && typeof payload === "object" ? (payload as RawObject) : {};
  return asArray(root.resultData as RawObject | RawObject[] | undefined)
    .filter((item): item is RawObject => Boolean(item && typeof item === "object"))
    .map((item) => normalizeRecord<T>(item));
}

function resultCode(payload: unknown): string {
  const root = payload && typeof payload === "object" ? (payload as RawObject) : {};
  return String(root.resultCode ?? "");
}

function resultMsg(payload: unknown): string {
  const root = payload && typeof payload === "object" ? (payload as RawObject) : {};
  return String(root.resultMsg ?? "");
}

async function safetyKoreaGet(path: string, params: Record<string, string>, options: { apiKey: string; timeoutMs: number }) {
  const url = new URL(`${DEFAULT_BASE_URL}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: {
      AuthKey: options.apiKey,
      Accept: "application/json"
    },
    signal: AbortSignal.timeout(options.timeoutMs)
  });
  if (!response.ok) throw new Error(`Safety Korea HTTP ${response.status}`);
  const text = await response.text();
  const payload = JSON.parse(text) as unknown;
  const code = resultCode(payload);
  if (code === "2004") return {};
  if (code && code !== "2000") {
    throw new Error(`Safety Korea resultCode=${code} ${resultMsg(payload)}`);
  }
  return payload;
}

export async function fetchSafetyKoreaBundle(options: FetchSafetyKoreaBundleOptions): Promise<SafetyKoreaBundle> {
  const apiKey = options.apiKey || apiKeyFromEnv();
  if (!apiKey) throw new Error("SAFETY_KOREA_API_KEY가 없습니다.");
  const term = options.term.trim();
  if (!term) throw new Error("Safety Korea 검색어가 필요합니다.");
  const timeoutMs = options.timeoutMs ?? 18000;

  const [certifications, domesticRecalls, foreignRecalls] = await Promise.all([
    safetyKoreaGet("cert/certificationList.json", { conditionKey: "productName", conditionValue: term }, { apiKey, timeoutMs }),
    safetyKoreaGet("recall/recallList.json", { conditionKey: "recallProductName", conditionValue: term }, { apiKey, timeoutMs }),
    safetyKoreaGet("recall/fRecallList.json", { conditionKey: "recallProductName", conditionValue: term }, { apiKey, timeoutMs })
  ]);

  return {
    term,
    certificationRecords: resultDataArray<SafetyKoreaCertificationRecord>(certifications),
    domesticRecallRecords: resultDataArray<SafetyKoreaRecallRecord>(domesticRecalls),
    foreignRecallRecords: resultDataArray<SafetyKoreaForeignRecallRecord>(foreignRecalls),
    fetchedAt: new Date().toISOString()
  };
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function uniqueJoin(values: Array<string | null | undefined>, separator = ", ", limit = 6): string {
  return Array.from(new Set(values.map((value) => cleanText(value)).filter(Boolean) as string[]))
    .slice(0, limit)
    .join(separator);
}

function certificationRisk(records: SafetyKoreaCertificationRecord[]): {
  severity: RiskSignalRecord["severity"];
  status: RiskSignalRecord["status"];
  scoreImpact: number;
  riskyStates: string;
} {
  const riskyStates = uniqueJoin(
    records
      .map((record) => record.certState)
      .filter((state) => /취소|개선명령|사용금지|효력|반납|청문|기간만료/i.test(state ?? "")),
    ", ",
    8
  );
  if (riskyStates) return { severity: "HIGH", status: "확인 필요", scoreImpact: -5, riskyStates };
  if (records.length > 0) return { severity: "NEEDS_CHECK", status: "확인 필요", scoreImpact: -1, riskyStates: "" };
  return { severity: "NEEDS_CHECK", status: "확인 필요", scoreImpact: -2, riskyStates: "" };
}

function recallSeverity(count: number, highRiskText: string): {
  severity: RiskSignalRecord["severity"];
  status: RiskSignalRecord["status"];
  scoreImpact: number;
} {
  if (count === 0) return { severity: "NEEDS_CHECK", status: "확인 필요", scoreImpact: -1 };
  if (/명령|위험|화재|감전|질식|유해|납|카드뮴|부적합|수입 거절/i.test(highRiskText) || count >= 20) {
    return { severity: "HIGH", status: "확인 필요", scoreImpact: -5 };
  }
  return { severity: "MEDIUM", status: "주의", scoreImpact: -3 };
}

export function safetyKoreaBundleToRiskSignals(bundle: SafetyKoreaBundle, hsCode?: string): RiskSignalRecord[] {
  const termHash = stableHash(bundle.term);
  const certRisk = certificationRisk(bundle.certificationRecords);
  const certProducts = uniqueJoin(bundle.certificationRecords.map((record) => record.productName), ", ", 5);
  const certModels = uniqueJoin(bundle.certificationRecords.map((record) => record.modelName), ", ", 5);
  const certMakers = uniqueJoin(bundle.certificationRecords.map((record) => record.makerName), ", ", 5);
  const domesticText = bundle.domesticRecallRecords
    .map((record) => `${record.recallTypeName ?? ""} ${record.harmDscr ?? ""} ${record.publishActionDscr ?? ""}`)
    .join(" ");
  const foreignText = bundle.foreignRecallRecords
    .map((record) => `${record.recallTypeName ?? ""} ${record.violateDscr ?? ""} ${record.publishActionDscr ?? ""}`)
    .join(" ");
  const domesticRisk = recallSeverity(bundle.domesticRecallRecords.length, domesticText);
  const foreignRisk = recallSeverity(bundle.foreignRecallRecords.length, foreignText);

  return [
    {
      id: `risk-safety-cert-${termHash}`,
      kind: "CERTIFICATION",
      severity: certRisk.severity,
      status: certRisk.status,
      title:
        bundle.certificationRecords.length > 0
          ? `${bundle.term} KC 인증 후보 ${bundle.certificationRecords.length.toLocaleString("ko-KR")}건`
          : `${bundle.term} KC 인증 후보 확인 필요`,
      summary: [
        bundle.certificationRecords.length > 0
          ? `Safety Korea KC 인증정보 조회에서 제품명 기준 ${bundle.certificationRecords.length.toLocaleString("ko-KR")}건이 확인되었습니다.`
          : "Safety Korea KC 인증정보에서 제품명 기준 직접 결과가 없거나 부족합니다.",
        certProducts ? `대표 제품명: ${certProducts}.` : "",
        certModels ? `대표 모델명: ${certModels}.` : "",
        certMakers ? `대표 제조사: ${certMakers}.` : "",
        certRisk.riskyStates ? `주의 인증상태: ${certRisk.riskyStates}.` : "",
        "목록 검색은 동일 모델 인증을 보증하지 않으므로 인증번호·모델명·수입자 기준 상세조회가 필요합니다."
      ]
        .filter(Boolean)
        .join(" "),
      scoreImpact: certRisk.scoreImpact,
      hsCode,
      ...provenance(source, "PARTIAL")
    },
    {
      id: `risk-safety-domestic-recall-${termHash}`,
      kind: "RECALL",
      severity: domesticRisk.severity,
      status: domesticRisk.status,
      title:
        bundle.domesticRecallRecords.length > 0
          ? `${bundle.term} 국내 리콜 ${bundle.domesticRecallRecords.length.toLocaleString("ko-KR")}건`
          : `${bundle.term} 국내 리콜 추가 확인`,
      summary: [
        bundle.domesticRecallRecords.length > 0
          ? `Safety Korea 국내리콜 조회에서 ${bundle.domesticRecallRecords.length.toLocaleString("ko-KR")}건이 확인되었습니다.`
          : "제품명 기준 국내리콜 결과는 제한적입니다.",
        uniqueJoin(bundle.domesticRecallRecords.map((record) => record.recallProductName), ", ", 4)
          ? `대표 리콜 제품: ${uniqueJoin(bundle.domesticRecallRecords.map((record) => record.recallProductName), ", ", 4)}.`
          : "",
        uniqueJoin(bundle.domesticRecallRecords.map((record) => record.harmDscr || record.publishActionDscr), " / ", 3)
          ? `위해·조치 요약: ${uniqueJoin(bundle.domesticRecallRecords.map((record) => record.harmDscr || record.publishActionDscr), " / ", 3)}.`
          : "",
        "리콜 여부는 최종 모델명·인증번호·제조사명 기준으로 원문 상세조회가 필요합니다."
      ]
        .filter(Boolean)
        .join(" "),
      scoreImpact: domesticRisk.scoreImpact,
      hsCode,
      ...provenance(source, "PARTIAL")
    },
    {
      id: `risk-safety-foreign-recall-${termHash}`,
      kind: "RECALL",
      severity: foreignRisk.severity,
      status: foreignRisk.status,
      title:
        bundle.foreignRecallRecords.length > 0
          ? `${bundle.term} 국외 리콜 ${bundle.foreignRecallRecords.length.toLocaleString("ko-KR")}건`
          : `${bundle.term} 국외 리콜 추가 확인`,
      summary: [
        bundle.foreignRecallRecords.length > 0
          ? `Safety Korea 국외리콜 조회에서 ${bundle.foreignRecallRecords.length.toLocaleString("ko-KR")}건이 확인되었습니다.`
          : "제품명 기준 국외리콜 결과는 제한적입니다.",
        uniqueJoin(bundle.foreignRecallRecords.map((record) => record.recallProductName), ", ", 4)
          ? `대표 리콜 제품: ${uniqueJoin(bundle.foreignRecallRecords.map((record) => record.recallProductName), ", ", 4)}.`
          : "",
        uniqueJoin(bundle.foreignRecallRecords.map((record) => record.recallPblshCntryName), ", ", 4)
          ? `공표 국가: ${uniqueJoin(bundle.foreignRecallRecords.map((record) => record.recallPblshCntryName), ", ", 4)}.`
          : "",
        uniqueJoin(bundle.foreignRecallRecords.map((record) => record.violateDscr || record.publishActionDscr), " / ", 3)
          ? `위해·조치 요약: ${uniqueJoin(bundle.foreignRecallRecords.map((record) => record.violateDscr || record.publishActionDscr), " / ", 3)}.`
          : "",
        "국외 리콜은 해외 규제기관 공표 기반 보조 신호이며 국내 수입 가능 여부를 단정하지 않습니다."
      ]
        .filter(Boolean)
        .join(" "),
      scoreImpact: foreignRisk.scoreImpact,
      hsCode,
      ...provenance(source, "PARTIAL")
    }
  ];
}

function productNeedsCertification(intent: ProductIntent): boolean {
  return /전기|전자|LED|조명|히터|배터리|드론|완구|생활용품|화장품|용기|포장/i.test(intent.query + " " + intent.category);
}

function mockSafetyKoreaSignals(intent: ProductIntent): RiskSignalRecord[] {
  const needsCertification = productNeedsCertification(intent);
  const productText = intent.query || intent.category;
  return [
    {
      id: `risk-safety-cert-${intent.hsCode ?? stableHash(productText)}-mock`,
      kind: "CERTIFICATION",
      severity: needsCertification ? "NEEDS_CHECK" : "LOW",
      status: needsCertification ? "확인 필요" : "확인",
      title: "KC·제품안전 인증 대상 여부",
      summary: needsCertification
        ? `${productText}은 제품 사양·모델·전기용품 여부에 따라 KC 또는 제품안전 확인이 필요합니다. 현재 데이터만으로 인증 면제를 단정하지 않습니다.`
        : `${productText} 관련 명시적 인증 경고는 mock 데이터에서 확인되지 않았으나 최종 인증 판단은 Safety Korea 원문 확인이 필요합니다.`,
      scoreImpact: needsCertification ? -2 : 0,
      hsCode: intent.hsCode,
      ...provenance(source, "MOCK")
    },
    {
      id: `risk-safety-recall-${intent.hsCode ?? stableHash(productText)}-mock`,
      kind: "RECALL",
      severity: "NEEDS_CHECK",
      status: "확인 필요",
      title: "국내외 리콜 이력 확인",
      summary: "제품명·모델명·제조사명이 확정되지 않아 리콜 이력을 확정할 수 없습니다. 후보 업체 확정 후 Safety Korea 리콜 원문 조회가 필요합니다.",
      scoreImpact: -1,
      hsCode: intent.hsCode,
      ...provenance(source, "MOCK")
    }
  ];
}

function normalizeStoredSeverity(value: string): RiskSignalRecord["severity"] {
  if (value === "LOW" || value === "MEDIUM" || value === "HIGH" || value === "NEEDS_CHECK" || value === "UNKNOWN") {
    return value;
  }
  return "NEEDS_CHECK";
}

function normalizeStoredStatus(value: string): RiskSignalRecord["status"] {
  if (value === "확인" || value === "주의" || value === "확인 필요") return value;
  return "확인 필요";
}

function normalizeStoredKind(value: string): RiskSignalRecord["kind"] {
  return value === "RECALL" ? "RECALL" : "CERTIFICATION";
}

function searchTerms(intent: ProductIntent): string[] {
  const keywordTerms = intent.keywords.filter(
    (term) => term.length >= 3 && !/^[A-Z0-9]+$/i.test(term) && !/공급장치|부품|제품$/.test(term)
  );
  return Array.from(new Set([intent.query, intent.category, ...keywordTerms].map((term) => term.trim()).filter(Boolean)))
    .filter((term) => term !== "품목 확인 필요")
    .slice(0, 3);
}

async function fetchStoredSafetySignals(intent: ProductIntent, limit: number): Promise<RiskSignalRecord[]> {
  try {
    const { prisma } = await import("@/lib/db/prisma");
    const sourceRow = await prisma.supplyDataSource.findUnique({ where: { code: SOURCE_CODE }, select: { id: true } });
    if (!sourceRow) return [];
    const terms = searchTerms(intent).filter((term) => term.length >= 3);
    if (terms.length === 0) return [];
    const rows = await prisma.riskSignal.findMany({
      where: {
        sourceId: sourceRow.id,
        OR: terms.flatMap((term) => [
          { productQuery: { contains: term } },
          { title: { contains: term } }
        ])
      },
      orderBy: [{ fetchedAt: "desc" }, { updatedAt: "desc" }],
      take: limit
    });
    return rows.map((row) => ({
      id: row.id,
      kind: normalizeStoredKind(row.kind),
      severity: normalizeStoredSeverity(row.severity),
      status: normalizeStoredStatus(row.status),
      title: row.title,
      summary: row.summary,
      scoreImpact: row.scoreImpact,
      hsCode: row.hsCode ?? undefined,
      supplierId: row.supplierId ?? undefined,
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

async function fetchSafetyKoreaSignals(intent: ProductIntent, limit: number): Promise<RiskSignalRecord[]> {
  const terms = searchTerms(intent);
  let fallbackSignals: RiskSignalRecord[] = [];
  for (const term of terms) {
    const bundle = await fetchSafetyKoreaBundle({ term, timeoutMs: 18000 });
    const signals = safetyKoreaBundleToRiskSignals(bundle, intent.hsCode);
    const rawCount =
      bundle.certificationRecords.length + bundle.domesticRecallRecords.length + bundle.foreignRecallRecords.length;
    if (rawCount > 0) return signals.slice(0, limit);
    if (fallbackSignals.length === 0) fallbackSignals = signals;
  }
  return fallbackSignals.slice(0, limit);
}

export async function getSafetyKoreaRiskSignals(
  intent: ProductIntent,
  options: SafetyKoreaAdapterOptions = {}
): Promise<{ signals: RiskSignalRecord[]; usedMock: boolean }> {
  const limit = options.limit ?? 6;
  if (!options.forceMock) {
    try {
      const signals = await fetchSafetyKoreaSignals(intent, limit);
      if (signals.length > 0) return { signals, usedMock: false };
    } catch {
      // Fall through to stored records or deterministic mock fallback.
    }

    const stored = await fetchStoredSafetySignals(intent, limit);
    if (stored.length > 0) return { signals: stored, usedMock: false };
  }
  return { signals: mockSafetyKoreaSignals(intent), usedMock: true };
}
