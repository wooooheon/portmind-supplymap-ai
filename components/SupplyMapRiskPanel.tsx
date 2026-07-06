"use client";

import { AlertTriangle, FileSearch, ShieldAlert, ShieldCheck } from "lucide-react";
import { SourceBadge } from "@/components/SourceBadge";
import type { RiskSignalKind, SupplySourceType } from "@/lib/supplymap/types";

export type SupplyMapRiskPanelSignal = {
  id: string;
  kind: RiskSignalKind | string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "NEEDS_CHECK" | "UNKNOWN";
  status: string;
  title: string;
  summary: string;
  scoreImpact: number;
  providerName: string;
  datasetName: string;
  sourceType: SupplySourceType;
  evidenceId?: string;
};

type ScoreBreakdownForRisk = {
  complianceReadiness?: {
    score: number;
    maxScore: number;
    reason: string;
  };
  countryPaymentRisk?: {
    score: number;
    maxScore: number;
    reason: string;
  };
};

function severityStyle(severity: SupplyMapRiskPanelSignal["severity"]): string {
  if (severity === "HIGH") return "border-danger/30 bg-danger/10 text-danger";
  if (severity === "MEDIUM") return "border-amber/30 bg-[#fff8e8] text-amber";
  if (severity === "LOW") return "border-teal/30 bg-teal/10 text-teal";
  return "border-line bg-panel text-muted";
}

function severityLabel(severity: SupplyMapRiskPanelSignal["severity"]): string {
  if (severity === "UNKNOWN") return "NEEDS_CHECK";
  return severity;
}

function kindLabel(kind: string): string {
  const labels: Record<string, string> = {
    CERTIFICATION: "인증",
    RECALL: "리콜",
    CUSTOMS: "통관",
    COUNTRY: "국가",
    PAYMENT: "결제",
    NEWS: "뉴스",
    STRATEGIC_GOODS: "전략물자",
    COUNTRY_RISK: "국가",
    MARKET: "시장",
    TRADE_SECURITY: "무역안보"
  };
  return labels[kind] ?? kind;
}

function iconForSeverity(severity: SupplyMapRiskPanelSignal["severity"]) {
  if (severity === "LOW") return ShieldCheck;
  if (severity === "NEEDS_CHECK" || severity === "UNKNOWN") return FileSearch;
  return AlertTriangle;
}

export function SupplyMapRiskPanel({
  signals,
  selectedName,
  selectedScore,
  scoreBreakdown,
  onEvidence
}: {
  signals: SupplyMapRiskPanelSignal[];
  selectedName?: string;
  selectedScore?: number;
  scoreBreakdown?: ScoreBreakdownForRisk;
  onEvidence: (id: string) => void;
}) {
  const visibleSignals = signals.slice(0, 8);

  return (
    <article className="border border-line bg-white shadow-soft">
      <header className="flex items-center gap-2 border-b border-line px-5 py-4">
        <ShieldAlert className="h-4 w-4 text-danger" />
        <div>
          <h3 className="text-sm font-bold text-ink">인증·리콜·통관·국가위험</h3>
          <p className="mt-0.5 text-[11px] text-muted">의사결정 보조 신호이며 최종 법률·인증·통관 판단이 아닙니다.</p>
        </div>
      </header>

      {scoreBreakdown ? (
        <div className="border-b border-line bg-panel/70 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase text-muted">Decision support score</p>
              <p className="mt-1 text-sm font-bold text-ink">
                {selectedName ?? "선택 후보"} · {selectedScore ?? "확인 필요"}점
              </p>
            </div>
            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-muted">최종 판단 아님</span>
          </div>
          <div className="mt-3 grid gap-2 text-[11px] leading-5">
            {scoreBreakdown.complianceReadiness ? (
              <div className="rounded border border-line bg-white px-3 py-2">
                <b className="text-ink">
                  인증·통관 {scoreBreakdown.complianceReadiness.score}/{scoreBreakdown.complianceReadiness.maxScore}
                </b>
                <span className="ml-1 text-muted">{scoreBreakdown.complianceReadiness.reason}</span>
              </div>
            ) : null}
            {scoreBreakdown.countryPaymentRisk ? (
              <div className="rounded border border-line bg-white px-3 py-2">
                <b className="text-ink">
                  국가·거래 {scoreBreakdown.countryPaymentRisk.score}/{scoreBreakdown.countryPaymentRisk.maxScore}
                </b>
                <span className="ml-1 text-muted">{scoreBreakdown.countryPaymentRisk.reason}</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="border-b border-amber/30 bg-[#fff9e8] px-5 py-3 text-xs leading-5 text-[#735f2c]">
        RiskSignal이 없거나 낮게 표시되어도 안전하다는 뜻이 아닙니다. 현재 확보된 데이터에서는 확인된 리스크가 적지만,
        최종 인증·통관 판단은 관계기관 확인이 필요합니다.
      </div>

      {visibleSignals.length === 0 ? (
        <div className="px-5 py-8 text-sm leading-6 text-muted">
          현재 확보된 데이터에서는 확인된 리스크가 적지만, 최종 인증·통관 판단은 관계기관 확인 필요입니다.
        </div>
      ) : (
        <div className="divide-y divide-line">
          {visibleSignals.map((signal) => {
            const Icon = iconForSeverity(signal.severity);
            return (
              <button
                key={signal.id}
                type="button"
                onClick={() => signal.evidenceId && onEvidence(signal.evidenceId)}
                className="block w-full px-5 py-3.5 text-left hover:bg-panel"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 text-xs font-bold text-ink">
                      <Icon className="h-3.5 w-3.5 text-muted" />
                      {signal.title}
                      <SourceBadge sourceType={signal.sourceType} compact />
                    </span>
                    <span className="mt-1.5 block text-[11px] leading-5 text-muted">{signal.summary}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-muted">
                      <span className="rounded border border-line bg-white px-1.5 py-0.5">{kindLabel(String(signal.kind))}</span>
                      <span>{signal.providerName}</span>
                      <span>{signal.datasetName}</span>
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${severityStyle(signal.severity)}`}>
                    {severityLabel(signal.severity)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </article>
  );
}
