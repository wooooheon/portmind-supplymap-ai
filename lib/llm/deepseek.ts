import type { AssistantEvidence, TradeAssistantIntent } from "@/lib/assistant/types";

export type DeepSeekMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type DeepSeekResult = {
  answer: string;
  model: string;
  usedLLM: boolean;
  warning?: string;
};

function fallbackAnswer(prompt: string, intent: TradeAssistantIntent, evidences: AssistantEvidence[], warning: string): DeepSeekResult {
  const topEvidence = evidences
    .slice(0, 8)
    .map((evidence, index) => `${index + 1}. [${evidence.evidenceType}/${evidence.sourceCode}] ${evidence.summary}`)
    .join("\n");

  return {
    model: "fallback",
    usedLLM: false,
    warning,
    answer: [
      "요청하신 내용을 기준으로 먼저 확인할 수 있는 범위를 정리했습니다.",
      "",
      `대상 조건은 ${intent.country ? `국가 ${intent.country}` : "국가 미지정"}, ${intent.hsCode ? `HS ${intent.hsCode}` : "HS 코드 추가 확인 필요"}, 키워드 ${
        intent.productTerms.join(", ") || "추가 확인 필요"
      }로 보입니다.`,
      "",
      topEvidence
        ? `현재 연결된 데이터에서 우선 참고할 만한 항목은 다음입니다.\n${topEvidence}`
        : "현재 질문만으로는 특정 공장 후보를 단정하기보다 제품명, 용도, HS 코드, 목표 국가를 좁혀서 후보를 추리는 방식이 적합합니다.",
      "",
      "추천 흐름은 1) 제품명/HS 코드 확정, 2) 수입요건과 인증 대상 확인, 3) 후보 공장 주소·품목·등록상태 대조, 4) 리콜/중단/부적합 이력 확인 순서입니다. 최종 수입 가능 여부는 관세사·시험인증기관 확인이 필요합니다."
    ].join("\n")
  };
}

export async function callDeepSeekChat(args: {
  prompt: string;
  contextText: string;
  intent: TradeAssistantIntent;
  evidences: AssistantEvidence[];
}): Promise<DeepSeekResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

  if (!apiKey) {
    return fallbackAnswer(args.prompt, args.intent, args.evidences, "DEEPSEEK_API_KEY is not configured.");
  }

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
    args.prompt,
    "",
    "수집/정규화된 컨텍스트:",
    args.contextText,
    "",
    "요청:",
    "1. 한 문장으로 결론",
    "2. 매칭된 공장 후보가 있으면 후보명과 매칭 이유를 자연스럽게 설명",
    "3. 수입/인증/통관 관점의 확인사항",
    "4. 리스크와 추가 확인 항목",
    "5. 다음 액션 체크리스트"
  ].join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ] satisfies DeepSeekMessage[],
        temperature: 0.2,
        max_tokens: 1800
      })
    });

    if (!response.ok) {
      const text = await response.text();
      return fallbackAnswer(args.prompt, args.intent, args.evidences, `DeepSeek HTTP ${response.status}: ${text.slice(0, 240)}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };
    const answer = data.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      return fallbackAnswer(args.prompt, args.intent, args.evidences, "DeepSeek returned an empty response.");
    }

    return {
      answer,
      model: data.model ?? model,
      usedLLM: true
    };
  } catch (error) {
    return fallbackAnswer(
      args.prompt,
      args.intent,
      args.evidences,
      error instanceof Error ? error.message : "DeepSeek request failed."
    );
  } finally {
    clearTimeout(timeout);
  }
}
