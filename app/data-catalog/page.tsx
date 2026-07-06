import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  Factory,
  FileSearch,
  Globe2,
  KeyRound,
  Layers3,
  LockKeyhole,
  ServerCog,
  ShieldCheck,
  TableProperties,
  UploadCloud
} from "lucide-react";
import { SourceBadge } from "@/components/SourceBadge";
import { prisma } from "@/lib/db/prisma";
import { SUPPLYMAP_DATA_SOURCES } from "@/lib/supplymap/data-sources";
import type { SupplyDataSourceRecord, SupplySourceType, VerificationStatus } from "@/lib/supplymap/types";

export const dynamic = "force-dynamic";

type CatalogMode = "actual" | "demo" | "mock";
type CatalogStatus = "connected" | "mock" | "planned";
type UsageLocation = "국내후보" | "해외후보" | "리스크" | "챗봇" | "리포트";

type DataCatalogSource = SupplyDataSourceRecord & {
  isMock: boolean;
  mode: CatalogMode;
  sourceOrigin: "DB" | "STATIC";
  adapterStatus: string;
  adapterFile: string;
  envNames: string[];
  envConfigured: "present" | "missing" | "not_required";
  usageLocations: UsageLocation[];
  counts: {
    suppliers: number;
    industrialComplexes: number;
    riskSignals: number;
    chatEvidence: number;
  };
  dbUpdatedAt?: string;
};

const sourceTypeOrder: SupplySourceType[] = ["MOTIE_PUBLIC", "OTHER_PUBLIC", "PRIVATE", "USER_UPLOAD"];

const sourceTypeGroups: Record<
  SupplySourceType,
  {
    title: string;
    description: string;
    icon: typeof Database;
  }
> = {
  MOTIE_PUBLIC: {
    title: "산업통상부·산하 공공기관 데이터",
    description: "SupplyMap AI의 핵심 국내 공장·산업단지 데이터입니다. 국내 후보 탐색, 무역 상담 RAG, 국가·거래위험 판단의 주요 근거로 사용합니다.",
    icon: Factory
  },
  OTHER_PUBLIC: {
    title: "타 기관 공공데이터",
    description: "관세청·식약처 등 타 기관 공공데이터입니다. HS, 통관요건, 식품·의료·인증 리스크를 보강합니다.",
    icon: ShieldCheck
  },
  PRIVATE: {
    title: "민간·중국/해외 베타 데이터",
    description: "중국/해외 공장과 지도 기반 후보를 베타 비교 레이어로 사용합니다. MOTIE_PUBLIC처럼 표시하지 않습니다.",
    icon: Globe2
  },
  USER_UPLOAD: {
    title: "사용자 업로드 데이터",
    description: "사용자가 보유한 공급업체 목록, 견적서, 카탈로그입니다. 원본 권한과 최신성은 사용자가 확인해야 합니다.",
    icon: UploadCloud
  }
};

const coreSourceCodes = [
  "kicox_factory_registry",
  "kicox_industrial_trends",
  "kotra_trade_qa",
  "kotra_market_news",
  "kotra_country_info",
  "safety_korea",
  "ksure_country_trade"
];

const adapterMeta: Record<
  string,
  {
    adapterStatus: string;
    adapterFile: string;
    envNames: string[];
    usageLocations: UsageLocation[];
  }
> = {
  kicox_factory_registry: {
    adapterStatus: "실제 API adapter + fallback 구현",
    adapterFile: "lib/supplymap/adapters/kicox-factory.ts",
    envNames: ["KICOX_FACTORY_REGISTRY_ENDPOINT", "DATA_GO_KR_SERVICE_KEY"],
    usageLocations: ["국내후보", "리포트"]
  },
  kicox_industrial_trends: {
    adapterStatus: "실제 API adapter + fallback 구현",
    adapterFile: "lib/supplymap/adapters/kicox-industrial-trends.ts",
    envNames: ["KICOX_INDUSTRIAL_TRENDS_ENDPOINT", "DATA_GO_KR_SERVICE_KEY"],
    usageLocations: ["국내후보", "리포트"]
  },
  kotra_trade_qa: {
    adapterStatus: "RAG sample corpus 사용, 실제 문서 연동 확장 지점",
    adapterFile: "lib/supplymap/rag.ts",
    envNames: ["KOTRA_API_KEY"],
    usageLocations: ["챗봇", "리포트"]
  },
  kotra_market_news: {
    adapterStatus: "리스크 adapter + fallback 구현",
    adapterFile: "lib/supplymap/adapters/kotra-news.ts",
    envNames: ["KOTRA_API_KEY"],
    usageLocations: ["리스크", "챗봇", "리포트"]
  },
  kotra_country_info: {
    adapterStatus: "RAG 국가정보 sample corpus, KOTRA API 확장 예정",
    adapterFile: "lib/supplymap/rag.ts",
    envNames: ["KOTRA_API_KEY"],
    usageLocations: ["리스크", "챗봇", "리포트"]
  },
  ksure_country_trade: {
    adapterStatus: "리스크 adapter + fallback 구현",
    adapterFile: "lib/supplymap/adapters/ksure-country-risk.ts",
    envNames: ["KSURE_API_KEY"],
    usageLocations: ["리스크", "챗봇", "리포트"]
  },
  safety_korea: {
    adapterStatus: "제품안전 adapter + fallback 구현",
    adapterFile: "lib/supplymap/adapters/safety-korea.ts",
    envNames: ["SAFETY_KOREA_API_KEY"],
    usageLocations: ["리스크", "챗봇", "리포트"]
  },
  customs_requirements: {
    adapterStatus: "관세청 adapter + fallback 구현",
    adapterFile: "lib/supplymap/adapters/customs-requirements.ts",
    envNames: ["CUSTOMS_CONFIRMATION_ITEMS_SERVICE_KEY", "CUSTOMS_API_KEY", "DATA_GO_KR_SERVICE_KEY"],
    usageLocations: ["리스크", "챗봇", "리포트"]
  },
  customs_trade_stats: {
    adapterStatus: "관세청 품목·국가별 수출입실적 adapter + fallback 구현",
    adapterFile: "lib/supplymap/adapters/customs-trade-stats.ts",
    envNames: ["CUSTOMS_TRADE_STATS_SERVICE_KEY", "CUSTOMS_API_KEY", "DATA_GO_KR_SERVICE_KEY"],
    usageLocations: ["리스크", "챗봇", "리포트"]
  },
  mfds_overseas_factory: {
    adapterStatus: "실제 샘플 API 확인, 해외 제조업소 보조 레이어",
    adapterFile: "기존 ingestion/API connector",
    envNames: ["DATA_GO_KR_SERVICE_KEY"],
    usageLocations: ["해외후보", "리포트"]
  },
  private_global_factory: {
    adapterStatus: "기존 Factory DB 42,396개를 보조 후보로 정규화",
    adapterFile: "lib/supplymap/global.ts",
    envNames: [],
    usageLocations: ["해외후보", "리포트"]
  },
  user_uploaded_suppliers: {
    adapterStatus: "업로드 UI 확장 예정, 현재는 분류 체계와 리포트 슬롯 확보",
    adapterFile: "planned",
    envNames: [],
    usageLocations: ["해외후보", "리포트"]
  }
};

const modeLabels: Record<CatalogMode, string> = {
  actual: "actual",
  demo: "sample",
  mock: "fallback"
};

const modeStyles: Record<CatalogMode, string> = {
  actual: "bg-teal/10 text-teal",
  demo: "bg-cobalt/10 text-cobalt",
  mock: "bg-panel text-muted"
};

const statusLabels: Record<CatalogStatus, string> = {
  connected: "연결됨",
  mock: "fallback",
  planned: "예정"
};

const usageStyles: Record<UsageLocation, string> = {
  국내후보: "bg-teal/10 text-teal",
  해외후보: "bg-amber/10 text-amber",
  리스크: "bg-danger/10 text-danger",
  챗봇: "bg-[#eef4fb] text-cobalt",
  리포트: "bg-panel text-ink"
};

function normalizeStatus(status: string | null | undefined): CatalogStatus {
  if (status === "connected" || status === "mock" || status === "planned") return status;
  return "mock";
}

function normalizeVerification(value: string | null | undefined, fallback: VerificationStatus): VerificationStatus {
  if (value === "VERIFIED" || value === "PARTIAL" || value === "CHECK_REQUIRED" || value === "MOCK") return value;
  return fallback;
}

function modeFor(status: CatalogStatus, isMock: boolean): CatalogMode {
  if (status === "connected" && !isMock) return "actual";
  if (status === "planned") return "mock";
  return "demo";
}

function envConfigured(envNames: string[]) {
  if (envNames.length === 0) return "not_required" as const;
  return envNames.every((envName) => Boolean(process.env[envName])) ? ("present" as const) : ("missing" as const);
}

function envStatusLabel(status: DataCatalogSource["envConfigured"]) {
  if (status === "present") return ".env configured";
  if (status === "missing") return ".env missing";
  return "env not required";
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "확인 필요";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function sourceWeight(source: DataCatalogSource) {
  const groupWeight = sourceTypeOrder.indexOf(source.sourceType);
  const coreWeight = coreSourceCodes.includes(source.code) ? 0 : 1;
  return groupWeight * 100 + coreWeight * 10;
}

function staticByCode(code: string) {
  return SUPPLYMAP_DATA_SOURCES.find((source) => source.code === code);
}

function enrichSource(source: SupplyDataSourceRecord, options?: {
  isMock?: boolean;
  sourceOrigin?: "DB" | "STATIC";
  counts?: DataCatalogSource["counts"];
  dbUpdatedAt?: string;
}): DataCatalogSource {
  const meta = adapterMeta[source.code] ?? {
    adapterStatus: "adapter 확인 필요",
    adapterFile: "확인 필요",
    envNames: [],
    usageLocations: ["리포트"] as UsageLocation[]
  };
  const status = normalizeStatus(source.status);
  const isMock = options?.isMock ?? (source.verification === "MOCK" || status !== "connected");
  return {
    ...source,
    status,
    isMock,
    mode: modeFor(status, isMock),
    sourceOrigin: options?.sourceOrigin ?? "STATIC",
    adapterStatus: meta.adapterStatus,
    adapterFile: meta.adapterFile,
    envNames: meta.envNames,
    envConfigured: envConfigured(meta.envNames),
    usageLocations: meta.usageLocations,
    counts: options?.counts ?? {
      suppliers: 0,
      industrialComplexes: 0,
      riskSignals: 0,
      chatEvidence: 0
    },
    dbUpdatedAt: options?.dbUpdatedAt
  };
}

async function loadCatalogSources(): Promise<DataCatalogSource[]> {
  const staticMap = new Map(SUPPLYMAP_DATA_SOURCES.map((source) => [source.code, source]));

  try {
    const rows = await prisma.supplyDataSource.findMany({
      orderBy: [{ sourceType: "asc" }, { providerName: "asc" }, { datasetName: "asc" }],
      include: {
        _count: {
          select: {
            suppliers: true,
            industrialComplexes: true,
            riskSignals: true,
            chatEvidence: true
          }
        }
      }
    });

    const dbSources = rows.map((row) => {
      const staticSource = staticMap.get(row.code);
      const fallbackVerification = staticSource?.verification ?? (row.isMock ? "MOCK" : "PARTIAL");
      const record: SupplyDataSourceRecord = {
        code: row.code,
        providerName: row.providerName,
        datasetName: row.datasetName,
        sourceType: row.sourceType as SupplySourceType,
        sourceUrl: row.sourceUrl,
        fetchedAt: row.fetchedAt.toISOString(),
        license: row.license,
        verification: normalizeVerification(staticSource?.verification, fallbackVerification),
        description: staticSource?.description ?? "DB에 등록된 SupplyDataSource입니다.",
        status: normalizeStatus(row.status),
        updateCycle: row.updateCycle ?? staticSource?.updateCycle ?? "확인 필요",
        role: staticSource?.role ?? "SupplyMap 분석 근거"
      };
      return enrichSource(record, {
        isMock: row.isMock,
        sourceOrigin: "DB",
        counts: {
          suppliers: row._count.suppliers,
          industrialComplexes: row._count.industrialComplexes,
          riskSignals: row._count.riskSignals,
          chatEvidence: row._count.chatEvidence
        },
        dbUpdatedAt: row.updatedAt.toISOString()
      });
    });

    const missingStaticSources = SUPPLYMAP_DATA_SOURCES
      .filter((source) => !rows.some((row) => row.code === source.code))
      .map((source) => enrichSource(source, { sourceOrigin: "STATIC" }));

    return [...dbSources, ...missingStaticSources].sort(
      (left, right) =>
        sourceWeight(left) - sourceWeight(right) ||
        left.providerName.localeCompare(right.providerName, "ko") ||
        left.datasetName.localeCompare(right.datasetName, "ko")
    );
  } catch {
    return SUPPLYMAP_DATA_SOURCES.map((source) => enrichSource(source, { sourceOrigin: "STATIC" })).sort(
      (left, right) =>
        sourceWeight(left) - sourceWeight(right) ||
        left.providerName.localeCompare(right.providerName, "ko") ||
        left.datasetName.localeCompare(right.datasetName, "ko")
    );
  }
}

function countByType(sources: DataCatalogSource[], sourceType: SupplySourceType) {
  return sources.filter((source) => source.sourceType === sourceType).length;
}

function DataSourceCard({ source, compact = false }: { source: DataCatalogSource; compact?: boolean }) {
  const recordCount = source.counts.suppliers + source.counts.industrialComplexes + source.counts.riskSignals + source.counts.chatEvidence;
  return (
    <article className="flex h-full flex-col border border-line bg-white p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge sourceType={source.sourceType} compact />
            <span className={"rounded-full px-2 py-0.5 text-[10px] font-bold " + modeStyles[source.mode]}>
              mode: {modeLabels[source.mode]}
            </span>
            <span className="rounded-full bg-panel px-2 py-0.5 text-[10px] font-bold text-muted">{source.sourceOrigin}</span>
          </div>
          <h3 className="mt-3 text-sm font-bold leading-5 text-ink">{source.datasetName}</h3>
          <p className="mt-1 text-xs font-semibold text-muted">{source.providerName}</p>
        </div>
        {coreSourceCodes.includes(source.code) ? <CheckCircle2 className="h-4 w-4 shrink-0 text-teal" /> : null}
      </div>

      <p className="mt-3 text-xs leading-5 text-muted">{source.description}</p>

      <dl className={"mt-4 grid gap-2 text-[11px] " + (compact ? "" : "sm:grid-cols-2")}>
        <div className="rounded border border-line bg-panel px-3 py-2">
          <dt className="font-bold text-ink">adapter</dt>
          <dd className="mt-1 leading-5 text-muted">{source.adapterStatus}</dd>
          <dd className="mt-1 break-all font-mono text-[10px] text-muted">{source.adapterFile}</dd>
        </div>
        <div className="rounded border border-line bg-panel px-3 py-2">
          <dt className="font-bold text-ink">last fetched</dt>
          <dd className="mt-1 leading-5 text-muted">{formatDate(source.fetchedAt)}</dd>
          <dd className="mt-1 text-muted">상태 {statusLabels[normalizeStatus(source.status)]}</dd>
        </div>
        <div className="rounded border border-line bg-panel px-3 py-2">
          <dt className="font-bold text-ink">license</dt>
          <dd className="mt-1 leading-5 text-muted">{source.license}</dd>
        </div>
        <div className="rounded border border-line bg-panel px-3 py-2">
          <dt className="font-bold text-ink">update cycle</dt>
          <dd className="mt-1 leading-5 text-muted">{source.updateCycle}</dd>
          <dd className="mt-1 text-muted">verification {source.verification}</dd>
        </div>
      </dl>

      <div className="mt-4">
        <p className="text-[11px] font-bold text-ink">현재 사용 위치</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {source.usageLocations.map((usage) => (
            <span key={usage} className={"rounded-full px-2 py-0.5 text-[10px] font-bold " + usageStyles[usage]}>
              {usage}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-[11px] sm:grid-cols-2">
        <div className="flex items-center gap-2 text-muted">
          <KeyRound className="h-3.5 w-3.5" />
          <span>{envStatusLabel(source.envConfigured)}</span>
        </div>
        <div className="flex items-center gap-2 text-muted">
          <TableProperties className="h-3.5 w-3.5" />
          <span>DB records {recordCount.toLocaleString("ko-KR")}</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-[11px] text-muted">
        <span className="min-w-0 break-all font-mono">{source.code}</span>
        {source.sourceUrl && source.sourceUrl !== "about:blank" ? (
          <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-cobalt hover:underline">
            sourceUrl <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span>sourceUrl: 사용자 원문</span>
        )}
      </div>
    </article>
  );
}

function EnvStatusPanel({ sources }: { sources: DataCatalogSource[] }) {
  const envNames = Array.from(new Set([...sources.flatMap((source) => source.envNames), "DEEPSEEK_API_KEY"])).sort();
  return (
    <section className="border border-line bg-white p-5 shadow-soft" aria-labelledby="api-key-status-title">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <LockKeyhole className="h-4 w-4 text-cobalt" />
            <h2 id="api-key-status-title" className="text-base font-bold text-ink">API key 상태 안내</h2>
          </div>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-muted">
            이 페이지는 키 값을 표시하지 않습니다. Settings 화면의 masked key는 실제 secret storage가 아니라 입력값의 마스킹 참조이며,
            실제 서버 호출은 `.env` 또는 `.env.local`에 설정된 환경변수를 우선 사용합니다.
          </p>
        </div>
        <Link href="/settings/api-keys" className="inline-flex min-h-9 w-fit items-center gap-2 rounded-md border border-line px-3 text-xs font-bold text-ink hover:bg-panel">
          키 상태 화면 <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {envNames.map((envName) => {
          const present = Boolean(process.env[envName]);
          return (
            <div key={envName} className="flex min-w-0 items-center justify-between gap-3 rounded border border-line bg-panel px-3 py-2 text-[11px]">
              <span className="min-w-0 break-all font-mono font-bold text-ink">{envName}</span>
              <span className={"shrink-0 rounded-full px-2 py-0.5 font-bold " + (present ? "bg-teal/10 text-teal" : "bg-panel text-muted")}>
                {present ? "present" : "missing"}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 border-l-4 border-amber bg-[#fff9e8] px-4 py-3 text-xs leading-5 text-[#735f2c]">
        <b>주의:</b> `.env`가 present여도 이 화면에서 실제 API 호출 성공을 보증하지 않습니다. 네트워크, API 승인상태, 호출 제한은 각 adapter 실행 시 확인됩니다.
      </div>
    </section>
  );
}

export default async function DataCatalogPage() {
  const sources = await loadCatalogSources();
  const coreSources = coreSourceCodes
    .map((code) => sources.find((source) => source.code === code) ?? staticByCode(code))
    .filter((source): source is DataCatalogSource | SupplyDataSourceRecord => Boolean(source))
    .map((source) => ("mode" in source ? source : enrichSource(source)));
  const actualCount = sources.filter((source) => source.mode === "actual").length;
  const demoCount = sources.filter((source) => source.mode === "demo").length;

  return (
    <>
      <header className="mb-6 flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-cobalt">
            <Database className="h-4 w-4" /> SUPPLYDATA SOURCE EVIDENCE
          </div>
          <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">데이터 출처 및 연동 상태</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">
            SupplyMap AI가 사용하는 SupplyDataSource, adapter 상태, sample/actual mode, 마지막 수집 상태를 한 화면에서 확인합니다.
            기존 ingestion용 ApiSource가 아니라 서비스 출처 관리용 SupplyDataSource를 기준으로 표시합니다.
          </p>
        </div>
        <Link href="/supplymap" className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-cobalt px-4 py-2 text-sm font-bold text-white hover:bg-[#1d4788]">
          SupplyMap 분석 <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      <section className="mb-6 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <article className="border border-cobalt/20 bg-[#f7fbff] p-5 shadow-soft">
          <div className="flex items-center gap-2">
            <Layers3 className="h-5 w-5 text-cobalt" />
            <h2 className="text-base font-bold text-ink">데이터 활용 원칙</h2>
          </div>
          <p className="mt-3 text-sm leading-7 text-ink">
            본 서비스는 산업통상부 및 산하 공공기관 데이터를 핵심 데이터로 사용하고, 관세청·식약처 등 타 기관 데이터와
            민간/해외 데이터를 보조적으로 연계합니다.
          </p>
          <p className="mt-2 text-xs leading-5 text-muted">
            국내 산업단지와 국내 공장 공공데이터를 기반으로 국내 후보를 만들고, 중국/해외 베타 후보, 인증·통관·리콜·국가위험, RAG 챗봇, 리포트 근거로 확장합니다.
          </p>
        </article>
        <article className="border border-[#d7b24c] bg-[#fff9e8] p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber" />
            <h2 className="text-base font-bold text-ink">표시 기준</h2>
          </div>
          <p className="mt-3 text-xs leading-5 text-[#735f2c]">
            PRIVATE·USER_UPLOAD 데이터는 공공데이터가 아니며, 국내 후보 근거를 대체하지 않습니다.
            mode가 sample/fallback인 항목은 API key 없이도 샘플 분석이 안정적으로 동작하도록 제공되는 fallback입니다.
          </p>
        </article>
      </section>

      <section className="mb-6 grid gap-px border border-line bg-line sm:grid-cols-2 xl:grid-cols-4" aria-label="SupplyDataSource 현황">
        {[
          { label: "MOTIE_PUBLIC", value: countByType(sources, "MOTIE_PUBLIC"), detail: "핵심 공공데이터", icon: Factory, sourceType: "MOTIE_PUBLIC" as const },
          { label: "OTHER_PUBLIC", value: countByType(sources, "OTHER_PUBLIC"), detail: "통관·인증 보강", icon: ShieldCheck, sourceType: "OTHER_PUBLIC" as const },
          { label: "PRIVATE", value: countByType(sources, "PRIVATE"), detail: "중국/해외 베타", icon: Globe2, sourceType: "PRIVATE" as const },
          { label: "mode", value: `${actualCount}/${demoCount}`, detail: "actual/sample", icon: ServerCog, sourceType: "USER_UPLOAD" as const }
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="flex items-center justify-between bg-white px-5 py-4">
              <div>
                <SourceBadge sourceType={metric.sourceType} compact />
                <p className="mt-2 text-2xl font-bold text-ink">{metric.value}</p>
                <p className="mt-1 text-[11px] text-muted">{metric.detail}</p>
              </div>
              <Icon className="h-5 w-5 text-muted" />
            </div>
          );
        })}
      </section>

      <section className="mb-6 border border-line bg-white p-5 shadow-soft" aria-labelledby="core-source-title">
        <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="core-source-title" className="text-base font-bold text-ink">핵심 데이터 7종</h2>
              <SourceBadge sourceType="MOTIE_PUBLIC" />
            </div>
            <p className="mt-1 text-xs text-muted">산업통상부 및 산하 공공기관 데이터를 상단에 고정해 국내 공급망 분석의 기준으로 사용합니다.</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-teal">
            <CheckCircle2 className="h-3.5 w-3.5" /> 국내 공장·산업단지 분석의 출발점
          </span>
        </header>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {coreSources.map((source) => (
            <DataSourceCard key={source.code} source={source as DataCatalogSource} compact />
          ))}
        </div>
      </section>

      <EnvStatusPanel sources={sources} />

      <div className="mt-6 space-y-6">
        {sourceTypeOrder.map((sourceType) => {
          const group = sourceTypeGroups[sourceType];
          const Icon = group.icon;
          const groupSources = sources.filter((source) => source.sourceType === sourceType);
          return (
            <section key={sourceType} className="overflow-hidden border border-line bg-white shadow-soft" aria-labelledby={`source-group-${sourceType}`}>
              <header className="flex flex-col gap-3 border-b border-line px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Icon className="h-5 w-5 text-cobalt" />
                    <h2 id={`source-group-${sourceType}`} className="text-base font-bold text-ink">{group.title}</h2>
                    <SourceBadge sourceType={sourceType} />
                  </div>
                  <p className="mt-1 max-w-4xl text-xs leading-5 text-muted">{group.description}</p>
                </div>
                <span className="text-[11px] font-bold text-muted">{groupSources.length} sources</span>
              </header>
              {groupSources.length ? (
                <div className="grid gap-4 bg-panel p-4 md:grid-cols-2 2xl:grid-cols-3">
                  {groupSources.map((source) => (
                    <DataSourceCard key={source.code} source={source} />
                  ))}
                </div>
              ) : (
                <div className="bg-panel px-5 py-8 text-sm text-muted">
                  현재 등록된 {group.title}가 없습니다. 해당 분류는 데이터 출처 관리 체계상 예약되어 있습니다.
                </div>
              )}
            </section>
          );
        })}
      </div>

      <section className="mt-6 border border-line bg-white p-5 shadow-soft" aria-labelledby="collection-status-title">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-cobalt" />
          <h2 id="collection-status-title" className="text-base font-bold text-ink">마지막 수집 상태 요약</h2>
        </div>
        <div className="mt-4 grid gap-3 lg:hidden">
          {sources.map((source) => (
            <article key={source.code} className="border border-line bg-panel px-3 py-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <SourceBadge sourceType={source.sourceType} compact />
                <span className={"rounded-full px-2 py-0.5 font-bold " + modeStyles[source.mode]}>{modeLabels[source.mode]}</span>
                <span className="font-mono text-[10px] text-muted">{source.code}</span>
              </div>
              <p className="mt-2 font-bold text-ink">{source.datasetName}</p>
              <dl className="mt-2 grid gap-1 text-[11px] leading-5 text-muted">
                <div><b className="text-ink">lastFetchedAt</b> {formatDate(source.fetchedAt)}</div>
                <div><b className="text-ink">DB updatedAt</b> {source.dbUpdatedAt ? formatDate(source.dbUpdatedAt) : "static fallback"}</div>
                <div><b className="text-ink">사용 위치</b> {source.usageLocations.join(" · ")}</div>
              </dl>
            </article>
          ))}
        </div>
        <div className="mt-4 hidden lg:block" style={{ maxWidth: "100%", overflowX: "auto" }}>
          <table className="w-full border-collapse text-left text-xs" style={{ minWidth: 920 }}>
            <thead className="bg-panel font-bold text-muted">
              <tr>
                <th className="px-3 py-2">sourceType</th>
                <th className="px-3 py-2">dataset</th>
                <th className="px-3 py-2">mode</th>
                <th className="px-3 py-2">lastFetchedAt</th>
                <th className="px-3 py-2">DB updatedAt</th>
                <th className="px-3 py-2">사용 위치</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sources.map((source) => (
                <tr key={source.code} className="align-top hover:bg-panel">
                  <td className="px-3 py-3"><SourceBadge sourceType={source.sourceType} compact /></td>
                  <td className="px-3 py-3">
                    <p className="font-bold text-ink">{source.datasetName}</p>
                    <p className="mt-1 break-all font-mono text-[10px] text-muted">{source.code}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className={"rounded-full px-2 py-0.5 font-bold " + modeStyles[source.mode]}>{modeLabels[source.mode]}</span>
                  </td>
                  <td className="px-3 py-3 text-muted">{formatDate(source.fetchedAt)}</td>
                  <td className="px-3 py-3 text-muted">{source.dbUpdatedAt ? formatDate(source.dbUpdatedAt) : "static fallback"}</td>
                  <td className="px-3 py-3 text-muted">{source.usageLocations.join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-start gap-2 border-l-4 border-cobalt bg-[#eef4fb] px-4 py-3 text-xs leading-5 text-ink">
          <FileSearch className="mt-0.5 h-4 w-4 shrink-0 text-cobalt" />
          <p>
            `lastFetchedAt`는 SupplyDataSource의 수집 기준 시점이며, `DB updatedAt`은 로컬 SQLite 레코드 갱신 시점입니다.
            sample/fallback 항목은 실제 API 호출 성공을 의미하지 않고, API key가 없거나 호출이 실패할 때 쓰는 fallback 상태를 의미합니다.
          </p>
        </div>
      </section>
    </>
  );
}
