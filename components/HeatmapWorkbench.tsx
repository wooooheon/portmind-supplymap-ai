"use client";

import { AlertTriangle, Factory as FactoryIcon, Flame, MapPinned, MousePointer2, Tags } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type HeatmapFactory = {
  id: string;
  canonicalName: string;
  country: string;
  province: string | null;
  city: string | null;
  addressRaw: string | null;
  addressNormalized: string | null;
  latitude: number | null;
  longitude: number | null;
  riskLevel: "UNKNOWN" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  geocodeProvider: string | null;
  geocodeConfidence: number | null;
  sourceTagsJson: string | null;
  products: Array<{
    category: string | null;
    productName: string;
  }>;
};

type FactoryMapInfo = {
  id: string;
  name: string;
  category: string;
  feature: string;
  address: string;
  location: string;
  sourceLabel: string;
  confidenceLabel: string;
  riskLevel: HeatmapFactory["riskLevel"];
};

type AMapMap = {
  destroy: () => void;
  setFitView: () => void;
};

type AMapMarker = {
  on?: (eventName: "mouseover" | "click", handler: () => void) => void;
};

type AMapNamespace = {
  Map: new (
    container: HTMLElement,
    options: {
      zoom?: number;
      center?: [number, number];
      viewMode?: string;
      mapStyle?: string;
      resizeEnable?: boolean;
    }
  ) => AMapMap;
  Marker: new (options: {
    map: AMapMap;
    position: [number, number];
    title?: string;
    content?: string;
    offset?: unknown;
  }) => AMapMarker;
  Pixel: new (x: number, y: number) => unknown;
  HeatMap?: new (
    map: AMapMap,
    options: { radius?: number; opacity?: [number, number]; gradient?: Record<number, string> }
  ) => {
    setDataSet: (data: { data: Array<{ lng: number; lat: number; count: number }>; max: number }) => void;
  };
  plugin: (plugins: string[], callback: () => void) => void;
};

type GoogleMapsNamespace = {
  Map: new (
    container: HTMLElement,
    options: {
      zoom?: number;
      center?: { lat: number; lng: number };
      mapTypeId?: string;
      fullscreenControl?: boolean;
      streetViewControl?: boolean;
      mapTypeControl?: boolean;
    }
  ) => {
    fitBounds: (bounds: unknown) => void;
  };
  Marker: new (options: {
    map: unknown;
    position: { lat: number; lng: number };
    title?: string;
    icon?: unknown;
  }) => {
    addListener: (eventName: "mouseover" | "mouseout" | "click", handler: () => void) => void;
  };
  InfoWindow: new () => {
    setContent: (content: string) => void;
    open: (args: { map: unknown; anchor: unknown }) => void;
    close: () => void;
  };
  LatLng: new (lat: number, lng: number) => unknown;
  LatLngBounds: new () => {
    extend: (position: { lat: number; lng: number }) => void;
  };
  Circle: new (options: {
    map: unknown;
    center: { lat: number; lng: number };
    radius: number;
    strokeOpacity: number;
    fillColor: string;
    fillOpacity: number;
    clickable: boolean;
  }) => unknown;
  SymbolPath: {
    CIRCLE: unknown;
  };
};

type MapPoint = {
  id: string;
  title: string;
  lng: number;
  lat: number;
  riskLevel: HeatmapFactory["riskLevel"];
  count: number;
  info: FactoryMapInfo;
};

declare global {
  interface Window {
    AMap?: AMapNamespace;
    _AMapSecurityConfig?: {
      securityJsCode?: string;
    };
    google?: {
      maps?: GoogleMapsNamespace;
    };
  }
}

const pi = Math.PI;
const earthA = 6378245.0;
const earthEe = 0.00669342162296594323;

function outOfChina(lat: number, lng: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x: number, y: number): number {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * pi) + 20.0 * Math.sin(2.0 * x * pi)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(y * pi) + 40.0 * Math.sin((y / 3.0) * pi)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((y / 12.0) * pi) + 320 * Math.sin((y * pi) / 30.0)) * 2.0) / 3.0;
  return ret;
}

function transformLng(x: number, y: number): number {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * pi) + 20.0 * Math.sin(2.0 * x * pi)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(x * pi) + 40.0 * Math.sin((x / 3.0) * pi)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((x / 12.0) * pi) + 300.0 * Math.sin((x / 30.0) * pi)) * 2.0) / 3.0;
  return ret;
}

function wgs84ToGcj02(lng: number, lat: number): [number, number] {
  if (outOfChina(lat, lng)) return [lng, lat];
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * pi;
  let magic = Math.sin(radLat);
  magic = 1 - earthEe * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((earthA * (1 - earthEe)) / (magic * sqrtMagic)) * pi);
  dLng = (dLng * 180.0) / ((earthA / sqrtMagic) * Math.cos(radLat) * pi);
  return [lng + dLng, lat + dLat];
}

function riskColor(riskLevel: HeatmapFactory["riskLevel"]) {
  if (riskLevel === "HIGH" || riskLevel === "CRITICAL") return "#b42318";
  if (riskLevel === "MEDIUM" || riskLevel === "UNKNOWN") return "#b7791f";
  return "#0f766e";
}

function riskWeight(riskLevel: HeatmapFactory["riskLevel"]) {
  if (riskLevel === "HIGH" || riskLevel === "CRITICAL") return 100;
  if (riskLevel === "MEDIUM") return 70;
  if (riskLevel === "UNKNOWN") return 45;
  return 35;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
}

function factoryCategories(factory: HeatmapFactory) {
  return uniqueNonEmpty(factory.products.map((product) => product.category));
}

function primaryCategory(factory: HeatmapFactory) {
  return factoryCategories(factory)[0] ?? "미분류";
}

function shortText(value: string, maxLength = 22) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function factoryFeature(factory: HeatmapFactory) {
  const products = uniqueNonEmpty(factory.products.map((product) => product.productName)).slice(0, 2);
  if (factory.sourceTagsJson?.includes("mfds_medical_device_items")) {
    return shortText(products[0] ? `${products[0]} 품목` : "의료기기 품목/허가");
  }
  if (factory.sourceTagsJson?.includes("xlsx_overseas_food_facilities_20260621")) {
    return shortText(products[0] ? `${products[0]} 취급` : "해외제조업소");
  }
  if (factory.sourceTagsJson?.includes("mfds_import_food_foreign_manufacturers")) {
    return shortText(products[0] ? `${products[0]} 제조` : "수입식품 제조");
  }
  if (products.length > 0) return shortText(products.join(", "));
  const category = primaryCategory(factory);
  return category === "미분류" ? "공장 정보" : `${category} 제조`;
}

function sourceLabel(factory: HeatmapFactory) {
  const tags = factory.sourceTagsJson ?? "";
  if (tags.includes("mfds_medical_device_items")) return "MFDS 의료기기 API";
  if (tags.includes("xlsx_overseas_food_facilities_20260621")) return "MFDS 해외제조업소 엑셀";
  if (tags.includes("mfds_import_food_foreign_manufacturers")) return "MFDS 식품 API";
  if (tags.includes("mfds_cosmetic")) return "MFDS 화장품 API";
  if (tags.includes("sample_seed")) return "샘플 데이터";
  return "공장 DB";
}

function confidenceLabel(factory: HeatmapFactory) {
  if (factory.geocodeConfidence === null) return "좌표 확인 필요";
  return `${Math.round(factory.geocodeConfidence * 100)}% · ${factory.geocodeProvider ?? "unknown"}`;
}

function factoryMapInfo(factory: HeatmapFactory): FactoryMapInfo {
  return {
    id: factory.id,
    name: factory.canonicalName,
    category: primaryCategory(factory),
    feature: factoryFeature(factory),
    address: factory.addressNormalized ?? factory.addressRaw ?? "주소 없음",
    location: [factory.country, factory.province, factory.city].filter(Boolean).join(" / ") || "위치 미분류",
    sourceLabel: sourceLabel(factory),
    confidenceLabel: confidenceLabel(factory),
    riskLevel: factory.riskLevel
  };
}

function buildMapPoints(factories: HeatmapFactory[], convertForAmap: boolean): MapPoint[] {
  return factories
    .filter((factory) => factory.latitude !== null && factory.longitude !== null)
    .map((factory) => {
      const [lng, lat] = convertForAmap
        ? wgs84ToGcj02(factory.longitude as number, factory.latitude as number)
        : ([factory.longitude as number, factory.latitude as number] as [number, number]);
      const info = factoryMapInfo(factory);
      return {
        id: factory.id,
        title: info.name,
        lng,
        lat,
        riskLevel: factory.riskLevel,
        count: riskWeight(factory.riskLevel),
        info
      };
    });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function projectAsiaPoint(lat: number, lng: number) {
  const left = clamp(((lng - 72) / (137.8 - 72)) * 100, 4, 96);
  const top = clamp(((55.8 - lat) / (55.8 - 0.8)) * 100, 4, 96);
  return { left, top };
}

function clusterMapPoints(points: MapPoint[]) {
  const grid = new Map<
    string,
    {
      lat: number;
      lng: number;
      count: number;
      riskSum: number;
      highRiskCount: number;
    }
  >();

  for (const point of points) {
    const key = `${Math.round(point.lat / 1.2)}:${Math.round(point.lng / 1.2)}`;
    const existing = grid.get(key);
    if (existing) {
      existing.lat += point.lat;
      existing.lng += point.lng;
      existing.count += 1;
      existing.riskSum += point.count;
      if (point.riskLevel === "HIGH" || point.riskLevel === "CRITICAL") existing.highRiskCount += 1;
    } else {
      grid.set(key, {
        lat: point.lat,
        lng: point.lng,
        count: 1,
        riskSum: point.count,
        highRiskCount: point.riskLevel === "HIGH" || point.riskLevel === "CRITICAL" ? 1 : 0
      });
    }
  }

  return Array.from(grid.values())
    .map((cluster) => ({
      lat: cluster.lat / cluster.count,
      lng: cluster.lng / cluster.count,
      count: cluster.count,
      averageRisk: cluster.riskSum / cluster.count,
      highRiskCount: cluster.highRiskCount
    }))
    .sort((left, right) => right.count - left.count || right.averageRisk - left.averageRisk)
    .slice(0, 180);
}

function mapInfoHtml(info: FactoryMapInfo) {
  return `<div class="amap-factory-tooltip-title">${escapeHtml(info.name)}</div><div class="amap-factory-tooltip-meta">${escapeHtml(
    `${info.category} · ${info.feature}`
  )}</div>`;
}

function FallbackFactoryMap({
  factories,
  provider,
  error,
  onHoverFactory
}: {
  factories: HeatmapFactory[];
  provider: "AMap" | "Google Maps";
  error: string;
  onHoverFactory: (factory: FactoryMapInfo) => void;
}) {
  const mapPoints = useMemo(() => buildMapPoints(factories, false), [factories]);
  const clusters = useMemo(() => clusterMapPoints(mapPoints), [mapPoints]);
  const markerPoints = useMemo(
    () =>
      [...mapPoints]
        .sort((left, right) => right.count - left.count || left.title.localeCompare(right.title))
        .slice(0, 900),
    [mapPoints]
  );

  return (
    <div
      className="relative h-[680px] overflow-hidden bg-[#e8f0f4]"
      style={{
        backgroundImage:
          "linear-gradient(rgba(31,95,191,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(31,95,191,0.06) 1px, transparent 1px)",
        backgroundSize: "46px 46px"
      }}
      aria-label={`${provider} fallback 해외 공장 지도`}
    >
      <div className="absolute left-[10%] top-[8%] h-[86%] w-[78%] rounded-[48%] border border-white/80 bg-white/30 shadow-inner" />
      <div className="absolute left-[19%] top-[18%] h-[54%] w-[56%] rotate-[-8deg] rounded-[45%] border border-white/70 bg-cobalt/5" />
      <div className="absolute left-[56%] top-[30%] h-[32%] w-[18%] rotate-[14deg] rounded-[45%] border border-white/60 bg-teal/5" />

      {clusters.map((cluster) => {
        const position = projectAsiaPoint(cluster.lat, cluster.lng);
        const size = Math.min(64, 12 + cluster.count * 1.8);
        const color = cluster.averageRisk >= 75 ? "#b42318" : cluster.averageRisk >= 50 ? "#b7791f" : "#0f766e";
        return (
          <div
            key={`${cluster.lat}:${cluster.lng}:${cluster.count}`}
            className="absolute rounded-full blur-sm"
            style={{
              left: `${position.left}%`,
              top: `${position.top}%`,
              width: size,
              height: size,
              transform: "translate(-50%, -50%)",
              backgroundColor: color,
              opacity: Math.min(0.18, 0.045 + cluster.count / 900)
            }}
          />
        );
      })}

      {markerPoints.map((point) => {
        const position = projectAsiaPoint(point.lat, point.lng);
        return (
          <button
            key={point.id}
            type="button"
            title={`${point.title} · ${point.info.feature}`}
            onClick={() => onHoverFactory(point.info)}
            onMouseEnter={() => onHoverFactory(point.info)}
            onFocus={() => onHoverFactory(point.info)}
            className="absolute h-3 w-3 rounded-full border-2 border-white shadow-sm transition-transform hover:z-20 hover:scale-150 focus:z-20 focus:scale-150 focus:outline-none focus:ring-2 focus:ring-cobalt"
            style={{
              left: `${position.left}%`,
              top: `${position.top}%`,
              transform: "translate(-50%, -50%)",
              backgroundColor: riskColor(point.riskLevel)
            }}
            aria-label={`${point.title} 공장 정보 보기`}
          />
        );
      })}

      <div className="absolute left-4 top-4 max-w-md rounded-md border border-amber/40 bg-white/95 p-3 text-xs shadow-soft backdrop-blur">
        <div className="flex items-center gap-2 font-bold text-[#7a5b12]">
          <AlertTriangle className="h-4 w-4" /> {provider} SDK 연결 대기
        </div>
        <p className="mt-2 leading-5 text-muted">
          외부 지도 SDK가 막혀도 저장된 해외 공장 좌표는 fallback 지도에 표시합니다. API 키 제한을 정리하면 실제 {provider} 지도로 자동 전환됩니다.
        </p>
        <p className="mt-2 rounded bg-panel px-2 py-1 font-mono text-[10px] text-muted">{error}</p>
      </div>

      <div className="absolute bottom-4 right-4 rounded-md border border-line bg-white/95 px-3 py-2 text-[11px] font-bold text-muted shadow-soft">
        fallback view · {mapPoints.length.toLocaleString("ko-KR")} overseas points
      </div>
    </div>
  );
}

function loadAmapScript(key: string): Promise<AMapNamespace> {
  if (window.AMap) return Promise.resolve(window.AMap);

  const securityCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE;
  if (securityCode) {
    window._AMapSecurityConfig = {
      securityJsCode: securityCode
    };
  }

  const existing = document.getElementById("amap-js-sdk") as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => (window.AMap ? resolve(window.AMap) : reject(new Error("AMap SDK loaded without namespace"))));
      existing.addEventListener("error", () => reject(new Error("AMap SDK script failed")));
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = "amap-js-sdk";
    script.async = true;
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}&plugin=AMap.HeatMap`;
    script.onload = () => {
      if (window.AMap) resolve(window.AMap);
      else reject(new Error("AMap SDK loaded without namespace"));
    };
    script.onerror = () => reject(new Error("AMap SDK script failed"));
    document.head.appendChild(script);
  });
}

function loadGoogleMapsScript(key: string): Promise<GoogleMapsNamespace> {
  if (window.google?.maps) return Promise.resolve(window.google.maps);

  const existing = document.getElementById("google-maps-js-sdk") as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () =>
        window.google?.maps ? resolve(window.google.maps) : reject(new Error("Google Maps SDK loaded without namespace"))
      );
      existing.addEventListener("error", () => reject(new Error("Google Maps SDK script failed")));
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = "google-maps-js-sdk";
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
    script.onload = () => {
      if (window.google?.maps) resolve(window.google.maps);
      else reject(new Error("Google Maps SDK loaded without namespace"));
    };
    script.onerror = () => reject(new Error("Google Maps SDK script failed"));
    document.head.appendChild(script);
  });
}

function AMapCanvas({
  factories,
  radius,
  intensity,
  onHoverFactory
}: {
  factories: HeatmapFactory[];
  radius: number;
  intensity: number;
  onHoverFactory: (factory: FactoryMapInfo) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<AMapMap | null>(null);
  const [status, setStatus] = useState("AMap SDK loading...");
  const [error, setError] = useState<string | null>(null);
  const key = process.env.NEXT_PUBLIC_AMAP_JS_KEY ?? "";

  const mapPoints = useMemo(() => {
    return buildMapPoints(factories, true);
  }, [factories]);

  useEffect(() => {
    let cancelled = false;

    async function renderMap() {
      if (!containerRef.current) return;
      if (!key) {
        setError("NEXT_PUBLIC_AMAP_JS_KEY가 없습니다. 브라우저 지도 SDK용 키가 필요합니다.");
        return;
      }

      try {
        setError(null);
        setStatus("AMap SDK loading...");
        const AMap = await loadAmapScript(key);
        if (cancelled || !containerRef.current) return;

        mapRef.current?.destroy();
        const center =
          mapPoints.length > 0
            ? ([mapPoints.reduce((sum, point) => sum + point.lng, 0) / mapPoints.length, mapPoints.reduce((sum, point) => sum + point.lat, 0) / mapPoints.length] as [number, number])
            : ([113.9, 30.8] as [number, number]);

        const map = new AMap.Map(containerRef.current, {
          zoom: mapPoints.length > 0 ? 5 : 4,
          center,
          viewMode: "2D",
          resizeEnable: true,
          mapStyle: "amap://styles/normal"
        });
        mapRef.current = map;

        for (const point of mapPoints) {
          const title = escapeHtml(point.title);
          const marker = new AMap.Marker({
            map,
            position: [point.lng, point.lat],
            title: point.title,
            offset: new AMap.Pixel(-7, -7),
            content: `<div class="amap-factory-marker" title="${title}"><span class="amap-factory-dot" style="background:${riskColor(
              point.riskLevel
            )}"></span><span class="amap-factory-tooltip">${mapInfoHtml(point.info)}</span></div>`
          });
          marker.on?.("mouseover", () => onHoverFactory(point.info));
          marker.on?.("click", () => onHoverFactory(point.info));
        }

        AMap.plugin(["AMap.HeatMap"], () => {
          if (!AMap.HeatMap) {
            setStatus("AMap loaded. HeatMap plugin unavailable.");
            return;
          }
          const heatmap = new AMap.HeatMap(map, {
            radius,
            opacity: [0, Math.min(0.95, Math.max(0.25, intensity / 100))],
            gradient: {
              0.2: "#0f766e",
              0.5: "#f2c94c",
              0.8: "#f97316",
              1.0: "#b42318"
            }
          });
          heatmap.setDataSet({
            data: mapPoints.map((point) => ({ lng: point.lng, lat: point.lat, count: point.count })),
            max: 100
          });
          if (mapPoints.length > 1) map.setFitView();
          setStatus(`AMap live · ${mapPoints.length} plotted points`);
        });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "AMap failed to load");
      }
    }

    renderMap();

    return () => {
      cancelled = true;
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, [key, mapPoints, radius, intensity, onHoverFactory]);

  if (error) {
    return <FallbackFactoryMap factories={factories} provider="AMap" error={error} onHoverFactory={onHoverFactory} />;
  }

  return (
    <div className="relative h-[680px] overflow-hidden">
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute left-4 top-4 rounded-md border border-line bg-white/95 px-3 py-2 text-xs text-muted shadow-soft">
        {status}
      </div>
    </div>
  );
}

function GoogleMapCanvas({
  factories,
  radius,
  intensity,
  onHoverFactory
}: {
  factories: HeatmapFactory[];
  radius: number;
  intensity: number;
  onHoverFactory: (factory: FactoryMapInfo) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState("Google Maps SDK loading...");
  const [error, setError] = useState<string | null>(null);
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  const mapPoints = useMemo(() => buildMapPoints(factories, false), [factories]);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;

    async function renderMap() {
      if (!container) return;
      if (!key) {
        setError("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY가 없습니다. 브라우저 지도 SDK용 키가 필요합니다.");
        return;
      }

      try {
        setError(null);
        setStatus("Google Maps SDK loading...");
        const maps = await loadGoogleMapsScript(key);
        if (cancelled) return;

        container.innerHTML = "";
        const center =
          mapPoints.length > 0
            ? {
                lng: mapPoints.reduce((sum, point) => sum + point.lng, 0) / mapPoints.length,
                lat: mapPoints.reduce((sum, point) => sum + point.lat, 0) / mapPoints.length
              }
            : { lat: 30.8, lng: 113.9 };

        const map = new maps.Map(container, {
          zoom: mapPoints.length > 0 ? 5 : 4,
          center,
          mapTypeId: "roadmap",
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false
        });
        const bounds = new maps.LatLngBounds();
        const infoWindow = new maps.InfoWindow();

        for (const point of mapPoints) {
          const position = { lat: point.lat, lng: point.lng };
          new maps.Circle({
            map,
            center: position,
            radius: Math.max(18000, Math.min(70000, radius * 900 + point.count * 240)),
            strokeOpacity: 0,
            fillColor: riskColor(point.riskLevel),
            fillOpacity: Math.min(0.18, Math.max(0.06, intensity / 650)),
            clickable: false
          });
        }

        for (const point of mapPoints) {
          const position = { lat: point.lat, lng: point.lng };
          const marker = new maps.Marker({
            map,
            position,
            title: point.title,
            icon: {
              path: maps.SymbolPath.CIRCLE,
              scale: 6,
              fillColor: riskColor(point.riskLevel),
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2
            }
          });
          marker.addListener("mouseover", () => {
            onHoverFactory(point.info);
            infoWindow.setContent(mapInfoHtml(point.info));
            infoWindow.open({ map, anchor: marker });
          });
          marker.addListener("mouseout", () => infoWindow.close());
          marker.addListener("click", () => onHoverFactory(point.info));
          bounds.extend(position);
        }

        if (mapPoints.length > 1) map.fitBounds(bounds);
        setStatus(`Google Maps live · ${mapPoints.length} plotted points`);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Google Maps failed to load");
      }
    }

    renderMap();

    return () => {
      cancelled = true;
      if (container) container.innerHTML = "";
    };
  }, [key, mapPoints, radius, intensity, onHoverFactory]);

  if (error) {
    return <FallbackFactoryMap factories={factories} provider="Google Maps" error={error} onHoverFactory={onHoverFactory} />;
  }

  return (
    <div className="relative h-[680px] overflow-hidden">
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute left-4 top-4 rounded-md border border-line bg-white/95 px-3 py-2 text-xs text-muted shadow-soft">
        {status}
      </div>
    </div>
  );
}

export function HeatmapWorkbench({ factories }: { factories: HeatmapFactory[] }) {
  const [provider, setProvider] = useState<"amap" | "google">("amap");
  const [selectedTheme, setSelectedTheme] = useState("ALL");
  const [hoveredFactory, setHoveredFactory] = useState<FactoryMapInfo | null>(null);
  const intensity = 70;
  const radius = 42;

  const plottedDb = useMemo(() => factories.filter((factory) => factory.latitude !== null && factory.longitude !== null).slice(0, 2000), [factories]);
  const themeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const factory of plottedDb) {
      const categories = new Set(factory.products.map((product) => product.category).filter(Boolean) as string[]);
      for (const category of categories) counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [plottedDb]);
  const filteredFactories = useMemo(() => {
    if (selectedTheme === "ALL") return plottedDb;
    return plottedDb.filter((factory) => factory.products.some((product) => product.category === selectedTheme));
  }, [plottedDb, selectedTheme]);

  useEffect(() => {
    setHoveredFactory(null);
  }, [selectedTheme]);

  return (
    <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
      <section className="grid content-start gap-4">
        <div className="rounded-md border border-line bg-white p-4 shadow-soft">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <MapPinned className="h-4 w-4 text-cobalt" />
            Map Provider
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["amap", "AMap"],
              ["google", "Google"]
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`rounded-md border px-3 py-2 text-sm ${
                  provider === value ? "border-cobalt bg-cobalt text-white" : "border-line bg-white text-ink hover:bg-panel"
                }`}
                onClick={() => setProvider(value as "amap" | "google")}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-3 rounded-md bg-panel p-3 text-xs leading-5 text-muted">
            {provider === "amap"
              ? "AMap JS SDK를 직접 로드하고 DB에 저장된 좌표를 지도에 표시합니다."
              : "Google Maps JavaScript API와 밀집 원형 레이어로 같은 공장 데이터를 표시합니다."}
          </div>
        </div>

        <div className="rounded-md border border-line bg-white p-4 shadow-soft">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Tags className="h-4 w-4 text-cobalt" />
            Factory Themes
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-md border px-3 py-2 text-xs font-medium ${
                selectedTheme === "ALL" ? "border-cobalt bg-cobalt text-white" : "border-line bg-white text-ink hover:bg-panel"
              }`}
              onClick={() => setSelectedTheme("ALL")}
            >
              전체 {plottedDb.length}
            </button>
            {themeOptions.map(([theme, count]) => (
              <button
                key={theme}
                type="button"
                className={`rounded-md border px-3 py-2 text-xs font-medium ${
                  selectedTheme === theme ? "border-cobalt bg-cobalt text-white" : "border-line bg-white text-ink hover:bg-panel"
                }`}
                onClick={() => setSelectedTheme(theme)}
              >
                {theme} {count}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-line bg-white p-4 shadow-soft">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <MousePointer2 className="h-4 w-4 text-cobalt" />
            Hovered Factory
          </div>
          {hoveredFactory ? (
            <div className="grid gap-3 text-sm">
              <div>
                <div className="text-xs font-medium uppercase text-muted">{hoveredFactory.sourceLabel}</div>
                <div className="mt-1 text-base font-semibold leading-6 text-ink">{hoveredFactory.name}</div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-md bg-panel px-2 py-1 font-medium text-ink">{hoveredFactory.category}</span>
                <span className="rounded-md bg-panel px-2 py-1 text-muted">{hoveredFactory.feature}</span>
              </div>
              <div className="grid gap-2 text-xs leading-5 text-muted">
                <div>{hoveredFactory.address}</div>
                <div>{hoveredFactory.location}</div>
                <div>{hoveredFactory.confidenceLabel}</div>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-line bg-panel p-4 text-sm leading-6 text-muted">
              지도 위 공장 포인트에 커서를 올리면 이 영역에 공장명, 분류, 특징, 주소가 표시됩니다.
            </div>
          )}
        </div>

        <div className="rounded-md border border-line bg-white p-4 shadow-soft">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <FactoryIcon className="h-4 w-4 text-cobalt" />
            Visible Factories
          </div>
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-md border border-line p-2">
              <div className="text-lg font-semibold text-ink">{plottedDb.length}</div>
              <div className="text-muted">전체 좌표</div>
            </div>
            <div className="rounded-md border border-line p-2">
              <div className="text-lg font-semibold text-ink">{filteredFactories.length}</div>
              <div className="text-muted">현재 표시</div>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-md border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Flame className="h-4 w-4 text-danger" />
            {provider === "amap" ? "AMap Heatmap" : "Google Heatmap"}
          </div>
          <div className="text-xs text-muted">
            {filteredFactories.length} visible points · {selectedTheme === "ALL" ? "전체" : selectedTheme}
          </div>
        </div>

        {provider === "amap" ? (
          <AMapCanvas factories={filteredFactories} radius={radius} intensity={intensity} onHoverFactory={setHoveredFactory} />
        ) : (
          <GoogleMapCanvas factories={filteredFactories} radius={radius} intensity={intensity} onHoverFactory={setHoveredFactory} />
        )}
      </section>
    </div>
  );
}
