import { prisma } from "@/lib/db/prisma";
import { appendQuery, fetchWithRetry, parseResponse } from "@/lib/connectors/http";
import { bd09ToWgs84, gcj02ToWgs84 } from "./coordinate-transform";
import { estimateChinaLocationFromAddress } from "./china-centroids";

export type GeocodeResult = {
  latitude: number;
  longitude: number;
  coordSystem: "WGS84" | "GCJ02" | "BD09" | "UNKNOWN";
  confidence: number;
  provider: string;
  normalizedAddress?: string;
};

const fallbackClusters: Record<string, GeocodeResult> = {
  shenzhen: { latitude: 22.5431, longitude: 114.0579, coordSystem: "WGS84", confidence: 0.62, provider: "sample-cluster" },
  dongguan: { latitude: 23.0207, longitude: 113.7518, coordSystem: "WGS84", confidence: 0.62, provider: "sample-cluster" },
  guangzhou: { latitude: 23.1291, longitude: 113.2644, coordSystem: "WGS84", confidence: 0.62, provider: "sample-cluster" },
  ningbo: { latitude: 29.8683, longitude: 121.544, coordSystem: "WGS84", confidence: 0.62, provider: "sample-cluster" },
  yiwu: { latitude: 29.3069, longitude: 120.0751, coordSystem: "WGS84", confidence: 0.62, provider: "sample-cluster" },
  qingdao: { latitude: 36.0671, longitude: 120.3826, coordSystem: "WGS84", confidence: 0.62, provider: "sample-cluster" },
  shanghai: { latitude: 31.2304, longitude: 121.4737, coordSystem: "WGS84", confidence: 0.62, provider: "sample-cluster" },
  suzhou: { latitude: 31.2989, longitude: 120.5853, coordSystem: "WGS84", confidence: 0.62, provider: "sample-cluster" },
  xiamen: { latitude: 24.4798, longitude: 118.0894, coordSystem: "WGS84", confidence: 0.62, provider: "sample-cluster" },
  foshan: { latitude: 23.0215, longitude: 113.1214, coordSystem: "WGS84", confidence: 0.62, provider: "sample-cluster" }
};

function readAmapLocation(raw: unknown): [number, number, string | undefined] | null {
  const geocode = (raw as { geocodes?: Array<{ location?: string; formatted_address?: string }> })?.geocodes?.[0];
  if (!geocode?.location) return null;
  const [lng, lat] = geocode.location.split(",").map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lng, lat, geocode.formatted_address];
}

function readKakaoLocation(raw: unknown): [number, number, string | undefined] | null {
  const doc = (raw as { documents?: Array<{ x?: string; y?: string; address_name?: string }> })?.documents?.[0];
  if (!doc?.x || !doc?.y) return null;
  const lng = Number(doc.x);
  const lat = Number(doc.y);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lng, lat, doc.address_name];
}

type KakaoKeywordDocument = {
  x?: string;
  y?: string;
  address_name?: string;
  road_address_name?: string;
  place_name?: string;
};

function readKakaoKeywordLocations(raw: unknown): Array<[number, number, KakaoKeywordDocument]> {
  const docs = (raw as { documents?: KakaoKeywordDocument[] })?.documents;
  if (!Array.isArray(docs)) return [];
  return docs
    .map((doc): [number, number, KakaoKeywordDocument] | null => {
      if (!doc.x || !doc.y) return null;
      const lng = Number(doc.x);
      const lat = Number(doc.y);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return [lng, lat, doc];
    })
    .filter((doc): doc is [number, number, KakaoKeywordDocument] => Boolean(doc));
}

function cleanKoreaAddressCandidate(value: string): string {
  return value
    .replace(/천안시\s*(서북구|동남구)/g, "천안시 $1")
    .replace(/전남광주통합특별시/g, "전라남도")
    .replace(/경기도\s+화성시\s+(?:만세구|효행구)\s+/g, "경기도 화성시 ")
    .replace(/\(총\s*[0-9]+\s*필지\)/g, "")
    .replace(/\s*외\s*[0-9]+\s*필지/g, "")
    .replace(/\s+[0-9,\s]+층(?:\s+[0-9]+호)?.*$/g, "")
    .replace(/([0-9]+)동\s+[0-9]+층\s+[0-9]+호/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,\s+/g, ", ")
    .trim();
}

function normalizeKoreanText(value?: string | null): string {
  return (value ?? "").normalize("NFKC").replace(/\s+/g, "").toLocaleLowerCase();
}

function companyTokens(value?: string | null): string[] {
  const cleaned = (value ?? "")
    .normalize("NFKC")
    .replace(/\(주\)|㈜|주식회사|유한회사|\(유\)|농업회사법인|사단법인|\(사\)/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ");
  return Array.from(new Set(cleaned.split(/\s+/).map((token) => token.trim()).filter((token) => token.length >= 2)));
}

function addressTokens(value: string): string[] {
  return Array.from(
    new Set(
      [
        ...(value.match(/[\p{L}\p{N}]+(?:로|길|읍|면|동|리)/gu) ?? []),
        ...(value.match(/[0-9]+(?:-[0-9]+)?/g) ?? [])
      ].filter((token) => token.length >= 2)
    )
  );
}

function koreaAddressCandidates(address: string, city?: string | null): string[] {
  const normalized = cleanKoreaAddressCandidate(address);
  const withoutParentheses = cleanKoreaAddressCandidate(normalized.replace(/\([^)]*\)/g, " "));
  const withoutBeonjiSuffix = cleanKoreaAddressCandidate(normalized.replace(/번지/g, ""));
  const beforeComma = cleanKoreaAddressCandidate(normalized.split(",")[0] ?? normalized);
  const withoutIndustrialLot = cleanKoreaAddressCandidate(
    normalized
      .replace(/[, ]+[0-9]+(?:블럭|블록)\s*[0-9-]+(?:로트|L|l)?/g, "")
      .replace(/[, ]+[0-9]+(?:차)?단지\s*[0-9A-Za-z-]+[B블록]*\s*[0-9A-Za-z-]*[L로트]*/g, "")
      .replace(/[, ]+[0-9]+[가-힣]\s*[0-9-]+(?:호)?/g, "")
      .replace(/[, ]+시화(?:산단|단지)\s*[0-9가-힣A-Za-z-]+\s*[0-9-]+(?:호)?/g, "")
  );
  const cityPrefix = city ? cleanKoreaAddressCandidate(`${city} ${withoutParentheses}`) : "";

  return Array.from(
    new Set(
      [normalized, withoutIndustrialLot, beforeComma, withoutParentheses, withoutBeonjiSuffix, cityPrefix]
        .map(cleanKoreaAddressCandidate)
        .filter((candidate) => candidate.length >= 8)
    )
  );
}

function kakaoKeywordQueries(address: string, city?: string | null, keyword?: string | null): string[] {
  const candidates = koreaAddressCandidates(address, city);
  const keywordValue = keyword ? cleanKoreaAddressCandidate(`${city ?? ""} ${keyword}`) : "";
  return Array.from(new Set([...candidates, keywordValue].filter((candidate) => candidate.length >= 3)));
}

function keywordResultMatches(args: {
  doc: KakaoKeywordDocument;
  address: string;
  city?: string | null;
  keyword?: string | null;
}) {
  const joinedAddress = normalizeKoreanText(`${args.doc.address_name ?? ""} ${args.doc.road_address_name ?? ""}`);
  const placeName = normalizeKoreanText(args.doc.place_name);
  const city = normalizeKoreanText(args.city);
  const hasCity = city.length < 2 || joinedAddress.includes(city);
  if (!hasCity) return false;

  const locationTokens = addressTokens(args.address).map(normalizeKoreanText);
  const hasAddressToken =
    locationTokens.length === 0 ||
    locationTokens.some((token) => token.length >= 2 && joinedAddress.includes(token));
  const sourceCompanyTokens = companyTokens(args.keyword).map(normalizeKoreanText);
  const hasCompanyToken =
    sourceCompanyTokens.length > 0 && sourceCompanyTokens.some((token) => token.length >= 2 && placeName.includes(token));

  return hasAddressToken || hasCompanyToken;
}

function fallbackGeocode(address: string, city?: string | null): GeocodeResult | null {
  const haystack = `${address} ${city ?? ""}`.toLowerCase();
  const match = Object.entries(fallbackClusters).find(([key]) => haystack.includes(key));
  if (!match) return null;
  return {
    ...match[1],
    normalizedAddress: address
  };
}

function chinaAddressCandidates(address: string): Array<{ address: string; city?: string }> {
  const normalized = address.toLowerCase();
  const candidates: Array<{ address: string; city?: string }> = [];

  if (normalized.includes("dongguan")) {
    const streetNo = address.match(/(?:\bno\.?\s*|#\s*)([0-9]+)\b/i)?.[1];
    if (normalized.includes("chashan") && normalized.includes("station road")) {
      candidates.push({ address: `广东省东莞市茶山镇茶山站前路${streetNo ? `${streetNo}号` : ""}`, city: "东莞" });
    }
    if (normalized.includes("guantai road") && normalized.includes("nancheng")) {
      candidates.push({ address: `广东省东莞市南城街道莞太路${streetNo ? `${streetNo}号` : ""}`, city: "东莞" });
    }
    candidates.push({ address, city: "东莞" });
  }

  if (normalized.includes("tianjin") && normalized.includes("nanhai road")) {
    const streetNo = address.match(/(?:\bno\.?\s*|#\s*)([0-9]+)\b/i)?.[1];
    candidates.push({ address: `天津市滨海新区南海路${streetNo ? `${streetNo}号` : ""}`, city: "天津" });
  }

  if (normalized.includes("qingdao") && normalized.includes("laixi") && normalized.includes("weihai west road")) {
    candidates.push({ address: "山东省青岛市莱西市威海西路", city: "青岛" });
  }

  candidates.push({ address });
  return candidates;
}

export async function geocodeAddress(args: {
  address: string;
  country?: string | null;
  city?: string | null;
  keyword?: string | null;
}): Promise<GeocodeResult | null> {
  const address = args.address.trim();
  if (!address) return null;

  if ((args.country === "CN" || args.country === "China" || args.country === "중국") && process.env.AMAP_WEB_SERVICE_KEY) {
    for (const candidate of chinaAddressCandidates(address)) {
      const requestUrl = appendQuery("https://restapi.amap.com/v3/geocode/geo", {
        key: process.env.AMAP_WEB_SERVICE_KEY,
        address: candidate.address,
        city: candidate.city ?? args.city,
        output: "JSON"
      });
      const response = await fetchWithRetry(requestUrl, {}, { retries: 1 });
      const raw = await parseResponse(response);
      const location = readAmapLocation(raw);
      if (location) {
        const [wgsLng, wgsLat] = gcj02ToWgs84(location[0], location[1]);
        return {
          latitude: wgsLat,
          longitude: wgsLng,
          coordSystem: "WGS84",
          confidence: candidate.address === address ? 0.82 : 0.74,
          provider: "AMap",
          normalizedAddress: location[2] ?? candidate.address
        };
      }
    }
  }

  if ((args.country === "KR" || args.country === "Korea" || args.country === "대한민국") && process.env.KAKAO_REST_API_KEY) {
    for (const candidate of koreaAddressCandidates(address, args.city)) {
      const requestUrl = appendQuery("https://dapi.kakao.com/v2/local/search/address.json", { query: candidate });
      const response = await fetchWithRetry(
        requestUrl,
        { headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` } },
        { retries: 1 }
      );
      const raw = await parseResponse(response);
      const location = readKakaoLocation(raw);
      if (location) {
        return {
          latitude: location[1],
          longitude: location[0],
          coordSystem: "WGS84",
          confidence: candidate === address ? 0.86 : 0.81,
          provider: "Kakao Local",
          normalizedAddress: location[2] ?? candidate
        };
      }
    }

    for (const candidate of kakaoKeywordQueries(address, args.city, args.keyword)) {
      const requestUrl = appendQuery("https://dapi.kakao.com/v2/local/search/keyword.json", { query: candidate, size: 5 });
      const response = await fetchWithRetry(
        requestUrl,
        { headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` } },
        { retries: 1 }
      );
      const raw = await parseResponse(response);
      const matches = readKakaoKeywordLocations(raw);
      const match = matches.find(([, , doc]) =>
        keywordResultMatches({
          doc,
          address,
          city: args.city,
          keyword: args.keyword
        })
      );
      if (match) {
        const [lng, lat, doc] = match;
        return {
          latitude: lat,
          longitude: lng,
          coordSystem: "WGS84",
          confidence: 0.74,
          provider: "Kakao Local Keyword",
          normalizedAddress: doc.road_address_name || doc.address_name || candidate
        };
      }
    }
  }

  if (process.env.BAIDU_MAP_AK && (args.country === "CN" || args.country === "China" || args.country === "중국")) {
    const requestUrl = appendQuery("https://api.map.baidu.com/geocoding/v3/", {
      ak: process.env.BAIDU_MAP_AK,
      address,
      output: "json"
    });
    const response = await fetchWithRetry(requestUrl, {}, { retries: 1 });
    const raw = await parseResponse(response);
    const location = (raw as { result?: { location?: { lng?: number; lat?: number } } })?.result?.location;
    if (location?.lng && location?.lat) {
      const [wgsLng, wgsLat] = bd09ToWgs84(location.lng, location.lat);
      return {
          latitude: wgsLat,
          longitude: wgsLng,
          coordSystem: "WGS84",
        confidence: 0.78,
        provider: "Baidu",
        normalizedAddress: address
      };
    }
  }

  if (args.country === "CN" || args.country === "China" || args.country === "중국") {
    const estimate = estimateChinaLocationFromAddress({ address, city: args.city });
    if (estimate) {
      return {
        latitude: estimate.latitude,
        longitude: estimate.longitude,
        coordSystem: "WGS84",
        confidence: estimate.confidence,
        provider: estimate.provider,
        normalizedAddress: address
      };
    }
  }

  return fallbackGeocode(address, args.city);
}

export async function geocodeFactories(limit = 100): Promise<number> {
  const factories = await prisma.factory.findMany({
    where: {
      OR: [{ latitude: null }, { longitude: null }, { geocodeProvider: "sample-cluster" }]
    },
    take: limit,
    orderBy: { updatedAt: "asc" }
  });

  let updated = 0;
  for (const factory of factories) {
    const result = await geocodeAddress({
      address: factory.addressRaw ?? `${factory.city ?? ""} ${factory.canonicalName}`,
      country: factory.country,
      city: factory.city
    });
    if (!result) continue;
    const unchanged =
      factory.latitude === result.latitude &&
      factory.longitude === result.longitude &&
      factory.coordSystem === result.coordSystem &&
      factory.geocodeConfidence === result.confidence &&
      factory.geocodeProvider === result.provider &&
      (factory.addressNormalized ?? null) === (result.normalizedAddress ?? factory.addressNormalized ?? null);
    if (unchanged) continue;

    await prisma.factory.update({
      where: { id: factory.id },
      data: {
        latitude: result.latitude,
        longitude: result.longitude,
        coordSystem: result.coordSystem,
        geocodeConfidence: result.confidence,
        geocodeProvider: result.provider,
        addressNormalized: result.normalizedAddress ?? factory.addressNormalized
      }
    });
    updated += 1;
  }
  return updated;
}
