import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { SUPPLYMAP_DATA_SOURCES } from "@/lib/supplymap/data-sources";
import {
  fetchSafetyKoreaBundle,
  safetyKoreaBundleToRiskSignals,
  type SafetyKoreaBundle
} from "@/lib/supplymap/adapters/safety-korea";
import type { RiskSignalRecord } from "@/lib/supplymap/types";

const prisma = new PrismaClient();
const SOURCE_CODE = "safety_korea";
const DEFAULT_TERMS = [
  "식품 포장용기",
  "전기히터",
  "LED 조명",
  "화장품 용기",
  "드론",
  "배터리",
  "완구",
  "전기매트",
  "유모차",
  "마스크",
  "멀티탭",
  "전기충전기"
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

function sourceDefinition() {
  const source = SUPPLYMAP_DATA_SOURCES.find((item) => item.code === SOURCE_CODE);
  if (!source) throw new Error(`Unknown source ${SOURCE_CODE}`);
  return source;
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function parseTerms(): string[] {
  const raw = process.env.SAFETY_KOREA_INGEST_TERMS;
  const terms = raw ? raw.split(",").map((item) => item.trim()) : DEFAULT_TERMS;
  return Array.from(new Set(terms.filter(Boolean))).slice(0, 50);
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

async function upsertRisk(term: string, signal: RiskSignalRecord) {
  const dbSource = await prisma.supplyDataSource.findUniqueOrThrow({ where: { code: SOURCE_CODE } });
  await prisma.riskSignal.upsert({
    where: { id: signal.id },
    update: {
      productQuery: term,
      hsCode: signal.hsCode,
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
      productQuery: term,
      hsCode: signal.hsCode,
      kind: signal.kind === "RECALL" ? "RECALL" : "CERTIFICATION",
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

async function upsertEvidence(term: string, signal: RiskSignalRecord) {
  const dbSource = await prisma.supplyDataSource.findUniqueOrThrow({ where: { code: SOURCE_CODE } });
  const evidenceKey = `SAFETY-${stableHash(signal.id).toUpperCase()}`;
  await prisma.chatEvidence.upsert({
    where: {
      sourceId_evidenceKey: {
        sourceId: dbSource.id,
        evidenceKey
      }
    },
    update: {
      title: signal.title,
      snippet: signal.summary,
      claim: `${term} · ${signal.status}`,
      providerName: signal.providerName,
      datasetName: signal.datasetName,
      sourceType: signal.sourceType,
      sourceUrl: signal.sourceUrl,
      fetchedAt: new Date(),
      license: signal.license,
      verification: "PARTIAL"
    },
    create: {
      id: `chat-${evidenceKey.toLowerCase()}`,
      sourceId: dbSource.id,
      evidenceKey,
      title: signal.title,
      snippet: signal.summary,
      claim: `${term} · ${signal.status}`,
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

function bundleRecordCount(bundle: SafetyKoreaBundle) {
  return bundle.certificationRecords.length + bundle.domesticRecallRecords.length + bundle.foreignRecallRecords.length;
}

async function main() {
  loadEnvFile();
  if (!process.env.SAFETY_KOREA_API_KEY) throw new Error("SAFETY_KOREA_API_KEY가 필요합니다.");

  await upsertSource();
  const terms = parseTerms();
  let calls = 0;
  let failed = 0;
  let rawCertificationRecords = 0;
  let rawDomesticRecallRecords = 0;
  let rawForeignRecallRecords = 0;
  let riskSignalsUpserted = 0;
  let chatEvidenceUpserted = 0;

  for (const term of terms) {
    calls += 3;
    try {
      const bundle = await fetchSafetyKoreaBundle({ term, timeoutMs: 22000 });
      rawCertificationRecords += bundle.certificationRecords.length;
      rawDomesticRecallRecords += bundle.domesticRecallRecords.length;
      rawForeignRecallRecords += bundle.foreignRecallRecords.length;
      const signals = safetyKoreaBundleToRiskSignals(bundle);
      for (const signal of signals) {
        await upsertRisk(term, signal);
        riskSignalsUpserted += 1;
        await upsertEvidence(term, signal);
        chatEvidenceUpserted += 1;
      }
      console.log(
        `[SAFETY-KOREA] term=${term} raw=${bundleRecordCount(bundle)} cert=${bundle.certificationRecords.length} domesticRecall=${bundle.domesticRecallRecords.length} foreignRecall=${bundle.foreignRecallRecords.length}`
      );
    } catch (error) {
      failed += 1;
      console.warn(`[SAFETY-KOREA] skipped term=${term}: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }

  await prisma.supplyDataSource.update({
    where: { code: SOURCE_CODE },
    data: { status: "connected", isMock: false, fetchedAt: new Date() }
  });

  console.log(
    JSON.stringify(
      {
        source: SOURCE_CODE,
        termsQueried: terms.length,
        calls,
        failedTerms: failed,
        rawCertificationRecords,
        rawDomesticRecallRecords,
        rawForeignRecallRecords,
        rawRecords: rawCertificationRecords + rawDomesticRecallRecords + rawForeignRecallRecords,
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
