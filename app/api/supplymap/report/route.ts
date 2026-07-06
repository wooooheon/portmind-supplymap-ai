import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeSupplyMap } from "@/lib/supplymap/analyze";
import { buildSupplyMapReport } from "@/lib/supplymap/report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z
  .object({
    productName: z.string().trim().min(2).max(200).optional(),
    query: z.string().trim().min(2).max(1200).optional(),
    prompt: z.string().trim().min(2).max(1200).optional(),
    hsCode: z
      .string()
      .trim()
      .regex(/^\d{4,10}$/, "hsCode must contain 4 to 10 digits")
      .optional(),
    importCountry: z.string().trim().min(2).max(80).optional(),
    targetCountry: z.string().trim().min(2).max(80).optional(),
    country: z.string().trim().min(2).max(80).optional(),
    preferredRegion: z.string().trim().min(2).max(80).optional(),
    judgeDemo: z.boolean().optional(),
    mode: z.enum(["mock", "hybrid"]).optional()
  })
  .refine((value) => Boolean(value.productName || value.query || value.prompt), {
    message: "productName, query, or prompt is required",
    path: ["productName"]
  });

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 본문은 유효한 JSON이어야 합니다." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "요청값을 확인해 주세요.",
        issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
      },
      { status: 400 }
    );
  }

  try {
    const productName = parsed.data.productName ?? parsed.data.query ?? parsed.data.prompt!;
    const analysis = await analyzeSupplyMap({
      productName,
      hsCode: parsed.data.hsCode,
      importCountry: parsed.data.importCountry ?? parsed.data.targetCountry ?? parsed.data.country,
      preferredRegion: parsed.data.preferredRegion,
      judgeDemo: parsed.data.judgeDemo ?? parsed.data.mode !== "hybrid"
    });
    const report = buildSupplyMapReport(analysis);

    return NextResponse.json({
      format: "json",
      pdfReady: false,
      nextFormats: ["pdf"],
      analysisId: analysis.analysisId,
      report
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "SupplyMap 리포트를 생성하지 못했습니다.",
        detail: error instanceof Error ? error.message : "확인 필요"
      },
      { status: 500 }
    );
  }
}
