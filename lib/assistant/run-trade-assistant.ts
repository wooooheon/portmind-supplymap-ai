import { buildPromptAugmentation } from "./prompt-augmentation";
import type { TradeAssistantResponse } from "./types";
import { callDeepSeekChat } from "@/lib/llm/deepseek";

export async function runTradeAssistant(prompt: string): Promise<TradeAssistantResponse> {
  const augmentation = await buildPromptAugmentation(prompt);
  const llm = await callDeepSeekChat({
    prompt,
    contextText: augmentation.contextText,
    intent: augmentation.intent,
    evidences: augmentation.evidences
  });
  const warnings = [...augmentation.intent.warnings, ...(llm.warning ? [llm.warning] : [])];

  return {
    answer: llm.answer,
    model: llm.model,
    usedLLM: llm.usedLLM,
    intent: augmentation.intent,
    evidences: augmentation.evidences,
    matchedFactories: augmentation.matchedFactories,
    augmentedPrompt: augmentation.contextText,
    warnings
  };
}
