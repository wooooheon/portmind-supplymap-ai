import { buildPromptAugmentation } from "./prompt-augmentation";
import type { TradeAssistantResponse } from "./types";
import { callLlmProviderChat, type LlmChatResult, type LlmProvider, type LlmReasoningEffort } from "@/lib/llm/providers";

function fallbackAnswer(
  prompt: string,
  augmentation: Awaited<ReturnType<typeof buildPromptAugmentation>>,
  warning: string,
  provider: LlmProvider
): LlmChatResult {
  const topEvidence = augmentation.evidences
    .slice(0, 8)
    .map((evidence, index) => `${index + 1}. [${evidence.evidenceType}/${evidence.sourceCode}] ${evidence.summary}`)
    .join("\n");

  return {
    model: "fallback",
    provider,
    usedLLM: false,
    warning,
    answer: [
      "요청하신 내용을 기준으로 먼저 확인할 수 있는 범위를 정리했습니다.",
      "",
      `대상 조건은 ${augmentation.intent.country ? `국가 ${augmentation.intent.country}` : "국가 미지정"}, ${
        augmentation.intent.hsCode ? `HS ${augmentation.intent.hsCode}` : "HS 코드 추가 확인 필요"
      }, 키워드 ${augmentation.intent.productTerms.join(", ") || "추가 확인 필요"}로 보입니다.`,
      "",
      topEvidence
        ? `현재 연결된 데이터에서 우선 참고할 만한 항목은 다음입니다.\n${topEvidence}`
        : "현재 질문만으로는 특정 공장 후보를 단정하기보다 제품명, 용도, HS 코드, 목표 국가를 좁혀서 후보를 추리는 방식이 적합합니다.",
      "",
      "추천 흐름은 1) 제품명/HS 코드 확정, 2) 수입요건과 인증 대상 확인, 3) 후보 공장 주소·품목·등록상태 대조, 4) 리콜/중단/부적합 이력 확인 순서입니다. 최종 수입 가능 여부는 관세사·시험인증기관 확인이 필요합니다."
    ].join("\n")
  };
}

export async function runTradeAssistant(prompt: string, provider: LlmProvider = "deepseek"): Promise<TradeAssistantResponse> {
  return runTradeAssistantWithOptions(prompt, { provider });
}

export async function runTradeAssistantWithOptions(
  prompt: string,
  options: {
    provider?: LlmProvider;
    model?: string;
    reasoningEffort?: LlmReasoningEffort;
  } = {}
): Promise<TradeAssistantResponse> {
  const provider = options.provider ?? "deepseek";
  const augmentation = await buildPromptAugmentation(prompt);
  const system = [
    "You are a Korean trade intelligence analyst for import buyers.",
    "Write like a polished B2B sourcing analyst, not like a database debugger.",
    "Use supplied context as evidence, but do not expose rough phrases such as 'DB has no data', 'No matching evidence found', 'unknown', or connector failure details in the main answer.",
    "If evidence is limited, phrase it naturally as '현재 확인된 범위에서는' and provide the next verification path.",
    "If matched factories are listed in context, treat them as the primary candidates and mention 2-4 relevant candidates by name with location/category match reasons. Do not say there is no direct registered factory when matched factories are present.",
    "Separate official/public API evidence, user-provided/database evidence, and inference in a reader-friendly way.",
    "Never claim a factory is government-certified safe.",
    "Use the phrase '공식 공개 데이터와 사용자가 제공한 자료를 기준으로 확인된 정보' when summarizing evidence.",
    "Treat unverified as '추가 확인 필요', not as safe or problem-free.",
    "Do not replace legal, customs, product safety, or certification review.",
    "Answer in Korean with actionable next steps.",
    "Keep the answer concise, smooth, and commercially useful. Avoid raw JSON/API field names unless the user asks for them."
  ].join("\n");

  const user = [
    "사용자 질문:",
    prompt,
    "",
    "수집/정규화된 컨텍스트:",
    augmentation.contextText,
    "",
    "요청:",
    "1. 한 문장으로 결론",
    "2. 매칭된 공장 후보가 있으면 후보명과 매칭 이유를 자연스럽게 설명",
    "3. 수입/인증/통관 관점의 확인사항",
    "4. 리스크와 추가 확인 항목",
    "5. 다음 액션 체크리스트"
  ].join("\n");

  const llm = await callLlmProviderChat({
    provider,
    model: options.model,
    reasoningEffort: options.reasoningEffort,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    maxTokens: 1800,
    timeoutMs: 45_000,
    fallback: (warning, fallbackProvider) => fallbackAnswer(prompt, augmentation, warning, fallbackProvider)
  });
  const warnings = [...augmentation.intent.warnings, ...(llm.warning ? [llm.warning] : [])];

  return {
    answer: llm.answer,
    model: llm.model,
    provider: llm.provider,
    reasoningEffort: options.reasoningEffort,
    usedLLM: llm.usedLLM,
    intent: augmentation.intent,
    evidences: augmentation.evidences,
    matchedFactories: augmentation.matchedFactories,
    augmentedPrompt: augmentation.contextText,
    warnings
  };
}
