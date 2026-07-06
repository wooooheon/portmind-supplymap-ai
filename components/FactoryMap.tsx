"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Filter, Search } from "lucide-react";

export type FactoryMarker = {
  id: string;
  canonicalName: string;
  country: string;
  province: string | null;
  city: string | null;
  addressRaw: string | null;
  latitude: number | null;
  longitude: number | null;
  riskLevel: "UNKNOWN" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  importReadinessScore: number;
  geocodeConfidence: number | null;
  productCategories: string[];
  certTypes: string[];
};

export function FactoryMap({ factories }: { factories: FactoryMarker[] }) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<{ remove: () => void } | null>(null);
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState("ALL");
  const [country, setCountry] = useState("ALL");
  const [certType, setCertType] = useState("ALL");
  const [category, setCategory] = useState("ALL");

  const countries = useMemo(() => Array.from(new Set(factories.map((item) => item.country).filter(Boolean))).sort(), [factories]);
  const categories = useMemo(
    () => Array.from(new Set(factories.flatMap((item) => item.productCategories).filter(Boolean))).sort(),
    [factories]
  );
  const certTypes = useMemo(() => Array.from(new Set(factories.flatMap((item) => item.certTypes).filter(Boolean))).sort(), [factories]);

  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    return factories.filter((factory) => {
      if (!factory.latitude || !factory.longitude) return false;
      if (risk !== "ALL" && factory.riskLevel !== risk) return false;
      if (country !== "ALL" && factory.country !== country) return false;
      if (certType !== "ALL" && !factory.certTypes.includes(certType)) return false;
      if (category !== "ALL" && !factory.productCategories.includes(category)) return false;
      if (!needle) return true;
      return [factory.canonicalName, factory.city, factory.province, factory.addressRaw]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [factories, query, risk, country, certType, category]);

  useEffect(() => {
    let cancelled = false;
    async function initMap() {
      if (!mapElement.current) return;
      const L = await import("leaflet");
      await import("leaflet.markercluster");
      if (cancelled || !mapElement.current) return;

      mapRef.current?.remove();
      const map = L.map(mapElement.current, { preferCanvas: true }).setView([30.2, 118.7], 5);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(map);

      const clusterGroup = (L as unknown as { markerClusterGroup: () => L.LayerGroup }).markerClusterGroup();
      filtered.forEach((factory) => {
        const riskClass = factory.riskLevel.toLowerCase();
        const marker = L.marker([factory.latitude as number, factory.longitude as number], {
          icon: L.divIcon({
            className: "",
            html: `<div class="marker-dot ${riskClass}"></div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9]
          })
        });
        const confidence =
          factory.geocodeConfidence === null
            ? "좌표 확인 필요"
            : factory.geocodeConfidence < 0.75
              ? "좌표 확인 필요"
              : `${Math.round(factory.geocodeConfidence * 100)}%`;
        marker.bindPopup(
          `<strong>${factory.canonicalName}</strong><br/>${factory.city ?? ""} ${factory.country}<br/>Risk: ${
            factory.riskLevel
          }<br/>Import Readiness: ${factory.importReadinessScore}/100<br/>Geo: ${confidence}<br/><a href="/factories/${
            factory.id
          }">Evidence Card</a>`
        );
        clusterGroup.addLayer(marker);
      });
      clusterGroup.addTo(map);
      if (filtered.length > 0) {
        const bounds = L.latLngBounds(filtered.map((factory) => [factory.latitude as number, factory.longitude as number]));
        map.fitBounds(bounds.pad(0.25), { maxZoom: 9 });
      }
    }
    initMap();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [filtered]);

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <div className="rounded-md border border-line bg-white p-4 shadow-soft">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Filter className="h-4 w-4 text-cobalt" />
          Filters
        </div>
        <label className="mb-3 grid gap-1 text-sm">
          <span className="text-xs font-medium text-muted">Search</span>
          <div className="flex items-center gap-2 rounded-md border border-line px-3 py-2">
            <Search className="h-4 w-4 text-muted" />
            <input className="min-w-0 flex-1 outline-none" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
        </label>
        <label className="mb-3 grid gap-1 text-sm">
          <span className="text-xs font-medium text-muted">Country</span>
          <select className="rounded-md border border-line px-3 py-2" value={country} onChange={(event) => setCountry(event.target.value)}>
            <option value="ALL">All</option>
            {countries.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="mb-3 grid gap-1 text-sm">
          <span className="text-xs font-medium text-muted">Product Group</span>
          <select className="rounded-md border border-line px-3 py-2" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="ALL">All</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="mb-3 grid gap-1 text-sm">
          <span className="text-xs font-medium text-muted">Certificate</span>
          <select className="rounded-md border border-line px-3 py-2" value={certType} onChange={(event) => setCertType(event.target.value)}>
            <option value="ALL">All</option>
            {certTypes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-muted">Risk</span>
          <select className="rounded-md border border-line px-3 py-2" value={risk} onChange={(event) => setRisk(event.target.value)}>
            <option value="ALL">All</option>
            <option value="UNKNOWN">UNKNOWN</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
        </label>
        <p className="mt-4 text-xs leading-5 text-muted">
          {filtered.length} markers. 확인되지 않음은 문제없음이 아니라 추가 확인 필요로 처리합니다.
        </p>
        <Link className="mt-4 inline-flex text-sm font-medium text-cobalt hover:underline" href="/exports">
          Export factories CSV
        </Link>
      </div>
      <div className="h-[72vh] min-h-[520px] overflow-hidden rounded-md border border-line bg-white shadow-soft">
        <div ref={mapElement} className="h-full w-full" />
      </div>
    </div>
  );
}
