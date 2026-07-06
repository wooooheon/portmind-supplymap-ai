import { PrismaClient } from "@prisma/client";
import { SUPPLYMAP_DATA_SOURCES } from "@/lib/supplymap/data-sources";
import { MOCK_COMPLEXES, MOCK_DOMESTIC_SUPPLIERS, mockEvidence, mockRiskSignals } from "@/lib/supplymap/mock-data";
import type { RiskSignalKind } from "@/lib/supplymap/types";

const prisma = new PrismaClient();

function sourceId(code: string): string {
  return "supply-source-" + code;
}

function prismaRiskKind(kind: RiskSignalKind) {
  if (kind === "COUNTRY" || kind === "PAYMENT") return "COUNTRY_RISK";
  if (kind === "NEWS") return "MARKET";
  if (kind === "STRATEGIC_GOODS") return "TRADE_SECURITY";
  return kind;
}

function sourceFor(providerName: string, datasetName: string) {
  return (
    SUPPLYMAP_DATA_SOURCES.find(
      (source) => source.providerName === providerName && source.datasetName === datasetName
    ) ?? SUPPLYMAP_DATA_SOURCES[0]
  );
}

async function seedSources() {
  for (const source of SUPPLYMAP_DATA_SOURCES) {
    await prisma.supplyDataSource.upsert({
      where: { code: source.code },
      update: {
        providerName: source.providerName,
        datasetName: source.datasetName,
        sourceType: source.sourceType,
        sourceUrl: source.sourceUrl,
        fetchedAt: new Date(source.fetchedAt),
        license: source.license,
        updateCycle: source.updateCycle,
        status: source.status,
        isMock: source.verification === "MOCK"
      },
      create: {
        id: sourceId(source.code),
        code: source.code,
        providerName: source.providerName,
        datasetName: source.datasetName,
        sourceType: source.sourceType,
        sourceUrl: source.sourceUrl,
        fetchedAt: new Date(source.fetchedAt),
        license: source.license,
        updateCycle: source.updateCycle,
        status: source.status,
        isMock: source.verification === "MOCK"
      }
    });
  }
}

async function seedComplexes() {
  const trendSource = SUPPLYMAP_DATA_SOURCES.find((source) => source.code === "kicox_industrial_trends")!;
  for (const complex of MOCK_COMPLEXES) {
    await prisma.industrialComplex.upsert({
      where: { id: complex.id },
      update: {
        name: complex.name,
        region: complex.region,
        city: complex.city,
        latitude: complex.latitude,
        longitude: complex.longitude,
        industryMixJson: JSON.stringify(complex.industries),
        tenantCount: complex.tenantCount,
        operatingCount: complex.operatingCount,
        operationRate: complex.operationRate,
        exportAmount: complex.exportAmount,
        employeeCount: complex.employeeCount,
        fetchedAt: new Date(complex.fetchedAt)
      },
      create: {
        id: complex.id,
        sourceId: sourceId(trendSource.code),
        code: complex.code,
        name: complex.name,
        region: complex.region,
        city: complex.city,
        latitude: complex.latitude,
        longitude: complex.longitude,
        industryMixJson: JSON.stringify(complex.industries),
        tenantCount: complex.tenantCount,
        operatingCount: complex.operatingCount,
        operationRate: complex.operationRate,
        exportAmount: complex.exportAmount,
        employeeCount: complex.employeeCount,
        providerName: complex.providerName,
        datasetName: complex.datasetName,
        sourceType: complex.sourceType,
        sourceUrl: complex.sourceUrl,
        fetchedAt: new Date(complex.fetchedAt),
        license: complex.license,
        verification: complex.verification
      }
    });
  }
}

async function seedSuppliers() {
  const factorySource = SUPPLYMAP_DATA_SOURCES.find((source) => source.code === "kicox_factory_registry")!;
  for (const supplier of MOCK_DOMESTIC_SUPPLIERS) {
    const complex = MOCK_COMPLEXES.find((item) => item.name === supplier.industrialComplex);
    await prisma.supplier.upsert({
      where: { id: supplier.id },
      update: {
        name: supplier.name,
        region: supplier.region,
        city: supplier.city,
        address: supplier.address,
        productsJson: JSON.stringify(supplier.products),
        hsCodesJson: JSON.stringify(supplier.hsCodes),
        description: supplier.description,
        fetchedAt: new Date(supplier.fetchedAt)
      },
      create: {
        id: supplier.id,
        sourceId: sourceId(factorySource.code),
        industrialComplexId: complex?.id,
        externalId: supplier.id,
        name: supplier.name,
        scope: supplier.scope,
        countryCode: supplier.countryCode,
        region: supplier.region,
        city: supplier.city,
        address: supplier.address,
        latitude: supplier.latitude,
        longitude: supplier.longitude,
        productsJson: JSON.stringify(supplier.products),
        hsCodesJson: JSON.stringify(supplier.hsCodes),
        description: supplier.description,
        providerName: supplier.providerName,
        datasetName: supplier.datasetName,
        sourceType: supplier.sourceType,
        sourceUrl: supplier.sourceUrl,
        fetchedAt: new Date(supplier.fetchedAt),
        license: supplier.license,
        verification: supplier.verification
      }
    });
  }
}

async function seedRiskAndEvidence() {
  for (const signal of mockRiskSignals("392330", "CN")) {
    const source = sourceFor(signal.providerName, signal.datasetName);
    await prisma.riskSignal.upsert({
      where: { id: signal.id },
      update: {
        title: signal.title,
        summary: signal.summary,
        status: signal.status,
        severity: signal.severity,
        scoreImpact: signal.scoreImpact,
        fetchedAt: new Date(signal.fetchedAt)
      },
      create: {
        id: signal.id,
        sourceId: sourceId(source.code),
        productQuery: "식품용 플라스틱 포장용기",
        hsCode: signal.hsCode,
        kind: prismaRiskKind(signal.kind),
        severity: signal.severity,
        status: signal.status,
        title: signal.title,
        summary: signal.summary,
        scoreImpact: signal.scoreImpact,
        providerName: signal.providerName,
        datasetName: signal.datasetName,
        sourceType: signal.sourceType,
        sourceUrl: signal.sourceUrl,
        fetchedAt: new Date(signal.fetchedAt),
        license: signal.license,
        verification: signal.verification
      }
    });
  }

  for (const evidence of mockEvidence()) {
    const source = sourceFor(evidence.providerName, evidence.datasetName);
    await prisma.chatEvidence.upsert({
      where: {
        sourceId_evidenceKey: {
          sourceId: sourceId(source.code),
          evidenceKey: evidence.id
        }
      },
      update: {
        title: evidence.title,
        snippet: evidence.snippet,
        claim: evidence.claim,
        fetchedAt: new Date(evidence.fetchedAt)
      },
      create: {
        id: "chat-" + evidence.id.toLowerCase(),
        sourceId: sourceId(source.code),
        evidenceKey: evidence.id,
        title: evidence.title,
        snippet: evidence.snippet,
        claim: evidence.claim,
        providerName: evidence.providerName,
        datasetName: evidence.datasetName,
        sourceType: evidence.sourceType,
        sourceUrl: evidence.sourceUrl,
        fetchedAt: new Date(evidence.fetchedAt),
        license: evidence.license,
        verification: evidence.verification
      }
    });
  }
}

async function main() {
  await seedSources();
  await seedComplexes();
  await seedSuppliers();
  await seedRiskAndEvidence();
  console.log(
    "SupplyMap demo seeded: " +
      MOCK_COMPLEXES.length +
      " complexes, " +
      MOCK_DOMESTIC_SUPPLIERS.length +
      " domestic suppliers."
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
