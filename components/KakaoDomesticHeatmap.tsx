"use client";

import { AlertTriangle, Factory, Loader2, MapPinned, MousePointer2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { SourceBadge } from "@/components/SourceBadge";
import type { SupplySourceType, VerificationStatus } from "@/lib/supplymap/types";

type DomesticMapPoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  region: string | null;
  city: string | null;
  address: string | null;
  products: string[];
  hsCodes: string[];
  industrialComplex: string | null;
  industries: string[];
  matchScore: number;
  coordinateSource: "SUPPLIER" | "INDUSTRIAL_COMPLEX" | "REGION_FALLBACK";
  providerName: string;
  datasetName: string;
  sourceType: SupplySourceType;
  sourceUrl: string;
  fetchedAt: string;
  license: string;
  verification: VerificationStatus;
};

type DomesticMapSummary = {
  totalDomesticSuppliers: number;
  returnedPoints: number;
  matchedPoints: number;
  coordinateCounts: Record<DomesticMapPoint["coordinateSource"], number>;
  primarySourceType: "MOTIE_PUBLIC";
};

type DomesticMapResponse = {
  summary: DomesticMapSummary;
  points: DomesticMapPoint[];
};

type AnalysisMapCandidate = {
  id: string;
  name: string;
  products?: string[];
  score?: number;
};

type HeatMode = "matched" | "all";
type DomesticCategory = "all" | "cosmetics" | "food_packaging" | "electric_electronics" | "medical_device" | "drone_parts";

type KakaoLatLng = object;
type KakaoMarkerImage = object;
type KakaoSize = object;
type KakaoPoint = object;

type KakaoMap = {
  setBounds: (bounds: object) => void;
  panTo: (latLng: KakaoLatLng) => void;
};

type KakaoOverlay = {
  setMap: (map: KakaoMap | null) => void;
};

type KakaoMarker = KakaoOverlay;

type KakaoInfoWindow = KakaoOverlay & {
  open: (map: KakaoMap, marker: KakaoMarker) => void;
};

type KakaoMapsNamespace = {
  load: (callback: () => void) => void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => {
    extend: (latLng: KakaoLatLng) => void;
  };
  Map: new (
    container: HTMLElement,
    options: {
      center: KakaoLatLng;
      level: number;
    }
  ) => KakaoMap;
  Marker: new (options: {
    position: KakaoLatLng;
    title?: string;
    clickable?: boolean;
    image?: KakaoMarkerImage;
  }) => KakaoMarker;
  MarkerImage: new (src: string, size: KakaoSize, options?: { offset?: KakaoPoint }) => KakaoMarkerImage;
  Size: new (width: number, height: number) => KakaoSize;
  Point: new (x: number, y: number) => KakaoPoint;
  InfoWindow: new (options: { content: string; position?: KakaoLatLng; removable?: boolean }) => KakaoInfoWindow;
  Circle: new (options: {
    center: KakaoLatLng;
    radius: number;
    strokeWeight: number;
    strokeColor: string;
    strokeOpacity: number;
    fillColor: string;
    fillOpacity: number;
  }) => KakaoOverlay;
  event: {
    addListener: (target: KakaoOverlay, eventName: "mouseover" | "mouseout" | "click", handler: () => void) => void;
  };
};

declare global {
  interface Window {
    kakao?: {
      maps?: KakaoMapsNamespace;
    };
  }
}

const kakaoJsKey = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY ?? "";

const domesticCategories: Array<{ value: DomesticCategory; label: string; description: string }> = [
  { value: "all", label: "전체", description: "등록된 국내 공장 전체" },
  { value: "cosmetics", label: "화장품", description: "화장품·용기·패키징" },
  { value: "food_packaging", label: "식품 포장", description: "식품용기·포장재" },
  { value: "electric_electronics", label: "전기·전자", description: "전열·LED·PCB" },
  { value: "medical_device", label: "의료·바이오", description: "의료기기·제약·헬스" },
  { value: "drone_parts", label: "드론·부품", description: "드론·항공·전장" }
];

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function heatColor(score: number) {
  if (score >= 70) return "#1f5fbf";
  if (score >= 45) return "#0f766e";
  return "#d2911b";
}

function heatFillColor(score: number) {
  if (score >= 70) return "#7aa7df";
  if (score >= 45) return "#7bc8bf";
  return "#f2b6a6";
}

function markerSvgDataUrl(color: string, selected = false) {
  const stroke = selected ? "#17212b" : "#ffffff";
  const width = selected ? 18 : 14;
  const height = selected ? 22 : 18;
  const radius = selected ? 5.4 : 4.2;
  const cx = width / 2;
  const cy = selected ? 6.4 : 5.4;
  const tipY = height - 1;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <path d="M${cx} ${tipY} L${cx - 3.2} ${cy + 4.5} A${radius} ${radius} 0 1 1 ${cx + 3.2} ${cy + 4.5} Z"
        fill="${color}" stroke="${stroke}" stroke-width="${selected ? 2.2 : 1.6}" />
      <circle cx="${cx}" cy="${cy}" r="${selected ? 2 : 1.5}" fill="#fff" opacity="0.92" />
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function coordinateSourceLabel(source: DomesticMapPoint["coordinateSource"]) {
  if (source === "SUPPLIER") return "공장 주소 좌표";
  if (source === "INDUSTRIAL_COMPLEX") return "산업단지 좌표 기반";
  return "지역 중심 좌표 기반";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function short(value: string, limit = 42) {
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

function productText(point: DomesticMapPoint) {
  return point.products.filter(Boolean).slice(0, 4).join(", ") || "생산품 확인 필요";
}

function infoContent(point: DomesticMapPoint) {
  return `
    <div style="width:260px;padding:12px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.45">
      <div style="font-size:13px;font-weight:800;color:#17212b">${escapeHtml(point.name)}</div>
      <div style="margin-top:4px;font-size:11px;color:#66727f">${escapeHtml([point.region, point.city, point.industrialComplex].filter(Boolean).join(" · "))}</div>
      <div style="margin-top:8px;font-size:12px;color:#1f2a37">${escapeHtml(short(productText(point), 80))}</div>
      <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;font-size:10px">
        <span style="border:1px solid #d8e0e6;border-radius:999px;padding:2px 6px;color:#2457a6">match ${point.matchScore}</span>
        <span style="border:1px solid #d8e0e6;border-radius:999px;padding:2px 6px;color:#0f766e">${escapeHtml(coordinateSourceLabel(point.coordinateSource))}</span>
      </div>
    </div>
  `;
}

function resolveLoadedKakaoMaps(resolve: (maps: KakaoMapsNamespace) => void, reject: (error: Error) => void) {
  const maps = window.kakao?.maps;
  if (!maps) {
    reject(
      new Error(
        "Kakao Maps SDK 응답에 window.kakao.maps가 없습니다. 현재 접속 origin의 JavaScript SDK 도메인 등록과 Kakao 지도/로컬 서비스 활성화 상태를 확인하세요."
      )
    );
    return;
  }
  maps.load(() => resolve(maps));
}

function loadKakaoMaps(): Promise<KakaoMapsNamespace> {
  return new Promise((resolve, reject) => {
    if (window.kakao?.maps) {
      window.kakao.maps.load(() => resolve(window.kakao?.maps as KakaoMapsNamespace));
      return;
    }
    if (!kakaoJsKey) {
      reject(new Error("NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY가 없습니다."));
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>("script[data-kakao-map-sdk='true']");
    if (existing) {
      if (window.kakao?.maps) {
        resolveLoadedKakaoMaps(resolve, reject);
        return;
      }
      existing.addEventListener("load", () => resolveLoadedKakaoMaps(resolve, reject));
      existing.addEventListener("error", () => reject(new Error("Kakao Maps SDK 로드 실패")));
      return;
    }
    const script = document.createElement("script");
    script.dataset.kakaoMapSdk = "true";
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(kakaoJsKey)}&autoload=false&libraries=services,clusterer`;
    script.addEventListener("load", () => resolveLoadedKakaoMaps(resolve, reject));
    script.addEventListener("error", () => reject(new Error("Kakao Maps SDK 로드 실패")));
    document.head.appendChild(script);
  });
}

function clusterPoints(points: DomesticMapPoint[]) {
  const grid = new Map<
    string,
    {
      lat: number;
      lng: number;
      count: number;
      scoreSum: number;
      directCount: number;
    }
  >();
  for (const point of points) {
    const key = `${Math.round(point.latitude / 0.085)}:${Math.round(point.longitude / 0.085)}`;
    const existing = grid.get(key);
    if (existing) {
      existing.lat += point.latitude;
      existing.lng += point.longitude;
      existing.count += 1;
      existing.scoreSum += point.matchScore;
      if (point.coordinateSource === "SUPPLIER") existing.directCount += 1;
    } else {
      grid.set(key, {
        lat: point.latitude,
        lng: point.longitude,
        count: 1,
        scoreSum: point.matchScore,
        directCount: point.coordinateSource === "SUPPLIER" ? 1 : 0
      });
    }
  }
  return Array.from(grid.values())
    .map((cluster) => ({
      latitude: cluster.lat / cluster.count,
      longitude: cluster.lng / cluster.count,
      count: cluster.count,
      avgScore: cluster.scoreSum / cluster.count,
      directCount: cluster.directCount
    }))
    .sort((left, right) => right.count - left.count || right.avgScore - left.avgScore)
    .slice(0, 180);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function projectKoreaPoint(latitude: number, longitude: number) {
  const left = clamp(((longitude - 124.4) / (131.9 - 124.4)) * 100, 4, 96);
  const top = clamp(((39.2 - latitude) / (39.2 - 33.0)) * 100, 4, 96);
  return { left, top };
}

function FallbackDomesticMap({
  points,
  selectedId,
  error,
  onSelect
}: {
  points: DomesticMapPoint[];
  selectedId: string | null;
  error: string | null;
  onSelect: (point: DomesticMapPoint) => void;
}) {
  const currentOrigin = typeof window === "undefined" ? "브라우저 origin 확인 필요" : window.location.origin;
  const clusters = useMemo(() => clusterPoints(points).slice(0, 120), [points]);
  const markerPoints = useMemo(() => points, [points]);

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-[#e8f0f4]"
      style={{
        backgroundImage:
          "linear-gradient(rgba(31,95,191,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(31,95,191,0.06) 1px, transparent 1px)",
        backgroundSize: "44px 44px"
      }}
      aria-label="Kakao 지도 fallback 국내 공장 히트맵"
    >
      <div className="absolute left-[18%] top-[10%] h-[86%] w-[62%] rounded-[48%] border border-white/80 bg-white/28 shadow-inner" />
      <div className="absolute left-[24%] top-[18%] h-[64%] w-[48%] rounded-[48%] border border-white/60 bg-cobalt/5" />

      {clusters.map((cluster) => {
        const position = projectKoreaPoint(cluster.latitude, cluster.longitude);
        const size = Math.min(42, 10 + cluster.count * 1.4);
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
              backgroundColor: heatFillColor(cluster.avgScore),
              opacity: Math.min(0.16, 0.04 + cluster.count / 900)
            }}
          />
        );
      })}

      {markerPoints.map((point) => {
        const position = projectKoreaPoint(point.latitude, point.longitude);
        const isSelected = selectedId === point.id;
        return (
          <button
            key={point.id}
            type="button"
            title={`${point.name} · ${productText(point)}`}
            onClick={() => onSelect(point)}
            onMouseEnter={() => onSelect(point)}
            onFocus={() => onSelect(point)}
            className="absolute h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm transition-transform hover:z-20 hover:scale-150 focus:z-20 focus:scale-150 focus:outline-none focus:ring-2 focus:ring-cobalt"
            style={{
              left: `${position.left}%`,
              top: `${position.top}%`,
              transform: "translate(-50%, -50%)",
              backgroundColor: isSelected ? "#17212b" : heatColor(point.matchScore)
            }}
            aria-label={`${point.name} 공장 정보 보기`}
          />
        );
      })}

      <div className="absolute left-4 top-4 max-w-sm rounded-md border border-amber/40 bg-white/95 p-3 text-xs shadow-soft backdrop-blur">
        <div className="flex items-center gap-2 font-bold text-[#7a5b12]">
          <AlertTriangle className="h-4 w-4" /> Kakao 지도 승인 대기
        </div>
        <p className="mt-2 leading-5 text-muted">
          Kakao SDK 연결 전에도 국내 공장 데이터는 fallback 히트맵으로 표시합니다. 카카오 개발자 콘솔에서 지도/로컬 서비스를 활성화하고
          현재 접속 origin을 JavaScript SDK 도메인에 등록하면 실제 Kakao Map으로 자동 전환됩니다.
        </p>
        <p className="mt-2 rounded bg-panel px-2 py-1 font-mono text-[10px] text-muted">current origin: {currentOrigin}</p>
        {error ? <p className="mt-2 rounded bg-panel px-2 py-1 font-mono text-[10px] text-muted">{error}</p> : null}
      </div>

      <div className="absolute bottom-4 right-4 rounded-md border border-line bg-white/95 px-3 py-2 text-[11px] font-bold text-muted shadow-soft">
        fallback view · {points.length.toLocaleString("ko-KR")} domestic points
      </div>
    </div>
  );
}

export function KakaoDomesticHeatmap({
  productName,
  hsCode,
  analysisCandidates
}: {
  productName: string;
  hsCode?: string;
  analysisCandidates: AnalysisMapCandidate[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const overlaysRef = useRef<KakaoOverlay[]>([]);
  const activeInfoRef = useRef<KakaoInfoWindow | null>(null);
  const [points, setPoints] = useState<DomesticMapPoint[]>([]);
  const [summary, setSummary] = useState<DomesticMapSummary | null>(null);
  const [selected, setSelected] = useState<DomesticMapPoint | null>(null);
  const [mode, setMode] = useState<HeatMode>("all");
  const [category, setCategory] = useState<DomesticCategory>("all");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const analysisIds = useMemo(() => new Set(analysisCandidates.map((candidate) => candidate.id)), [analysisCandidates]);
  const visiblePoints = useMemo(() => {
    const matched = points.filter((point) => point.matchScore >= 34 || analysisIds.has(point.id));
    return mode === "matched" ? (matched.length ? matched : points.slice(0, 500)) : points;
  }, [analysisIds, mode, points]);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchPoints() {
      setStatus("loading");
      setError(null);
      const params = new URLSearchParams({
        productName,
        limit: "4000",
        category
      });
      if (hsCode) params.set("hsCode", hsCode);
      try {
        const response = await fetch(`/api/supplymap/domestic-map?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`국내 공장 지도 데이터 HTTP ${response.status}`);
        const data = (await response.json()) as DomesticMapResponse;
        setPoints(data.points);
        setSummary(data.summary);
        setSelected(data.points[0] ?? null);
        setStatus("ready");
      } catch (fetchError) {
        if (controller.signal.aborted) return;
        setStatus("error");
        setError(fetchError instanceof Error ? fetchError.message : "국내 공장 지도 데이터 로드 실패");
      }
    }
    fetchPoints();
    return () => controller.abort();
  }, [category, hsCode, productName]);

  useEffect(() => {
    if (!containerRef.current || status !== "ready") return;
    let disposed = false;
    async function renderMap() {
      try {
        const kakao = await loadKakaoMaps();
        if (disposed || !containerRef.current) return;
        const center = new kakao.LatLng(36.35, 127.85);
        const map = mapRef.current ?? new kakao.Map(containerRef.current, { center, level: 13 });
        mapRef.current = map;
        for (const overlay of overlaysRef.current) overlay.setMap(null);
        overlaysRef.current = [];
        activeInfoRef.current?.setMap(null);
        activeInfoRef.current = null;

        const bounds = new kakao.LatLngBounds();
        const clusters = clusterPoints(visiblePoints);
        for (const cluster of clusters) {
          const position = new kakao.LatLng(cluster.latitude, cluster.longitude);
          const circle = new kakao.Circle({
            center: position,
            radius: Math.min(14000, 1200 + cluster.count * 190),
            strokeWeight: 0,
            strokeColor: heatFillColor(cluster.avgScore),
            strokeOpacity: 0,
            fillColor: heatFillColor(cluster.avgScore),
            fillOpacity: Math.min(0.12, 0.025 + cluster.count / 1200)
          });
          circle.setMap(map);
          overlaysRef.current.push(circle);
          bounds.extend(position);
        }

        const pointMarkers = [...visiblePoints].sort(
          (left, right) =>
            (analysisIds.has(right.id) ? 1000 : 0) +
            right.matchScore +
            (right.coordinateSource === "SUPPLIER" ? 20 : 0) -
            ((analysisIds.has(left.id) ? 1000 : 0) + left.matchScore + (left.coordinateSource === "SUPPLIER" ? 20 : 0))
        );
        const markerImages = {
          high: new kakao.MarkerImage(markerSvgDataUrl("#1f5fbf"), new kakao.Size(14, 18), { offset: new kakao.Point(7, 17) }),
          mid: new kakao.MarkerImage(markerSvgDataUrl("#0f766e"), new kakao.Size(14, 18), { offset: new kakao.Point(7, 17) }),
          low: new kakao.MarkerImage(markerSvgDataUrl("#d2911b"), new kakao.Size(14, 18), { offset: new kakao.Point(7, 17) }),
          fallback: new kakao.MarkerImage(markerSvgDataUrl("#8b95a1"), new kakao.Size(14, 18), { offset: new kakao.Point(7, 17) }),
          selected: new kakao.MarkerImage(markerSvgDataUrl("#17212b", true), new kakao.Size(18, 22), { offset: new kakao.Point(9, 21) })
        };
        const markerImageForPoint = (point: DomesticMapPoint) => {
          if (analysisIds.has(point.id)) return markerImages.selected;
          if (point.coordinateSource !== "SUPPLIER") return markerImages.fallback;
          if (point.matchScore >= 70) return markerImages.high;
          if (point.matchScore >= 45) return markerImages.mid;
          return markerImages.low;
        };
        for (const point of pointMarkers) {
          const position = new kakao.LatLng(point.latitude, point.longitude);
          const marker = new kakao.Marker({
            position,
            title: point.name,
            clickable: true,
            image: markerImageForPoint(point)
          });
          marker.setMap(map);
          overlaysRef.current.push(marker);
          kakao.event.addListener(marker, "mouseover", () => {
            activeInfoRef.current?.setMap(null);
            const info = new kakao.InfoWindow({
              position,
              content: infoContent(point),
              removable: false
            });
            info.setMap(map);
            activeInfoRef.current = info;
            setSelected(point);
          });
          kakao.event.addListener(marker, "mouseout", () => {
            activeInfoRef.current?.setMap(null);
            activeInfoRef.current = null;
          });
          kakao.event.addListener(marker, "click", () => {
            setSelected(point);
            map.panTo(position);
            activeInfoRef.current?.setMap(null);
            const info = new kakao.InfoWindow({
              position,
              content: infoContent(point),
              removable: false
            });
            info.setMap(map);
            activeInfoRef.current = info;
          });
          bounds.extend(position);
        }
        if (visiblePoints.length > 0) map.setBounds(bounds);
      } catch (renderError) {
        if (disposed) return;
        setError(renderError instanceof Error ? renderError.message : "Kakao 지도 렌더링 실패");
        setStatus("error");
      }
    }
    renderMap();
    return () => {
      disposed = true;
      for (const overlay of overlaysRef.current) overlay.setMap(null);
      overlaysRef.current = [];
      activeInfoRef.current?.setMap(null);
      activeInfoRef.current = null;
    };
  }, [analysisIds, status, visiblePoints]);

  const directCount = summary?.coordinateCounts.SUPPLIER ?? 0;
  const complexCount = summary?.coordinateCounts.INDUSTRIAL_COMPLEX ?? 0;
  const fallbackCount = summary?.coordinateCounts.REGION_FALLBACK ?? 0;

  return (
    <section className="overflow-hidden bg-white" aria-label="Kakao 국내 공장 히트맵">
      <header className="flex flex-col gap-3 border-b border-line px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <MapPinned className="h-4 w-4 text-cobalt" />
            <h3 className="text-sm font-bold text-ink">국내 공장 히트맵</h3>
            <SourceBadge sourceType="MOTIE_PUBLIC" compact />
          </div>
          <p className="mt-1 text-xs leading-5 text-muted">
            한국산업단지공단 국내 Supplier 데이터를 Kakao 지도 위에 표시합니다. 카테고리를 누르면 관련 공장만 따로 볼 수 있습니다.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex w-fit items-center gap-1 rounded-md bg-panel p-1" aria-label="국내 지도 표시 모드">
            {([
              ["matched", "제품 매칭"],
              ["all", "전체 공장"]
            ] as Array<[HeatMode, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={
                  "inline-flex min-h-8 items-center rounded px-3 text-xs font-bold " +
                  (mode === value ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink")
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="border-b border-line bg-panel px-4 py-3">
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="국내 공장 카테고리">
          {domesticCategories.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setCategory(item.value)}
              title={item.description}
              className={
                "min-h-9 shrink-0 rounded-md border px-3 text-xs font-bold transition-colors " +
                (category === item.value ? "border-cobalt bg-white text-cobalt shadow-sm" : "border-line bg-white text-ink hover:bg-[#eef4fb]")
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
              <p className="text-[10px] font-bold text-muted">표시 공장</p>
              <p className="mt-1 text-lg font-bold text-ink">{visiblePoints.length.toLocaleString("ko-KR")}</p>
            </div>
            <div className="rounded border border-line bg-panel px-3 py-2">
              <p className="text-[10px] font-bold text-muted">제품 매칭</p>
              <p className="mt-1 text-lg font-bold text-cobalt">{(summary?.matchedPoints ?? 0).toLocaleString("ko-KR")}</p>
            </div>
            <div className="rounded border border-line bg-panel px-3 py-2">
              <p className="text-[10px] font-bold text-muted">주소 좌표</p>
              <p className="mt-1 text-lg font-bold text-teal">{directCount.toLocaleString("ko-KR")}</p>
            </div>
            <div className="rounded border border-line bg-panel px-3 py-2">
              <p className="text-[10px] font-bold text-muted">보조 좌표</p>
              <p className="mt-1 text-lg font-bold text-amber">{(complexCount + fallbackCount).toLocaleString("ko-KR")}</p>
            </div>
          </div>

          {selected ? (
            <article className="mt-4 rounded-md border border-line bg-white p-3">
              <div className="flex items-start gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-cobalt text-white">
                  <Factory className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold leading-5 text-ink">{selected.name}</h4>
                  <p className="mt-1 text-[11px] leading-5 text-muted">
                    {[selected.region, selected.city, selected.industrialComplex].filter(Boolean).join(" · ") || "위치 확인 필요"}
                  </p>
                </div>
              </div>
              <dl className="mt-3 space-y-2 text-xs">
                <div>
                  <dt className="font-bold text-ink">생산품</dt>
                  <dd className="mt-1 leading-5 text-muted">{productText(selected)}</dd>
                </div>
                <div>
                  <dt className="font-bold text-ink">주소</dt>
                  <dd className="mt-1 leading-5 text-muted">{selected.address ?? "주소 확인 필요"}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="font-bold text-ink">매칭 점수</dt>
                  <dd className="font-bold text-cobalt">{selected.matchScore}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="font-bold text-ink">좌표 기준</dt>
                  <dd className="text-right text-muted">{coordinateSourceLabel(selected.coordinateSource)}</dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-1">
                {selected.products.slice(0, 5).map((product) => (
                  <span key={product} className="rounded border border-line bg-panel px-2 py-0.5 text-[11px] text-muted">
                    {product}
                  </span>
                ))}
              </div>
              <div className="mt-3 border-t border-line pt-3 text-[11px] leading-5 text-muted">
                {selected.providerName} · {selected.datasetName} · {formatDate(selected.fetchedAt)}
              </div>
            </article>
          ) : null}

          <div className="mt-4 flex items-start gap-2 rounded-md border border-amber/30 bg-[#fff9e8] px-3 py-2 text-[11px] leading-5 text-[#735f2c]">
            <MousePointer2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>마커에 올리면 공장명·생산품이 뜹니다. 좌표가 없는 공장은 산업단지 또는 지역 중심 좌표로 임시 표시됩니다.</p>
          </div>
        </aside>

        <div className="relative min-h-[520px] bg-[#eef3f6]">
          {status === "error" ? (
            <FallbackDomesticMap points={visiblePoints} selectedId={selected?.id ?? null} error={error} onSelect={setSelected} />
          ) : (
            <div ref={containerRef} className="h-full min-h-[520px] w-full" />
          )}
          {status === "loading" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <div className="flex items-center gap-2 rounded-md border border-line bg-white px-4 py-3 text-sm font-bold text-ink shadow-soft">
                <Loader2 className="h-4 w-4 animate-spin text-cobalt" /> Kakao 지도 데이터 로딩
              </div>
            </div>
          ) : null}
          {status === "error" ? (
            <div className="absolute bottom-4 left-4 rounded-md border border-line bg-white/95 p-3 text-sm shadow-soft">
              <div className="flex items-center gap-2 font-bold text-ink">
                <RefreshCw className="h-4 w-4 text-cobalt" /> 실제 Kakao Map 다시 연결
              </div>
              <p className="mt-1 max-w-xs text-xs leading-5 text-muted">카카오 앱 설정을 변경한 뒤 다시 시도하세요.</p>
                <button
                  type="button"
                  onClick={() => {
                    setStatus("loading");
                    window.location.reload();
                  }}
                  className="mt-3 inline-flex min-h-8 items-center gap-1.5 rounded-md border border-line px-3 text-xs font-bold text-ink hover:bg-panel"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> 다시 시도
                </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
