import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { extractProductIntent } from "@/lib/supplymap/intent";
import type { SupplyMapAnalysisRequest } from "@/lib/supplymap/types";

type CoordinateSource = "SUPPLIER" | "INDUSTRIAL_COMPLEX" | "REGION_FALLBACK";

type DomesticMapSupplierRow = {
  id: string;
  name: string;
  region: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  productsJson: string | null;
  hsCodesJson: string | null;
  description: string | null;
  providerName: string;
  datasetName: string;
  sourceType: "MOTIE_PUBLIC" | "OTHER_PUBLIC" | "PRIVATE" | "USER_UPLOAD";
  sourceUrl: string;
  fetchedAt: Date;
  license: string;
  verification: "VERIFIED" | "PARTIAL" | "CHECK_REQUIRED" | "MOCK";
  industrialComplexName: string | null;
  industrialComplexLatitude: number | null;
  industrialComplexLongitude: number | null;
  industrialComplexIndustryMixJson: string | null;
};

const domesticCategoryFilters: Record<string, string[]> = {
  all: [],
  cosmetics: ["화장품", "코스메틱", "뷰티", "펌프캡", "튜브", "디스펜서", "세럼", "크림", "용기"],
  food_packaging: ["식품", "포장", "용기", "트레이", "필름", "밀폐", "라벨", "패키징", "포장재"],
  electric_electronics: ["전기", "전자", "LED", "PCB", "모듈", "히터", "조명", "전원", "제어보드"],
  medical_device: ["의료", "의료기기", "바이오", "헬스", "제약", "진단", "마스크", "의약"],
  drone_parts: ["드론", "항공", "센서", "통신", "ESC", "배터리팩", "프레임", "모터", "제어"]
};

const regionCentroids: Record<string, { latitude: number; longitude: number }> = {
  서울: { latitude: 37.5665, longitude: 126.978 },
  부산: { latitude: 35.1796, longitude: 129.0756 },
  대구: { latitude: 35.8714, longitude: 128.6014 },
  인천: { latitude: 37.4563, longitude: 126.7052 },
  광주: { latitude: 35.1595, longitude: 126.8526 },
  대전: { latitude: 36.3504, longitude: 127.3845 },
  울산: { latitude: 35.5384, longitude: 129.3114 },
  세종: { latitude: 36.4801, longitude: 127.289 },
  경기: { latitude: 37.4138, longitude: 127.5183 },
  경기도: { latitude: 37.4138, longitude: 127.5183 },
  강원: { latitude: 37.8228, longitude: 128.1555 },
  충북: { latitude: 36.6357, longitude: 127.4917 },
  충청북: { latitude: 36.6357, longitude: 127.4917 },
  충남: { latitude: 36.6588, longitude: 126.6728 },
  충청남: { latitude: 36.6588, longitude: 126.6728 },
  전북: { latitude: 35.7175, longitude: 127.153 },
  전라북: { latitude: 35.7175, longitude: 127.153 },
  전남: { latitude: 34.8679, longitude: 126.991 },
  전라남: { latitude: 34.8679, longitude: 126.991 },
  경북: { latitude: 36.4919, longitude: 128.8889 },
  경상북: { latitude: 36.4919, longitude: 128.8889 },
  경남: { latitude: 35.4606, longitude: 128.2132 },
  경상남: { latitude: 35.4606, longitude: 128.2132 },
  제주: { latitude: 33.4996, longitude: 126.5312 }
};

const cityCentroids: Record<string, { latitude: number; longitude: number }> = {
  "서울 종로구": { latitude: 37.5735, longitude: 126.9788 },
  "서울 중구": { latitude: 37.5636, longitude: 126.9976 },
  "서울 금천구": { latitude: 37.4569, longitude: 126.8955 },
  "서울 구로구": { latitude: 37.4955, longitude: 126.8877 },
  "서울 중랑구": { latitude: 37.6063, longitude: 127.0927 },
  "인천 남동구": { latitude: 37.447, longitude: 126.7315 },
  "인천 서구": { latitude: 37.5454, longitude: 126.6759 },
  "인천 부평구": { latitude: 37.5071, longitude: 126.7218 },
  "경기 안산시": { latitude: 37.3219, longitude: 126.8309 },
  "경기 시흥시": { latitude: 37.3802, longitude: 126.8029 },
  "경기 화성시": { latitude: 37.1995, longitude: 126.8312 },
  "경기 부천시": { latitude: 37.5034, longitude: 126.766 },
  "경기 김포시": { latitude: 37.6152, longitude: 126.7156 },
  "경기 파주시": { latitude: 37.7599, longitude: 126.7799 },
  "경기 용인시": { latitude: 37.2411, longitude: 127.1776 },
  "경기 포천시": { latitude: 37.8949, longitude: 127.2003 },
  "경기 평택시": { latitude: 36.9921, longitude: 127.1127 },
  "경기 수원시": { latitude: 37.2636, longitude: 127.0286 },
  "경기 성남시": { latitude: 37.4201, longitude: 127.1266 },
  "경기 안양시": { latitude: 37.3943, longitude: 126.9568 },
  "경기 군포시": { latitude: 37.3617, longitude: 126.9352 },
  "경기 오산시": { latitude: 37.1498, longitude: 127.0772 },
  "경기 광주시": { latitude: 37.4294, longitude: 127.2551 },
  "경기 양주시": { latitude: 37.7853, longitude: 127.0458 },
  "경기 남양주시": { latitude: 37.636, longitude: 127.2165 },
  "경기 이천시": { latitude: 37.2723, longitude: 127.435 },
  "경기 안성시": { latitude: 37.008, longitude: 127.2797 },
  "충청북 청주시": { latitude: 36.6424, longitude: 127.489 },
  "충청북 음성군": { latitude: 36.9402, longitude: 127.6905 },
  "충청북 진천군": { latitude: 36.8554, longitude: 127.4355 },
  "충청북 충주시": { latitude: 36.991, longitude: 127.9259 },
  "충청북 제천시": { latitude: 37.1326, longitude: 128.191 },
  "충청남 천안시": { latitude: 36.8151, longitude: 127.1139 },
  "충청남 아산시": { latitude: 36.7898, longitude: 127.0026 },
  "충청남 당진시": { latitude: 36.893, longitude: 126.628 },
  "충청남 서산시": { latitude: 36.7847, longitude: 126.4503 },
  "경상북 구미시": { latitude: 36.1195, longitude: 128.3446 },
  "경상북 포항시": { latitude: 36.019, longitude: 129.3435 },
  "경상북 경산시": { latitude: 35.8251, longitude: 128.7413 },
  "경상북 칠곡군": { latitude: 35.9956, longitude: 128.4017 },
  "경상남 김해시": { latitude: 35.2285, longitude: 128.8894 },
  "경상남 창원시": { latitude: 35.2279, longitude: 128.6819 },
  "경상남 양산시": { latitude: 35.335, longitude: 129.0372 },
  "경상남 진주시": { latitude: 35.18, longitude: 128.1076 },
  "대구 달서구": { latitude: 35.8299, longitude: 128.5326 },
  "대구 달성군": { latitude: 35.7746, longitude: 128.4314 },
  "대구 서구": { latitude: 35.8719, longitude: 128.5592 },
  "부산 강서구": { latitude: 35.2122, longitude: 128.9806 },
  "부산 사상구": { latitude: 35.1527, longitude: 128.9912 },
  "부산 사하구": { latitude: 35.1046, longitude: 128.9749 },
  "부산 기장군": { latitude: 35.2446, longitude: 129.2224 },
  "울산 울주군": { latitude: 35.5221, longitude: 129.2422 },
  "울산 남구": { latitude: 35.5438, longitude: 129.3301 },
  "울산 북구": { latitude: 35.5827, longitude: 129.3613 },
  "전라남 여수시": { latitude: 34.7604, longitude: 127.6622 },
  "전라남 광양시": { latitude: 34.9407, longitude: 127.6959 },
  "전라남 순천시": { latitude: 34.9506, longitude: 127.4874 },
  "전라북 전주시": { latitude: 35.8242, longitude: 127.148 },
  "전라북 익산시": { latitude: 35.9483, longitude: 126.9578 },
  "전라북 군산시": { latitude: 35.9676, longitude: 126.7369 },
  "전라북 완주군": { latitude: 35.9047, longitude: 127.1621 },
  "대전 대덕구": { latitude: 36.3468, longitude: 127.4154 },
  "대전 유성구": { latitude: 36.3622, longitude: 127.3561 },
  "광주 광산구": { latitude: 35.1396, longitude: 126.7937 },
  "강원 원주시": { latitude: 37.3422, longitude: 127.9202 },
  "강원 춘천시": { latitude: 37.8813, longitude: 127.7298 },
  "강원 강릉시": { latitude: 37.7519, longitude: 128.8761 },
  "세종 세종시": { latitude: 36.4801, longitude: 127.289 },
  "제주 제주시": { latitude: 33.4996, longitude: 126.5312 },
  "제주 서귀포시": { latitude: 33.2541, longitude: 126.5601 }
};

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
  } catch {
    return value.split(/[,/|·ㆍ;]/).map((item) => item.trim()).filter(Boolean);
  }
}

function categoryTerms(category?: string | null) {
  if (!category) return [];
  return domesticCategoryFilters[category] ?? [];
}

function matchesCategoryFilter(row: DomesticMapSupplierRow, products: string[], hsCodes: string[], category?: string | null) {
  const terms = categoryTerms(category);
  if (terms.length === 0) return true;
  const haystack = [
    row.name,
    row.region,
    row.city,
    row.address,
    row.description,
    row.industrialComplexName,
    row.industrialComplexIndustryMixJson,
    ...products,
    ...hsCodes
  ]
    .filter(Boolean)
    .join(" ")
    .normalize("NFKC")
    .toLocaleLowerCase();
  return terms.some((term) => haystack.includes(term.normalize("NFKC").toLocaleLowerCase()));
}

function hashNumber(value: string, salt = 0): number {
  let hash = 2166136261 + salt;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function jitter(value: string, axis: "lat" | "lng", coordinateSource: CoordinateSource): number {
  if (coordinateSource === "SUPPLIER") return 0;
  const spread = coordinateSource === "INDUSTRIAL_COMPLEX" ? 0.018 : 0.045;
  return (hashNumber(value, axis === "lat" ? 17 : 53) - 0.5) * spread;
}

function compactRegion(value?: string | null): string {
  return (value ?? "").replace(/특별시|광역시|특별자치시|특별자치도|도$/g, "").trim();
}

function regionCentroid(region?: string | null, city?: string | null) {
  const compactedRegion = compactRegion(region);
  const compactedCity = (city ?? "").trim();
  const cityKeys = [
    `${compactedRegion} ${compactedCity}`,
    `${region ?? ""} ${compactedCity}`,
    compactedCity
  ].filter((key) => key.trim().length > 0);
  for (const key of cityKeys) {
    const direct = cityCentroids[key.trim()];
    if (direct) return direct;
    const startsWith = Object.entries(cityCentroids).find(([name]) => key.startsWith(name) || name.startsWith(key));
    if (startsWith) return startsWith[1];
  }

  const keys = [compactedRegion, region ?? ""].filter(Boolean);
  for (const key of keys) {
    const direct = regionCentroids[key];
    if (direct) return direct;
    const startsWith = Object.entries(regionCentroids).find(([name]) => key.startsWith(name) || name.startsWith(key));
    if (startsWith) return startsWith[1];
  }
  return { latitude: 36.3, longitude: 127.8 };
}

function normalizedTokens(value: string): string[] {
  return Array.from(new Set(value.normalize("NFKC").toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])).filter(
    (token) => token.length >= 2 && token !== "품목" && token !== "확인" && token !== "필요"
  );
}

function matchScore(args: {
  searchText: string;
  products: string[];
  hsCodes: string[];
  productName?: string;
  hsCode?: string;
}) {
  if (!args.productName && !args.hsCode) return 45;
  const haystack = `${args.searchText} ${args.products.join(" ")} ${args.hsCodes.join(" ")}`.normalize("NFKC").toLocaleLowerCase();
  const request: SupplyMapAnalysisRequest = {
    productName: args.productName || args.hsCode || "국내 공장",
    hsCode: args.hsCode
  };
  const intent = extractProductIntent(request);
  const terms = Array.from(
    new Set([
      ...normalizedTokens(intent.query),
      ...intent.keywords.flatMap(normalizedTokens),
      ...normalizedTokens(intent.category)
    ])
  );
  const tokenHits = terms.filter((term) => haystack.includes(term)).length;
  const hsHit = [...intent.hsCodeCandidates, args.hsCode]
    .map((code) => (code ?? "").replace(/[^0-9]/g, "").slice(0, 6))
    .filter((code) => code.length >= 4)
    .some((code) => args.hsCodes.some((candidateCode) => candidateCode.includes(code)));
  const productExact = args.productName ? haystack.includes(args.productName.normalize("NFKC").toLocaleLowerCase()) : false;
  return Math.max(5, Math.min(100, Math.round(18 + tokenHits * 16 + (hsHit ? 22 : 0) + (productExact ? 18 : 0))));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const productName = url.searchParams.get("productName") ?? url.searchParams.get("product") ?? undefined;
  const hsCode = url.searchParams.get("hsCode") ?? url.searchParams.get("hs") ?? undefined;
  const preferredRegion = url.searchParams.get("preferredRegion") ?? url.searchParams.get("region") ?? undefined;
  const category = url.searchParams.get("category") ?? "all";
  const limit = Math.max(200, Math.min(4000, Number(url.searchParams.get("limit") ?? 2500)));

  const queryLimit = Math.max(limit, 4000);
  const [totalDomesticSuppliers, rawRows] = await Promise.all([
    prisma.supplier.count({ where: { scope: "DOMESTIC" } }),
    prisma.$queryRaw<DomesticMapSupplierRow[]>`
      SELECT
        s."id",
        s."name",
        s."region",
        s."city",
        s."address",
        s."latitude",
        s."longitude",
        s."productsJson",
        s."hsCodesJson",
        s."description",
        s."providerName",
        s."datasetName",
        s."sourceType",
        s."sourceUrl",
        s."fetchedAt",
        s."license",
        s."verification",
        ic."name" AS "industrialComplexName",
        ic."latitude" AS "industrialComplexLatitude",
        ic."longitude" AS "industrialComplexLongitude",
        ic."industryMixJson" AS "industrialComplexIndustryMixJson"
      FROM "Supplier" s
      LEFT JOIN "IndustrialComplex" ic ON ic."id" = s."industrialComplexId"
      WHERE s."scope" = 'DOMESTIC'
      ORDER BY s."updatedAt" DESC
      LIMIT ${queryLimit}
    `
  ]);

  const rows =
    preferredRegion && preferredRegion !== "전국"
      ? rawRows
          .filter((row) =>
            [row.region, row.city, row.address, row.industrialComplexName]
              .filter(Boolean)
              .some((value) => String(value).includes(preferredRegion))
          )
          .slice(0, limit)
      : rawRows.slice(0, limit);

  const points = rows
    .map((row) => {
      const products = parseJsonArray(row.productsJson);
      const hsCodes = parseJsonArray(row.hsCodesJson);
      if (!matchesCategoryFilter(row, products, hsCodes, category)) return null;
      let coordinateSource: CoordinateSource = "REGION_FALLBACK";
      let base = regionCentroid(row.region, row.city);
      if (typeof row.latitude === "number" && typeof row.longitude === "number") {
        base = { latitude: row.latitude, longitude: row.longitude };
        coordinateSource = "SUPPLIER";
      } else if (typeof row.industrialComplexLatitude === "number" && typeof row.industrialComplexLongitude === "number") {
        base = { latitude: row.industrialComplexLatitude, longitude: row.industrialComplexLongitude };
        coordinateSource = "INDUSTRIAL_COMPLEX";
      }
      const score = matchScore({
        searchText: `${row.name} ${row.description ?? ""} ${row.region ?? ""} ${row.city ?? ""} ${row.address ?? ""}`,
        products,
        hsCodes,
        productName,
        hsCode
      });
      return {
        id: row.id,
        name: row.name,
        latitude: Number((base.latitude + jitter(row.id, "lat", coordinateSource)).toFixed(6)),
        longitude: Number((base.longitude + jitter(row.id, "lng", coordinateSource)).toFixed(6)),
        region: row.region,
        city: row.city,
        address: row.address,
        products,
        hsCodes,
        industrialComplex: row.industrialComplexName ?? null,
        industries: parseJsonArray(row.industrialComplexIndustryMixJson),
        matchScore: score,
        coordinateSource,
        providerName: row.providerName,
        datasetName: row.datasetName,
        sourceType: row.sourceType,
        sourceUrl: row.sourceUrl,
        fetchedAt: row.fetchedAt.toISOString(),
        license: row.license,
        verification: row.verification,
        linkedAnalysis: false
      };
    })
    .filter((point): point is NonNullable<typeof point> => Boolean(point))
    .sort((left, right) => right.matchScore - left.matchScore || left.name.localeCompare(right.name, "ko"));

  const matchedThreshold = productName || hsCode ? 34 : 0;
  const matched = points.filter((point) => point.matchScore >= matchedThreshold);
  const coordinateCounts = points.reduce(
    (acc, point) => {
      acc[point.coordinateSource] += 1;
      return acc;
    },
    { SUPPLIER: 0, INDUSTRIAL_COMPLEX: 0, REGION_FALLBACK: 0 } satisfies Record<CoordinateSource, number>
  );

  return NextResponse.json(
    {
      filters: {
        productName: productName ?? null,
        hsCode: hsCode ?? null,
        preferredRegion: preferredRegion ?? "전국",
        category
      },
      summary: {
        totalDomesticSuppliers,
        returnedPoints: points.length,
        matchedPoints: matched.length,
        coordinateCounts,
        primarySourceType: "MOTIE_PUBLIC"
      },
      points
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
