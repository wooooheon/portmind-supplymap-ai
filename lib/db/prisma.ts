import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

function prepareVercelSqlite() {
  if (!process.env.VERCEL) return;
  if (!process.env.DATABASE_URL?.startsWith("file:")) return;

  const bundledDbPath = path.join(process.cwd(), "prisma", "dev.db");
  if (!existsSync(bundledDbPath)) return;

  const runtimeDir = path.join(tmpdir(), "supplymap-ai");
  const runtimeDbPath = path.join(runtimeDir, "dev.db");
  mkdirSync(runtimeDir, { recursive: true });

  const bundledStats = statSync(bundledDbPath);
  const shouldCopy =
    !existsSync(runtimeDbPath) ||
    statSync(runtimeDbPath).size !== bundledStats.size ||
    statSync(runtimeDbPath).mtimeMs < bundledStats.mtimeMs;

  if (shouldCopy) {
    const tempPath = path.join(runtimeDir, `dev-${process.pid}.db.tmp`);
    copyFileSync(bundledDbPath, tempPath);
    copyFileSync(tempPath, runtimeDbPath);
  }

  process.env.DATABASE_URL = `file:${runtimeDbPath}`;
}

prepareVercelSqlite();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["warn", "error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
