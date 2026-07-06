import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { RiskBadge, StatusBadge } from "@/components/StatusBadge";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-line bg-white p-4 shadow-soft">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function FactoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const factory = await prisma.factory.findUnique({
    where: { id },
    include: {
      products: true,
      certificates: true,
      riskEvents: true
    }
  });
  if (!factory) notFound();

  const evidences = await prisma.evidence.findMany({
    where: { entityType: "FACTORY", entityId: factory.id },
    orderBy: { retrievedAt: "desc" }
  });
  const tradeRequirements = await prisma.tradeRequirement.findMany({
    where: {
      hsCode: {
        in: factory.products.map((product) => product.hsCodeCandidate).filter(Boolean) as string[]
      }
    },
    take: 20
  });

  return (
    <>
      <PageHeader
        title={factory.canonicalName}
        description="공식 공개 데이터와 사용자가 제공한 자료를 기준으로 확인된 정보입니다. 법률/통관/안전성 최종판단을 대체하지 않습니다."
        actions={
          <Link className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm" href="/factories">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Section title="기본정보">
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Risk</dt>
              <dd><RiskBadge value={factory.riskLevel} /></dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Import Readiness Score</dt>
              <dd className="font-semibold">{factory.importReadinessScore}/100</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Country</dt>
              <dd>{factory.country}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Location</dt>
              <dd>{[factory.province, factory.city].filter(Boolean).join(" · ") || "추가 확인 필요"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Address</dt>
              <dd className="text-right">{factory.addressRaw ?? "추가 확인 필요"}</dd>
            </div>
          </dl>
        </Section>

        <Section title="지도 위치">
          <div className="grid gap-2 text-sm">
            <div>Latitude: {factory.latitude ?? "추가 확인 필요"}</div>
            <div>Longitude: {factory.longitude ?? "추가 확인 필요"}</div>
            <div>Coord System: {factory.coordSystem}</div>
            <div>
              Confidence:{" "}
              {factory.geocodeConfidence === null ? "좌표 확인 필요" : `${Math.round(factory.geocodeConfidence * 100)}%`}
            </div>
            <div>Provider: {factory.geocodeProvider ?? "추가 확인 필요"}</div>
          </div>
        </Section>

        <Section title="연결된 제품">
          <div className="divide-y divide-line">
            {factory.products.map((product) => (
              <div key={product.id} className="py-2 text-sm">
                <div className="font-medium">{product.productName}</div>
                <div className="text-muted">{[product.category, product.hsCodeCandidate].filter(Boolean).join(" · ")}</div>
              </div>
            ))}
            {factory.products.length === 0 ? <p className="text-sm text-muted">추가 확인 필요</p> : null}
          </div>
        </Section>

        <Section title="연결된 인증서">
          <div className="divide-y divide-line">
            {factory.certificates.map((cert) => (
              <div key={cert.id} className="py-2 text-sm">
                <div className="flex items-center gap-2">
                  <StatusBadge value={cert.certType} />
                  <span className="font-medium">{cert.certNumber ?? cert.productName ?? "Certificate"}</span>
                </div>
                <div className="mt-1 text-muted">{[cert.modelName, cert.status, cert.sourceCode].filter(Boolean).join(" · ")}</div>
              </div>
            ))}
            {factory.certificates.length === 0 ? <p className="text-sm text-muted">추가 확인 필요</p> : null}
          </div>
        </Section>

        <Section title="연결된 리스크 이벤트">
          <div className="divide-y divide-line">
            {factory.riskEvents.map((event) => (
              <div key={event.id} className="py-2 text-sm">
                <div className="flex items-center gap-2">
                  <StatusBadge value={event.eventType} />
                  <span className="font-medium">{event.title}</span>
                </div>
                <p className="mt-1 text-muted">{event.description}</p>
              </div>
            ))}
            {factory.riskEvents.length === 0 ? <p className="text-sm text-muted">고위험 이력 없음으로 확인된 범위 내에서 표시됩니다.</p> : null}
          </div>
        </Section>

        <Section title="연결된 무역요건">
          <div className="divide-y divide-line">
            {tradeRequirements.map((requirement) => (
              <div key={requirement.id} className="py-2 text-sm">
                <div className="font-medium">{requirement.hsCode}</div>
                <div className="text-muted">
                  {[requirement.lawName, requirement.agencyName, requirement.requirementName].filter(Boolean).join(" · ")}
                </div>
              </div>
            ))}
            {tradeRequirements.length === 0 ? <p className="text-sm text-muted">추가 확인 필요</p> : null}
          </div>
        </Section>

        <Section title="공식 데이터 근거">
          <div className="divide-y divide-line">
            {evidences
              .filter((evidence) => evidence.evidenceType === "OFFICIAL_API" || evidence.evidenceType === "USER_UPLOAD")
              .map((evidence) => (
                <div key={evidence.id} className="py-2 text-sm">
                  <div className="font-medium">{evidence.title ?? evidence.sourceCode}</div>
                  <div className="text-muted">{evidence.sourceCode}</div>
                  {evidence.url ? (
                    <a className="mt-1 inline-flex items-center gap-1 text-cobalt hover:underline" href={evidence.url} target="_blank">
                      Evidence <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
              ))}
          </div>
        </Section>

        <Section title="검색엔진 근거">
          <div className="divide-y divide-line">
            {evidences
              .filter((evidence) => evidence.evidenceType === "SEARCH_RESULT" || evidence.evidenceType === "AI_INFERENCE")
              .map((evidence) => (
                <div key={evidence.id} className="py-2 text-sm">
                  <div className="font-medium">{evidence.title ?? evidence.sourceCode}</div>
                  <p className="text-muted">{evidence.rawSnippet}</p>
                </div>
              ))}
          </div>
        </Section>

        <Section title="데이터 품질/좌표 신뢰도">
          <p className="text-sm leading-6 text-muted">
            공식 데이터와 AI 추론/검색 결과는 분리해 표시합니다. “확인되지 않음”은 “문제없음”이 아니라 “추가 확인 필요”로 표시합니다.
          </p>
        </Section>
      </div>
    </>
  );
}
