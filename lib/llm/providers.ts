export type LlmProvider = "deepseek" | "openai";

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

export function providerDisplayName(provider: LlmProvider) {
  return provider === "openai" ? "ChatGPT" : "DeepSeek";
}

function configuredProvider(provider: LlmProvider) {
  if (provider === "openai") {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || "gpt-5-mini"
    };
  }
  return {
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat"
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

export async function callLlmProviderChat(args: {
  provider: LlmProvider;
  messages: LlmMessage[];
  maxTokens: number;
  timeoutMs: number;
  fallback: (warning: string, provider: LlmProvider) => LlmChatResult;
}): Promise<LlmChatResult> {
  const { apiKey, model } = configuredProvider(args.provider);
  if (!apiKey) {
    return args.fallback(`${providerDisplayName(args.provider)} API key is not configured.`, args.provider);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);

  try {
    if (args.provider === "openai") {
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
          max_output_tokens: args.maxTokens
        })
      });

      if (!response.ok) {
        const text = await response.text();
        return args.fallback(`OpenAI HTTP ${response.status}: ${text.slice(0, 240)}`, args.provider);
      }

      const data = await response.json();
      const answer = extractOpenAIText(data);
      if (!answer) return args.fallback("OpenAI returned an empty response.", args.provider);
      return {
        answer,
        model: typeof data?.model === "string" ? data.model : model,
        provider: args.provider,
        usedLLM: true
      };
    }

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: args.messages,
        temperature: 0.1,
        max_tokens: args.maxTokens
      })
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
      error instanceof Error ? error.message : `${providerDisplayName(args.provider)} request failed.`,
      args.provider
    );
  } finally {
    clearTimeout(timeout);
  }
}
