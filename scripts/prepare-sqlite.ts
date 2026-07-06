import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function readDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(process.cwd(), ".env");
  if (!existsSync(envPath)) return "file:./dev.db";
  const env = String(readFileSync(envPath));
  const line = env
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item.startsWith("DATABASE_URL="));
  return line?.split("=").slice(1).join("=").replace(/^"|"$/g, "") ?? "file:./dev.db";
}

const databaseUrl = readDatabaseUrl();

if (!databaseUrl.startsWith("file:")) {
  console.log("DATABASE_URL is not SQLite; no local DB file needed.");
  process.exit(0);
}

const rawPath = databaseUrl.replace(/^file:/, "");
const dbPath = path.isAbsolute(rawPath) ? rawPath : path.join(process.cwd(), "prisma", rawPath);

if (!existsSync(dbPath)) {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  writeFileSync(dbPath, "");
  console.log(`Created ${path.relative(process.cwd(), dbPath)}`);
} else {
  console.log(`${path.relative(process.cwd(), dbPath)} already exists`);
}
