import { parse } from "csv-parse/sync";
import { prisma } from "@/lib/db/prisma";
import { toJson } from "@/lib/utils/json";

type AllowedColumn =
  | "canonicalName"
  | "chineseName"
  | "englishName"
  | "country"
  | "province"
  | "city"
  | "addressRaw"
  | "productCategory"
  | "productName"
  | "website"
  | "sourceUrl";

type FactoryImportRow = Partial<Record<AllowedColumn, string>>;

export async function importFactoriesFromCsv(csvText: string) {
  const rows = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as FactoryImportRow[];

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    if (!row.canonicalName) continue;
    const country = row.country || "CN";
    const existing = await prisma.factory.findFirst({
      where: {
        canonicalName: row.canonicalName,
        country,
        city: row.city || undefined,
        addressRaw: row.addressRaw || undefined
      }
    });

    const data = {
      canonicalName: row.canonicalName,
      chineseName: row.chineseName || undefined,
      englishName: row.englishName || undefined,
      country,
      province: row.province || undefined,
      city: row.city || undefined,
      addressRaw: row.addressRaw || undefined,
      addressNormalized: row.addressRaw || undefined,
      coordSystem: "UNKNOWN" as const,
      aliasesJson: toJson([row.chineseName, row.englishName].filter(Boolean)),
      sourceTagsJson: toJson(["csv_import"]),
      riskLevel: "UNKNOWN" as const,
      importReadinessScore: 0
    };

    const factory = existing
      ? await prisma.factory.update({ where: { id: existing.id }, data })
      : await prisma.factory.create({ data });

    if (row.productName) {
      await prisma.product.create({
        data: {
          factoryId: factory.id,
          productName: row.productName,
          category: row.productCategory || undefined,
          sourceCode: "csv_import",
          rawJson: toJson(row)
        }
      });
    }

    if (row.sourceUrl || row.website) {
      await prisma.evidence.create({
        data: {
          entityType: "FACTORY",
          entityId: factory.id,
          sourceCode: "csv_import",
          evidenceType: "USER_UPLOAD",
          title: row.canonicalName,
          url: row.sourceUrl || row.website,
          rawJson: toJson(row)
        }
      });
    }

    if (existing) updated += 1;
    else created += 1;
  }

  return { created, updated, totalRows: rows.length };
}
