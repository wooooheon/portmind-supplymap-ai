import crypto from "node:crypto";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { SUPPLYMAP_DATA_SOURCES } from "@/lib/supplymap/data-sources";
import {
  fetchKotraMarketNews,
  kotraMarketNewsSeverity,
  kotraNewsToRiskSignal,
  stableKotraNewsId,
  type KotraMarketNewsRecord
} from "@/lib/supplymap/adapters/kotra-news";
import type { ProductIntent } from "@/lib/supplymap/types";

const prisma = new PrismaClient();
const SOURCE_CODE = "kotra_market_news";
const ROWS_PER_PAGE = Number(process.env.KOTRA_NEWS_INGEST_ROWS_PER_PAGE || 50);
const MAX_PAGES = Number(process.env.KOTRA_NEWS_INGEST_MAX_PAGES || 2);
const MAX_RECORDS = Number(process.env.KOTRA_NEWS_INGEST_MAX_RECORDS || 800);
const START_DATE = process.env.KOTRA_NEWS_INGEST_START_DATE || "20240101";
const END_DATE = process.env.KOTRA_NEWS_INGEST_END_DATE || new Date().toISOString().slice(0, 10).replaceAll("-", "");

const DEFAULT_COUNTRIES = ["중국", "베트남", "미국", "일본", "독일", "인도", "인도네시아", "멕시코", "폴란드", "태국"];
const DEFAULT_TERMS = [
  "화장품",
  "포장",
  "용기",
  "LED",
  "조명",
  "드론",
  "배터리",
  "의료기기",
  "식품",
  "전기히터",
  "통관",
  "인증",
  "관세",
  "규제",
  "공급망",
  "물류"
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

function hash(value: string): string {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 24);
}

function parseList(envName: string, fallback: string[]): string[] {
  const raw = process.env[envName];
  if (!raw) return fallback;
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function clean(value?: string): string {
  return (value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value?: string, limit = 420): string {
  const text = clean(value);
  if (!text) return "원문 확인 필요";
  return text.length > limit ? text.slice(0, limit - 1) + "…" : text;
}

function sourceDefinition() {
  const source = SUPPLYMAP_DATA_SOURCES.find((item) => item.code === SOURCE_CODE);
  if (!source) throw new Error(`Unknown source ${SOURCE_CODE}`);
  return source;
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

function toIntent(country: string, term: string): ProductIntent {
  return {
    query: term,
    keywords: [term],
    category: term,
    hsCodeCandidates: [],
    importCountry: country
  };
}

function evidenceKey(record: KotraMarketNewsRecord): string {
  return `KOTRA-NEWS-${stableKotraNewsId(record)}`;
}

function evidenceId(sourcePrimaryId: string, key: string): string {
  return "chat-" + hash(`${sourcePrimaryId}:${key}`);
}

function riskId(record: KotraMarketNewsRecord): string {
  return `risk-kotra-news-${stableKotraNewsId(record)}`;
}

async function upsertEvidence(record: KotraMarketNewsRecord) {
  const source = sourceDefinition();
  const dbSource = await prisma.supplyDataSource.findUniqueOrThrow({ where: { code: SOURCE_CODE } });
  const key = evidenceKey(record);
  const articleUrl = record.kotraNewsUrl || source.sourceUrl;
  await prisma.chatEvidence.upsert({
    where: {
      sourceId_evidenceKey: {
        sourceId: dbSource.id,
        evidenceKey: key
      }
    },
    update: {
      title: clean(record.newsTitl) || "KOTRA 해외시장뉴스",
      snippet: compact(record.cntntSumar || record.newsBdt || record.kwrd),
      claim: [record.natn, record.infoCl, record.indstCl, record.cmdltNmKorn || record.hsCdNm]
        .filter(Boolean)
        .join(" · "),
      providerName: source.providerName,
      datasetName: source.datasetName,
      sourceType: source.sourceType,
      sourceUrl: articleUrl,
      fetchedAt: new Date(),
      license: source.license,
      verification: "PARTIAL"
    },
    create: {
      id: evidenceId(dbSource.id, key),
      sourceId: dbSource.id,
      evidenceKey: key,
      title: clean(record.newsTitl) || "KOTRA 해외시장뉴스",
      snippet: compact(record.cntntSumar || record.newsBdt || record.kwrd),
      claim: [record.natn, record.infoCl, record.indstCl, record.cmdltNmKorn || record.hsCdNm]
        .filter(Boolean)
        .join(" · "),
      providerName: source.providerName,
      datasetName: source.datasetName,
      sourceType: source.sourceType,
      sourceUrl: articleUrl,
      fetchedAt: new Date(),
      license: source.license,
      verification: "PARTIAL"
    }
  });
}

async function upsertRisk(record: KotraMarketNewsRecord, country: string, term: string) {
  const source = sourceDefinition();
  const dbSource = await prisma.supplyDataSource.findUniqueOrThrow({ where: { code: SOURCE_CODE } });
  const signal = kotraNewsToRiskSignal(record, toIntent(country, term));
  const severity = kotraMarketNewsSeverity(record);
  await prisma.riskSignal.upsert({
    where: { id: riskId(record) },
    update: {
      productQuery: record.cmdltNmKorn || term,
      hsCode: signal.hsCode,
      severity: signal.severity,
      status: signal.status,
      title: signal.title,
      summary: signal.summary,
      scoreImpact: signal.scoreImpact,
      providerName: source.providerName,
      datasetName: source.datasetName,
      sourceType: source.sourceType,
      sourceUrl: record.kotraNewsUrl || source.sourceUrl,
      fetchedAt: new Date(),
      license: source.license,
      verification: "PARTIAL"
    },
    create: {
      id: riskId(record),
      sourceId: dbSource.id,
      productQuery: record.cmdltNmKorn || term,
      hsCode: signal.hsCode,
      kind: "MARKET",
      severity: signal.severity,
      status: signal.status,
      title: signal.title,
      summary: signal.summary,
      scoreImpact: severity.scoreImpact,
      providerName: source.providerName,
      datasetName: source.datasetName,
      sourceType: source.sourceType,
      sourceUrl: record.kotraNewsUrl || source.sourceUrl,
      fetchedAt: new Date(),
      license: source.license,
      verification: "PARTIAL"
    }
  });
}

async function collectRecords() {
  const countries = parseList("KOTRA_NEWS_INGEST_COUNTRIES", DEFAULT_COUNTRIES);
  const terms = parseList("KOTRA_NEWS_INGEST_TERMS", DEFAULT_TERMS);
  const collected = new Map<string, { record: KotraMarketNewsRecord; country: string; term: string }>();
  const stats = { calls: 0, failed: 0, totalAvailable: 0 };

  for (const country of countries) {
    for (const term of terms) {
      for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo += 1) {
        stats.calls += 1;
        try {
          const result = await fetchKotraMarketNews({
            country,
            title: term,
            startDate: START_DATE,
            endDate: END_DATE,
            rowsPerPage: ROWS_PER_PAGE,
            pageNo,
            timeoutMs: 20000
          });
          stats.totalAvailable += result.totalCount;
          for (const record of result.records) {
            const id = stableKotraNewsId(record);
            if (!record.newsTitl || collected.has(id)) continue;
            collected.set(id, { record, country, term });
            if (collected.size >= MAX_RECORDS) break;
          }
          if (result.records.length < ROWS_PER_PAGE || pageNo * ROWS_PER_PAGE >= result.totalCount) break;
          if (collected.size >= MAX_RECORDS) break;
        } catch (error) {
          stats.failed += 1;
          console.warn(
            `[KOTRA] skipped ${country}/${term}/page=${pageNo}: ${error instanceof Error ? error.message : "unknown"}`
          );
          break;
        }
      }
      console.log(`[KOTRA] country=${country} term=${term} collected=${collected.size}`);
      if (collected.size >= MAX_RECORDS) break;
    }
    if (collected.size >= MAX_RECORDS) break;
  }

  return { records: Array.from(collected.values()), stats };
}

async function main() {
  loadEnvFile();
  if (!process.env.DATA_GO_KR_SERVICE_KEY && !process.env.KOTRA_API_KEY) {
    throw new Error("DATA_GO_KR_SERVICE_KEY 또는 KOTRA_API_KEY가 필요합니다.");
  }

  await upsertSource();
  const { records, stats } = await collectRecords();
  let evidenceUpserted = 0;
  let riskUpserted = 0;

  for (const item of records) {
    await upsertEvidence(item.record);
    evidenceUpserted += 1;
    await upsertRisk(item.record, item.country, item.term);
    riskUpserted += 1;
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
        totalAvailableAcrossSearches: stats.totalAvailable,
        uniqueNewsRecords: records.length,
        chatEvidenceUpserted: evidenceUpserted,
        riskSignalsUpserted: riskUpserted,
        dateRange: { start: START_DATE, end: END_DATE }
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
