import { BadgeCheck, Database, ShieldCheck } from "lucide-react";

export function JudgeDemoBanner({
  active,
  enabled,
  currentStep,
  onEnabledChange,
  onLoadSample
}: {
  active?: boolean;
  enabled?: boolean;
  currentStep?: number;
  onEnabledChange?: (enabled: boolean) => void;
  onLoadSample?: () => void;
}) {
  const isActive = active ?? enabled ?? true;
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-line bg-[#eef6ff] px-4 py-3 text-xs">
      <div className="flex items-center gap-2 font-medium text-[#174a8b]">
        <BadgeCheck className="h-4 w-4" />
        샘플 데이터 모드 {isActive ? "ON" : "OFF"}
        {typeof currentStep === "number" ? <span className="text-muted">· Step {currentStep}/3</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-muted">
        <span className="inline-flex items-center gap-1">
          <Database className="h-3.5 w-3.5" />
          API 키 없이 재현 가능
        </span>
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5" />
          fallback·출처 상태 명시
        </span>
        {onEnabledChange ? (
          <button
            type="button"
            onClick={() => onEnabledChange(!isActive)}
            className="rounded-md border border-cobalt/20 bg-white px-2 py-1 font-semibold text-cobalt hover:bg-cobalt hover:text-white"
          >
            {isActive ? "샘플 모드" : "실시간 보강"}
          </button>
        ) : null}
        {onLoadSample ? (
          <button
            type="button"
            onClick={onLoadSample}
            className="rounded-md border border-line bg-white px-2 py-1 font-semibold text-ink hover:bg-panel"
          >
            샘플 불러오기
          </button>
        ) : null}
      </div>
    </div>
  );
}
