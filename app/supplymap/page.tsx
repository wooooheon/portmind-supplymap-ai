import Image from "next/image";
import { ArrowRight, Database, Factory, ShieldCheck } from "lucide-react";
import { SourceBadge } from "@/components/SourceBadge";
import { SupplyMapWorkbench } from "@/components/SupplyMapWorkbench";
import { SUPPLYMAP_DATA_SOURCES } from "@/lib/supplymap/data-sources";

export const dynamic = "force-dynamic";

export default function SupplyMapPage() {
  const motieCount = SUPPLYMAP_DATA_SOURCES.filter((source) => source.sourceType === "MOTIE_PUBLIC").length;
  const supportingCount = SUPPLYMAP_DATA_SOURCES.length - motieCount;

  return (
    <>
      <header className="mb-5 border border-line bg-white p-5 shadow-soft">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-cobalt">
            <Image src="/portmind-mark.png" alt="PortMind" width={22} height={22} className="h-5 w-5 rounded-sm object-cover" />
            <span>PORTMIND · SUPPLYMAP AI</span>
            <span className="rounded-full bg-[#eef5ff] px-2 py-0.5 text-[10px]">PUBLIC DATA SOURCING</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">SupplyMap AI</h1>
          <p className="mt-2 max-w-3xl text-base font-bold leading-7 text-ink">
            한국 공장과 해외 공장 베타(중국)를 품목 기준으로 비교하고, 인증·통관 리스크를 함께 확인합니다.
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            국내 공장은 한국산업단지공단·KOTRA·K-SURE 등 공공데이터 근거를 깊게 연결하고,
            중국 공장 레이어는 현재 확보된 베타 데이터로 품목군·지역 분포를 비교합니다.
          </p>
        </div>
        <div className="flex flex-col gap-3 lg:items-end">
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-line bg-line text-center text-[11px] font-bold">
            <div className="bg-white px-3 py-2"><Factory className="mx-auto mb-1 h-4 w-4 text-teal" />KR/CN 비교</div>
            <div className="bg-white px-3 py-2"><Database className="mx-auto mb-1 h-4 w-4 text-cobalt" />MOTIE {motieCount}</div>
            <div className="bg-white px-3 py-2"><ShieldCheck className="mx-auto mb-1 h-4 w-4 text-teal" />근거 추적</div>
          </div>
          <a href="#supplymap-judge-demo" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-cobalt px-4 text-sm font-bold text-white hover:bg-[#1d4788]">
            샘플 분석 시작 <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
          <SourceBadge sourceType="MOTIE_PUBLIC" />
          <SourceBadge sourceType="OTHER_PUBLIC" />
          <SourceBadge sourceType="PRIVATE" />
          <span className="rounded border border-line bg-panel px-2 py-0.5 text-[10px] font-bold text-muted">보조 데이터 {supportingCount}개</span>
        </div>
      </header>
      <SupplyMapWorkbench />
    </>
  );
}
