import { NextResponse } from "next/server";
import { importFactoriesFromCsv } from "@/lib/ingestion/import-factories";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
    }
    const text = await file.text();
    const result = await importFactoriesFromCsv(text);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Import failed" }, { status: 400 });
  }
}
