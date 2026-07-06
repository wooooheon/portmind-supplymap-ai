import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { dataRoot, projectRoot } from "@/lib/utils/paths";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const relativePath = searchParams.get("path");
  if (!relativePath) return NextResponse.json({ error: "Missing path" }, { status: 400 });

  const absolutePath = path.resolve(projectRoot, relativePath);
  const allowedRoot = path.resolve(dataRoot, "exports");
  if (!absolutePath.startsWith(allowedRoot)) {
    return NextResponse.json({ error: "Invalid export path" }, { status: 400 });
  }

  const bytes = await readFile(absolutePath);
  const filename = path.basename(absolutePath);
  return new NextResponse(bytes, {
    headers: {
      "content-type": filename.endsWith(".csv")
        ? "text/csv; charset=utf-8"
        : filename.endsWith(".jsonl")
          ? "application/x-ndjson; charset=utf-8"
          : "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`
    }
  });
}
