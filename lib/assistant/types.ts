import type { NormalizedRecord } from "@/lib/connectors/types";

export type TradeAssistantIntent = {
  query: string;
  hsCode?: string;
  country?: string;
  productTerms: string[];
  locationTerms: string[];
  selectedSources: string[];
  warnings: string[];
};

export type AssistantEvidence = {
  title: string;
  sourceCode: string;
  evidenceType: "DATABASE" | "CONNECTOR" | "LLM_FALLBACK";
  summary: string;
  url?: string;
  raw?: unknown;
};

export type MatchedFactory = {
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

export type PromptAugmentationResult = {
  intent: TradeAssistantIntent;
  evidences: AssistantEvidence[];
  matchedFactories: MatchedFactory[];
  normalizedRecords: NormalizedRecord[];
  contextText: string;
};

export type TradeAssistantResponse = {
  answer: string;
  model: string;
  usedLLM: boolean;
  intent: TradeAssistantIntent;
  evidences: AssistantEvidence[];
  matchedFactories: MatchedFactory[];
  augmentedPrompt: string;
  warnings: string[];
};
