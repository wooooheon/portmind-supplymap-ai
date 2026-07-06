import fs from "node:fs";
import pLimit from "p-limit";
import { prisma } from "@/lib/db/prisma";
import { geocodeAddress } from "@/lib/geocoding/geocode";

const DEFAULT_LIMIT = Number(process.env.KAKAO_DOMESTIC_GEOCODE_LIMIT || 500);
const CONCURRENCY = Number(process.env.KAKAO_DOMESTIC_GEOCODE_CONCURRENCY || 3);

function loadEnvFile() {
  if (!fs.existsSync(".env")) return;
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

function cleanAddress(address?: string | null): string | null {
  if (!address) return null;
  return address
    .replace(/\(총\s*[0-9]+\s*필지\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  loadEnvFile();
  if (!process.env.KAKAO_REST_API_KEY) throw new Error("KAKAO_REST_API_KEY가 필요합니다.");

  const limit = Math.max(1, Math.min(5000, DEFAULT_LIMIT));
  const rows = await prisma.supplier.findMany({
    where: {
      scope: "DOMESTIC",
      latitude: null,
      longitude: null,
      address: { not: null }
    },
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      region: true
    },
    orderBy: { updatedAt: "asc" },
    take: limit
  });

  const limiter = pLimit(CONCURRENCY);
  let updated = 0;
  let notFound = 0;
  let failed = 0;

  await Promise.all(
    rows.map((row) =>
      limiter(async () => {
        const address = cleanAddress(row.address);
        if (!address) {
          notFound += 1;
          return;
        }
        try {
          const result = await geocodeAddress({
            address,
            country: "KR",
            city: row.city,
            keyword: row.name
          });
          if (!result) {
            notFound += 1;
            return;
          }
          await prisma.supplier.update({
            where: { id: row.id },
            data: {
              latitude: result.latitude,
              longitude: result.longitude,
              address: result.normalizedAddress ?? row.address
            }
          });
          updated += 1;
          console.log(`[KAKAO-GEOCODE] updated ${row.id} ${row.name}`);
        } catch (error) {
          failed += 1;
          console.warn(`[KAKAO-GEOCODE] failed ${row.id}: ${error instanceof Error ? error.message : "unknown"}`);
        }
      })
    )
  );

  const remaining = await prisma.supplier.count({
    where: { scope: "DOMESTIC", latitude: null, longitude: null, address: { not: null } }
  });
  const directCoords = await prisma.supplier.count({
    where: { scope: "DOMESTIC", latitude: { not: null }, longitude: { not: null } }
  });

  console.log(
    JSON.stringify(
      {
        queried: rows.length,
        updated,
        notFound,
        failed,
        directCoords,
        remainingWithoutCoords: remaining
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
