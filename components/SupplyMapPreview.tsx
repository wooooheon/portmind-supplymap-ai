"use client";

import { useMemo, useState } from "react";
import { Factory, MapPin } from "lucide-react";
import { SourceBadge } from "@/components/SourceBadge";
import type { SupplierCandidate } from "@/lib/supplymap/types";

type Layer = "ALL" | "DOMESTIC" | "GLOBAL";

function markerPosition(candidate: SupplierCandidate) {
  const lat = candidate.latitude ?? (candidate.scope === "DOMESTIC" ? 36.2 : 24);
  const lng = candidate.longitude ?? (candidate.scope === "DOMESTIC" ? 127.8 : 114);
  return {
    left: Math.max(5, Math.min(95, ((lng - 110) / 22) * 100)),
    top: Math.max(8, Math.min(92, ((41 - lat) / 22) * 100))
  };
}

export function SupplyMapPreview({
  domestic,
  global
}: {
  domestic: SupplierCandidate[];
  global: SupplierCandidate[];
}) {
  const [layer, setLayer] = useState<Layer>("ALL");
  const [selected, setSelected] = useState<SupplierCandidate | null>(domestic[0] ?? global[0] ?? null);
  const candidates = useMemo(() => {
    if (layer === "DOMESTIC") return domestic;
    if (layer === "GLOBAL") return global;
    return [...domestic, ...global];
  }, [domestic, global, layer]);

  return (
    <section className="overflow-hidden rounded-md border border-line bg-white shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">국내외 공급망 지도</h2>
          <p className="mt-1 text-xs text-muted">국내 산업단지 우선 · 해외 공장 보조 레이어</p>
        </div>
        <div className="inline-flex rounded-md border border-line p-1">
          {(["ALL", "DOMESTIC", "GLOBAL"] as Layer[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setLayer(item)}
              className={
                "rounded px-3 py-1.5 text-xs " +
                (layer === item ? "bg-ink text-white" : "text-muted hover:bg-panel")
              }
            >
              {item === "ALL" ? "전체" : item === "DOMESTIC" ? "국내" : "해외"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid md:grid-cols-[220px_minmax(0,1fr)]">
        <div className="border-b border-line p-4 md:border-b-0 md:border-r">
          {selected ? (
            <div>
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-panel text-cobalt">
                <Factory className="h-5 w-5" />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="text-sm font-semibold">{selected.name}</div>
                <SourceBadge sourceType={selected.sourceType} compact />
              </div>
              <div className="mt-1 text-xs text-muted">{selected.countryName} · {selected.region} {selected.city}</div>
              <p className="mt-3 text-xs leading-5">{selected.matchReason}</p>
              <p className="mt-2 text-[11px] leading-5 text-muted">
                {selected.scope === "DOMESTIC" ? selected.industrialComplex ?? "국내 산업단지 연결 확인 필요" : "해외 Factory 보조 레이어"}
                {selected.address ? ` · ${selected.address}` : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                {selected.products.slice(0, 3).map((product) => (
                  <span key={product} className="rounded border border-line bg-panel px-2 py-0.5 text-[11px]">{product}</span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">표시할 후보가 없습니다.</p>
          )}
        </div>
        <div className="relative min-h-[360px] overflow-hidden bg-[#edf3f6]">
          <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(#cbd5dc_1px,transparent_1px),linear-gradient(90deg,#cbd5dc_1px,transparent_1px)] [background-size:48px_48px]" />
          <div className="absolute left-[58%] top-[20%] h-[48%] w-[24%] rounded-[45%] border border-white/80 bg-white/55" />
          <div className="absolute left-[18%] top-[40%] h-[43%] w-[40%] rounded-[48%] border border-white/80 bg-white/45" />
          <span className="absolute left-[68%] top-[30%] text-xs font-semibold text-muted">KOREA</span>
          <span className="absolute left-[30%] top-[58%] text-xs font-semibold text-muted">CHINA / ASIA</span>
          {candidates.map((candidate) => {
            const position = markerPosition(candidate);
            const active = selected?.id === candidate.id;
            return (
              <button
                key={candidate.id}
                type="button"
                onClick={() => setSelected(candidate)}
                title={candidate.name}
                className={
                  "absolute z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white shadow-lg transition " +
                  (candidate.scope === "DOMESTIC" ? "bg-cobalt text-white" : "bg-amber text-white") +
                  (active ? " scale-125 ring-4 ring-white/70" : "")
                }
                style={{ left: position.left + "%", top: position.top + "%" }}
              >
                <MapPin className="h-4 w-4" />
              </button>
            );
          })}
          <div className="absolute bottom-3 right-3 rounded-md border border-line bg-white/95 px-3 py-2 text-[11px] text-muted shadow-soft">
            <span className="mr-3 text-cobalt">● 국내 산업단지·공장 공공데이터</span>
            <span className="text-amber">● 해외 Factory 보조 데이터</span>
          </div>
        </div>
      </div>
    </section>
  );
}
