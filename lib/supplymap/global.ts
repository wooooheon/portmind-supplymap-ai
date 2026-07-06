import { prisma } from "@/lib/db/prisma";
import { safeJsonParse } from "@/lib/utils/json";
import type { Prisma } from "@prisma/client";
import type { ProductIntent, Provenance, SupplierCandidate, SupplySourceType } from "./types";

const DEFAULT_TOP_K = 6;
const MAX_TOP_K = 20;
const MAX_FACTORY_SCAN = 60;

const countryNames: Record<string, string> = {
  CN: "중국",
  중국: "중국",
  China: "중국",
  CHN: "중국",
  VN: "베트남",
  베트남: "베트남",
  Vietnam: "베트남",
  US: "미국",
  미국: "미국"
};

function aliases(country?: string): string[] {
  if (!country || country === "ALL") return [];
  if (country === "CN" || country === "중국") return ["CN", "중국", "China", "CHN"];
  if (country === "VN" || country === "베트남") return ["VN", "베트남", "Vietnam"];
  if (country === "US" || country === "미국") return ["US", "미국", "USA", "United States"];
  return [country];
}

export function sourceTypeFromTags(tags: readonly string[]): SupplySourceType {
  if (tags.some((tag) => /user|upload|csv|xlsx/i.test(tag))) return "USER_UPLOAD";
  if (tags.some((tag) => /mfds|customs|data[_-]?go|public|openapi|api/i.test(tag))) return "OTHER_PUBLIC";
  return "PRIVATE";
}

function provenanceFromTags(tagsJson: string | null): Provenance {
  const tags = safeJsonParse<string[]>(tagsJson, []);
  const sourceType = sourceTypeFromTags(tags);
  let providerName = "민간·해외 공급망 데이터";
  let datasetName = "해외 공장 통합 보조 데이터";
  let sourceUrl = "https://www.google.com/maps";
  let verification: Provenance["verification"] = "CHECK_REQUIRED";

  if (sourceType === "USER_UPLOAD") {
    providerName = "사용자 업로드";
    datasetName = tags.some((tag) => tag.includes("overseas_food"))
      ? "해외 식품 제조시설 업로드 스냅샷"
      : "사용자 공급업체 목록";
    sourceUrl = tags.some((tag) => tag.includes("overseas_food"))
      ? "https://www.data.go.kr/data/15073967/openapi.do"
      : "about:blank";
    verification = "CHECK_REQUIRED";
  } else if (sourceType === "OTHER_PUBLIC") {
    providerName = "식품의약품안전처";
    datasetName = "수입식품 해외제조업소 정보";
    sourceUrl = "https://www.data.go.kr/data/15073967/openapi.do";
    verification = "PARTIAL";
  }

  return {
    providerName,
    datasetName,
    sourceType,
    sourceUrl,
    fetchedAt: "2026-07-04T00:00:00.000Z",
    license:
      sourceType === "PRIVATE"
        ? "각 원천 서비스 약관 적용"
        : sourceType === "USER_UPLOAD"
          ? "업로드 제공자가 원본 이용권한 확인 필요"
          : "공공데이터포털 이용조건 준수",
    verification
  };
}

function mockCandidates(intent: ProductIntent): SupplierCandidate[] {
  const isPackaging = /포장|용기/.test(intent.category + " " + intent.query);
  const products = isPackaging ? ["식품용 포장용기", "플라스틱 캡", "밀폐용기"] : [intent.category, intent.query];
  return [
    {
      id: "global-demo-shenzhen",
      name: "Shenzhen Supply Demo Factory",
      scope: "GLOBAL",
      countryCode: "CN",
      countryName: "중국",
      region: "Guangdong",
      city: "Shenzhen",
      address: "Shenzhen, Guangdong, China",
      latitude: 22.5431,
      longitude: 114.0579,
      products,
      hsCodes: intent.hsCodeCandidates,
      description: "API 키가 없을 때 사용하는 중국/해외 베타 mock 레코드입니다.",
      matchReason: "제품 분류와 희망 수입국이 일치하며 개별 실사·인증 확인이 필요합니다.",
      providerName: "민간·해외 공급망 데이터",
      datasetName: "중국/해외 공장 베타 데이터",
      sourceType: "PRIVATE",
      sourceUrl: "https://www.amap.com",
      fetchedAt: "2026-07-04T00:00:00.000Z",
      license: "각 원천 서비스 약관 적용",
      verification: "MOCK"
    },
    {
      id: "global-demo-dongguan",
      name: "Dongguan Manufacturing Demo",
      scope: "GLOBAL",
      countryCode: "CN",
      countryName: "중국",
      region: "Guangdong",
      city: "Dongguan",
      address: "Dongguan, Guangdong, China",
      latitude: 23.0207,
      longitude: 113.7518,
      products,
      hsCodes: intent.hsCodeCandidates,
      description: "샘플 fallback 중국/해외 베타 후보이며 공공데이터 검증 대상이 아닙니다.",
      matchReason: "제품 키워드 일치. 공급능력·거래신용·인증은 확인 필요",
      providerName: "민간·해외 공급망 데이터",
      datasetName: "중국/해외 공장 베타 데이터",
      sourceType: "PRIVATE",
      sourceUrl: "https://www.google.com/maps",
      fetchedAt: "2026-07-04T00:00:00.000Z",
      license: "각 원천 서비스 약관 적용",
      verification: "MOCK"
    }
  ];
}

function normalizeTopK(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_TOP_K;
  return Math.max(1, Math.min(MAX_TOP_K, Math.trunc(value ?? DEFAULT_TOP_K)));
}

function normalizedTerms(intent: ProductIntent): string[] {
  const rawTerms = [
    intent.category,
    ...intent.keywords,
    ...intent.query.split(/[\s,./|·ㆍ;]+/)
  ];
  return Array.from(
    new Set(
      rawTerms
        .map((term) => term.normalize("NFKC").trim())
        .filter((term) => term.length >= 2 && term !== "품목 확인 필요")
    )
  ).slice(0, 10);
}

function productConditions(terms: readonly string[], hsCodes: readonly string[]): Prisma.ProductWhereInput[] {
  const conditions: Prisma.ProductWhereInput[] = terms.flatMap((term) => [
    { productName: { contains: term } },
    { category: { contains: term } }
  ]);
  for (const code of hsCodes) {
    const normalized = code.replace(/[^0-9]/g, "").slice(0, 10);
    if (normalized.length >= 4) {
      conditions.push({ hsCodeCandidate: { contains: normalized.slice(0, 6) } });
    }
  }
  return conditions;
}

function factoryConditions(terms: readonly string[]): Prisma.FactoryWhereInput[] {
  return terms.flatMap((term) => [
    { canonicalName: { contains: term } },
    { koreanName: { contains: term } },
    { englishName: { contains: term } },
    { chineseName: { contains: term } },
    { province: { contains: term } },
    { city: { contains: term } },
    { addressRaw: { contains: term } },
    { addressNormalized: { contains: term } }
  ]);
}

function textHitScore(text: string, terms: readonly string[]): number {
  const haystack = text.normalize("NFKC").toLocaleLowerCase();
  return terms.reduce((score, term) => score + (haystack.includes(term.toLocaleLowerCase()) ? 1 : 0), 0);
}

export async function findGlobalSupply(
  intent: ProductIntent,
  options: { forceFallback?: boolean; topK?: number; offset?: number } = {}
): Promise<{ candidates: SupplierCandidate[]; usedMock: boolean }> {
  const topK = normalizeTopK(options.topK);
  const terms = normalizedTerms(intent);
  const countries = aliases(intent.importCountry);
  const productOr = productConditions(terms, intent.hsCodeCandidates);
  const factoryOr = factoryConditions(terms);

  if (options.forceFallback) return { candidates: mockCandidates(intent).slice(0, topK), usedMock: true };

  try {
    const productWhere: Prisma.ProductWhereInput | undefined = productOr.length > 0 ? { OR: productOr } : undefined;
    const matchWhere: Prisma.FactoryWhereInput =
      factoryOr.length > 0 || productOr.length > 0
        ? {
            OR: [
              ...factoryOr,
              ...(productWhere ? [{ products: { some: productWhere } }] : [])
            ]
          }
        : {};
    const countryWhere: Prisma.FactoryWhereInput =
      countries.length > 0 ? { country: { in: countries } } : { country: { notIn: ["KR", "한국", "대한민국"] } };
    const scanLimit = Math.min(MAX_FACTORY_SCAN, Math.max(topK * 4, 12));

    const factories = await prisma.factory.findMany({
      where: {
        ...countryWhere,
        ...matchWhere
      },
      include: {
        products: productWhere
          ? {
              where: productWhere,
              take: 4
            }
          : {
              take: 4
            }
      },
      orderBy: [{ importReadinessScore: "desc" }, { updatedAt: "desc" }, { id: "asc" }],
      skip: Math.max(0, Math.trunc(options.offset ?? 0)),
      take: scanLimit
    });

    if (factories.length > 0) {
      const ranked = factories
        .map((factory) => {
          const productText = factory.products
            .map((product) => [product.productName, product.category, product.hsCodeCandidate].filter(Boolean).join(" "))
            .join(" ");
          const factoryText = [
            factory.canonicalName,
            factory.koreanName,
            factory.englishName,
            factory.chineseName,
            factory.province,
            factory.city,
            factory.addressRaw,
            factory.addressNormalized
          ]
            .filter(Boolean)
            .join(" ");
          return {
            factory,
            keywordHits: textHitScore(productText, terms) * 2 + textHitScore(factoryText, terms),
            readiness: factory.importReadinessScore ?? 0
          };
        })
        .sort(
          (left, right) =>
            right.keywordHits - left.keywordHits ||
            right.readiness - left.readiness ||
            left.factory.id.localeCompare(right.factory.id)
        )
        .slice(0, topK);

      return {
        usedMock: false,
        candidates: ranked.map(({ factory, keywordHits }) => {
          const provenance = provenanceFromTags(factory.sourceTagsJson);
          const products = factory.products.map((product) => product.productName || product.category || "품목 확인 필요");
          const visibleProducts = products.length > 0 ? products : [intent.category || intent.query];
          return {
            id: factory.id,
            name: factory.canonicalName,
            scope: "GLOBAL" as const,
            countryCode: factory.country,
            countryName: countryNames[factory.country] ?? factory.country,
            region: factory.province ?? undefined,
            city: factory.city ?? undefined,
            address: factory.addressNormalized ?? factory.addressRaw ?? undefined,
            latitude: factory.latitude ?? undefined,
            longitude: factory.longitude ?? undefined,
            products: visibleProducts,
            hsCodes: Array.from(new Set(factory.products.map((product) => product.hsCodeCandidate).filter(Boolean) as string[])),
            description:
              provenance.sourceType === "PRIVATE"
                ? "민간·중국/해외 베타 데이터 기반 후보입니다. 공장 실사와 증빙 확인이 필요합니다."
                : "타 기관 공공데이터에서 확인된 중국/해외 제조업소 후보입니다.",
            matchReason:
              keywordHits > 0
                ? `제품명·분류 키워드 ${keywordHits}개가 해외 Factory DB와 매칭되었습니다.`
                : "희망 수입국과 해외 Factory DB 후보를 보조 매칭했습니다.",
            ...provenance
          };
        })
      };
    }
  } catch {
    // Existing Factory data is optional in clean local environments.
  }

  return { candidates: mockCandidates(intent).slice(0, topK), usedMock: true };
}
