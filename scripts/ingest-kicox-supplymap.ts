import crypto from "node:crypto";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { XMLParser } from "fast-xml-parser";
import { SUPPLYMAP_DATA_SOURCES } from "@/lib/supplymap/data-sources";

type RawRecord = Record<string, unknown>;

const FACTORY_BASE_URL = "https://apis.data.go.kr/B550624/fctryRegistInfo";
const FACTORY_BY_KEYWORD_ENDPOINT = `${FACTORY_BASE_URL}/getFctryPrdctnService_v2`;
const FACTORY_BY_COMPLEX_ENDPOINT = `${FACTORY_BASE_URL}/getFctryListInIrsttService_v2`;
const TRENDS_BASE_URL = "https://apis.data.go.kr/B550624/indparkstats";
const DEFAULT_PERIOD = process.env.KICOX_TRENDS_PERIOD || "202312";
const ROWS_PER_PAGE = Number(process.env.KICOX_INGEST_ROWS_PER_PAGE || 100);
const KEYWORD_MAX_PAGES = Number(process.env.KICOX_INGEST_KEYWORD_MAX_PAGES || 3);
const COMPLEX_MAX_PAGES = Number(process.env.KICOX_INGEST_COMPLEX_MAX_PAGES || 2);

const PRODUCT_TERMS = [
  "화장품",
  "포장",
  "용기",
  "LED",
  "조명",
  "히터",
  "전기히터",
  "드론",
  "식품",
  "과자",
  "의료기기",
  "체온계",
  "배터리",
  "센서",
  "전자부품",
  "플라스틱",
  "기계",
  "케이블",
  "PCB",
  "모터"
];

const COMPLEX_NAMES = [
  "반월국가산업단지",
  "시화국가산업단지",
  "서울디지털국가산업단지",
  "남동국가산업단지",
  "구미국가산업단지",
  "창원국가산업단지",
  "명지녹산국가산업단지",
  "울산미포국가산업단지",
  "광주첨단과학국가산업단지",
  "오송생명과학단지"
];

const INDUSTRY_FIELDS: Array<[string, string]> = [
  ["induty01", "음식료"],
  ["induty02", "섬유의복"],
  ["induty03", "목재종이"],
  ["induty04", "석유화학"],
  ["induty05", "비금속"],
  ["induty06", "철강"],
  ["induty07", "기계"],
  ["induty08", "전기전자"],
  ["induty09", "운송장비"],
  ["induty12", "기타"],
  ["induty131415", "비제조"]
];

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true
});

const prisma = new PrismaClient();

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
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 16);
}

function value(record: RawRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const found = record[key];
    if (typeof found === "string" && found.trim()) return found.trim();
    if (typeof found === "number" && Number.isFinite(found)) return String(found);
  }
  return undefined;
}

function numberValue(record: RawRecord, keys: string[]): number | undefined {
  for (const key of keys) {
    const raw = record[key];
    const parsed = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.replaceAll(",", "")) : Number.NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function asArray<T>(input: T | T[] | undefined): T[] {
  if (!input) return [];
  return Array.isArray(input) ? input : [input];
}

function parsePayload(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return JSON.parse(trimmed);
  return xmlParser.parse(trimmed);
}

function responseBody(raw: unknown): RawRecord {
  const root = raw && typeof raw === "object" ? (raw as RawRecord) : {};
  const response = root.response && typeof root.response === "object" ? (root.response as RawRecord) : root;
  return response.body && typeof response.body === "object" ? (response.body as RawRecord) : response;
}

function responseHeader(raw: unknown): RawRecord {
  const root = raw && typeof raw === "object" ? (raw as RawRecord) : {};
  const response = root.response && typeof root.response === "object" ? (root.response as RawRecord) : root;
  return response.header && typeof response.header === "object" ? (response.header as RawRecord) : {};
}

function recordsFrom(raw: unknown): RawRecord[] {
  const body = responseBody(raw);
  const items = body.items && typeof body.items === "object" ? (body.items as RawRecord) : body.items;
  const item = items && typeof items === "object" ? (items as RawRecord).item : undefined;
  return asArray(item).filter((record): record is RawRecord => Boolean(record && typeof record === "object"));
}

async function fetchPublicApi(endpoint: string, params: Record<string, string | number>): Promise<{
  records: RawRecord[];
  totalCount: number;
  forbidden: boolean;
}> {
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey) throw new Error("DATA_GO_KR_SERVICE_KEY is required.");

  const url = new URL(endpoint);
  url.searchParams.set("serviceKey", serviceKey);
  for (const [key, paramValue] of Object.entries(params)) {
    url.searchParams.set(key, String(paramValue));
  }

  let response: Response | undefined;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      response = await fetch(url, {
        headers: { accept: "application/xml,application/json,text/plain,*/*" },
        signal: AbortSignal.timeout(20000)
      });
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 750));
    }
  }
  if (!response) {
    throw lastError instanceof Error ? lastError : new Error(`fetch failed from ${endpoint}`);
  }
  if (response.status === 403) return { records: [], totalCount: 0, forbidden: true };
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${endpoint}`);

  const raw = parsePayload(await response.text());
  const header = responseHeader(raw);
  const resultCode = String(header.resultCode ?? "00");
  if (resultCode !== "00" && resultCode !== "0") return { records: [], totalCount: 0, forbidden: false };

  const body = responseBody(raw);
  const records = recordsFrom(raw);
  const totalCount = Number(body.totalCount ?? records.length);
  return { records, totalCount: Number.isFinite(totalCount) ? totalCount : records.length, forbidden: false };
}

function splitList(text?: string): string[] {
  if (!text) return [];
  return Array.from(new Set(text.split(/[,/|·ㆍ;]/).map((item) => item.trim()).filter(Boolean))).slice(0, 12);
}

function regionFromAddress(address?: string): string | undefined {
  if (!address) return undefined;
  const match = address.match(/^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주|[가-힣]+도|[가-힣]+광역시)/);
  if (!match) return undefined;
  return match[1]
    .replace("특별시", "")
    .replace("광역시", "")
    .replace("특별자치시", "")
    .replace("특별자치도", "")
    .replace("도", "");
}

function cityFromAddress(address?: string): string | undefined {
  if (!address) return undefined;
  const match = address.match(/(?:서울|부산|대구|인천|광주|대전|울산|세종|경기도|강원도|충청북도|충청남도|전라북도|전라남도|경상북도|경상남도|제주특별자치도|[가-힣]+도|[가-힣]+광역시|[가-힣]+특별시)\s+([가-힣]+(?:시|군|구))/);
  return match?.[1];
}

function sourceByCode(code: string) {
  const source = SUPPLYMAP_DATA_SOURCES.find((item) => item.code === code);
  if (!source) throw new Error(`Unknown source ${code}`);
  return source;
}

async function upsertSources() {
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

function normalizeFactory(record: RawRecord) {
  const externalId = value(record, ["fctryManageNo"]) ?? hash(JSON.stringify(record));
  const name = value(record, ["cmpnyNm", "factoryName", "업체명"]) ?? `KICOX 공장 ${externalId}`;
  const address = value(record, ["rnAdres", "address", "주소"]);
  const products = splitList(value(record, ["mainProductCn", "products", "생산품"]));
  const industryName = value(record, ["indutyNm", "industryName", "업종명"]);
  const industrialComplex = value(record, ["irsttNm", "industrialComplex", "산업단지명"]);
  const employeeCount = numberValue(record, ["allEmplyCo"]);
  const registeredAt = value(record, ["frstFctryRegistDe"]);
  const industryCodes = value(record, ["indutyCodes", "rprsntvIndutyCode"]);
  const productList = products.length > 0 ? products : splitList(industryName);

  return {
    id: `kicox-live-${externalId}`,
    externalId,
    name: name.trim(),
    region: regionFromAddress(address),
    city: cityFromAddress(address),
    address,
    products: productList,
    hsCodes: [],
    industrialComplex,
    industryName,
    description: [
      industryName ? `업종: ${industryName}` : null,
      employeeCount ? `고용 ${employeeCount}명` : "고용 확인 필요",
      registeredAt ? `등록일 ${registeredAt}` : null,
      industryCodes ? `업종코드 ${industryCodes}` : null
    ]
      .filter(Boolean)
      .join(" · ")
  };
}

async function collectFactoryRecords() {
  const collected = new Map<string, RawRecord>();
  const stats = { calls: 0, forbidden: 0, failed: 0 };

  async function collect(endpoint: string, params: Record<string, string | number>, maxPages: number) {
    for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
      stats.calls += 1;
      let result: Awaited<ReturnType<typeof fetchPublicApi>>;
      try {
        result = await fetchPublicApi(endpoint, {
          ...params,
          pageNo,
          numOfRows: ROWS_PER_PAGE,
          type: "xml"
        });
      } catch (error) {
        stats.failed += 1;
        console.warn(
          `[KICOX] skipped page after fetch error: ${endpoint.split("/").at(-1)} page=${pageNo} reason=${
            error instanceof Error ? error.message : "unknown"
          }`
        );
        continue;
      }
      if (result.forbidden) {
        stats.forbidden += 1;
        return;
      }
      for (const record of result.records) {
        const normalized = normalizeFactory(record);
        collected.set(normalized.externalId, record);
      }
      if (result.records.length < ROWS_PER_PAGE || pageNo * ROWS_PER_PAGE >= result.totalCount) break;
    }
  }

  for (const term of PRODUCT_TERMS) {
    await collect(FACTORY_BY_KEYWORD_ENDPOINT, { cmpnyNm: term, mainProductCn: term }, KEYWORD_MAX_PAGES);
    console.log(`[KICOX] keyword=${term} collected=${collected.size}`);
  }

  for (const irsttNm of COMPLEX_NAMES) {
    await collect(FACTORY_BY_COMPLEX_ENDPOINT, { irsttNm }, COMPLEX_MAX_PAGES);
    console.log(`[KICOX] complex=${irsttNm} collected=${collected.size}`);
  }

  return { records: Array.from(collected.values()), stats };
}

function topIndustries(records: ReturnType<typeof normalizeFactory>[]): string[] {
  const counts = new Map<string, number>();
  for (const record of records) {
    for (const item of [...record.products, record.industryName].filter(Boolean) as string[]) {
      counts.set(item, (counts.get(item) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .map(([name]) => name)
    .slice(0, 8);
}

function industryFields(record: RawRecord): string[] {
  return INDUSTRY_FIELDS.filter(([key]) => Number(numberValue(record, [key]) ?? 0) > 0)
    .sort((a, b) => Number(numberValue(record, [b[0]]) ?? 0) - Number(numberValue(record, [a[0]]) ?? 0))
    .map(([, label]) => label)
    .slice(0, 8);
}

async function upsertInferredComplexes(factories: ReturnType<typeof normalizeFactory>[]) {
  const source = sourceByCode("kicox_factory_registry");
  const byComplex = new Map<string, ReturnType<typeof normalizeFactory>[]>();
  for (const factory of factories) {
    if (!factory.industrialComplex) continue;
    const list = byComplex.get(factory.industrialComplex) ?? [];
    list.push(factory);
    byComplex.set(factory.industrialComplex, list);
  }

  for (const [name, records] of byComplex) {
    const first = records[0];
    const existing = await prisma.industrialComplex.findFirst({ where: { name } });
    const payload = {
      sourceId: sourceId(source.code),
      name,
      region: first.region ?? "전국",
      city: first.city,
      industryMixJson: JSON.stringify(topIndustries(records)),
      tenantCount: records.length,
      operatingCount: null,
      operationRate: null,
      exportAmount: null,
      employeeCount: null,
      providerName: source.providerName,
      datasetName: `${source.datasetName} 집계`,
      sourceType: source.sourceType,
      sourceUrl: source.sourceUrl,
      fetchedAt: new Date(),
      license: source.license,
      verification: "PARTIAL" as const
    };

    if (existing) {
      await prisma.industrialComplex.update({
        where: { id: existing.id },
        data: payload
      });
      continue;
    }

    await prisma.industrialComplex.create({
      data: {
        id: `complex-live-${hash(name)}`,
        code: `KICOX-FCTRY-${hash(name)}`,
        ...payload
      }
    });
  }
}

async function upsertFactories(factories: ReturnType<typeof normalizeFactory>[]) {
  const source = sourceByCode("kicox_factory_registry");
  const complexRows = await prisma.industrialComplex.findMany({
    select: { id: true, name: true }
  });
  const complexByName = new Map(complexRows.map((item) => [item.name, item.id]));

  for (const factory of factories) {
    await prisma.supplier.upsert({
      where: {
        sourceId_externalId: {
          sourceId: sourceId(source.code),
          externalId: factory.externalId
        }
      },
      update: {
        industrialComplexId: factory.industrialComplex ? complexByName.get(factory.industrialComplex) : null,
        name: factory.name,
        region: factory.region,
        city: factory.city,
        address: factory.address,
        productsJson: JSON.stringify(factory.products),
        hsCodesJson: JSON.stringify(factory.hsCodes),
        description: factory.description,
        fetchedAt: new Date(),
        verification: "PARTIAL"
      },
      create: {
        id: factory.id,
        sourceId: sourceId(source.code),
        industrialComplexId: factory.industrialComplex ? complexByName.get(factory.industrialComplex) : null,
        externalId: factory.externalId,
        name: factory.name,
        scope: "DOMESTIC",
        countryCode: "KR",
        region: factory.region,
        city: factory.city,
        address: factory.address,
        productsJson: JSON.stringify(factory.products),
        hsCodesJson: JSON.stringify(factory.hsCodes),
        description: factory.description,
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

  await prisma.supplyDataSource.update({
    where: { code: source.code },
    data: { status: "connected", isMock: false, fetchedAt: new Date() }
  });
}

async function collectTrendRecords() {
  const endpoints: Array<{ kind: "tenant" | "employee" | "export" | "operationRate"; path: string }> = [
    { kind: "tenant", path: "/kicoxMvnCmpnyStatsService" },
    { kind: "employee", path: "/kicoxEmpByIrsttStatsService" },
    { kind: "export", path: "/kicoxExportRecByIrsttStatsService" },
    { kind: "operationRate", path: "/kicoxOpRateByIrsttStatsService" }
  ];
  const merged = new Map<string, RawRecord>();
  let forbidden = 0;
  let calls = 0;
  let failed = 0;

  for (const endpoint of endpoints) {
    calls += 1;
    let result: Awaited<ReturnType<typeof fetchPublicApi>>;
    try {
      result = await fetchPublicApi(`${TRENDS_BASE_URL}${endpoint.path}`, {
        stdrYm: DEFAULT_PERIOD,
        type: "xml"
      });
    } catch (error) {
      failed += 1;
      console.warn(
        `[KICOX] skipped trend endpoint after fetch error: ${endpoint.path} reason=${
          error instanceof Error ? error.message : "unknown"
        }`
      );
      continue;
    }
    if (result.forbidden) {
      forbidden += 1;
      continue;
    }
    for (const record of result.records) {
      const name = value(record, ["irsttNm"]);
      if (!name) continue;
      const current = merged.get(name) ?? { irsttNm: name };
      if (endpoint.kind === "tenant") {
        current.tenantCount = numberValue(record, ["monthMvnCmpCnt", "total"]);
        current.operatingCount = numberValue(record, ["monthOpCmpCnt"]);
      }
      if (endpoint.kind === "employee") current.employeeCount = numberValue(record, ["monthTotal", "total"]);
      if (endpoint.kind === "export") current.exportAmount = numberValue(record, ["monthXportactAmount", "totalXportactAmount", "total"]);
      if (endpoint.kind === "operationRate") {
        current.operationRate = numberValue(record, ["monthOpRate", "total"]);
        current.operatingCount = numberValue(record, ["totalOpCmpnyCo"]) ?? current.operatingCount;
      }
      current.industries = JSON.stringify(industryFields(record));
      merged.set(name, current);
    }
  }

  return { records: Array.from(merged.values()), forbidden, calls, failed };
}

async function upsertTrends(records: RawRecord[]) {
  if (records.length === 0) return;
  const source = sourceByCode("kicox_industrial_trends");
  for (const record of records) {
    const name = value(record, ["irsttNm"]);
    if (!name) continue;
    const existing = await prisma.industrialComplex.findFirst({ where: { name } });
    const payload = {
      sourceId: sourceId(source.code),
      name,
      region: "전국",
      city: null,
      industryMixJson: value(record, ["industries"]) ?? "[]",
      tenantCount: Math.round(numberValue(record, ["tenantCount"]) ?? 0) || null,
      operatingCount: Math.round(numberValue(record, ["operatingCount"]) ?? 0) || null,
      operationRate: numberValue(record, ["operationRate"]),
      exportAmount: numberValue(record, ["exportAmount"]),
      employeeCount: Math.round(numberValue(record, ["employeeCount"]) ?? 0) || null,
      providerName: source.providerName,
      datasetName: source.datasetName,
      sourceType: source.sourceType,
      sourceUrl: source.sourceUrl,
      fetchedAt: new Date(),
      license: source.license,
      verification: "PARTIAL" as const
    };

    if (existing) {
      await prisma.industrialComplex.update({ where: { id: existing.id }, data: payload });
    } else {
      await prisma.industrialComplex.create({
        data: {
          id: `complex-trend-${hash(name)}`,
          code: `KICOX-TREND-${hash(name)}`,
          ...payload
        }
      });
    }
  }

  await prisma.supplyDataSource.update({
    where: { code: source.code },
    data: { status: "connected", isMock: false, fetchedAt: new Date() }
  });
}

async function main() {
  loadEnvFile();
  await upsertSources();

  const factoryResult = await collectFactoryRecords();
  const factories = factoryResult.records.map(normalizeFactory);
  await upsertInferredComplexes(factories);
  await upsertFactories(factories);

  const trendResult = await collectTrendRecords();
  await upsertTrends(trendResult.records);

  console.log(
    JSON.stringify(
      {
        supplierRecordsFetched: factoryResult.records.length,
        supplierRecordsUpserted: factories.length,
        factoryApiCalls: factoryResult.stats.calls,
        factoryApiForbiddenCalls: factoryResult.stats.forbidden,
        factoryApiFailedCalls: factoryResult.stats.failed,
        trendComplexRecordsFetched: trendResult.records.length,
        trendApiCalls: trendResult.calls,
        trendApiForbiddenCalls: trendResult.forbidden,
        trendApiFailedCalls: trendResult.failed
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
