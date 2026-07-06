import { NextResponse } from "next/server";
import { z } from "zod";
import { extractProductIntent } from "@/lib/supplymap/intent";
import { analyzeRisks } from "@/lib/supplymap/risk";

const bodySchema = z.object({
  productName: z.string().min(2).max(200),
  hsCode: z.string().max(20).optional(),
  importCountry: z.string().max(30).optional(),
  preferredRegion: z.string().max(40).optional()
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const intent = extractProductIntent(body);
    return NextResponse.json({ intent, signals: await analyzeRisks(intent) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "리스크 분석에 실패했습니다." },
      { status: 400 }
    );
  }
}
