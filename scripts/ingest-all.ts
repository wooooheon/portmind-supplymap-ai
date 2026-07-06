import { prisma } from "@/lib/db/prisma";
import { API_SOURCE_DEFINITIONS } from "@/lib/connectors/source-definitions";
import { runIngestion } from "@/lib/ingestion/run-ingestion";

async function main() {
  const implemented = API_SOURCE_DEFINITIONS.filter((source) => source.status === "implemented");
  for (const source of implemented) {
    const run = await runIngestion(source.code, { mock: process.env.MOCK_CONNECTORS !== "false" });
    console.log(`${source.code}: ${run.status} (${run.recordCount})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
