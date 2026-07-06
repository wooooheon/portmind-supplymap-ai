import { NextResponse } from "next/server";
import { z } from "zod";
import { findGlobalSupply } from "@/lib/supplymap/global";
import { extractProductIntent } from "@/lib/supplymap/intent";

const querySchema = z.object({
  productName: z.string().min(2).max(200),
  hsCode: z.string().max(20).optional(),
  importCountry: z.string().max(30).optional(),
  preferredRegion: z.string().max(40).optional(),
  judgeDemo: z.boolean().optional().default(false),
  topK: z.number().int().min(1).max(20).optional()
});

export async function POST(request: Request) {
  try {
    const body = querySchema.parse(await request.json());
    const intent = extractProductIntent(body);
    const result = await findGlobalSupply(intent, { forceFallback: body.judgeDemo, topK: body.topK });
    return NextResponse.json({ intent, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "해외 공급망 검색에 실패했습니다." },
      { status: 400 }
    );
  }
}
