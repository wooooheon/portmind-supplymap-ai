"use client";

import { Database, Factory, Globe2, ShieldCheck } from "lucide-react";
import { SourceBadge } from "@/components/SourceBadge";
import type {
  CandidateScoreBreakdown,
  CandidateScoreComponent,
  SupplyMapCandidateType,
  SupplySourceType,
  VerificationStatus
} from "@/lib/supplymap/types";

export type SupplyMapCandidateTableRow = {
  id: string;
  candidateType: SupplyMapCandidateType;
  name: string;
  country: string;
  countryCode?: string;
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
};

function rowTypeOrder(row: SupplyMapCandidateTableRow): number {
  return row.candidateType === "DOMESTIC_SUPPLIER" ? 0 : 1;
}

function sortedRows(rows: SupplyMapCandidateTableRow[]) {
  return [...rows].sort(
    (left, right) =>
      rowTypeOrder(left) - rowTypeOrder(right) ||
      right.matchScore - left.matchScore ||
      left.name.localeCompare(right.name)
  );
}

function scoreColor(score: number) {
  if (score >= 80) return "bg-teal";
  if (score >= 65) return "bg-cobalt";
  return "bg-amber";
}

function verificationText(row: SupplyMapCandidateTableRow) {
  if (row.sourceType === "MOTIE_PUBLIC") return "산업부 공공데이터 확인";
  if (row.sourceType === "OTHER_PUBLIC") return "타 기관 공공데이터 확인";
  if (row.sourceType === "USER_UPLOAD") return "업로드 원본 확인 필요";
  return "민간·중국/해외 베타 데이터";
}

function typeLabel(type: SupplyMapCandidateType) {
  return type === "DOMESTIC_SUPPLIER" ? "국내 후보" : "중국/해외 베타";
}

function breakdownReason(item: CandidateScoreComponent): string {
  return `${item.score}/${item.maxScore} · ${item.reason}`;
}

export function SupplyMapCandidateTable({
  rows,
  onEvidence
}: {
  rows: SupplyMapCandidateTableRow[];
  onEvidence: (id: string) => void;
}) {
  const visibleRows = sortedRows(rows).slice(0, 8);

  return (
    <article className="overflow-hidden border border-line bg-white shadow-soft">
      <header className="flex flex-col gap-3 border-b border-line px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-cobalt" />
            <h3 className="text-sm font-bold text-ink">후보 비교</h3>
          </div>
          <p className="mt-1 text-xs text-muted">
            국내 공장 후보와 중국/해외 베타 후보를 한 표에서 비교합니다. 출처 유형과 좌표·기업 확인 수준을 함께 확인하세요.
          </p>
        </div>
        <span className="w-fit rounded-full bg-teal/10 px-2.5 py-1 text-[11px] font-bold text-teal">
          KR/CN comparison
        </span>
      </header>

      <div className="border-b border-amber/30 bg-[#fff9e8] px-5 py-3 text-xs leading-5 text-[#735f2c]">
        중국/해외 베타 데이터는 PRIVATE/OTHER_PUBLIC/USER_UPLOAD 출처가 섞여 있으며, 정확 주소·사업자 실재성·인증서는 RFQ 전 확인이 필요합니다.
      </div>

      {visibleRows.length === 0 ? (
        <div className="px-5 py-8 text-sm text-muted">비교할 후보가 없습니다.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead className="bg-panel text-[11px] font-bold text-muted">
              <tr>
                <th className="px-4 py-3">후보</th>
                <th className="px-4 py-3">점수</th>
                <th className="px-4 py-3">생산품 / 위치</th>
                <th className="px-4 py-3">출처</th>
                <th className="px-4 py-3">리스크 요약</th>
                <th className="px-4 py-3">근거</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visibleRows.map((row, index) => {
                const isDomestic = row.candidateType === "DOMESTIC_SUPPLIER";
                const Icon = isDomestic ? Factory : Globe2;
                const evidenceId = row.evidenceIds[0];
                return (
                  <tr key={row.id} className="align-top hover:bg-panel">
                    <td className="px-4 py-3">
                      <div className="flex min-w-[180px] flex-col gap-2">
                        <span
                          className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold ${
                            isDomestic ? "bg-teal/10 text-teal" : "bg-amber/10 text-amber"
                          }`}
                        >
                          <Icon className="h-3 w-3" />
                          {isDomestic ? `국내 ${index + 1}` : typeLabel(row.candidateType)}
                        </span>
                        <p className="text-xs font-bold leading-5 text-ink">{row.name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#e4e9ed]">
                          <div className={`h-full ${scoreColor(row.matchScore)}`} style={{ width: `${Math.max(0, Math.min(100, row.matchScore))}%` }} />
                        </div>
                        <span className="text-sm font-bold text-ink">{row.matchScore}</span>
                      </div>
                      {row.scoreBreakdown ? (
                        <div className="mt-2 text-[10px] leading-4 text-muted">
                          <p title={row.scoreBreakdown.productFit.reason}>제품 {breakdownReason(row.scoreBreakdown.productFit)}</p>
                          <p title={row.scoreBreakdown.publicDataConfidence.reason}>공공 {breakdownReason(row.scoreBreakdown.publicDataConfidence)}</p>
                        </div>
                      ) : (
                        <p className="mt-2 text-[10px] text-muted">세부 점수 확인 필요</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="max-w-[260px] text-xs leading-5 text-ink">{row.productText || "생산품 확인 필요"}</p>
                      <p className="mt-1 text-[11px] leading-5 text-muted">
                        {[row.country, row.region, row.city].filter(Boolean).join(" · ") || "위치 확인 필요"}
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-muted">
                        {row.industrialComplex ? `${row.industrialComplex} · ` : ""}
                        {row.address ?? "주소 확인 필요"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-[190px] items-start gap-2 text-xs text-ink">
                        <ShieldCheck className={`mt-0.5 h-3.5 w-3.5 ${isDomestic ? "text-teal" : "text-amber"}`} />
                        <div>
                          <SourceBadge sourceType={row.sourceType} compact />
                          <p className="font-semibold">{verificationText(row)}</p>
                          <p className="mt-1 text-[11px] leading-5 text-muted">{row.sourceName}</p>
                          <p className="mt-1 text-[10px] text-muted">{row.datasetName} · {row.verification}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="max-w-[250px] text-xs leading-5 text-ink">{row.riskSummary}</p>
                    </td>
                    <td className="px-4 py-3">
                      {evidenceId ? (
                        <button
                          type="button"
                          onClick={() => onEvidence(evidenceId)}
                          className="font-mono text-[10px] font-bold text-cobalt hover:underline"
                        >
                          근거 {row.evidenceIds.length}개
                        </button>
                      ) : (
                        <span className="text-[11px] text-muted">확인 필요</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
