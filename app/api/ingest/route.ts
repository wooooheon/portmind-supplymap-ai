import { NextResponse } from "next/server";
import { z } from "zod";
import { runIngestion } from "@/lib/ingestion/run-ingestion";

const bodySchema = z.object({
  sourceCode: z.string().min(1),
  params: z.record(z.unknown()).default({})
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const run = await runIngestion(body.sourceCode, body.params);
    const status = run.status === "FAILED" ? 500 : 200;
    return NextResponse.json(
      {
        id: run.id,
        sourceCode: run.sourceCode,
        status: run.status,
        recordCount: run.recordCount,
        rawFilePath: run.rawFilePath,
        normalizedFilePath: run.normalizedFilePath,
        errorMessage: run.errorMessage
      },
      { status }
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 });
  }
}
