import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { SUPPLYMAP_DATA_SOURCES } from "@/lib/supplymap/data-sources";
import {
  fetchKsureRiskIndex,
  ksureRiskIndexToRiskSignal,
  ksureSeverityForRiskIndex,
  stableKsureRiskIndexId,
  type KsureRiskIndexRecord
} from "@/lib/supplymap/adapters/ksure-country-risk";
import type { ProductIntent } from "@/lib/supplymap/types";

const prisma = new PrismaClient();
const SOURCE_CODE = "ksure_country_trade";
const ROWS_PER_PAGE = Number(process.env.KSURE_RISK_INDEX_INGEST_ROWS_PER_PAGE || 3000);
const MAX_PAGES = Number(process.env.KSURE_RISK_INDEX_INGEST_MAX_PAGES || 3);

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

function intentFor(record: KsureRiskIndexRecord): ProductIntent {
  return {
    query: record.biztypNm,
    category: record.biztypNm,
    keywords: [record.biztypNm],
    hsCodeCandidates: [],
    importCountry: record.ctryCd
  };
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

async function collectRecords() {
  const collected = new Map<string, KsureRiskIndexRecord>();
  let calls = 0;
  let failed = 0;
  let totalCount = 0;

  for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo += 1) {
    calls += 1;
    try {
      const result = await fetchKsureRiskIndex({
        pageNo,
        rowsPerPage: ROWS_PER_PAGE,
        timeoutMs: 20000
      });
      totalCount = Math.max(totalCount, result.totalCount);
      for (const record of result.records) collected.set(stableKsureRiskIndexId(record), record);
      console.log(`[K-SURE] page=${pageNo} records=${result.records.length} collected=${collected.size}`);
      if (result.records.length < ROWS_PER_PAGE || pageNo * ROWS_PER_PAGE >= result.totalCount) break;
    } catch (error) {
      failed += 1;
      console.warn(`[K-SURE] skipped page=${pageNo}: ${error instanceof Error ? error.message : "unknown"}`);
      break;
    }
  }

  return { records: Array.from(collected.values()), stats: { calls, failed, totalCount } };
}

function evidenceKey(record: KsureRiskIndexRecord): string {
  return `KSURE-RISK-${stableKsureRiskIndexId(record).toUpperCase()}`;
}

async function upsertRisk(record: KsureRiskIndexRecord) {
  const source = sourceDefinition();
  const dbSource = await prisma.supplyDataSource.findUniqueOrThrow({ where: { code: SOURCE_CODE } });
  const signal = ksureRiskIndexToRiskSignal(record, intentFor(record));
  await prisma.riskSignal.upsert({
    where: { id: signal.id },
    update: {
      productQuery: record.biztypNm,
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
      productQuery: record.biztypNm,
      kind: "COUNTRY_RISK",
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

async function upsertEvidence(record: KsureRiskIndexRecord) {
  const source = sourceDefinition();
  const dbSource = await prisma.supplyDataSource.findUniqueOrThrow({ where: { code: SOURCE_CODE } });
  const risk = ksureSeverityForRiskIndex(record.riskIdx);
  const key = evidenceKey(record);
  const title = `${record.ctryNm} ${record.biztypNm} K-SURE 위험지수 ${risk.label}`;
  const snippet = `국가코드 ${record.ctryCd}, 업종코드 ${record.biztypCd}, 위험지수 RI${record.riskIdx}. RI 수치가 높을수록 주의가 필요한 거래입니다.`;
  await prisma.chatEvidence.upsert({
    where: {
      sourceId_evidenceKey: {
        sourceId: dbSource.id,
        evidenceKey: key
      }
    },
    update: {
      title,
      snippet,
      claim: `${record.ctryNm} · ${record.biztypNm} · ${risk.label}`,
      providerName: source.providerName,
      datasetName: source.datasetName,
      sourceType: source.sourceType,
      sourceUrl: source.sourceUrl,
      fetchedAt: new Date(),
      license: source.license,
      verification: "PARTIAL"
    },
    create: {
      id: `chat-${key.toLowerCase()}`,
      sourceId: dbSource.id,
      evidenceKey: key,
      title,
      snippet,
      claim: `${record.ctryNm} · ${record.biztypNm} · ${risk.label}`,
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
  if (!process.env.DATA_GO_KR_SERVICE_KEY && !process.env.KSURE_API_KEY) {
    throw new Error("DATA_GO_KR_SERVICE_KEY 또는 KSURE_API_KEY가 필요합니다.");
  }

  await upsertSource();
  const { records, stats } = await collectRecords();
  let riskSignalsUpserted = 0;
  let chatEvidenceUpserted = 0;

  for (const record of records) {
    await upsertRisk(record);
    riskSignalsUpserted += 1;
    await upsertEvidence(record);
    chatEvidenceUpserted += 1;
  }

  await prisma.supplyDataSource.update({
    where: { code: SOURCE_CODE },
    data: { status: "connected", isMock: false, fetchedAt: new Date() }
  });

  console.log(
    JSON.stringify(
      {
        source: SOURCE_CODE,
        calls: stats.calls,
        failedCalls: stats.failed,
        totalAvailable: stats.totalCount,
        uniqueRiskIndexRecords: records.length,
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
