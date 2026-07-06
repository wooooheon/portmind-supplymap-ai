import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { SUPPLYMAP_DATA_SOURCES } from "@/lib/supplymap/data-sources";
import { getUnipassCustomsRiskSignals } from "@/lib/supplymap/adapters/unipass-customs";
import { extractProductIntent } from "@/lib/supplymap/intent";
import type { RiskSignalKind, RiskSignalRecord, SupplyMapAnalysisRequest } from "@/lib/supplymap/types";

const prisma = new PrismaClient();
const SOURCE_CODES = [
  "unipass_hs_code",
  "unipass_customs_requirements",
  "unipass_tariff_rate",
  "unipass_fx_rate",
  "unipass_hs_navigation"
];
const DEFAULT_SCENARIOS: SupplyMapAnalysisRequest[] = [
  { productName: "식품 포장용기", hsCode: "392330", importCountry: "중국" },
  { productName: "전기히터", hsCode: "851629", importCountry: "중국" },
  { productName: "LED 조명", hsCode: "940542", importCountry: "중국" },
  { productName: "화장품 용기", hsCode: "392330", importCountry: "중국" },
  { productName: "드론 부품", hsCode: "880790", importCountry: "중국" },
  { productName: "배터리 충전기", hsCode: "850440", importCountry: "중국" }
];

function loadEnvFile() {
  if (!fs.existsSync(".env")) return;
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

function sourceId(code: string): string {
  return "supply-source-" + code;
}

function sourceDefinition(code: string) {
  const source = SUPPLYMAP_DATA_SOURCES.find((item) => item.code === code);
  if (!source) throw new Error(`Unknown source ${code}`);
  return source;
}

function sourceFor(signal: RiskSignalRecord) {
  return (
    SUPPLYMAP_DATA_SOURCES.find(
      (source) => source.providerName === signal.providerName && source.datasetName === signal.datasetName
    ) ?? sourceDefinition("unipass_hs_code")
  );
}

function prismaRiskKind(kind: RiskSignalKind) {
  if (kind === "PAYMENT" || kind === "COUNTRY") return "COUNTRY_RISK";
  if (kind === "NEWS") return "MARKET";
  if (kind === "STRATEGIC_GOODS") return "TRADE_SECURITY";
  return kind === "MARKET" ? "MARKET" : kind;
}

function evidenceKey(signal: RiskSignalRecord) {
  return `UNIPASS-${signal.id.replace(/^risk-unipass-/, "").toUpperCase().replace(/[^A-Z0-9-]/g, "-")}`;
}

async function upsertSources() {
  for (const code of SOURCE_CODES) {
    const source = sourceDefinition(code);
    await prisma.supplyDataSource.upsert({
      where: { code },
      update: {
        providerName: source.providerName,
        datasetName: source.datasetName,
        sourceType: source.sourceType,
        sourceUrl: source.sourceUrl,
        fetchedAt: new Date(),
        license: source.license,
        updateCycle: source.updateCycle,
        status: "connected",
        isMock: false
      },
      create: {
        id: sourceId(code),
        code,
        providerName: source.providerName,
        datasetName: source.datasetName,
        sourceType: source.sourceType,
        sourceUrl: source.sourceUrl,
        fetchedAt: new Date(),
        license: source.license,
        updateCycle: source.updateCycle,
        status: "connected",
        isMock: false
      }
    });
  }
}

async function upsertRisk(productQuery: string, signal: RiskSignalRecord) {
  const source = sourceFor(signal);
  const dbSource = await prisma.supplyDataSource.findUniqueOrThrow({ where: { code: source.code } });
  await prisma.riskSignal.upsert({
    where: { id: signal.id },
    update: {
      productQuery,
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
      fetchedAt: new Date(),
      license: signal.license,
      verification: "PARTIAL"
    },
    create: {
      id: signal.id,
      sourceId: dbSource.id,
      productQuery,
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
      fetchedAt: new Date(),
      license: signal.license,
      verification: "PARTIAL"
    }
  });
}

async function upsertEvidence(productQuery: string, signal: RiskSignalRecord) {
  const source = sourceFor(signal);
  const dbSource = await prisma.supplyDataSource.findUniqueOrThrow({ where: { code: source.code } });
  const key = evidenceKey(signal);
  await prisma.chatEvidence.upsert({
    where: {
      sourceId_evidenceKey: {
        sourceId: dbSource.id,
        evidenceKey: key
      }
    },
    update: {
      title: signal.title,
      snippet: signal.summary,
      claim: `${productQuery} · ${signal.status}`,
      providerName: signal.providerName,
      datasetName: signal.datasetName,
      sourceType: signal.sourceType,
      sourceUrl: signal.sourceUrl,
      fetchedAt: new Date(),
      license: signal.license,
      verification: "PARTIAL"
    },
    create: {
      id: `chat-${key.toLowerCase()}`,
      sourceId: dbSource.id,
      evidenceKey: key,
      title: signal.title,
      snippet: signal.summary,
      claim: `${productQuery} · ${signal.status}`,
      providerName: signal.providerName,
      datasetName: signal.datasetName,
      sourceType: signal.sourceType,
      sourceUrl: signal.sourceUrl,
      fetchedAt: new Date(),
      license: signal.license,
      verification: "PARTIAL"
    }
  });
}

function parseScenarios(): SupplyMapAnalysisRequest[] {
  const raw = process.env.UNIPASS_INGEST_SCENARIOS;
  if (!raw) return DEFAULT_SCENARIOS;
  return raw
    .split(";")
    .map((item) => {
      const [productName, hsCode, importCountry] = item.split("|").map((part) => part.trim());
      return { productName, hsCode, importCountry };
    })
    .filter((item) => item.productName);
}

async function main() {
  loadEnvFile();
  if (!process.env.UNIPASS_API_KEY && !process.env.UNIPASS_HS_CODE_SEARCH_KEY) {
    throw new Error("UNIPASS_API_KEY 또는 서비스별 UNIPASS 키가 필요합니다.");
  }

  await upsertSources();
  const scenarios = parseScenarios();
  let riskSignalsUpserted = 0;
  let chatEvidenceUpserted = 0;
  let failed = 0;

  for (const scenario of scenarios) {
    try {
      const intent = extractProductIntent(scenario);
      const result = await getUnipassCustomsRiskSignals(intent, { limit: 12 });
      for (const signal of result.signals) {
        await upsertRisk(intent.query, signal);
        riskSignalsUpserted += 1;
        await upsertEvidence(intent.query, signal);
        chatEvidenceUpserted += 1;
      }
      console.log(`[UNIPASS] product=${intent.query} signals=${result.signals.length} mock=${result.usedMock}`);
    } catch (error) {
      failed += 1;
      console.warn(`[UNIPASS] skipped product=${scenario.productName}: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }

  console.log(
    JSON.stringify(
      {
        source: "unipass",
        scenarios: scenarios.length,
        failedScenarios: failed,
        riskSignalsUpserted,
        chatEvidenceUpserted
      },
      null,
      2
    )
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
