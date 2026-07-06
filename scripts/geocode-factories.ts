import { prisma } from "@/lib/db/prisma";
import { geocodeFactories } from "@/lib/geocoding/geocode";
import { normalizeCliArgs } from "@/lib/ingestion/run-ingestion";

async function main() {
  const args = normalizeCliArgs(process.argv.slice(2));
  const limit = Number(args.limit ?? 100);
  const updated = await geocodeFactories(limit);
  console.log(`Updated ${updated} factories.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
