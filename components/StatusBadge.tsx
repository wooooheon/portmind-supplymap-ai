import type { RiskLevel } from "@prisma/client";

export function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const className =
    normalized === "success" || normalized === "implemented" || normalized === "low"
      ? "border-teal/20 bg-teal/10 text-teal"
      : normalized === "failed" || normalized === "high" || normalized === "critical"
        ? "border-danger/20 bg-danger/10 text-danger"
        : normalized === "running" || normalized === "medium"
          ? "border-amber/20 bg-amber/10 text-amber"
          : "border-line bg-panel text-muted";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}>{value}</span>;
}

export function RiskBadge({ value }: { value: RiskLevel }) {
  return <StatusBadge value={value} />;
}
