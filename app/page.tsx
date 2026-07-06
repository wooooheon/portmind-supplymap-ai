import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Database,
  Factory,
  FileSearch,
  MapPinned,
  ShieldCheck,
  Sparkles
} from "lucide-react";

const workflow = [
  {
    number: "01",
    title: "제품 조건 입력",
    description: "제품명, HS 코드 후보, 수입 희망 국가와 비교 기준을 입력합니다.",
    icon: FileSearch
  },
  {
    number: "02",
    title: "한국·중국 공장 탐색",
    description: "국내 공장 데이터와 중국 베타 공장 데이터를 품목 기준으로 나누어 봅니다.",
    icon: Factory
  },
  {
    number: "03",
    title: "리스크·근거 비교",
    description: "후보 점수, 인증·통관 리스크와 원문 데이터 근거를 한 화면에서 확인합니다.",
    icon: ShieldCheck
  }
];

export default function PortalHomePage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="PortMind SupplyMap AI 홈">
            <Image src="/portmind-logo.png" alt="PortMind" width={142} height={48} className="h-10 w-auto object-contain" priority />
            <span className="hidden border-l border-line pl-3 text-sm font-bold text-ink sm:inline">SupplyMap AI</span>
          </Link>
          <nav className="flex items-center gap-2" aria-label="빠른 메뉴">
            <Link href="/data-catalog" className="hidden px-3 py-2 text-sm font-medium text-muted hover:text-ink sm:block">
              데이터 출처
            </Link>
            <Link
              href="/supplymap"
              className="inline-flex min-h-10 items-center gap-2 rounded-md bg-cobalt px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1d4788]"
            >
              공급망 분석 시작 <ArrowRight className="h-4 w-4" />
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-ink text-white">
          <div className="pointer-events-none absolute inset-0 opacity-[0.12]" aria-hidden="true">
            <div className="absolute left-[6%] top-[22%] h-px w-[52%] bg-white" />
            <div className="absolute left-[21%] top-[60%] h-px w-[58%] bg-white" />
            <div className="absolute left-[24%] top-[22%] h-[38%] w-px bg-white" />
            <div className="absolute left-[64%] top-[22%] h-[38%] w-px bg-white" />
            {[
              ["24%", "22%"],
              ["42%", "22%"],
              ["64%", "22%"],
              ["24%", "60%"],
              ["51%", "60%"],
              ["78%", "60%"]
            ].map(([left, top]) => (
              <span key={`${left}-${top}`} className="absolute h-3 w-3 rounded-full border-2 border-white bg-ink" style={{ left, top }} />
            ))}
          </div>

            <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 md:py-20 lg:px-8">
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
              <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1.5">산업통상부 공공데이터 기반 공급망 분석</span>
              <span className="inline-flex items-center gap-1.5 text-white/70">
                <Sparkles className="h-3.5 w-3.5 text-[#f8c14d]" /> AI 제조 공급망 의사결정
              </span>
            </div>
            <h1 className="mt-7 max-w-4xl text-4xl font-bold leading-[1.2] sm:text-5xl lg:text-6xl">
              SupplyMap AI
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/75 sm:text-lg">
              한국 공장과 해외 공장 베타(중국)를 같은 품목 기준으로 탐색하고, 인증·통관·공급 리스크를 근거 데이터와 함께 비교합니다.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/supplymap"
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-white px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-[#e8edf2]"
              >
                SupplyMap 분석 시작 <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/data-catalog"
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
              >
                <Database className="h-4 w-4" /> SupplyDataSource 보기
              </Link>
            </div>

            <div className="mt-12 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-md border border-white/15 bg-white/15 sm:grid-cols-4">
              {[
                ["KR/CN", "공장 지도 비교"],
                ["MOTIE", "공공데이터 우선"],
                ["100%", "근거 추적 가능"],
                ["AI", "근거 기반 답변"]
              ].map(([value, label]) => (
                <div key={label} className="bg-ink/80 px-4 py-4">
                  <p className="text-xl font-bold text-white">{value}</p>
                  <p className="mt-1 text-xs text-white/60">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-line bg-panel">
          <div className="mx-auto grid max-w-7xl gap-0 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
            {workflow.map((item, index) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.number}
                  className={`py-8 md:px-7 ${index > 0 ? "border-t border-line md:border-l md:border-t-0" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-cobalt">{item.number}</span>
                    <Icon className="h-5 w-5 text-muted" />
                  </div>
                  <h2 className="mt-5 text-base font-bold text-ink">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted">{item.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-md">
              <p className="text-xs font-bold uppercase text-cobalt">Factory intelligence</p>
              <h2 className="mt-3 text-2xl font-bold text-ink sm:text-3xl">한국 공장과 중국 베타 공장을 함께 비교합니다</h2>
              <p className="mt-4 text-sm leading-6 text-muted">
                국내 공장은 산업단지·생산품·주소 정보를 깊게 보고, 중국 공장은 현재 확보된 베타 데이터로 품목군·지역 분포를 비교합니다.
              </p>
            </div>
            <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:max-w-2xl">
              {[
                [Building2, "국내 공장 카테고리", "화장품·식품 포장·전기전자·의료·드론"],
                [Factory, "중국 베타 레이어", "식품·포장 중심 해외 제조업소 데이터"],
                [MapPinned, "지역 분포 비교", "정확 좌표와 추정 좌표를 구분 표시"],
                [CheckCircle2, "원문 근거 추적", "결론마다 데이터셋과 레코드 표시"]
              ].map(([Icon, title, description]) => {
                const FeatureIcon = Icon as typeof Building2;
                return (
                  <div key={String(title)} className="flex gap-3 border-t border-line py-4">
                    <FeatureIcon className="mt-0.5 h-5 w-5 shrink-0 text-teal" />
                    <div>
                      <h3 className="text-sm font-bold text-ink">{String(title)}</h3>
                      <p className="mt-1 text-xs leading-5 text-muted">{String(description)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-panel">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Image src="/portmind-mark.png" alt="PortMind" width={24} height={24} className="h-6 w-6 rounded-sm object-cover" />
            <span>PortMind · SupplyMap AI</span>
          </div>
          <span>Public-data based sourcing intelligence</span>
        </div>
      </footer>
    </div>
  );
}
