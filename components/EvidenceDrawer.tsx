"use client";

import { ExternalLink, FileSearch, X } from "lucide-react";
import { SourceBadge } from "@/components/SourceBadge";
import type { EvidenceRecord, SupplySourceType } from "@/lib/supplymap/types";

export type SupplyEvidence = {
  id: string;
  citation: string;
  title: string;
  provider: string;
  dataset: string;
  recordId: string;
  updatedAt: string;
  scope: "domestic" | "overseas";
  sourceType?: SupplySourceType;
  confidence: number;
  fields: Array<{ label: string; value: string }>;
  url?: string;
};

type DrawerEvidence = EvidenceRecord | SupplyEvidence;

function isSupplyEvidence(item: DrawerEvidence): item is SupplyEvidence {
  return "citation" in item;
}

function sourceTypeFor(item: DrawerEvidence): SupplySourceType {
  if (isSupplyEvidence(item)) return item.sourceType ?? (item.scope === "overseas" ? "PRIVATE" : "MOTIE_PUBLIC");
  return item.sourceType;
}

function titleFor(item: DrawerEvidence) {
  return item.title;
}

function snippetFor(item: DrawerEvidence) {
  if (isSupplyEvidence(item)) {
    return item.fields.map((field) => `${field.label}: ${field.value}`).join(" · ");
  }
  return item.snippet;
}

function providerFor(item: DrawerEvidence) {
  return isSupplyEvidence(item) ? item.provider : item.providerName;
}

function datasetFor(item: DrawerEvidence) {
  return isSupplyEvidence(item) ? item.dataset : item.datasetName;
}

function verificationFor(item: DrawerEvidence) {
  return isSupplyEvidence(item) ? `${item.confidence}% confidence` : item.verification;
}

function fetchedAtFor(item: DrawerEvidence) {
  return isSupplyEvidence(item) ? item.updatedAt : item.fetchedAt.slice(0, 10);
}

function licenseFor(item: DrawerEvidence) {
  return isSupplyEvidence(item) ? "샘플 스냅샷 · 원천 이용조건 확인 필요" : item.license;
}

function urlFor(item: DrawerEvidence) {
  return item.url;
}

export function EvidenceDrawer({
  open,
  onClose,
  evidence,
  selectedId,
  onSelect
}: {
  open: boolean;
  onClose: () => void;
  evidence: DrawerEvidence[];
  selectedId?: string;
  onSelect?: (id: string) => void;
}) {
  if (!open) return null;
  const selected = selectedId ? evidence.find((item) => item.id === selectedId) : undefined;
  const ordered = selected ? [selected, ...evidence.filter((item) => item.id !== selected.id)] : evidence;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/25" role="dialog" aria-modal="true" aria-label="Evidence Drawer">
      <button type="button" className="min-w-0 flex-1 cursor-default" onClick={onClose} aria-label="Close evidence drawer" />
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-line bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-5 py-4">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <FileSearch className="h-5 w-5 text-cobalt" />
              Evidence Drawer
            </div>
            <p className="mt-1 text-xs text-muted">{evidence.length}개 근거 레코드</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-line p-2" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-3 p-5">
          {ordered.map((item) => {
            const sourceType = sourceTypeFor(item);
            const url = urlFor(item);
            return (
            <article key={item.id} className={"rounded-md border p-4 " + (item.id === selectedId ? "border-cobalt bg-[#f7fbff]" : "border-line")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelect?.(item.id)}
                  className="text-left font-semibold hover:text-cobalt"
                >
                  {isSupplyEvidence(item) ? `${item.citation} ` : null}{titleFor(item)}
                </button>
                <SourceBadge sourceType={sourceType} />
              </div>
              <p className="mt-2 text-sm leading-6 text-ink">{snippetFor(item)}</p>
              <dl className="mt-3 grid gap-1 text-xs text-muted">
                <div>{providerFor(item)} · {datasetFor(item)}</div>
                <div>상태 {verificationFor(item)} · 수집 {fetchedAtFor(item)}</div>
                <div>이용조건: {licenseFor(item)}</div>
              </dl>
              {url && url !== "about:blank" ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-cobalt"
                >
                  원문 열기 <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </article>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
