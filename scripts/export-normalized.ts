import { prisma } from "@/lib/db/prisma";
import { exportEntity, listExportEntities } from "@/lib/exporters/export";
import { normalizeCliArgs } from "@/lib/ingestion/run-ingestion";

async function main() {
  const args = normalizeCliArgs(process.argv.slice(2));
  const entity = String(args.entity ?? "factories");
  const format = String(args.format ?? "csv");
  if (!listExportEntities().includes(entity as never)) {
    throw new Error(`Unsupported entity ${entity}`);
  }
  if (!["csv", "jsonl", "json"].includes(format)) {
    throw new Error(`Unsupported format ${format}`);
  }
  const file = await exportEntity(entity as never, format as never);
  console.log(JSON.stringify(file, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
