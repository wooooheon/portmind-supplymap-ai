import { NextResponse } from "next/server";
import { z } from "zod";
import { runTradeAssistantWithOptions } from "@/lib/assistant/run-trade-assistant";
import { normalizeLlmModel, normalizeLlmProvider, normalizeReasoningEffort } from "@/lib/llm/providers";

const bodySchema = z.object({
  prompt: z.string().min(4).max(4000),
  llmProvider: z.enum(["deepseek", "openai"]).optional(),
  model: z.string().trim().max(80).optional(),
  reasoningEffort: z.enum(["low", "medium", "high", "xhigh"]).optional()
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const provider = normalizeLlmProvider(body.llmProvider);
    const result = await runTradeAssistantWithOptions(body.prompt, {
      provider,
      model: normalizeLlmModel(provider, body.model),
      reasoningEffort: normalizeReasoningEffort(body.reasoningEffort)
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Trade assistant request failed" },
      { status: 400 }
    );
  }
}
