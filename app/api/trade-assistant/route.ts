import { NextResponse } from "next/server";
import { z } from "zod";
import { runTradeAssistant } from "@/lib/assistant/run-trade-assistant";

const bodySchema = z.object({
  prompt: z.string().min(4).max(4000)
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const result = await runTradeAssistant(body.prompt);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Trade assistant request failed" },
      { status: 400 }
    );
  }
}
