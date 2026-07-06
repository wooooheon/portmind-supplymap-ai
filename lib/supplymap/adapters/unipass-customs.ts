import { XMLParser } from "fast-xml-parser";
import { supplySource } from "@/lib/supplymap/data-sources";
import type { ProductIntent, Provenance, RiskSignalRecord, SupplyDataSourceRecord } from "@/lib/supplymap/types";

type RawRecord = Record<string, unknown>;

export type UnipassHsCodeRecord = {
  hsSgn?: string;
  korePrnm?: string;
  englPrnm?: string;
  txrt?: string;
  txtpSgn?: string;
  qtyUt?: string;
  wghtUt?: string;
};

export type UnipassCustomsRequirementRecord = {
  hsSgn?: string;
  reqApreIttCd?: string;
  dcerCfrmLworCd?: string;
  dcerCfrmLworNm?: string;
  reqCfrmIstmNm?: string;
  reqApreIttNm?: string;
  aplyStrtDt?: string;
  aplyEndDt?: string;
};

export type UnipassTariffRateRecord = {
  hsSgn?: string;
  trrtTpcd?: string;
  trrtTpNm?: string;
  trrt?: string;
  prutXamt?: string;
  basePrc?: string;
  aplyStrtDt?: string;
  aplyEndDt?: string;
};

export type UnipassFxRateRecord = {
  cntySgn?: string;
  mtryUtNm?: string;
  fxrt?: string;
  currSgn?: string;
  aplyBgnDt?: string;
  imexTp?: string;
};

export type UnipassHsNavigationRecord = {
  hs10Sgn?: string;
  prlstNm?: string;
  acrsTcntRnk?: string;
  prlstLnCnt?: string;
};

type UnipassRiskOptions = {
  forceMock?: boolean;
  limit?: number;
};

const BASE_URL = "https://unipass.customs.go.kr:38010/ext/rest";
const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true
});

const sourceHs = supplySource("unipass_hs_code");
const sourceRequirements = supplySource("unipass_customs_requirements");
const sourceTariff = supplySource("unipass_tariff_rate");
const sourceFx = supplySource("unipass_fx_rate");
const sourceNavigation = supplySource("unipass_hs_navigation");

function provenance(source: SupplyDataSourceRecord): Provenance {
  return {
    providerName: source.providerName,
    datasetName: source.datasetName,
    sourceType: source.sourceType,
    sourceUrl: source.sourceUrl,
    fetchedAt: new Date().toISOString(),
    license: source.license,
    verification: source.verification === "MOCK" ? "PARTIAL" : source.verification
  };
}

function keyFor(envName: string): string | undefined {
  return process.env[envName] || process.env.UNIPASS_API_KEY;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function cleanText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const cleaned = value.replace(/\s+/g, " ").trim();
    return cleaned || undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function collectRecords<T extends RawRecord>(payload: unknown, suffix: string): T[] {
  const records: T[] = [];
  function walk(value: unknown) {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as RawRecord)) {
      if (key.toLowerCase().endsWith(suffix.toLowerCase())) {
        records.push(
          ...asArray(child as RawRecord | RawRecord[]).map(
            (record) =>
              Object.fromEntries(Object.entries(record).map(([recordKey, recordValue]) => [recordKey, cleanText(recordValue) ?? ""])) as T
          )
        );
      } else {
        walk(child);
      }
    }
  }
  walk(payload);
  return records;
}

function notice(payload: unknown): string | undefined {
  const text = JSON.stringify(payload);
  const match = text.match(/"ntceInfo":"?([^",}]*)/);
  return match?.[1];
}

async function unipassGet<T extends RawRecord>({
  envName,
  path,
  method,
  params,
  suffix,
  timeoutMs = 20000
}: {
  envName: string;
  path: string;
  method: string;
  params: Record<string, string>;
  suffix: string;
  timeoutMs?: number;
}): Promise<T[]> {
  const key = keyFor(envName);
  if (!key) throw new Error(`${envName} 또는 UNIPASS_API_KEY가 없습니다.`);
  const url = new URL(`${BASE_URL}/${path}/${method}`);
  url.searchParams.set("crkyCn", key);
  for (const [paramKey, paramValue] of Object.entries(params)) {
    if (paramValue) url.searchParams.set(paramKey, paramValue);
  }
  const response = await fetch(url, {
    headers: { accept: "application/xml,text/xml,*/*" },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error(`UNI-PASS ${path}/${method} HTTP ${response.status}`);
  const payload = parser.parse(await response.text());
  const ntceInfo = notice(payload);
  if (ntceInfo && !/조회된|없습니다|N00/i.test(ntceInfo)) throw new Error(`UNI-PASS notice=${ntceInfo}`);
  return collectRecords<T>(payload, suffix);
}

function normalizeHsCode(code?: string): string | undefined {
  const digits = (code ?? "").replace(/[^0-9]/g, "");
  if (digits.length < 4) return undefined;
  if (digits.length >= 10) return digits.slice(0, 10);
  return digits.padEnd(10, "0");
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function uniqueJoin(values: Array<string | undefined>, separator = ", ", limit = 6): string {
  return Array.from(new Set(values.map(cleanText).filter(Boolean) as string[])).slice(0, limit).join(separator);
}

function numeric(value?: string): number | null {
  const parsed = Number((value ?? "").replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function hsSearchTerms(intent: ProductIntent): string[] {
  return Array.from(
    new Set(
      [intent.query, intent.category, ...intent.keywords]
        .map((term) => term.trim())
        .filter((term) => term && term !== "품목 확인 필요")
    )
  ).slice(0, 3);
}

function hsCandidates(intent: ProductIntent): string[] {
  return Array.from(
    new Set([intent.hsCode, ...intent.hsCodeCandidates].map(normalizeHsCode).filter(Boolean) as string[])
  ).slice(0, 5);
}

function countryCode(country?: string): string | undefined {
  if (!country) return undefined;
  if (/^(CN|CHN|중국|china)$/i.test(country)) return "CN";
  if (/^(VN|VNM|베트남|vietnam)$/i.test(country)) return "VN";
  if (/^(US|USA|미국|united states)$/i.test(country)) return "US";
  if (/^(JP|JPN|일본|japan)$/i.test(country)) return "JP";
  if (/^(PL|POL|폴란드|poland)$/i.test(country)) return "PL";
  if (/^(DE|DEU|독일|germany)$/i.test(country)) return "DE";
  return /^[A-Z]{2}$/i.test(country) ? country.toUpperCase() : undefined;
}

export async function fetchUnipassHsCodesByCode(hsCode: string): Promise<UnipassHsCodeRecord[]> {
  const normalized = normalizeHsCode(hsCode);
  if (!normalized) return [];
  return unipassGet<UnipassHsCodeRecord>({
    envName: "UNIPASS_HS_CODE_SEARCH_KEY",
    path: "hsSgnQry",
    method: "searchHsSgn",
    params: { hsSgn: normalized, koenTp: "1" },
    suffix: "hsSgnSrchRsltVo"
  });
}

export async function fetchUnipassHsCodesByProduct(productName: string): Promise<UnipassHsCodeRecord[]> {
  return unipassGet<UnipassHsCodeRecord>({
    envName: "UNIPASS_HS_CODE_SEARCH_KEY",
    path: "hsSgnQry",
    method: "searchHsSgn",
    params: { prnm: productName, koenTp: "1" },
    suffix: "hsSgnSrchRsltVo"
  });
}

export async function fetchUnipassCustomsRequirements(hsCode: string): Promise<UnipassCustomsRequirementRecord[]> {
  const normalized = normalizeHsCode(hsCode);
  if (!normalized) return [];
  return unipassGet<UnipassCustomsRequirementRecord>({
    envName: "UNIPASS_CUSTOMS_REQUIREMENT_KEY",
    path: "ccctLworCdQry",
    method: "retrieveCcctLworCd",
    params: { hsSgn: normalized, imexTp: "2" },
    suffix: "ccctLworCdQryRsltVo"
  });
}

export async function fetchUnipassTariffRates(hsCode: string): Promise<UnipassTariffRateRecord[]> {
  const normalized = normalizeHsCode(hsCode);
  if (!normalized) return [];
  return unipassGet<UnipassTariffRateRecord>({
    envName: "UNIPASS_TARIFF_RATE_KEY",
    path: "trrtQry",
    method: "retrieveTrrt",
    params: { hsSgn: normalized },
    suffix: "trrtQryRsltVo"
  });
}

export async function fetchUnipassFxRates(date: Date = new Date(), importExportType = "2"): Promise<UnipassFxRateRecord[]> {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return unipassGet<UnipassFxRateRecord>({
    envName: "UNIPASS_TARIFF_FX_KEY",
    path: "trifFxrtInfoQry",
    method: "retrieveTrifFxrtInfo",
    params: { qryYymmDd: `${yyyy}${mm}${dd}`, imexTp: importExportType },
    suffix: "trifFxrtInfoQryRsltVo"
  });
}

export async function fetchUnipassHsNavigation(hsCode: string): Promise<UnipassHsNavigationRecord[]> {
  const normalized = normalizeHsCode(hsCode);
  if (!normalized) return [];
  return unipassGet<UnipassHsNavigationRecord>({
    envName: "UNIPASS_HS_NAVIGATION_KEY",
    path: "cmtrStatsQry",
    method: "retrieveCmtrStats",
    params: { hsSgn: normalized },
    suffix: "cmtrStatsQryRsltVo"
  });
}

function requirementsSeverity(records: UnipassCustomsRequirementRecord[]): {
  severity: RiskSignalRecord["severity"];
  status: RiskSignalRecord["status"];
  scoreImpact: number;
} {
  const text = records.map((record) => `${record.dcerCfrmLworNm ?? ""} ${record.reqCfrmIstmNm ?? ""}`).join(" ");
  if (/전략물자|총포|마약|화학무기|방사|유해화학|폐기물/i.test(text)) {
    return { severity: "HIGH", status: "확인 필요", scoreImpact: -5 };
  }
  if (records.length > 0) return { severity: "MEDIUM", status: "확인 필요", scoreImpact: -3 };
  return { severity: "NEEDS_CHECK", status: "확인 필요", scoreImpact: -1 };
}

function tariffSummary(records: UnipassTariffRateRecord[]): string {
  const basic = records.find((record) => record.trrtTpcd === "A");
  const wto = records.find((record) => record.trrtTpcd === "C");
  const fta = records
    .filter((record) => /FTA|협정/i.test(record.trrtTpNm ?? ""))
    .sort((left, right) => (numeric(left.trrt) ?? 999) - (numeric(right.trrt) ?? 999))[0];
  return [
    basic ? `기본세율 ${basic.trrt}%` : "",
    wto ? `WTO협정세율 ${wto.trrt}%` : "",
    fta ? `대표 FTA/협정세율 ${fta.trrtTpNm} ${fta.trrt}%` : ""
  ]
    .filter(Boolean)
    .join(", ");
}

async function resolveHsCandidates(intent: ProductIntent, limit: number) {
  const byCode = (
    await Promise.all(
      hsCandidates(intent)
        .slice(0, 3)
        .map(async (code) => fetchUnipassHsCodesByCode(code).catch(() => []))
    )
  ).flat();
  if (byCode.length > 0) {
    return Array.from(new Map(byCode.map((record) => [String(record.hsSgn), record])).values()).slice(0, limit);
  }

  for (const term of hsSearchTerms(intent)) {
    const byProduct = await fetchUnipassHsCodesByProduct(term).catch(() => []);
    if (byProduct.length > 0) {
      return Array.from(new Map(byProduct.map((record) => [String(record.hsSgn), record])).values()).slice(0, limit);
    }
  }
  return hsCandidates(intent).map((code) => ({ hsSgn: code })) as UnipassHsCodeRecord[];
}

export function unipassHsCandidateSignal(intent: ProductIntent, records: UnipassHsCodeRecord[]): RiskSignalRecord {
  const title = records.length > 0 ? "UNI-PASS HS부호 후보 확인" : "UNI-PASS HS부호 후보 확인 필요";
  return {
    id: `risk-unipass-hs-${stableHash(intent.query + records.map((record) => record.hsSgn).join("-"))}`,
    kind: "CUSTOMS",
    severity: "NEEDS_CHECK",
    status: "확인 필요",
    title,
    summary: [
      records.length > 0
        ? `UNI-PASS HS부호검색에서 후보 ${records.length}건을 확인했습니다.`
        : "UNI-PASS HS부호검색 후보가 부족합니다.",
      uniqueJoin(records.map((record) => `${record.hsSgn} ${record.korePrnm ?? ""}`), " / ", 5)
        ? `후보: ${uniqueJoin(records.map((record) => `${record.hsSgn} ${record.korePrnm ?? ""}`), " / ", 5)}.`
        : "",
      "HS 후보는 품목분류의 출발점이며 최종 신고 HS는 품목 사양과 관세사·관계기관 확인이 필요합니다."
    ]
      .filter(Boolean)
      .join(" "),
    scoreImpact: -1,
    hsCode: records[0]?.hsSgn ?? intent.hsCode,
    ...provenance(sourceHs)
  };
}

export function unipassRequirementsSignal(hsCode: string, records: UnipassCustomsRequirementRecord[]): RiskSignalRecord {
  const risk = requirementsSeverity(records);
  const normalized = normalizeHsCode(hsCode) ?? hsCode;
  return {
    id: `risk-unipass-requirements-${normalized}-${stableHash(records.map((record) => record.reqApreIttCd).join("-"))}`,
    kind: "CUSTOMS",
    severity: risk.severity,
    status: risk.status,
    title: `HS ${normalized} UNI-PASS 세관장확인대상`,
    summary: [
      records.length > 0
        ? `UNI-PASS 세관장확인대상 조회에서 ${records.length}개 요건이 확인되었습니다.`
        : "UNI-PASS 세관장확인대상 조회 결과가 없거나 제한적입니다.",
      uniqueJoin(records.map((record) => record.dcerCfrmLworNm)) ? `확인법령: ${uniqueJoin(records.map((record) => record.dcerCfrmLworNm))}.` : "",
      uniqueJoin(records.map((record) => record.reqCfrmIstmNm)) ? `확인서류: ${uniqueJoin(records.map((record) => record.reqCfrmIstmNm))}.` : "",
      uniqueJoin(records.map((record) => record.reqApreIttNm)) ? `요건승인기관: ${uniqueJoin(records.map((record) => record.reqApreIttNm))}.` : "",
      "최종 수입요건과 승인 필요 여부는 신고 HS와 제품 사양 기준으로 재확인해야 합니다."
    ]
      .filter(Boolean)
      .join(" "),
    scoreImpact: risk.scoreImpact,
    hsCode: normalized,
    ...provenance(sourceRequirements)
  };
}

export function unipassTariffSignal(hsCode: string, records: UnipassTariffRateRecord[]): RiskSignalRecord {
  const normalized = normalizeHsCode(hsCode) ?? hsCode;
  return {
    id: `risk-unipass-tariff-${normalized}`,
    kind: "CUSTOMS",
    severity: records.length > 0 ? "LOW" : "NEEDS_CHECK",
    status: records.length > 0 ? "확인" : "확인 필요",
    title: `HS ${normalized} UNI-PASS 관세율`,
    summary: [
      records.length > 0
        ? `UNI-PASS 관세율 조회에서 ${records.length}개 세율 구분을 확인했습니다.`
        : "UNI-PASS 관세율 조회 결과가 부족합니다.",
      tariffSummary(records) ? `주요 세율: ${tariffSummary(records)}.` : "",
      "FTA 적용은 원산지, 협정, 증빙서류 충족 여부에 따라 달라지므로 예상 관세율로만 활용해야 합니다."
    ]
      .filter(Boolean)
      .join(" "),
    scoreImpact: records.length > 0 ? 0 : -1,
    hsCode: normalized,
    ...provenance(sourceTariff)
  };
}

export function unipassNavigationSignal(hsCode: string, records: UnipassHsNavigationRecord[]): RiskSignalRecord {
  const normalized = normalizeHsCode(hsCode) ?? hsCode;
  return {
    id: `risk-unipass-hs-navigation-${normalized}`,
    kind: "MARKET",
    severity: records.length > 0 ? "LOW" : "NEEDS_CHECK",
    status: records.length > 0 ? "확인" : "확인 필요",
    title: `HS ${normalized} 신고 품목 내비게이션`,
    summary: [
      records.length > 0
        ? `UNI-PASS HS CODE 내비게이션에서 신고 품목 순위 ${records.length}건을 확인했습니다.`
        : "UNI-PASS HS CODE 내비게이션 결과가 부족합니다.",
      uniqueJoin(records.slice(0, 5).map((record) => `${record.prlstNm ?? ""}(${record.prlstLnCnt ?? "건수 확인"})`), " / ", 5)
        ? `대표 신고 품목: ${uniqueJoin(records.slice(0, 5).map((record) => `${record.prlstNm ?? ""}(${record.prlstLnCnt ?? "건수 확인"})`), " / ", 5)}.`
        : "",
      "신고 빈도는 품목 후보 보조지표이며 수입 가능성이나 거래 안정성을 보증하지 않습니다."
    ]
      .filter(Boolean)
      .join(" "),
    scoreImpact: 0,
    hsCode: normalized,
    ...provenance(sourceNavigation)
  };
}

export async function unipassFxSignal(intent: ProductIntent): Promise<RiskSignalRecord | null> {
  const code = countryCode(intent.importCountry);
  if (!code) return null;
  const rows = await fetchUnipassFxRates().catch(() => []);
  const row = rows.find((record) => record.cntySgn === code);
  if (!row) return null;
  return {
    id: `risk-unipass-fx-${code}-${row.aplyBgnDt ?? "latest"}`,
    kind: "PAYMENT",
    severity: "LOW",
    status: "확인",
    title: `${code} UNI-PASS 수입 관세환율`,
    summary: `UNI-PASS 관세환율 기준 ${row.currSgn ?? code} ${row.mtryUtNm ?? ""} 수입환율은 ${row.fxrt}원이며 적용시작일은 ${row.aplyBgnDt ?? "확인 필요"}입니다. 실제 결제환율·은행수수료·관세평가 환율 적용은 거래일과 신고일 기준으로 확인해야 합니다.`,
    scoreImpact: 0,
    hsCode: intent.hsCode,
    ...provenance(sourceFx)
  };
}

function mockUnipassSignals(intent: ProductIntent): RiskSignalRecord[] {
  return [
    {
      id: `risk-unipass-mock-${stableHash(intent.query)}`,
      kind: "CUSTOMS",
      severity: "NEEDS_CHECK",
      status: "확인 필요",
      title: "UNI-PASS 통관 데이터 확인",
      summary:
        "UNI-PASS API 키 또는 실시간 응답이 없어 HS부호, 세관장확인대상, 관세율, 관세환율은 fallback 데이터로 표시합니다. 최종 통관 판단은 관계기관 확인 필요입니다.",
      scoreImpact: -2,
      hsCode: intent.hsCode,
      ...provenance(sourceHs)
    }
  ];
}

export async function getUnipassCustomsRiskSignals(
  intent: ProductIntent,
  options: UnipassRiskOptions = {}
): Promise<{ signals: RiskSignalRecord[]; usedMock: boolean }> {
  if (options.forceMock) return { signals: mockUnipassSignals(intent), usedMock: true };
  try {
    const hsRecords = await resolveHsCandidates(intent, 4);
    const hsCodes = Array.from(new Set(hsRecords.map((record) => normalizeHsCode(record.hsSgn)).filter(Boolean) as string[])).slice(0, 2);
    const signals: RiskSignalRecord[] = [unipassHsCandidateSignal(intent, hsRecords)];
    for (const hsCode of hsCodes) {
      const [requirements, tariffs, navigation] = await Promise.all([
        fetchUnipassCustomsRequirements(hsCode).catch(() => []),
        fetchUnipassTariffRates(hsCode).catch(() => []),
        fetchUnipassHsNavigation(hsCode).catch(() => [])
      ]);
      signals.push(unipassRequirementsSignal(hsCode, requirements));
      signals.push(unipassTariffSignal(hsCode, tariffs));
      signals.push(unipassNavigationSignal(hsCode, navigation));
    }
    const fx = await unipassFxSignal(intent);
    if (fx) signals.push(fx);
    return { signals: signals.slice(0, options.limit ?? 10), usedMock: false };
  } catch {
    return { signals: mockUnipassSignals(intent), usedMock: true };
  }
}
