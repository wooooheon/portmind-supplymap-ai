import { PrismaClient, RiskLevel } from "@prisma/client";
import { API_SOURCE_DEFINITIONS } from "@/lib/connectors/source-definitions";
import { calculateImportReadinessScore } from "@/lib/scoring/import-readiness";
import { toJson } from "@/lib/utils/json";

const prisma = new PrismaClient();

const sampleFactories = [
  ["Shenzhen Lumina Electric Co., Ltd.", "深圳市明光电器有限公司", "CN", "Guangdong", "Shenzhen", "전자제품", "LED desk lamp", 22.5431, 114.0579, "LOW"],
  ["Dongguan Wave Audio Factory", "东莞市声波电子厂", "CN", "Guangdong", "Dongguan", "전자제품", "Bluetooth speaker", 23.0207, 113.7518, "LOW"],
  ["Guangzhou Pure Beauty Cosmetics", "广州净美化妆品有限公司", "CN", "Guangdong", "Guangzhou", "화장품", "Moisturizing cream", 23.1291, 113.2644, "MEDIUM"],
  ["Ningbo Harbor Auto Parts", "宁波港湾汽车零部件有限公司", "CN", "Zhejiang", "Ningbo", "자동차부품", "Brake pad", 29.8683, 121.544, "LOW"],
  ["Yiwu Market Home Goods", "义乌市家品贸易有限公司", "CN", "Zhejiang", "Yiwu", "생활화학제품", "Cleaning spray", 29.3069, 120.0751, "MEDIUM"],
  ["Qingdao Green Foods Co., Ltd.", "青岛绿源食品有限公司", "CN", "Shandong", "Qingdao", "식품", "Frozen vegetable", 36.0671, 120.3826, "LOW"],
  ["Shanghai MedCare Devices", "上海康护医疗器械有限公司", "CN", "Shanghai", "Shanghai", "보호구", "Protective mask", 31.2304, 121.4737, "LOW"],
  ["Suzhou OptiTech Components", "苏州光科组件有限公司", "CN", "Jiangsu", "Suzhou", "전자제품", "Camera module", 31.2989, 120.5853, "LOW"],
  ["Xiamen Ocean Nutrients", "厦门海源营养品有限公司", "CN", "Fujian", "Xiamen", "식품", "Fish oil capsule", 24.4798, 118.0894, "MEDIUM"],
  ["Foshan Heatwell Appliance Co., Ltd.", "佛山暖佳电器有限公司", "CN", "Guangdong", "Foshan", "전자제품", "Portable heater", 23.0215, 113.1214, "HIGH"],
  ["Shenzhen VoltMax Battery", "深圳伏特电池有限公司", "CN", "Guangdong", "Shenzhen", "전자제품", "Power bank", 22.56, 114.09, "HIGH"],
  ["Dongguan SafeWear PPE", "东莞安护用品有限公司", "CN", "Guangdong", "Dongguan", "보호구", "Safety shoes", 23.04, 113.76, "LOW"],
  ["Guangzhou Aroma Lab", "广州香氛实验室有限公司", "CN", "Guangdong", "Guangzhou", "화장품", "Fragrance mist", 23.15, 113.28, "UNKNOWN"],
  ["Ningbo Servo Motion", "宁波伺服动力有限公司", "CN", "Zhejiang", "Ningbo", "자동차부품", "Window motor", 29.89, 121.56, "LOW"],
  ["Yiwu Kids Toy Works", "义乌童玩工坊", "CN", "Zhejiang", "Yiwu", "생활화학제품", "Plastic toy set", 29.31, 120.08, "HIGH"],
  ["Qingdao Bay Seafood Processing", "青岛湾海产加工有限公司", "CN", "Shandong", "Qingdao", "식품", "Frozen seafood", 36.08, 120.4, "HIGH"],
  ["Shanghai CleanChem Products", "上海清洁化学品有限公司", "CN", "Shanghai", "Shanghai", "생활화학제품", "Laundry capsule", 31.22, 121.48, "MEDIUM"],
  ["Suzhou Circuit Assembly", "苏州电路组装有限公司", "CN", "Jiangsu", "Suzhou", "전자제품", "PCB assembly", 31.31, 120.6, "LOW"],
  ["Xiamen Beauty Packaging", "厦门美妆包装有限公司", "CN", "Fujian", "Xiamen", "화장품", "Airless pump bottle", 24.5, 118.1, "UNKNOWN"],
  ["Foshan AutoTrim Parts", "佛山车饰零件有限公司", "CN", "Guangdong", "Foshan", "자동차부품", "Interior trim", 23.03, 113.13, "LOW"]
] as const;

async function seedApiSources() {
  for (const source of API_SOURCE_DEFINITIONS) {
    await prisma.apiSource.upsert({
      where: { code: source.code },
      update: {
        name: source.name,
        provider: source.provider,
        category: source.category,
        baseUrl: source.baseUrl,
        requiresKey: source.requiresKey,
        keyEnvName: source.keyEnvName,
        status: source.status,
        docsUrl: source.docsUrl
      },
      create: {
        code: source.code,
        name: source.name,
        provider: source.provider,
        category: source.category,
        baseUrl: source.baseUrl,
        requiresKey: source.requiresKey,
        keyEnvName: source.keyEnvName,
        status: source.status,
        docsUrl: source.docsUrl
      }
    });
  }
}

async function upsertFactory(sample: (typeof sampleFactories)[number]) {
  const [
    canonicalName,
    chineseName,
    country,
    province,
    city,
    category,
    productName,
    latitude,
    longitude,
    riskLevel
  ] = sample;
  const existing = await prisma.factory.findFirst({ where: { canonicalName, country, city } });
  const highRisk = riskLevel === "HIGH";
  const mediumRisk = riskLevel === "MEDIUM";
  const score = calculateImportReadinessScore({
    officialMatches: riskLevel === "UNKNOWN" ? 0 : 1,
    certificates: highRisk ? 0 : 1,
    tradeRequirements: 1,
    riskEvents: highRisk ? [{ eventType: "RECALL", severity: "HIGH" }] : mediumRisk ? [{ eventType: "NON_COMPLIANCE", severity: "MEDIUM" }] : [],
    hasHighConfidenceGeocode: true,
    negativeSearchSignals: highRisk ? 1 : 0
  });

  const factory = existing
    ? await prisma.factory.update({
        where: { id: existing.id },
        data: {
          chineseName,
          province,
          city,
          addressRaw: `${city} manufacturing cluster`,
          addressNormalized: `${city} manufacturing cluster`,
          latitude,
          longitude,
          coordSystem: "WGS84",
          geocodeConfidence: 0.9,
          geocodeProvider: "seed-sample",
          sourceTagsJson: toJson(["sample_seed"]),
          riskLevel: riskLevel as RiskLevel,
          importReadinessScore: score
        }
      })
    : await prisma.factory.create({
        data: {
          canonicalName,
          chineseName,
          country,
          province,
          city,
          addressRaw: `${city} manufacturing cluster`,
          addressNormalized: `${city} manufacturing cluster`,
          latitude,
          longitude,
          coordSystem: "WGS84",
          geocodeConfidence: 0.9,
          geocodeProvider: "seed-sample",
          sourceTagsJson: toJson(["sample_seed"]),
          riskLevel: riskLevel as RiskLevel,
          importReadinessScore: score
        }
      });

  await prisma.product.create({
    data: {
      factoryId: factory.id,
      productName,
      category,
      hsCodeCandidate: category === "화장품" ? "3304" : category === "전자제품" ? "8518" : undefined,
      sourceCode: "sample_seed",
      rawJson: toJson({ category, productName })
    }
  });

  if (!highRisk && riskLevel !== "UNKNOWN") {
    await prisma.certificate.create({
      data: {
        factoryId: factory.id,
        certType: category === "전자제품" ? "KC" : category === "보호구" ? "KOSHA" : category === "식품" ? "MFDS" : "OTHER",
        certNumber: `SAMPLE-${factory.id.slice(-6).toUpperCase()}`,
        modelName: productName,
        productName,
        manufacturerName: canonicalName,
        country,
        status: "sample verified",
        sourceCode: "sample_seed",
        rawJson: toJson({ sample: true })
      }
    });
  }

  if (highRisk || mediumRisk) {
    await prisma.riskEvent.create({
      data: {
        factoryId: factory.id,
        eventType: highRisk ? "RECALL" : "NON_COMPLIANCE",
        title: highRisk ? "Sample high-risk recall signal" : "Sample partial verification issue",
        description: highRisk
          ? "모의 데이터: 리콜/중단/부적합 등 고위험 이력이 있는 것으로 표시됩니다."
          : "모의 데이터: 일부 인증 또는 주소 확인이 추가로 필요합니다.",
        severity: highRisk ? "HIGH" : "MEDIUM",
        sourceCode: "sample_seed",
        rawJson: toJson({ sample: true, riskLevel })
      }
    });
  }

  await prisma.evidence.create({
    data: {
      entityType: "FACTORY",
      entityId: factory.id,
      sourceCode: "sample_seed",
      evidenceType: "USER_UPLOAD",
      title: `${canonicalName} sample evidence`,
      rawSnippet: "공식 공개 데이터와 사용자가 제공한 자료를 기준으로 확인된 정보",
      rawJson: toJson({ sample: true, category, productName })
    }
  });
}

async function main() {
  await seedApiSources();
  for (const sample of sampleFactories) {
    await upsertFactory(sample);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log(`Seeded ${API_SOURCE_DEFINITIONS.length} API sources and ${sampleFactories.length} sample factories.`);
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
