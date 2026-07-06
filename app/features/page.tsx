import Link from "next/link";
import {
  ArrowRight,
  DatabaseZap,
  Download,
  Factory,
  FileClock,
  KeyRound,
  MapPinned,
  ScanSearch,
  Settings2,
  ShieldAlert,
  Table2
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const featureCards = [
  {
    href: "/data-sources",
    title: "API 소스",
    description: "공공 API connector 목록을 보고 수집을 실행합니다.",
    icon: DatabaseZap,
    color: "bg-cobalt"
  },
  {
    href: "/data-runs",
    title: "수집 이력",
    description: "raw/normalized 파일 경로와 실행 상태를 추적합니다.",
    icon: FileClock,
    color: "bg-teal"
  },
  {
    href: "/factories",
    title: "공장 관리",
    description: "공장 검색, CSV import, dedupe, geocoding을 실행합니다.",
    icon: Factory,
    color: "bg-amber"
  },
  {
    href: "/map",
    title: "공장 지도",
    description: "필터와 마커 클러스터로 공장 위치와 리스크를 확인합니다.",
    icon: MapPinned,
    color: "bg-teal"
  },
  {
    href: "/exports",
    title: "Export",
    description: "CSV/JSONL 파일을 생성하고 다운로드합니다.",
    icon: Download,
    color: "bg-cobalt"
  },
  {
    href: "/settings/api-keys",
    title: "API 키",
    description: ".env 키 상태와 masked reference를 관리합니다.",
    icon: KeyRound,
    color: "bg-ink"
  },
  {
    href: "/factories",
    title: "Evidence Card",
    description: "공식 데이터, 검색 근거, 리스크 이벤트를 공장 단위로 확인합니다.",
    icon: ScanSearch,
    color: "bg-amber"
  },
  {
    href: "/data-sources",
    title: "Connector Lab",
    description: "의료기기, 에너지, KC/RRA, 관세청 connector를 확장합니다.",
    icon: Settings2,
    color: "bg-cobalt"
  },
  {
    href: "/factories",
    title: "Risk Scoring",
    description: "Import Readiness Score와 리스크 레벨을 확인합니다.",
    icon: ShieldAlert,
    color: "bg-danger"
  }
];

export default async function FeaturesPage() {
  const [factoryCount, sourceCount, runCount, exportCount] = await Promise.all([
    prisma.factory.count(),
    prisma.apiSource.count(),
    prisma.ingestionRun.count(),
    prisma.exportFile.count()
  ]);

  return (
    <>
      <PageHeader
        title="그외기능"
        description="데이터 수집, 정규화, 공장 관리, 지도, export, 설정 기능을 한 곳에서 선택합니다."
      />

      <section className="mb-5 grid gap-3 md:grid-cols-4">
        {[
          ["Factories", factoryCount],
          ["Sources", sourceCount],
          ["Runs", runCount],
          ["Exports", exportCount]
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-line bg-white p-4 shadow-soft">
            <div className="flex items-center gap-2 text-xs text-muted">
              <Table2 className="h-4 w-4" />
              {label}
            </div>
            <div className="mt-2 text-2xl font-semibold">{value}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {featureCards.map((feature) => {
          const Icon = feature.icon;
          return (
            <Link
              key={`${feature.href}-${feature.title}`}
              href={feature.href}
              className="group rounded-md border border-line bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-cobalt/40 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-4">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-md ${feature.color} text-white`}>
                  <Icon className="h-7 w-7" />
                </div>
                <ArrowRight className="h-5 w-5 text-muted transition group-hover:translate-x-1 group-hover:text-cobalt" />
              </div>
              <h2 className="mt-5 text-lg font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{feature.description}</p>
            </Link>
          );
        })}
      </section>
    </>
  );
}
