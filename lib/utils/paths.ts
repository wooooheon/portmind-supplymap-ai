import { mkdir } from "node:fs/promises";
import path from "node:path";

export const projectRoot = process.cwd();
export const dataRoot = path.join(projectRoot, "data");

export function ymd(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export async function dataPath(...parts: string[]): Promise<string> {
  const filePath = path.join(dataRoot, ...parts);
  await ensureDir(path.dirname(filePath));
  return filePath;
}

export function relativeToProject(filePath: string): string {
  return path.relative(projectRoot, filePath);
}
