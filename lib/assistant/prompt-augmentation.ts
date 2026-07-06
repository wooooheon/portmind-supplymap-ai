import { prisma } from "@/lib/db/prisma";
import { getConnector } from "@/lib/connectors/registry";
import type { NormalizedRecord } from "@/lib/connectors/types";
import { safeJsonParse } from "@/lib/utils/json";
import { analyzeTradePrompt } from "./intent";
import type { AssistantEvidence, MatchedFactory, PromptAugmentationResult, TradeAssistantIntent } from "./types";

function evidenceSummaryFromRecord(record: NormalizedRecord): string {
  const parts = [
    record.type,
    record.canonicalName,
    record.productName,
    record.country,
    record.hsCode ? `HS ${record.hsCode}` : null,
    record.certNumber ? `cert ${record.certNumber}` : null,
    record.eventType ? `event ${record.eventType}` : null
  ].filter(Boolean);
  return parts.join(" · ") || `${record.sourceCode} record`;
}

function inferredHsCode(intent: TradeAssistantIntent): string | undefined {
  if (intent.hsCode) return intent.hsCode;
  const text = `${intent.query} ${intent.productTerms.join(" ")}`;
  if (/화장품|코스메틱|cosmetic|기초화장/i.test(text)) return "3304999000";
  if (/과자|비스킷|식품|수입식품|농산물|축산물|수산물/i.test(text)) return "1905310000";
  if (/충전기|어댑터|전원공급|power adapter|charger/i.test(text)) return "8504403010";
  return undefined;
}

function connectorParams(intent: TradeAssistantIntent, sourceCode: string): Record<string, unknown> {
  const hsCode = inferredHsCode(intent);
  const params: Record<string, unknown> = {
    query: intent.productTerms[0] ?? intent.query.slice(0, 80),
    hsCode,
    country: intent.country,
    mock: process.env.MOCK_CONNECTORS !== "false"
  };

  if (sourceCode === "customs_confirmation_items") {
    params.hsSgn = hsCode;
    params.imexTpCd = "2";
  }

  if (sourceCode === "mfds_import_food_foreign_manufacturers" && intent.country === "CN") {
    params.NATN_NM = "중국";
  }

  return {
    ...params
  };
}

function countryAliases(country?: string): string[] {
  if (!country) return [];
  if (country === "CN") return ["CN", "중국", "China", "CHN"];
  if (country === "US") return ["US", "미국", "USA", "United States"];
  if (country === "VN") return ["VN", "베트남", "Vietnam"];
  if (country === "KR") return ["KR", "한국", "대한민국", "Korea"];
  return [country];
}

function compactTerms(intent: TradeAssistantIntent): string[] {
  const blocked = /수입|무역|관련|확인|필요|공장|업체|찾아|추천|정리|리스크|가능|중국|한국|미국|베트남|심천|선전|광동|광둥/i;
  const normalized = intent.productTerms.flatMap((term) => normalizeProductTerm(term.trim()));
  const terms = Array.from(
    new Set(
      normalized
        .filter((term) => term.length >= 2)
        .filter((term) => !blocked.test(term) || /식품|화장품|의료기기|전자제품|가공식품|수산물|농산물|건강기능|포장|용기|기구/i.test(term))
    )
  );
  const hasSpecificFood = terms.some((term) => /가공식품|기구·용기·포장|식품첨가물|건강기능식품|농산물|수산물/.test(term));
  return terms.filter((term) => !(term === "식품" && hasSpecificFood)).slice(0, 12);
}

function normalizeProductTerm(term: string): string[] {
  const terms = new Set<string>();
  const cleaned = term
    .replace(/^(심천|선전|중국|광동|광둥)에?\s*(있는|소재|위치한)?\s*/i, "")
    .replace(/\s*공장.*$/i, "")
    .trim();

  if (/기구\s*[·ㆍ,/]?\s*용기\s*[·ㆍ,/]?\s*포장|기구|용기|포장|식품용기|포장재/i.test(cleaned)) {
    terms.add("기구·용기·포장");
  }
  if (/가공식품|가공 식품|processed food/i.test(cleaned)) terms.add("가공식품");
  if (/식품첨가물|첨가물/i.test(cleaned)) terms.add("식품첨가물");
  if (/건강기능식품|건강기능|건기식/i.test(cleaned)) terms.add("건강기능식품");
  if (/농산물|농산/i.test(cleaned)) terms.add("농산물");
  if (/수산물|수산/i.test(cleaned)) terms.add("수산물");
  if (/식품|과자|비스킷/i.test(cleaned)) terms.add(cleaned.includes("식품") && cleaned.length <= 12 ? cleaned : "식품");
  if (/화장품|코스메틱|cosmetic/i.test(cleaned)) terms.add("화장품");
  if (/의료기기|의료 기기/i.test(cleaned)) terms.add("의료기기");
  if (/전자|스피커|충전기|어댑터|제습기/i.test(cleaned)) terms.add("전자제품");
  if (terms.size === 0 && cleaned.length >= 2) terms.add(cleaned);
  return Array.from(terms);
}

function locationAliases(intent: TradeAssistantIntent): string[] {
  const aliases = new Set<string>();
  const text = [intent.query, ...intent.locationTerms].join(" ");
  if (/심천|선전|shenzhen|深圳/i.test(text)) ["Shenzhen", "SHENZHEN", "深圳", "심천", "선전"].forEach((term) => aliases.add(term));
  if (/광동|광둥|guangdong|广东/i.test(text)) ["Guangdong", "GUANGDONG", "广东", "광동", "광둥"].forEach((term) => aliases.add(term));
  if (/상하이|shanghai|上海/i.test(text)) ["Shanghai", "SHANGHAI", "上海", "상하이"].forEach((term) => aliases.add(term));
  if (/베이징|북경|beijing|北京/i.test(text)) ["Beijing", "BEIJING", "北京", "베이징", "북경"].forEach((term) => aliases.add(term));
  if (/칭다오|청도|qingdao|青岛/i.test(text)) ["Qingdao", "QINGDAO", "青岛", "칭다오", "청도"].forEach((term) => aliases.add(term));
  if (/동관|둥관|dongguan|东莞/i.test(text)) ["Dongguan", "DONGGUAN", "东莞", "동관", "둥관"].forEach((term) => aliases.add(term));
  if (/광저우|광주|guangzhou|广州/i.test(text)) ["Guangzhou", "GUANGZHOU", "广州", "광저우", "광주"].forEach((term) => aliases.add(term));
  if (/이우|yiwu|义乌/i.test(text)) ["Yiwu", "YIWU", "义乌", "이우"].forEach((term) => aliases.add(term));
  if (/샤먼|하문|xiamen|厦门/i.test(text)) ["Xiamen", "XIAMEN", "厦门", "샤먼", "하문"].forEach((term) => aliases.add(term));
  return Array.from(aliases);
}

function factoryLocationFilters(aliases: string[]) {
  return aliases.flatMap((term) => [
    { canonicalName: { contains: term } },
    { chineseName: { contains: term } },
    { englishName: { contains: term } },
    { addressRaw: { contains: term } },
    { addressNormalized: { contains: term } },
    { city: { contains: term } },
    { province: { contains: term } }
  ]);
}

function sourceLabelFromTags(tagsJson?: string | null, fallback?: string | null): string | null {
  const tags = safeJsonParse<string[]>(tagsJson, fallback ? [fallback] : []);
  if (tags.includes("xlsx_overseas_food_facilities_20260621")) return "MFDS 해외제조업소 엑셀";
  if (tags.includes("mfds_import_food_foreign_manufacturers")) return "MFDS 수입식품 API";
  if (tags.includes("mfds_medical_device_items")) return "MFDS 의료기기 API";
  if (tags.includes("sample_seed")) return "샘플 데이터";
  return tags[0] ?? fallback ?? null;
}

function matchedFactoryFromFactory(args: {
  factory: {
    id: string;
    canonicalName: string;
    country: string;
    province: string | null;
    city: string | null;
    addressRaw: string | null;
    addressNormalized: string | null;
    latitude: number | null;
    longitude: number | null;
    riskLevel: string;
    importReadinessScore: number;
    geocodeConfidence: number | null;
    sourceTagsJson: string | null;
    products?: Array<{ productName: string; category: string | null; sourceCode: string | null }>;
  };
  matchReason: string;
  fallbackSource?: string | null;
}): MatchedFactory {
  const products = args.factory.products ?? [];
  const category = products.find((product) => product.category)?.category ?? null;
  const feature = products.find((product) => product.productName)?.productName ?? category;
  return {
    id: args.factory.id,
    name: args.factory.canonicalName,
    country: args.factory.country,
    province: args.factory.province,
    city: args.factory.city,
    address: args.factory.addressNormalized ?? args.factory.addressRaw,
    category,
    feature,
    sourceCode: sourceLabelFromTags(args.factory.sourceTagsJson, args.fallbackSource ?? products[0]?.sourceCode),
    riskLevel: args.factory.riskLevel,
    importReadinessScore: args.factory.importReadinessScore,
    geocodeConfidence: args.factory.geocodeConfidence,
    latitude: args.factory.latitude,
    longitude: args.factory.longitude,
    matchReason: args.matchReason
  };
}

async function collectConnectorEvidence(intent: TradeAssistantIntent): Promise<{
  evidences: AssistantEvidence[];
  normalizedRecords: NormalizedRecord[];
  warnings: string[];
}> {
  const evidences: AssistantEvidence[] = [];
  const normalizedRecords: NormalizedRecord[] = [];
  const warnings: string[] = [];

  for (const sourceCode of intent.selectedSources) {
    try {
      const connector = getConnector(sourceCode);
      const raw = await connector.fetchRaw(connectorParams(intent, sourceCode));
      const normalized = await connector.normalize(raw);
      normalizedRecords.push(...normalized);
      evidences.push(
        ...normalized.slice(0, 5).map((record) => ({
          title: record.sourceRecordId ?? record.sourceCode,
          sourceCode: record.sourceCode,
          evidenceType: "CONNECTOR" as const,
          summary: `${raw.usedMock ? "[mock/fallback] " : ""}${evidenceSummaryFromRecord(record)}`,
          url: record.evidenceUrl ?? undefined,
          raw: record.rawJson
        }))
      );
      if (raw.usedMock) {
        warnings.push(`${sourceCode}는 실제 API 응답 대신 mock/fallback 데이터로 보강되었습니다.`);
      }
    } catch (error) {
      warnings.push(`${sourceCode} 조회 실패: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  return { evidences, normalizedRecords, warnings };
}

async function collectMatchedFactories(intent: TradeAssistantIntent): Promise<MatchedFactory[]> {
  const terms = compactTerms(intent);
  const aliases = locationAliases(intent);
  if (terms.length === 0 && aliases.length === 0) return [];

  const countries = countryAliases(intent.country);
  const countryWhere = countries.length > 0 ? { country: { in: countries } } : {};
  const locationFilters = factoryLocationFilters(aliases);
  const factoryScope = {
    ...countryWhere,
    ...(locationFilters.length > 0 ? { OR: locationFilters } : {})
  };
  const productFilters = terms.flatMap((term) => [
    { productName: { contains: term } },
    { category: { contains: term } }
  ]);
  const factoryFilters = [...terms, ...aliases].flatMap((term) => [
    { canonicalName: { contains: term } },
    { chineseName: { contains: term } },
    { englishName: { contains: term } },
    { addressRaw: { contains: term } },
    { addressNormalized: { contains: term } },
    { city: { contains: term } },
    { province: { contains: term } }
  ]);

  const [productMatches, factoryMatches] = await Promise.all([
    prisma.product.findMany({
      where: {
        ...(productFilters.length > 0 ? { OR: productFilters } : {}),
        factory: {
          is: factoryScope
        }
      },
      include: {
        factory: {
          include: {
            products: {
              select: {
                productName: true,
                category: true,
                sourceCode: true
              },
              take: 4
            }
          }
        }
      },
      take: aliases.length > 0 ? 80 : 36,
      orderBy: { createdAt: "desc" }
    }),
    prisma.factory.findMany({
      where: {
        ...(factoryFilters.length > 0 ? { OR: factoryFilters } : {}),
        ...countryWhere
      },
      include: {
        products: {
          select: {
            productName: true,
            category: true,
            sourceCode: true
          },
          take: 4
        }
      },
      take: 16,
      orderBy: { updatedAt: "desc" }
    })
  ]);

  const matched = new Map<string, MatchedFactory>();

  for (const product of productMatches) {
    if (!product.factory) continue;
    const term = terms.find((item) => product.productName.includes(item) || product.category?.includes(item)) ?? product.category ?? product.productName;
    const locationReason = aliases.length > 0 ? "지역 " + (intent.locationTerms[0] ?? aliases[0]) + " + " : "";
    matched.set(
      product.factory.id,
      matchedFactoryFromFactory({
        factory: product.factory,
        matchReason: locationReason + "제품/분류 매칭: " + term,
        fallbackSource: product.sourceCode
      })
    );
  }

  for (const factory of factoryMatches) {
    if (matched.has(factory.id)) continue;
    const term =
      terms.find((item) =>
        [factory.canonicalName, factory.chineseName, factory.englishName, factory.addressRaw, factory.city, factory.province]
          .filter(Boolean)
          .some((value) => String(value).includes(item))
      ) ?? terms[0];
    matched.set(factory.id, matchedFactoryFromFactory({ factory, matchReason: `공장/주소 매칭: ${term}` }));
  }

  return Array.from(matched.values())
    .sort((a, b) => {
      const scoreA = (a.latitude && a.longitude ? 20 : 0) + a.importReadinessScore - (a.riskLevel === "HIGH" ? 20 : 0);
      const scoreB = (b.latitude && b.longitude ? 20 : 0) + b.importReadinessScore - (b.riskLevel === "HIGH" ? 20 : 0);
      return scoreB - scoreA;
    })
    .slice(0, 8);
}

async function collectDatabaseEvidence(intent: TradeAssistantIntent): Promise<AssistantEvidence[]> {
  const terms = compactTerms(intent);
  const aliases = locationAliases(intent);
  if (terms.length === 0 && aliases.length === 0) return [];
  const countries = countryAliases(intent.country);
  const countryWhere = countries.length > 0 ? { country: { in: countries } } : {};
  const locationFilters = factoryLocationFilters(aliases);
  const factoryScope = {
    ...countryWhere,
    ...(locationFilters.length > 0 ? { OR: locationFilters } : {})
  };
  const orNameFilters = [...terms, ...aliases].flatMap((term) => [
    { canonicalName: { contains: term } },
    { chineseName: { contains: term } },
    { englishName: { contains: term } },
    { addressRaw: { contains: term } },
    { addressNormalized: { contains: term } },
    { city: { contains: term } },
    { province: { contains: term } }
  ]);

  const [factories, products, certificates, risks, requirements] = await Promise.all([
    prisma.factory.findMany({
      where: {
        OR: orNameFilters.length > 0 ? orNameFilters : undefined,
        ...countryWhere
      },
      include: { products: true },
      take: 8,
      orderBy: { updatedAt: "desc" }
    }),
    prisma.product.findMany({
      where: {
        ...(terms.length > 0 || intent.hsCode
          ? {
              OR: [
                ...terms.flatMap((term) => [{ productName: { contains: term } }, { category: { contains: term } }]),
                ...(intent.hsCode ? [{ hsCodeCandidate: { contains: intent.hsCode.slice(0, 4) } }] : [])
              ]
            }
          : {}),
        factory: {
          is: factoryScope
        }
      },
      include: { factory: true },
      take: 8,
      orderBy: { createdAt: "desc" }
    }),
    prisma.certificate.findMany({
      where: {
        OR: terms.flatMap((term) => [
          { productName: { contains: term } },
          { modelName: { contains: term } },
          { manufacturerName: { contains: term } },
          { certNumber: { contains: term } }
        ])
      },
      take: 8,
      orderBy: { createdAt: "desc" }
    }),
    prisma.riskEvent.findMany({
      where: {
        OR: terms.flatMap((term) => [{ title: { contains: term } }, { description: { contains: term } }])
      },
      include: { factory: true },
      take: 8,
      orderBy: { createdAt: "desc" }
    }),
    prisma.tradeRequirement.findMany({
      where: intent.hsCode ? { hsCode: { contains: intent.hsCode.slice(0, 4) } } : undefined,
      take: 8,
      orderBy: { createdAt: "desc" }
    })
  ]);

  const evidences: AssistantEvidence[] = [];
  evidences.push(
    ...factories.map((factory) => ({
      title: factory.canonicalName,
      sourceCode: safeJsonParse<string[]>(factory.sourceTagsJson, ["database"]).join(", "),
      evidenceType: "DATABASE" as const,
      summary: `공장 후보 · ${factory.country} ${factory.province ?? ""} ${factory.city ?? ""} · ${factory.products[0]?.category ?? "분류 확인"} · 리스크 ${factory.riskLevel} · 준비도 ${factory.importReadinessScore}/100`,
      raw: factory
    }))
  );
  evidences.push(
    ...products.map((product) => ({
      title: product.productName,
      sourceCode: product.sourceCode ?? "database",
      evidenceType: "DATABASE" as const,
      summary: `제품/분류 · ${product.category ?? "분류 확인"} · 공장 ${product.factory?.canonicalName ?? "연결 공장 확인 필요"}`,
      raw: product
    }))
  );
  evidences.push(
    ...certificates.map((cert) => ({
      title: cert.certNumber ?? cert.productName ?? "Certificate",
      sourceCode: cert.sourceCode,
      evidenceType: "DATABASE" as const,
      summary: `Certificate · ${cert.certType} · ${cert.status ?? "status unknown"} · ${cert.manufacturerName ?? ""}`,
      url: cert.evidenceUrl ?? undefined,
      raw: cert
    }))
  );
  evidences.push(
    ...risks.map((risk) => ({
      title: risk.title,
      sourceCode: risk.sourceCode,
      evidenceType: "DATABASE" as const,
      summary: `Risk · ${risk.eventType} · severity ${risk.severity ?? "unknown"} · factory ${risk.factory?.canonicalName ?? "unknown"}`,
      url: risk.evidenceUrl ?? undefined,
      raw: risk
    }))
  );
  evidences.push(
    ...requirements.map((requirement) => ({
      title: requirement.requirementName ?? requirement.lawName ?? requirement.hsCode,
      sourceCode: requirement.sourceCode,
      evidenceType: "DATABASE" as const,
      summary: `Trade requirement · HS ${requirement.hsCode} · ${requirement.lawName ?? "law unknown"} · ${requirement.agencyName ?? "agency unknown"}`,
      raw: requirement
    }))
  );

  return evidences.slice(0, 40);
}

function buildContextText(intent: TradeAssistantIntent, evidences: AssistantEvidence[], matchedFactories: MatchedFactory[]): string {
  const evidenceLines = evidences.slice(0, 30).map((evidence, index) => {
    return `${index + 1}. [${evidence.evidenceType}/${evidence.sourceCode}] ${evidence.title}: ${evidence.summary}${
      evidence.url ? ` (${evidence.url})` : ""
    }`;
  });
  const factoryLines = matchedFactories.slice(0, 8).map((factory, index) => {
    return `${index + 1}. ${factory.name} · ${factory.country} ${factory.province ?? ""} ${factory.city ?? ""} · ${factory.category ?? "분류 확인"} · ${factory.feature ?? "특징 확인"} · ${factory.matchReason} · source=${factory.sourceCode ?? "database"} · risk=${factory.riskLevel}`;
  });

  return [
    `User prompt: ${intent.query}`,
    `Parsed intent: hsCode=${intent.hsCode ?? "unknown"}, country=${intent.country ?? "unknown"}, locationTerms=${intent.locationTerms.join(", ") || "none"}, productTerms=${intent.productTerms.join(", ") || "unknown"}`,
    `Selected sources: ${intent.selectedSources.join(", ")}`,
    "Matched factories from local DB:",
    factoryLines.length > 0
      ? factoryLines.join("\n")
      : "No strong factory candidate was matched. Do not phrase this as a system failure; answer with a practical search/verification path.",
    "Evidence:",
    evidenceLines.length > 0
      ? evidenceLines.join("\n")
      : "No strong evidence rows were matched. Do not tell the user the DB is empty; explain what can be checked next."
  ].join("\n");
}

export async function buildPromptAugmentation(prompt: string): Promise<PromptAugmentationResult> {
  const intent = analyzeTradePrompt(prompt);
  const [matchedFactories, dbEvidences, connectorResult] = await Promise.all([
    collectMatchedFactories(intent),
    collectDatabaseEvidence(intent),
    collectConnectorEvidence(intent)
  ]);
  const evidences = [...dbEvidences, ...connectorResult.evidences].slice(0, 60);
  const warnings = [...intent.warnings, ...connectorResult.warnings];
  const finalIntent = { ...intent, warnings };

  return {
    intent: finalIntent,
    evidences,
    matchedFactories,
    normalizedRecords: connectorResult.normalizedRecords,
    contextText: buildContextText(finalIntent, evidences, matchedFactories)
  };
}
