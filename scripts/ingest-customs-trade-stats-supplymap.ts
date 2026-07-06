import crypto from "node:crypto";
import fs from "node:fs";
import pLimit from "p-limit";
import { PrismaClient } from "@prisma/client";
import { SUPPLYMAP_DATA_SOURCES } from "@/lib/supplymap/data-sources";
import {
  customsTradeStatsToRiskSignal,
  defaultCustomsTradeStatsPeriod,
  fetchCustomsTradeStats,
  stableCustomsTradeStatsId,
  type CustomsTradeStatsSummary
} from "@/lib/supplymap/adapters/customs-trade-stats";

const prisma = new PrismaClient();
const SOURCE_CODE = "customs_trade_stats";
const DEFAULT_HS_CODES = [
  "1905310000",
  "1905900000",
  "3304990000",
  "3307903000",
  "3920100000",
  "3923300000",
  "3923500000",
  "3923900000",
  "8504400000",
  "8507600000",
  "8516100000",
  "8516290000",
  "8516800000",
  "8518210000",
  "8518220000",
  "8529900000",
  "8534000000",
  "8537100000",
  "8539500000",
  "8807900000",
  "9018900000",
  "9025190000",
  "9405420000",
  "9405490000"
];
const DEFAULT_COUNTRIES = ["CN", "VN", "US", "JP", "DE", "ID", "TH", "IN", "MX", "PL"];
const CONCURRENCY = Number(process.env.CUSTOMS_TRADE_STATS_INGEST_CONCURRENCY || 4);

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

function sourceDefinition() {
  const source = SUPPLYMAP_DATA_SOURCES.find((item) => item.code === SOURCE_CODE);
  if (!source) throw new Error(`Unknown source ${SOURCE_CODE}`);
  return source;
}

function parseList(envName: string, fallback: string[]): string[] {
  const raw = process.env[envName];
  const values = raw ? raw.split(",").map((item) => item.trim()) : fallback;
  return Array.from(new Set(values.map((value) => value.replace(/\s+/g, "")).filter(Boolean)));
}

function evidenceId(sourcePrimaryId: string, key: string): string {
  return "chat-" + crypto.createHash("sha1").update(`${sourcePrimaryId}:${key}`).digest("hex").slice(0, 24);
}

async function upsertSource() {
  const source = sourceDefinition();
  await prisma.supplyDataSource.upsert({
    where: { code: source.code },
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
      id: sourceId(source.code),
      code: source.code,
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

function evidenceKey(summary: CustomsTradeStatsSummary): string {
  return `CUSTOMS-TRADE-${stableCustomsTradeStatsId(summary).toUpperCase()}`;
}

function dollars(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

async function upsertRisk(summary: CustomsTradeStatsSummary) {
  const source = sourceDefinition();
  const dbSource = await prisma.supplyDataSource.findUniqueOrThrow({ where: { code: SOURCE_CODE } });
  const signal = customsTradeStatsToRiskSignal(summary);
  await prisma.riskSignal.upsert({
    where: { id: signal.id },
    update: {
      productQuery: summary.itemName,
      hsCode: signal.hsCode,
      severity: signal.severity,
      status: signal.status,
      title: signal.title,
      summary: signal.summary,
      scoreImpact: signal.scoreImpact,
      providerName: source.providerName,
      datasetName: source.datasetName,
      sourceType: source.sourceType,
      sourceUrl: source.sourceUrl,
      fetchedAt: new Date(),
      license: source.license,
      verification: "PARTIAL"
    },
    create: {
      id: signal.id,
      sourceId: dbSource.id,
      productQuery: summary.itemName,
      hsCode: signal.hsCode,
      kind: "MARKET",
      severity: signal.severity,
      status: signal.status,
      title: signal.title,
      summary: signal.summary,
      scoreImpact: signal.scoreImpact,
      providerName: source.providerName,
      datasetName: source.datasetName,
      sourceType: source.sourceType,
      sourceUrl: source.sourceUrl,
      fetchedAt: new Date(),
      license: source.license,
      verification: "PARTIAL"
    }
  });
}

async function upsertEvidence(summary: CustomsTradeStatsSummary) {
  const source = sourceDefinition();
  const dbSource = await prisma.supplyDataSource.findUniqueOrThrow({ where: { code: SOURCE_CODE } });
  const key = evidenceKey(summary);
  const period = `${summary.startYymm}~${summary.endYymm}`;
  await prisma.chatEvidence.upsert({
    where: {
      sourceId_evidenceKey: {
        sourceId: dbSource.id,
        evidenceKey: key
      }
    },
    update: {
      title: `HS ${summary.hsCode} ${summary.countryName} 수출입실적 ${period}`,
      snippet: `수입액 ${dollars(summary.total.importDollars)} · 수입중량 ${Math.round(summary.total.importWeightKg).toLocaleString("ko-KR")}kg · 무역수지 ${dollars(summary.total.tradeBalanceDollars)} · 품목 ${summary.itemName}`,
      claim: `${summary.countryName} · ${summary.itemName} · ${period}`,
      providerName: source.providerName,
      datasetName: source.datasetName,
      sourceType: source.sourceType,
      sourceUrl: source.sourceUrl,
      fetchedAt: new Date(),
      license: source.license,
      verification: "PARTIAL"
    },
    create: {
      id: evidenceId(dbSource.id, key),
      sourceId: dbSource.id,
      evidenceKey: key,
      title: `HS ${summary.hsCode} ${summary.countryName} 수출입실적 ${period}`,
      snippet: `수입액 ${dollars(summary.total.importDollars)} · 수입중량 ${Math.round(summary.total.importWeightKg).toLocaleString("ko-KR")}kg · 무역수지 ${dollars(summary.total.tradeBalanceDollars)} · 품목 ${summary.itemName}`,
      claim: `${summary.countryName} · ${summary.itemName} · ${period}`,
      providerName: source.providerName,
      datasetName: source.datasetName,
      sourceType: source.sourceType,
      sourceUrl: source.sourceUrl,
      fetchedAt: new Date(),
      license: source.license,
      verification: "PARTIAL"
    }
  });
}

async function main() {
  loadEnvFile();
  if (!process.env.CUSTOMS_TRADE_STATS_SERVICE_KEY && !process.env.CUSTOMS_API_KEY && !process.env.DATA_GO_KR_SERVICE_KEY) {
    throw new Error("CUSTOMS_TRADE_STATS_SERVICE_KEY 또는 DATA_GO_KR_SERVICE_KEY가 필요합니다.");
  }

  await upsertSource();
  const period = {
    ...defaultCustomsTradeStatsPeriod(),
    ...(process.env.CUSTOMS_TRADE_STATS_START_YYMM ? { startYymm: process.env.CUSTOMS_TRADE_STATS_START_YYMM } : {}),
    ...(process.env.CUSTOMS_TRADE_STATS_END_YYMM ? { endYymm: process.env.CUSTOMS_TRADE_STATS_END_YYMM } : {})
  };
  const hsCodes = parseList("CUSTOMS_TRADE_STATS_INGEST_HS_CODES", DEFAULT_HS_CODES);
  const countries = parseList("CUSTOMS_TRADE_STATS_INGEST_COUNTRIES", DEFAULT_COUNTRIES);
  const limit = pLimit(CONCURRENCY);
  let calls = 0;
  let failed = 0;
  let rawMonthlyRecords = 0;
  let riskSignalsUpserted = 0;
  let chatEvidenceUpserted = 0;
  let totalImportDollars = 0;

  const tasks = hsCodes.flatMap((hsCode) =>
    countries.map((countryCode) =>
      limit(async () => {
        calls += 1;
        try {
          const result = await fetchCustomsTradeStats({
            hsCode,
            countryCode,
            startYymm: period.startYymm,
            endYymm: period.endYymm,
            timeoutMs: 20000
          });
          const { summary } = result;
          rawMonthlyRecords += summary.monthlyRecords.length;
          if (summary.monthlyRecords.length === 0) return;
          totalImportDollars += summary.total.importDollars;
          await upsertRisk(summary);
          riskSignalsUpserted += 1;
          await upsertEvidence(summary);
          chatEvidenceUpserted += 1;
          console.log(
            `[CUSTOMS-TRADE] hs=${summary.hsCode} country=${summary.countryCode} months=${summary.monthlyRecords.length} import=${summary.total.importDollars}`
          );
        } catch (error) {
          failed += 1;
          console.warn(
            `[CUSTOMS-TRADE] skipped hs=${hsCode} country=${countryCode}: ${error instanceof Error ? error.message : "unknown"}`
          );
        }
      })
    )
  );

  await Promise.all(tasks);
  await prisma.supplyDataSource.update({
    where: { code: SOURCE_CODE },
    data: { status: "connected", isMock: false, fetchedAt: new Date() }
  });

  console.log(
    JSON.stringify(
      {
        source: SOURCE_CODE,
        period,
        calls,
        failedCalls: failed,
        hsCodesQueried: hsCodes.length,
        countriesQueried: countries.length,
        rawMonthlyRecords,
        riskSignalsUpserted,
        chatEvidenceUpserted,
        totalImportDollars
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
