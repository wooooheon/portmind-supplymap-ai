import { PageHeader } from "@/components/PageHeader";
import { FactoriesTable, type FactoryRow } from "@/components/FactoriesTable";
import { FactoryImportForm } from "@/components/FactoryImportForm";
import { GeocodeButton } from "@/components/GeocodeButton";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function FactoriesPage() {
  const factories = await prisma.factory.findMany({
    orderBy: [{ riskLevel: "desc" }, { updatedAt: "desc" }],
    include: {
      _count: {
        select: { products: true, certificates: true, riskEvents: true }
      }
    }
  });

  const rows: FactoryRow[] = factories.map((factory) => ({
    id: factory.id,
    canonicalName: factory.canonicalName,
    country: factory.country,
    province: factory.province,
    city: factory.city,
    addressRaw: factory.addressRaw,
    riskLevel: factory.riskLevel,
    importReadinessScore: factory.importReadinessScore,
    geocodeConfidence: factory.geocodeConfidence,
    productCount: factory._count.products,
    certificateCount: factory._count.certificates,
    riskEventCount: factory._count.riskEvents
  }));

  return (
    <>
      <PageHeader
        title="공장 DB"
        description="기존 해외/전세계 공장 데이터 운영 화면입니다. SupplyMap 분석에서는 이 DB를 중국/해외 베타 공장 레이어로 재사용하고 국내 Supplier 레이어와 분리해 비교합니다."
        actions={<GeocodeButton />}
      />
      <div className="mb-5">
        <FactoryImportForm />
      </div>
      <FactoriesTable rows={rows} />
    </>
  );
}
