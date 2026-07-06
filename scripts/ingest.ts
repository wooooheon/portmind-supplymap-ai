import { prisma } from "@/lib/db/prisma";
import { normalizeCliArgs, runIngestion } from "@/lib/ingestion/run-ingestion";

async function main() {
  const args = normalizeCliArgs(process.argv.slice(2));
  const source = String(args.source ?? "");
  if (!source) {
    throw new Error("Usage: pnpm data:ingest --source customs_hs_code [--query value]");
  }
  delete args.source;
  const run = await runIngestion(source, args);
  console.log(
    JSON.stringify(
      {
        id: run.id,
        sourceCode: run.sourceCode,
        status: run.status,
        recordCount: run.recordCount,
        rawFilePath: run.rawFilePath,
        normalizedFilePath: run.normalizedFilePath,
        errorMessage: run.errorMessage
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
