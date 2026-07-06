import { writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db/prisma";
import { getConnector } from "@/lib/connectors/registry";
import { dataPath, relativeToProject, ymd } from "@/lib/utils/paths";
import { persistNormalizedRecords } from "./persist";
import { toJson } from "@/lib/utils/json";

export async function runIngestion(sourceCode: string, params: Record<string, unknown> = {}) {
  const connector = getConnector(sourceCode);
  const run = await prisma.ingestionRun.create({
    data: {
      sourceCode,
      status: "RUNNING",
      paramsJson: toJson(params)
    }
  });

  try {
    const raw = await connector.fetchRaw(params);
    const normalized = await connector.normalize(raw);
    const today = ymd();
    const rawFilePath = await dataPath("raw", sourceCode, today, `${run.id}.json`);
    const normalizedFilePath = await dataPath("normalized", sourceCode, today, `${run.id}.jsonl`);

    await writeFile(rawFilePath, JSON.stringify(raw, null, 2), "utf8");
    await writeFile(
      normalizedFilePath,
      normalized.map((record) => JSON.stringify(record)).join("\n") + "\n",
      "utf8"
    );

    const recordCount = await persistNormalizedRecords(normalized);
    return prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        rawFilePath: relativeToProject(rawFilePath),
        normalizedFilePath: relativeToProject(normalizedFilePath),
        recordCount,
        finishedAt: new Date()
      }
    });
  } catch (error) {
    return prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.stack ?? error.message : String(error),
        finishedAt: new Date()
      }
    });
  }
}

export function normalizeCliArgs(argv: string[]): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      params[key] = true;
    } else {
      params[key] = next;
      index += 1;
    }
  }
  return params;
}

export function displayPath(filePath: string | null): string | null {
  return filePath ? path.normalize(filePath) : null;
}
