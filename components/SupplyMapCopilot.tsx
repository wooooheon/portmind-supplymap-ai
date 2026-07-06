"use client";

import { useMemo, useState } from "react";
import { EvidenceDrawer } from "@/components/EvidenceDrawer";
import { TradeAssistantForm } from "@/components/TradeAssistantForm";
import type { EvidenceRecord } from "@/lib/supplymap/types";

type SupplyMapChatPayload = {
  answer?: string;
  model?: string;
  usedLLM?: boolean;
  confidence?: number;
  needsVerification?: boolean;
  evidence?: EvidenceRecord[];
  warnings?: string[];
  intent?: {
    query?: string;
    category?: string;
    keywords?: string[];
    hsCode?: string;
    hsCodeCandidates?: string[];
    importCountry?: string;
  };
};

function normalizeSupplyMapChatResult(payload: unknown) {
  const body = (payload && typeof payload === "object" ? payload : {}) as SupplyMapChatPayload;
  const evidence = body.evidence ?? [];
  const selectedSources = Array.from(
    new Set(evidence.map((item) => `${item.sourceType}:${item.providerName}`).filter(Boolean))
  );

  return {
    answer: body.answer ?? "근거 부족: 답변을 생성할 수 없습니다.",
    model: body.model ?? "supplymap-fallback",
    usedLLM: Boolean(body.usedLLM),
    confidence: body.confidence,
    needsVerification: body.needsVerification ?? true,
    intent: {
      hsCode: body.intent?.hsCode ?? body.intent?.hsCodeCandidates?.[0],
      country: body.intent?.importCountry,
      productTerms: [body.intent?.category, ...(body.intent?.keywords ?? [])].filter((item): item is string => Boolean(item)),
      locationTerms: [],
      selectedSources
    },
    evidences: evidence.map((item) => ({
      title: item.title,
      sourceCode: "sourceCode" in item && typeof item.sourceCode === "string" ? item.sourceCode : item.datasetName,
      evidenceType: item.sourceType,
      summary: item.snippet,
      url: item.url ?? item.sourceUrl
    })),
    evidenceRecords: evidence,
    matchedFactories: [],
    warnings: body.warnings ?? []
  };
}

export function SupplyMapCopilot({
  productName,
  analysisId,
  hsCode,
  country = "CN",
  preferredRegion
}: {
  productName: string;
  analysisId: string;
  hsCode?: string;
  country?: string;
  preferredRegion?: string;
}) {
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | undefined>();
  const examples = useMemo(
    () => [
      `${productName}을 중국에서 수입할 때 가장 먼저 확인할 것은?`,
      `${productName}의 국내 공장 후보와 중국 후보를 비교해줘`,
      `${productName} 인증·통관상 주의할 점은?`,
      `${productName}은 중국 베타 후보와 국내 후보 중 어떤 리스크 차이가 있어?`
    ],
    [productName]
  );

  function openEvidence(id: string) {
    setSelectedEvidenceId(id);
    setDrawerOpen(true);
  }

  return (
    <section className="mt-5 border border-line bg-white p-4 shadow-soft sm:p-5" aria-labelledby="supplymap-copilot-title">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="supplymap-copilot-title" className="text-base font-bold text-ink">AI 무역 코파일럿</h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            현재 SupplyMap 분석 결과와 ChatEvidence 근거만 사용해 답변합니다. 근거가 부족하면 확인 필요로 표시합니다.
          </p>
        </div>
        <span className="w-fit rounded-full bg-[#eef4fb] px-2.5 py-1 text-[11px] font-bold text-cobalt">RAG · Evidence Drawer</span>
      </div>

      <TradeAssistantForm
        endpoint="/api/supplymap/chat"
        title="SupplyMap Copilot"
        subtitle="RAG grounded trade decisions"
        welcomeMessage="제품, HS코드, 국내 공장 후보, 중국/해외 베타 후보, 인증·리콜·통관·국가위험 근거를 기준으로 질문에 답합니다."
        examples={examples}
        placeholder="예: 인증·통관상 먼저 확인해야 할 항목을 근거와 함께 정리해줘"
        buildRequestBody={(question) => ({
          productName,
          hsCode,
          country,
          preferredRegion,
          question,
          currentAnalysisId: analysisId,
          judgeDemo: true,
          useDeepSeek: false
        })}
        normalizeResult={normalizeSupplyMapChatResult}
        onEvidenceRecords={setEvidence}
        onOpenEvidence={openEvidence}
        showMatchedFactories={false}
        className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]"
      />

      <EvidenceDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        evidence={evidence}
        selectedId={selectedEvidenceId}
        onSelect={setSelectedEvidenceId}
      />
    </section>
  );
}
