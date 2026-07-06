import { NextResponse } from "next/server";
import { z } from "zod";
import { runTradeAssistant } from "@/lib/assistant/run-trade-assistant";
import { normalizeLlmProvider } from "@/lib/llm/providers";

const bodySchema = z.object({
  prompt: z.string().min(4).max(4000),
  llmProvider: z.enum(["deepseek", "openai"]).optional()
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const result = await runTradeAssistant(body.prompt, normalizeLlmProvider(body.llmProvider));
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Trade assistant request failed" },
      { status: 400 }
    );
  }
}
