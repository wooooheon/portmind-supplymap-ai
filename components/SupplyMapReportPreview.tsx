"use client";

import { AlertTriangle, Clipboard, Download, FileCheck2, Printer } from "lucide-react";
import { SourceBadge } from "@/components/SourceBadge";
import type { SupplyMapReport, SupplyMapReportItem, SupplyMapReportSection } from "@/lib/supplymap/report";

function firstEvidenceId(item: SupplyMapReportItem) {
  return item.evidenceIds?.find(Boolean);
}

function ReportItem({
  item,
  onEvidence
}: {
  item: SupplyMapReportItem;
  onEvidence?: (id: string) => void;
}) {
  const evidenceId = firstEvidenceId(item);
  return (
    <div className="grid gap-2 border-t border-line py-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] sm:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {item.sourceType ? <SourceBadge sourceType={item.sourceType} compact /> : null}
          <p className="text-sm font-bold leading-5 text-ink">{item.label}</p>
        </div>
        {item.detail ? <p className="mt-1 text-xs leading-5 text-muted">{item.detail}</p> : null}
        {item.sourceName || item.datasetName ? (
          <p className="mt-1 text-[11px] leading-5 text-muted">
            {item.sourceName ?? "출처 확인 필요"} · {item.datasetName ?? "데이터셋 확인 필요"}
          </p>
        ) : null}
      </div>
      <div className="flex items-start justify-between gap-3 sm:justify-end">
        <p className="text-sm font-bold leading-5 text-ink sm:text-right">{item.value}</p>
        {typeof item.score === "number" ? (
          <span className="rounded bg-[#eef4fb] px-2 py-0.5 font-mono text-[11px] font-bold text-cobalt">
            {item.score > 0 ? "+" : ""}
            {item.score}
          </span>
        ) : null}
        {evidenceId && onEvidence ? (
          <button
            type="button"
            onClick={() => onEvidence(evidenceId)}
            className="print:hidden shrink-0 rounded border border-line px-2 py-1 text-[10px] font-bold text-cobalt hover:bg-panel"
          >
            근거
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ReportSection({
  section,
  onEvidence
}: {
  section: SupplyMapReportSection;
  onEvidence?: (id: string) => void;
}) {
  return (
    <section className="break-inside-avoid border-t border-line py-6">
      <div className="mb-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-cobalt">{section.id}</p>
        <h3 className="mt-1 text-lg font-bold text-ink">{section.title}</h3>
        <p className="mt-1 text-xs leading-5 text-muted">{section.summary}</p>
      </div>
      <div className="divide-y-0">
        {section.items.map((item) => (
          <ReportItem key={item.id} item={item} onEvidence={onEvidence} />
        ))}
      </div>
    </section>
  );
}

export function SupplyMapReportPreview({
  report,
  onEvidence,
  onCopy,
  onDownload
}: {
  report: SupplyMapReport;
  onEvidence?: (id: string) => void;
  onCopy?: () => void;
  onDownload?: () => void;
}) {
  return (
    <article className="border border-line bg-white shadow-soft print:border-0 print:shadow-none">
      <header className="print:hidden flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <FileCheck2 className="h-5 w-5 text-cobalt" />
          <div>
            <h3 className="text-sm font-bold text-ink">SupplyMap 리포트 미리보기</h3>
            <p className="mt-0.5 text-[11px] text-muted">{report.reportId} · {report.generatedAt}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onCopy ? (
            <button type="button" onClick={onCopy} className="flex h-9 w-9 items-center justify-center rounded-md border border-line text-muted hover:bg-panel hover:text-ink" aria-label="요약 복사" title="요약 복사">
              <Clipboard className="h-4 w-4" />
            </button>
          ) : null}
          <button type="button" onClick={() => window.print()} className="flex h-9 w-9 items-center justify-center rounded-md border border-line text-muted hover:bg-panel hover:text-ink" aria-label="인쇄" title="인쇄">
            <Printer className="h-4 w-4" />
          </button>
          {onDownload ? (
            <button type="button" onClick={onDownload} className="inline-flex h-9 items-center gap-2 rounded-md bg-cobalt px-3 text-xs font-bold text-white hover:bg-[#1d4788]">
              <Download className="h-3.5 w-3.5" /> JSON 저장
            </button>
          ) : null}
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-10 print:max-w-none print:px-0 print:py-0">
        <div className="border-b-2 border-ink pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-cobalt">SupplyMap AI · Sourcing Report</p>
              <h2 className="mt-3 text-2xl font-bold leading-tight text-ink sm:text-3xl">{report.title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{report.subtitle}</p>
            </div>
            <div className="w-fit rounded border border-line bg-panel px-3 py-2 text-[11px] font-semibold text-muted">
              {report.dataMode === "mock" ? "Sample Data Mode" : "API Mode"}
            </div>
          </div>

          <div className="mt-5 grid gap-3 text-xs sm:grid-cols-4">
            <div><span className="block text-muted">제품</span><b className="mt-1 block text-ink">{report.input.productName}</b></div>
            <div><span className="block text-muted">품목군</span><b className="mt-1 block text-ink">{report.input.category}</b></div>
            <div><span className="block text-muted">HS 후보</span><b className="mt-1 block text-ink">{report.input.hsCode ?? report.input.hsCodeCandidates[0] ?? "확인 필요"}</b></div>
            <div><span className="block text-muted">생성시점</span><b className="mt-1 block text-ink">{report.generatedAt}</b></div>
          </div>
        </div>

        <section className="break-inside-avoid py-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Executive summary</p>
          <div className="mt-3 border-l-4 border-teal bg-teal/5 p-4">
            <p className="text-sm leading-7 text-ink">{report.executiveSummary}</p>
          </div>
        </section>

        <div className="break-inside-avoid border border-[#d7b24c] bg-[#fff9e8] p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber" />
            <h3 className="text-sm font-bold text-ink">검토 유의사항</h3>
          </div>
          <p className="mt-2 text-xs leading-5 text-[#735f2c]">{report.advisory}</p>
          <p className="mt-1 text-xs leading-5 text-[#735f2c]">
            현재 확보된 데이터에서는 확인된 리스크가 적더라도 안전하다는 뜻은 아니며, 계약 전 생산능력·인증서·통관요건 원문 확인이 필요합니다.
          </p>
        </div>

        {report.sections.map((section) => (
          <ReportSection key={section.id} section={section} onEvidence={onEvidence} />
        ))}

        <footer className="border-t-2 border-ink pt-5 text-[11px] leading-5 text-muted">
          <p className="font-bold text-ink">데이터 출처 요약</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {report.sourceSummary.slice(0, 8).map((source) => (
              <span key={source.id} className="inline-flex items-center gap-1 rounded border border-line px-2 py-1">
                <SourceBadge sourceType={source.sourceType} compact />
                {source.providerName} · {source.evidenceCount}건
              </span>
            ))}
          </div>
          <p className="mt-3">{report.advisory}</p>
        </footer>
      </div>
    </article>
  );
}
