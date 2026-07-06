import { CertType, EntityType, EvidenceType, RiskEventType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { NormalizedRecord } from "@/lib/connectors/types";
import { calculateImportReadinessScore, calculateRiskLevel } from "@/lib/scoring/import-readiness";
import { toJson } from "@/lib/utils/json";

function validCertType(value: unknown): CertType {
  const candidate = String(value ?? "OTHER").toUpperCase();
  return Object.values(CertType).includes(candidate as CertType) ? (candidate as CertType) : "OTHER";
}

function validRiskEventType(value: unknown): RiskEventType {
  const candidate = String(value ?? "UNKNOWN").toUpperCase();
  return Object.values(RiskEventType).includes(candidate as RiskEventType) ? (candidate as RiskEventType) : "UNKNOWN";
}

function parseDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  const date = new Date(String(value).replaceAll(".", "-").replaceAll("/", "-"));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function productCategoryForFactoryRecord(record: NormalizedRecord): string | undefined {
  if (record.sourceCode === "mfds_import_food_foreign_manufacturers") return "식품";
  if (record.sourceCode === "mfds_medical_device_items") return "의료기기";
  return record.extra?.category?.toString() || undefined;
}

async function attachEvidence(args: {
  entityType: EntityType;
  entityId: string;
  record: NormalizedRecord;
  title?: string | null;
  evidenceType?: EvidenceType;
}) {
  await prisma.evidence.create({
    data: {
      entityType: args.entityType,
      entityId: args.entityId,
      sourceCode: args.record.sourceCode,
      evidenceType: args.evidenceType ?? "OFFICIAL_API",
      title: args.title ?? args.record.sourceRecordId ?? args.record.sourceCode,
      url: args.record.evidenceUrl ?? undefined,
      retrievedAt: new Date(args.record.retrievedAt),
      rawSnippet: args.record.productName ?? args.record.canonicalName ?? args.record.hsCode ?? undefined,
      rawJson: toJson(args.record.rawJson)
    }
  });
}

async function findOrCreateFactory(record: NormalizedRecord) {
  const canonicalName = record.canonicalName ?? record.extra?.manufacturerName?.toString() ?? "Unknown factory";
  const country = record.country ?? "UNKNOWN";
  const city = record.extra?.city?.toString() || undefined;
  const addressRaw = record.address ?? undefined;

  const existing = await prisma.factory.findFirst({
    where: {
      canonicalName,
      country,
      city,
      addressRaw
    }
  });
  if (existing) return existing;

  return prisma.factory.create({
    data: {
      canonicalName,
      country,
      province: record.extra?.province?.toString() || undefined,
      city,
      addressRaw,
      addressNormalized: addressRaw,
      coordSystem: "UNKNOWN",
      sourceTagsJson: toJson([record.sourceCode]),
      riskLevel: "LOW",
      importReadinessScore: calculateImportReadinessScore({
        officialMatches: 1,
        hasHighConfidenceGeocode: false
      })
    }
  });
}

async function refreshFactoryScore(factoryId: string) {
  const [factory, certificates, riskEvents] = await Promise.all([
    prisma.factory.findUnique({ where: { id: factoryId } }),
    prisma.certificate.count({ where: { factoryId } }),
    prisma.riskEvent.findMany({ where: { factoryId }, select: { eventType: true, severity: true } })
  ]);
  if (!factory) return;

  await prisma.factory.update({
    where: { id: factoryId },
    data: {
      riskLevel: calculateRiskLevel(riskEvents),
      importReadinessScore: calculateImportReadinessScore({
        officialMatches: 1,
        certificates,
        tradeRequirements: 0,
        riskEvents,
        hasHighConfidenceGeocode: (factory.geocodeConfidence ?? 0) >= 0.8,
        negativeSearchSignals: 0
      })
    }
  });
}

export async function persistNormalizedRecords(records: NormalizedRecord[]): Promise<number> {
  let count = 0;

  for (const record of records) {
    if (record.type === "FACTORY") {
      const factory = await findOrCreateFactory(record);
      const productName = record.extra?.productName?.toString();
      if (productName) {
        await prisma.product.create({
          data: {
            factoryId: factory.id,
            productName,
            category: productCategoryForFactoryRecord(record),
            sourceCode: record.sourceCode,
            rawJson: toJson(record.rawJson)
          }
        });
      }
      await attachEvidence({ entityType: "FACTORY", entityId: factory.id, record, title: record.canonicalName });
      await refreshFactoryScore(factory.id);
      count += 1;
      continue;
    }

    if (record.type === "PRODUCT" || record.type === "TRADE_STAT") {
      const product = await prisma.product.create({
        data: {
          productName: record.productName ?? record.hsCode ?? "Unknown product",
          category: record.extra?.category?.toString() ?? (record.type === "TRADE_STAT" ? "Trade Stat" : undefined),
          hsCodeCandidate: record.hsCode ?? undefined,
          sourceCode: record.sourceCode,
          rawJson: toJson(record.rawJson)
        }
      });
      await attachEvidence({ entityType: "PRODUCT", entityId: product.id, record, title: product.productName });
      count += 1;
      continue;
    }

    if (record.type === "CERTIFICATE") {
      const factory = record.canonicalName ? await findOrCreateFactory(record) : null;
      const certificate = await prisma.certificate.create({
        data: {
          factoryId: factory?.id,
          certType: validCertType(record.extra?.certType),
          certNumber: record.certNumber ?? undefined,
          modelName: record.extra?.modelName?.toString() || undefined,
          productName: record.productName ?? undefined,
          manufacturerName: record.canonicalName ?? undefined,
          importerName: record.extra?.importerName?.toString() || undefined,
          country: record.country ?? undefined,
          status: record.extra?.status?.toString() || undefined,
          issueDate: parseDate(record.extra?.issueDate),
          expiryDate: parseDate(record.extra?.expiryDate),
          sourceCode: record.sourceCode,
          evidenceUrl: record.evidenceUrl ?? undefined,
          rawJson: toJson(record.rawJson)
        }
      });
      await attachEvidence({ entityType: "CERTIFICATE", entityId: certificate.id, record, title: record.certNumber });
      if (factory) await refreshFactoryScore(factory.id);
      count += 1;
      continue;
    }

    if (record.type === "TRADE_REQUIREMENT") {
      const requirement = await prisma.tradeRequirement.create({
        data: {
          hsCode: record.hsCode ?? "UNKNOWN",
          importExportType: record.extra?.importExportType?.toString() || undefined,
          lawName: record.extra?.lawName?.toString() || undefined,
          agencyName: record.extra?.agencyName?.toString() || undefined,
          requirementName: record.extra?.requirementName?.toString() || undefined,
          sourceCode: record.sourceCode,
          rawJson: toJson(record.rawJson)
        }
      });
      await attachEvidence({
        entityType: "TRADE_REQUIREMENT",
        entityId: requirement.id,
        record,
        title: requirement.requirementName ?? requirement.lawName
      });
      count += 1;
      continue;
    }

    if (record.type === "RISK_EVENT") {
      const factory = record.canonicalName ? await findOrCreateFactory(record) : null;
      const event = await prisma.riskEvent.create({
        data: {
          factoryId: factory?.id,
          eventType: validRiskEventType(record.eventType),
          title: record.extra?.title?.toString() ?? record.productName ?? "Risk event",
          description: record.extra?.description?.toString() || undefined,
          eventDate: parseDate(record.extra?.eventDate),
          severity: record.extra?.severity?.toString() || undefined,
          sourceCode: record.sourceCode,
          evidenceUrl: record.evidenceUrl ?? undefined,
          rawJson: toJson(record.rawJson)
        }
      });
      await attachEvidence({ entityType: "RISK_EVENT", entityId: event.id, record, title: event.title });
      if (factory) await refreshFactoryScore(factory.id);
      count += 1;
      continue;
    }

    await prisma.evidence.create({
      data: {
        entityType: "FACTORY",
        entityId: record.sourceRecordId ?? record.sourceCode,
        sourceCode: record.sourceCode,
        evidenceType: record.type === "SEARCH_RESULT" ? "SEARCH_RESULT" : "AI_INFERENCE",
        title: record.sourceRecordId ?? record.sourceCode,
        url: record.evidenceUrl ?? undefined,
        retrievedAt: new Date(record.retrievedAt),
        rawJson: toJson(record.rawJson)
      }
    });
    count += 1;
  }

  return count;
}
