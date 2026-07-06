"use client";

import Link from "next/link";
import { Bot, Brain, Building2, CheckCircle2, ChevronDown, DatabaseZap, MapPinned, RefreshCw, Send, Sparkles, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  defaultModelForProvider,
  modelOptionsForProvider,
  type LlmProvider,
  type LlmReasoningEffort
} from "@/lib/llm/providers";
import type { EvidenceRecord } from "@/lib/supplymap/types";

type MatchedFactory = {
  id: string;
  name: string;
  country: string;
  province?: string | null;
  city?: string | null;
  address?: string | null;
  category?: string | null;
  feature?: string | null;
  sourceCode?: string | null;
  riskLevel: string;
  importReadinessScore: number;
  geocodeConfidence?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  matchReason: string;
};

type AssistantResult = {
  answer: string;
  model?: string;
  provider?: LlmProvider;
  reasoningEffort?: LlmReasoningEffort;
  usedLLM?: boolean;
  confidence?: number;
  needsVerification?: boolean;
  intent?: {
    hsCode?: string;
    country?: string;
    productTerms: string[];
    locationTerms: string[];
    selectedSources: string[];
  };
  evidences: Array<{
    title: string;
    sourceCode: string;
    evidenceType: string;
    summary: string;
    url?: string;
  }>;
  matchedFactories: MatchedFactory[];
  evidenceRecords?: EvidenceRecord[];
  augmentedPrompt?: string;
  warnings: string[];
};

type LlmRequestConfig = {
  provider: LlmProvider;
  model: string;
  reasoningEffort: LlmReasoningEffort;
};

type GenerationStep = {
  label: string;
  status: "pending" | "active" | "done";
};

type GenerationTrace = {
  provider: LlmProvider;
  model: string;
  reasoningEffort: LlmReasoningEffort;
  state: "thinking" | "answering" | "done";
  steps: GenerationStep[];
  dataSummary: string[];
  evidenceTitles: string[];
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  meta?: string;
  factories?: MatchedFactory[];
  evidenceIds?: string[];
  trace?: GenerationTrace;
  isTyping?: boolean;
};

type TradeAssistantFormProps = {
  endpoint?: string;
  title?: string;
  subtitle?: string;
  welcomeMessage?: string;
  examples?: string[];
  placeholder?: string;
  submitLabel?: string;
  buildRequestBody?: (prompt: string, config: LlmRequestConfig) => unknown;
  normalizeResult?: (payload: unknown) => AssistantResult;
  onEvidenceRecords?: (evidence: EvidenceRecord[]) => void;
  onOpenEvidence?: (id: string) => void;
  showMatchedFactories?: boolean;
  showSidePanel?: boolean;
  className?: string;
};

const defaultExamples = [
  "중국에서 블루투스 스피커를 수입하려고 해. HS코드, KC/RRA, 리콜 리스크, 공장 확인 포인트를 정리해줘.",
  "HS 330499 화장품을 중국 OEM 공장에서 수입할 때 수입요건과 리스크를 확인해줘.",
  "의료기기 체온계를 중국 공장에서 들여오려는데 MFDS 품목허가와 확인해야 할 자료를 알려줘.",
  "제습기 수입 전 에너지소비효율등급과 대기전력 관련 확인사항을 정리해줘."
];

const providerOptions: Array<{ value: LlmProvider; label: string }> = [
  { value: "deepseek", label: "DeepSeek" },
  { value: "openai", label: "ChatGPT" }
];

const reasoningOptions: Array<{ value: LlmReasoningEffort; label: string; compact: string }> = [
  { value: "low", label: "빠르게", compact: "Low" },
  { value: "medium", label: "균형", compact: "Med" },
  { value: "high", label: "깊게", compact: "High" },
  { value: "xhigh", label: "최대로", compact: "Max" }
];

function providerLabel(provider: LlmProvider) {
  return providerOptions.find((item) => item.value === provider)?.label ?? provider;
}

function reasoningLabel(value: LlmReasoningEffort) {
  return reasoningOptions.find((item) => item.value === value)?.label ?? value;
}

const traceStepLabels = ["질문 의도 분석", "공장 DB/후보 조회", "인증·통관·리스크 근거 연결", "LLM 입력 구성", "답변 생성"];

function traceSteps(activeIndex: number, done = false): GenerationStep[] {
  return traceStepLabels.map((label, index) => ({
    label,
    status: done || index < activeIndex ? "done" : index === activeIndex ? "active" : "pending"
  }));
}

function initialTrace(config: LlmRequestConfig): GenerationTrace {
  return {
    provider: config.provider,
    model: config.model,
    reasoningEffort: config.reasoningEffort,
    state: "thinking",
    steps: traceSteps(0),
    dataSummary: ["질문 텍스트", "제품/HS 후보", "공장·인증·통관 근거"],
    evidenceTitles: []
  };
}

function completedTrace(body: AssistantResult, config: LlmRequestConfig, state: GenerationTrace["state"]): GenerationTrace {
  const sources = body.intent?.selectedSources ?? [];
  const dataSummary = [
    `공장 후보 ${body.matchedFactories?.length ?? 0}개`,
    `근거 ${body.evidences?.length ?? 0}개`,
    body.intent?.hsCode ? `HS ${body.intent.hsCode}` : "HS 확인 필요",
    body.intent?.country ? `국가 ${body.intent.country}` : "국가 미지정",
    ...sources.slice(0, 4)
  ];
  return {
    provider: body.provider ?? config.provider,
    model: body.model ?? config.model,
    reasoningEffort: body.reasoningEffort ?? config.reasoningEffort,
    state,
    steps: traceSteps(traceStepLabels.length, true),
    dataSummary: Array.from(new Set(dataSummary)),
    evidenceTitles: body.evidences?.slice(0, 5).map((item) => `${item.evidenceType} · ${item.title}`) ?? []
  };
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function factoryLocation(factory: MatchedFactory) {
  return [factory.country, factory.province, factory.city].filter(Boolean).join(" / ");
}

function factoryConfidence(factory: MatchedFactory) {
  if (factory.geocodeConfidence === null || factory.geocodeConfidence === undefined) return "좌표 확인 필요";
  return `${Math.round(factory.geocodeConfidence * 100)}%`;
}

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={`${part}-${index}`} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        )
      )}
    </>
  );
}

function AssistantMarkdown({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  return (
    <div className="grid gap-2">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={index} className="h-1" />;
        if (/^---+$/.test(trimmed)) return <div key={index} className="my-1 border-t border-line" />;
        if (trimmed.startsWith("### ")) {
          return (
            <h3 key={index} className="pt-2 text-sm font-semibold text-ink">
              <InlineText text={trimmed.replace(/^###\s+/, "")} />
            </h3>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={index} className="pt-2 text-base font-semibold text-ink">
              <InlineText text={trimmed.replace(/^##\s+/, "")} />
            </h3>
          );
        }
        const bullet = trimmed.match(/^(?:[-*]\s+|\*\s{2,})(.+)$/);
        if (bullet) {
          return (
            <div key={index} className="flex gap-2">
              <span className="mt-[0.65em] h-1.5 w-1.5 shrink-0 rounded-full bg-cobalt" />
              <p className="min-w-0">
                <InlineText text={bullet[1]} />
              </p>
            </div>
          );
        }
        const numbered = trimmed.match(/^(\d+)\.\s+(.+)$/);
        if (numbered) {
          return (
            <div key={index} className="flex gap-2">
              <span className="shrink-0 font-semibold text-cobalt">{numbered[1]}.</span>
              <p className="min-w-0">
                <InlineText text={numbered[2]} />
              </p>
            </div>
          );
        }
        return (
          <p key={index}>
            <InlineText text={trimmed} />
          </p>
        );
      })}
    </div>
  );
}

function GenerationTraceCard({ trace }: { trace: GenerationTrace }) {
  return (
    <div className="mb-3 rounded-md border border-line bg-panel/70 p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-bold text-ink">
          {trace.state === "done" ? (
            <CheckCircle2 className="h-4 w-4 text-teal" />
          ) : (
            <RefreshCw className="h-4 w-4 animate-spin text-cobalt" />
          )}
          <span>{trace.state === "thinking" ? "생각중" : trace.state === "answering" ? "답변 생성중" : "생성 완료"}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-muted">
          <span className="rounded-full border border-line bg-white px-2 py-0.5">{providerLabel(trace.provider)}</span>
          <span className="rounded-full border border-line bg-white px-2 py-0.5">{trace.model}</span>
          <span className="rounded-full border border-line bg-white px-2 py-0.5">사고 {reasoningLabel(trace.reasoningEffort)}</span>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-5">
        {trace.steps.map((step, index) => (
          <div
            key={step.label}
            className={
              "min-h-9 rounded border px-2 py-1.5 " +
              (step.status === "done"
                ? "border-teal/25 bg-white text-teal"
                : step.status === "active"
                  ? "border-cobalt/30 bg-white text-cobalt"
                  : "border-line bg-white/60 text-muted")
            }
          >
            <div className="text-[10px] font-bold">{String(index + 1).padStart(2, "0")}</div>
            <div className="mt-0.5 leading-4">{step.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {trace.dataSummary.map((item) => (
          <span key={item} className="rounded-full border border-line bg-white px-2 py-0.5 text-[11px] text-muted">
            {item}
          </span>
        ))}
      </div>

      {trace.evidenceTitles.length ? (
        <div className="mt-3 rounded border border-line bg-white p-2">
          <div className="mb-1 flex items-center gap-1.5 font-bold text-ink">
            <DatabaseZap className="h-3.5 w-3.5 text-cobalt" />
            LLM 입력 근거
          </div>
          <div className="grid gap-1">
            {trace.evidenceTitles.map((title) => (
              <div key={title} className="truncate text-[11px] leading-4 text-muted">
                {title}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function TradeAssistantForm({
  endpoint = "/api/trade-assistant",
  title = "Trade GPT",
  subtitle = "API evidence augmented answers",
  welcomeMessage = "무역, 수입, 인증, 통관, 공장 리스크 질문을 입력하세요. 입력한 질문은 로컬 DB와 연결된 API evidence로 보강한 뒤 LLM에 전달합니다.",
  examples = defaultExamples,
  placeholder = "예: 중국 공장에서 제습기를 수입할 때 인증, 에너지효율, 통관 리스크를 정리해줘",
  buildRequestBody = (nextPrompt: string, config: LlmRequestConfig) => ({
    prompt: nextPrompt,
    llmProvider: config.provider,
    model: config.model,
    reasoningEffort: config.reasoningEffort
  }),
  normalizeResult,
  onEvidenceRecords,
  onOpenEvidence,
  showMatchedFactories = true,
  showSidePanel = true,
  className
}: TradeAssistantFormProps = {}) {
  const [prompt, setPrompt] = useState("");
  const [llmProvider, setLlmProvider] = useState<LlmProvider>("deepseek");
  const [selectedModel, setSelectedModel] = useState(defaultModelForProvider("deepseek"));
  const [reasoningEffort, setReasoningEffort] = useState<LlmReasoningEffort>("medium");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: welcomeMessage,
      meta: title
    }
  ]);
  const [result, setResult] = useState<AssistantResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const sourceLabels = useMemo(() => result?.intent?.selectedSources ?? [], [result]);
  const modelOptions = useMemo(() => modelOptionsForProvider(llmProvider), [llmProvider]);
  const selectedModelOption = useMemo(
    () => modelOptions.find((option) => option.value === selectedModel) ?? modelOptions[0],
    [modelOptions, selectedModel]
  );

  useEffect(() => {
    setSelectedModel(defaultModelForProvider(llmProvider));
  }, [llmProvider]);

  async function revealAssistantMessage(id: string, text: string) {
    setMessages((current) =>
      current.map((message) =>
        message.id === id
          ? {
              ...message,
              isTyping: true,
              trace: message.trace ? { ...message.trace, state: "answering" } : message.trace
            }
          : message
      )
    );
    for (let index = 0; index < text.length; index += 1) {
      const next = text.slice(0, index + 1);
      setMessages((current) => current.map((message) => (message.id === id ? { ...message, content: next } : message)));
      await sleep(4);
    }
    setMessages((current) =>
      current.map((message) =>
        message.id === id
          ? {
              ...message,
              isTyping: false,
              trace: message.trace ? { ...message.trace, state: "done" } : message.trace
            }
          : message
      )
    );
  }

  async function submitPrompt(nextPrompt = prompt) {
    const trimmed = nextPrompt.trim();
    if (trimmed.length < 4 || isGenerating) return;

    const requestConfig: LlmRequestConfig = {
      provider: llmProvider,
      model: selectedModelOption?.value ?? selectedModel,
      reasoningEffort
    };
    setError(null);
    setPrompt("");
    const userMessage: ChatMessage = { id: makeId(), role: "user", content: trimmed };
    const assistantId = makeId();
    const pendingMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      meta: "Analyzing",
      trace: initialTrace(requestConfig)
    };
    setMessages((current) => [...current, userMessage, pendingMessage]);
    setIsGenerating(true);
    let activeStep = 0;
    const traceTimer = window.setInterval(() => {
      activeStep = Math.min(activeStep + 1, traceStepLabels.length - 1);
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId && message.trace?.state === "thinking"
            ? {
                ...message,
                trace: {
                  ...message.trace,
                  steps: traceSteps(activeStep),
                  dataSummary:
                    activeStep >= 2
                      ? ["질문 텍스트", "제품/HS 후보", "공장 DB", "인증·통관·리스크 근거"]
                      : message.trace.dataSummary
                }
              }
            : message
        )
      );
    }, 900);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildRequestBody(trimmed, requestConfig))
      });
      const rawBody = (await response.json()) as unknown;
      const errorBody = rawBody && typeof rawBody === "object" ? (rawBody as { error?: string }) : {};
      if (!response.ok) {
        setError(errorBody.error ?? "요청 실패");
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: errorBody.error ?? "요청 처리에 실패했습니다.",
                  meta: "Error"
                }
              : message
          )
        );
        return;
      }

      const body = normalizeResult ? normalizeResult(rawBody) : (rawBody as AssistantResult);
      const matchedFactories = body.matchedFactories ?? [];
      const evidenceRecords = body.evidenceRecords ?? [];
      onEvidenceRecords?.(evidenceRecords);
      setResult(body);
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: "",
                trace: completedTrace(body, requestConfig, "answering"),
                factories: matchedFactories.slice(0, 3),
                evidenceIds: evidenceRecords.map((item) => item.id),
                meta: `${providerLabel(body.provider ?? llmProvider)} · ${body.model ?? requestConfig.model} · 사고 ${reasoningLabel(
                  body.reasoningEffort ?? requestConfig.reasoningEffort
                )} · ${body.usedLLM ? "LLM" : "Fallback"}${
                  typeof body.confidence === "number" ? ` · confidence ${body.confidence}%` : ""
                }${body.needsVerification ? " · 확인 필요 포함" : ""} · factory matches ${matchedFactories.length}`
              }
            : message
        )
      );
      await revealAssistantMessage(assistantId, body.answer);
    } finally {
      window.clearInterval(traceTimer);
      setIsGenerating(false);
    }
  }

  return (
    <div
      className={
        className ??
        `grid min-h-[calc(100vh-9rem)] gap-5 ${showSidePanel ? "lg:grid-cols-[minmax(0,1fr)_360px]" : ""}`
      }
    >
      <section className="flex min-h-[640px] flex-col overflow-hidden rounded-md border border-line bg-white shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-cobalt text-white">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">{title}</h2>
              <p className="text-xs text-muted">{subtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="inline-flex overflow-hidden rounded-md border border-line bg-white text-xs font-bold" aria-label="LLM provider">
              {providerOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setLlmProvider(option.value)}
                  className={`h-8 px-3 ${
                    llmProvider === option.value ? "bg-cobalt text-white" : "text-muted hover:bg-panel"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label className="relative min-w-[210px]">
              <span className="sr-only">모델 선택</span>
              <select
                disabled={isGenerating}
                value={selectedModel}
                onChange={(event) => setSelectedModel(event.target.value)}
                className="h-8 w-full appearance-none rounded-md border border-line bg-white pl-3 pr-8 text-xs font-bold text-ink outline-none hover:bg-panel disabled:cursor-not-allowed disabled:opacity-60"
              >
                {modelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                    {option.badge ? ` · ${option.badge}` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-2 h-4 w-4 text-muted" />
            </label>
            <div className="inline-flex overflow-hidden rounded-md border border-line bg-white text-xs font-bold" aria-label="사고 정도">
              {reasoningOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setReasoningEffort(option.value)}
                  title={option.label}
                  className={`h-8 px-2.5 ${
                    reasoningEffort === option.value ? "bg-ink text-white" : "text-muted hover:bg-panel"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {option.compact}
                </button>
              ))}
            </div>
            {selectedModelOption?.badge ? (
              <span className="inline-flex h-8 items-center rounded-md border border-cobalt/20 bg-[#eef4fb] px-2 text-[11px] font-bold text-cobalt">
                {selectedModelOption.badge}
              </span>
            ) : null}
            {isGenerating ? (
              <div className="inline-flex items-center gap-2 text-xs text-muted">
                <RefreshCw className="h-4 w-4 animate-spin" />
                generating
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-auto bg-panel/60 px-4 py-5">
          {messages.map((message) => {
            const isUser = message.role === "user";
            const Icon = isUser ? User : Bot;
            return (
              <div key={message.id} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                {!isUser ? (
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-cobalt text-white">
                    <Icon className="h-4 w-4" />
                  </div>
                ) : null}
                <div className={`max-w-[82%] ${isUser ? "items-end" : "items-start"}`}>
                  <div
                    className={`rounded-md px-4 py-3 text-sm leading-6 ${
                      isUser ? "bg-cobalt text-white" : "border border-line bg-white text-ink"
                    }`}
                  >
                    {isUser ? (
                      <pre className="whitespace-pre-wrap break-words font-sans">{message.content}</pre>
                    ) : (
                      <>
                        {message.trace ? <GenerationTraceCard trace={message.trace} /> : null}
                        {message.content ? <AssistantMarkdown content={message.content} /> : null}
                        {message.isTyping ? <span className="mt-2 inline-block h-4 w-1.5 animate-pulse rounded bg-cobalt align-middle" /> : null}
                      </>
                    )}
                  </div>
                  {!isUser && showMatchedFactories && message.factories?.length ? (
                    <div className="mt-2 grid gap-2">
                      {message.factories.map((factory) => (
                        <Link
                          key={factory.id}
                          href={`/factories/${factory.id}`}
                          className="block rounded-md border border-line bg-white p-3 text-xs shadow-soft hover:border-cobalt"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-ink">{factory.name}</div>
                              <div className="mt-1 text-muted">{factory.category ?? "분류 확인"} · {factory.matchReason}</div>
                            </div>
                            <Building2 className="h-4 w-4 shrink-0 text-cobalt" />
                          </div>
                          <div className="mt-2 line-clamp-2 leading-5 text-muted">{factory.address ?? factoryLocation(factory)}</div>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                  {!isUser && message.evidenceIds?.length && onOpenEvidence ? (
                    <button
                      type="button"
                      onClick={() => onOpenEvidence(message.evidenceIds?.[0] ?? "")}
                      className="mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-md border border-line bg-white px-3 text-xs font-bold text-cobalt hover:bg-panel"
                    >
                      근거 보기 {message.evidenceIds.length}개
                    </button>
                  ) : null}
                  {message.meta ? <div className="mt-1 text-xs text-muted">{message.meta}</div> : null}
                </div>
                {isUser ? (
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ink text-white">
                    <Icon className="h-4 w-4" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="border-t border-line bg-white p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {examples.map((item) => (
              <button
                key={item}
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:bg-panel"
                onClick={() => setPrompt(item)}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {item.slice(0, 26)}...
              </button>
            ))}
          </div>
          <div className="flex gap-2 rounded-md border border-line p-2 focus-within:border-cobalt">
            <textarea
              className="max-h-40 min-h-12 flex-1 resize-none px-2 py-2 text-sm leading-6 outline-none"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submitPrompt();
                }
              }}
              placeholder={placeholder}
            />
            <button
              type="button"
              disabled={isGenerating || prompt.trim().length < 4}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-cobalt text-white disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Send"
              onClick={() => submitPrompt()}
            >
              {isGenerating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
        </div>
      </section>

      {showSidePanel ? (
        <aside className="grid content-start gap-4">
        <section className="rounded-md border border-line bg-white p-4 shadow-soft">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Brain className="h-4 w-4 text-cobalt" />
            모델 실행
          </div>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Provider</dt>
              <dd className="font-medium">{providerLabel(result?.provider ?? llmProvider)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Model</dt>
              <dd className="max-w-[170px] truncate text-right font-medium">{result?.model ?? selectedModel}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">사고 정도</dt>
              <dd className="font-medium">{reasoningLabel(result?.reasoningEffort ?? reasoningEffort)}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-md border border-line bg-white p-4 shadow-soft">
          <h2 className="text-sm font-semibold">분석 조건</h2>
          {result ? (
            <dl className="mt-3 grid gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">HS</dt>
                <dd>{result.intent?.hsCode ?? "추가 확인 필요"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Country</dt>
                <dd>{result.intent?.country ?? "추가 확인 필요"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Location</dt>
                <dd>{result.intent?.locationTerms?.join(", ") || "전체"}</dd>
              </div>
              <div>
                <dt className="text-muted">Sources</dt>
                <dd className="mt-2 flex flex-wrap gap-1">
                  {sourceLabels.map((source) => (
                    <span key={source} className="rounded-full border border-line bg-panel px-2 py-0.5 text-xs">
                      {source}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-2 text-sm leading-6 text-muted">질문을 보내면 제품 조건과 사용된 데이터 소스가 표시됩니다.</p>
          )}
        </section>

        <section className="rounded-md border border-line bg-white p-4 shadow-soft">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <MapPinned className="h-4 w-4 text-cobalt" />
            매칭 공장
          </div>
          <div className="grid max-h-[380px] gap-2 overflow-auto pr-1">
            {showMatchedFactories && result?.matchedFactories?.length ? (
              result.matchedFactories.map((factory) => (
                <Link key={factory.id} href={`/factories/${factory.id}`} className="rounded-md border border-line p-3 text-xs hover:border-cobalt">
                  <div className="font-semibold text-ink">{factory.name}</div>
                  <div className="mt-1 text-muted">{factory.category ?? "분류 확인"} · {factory.sourceCode ?? "DB"}</div>
                  <div className="mt-2 leading-5 text-muted">{factory.address ?? factoryLocation(factory)}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-muted">
                    <span>{factory.matchReason}</span>
                    <span>좌표 {factoryConfidence(factory)}</span>
                    <span>Risk {factory.riskLevel}</span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm leading-6 text-muted">제품명이나 분류가 공장 데이터와 맞으면 후보가 여기에 표시됩니다.</p>
            )}
          </div>
        </section>

        <section className="rounded-md border border-line bg-white p-4 shadow-soft">
          <h2 className="text-sm font-semibold">참고 데이터</h2>
          <div className="mt-3 grid max-h-[360px] gap-2 overflow-auto pr-1">
            {result?.evidences?.length ? (
              result.evidences.slice(0, 20).map((evidence, index) => (
                <div key={`${evidence.sourceCode}-${evidence.title}-${index}`} className="rounded-md border border-line p-3 text-xs">
                  <div className="font-medium">{evidence.title}</div>
                  <div className="mt-1 text-muted">
                    {evidence.evidenceType} · {evidence.sourceCode}
                  </div>
                  <p className="mt-1 leading-5">{evidence.summary}</p>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-muted">답변에 사용된 공식 API/DB 참고 항목이 표시됩니다.</p>
            )}
          </div>
        </section>
        </aside>
      ) : null}
    </div>
  );
}
