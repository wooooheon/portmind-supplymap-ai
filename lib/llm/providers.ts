export type LlmProvider = "deepseek" | "openai";

export type LlmReasoningEffort = "low" | "medium" | "high" | "xhigh";

export type LlmModelOption = {
  provider: LlmProvider;
  value: string;
  label: string;
  badge?: string;
  description: string;
};

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmChatResult = {
  answer: string;
  model: string;
  provider: LlmProvider;
  usedLLM: boolean;
  warning?: string;
};

export function normalizeLlmProvider(value: unknown): LlmProvider {
  return value === "openai" ? "openai" : "deepseek";
}

export function normalizeReasoningEffort(value: unknown): LlmReasoningEffort {
  return value === "low" || value === "high" || value === "xhigh" ? value : "medium";
}

export function providerDisplayName(provider: LlmProvider) {
  return provider === "openai" ? "ChatGPT" : "DeepSeek";
}

export const llmModelOptions: LlmModelOption[] = [
  {
    provider: "deepseek",
    value: "deepseek-v4-flash",
    label: "deepseek-v4-flash",
    badge: "최신 기본",
    description: "DeepSeek V4 Flash. 비사고/사고 모드를 모두 지원하는 기본 모델입니다."
  },
  {
    provider: "deepseek",
    value: "deepseek-v4-pro",
    label: "deepseek-v4-pro",
    badge: "고성능",
    description: "DeepSeek V4 Pro. 더 높은 품질이 필요할 때 사용합니다."
  },
  {
    provider: "deepseek",
    value: "deepseek-chat",
    label: "deepseek-chat",
    badge: "호환",
    description: "기존 호환 모델명입니다. DeepSeek V4 Flash의 비사고 모드에 대응합니다."
  },
  {
    provider: "deepseek",
    value: "deepseek-reasoner",
    label: "deepseek-reasoner",
    badge: "호환 사고",
    description: "기존 호환 모델명입니다. DeepSeek V4 Flash의 사고 모드에 대응합니다."
  },
  {
    provider: "openai",
    value: "gpt-5.5",
    label: "gpt-5.5",
    badge: "기본",
    description: "ChatGPT 계열 추론 모델의 기본 선택입니다."
  },
  {
    provider: "openai",
    value: "gpt-5.5-pro",
    label: "gpt-5.5-pro",
    badge: "최고지능",
    description: "복잡한 공급망 판단에 더 많은 지연 시간을 허용할 때 사용합니다."
  },
  {
    provider: "openai",
    value: "gpt-5.4",
    label: "gpt-5.4",
    badge: "균형",
    description: "품질과 비용을 균형 있게 맞출 때 사용합니다."
  },
  {
    provider: "openai",
    value: "gpt-5.4-mini",
    label: "gpt-5.4-mini",
    badge: "빠름",
    description: "낮은 비용과 짧은 지연 시간이 중요할 때 사용합니다."
  }
];

export function modelOptionsForProvider(provider: LlmProvider) {
  return llmModelOptions.filter((option) => option.provider === provider);
}

export function defaultModelForProvider(provider: LlmProvider) {
  return provider === "openai" ? "gpt-5.5" : "deepseek-v4-flash";
}

export function normalizeLlmModel(provider: LlmProvider, value: unknown) {
  const model = typeof value === "string" ? value.trim() : "";
  if (modelOptionsForProvider(provider).some((option) => option.value === model)) return model;
  return defaultModelForProvider(provider);
}

function configuredProvider(provider: LlmProvider, requestedModel?: string) {
  if (provider === "openai") {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      model: requestedModel ? normalizeLlmModel(provider, requestedModel) : process.env.OPENAI_MODEL || defaultModelForProvider(provider)
    };
  }
  return {
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: requestedModel ? normalizeLlmModel(provider, requestedModel) : process.env.DEEPSEEK_MODEL || defaultModelForProvider(provider)
  };
}

function extractOpenAIText(payload: unknown): string | undefined {
  const data = payload as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        text?: string;
        type?: string;
      }>;
    }>;
  };
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  const chunks = data.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter((text): text is string => Boolean(text?.trim()));
  const text = chunks?.join("\n").trim();
  return text || undefined;
}

function openAiOutputBudget(requestedMaxTokens: number, reasoningEffort: LlmReasoningEffort) {
  if (reasoningEffort === "high") return Math.max(requestedMaxTokens, 12_000);
  if (reasoningEffort === "medium") return Math.max(requestedMaxTokens, 7_000);
  return Math.max(requestedMaxTokens, 3_500);
}

function openAiReasoningEffort(reasoningEffort: LlmReasoningEffort) {
  // xhigh is intended for hardest asynchronous workloads. This app needs a
  // synchronous answer inside Vercel's request window, so Max uses high.
  return reasoningEffort === "xhigh" ? "high" : reasoningEffort;
}

function effectiveTimeoutMs(provider: LlmProvider, model: string, reasoningEffort: LlmReasoningEffort, requestedTimeoutMs: number) {
  if (provider !== "openai") return requestedTimeoutMs;
  if (model.includes("pro")) return Math.max(requestedTimeoutMs, 55_000);
  if (reasoningEffort === "high") return Math.max(requestedTimeoutMs, 50_000);
  return Math.max(requestedTimeoutMs, 45_000);
}

export async function callLlmProviderChat(args: {
  provider: LlmProvider;
  messages: LlmMessage[];
  model?: string;
  reasoningEffort?: LlmReasoningEffort;
  maxTokens: number;
  timeoutMs: number;
  fallback: (warning: string, provider: LlmProvider) => LlmChatResult;
}): Promise<LlmChatResult> {
  const { apiKey, model } = configuredProvider(args.provider, args.model);
  const reasoningEffort = normalizeReasoningEffort(args.reasoningEffort);
  if (!apiKey) {
    return args.fallback(`${providerDisplayName(args.provider)} API key is not configured.`, args.provider);
  }

  const controller = new AbortController();
  const timeoutMs = effectiveTimeoutMs(args.provider, model, reasoningEffort, args.timeoutMs);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (args.provider === "openai") {
      const effectiveReasoningEffort = openAiReasoningEffort(reasoningEffort);
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          input: args.messages,
          reasoning: { effort: effectiveReasoningEffort },
          max_output_tokens: openAiOutputBudget(args.maxTokens, effectiveReasoningEffort)
        })
      });

      if (!response.ok) {
        const text = await response.text();
        return args.fallback(`OpenAI HTTP ${response.status}: ${text.slice(0, 240)}`, args.provider);
      }

      const data = await response.json();
      const answer = extractOpenAIText(data);
      if (!answer) {
        const status = typeof data?.status === "string" ? data.status : "unknown";
        const incompleteReason =
          data?.incomplete_details && typeof data.incomplete_details === "object" && "reason" in data.incomplete_details
            ? String(data.incomplete_details.reason)
            : undefined;
        return args.fallback(
          incompleteReason
            ? `OpenAI returned no visible answer. status=${status}, reason=${incompleteReason}.`
            : `OpenAI returned an empty response. status=${status}.`,
          args.provider
        );
      }
      return {
        answer,
        model: typeof data?.model === "string" ? data.model : model,
        provider: args.provider,
        usedLLM: true
      };
    }

    const deepSeekThinking =
      model === "deepseek-reasoner" || (model !== "deepseek-chat" && reasoningEffort !== "low");
    const deepSeekBody: Record<string, unknown> = {
      model,
      messages: args.messages,
      max_tokens: args.maxTokens,
      thinking: { type: deepSeekThinking ? "enabled" : "disabled" }
    };
    if (deepSeekThinking) {
      deepSeekBody.reasoning_effort = reasoningEffort === "xhigh" ? "max" : "high";
    } else {
      deepSeekBody.temperature = 0.1;
    }

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(deepSeekBody)
    });

    if (!response.ok) {
      const text = await response.text();
      return args.fallback(`DeepSeek HTTP ${response.status}: ${text.slice(0, 240)}`, args.provider);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };
    const answer = data.choices?.[0]?.message?.content?.trim();
    if (!answer) return args.fallback("DeepSeek returned an empty response.", args.provider);
    return {
      answer,
      model: data.model ?? model,
      provider: args.provider,
      usedLLM: true
    };
  } catch (error) {
    return args.fallback(
      error instanceof Error && error.name === "AbortError"
        ? `${providerDisplayName(args.provider)} timed out after ${Math.round(timeoutMs / 1000)}s.`
        : error instanceof Error
          ? error.message
          : `${providerDisplayName(args.provider)} request failed.`,
      args.provider
    );
  } finally {
    clearTimeout(timeout);
  }
}
