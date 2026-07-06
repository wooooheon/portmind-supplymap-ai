import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type ChinaCategory = "all" | "packaging" | "processed_food" | "agriculture" | "additive" | "seafood" | "health_food" | "cosmetics" | "electronics";

const categoryTerms: Record<ChinaCategory, string[]> = {
  all: [],
  packaging: ["기구·용기·포장", "포장", "용기", "packaging", "bottle", "container", "cap", "tray"],
  processed_food: ["가공식품", "식품", "food", "snack", "beverage", "sauce"],
  agriculture: ["농산물", "농산", "vegetable", "fruit", "grain", "bean"],
  additive: ["식품첨가물", "첨가물", "additive", "flavor", "enzyme"],
  seafood: ["수산물", "seafood", "fish", "shrimp", "aquatic"],
  health_food: ["건강기능식품", "건강", "supplement", "capsule", "fish oil"],
  cosmetics: ["화장품", "cosmetic", "cream", "mist", "airless", "pump bottle"],
  electronics: ["전자제품", "전자", "LED", "PCB", "speaker", "camera", "power bank", "motor"]
};

function normalizeCategory(value?: string | null): ChinaCategory {
  const normalized = (value ?? "all").trim();
  return Object.prototype.hasOwnProperty.call(categoryTerms, normalized) ? (normalized as ChinaCategory) : "all";
}

function sourceMeta(tags?: string | null) {
  const value = tags ?? "";
  if (value.includes("xlsx_overseas_food_facilities_20260621")) {
    return {
      sourceType: "OTHER_PUBLIC" as const,
      sourceName: "MFDS 해외제조업소 엑셀",
      sourceDetail: "식약처 해외제조업소 계열 업로드 데이터"
    };
  }
  if (value.includes("mfds_import_food_foreign_manufacturers")) {
    return {
      sourceType: "OTHER_PUBLIC" as const,
      sourceName: "MFDS 수입식품 해외제조업소 API",
      sourceDetail: "식약처 수입식품 해외제조업소 정보"
    };
  }
  if (value.includes("mfds_medical_device_items")) {
    return {
      sourceType: "OTHER_PUBLIC" as const,
      sourceName: "MFDS 의료기기 API",
      sourceDetail: "식약처 의료기기 품목/허가 정보"
    };
  }
  if (value.includes("sample_seed")) {
    return {
      sourceType: "PRIVATE" as const,
      sourceName: "샘플 데이터",
      sourceDetail: "로컬 샘플 레코드"
    };
  }
  return {
    sourceType: "PRIVATE" as const,
    sourceName: "중국/해외 공장 베타 DB",
    sourceDetail: "해외 공장 보조 데이터"
  };
}

function coordinateQuality(provider?: string | null, confidence?: number | null) {
  if (!provider) return "좌표 확인 필요";
  if (provider === "AMap") return `주소 지오코딩 · ${Math.round((confidence ?? 0.82) * 100)}%`;
  if (provider === "address-city-centroid") return "도시 중심 추정 좌표";
  if (provider === "address-province-centroid") return "성/지역 중심 추정 좌표";
  if (provider === "seed-sample") return "샘플 좌표";
  return `${provider} · ${Math.round((confidence ?? 0) * 100)}%`;
}

function queryTerms(query?: string | null): string[] {
  if (!query) return [];
  const normalized = query.normalize("NFKC").trim();
  const tokens = normalized.match(/[\p{L}\p{N}]+/gu) ?? [];
  const hints: string[] = [];
  if (/포장|용기|패키|병|캡/i.test(normalized)) hints.push("기구·용기·포장", "포장", "용기", "packaging", "container", "bottle");
  if (/식품|푸드|가공|과자|음료/i.test(normalized)) hints.push("가공식품", "식품", "food");
  if (/농산|과일|곡물|채소/i.test(normalized)) hints.push("농산물", "vegetable", "fruit", "grain");
  if (/첨가|향료|효소/i.test(normalized)) hints.push("식품첨가물", "additive", "flavor", "enzyme");
  if (/수산|어류|새우|해산/i.test(normalized)) hints.push("수산물", "seafood", "fish", "shrimp");
  if (/건강|기능|영양|보충/i.test(normalized)) hints.push("건강기능식품", "supplement", "capsule");
  if (/화장|코스메틱|뷰티|크림/i.test(normalized)) hints.push("화장품", "cosmetic", "cream");
  if (/전기|전자|LED|PCB|모터|배터리|히터|조명/i.test(normalized)) hints.push("전자제품", "전자", "LED", "PCB", "motor");
  return Array.from(new Set([normalized, ...tokens, ...hints].filter((term) => term.trim().length >= 2)));
}

function factoryWhere(args: { category: ChinaCategory; query?: string | null }): Prisma.FactoryWhereInput {
  const terms = [
    ...categoryTerms[args.category],
    ...queryTerms(args.query)
  ].filter(Boolean);

  const base: Prisma.FactoryWhereInput = {
    AND: [
      { OR: [{ country: "중국" }, { country: "CN" }, { country: "China" }] },
      { latitude: { not: null } },
      { longitude: { not: null } }
    ]
  };

  if (terms.length === 0) return base;

  return {
    AND: [
      base,
      {
        OR: terms.flatMap((term): Prisma.FactoryWhereInput[] => [
          { canonicalName: { contains: term } },
          { province: { contains: term } },
          { city: { contains: term } },
          { addressRaw: { contains: term } },
          { addressNormalized: { contains: term } },
          { products: { some: { category: { contains: term } } } },
          { products: { some: { productName: { contains: term } } } }
        ])
      }
    ]
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = normalizeCategory(url.searchParams.get("category"));
  const query = url.searchParams.get("productName") ?? url.searchParams.get("q") ?? undefined;
  const limit = Math.max(200, Math.min(5000, Number(url.searchParams.get("limit") ?? 3500)));
  const where = factoryWhere({ category, query });

  const [totalChinaFactories, totalWithCoordinates, matchedTotal, factories] = await Promise.all([
    prisma.factory.count({ where: { OR: [{ country: "중국" }, { country: "CN" }, { country: "China" }] } }),
    prisma.factory.count({
      where: {
        OR: [{ country: "중국" }, { country: "CN" }, { country: "China" }],
        latitude: { not: null },
        longitude: { not: null }
      }
    }),
    prisma.factory.count({ where }),
    prisma.factory.findMany({
      where,
      select: {
        id: true,
        canonicalName: true,
        country: true,
        province: true,
        city: true,
        addressRaw: true,
        addressNormalized: true,
        latitude: true,
        longitude: true,
        riskLevel: true,
        geocodeProvider: true,
        geocodeConfidence: true,
        sourceTagsJson: true,
        products: {
          select: {
            category: true,
            productName: true
          },
          take: 6
        }
      },
      orderBy: [{ geocodeConfidence: "desc" }, { updatedAt: "desc" }],
      take: limit
    })
  ]);

  const points = factories
    .filter((factory) => typeof factory.latitude === "number" && typeof factory.longitude === "number")
    .map((factory) => {
      const source = sourceMeta(factory.sourceTagsJson);
      const categories = Array.from(new Set(factory.products.map((product) => product.category).filter(Boolean) as string[]));
      const products = Array.from(new Set(factory.products.map((product) => product.productName).filter(Boolean)));
      return {
        id: factory.id,
        name: factory.canonicalName,
        latitude: factory.latitude as number,
        longitude: factory.longitude as number,
        country: factory.country,
        province: factory.province,
        city: factory.city,
        address: factory.addressNormalized ?? factory.addressRaw,
        categories,
        products,
        riskLevel: factory.riskLevel,
        geocodeProvider: factory.geocodeProvider,
        geocodeConfidence: factory.geocodeConfidence,
        coordinateQuality: coordinateQuality(factory.geocodeProvider, factory.geocodeConfidence),
        sourceType: source.sourceType,
        sourceName: source.sourceName,
        sourceDetail: source.sourceDetail
      };
    });

  const coordinateCounts = points.reduce<Record<string, number>>((acc, point) => {
    const key = point.geocodeProvider ?? "UNKNOWN";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const sourceCounts = points.reduce<Record<string, number>>((acc, point) => {
    acc[point.sourceName] = (acc[point.sourceName] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json(
    {
      filters: { category, productName: query ?? null, country: "CN" },
      summary: {
        totalChinaFactories,
        totalWithCoordinates,
        matchedTotal,
        returnedPoints: points.length,
        coordinateCounts,
        sourceCounts,
        beta: true
      },
      points
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
