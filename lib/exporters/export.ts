import { writeFile } from "node:fs/promises";
import { stringify } from "csv-stringify/sync";
import { prisma } from "@/lib/db/prisma";
import { dataPath, relativeToProject } from "@/lib/utils/paths";

type ExportEntity = "factories" | "certificates" | "risk_events" | "trade_requirements" | "products" | "evidences";
type ExportFormat = "csv" | "jsonl" | "json";

const entityNames: ExportEntity[] = [
  "factories",
  "certificates",
  "risk_events",
  "trade_requirements",
  "products",
  "evidences"
];

export function listExportEntities(): ExportEntity[] {
  return entityNames;
}

async function readRows(entity: ExportEntity): Promise<Record<string, unknown>[]> {
  if (entity === "factories") {
    return prisma.factory.findMany({
      orderBy: { updatedAt: "desc" },
      include: { products: true, certificates: true, riskEvents: true }
    }) as Promise<Record<string, unknown>[]>;
  }
  if (entity === "certificates") return prisma.certificate.findMany() as Promise<Record<string, unknown>[]>;
  if (entity === "risk_events") return prisma.riskEvent.findMany() as Promise<Record<string, unknown>[]>;
  if (entity === "trade_requirements") return prisma.tradeRequirement.findMany() as Promise<Record<string, unknown>[]>;
  if (entity === "products") return prisma.product.findMany() as Promise<Record<string, unknown>[]>;
  return prisma.evidence.findMany() as Promise<Record<string, unknown>[]>;
}

function flattenForCsv(row: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) {
      output[key] = value.toISOString();
    } else if (Array.isArray(value) || (value && typeof value === "object")) {
      output[key] = JSON.stringify(value);
    } else {
      output[key] = value ?? "";
    }
  }
  return output;
}

export async function exportEntity(entity: ExportEntity, format: ExportFormat) {
  const rows = await readRows(entity);
  const filePath = await dataPath("exports", `${entity}.${format}`);
  let content: string;

  if (format === "csv") {
    content = stringify(rows.map(flattenForCsv), { header: true });
  } else if (format === "jsonl") {
    content = rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
  } else {
    content = JSON.stringify(rows, null, 2);
  }

  await writeFile(filePath, content, "utf8");
  const saved = await prisma.exportFile.create({
    data: {
      fileType: format.toUpperCase() as "CSV" | "JSONL" | "JSON",
      entityType: entity,
      filePath: relativeToProject(filePath),
      recordCount: rows.length
    }
  });

  return saved;
}
