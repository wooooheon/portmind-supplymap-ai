import type { SupplySourceType } from "@/lib/supplymap/types";

const sourceTypeStyles: Record<SupplySourceType, string> = {
  MOTIE_PUBLIC: "border-cobalt/30 bg-[#eef5ff] text-cobalt",
  OTHER_PUBLIC: "border-teal/30 bg-[#edf8f6] text-teal",
  PRIVATE: "border-amber/30 bg-[#fff8e8] text-amber",
  USER_UPLOAD: "border-line bg-panel text-ink"
};

const sourceTypeLabels: Record<SupplySourceType, string> = {
  MOTIE_PUBLIC: "MOTIE_PUBLIC",
  OTHER_PUBLIC: "OTHER_PUBLIC",
  PRIVATE: "PRIVATE",
  USER_UPLOAD: "USER_UPLOAD"
};

export function SourceBadge({
  sourceType,
  compact = false
}: {
  sourceType: SupplySourceType;
  compact?: boolean;
}) {
  return (
    <span
      className={
        "inline-flex w-fit items-center rounded border font-bold " +
        sourceTypeStyles[sourceType] +
        (compact ? " px-1.5 py-0.5 text-[9px]" : " px-2 py-0.5 text-[10px]")
      }
    >
      {compact ? sourceTypeLabels[sourceType].replace("_PUBLIC", "") : sourceTypeLabels[sourceType]}
    </span>
  );
}
