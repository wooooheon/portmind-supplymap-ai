import { NextResponse } from "next/server";
import { z } from "zod";
import { findDomesticSupply } from "@/lib/supplymap/domestic";
import { extractProductIntent } from "@/lib/supplymap/intent";

const querySchema = z.object({
  productName: z.string().trim().min(2).max(200),
  hsCode: z
    .string()
    .trim()
    .max(20)
    .refine((value) => value.replace(/\D/g, "").length >= 4, "HS 코드는 숫자 4자리 이상이어야 합니다.")
    .optional(),
  importCountry: z.string().max(30).optional(),
  preferredRegion: z.string().max(40).optional()
});

async function respond(input: unknown) {
  try {
    const body = querySchema.parse(input);
    const intent = extractProductIntent(body);
    const result = await findDomesticSupply(intent);
    return NextResponse.json(
      {
        intent,
        filters: {
          product: body.productName,
          hsCode: body.hsCode ?? null,
          region: body.preferredRegion ?? "전국"
        },
        primarySourceType: "MOTIE_PUBLIC",
        ...result
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "국내 공급망 검색에 실패했습니다.",
        issues: error instanceof z.ZodError ? error.issues : undefined
      },
      { status: 400 }
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return respond({
    productName: url.searchParams.get("productName") ?? url.searchParams.get("product") ?? url.searchParams.get("q") ?? undefined,
    hsCode: url.searchParams.get("hsCode") ?? url.searchParams.get("hs") ?? undefined,
    importCountry: url.searchParams.get("importCountry") ?? undefined,
    preferredRegion: url.searchParams.get("preferredRegion") ?? url.searchParams.get("region") ?? undefined
  });
}

export async function POST(request: Request) {
  try {
    return respond(await request.json());
  } catch {
    return NextResponse.json({ error: "요청 본문은 유효한 JSON이어야 합니다." }, { status: 400 });
  }
}
