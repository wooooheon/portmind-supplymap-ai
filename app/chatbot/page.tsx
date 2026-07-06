import { PageHeader } from "@/components/PageHeader";
import { TradeAssistantForm } from "@/components/TradeAssistantForm";

export const dynamic = "force-dynamic";

export default function ChatbotPage() {
  return (
    <>
      <PageHeader
        title="챗봇"
        description="GPT처럼 질문을 입력하면 무역/수입 API와 DB evidence로 프롬프트를 강화한 뒤 LLM 응답을 반환합니다."
      />
      <TradeAssistantForm />
    </>
  );
}
