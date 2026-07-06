import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { prisma } from "@/lib/db/prisma";
import { estimateChinaLocationFromAddress } from "@/lib/geocoding/china-centroids";
import { toJson } from "@/lib/utils/json";

const sourceCode = "xlsx_overseas_food_facilities_20260621";

type OverseasFoodRow = {
  NO?: string;
  업소코드?: string;
  EST코드?: string;
  등록시설코드?: string;
  국가?: string;
  업소명?: string;
  주소?: string;
  등록일?: string;
  만료일?: string;
  영업종류?: string;
  식품종류?: string;
  비고?: string;
};

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

function splitCategories(value: string | undefined) {
  const categories = (value ?? "")
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return categories.length > 0 ? Array.from(new Set(categories)) : ["식품"];
}

function riskLevelForNote(note: string | undefined) {
  if (note?.includes("시설취소")) return "HIGH" as const;
  if (note?.includes("갱신필요")) return "MEDIUM" as const;
  return "LOW" as const;
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) throw new Error("Usage: pnpm exec tsx scripts/import-overseas-food-csv.ts work/overseas_food_facilities_20260621.csv");

  const csvText = await readFile(csvPath, "utf8");
  const rows = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as OverseasFoodRow[];

  await prisma.product.deleteMany({ where: { sourceCode } });
  await prisma.evidence.deleteMany({ where: { sourceCode } });
  await prisma.factory.deleteMany({ where: { sourceTagsJson: { contains: sourceCode } } });

  const factories = [];
  const products = [];
  let mapped = 0;

  for (const row of rows) {
    const canonicalName = row.업소명?.trim();
    const address = row.주소?.trim();
    if (!canonicalName || !address) continue;

    const estimate = estimateChinaLocationFromAddress({ address });
    const id = randomUUID();
    const riskLevel = riskLevelForNote(row.비고);
    if (estimate) mapped += 1;

    factories.push({
      id,
      canonicalName,
      country: row.국가?.trim() || "중국",
      province: estimate?.province,
      city: estimate?.city,
      addressRaw: address,
      addressNormalized: address,
      latitude: estimate?.latitude,
      longitude: estimate?.longitude,
      coordSystem: estimate ? ("WGS84" as const) : ("UNKNOWN" as const),
      geocodeConfidence: estimate?.confidence,
      geocodeProvider: estimate?.provider,
      sourceTagsJson: toJson([sourceCode]),
      riskLevel,
      importReadinessScore: riskLevel === "LOW" ? 70 : riskLevel === "MEDIUM" ? 45 : 25,
      aliasesJson: toJson([row.업소코드, row.EST코드, row.등록시설코드].filter(Boolean))
    });

    for (const category of splitCategories(row.식품종류)) {
      products.push({
        id: randomUUID(),
        factoryId: id,
        productName: category,
        category,
        sourceCode,
        rawJson: toJson({
          no: row.NO,
          facilityCode: row.업소코드,
          estCode: row.EST코드,
          registeredFacilityCode: row.등록시설코드,
          businessType: row.영업종류,
          foodType: row.식품종류,
          note: row.비고,
          registeredAt: row.등록일,
          expiresAt: row.만료일
        })
      });
    }
  }

  for (const batch of chunk(factories, 500)) {
    await prisma.factory.createMany({ data: batch });
  }
  for (const batch of chunk(products, 1000)) {
    await prisma.product.createMany({ data: batch });
  }

  console.log(
    JSON.stringify(
      {
        sourceCode,
        inputRows: rows.length,
        importedFactories: factories.length,
        importedProductRows: products.length,
        mappedFactories: mapped
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
