import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { SUPPLYMAP_DATA_SOURCES } from "@/lib/supplymap/data-sources";
import {
  customsRecordsToRiskSignal,
  fetchCustomsRequirements,
  stableCustomsRequirementId,
  type CustomsRequirementRecord
} from "@/lib/supplymap/adapters/customs-requirements";

const prisma = new PrismaClient();
const SOURCE_CODE = "customs_requirements";
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

function parseHsCodes(): string[] {
  const raw = process.env.CUSTOMS_REQUIREMENTS_INGEST_HS_CODES;
  const codes = raw ? raw.split(",").map((item) => item.trim()) : DEFAULT_HS_CODES;
  return Array.from(new Set(codes.map((code) => code.replace(/[^0-9]/g, "")).filter((code) => code.length >= 4)));
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

function uniqueJoin(values: Array<string | undefined>, separator = ", "): string {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])).join(separator);
}

function evidenceKey(hsCode: string, records: CustomsRequirementRecord[]): string {
  return `CUSTOMS-HS-${stableCustomsRequirementId(hsCode, records).toUpperCase()}`;
}

async function upsertRisk(hsCode: string, records: CustomsRequirementRecord[]) {
  const source = sourceDefinition();
  const dbSource = await prisma.supplyDataSource.findUniqueOrThrow({ where: { code: SOURCE_CODE } });
  const signal = customsRecordsToRiskSignal(hsCode, records);
  await prisma.riskSignal.upsert({
    where: { id: signal.id },
    update: {
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
      productQuery: uniqueJoin(records.map((record) => record.dcerCfrmLworNm)) || "세관장확인대상",
      hsCode: signal.hsCode,
      kind: "CUSTOMS",
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

async function upsertEvidence(hsCode: string, records: CustomsRequirementRecord[]) {
  const source = sourceDefinition();
  const dbSource = await prisma.supplyDataSource.findUniqueOrThrow({ where: { code: SOURCE_CODE } });
  const key = evidenceKey(hsCode, records);
  const laws = uniqueJoin(records.map((record) => record.dcerCfrmLworNm));
  const agencies = uniqueJoin(records.map((record) => record.reqApreIttNm));
  const documents = uniqueJoin(records.map((record) => record.reqCfrmIstmNm));
  await prisma.chatEvidence.upsert({
    where: {
      sourceId_evidenceKey: {
        sourceId: dbSource.id,
        evidenceKey: key
      }
    },
    update: {
      title: `HS ${hsCode} 세관장확인대상 수입요건`,
      snippet: `확인법령: ${laws || "확인 필요"} · 요건승인기관: ${agencies || "확인 필요"} · 확인서류: ${documents || "확인 필요"}`,
      claim: `${records.length}개 세관장확인 요건 확인`,
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
      title: `HS ${hsCode} 세관장확인대상 수입요건`,
      snippet: `확인법령: ${laws || "확인 필요"} · 요건승인기관: ${agencies || "확인 필요"} · 확인서류: ${documents || "확인 필요"}`,
      claim: `${records.length}개 세관장확인 요건 확인`,
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
  if (
    !process.env.CUSTOMS_CONFIRMATION_ITEMS_SERVICE_KEY &&
    !process.env.CUSTOMS_API_KEY &&
    !process.env.DATA_GO_KR_SERVICE_KEY
  ) {
    throw new Error("CUSTOMS_CONFIRMATION_ITEMS_SERVICE_KEY 또는 DATA_GO_KR_SERVICE_KEY가 필요합니다.");
  }

  await upsertSource();
  const hsCodes = parseHsCodes();
  let calls = 0;
  let failed = 0;
  let totalRecords = 0;
  let riskSignalsUpserted = 0;
  let chatEvidenceUpserted = 0;

  for (const hsCode of hsCodes) {
    calls += 1;
    try {
      const result = await fetchCustomsRequirements({ hsCode, importExportType: "2", timeoutMs: 20000 });
      totalRecords += result.records.length;
      console.log(`[CUSTOMS] hs=${result.hsCode} records=${result.records.length}`);
      if (result.records.length === 0) continue;
      await upsertRisk(result.hsCode, result.records);
      riskSignalsUpserted += 1;
      await upsertEvidence(result.hsCode, result.records);
      chatEvidenceUpserted += 1;
    } catch (error) {
      failed += 1;
      console.warn(`[CUSTOMS] skipped hs=${hsCode}: ${error instanceof Error ? error.message : "unknown"}`);
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
        calls,
        failedCalls: failed,
        hsCodesQueried: hsCodes.length,
        rawRequirementRecords: totalRecords,
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
