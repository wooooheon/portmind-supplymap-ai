"use client";

import { AlertTriangle, Factory, Globe2, Loader2, MousePointer2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SourceBadge } from "@/components/SourceBadge";
import type { SupplySourceType } from "@/lib/supplymap/types";

type ChinaCategory =
  | "all"
  | "packaging"
  | "processed_food"
  | "agriculture"
  | "additive"
  | "seafood"
  | "health_food"
  | "cosmetics"
  | "electronics";

type ChinaFactoryPoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  province: string | null;
  city: string | null;
  address: string | null;
  categories: string[];
  products: string[];
  riskLevel: "UNKNOWN" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  geocodeProvider: string | null;
  geocodeConfidence: number | null;
  coordinateQuality: string;
  sourceType: SupplySourceType;
  sourceName: string;
  sourceDetail: string;
};

type ChinaMapSummary = {
  totalChinaFactories: number;
  totalWithCoordinates: number;
  matchedTotal: number;
  returnedPoints: number;
  coordinateCounts: Record<string, number>;
  sourceCounts: Record<string, number>;
  beta: boolean;
};

type ChinaMapResponse = {
  summary: ChinaMapSummary;
  points: ChinaFactoryPoint[];
};

const categories: Array<{ value: ChinaCategory; label: string; description: string }> = [
  { value: "all", label: "전체", description: "좌표가 있는 중국 공장 전체" },
  { value: "packaging", label: "기구·용기·포장", description: "가장 많은 중국 베타 데이터" },
  { value: "processed_food", label: "가공식품", description: "가공식품 해외제조업소" },
  { value: "agriculture", label: "농산물", description: "농산물 관련 제조/가공" },
  { value: "additive", label: "식품첨가물", description: "식품첨가물 관련 업체" },
  { value: "seafood", label: "수산물", description: "수산물 관련 업체" },
  { value: "health_food", label: "건강기능식품", description: "건강기능식품 관련 업체" },
  { value: "cosmetics", label: "화장품", description: "현재 샘플 수준" },
  { value: "electronics", label: "전자제품", description: "현재 샘플 수준" }
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function projectChinaPoint(latitude: number, longitude: number) {
  const left = clamp(((longitude - 73.5) / (135.2 - 73.5)) * 100, 3, 97);
  const top = clamp(((54.5 - latitude) / (54.5 - 18.0)) * 100, 3, 97);
  return { left, top };
}

function riskColor(risk: ChinaFactoryPoint["riskLevel"]) {
  if (risk === "HIGH" || risk === "CRITICAL") return "#b42318";
  if (risk === "MEDIUM" || risk === "UNKNOWN") return "#b7791f";
  return "#0f766e";
}

function sourceLabel(point: ChinaFactoryPoint) {
  return `${point.sourceName} · ${point.coordinateQuality}`;
}

function productText(point: ChinaFactoryPoint) {
  return point.products.slice(0, 4).join(", ") || point.categories.slice(0, 3).join(", ") || "품목 확인 필요";
}

function locationText(point: ChinaFactoryPoint) {
  return [point.country, point.province, point.city].filter(Boolean).join(" / ") || "위치 확인 필요";
}

function clusterPoints(points: ChinaFactoryPoint[]) {
  const clusters = new Map<string, { lat: number; lng: number; count: number; highRisk: number }>();
  for (const point of points) {
    const key = `${Math.round(point.latitude / 1.15)}:${Math.round(point.longitude / 1.15)}`;
    const current = clusters.get(key);
    if (current) {
      current.lat += point.latitude;
      current.lng += point.longitude;
      current.count += 1;
      if (point.riskLevel === "HIGH" || point.riskLevel === "CRITICAL") current.highRisk += 1;
    } else {
      clusters.set(key, {
        lat: point.latitude,
        lng: point.longitude,
        count: 1,
        highRisk: point.riskLevel === "HIGH" || point.riskLevel === "CRITICAL" ? 1 : 0
      });
    }
  }
  return Array.from(clusters.values())
    .map((cluster) => ({
      latitude: cluster.lat / cluster.count,
      longitude: cluster.lng / cluster.count,
      count: cluster.count,
      highRiskRatio: cluster.highRisk / cluster.count
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 180);
}

export function ChinaFactoryBetaHeatmap({ productName }: { productName: string }) {
  const [category, setCategory] = useState<ChinaCategory>("all");
  const [points, setPoints] = useState<ChinaFactoryPoint[]>([]);
  const [summary, setSummary] = useState<ChinaMapSummary | null>(null);
  const [selected, setSelected] = useState<ChinaFactoryPoint | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchPoints() {
      setStatus("loading");
      setError(null);
      const params = new URLSearchParams({
        category,
        limit: "3500"
      });
      if (productName.trim()) params.set("productName", productName.trim());
      try {
        const response = await fetch(`/api/supplymap/china-map?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`중국 공장 지도 데이터 HTTP ${response.status}`);
        const data = (await response.json()) as ChinaMapResponse;
        setPoints(data.points);
        setSummary(data.summary);
        setSelected(data.points[0] ?? null);
        setStatus("ready");
      } catch (cause) {
        if (controller.signal.aborted) return;
        setStatus("error");
        setError(cause instanceof Error ? cause.message : "중국 공장 지도 데이터 로드 실패");
      }
    }
    fetchPoints();
    return () => controller.abort();
  }, [category, productName]);

  const clusters = useMemo(() => clusterPoints(points), [points]);
  const markerPoints = useMemo(() => points.slice(0, 1800), [points]);
  const exactCount = summary?.coordinateCounts.AMap ?? 0;
  const cityEstimate = summary?.coordinateCounts["address-city-centroid"] ?? 0;
  const provinceEstimate = summary?.coordinateCounts["address-province-centroid"] ?? 0;

  return (
    <section className="overflow-hidden bg-white" aria-label="해외 공장 베타 중국 히트맵">
      <header className="flex flex-col gap-3 border-b border-line px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Globe2 className="h-4 w-4 text-amber" />
            <h3 className="text-sm font-bold text-ink">해외 공장 베타 히트맵 (중국)</h3>
            <SourceBadge sourceType="OTHER_PUBLIC" compact />
            <SourceBadge sourceType="PRIVATE" compact />
          </div>
          <p className="mt-1 text-xs leading-5 text-muted">
            현재 확보된 중국 공장 데이터를 품목 카테고리별로 표시합니다. 식품·포장 계열 데이터가 많고, 좌표는 추정값을 포함합니다.
          </p>
        </div>
        <span className="w-fit rounded-md border border-amber/30 bg-[#fff9e8] px-3 py-2 text-[11px] font-bold text-[#735f2c]">
          beta · 중국 중심 · 좌표 추정 포함
        </span>
      </header>

      <div className="border-b border-line bg-panel px-4 py-3">
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="중국 공장 카테고리">
          {categories.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setCategory(item.value)}
              title={item.description}
              className={
                "min-h-9 shrink-0 rounded-md border px-3 text-xs font-bold transition-colors " +
                (category === item.value ? "border-amber bg-white text-amber shadow-sm" : "border-line bg-white text-ink hover:bg-[#fff9e8]")
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-h-[520px] lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-b border-line p-4 lg:border-b-0 lg:border-r">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded border border-line bg-panel px-3 py-2">
              <p className="text-[10px] font-bold text-muted">전체 중국 공장</p>
              <p className="mt-1 text-lg font-bold text-ink">{(summary?.totalChinaFactories ?? 0).toLocaleString("ko-KR")}</p>
            </div>
            <div className="rounded border border-line bg-panel px-3 py-2">
              <p className="text-[10px] font-bold text-muted">현재 표시</p>
              <p className="mt-1 text-lg font-bold text-amber">{points.length.toLocaleString("ko-KR")}</p>
            </div>
            <div className="rounded border border-line bg-panel px-3 py-2">
              <p className="text-[10px] font-bold text-muted">주소 지오코딩</p>
              <p className="mt-1 text-lg font-bold text-teal">{exactCount.toLocaleString("ko-KR")}</p>
            </div>
            <div className="rounded border border-line bg-panel px-3 py-2">
              <p className="text-[10px] font-bold text-muted">중심좌표 추정</p>
              <p className="mt-1 text-lg font-bold text-muted">{(cityEstimate + provinceEstimate).toLocaleString("ko-KR")}</p>
            </div>
          </div>

          {selected ? (
            <article className="mt-4 rounded-md border border-line bg-white p-3">
              <div className="flex items-start gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber text-white">
                  <Factory className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold leading-5 text-ink">{selected.name}</h4>
                  <p className="mt-1 text-[11px] leading-5 text-muted">{locationText(selected)}</p>
                </div>
              </div>
              <dl className="mt-3 space-y-2 text-xs">
                <div>
                  <dt className="font-bold text-ink">품목</dt>
                  <dd className="mt-1 leading-5 text-muted">{productText(selected)}</dd>
                </div>
                <div>
                  <dt className="font-bold text-ink">주소</dt>
                  <dd className="mt-1 leading-5 text-muted">{selected.address ?? "주소 확인 필요"}</dd>
                </div>
                <div>
                  <dt className="font-bold text-ink">좌표 신뢰도</dt>
                  <dd className="mt-1 leading-5 text-muted">{selected.coordinateQuality}</dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-1">
                {selected.categories.slice(0, 5).map((item) => (
                  <span key={item} className="rounded border border-line bg-panel px-2 py-0.5 text-[11px] text-muted">
                    {item}
                  </span>
                ))}
              </div>
              <div className="mt-3 border-t border-line pt-3 text-[11px] leading-5 text-muted">
                {sourceLabel(selected)}
              </div>
            </article>
          ) : null}

          <div className="mt-4 flex items-start gap-2 rounded-md border border-amber/30 bg-[#fff9e8] px-3 py-2 text-[11px] leading-5 text-[#735f2c]">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>중국 베타 데이터는 국내 Supplier보다 원천·좌표·품목 세부성이 약합니다. 같은 품목군 비교와 후보 탐색용으로만 사용하세요.</p>
          </div>
        </aside>

        <div
          className="relative min-h-[520px] overflow-hidden bg-[#edf1f4]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(23,33,43,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(23,33,43,0.05) 1px, transparent 1px)",
            backgroundSize: "42px 42px"
          }}
        >
          <div className="absolute left-[14%] top-[11%] h-[76%] w-[72%] rounded-[48%] border border-white/80 bg-white/30 shadow-inner" />
          <div className="absolute left-[30%] top-[24%] h-[38%] w-[30%] rotate-[-12deg] rounded-[48%] border border-white/70 bg-amber/5" />
          <div className="absolute right-[13%] top-[42%] h-[30%] w-[20%] rotate-[18deg] rounded-[48%] border border-white/70 bg-teal/5" />

          {clusters.map((cluster) => {
            const position = projectChinaPoint(cluster.latitude, cluster.longitude);
            const size = Math.min(54, 8 + Math.sqrt(cluster.count) * 4.2);
            return (
              <div
                key={`${cluster.latitude}:${cluster.longitude}:${cluster.count}`}
                className="absolute rounded-full blur-sm"
                style={{
                  left: `${position.left}%`,
                  top: `${position.top}%`,
                  width: size,
                  height: size,
                  transform: "translate(-50%, -50%)",
                  backgroundColor: cluster.highRiskRatio > 0.12 ? "#ef9a85" : "#f2c94c",
                  opacity: Math.min(0.2, 0.055 + cluster.count / 1700)
                }}
              />
            );
          })}

          {markerPoints.map((point) => {
            const position = projectChinaPoint(point.latitude, point.longitude);
            const selectedPoint = selected?.id === point.id;
            return (
              <button
                key={point.id}
                type="button"
                title={`${point.name} · ${productText(point)}`}
                onClick={() => setSelected(point)}
                onMouseEnter={() => setSelected(point)}
                onFocus={() => setSelected(point)}
                className="absolute h-2.5 w-2.5 rounded-full border border-white shadow-sm transition-transform hover:z-20 hover:scale-150 focus:z-20 focus:scale-150 focus:outline-none focus:ring-2 focus:ring-amber"
                style={{
                  left: `${position.left}%`,
                  top: `${position.top}%`,
                  transform: "translate(-50%, -50%)",
                  backgroundColor: selectedPoint ? "#17212b" : riskColor(point.riskLevel)
                }}
                aria-label={`${point.name} 중국 공장 정보 보기`}
              />
            );
          })}

          {status === "loading" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <div className="flex items-center gap-2 rounded-md border border-line bg-white px-4 py-3 text-sm font-bold text-ink shadow-soft">
                <Loader2 className="h-4 w-4 animate-spin text-amber" /> 중국 베타 지도 데이터 로딩
              </div>
            </div>
          ) : null}

          {status === "error" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/85 p-5">
              <div className="max-w-md rounded-md border border-line bg-white p-5 text-sm shadow-soft">
                <div className="font-bold text-danger">중국 베타 지도 로드 실패</div>
                <p className="mt-2 text-xs leading-5 text-muted">{error}</p>
              </div>
            </div>
          ) : null}

          <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-md border border-line bg-white/95 px-3 py-2 text-[11px] font-bold text-muted shadow-soft">
            <MousePointer2 className="h-3.5 w-3.5" />
            hover/click · {markerPoints.length.toLocaleString("ko-KR")} visible markers
          </div>
        </div>
      </div>
    </section>
  );
}
