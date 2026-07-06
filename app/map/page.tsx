import { PageHeader } from "@/components/PageHeader";
import { FactoryMap, type FactoryMarker } from "@/components/FactoryMap";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const factories = await prisma.factory.findMany({
    include: {
      products: true,
      certificates: true
    },
    orderBy: { updatedAt: "desc" }
  });

  const markers: FactoryMarker[] = factories.map((factory) => ({
    id: factory.id,
    canonicalName: factory.canonicalName,
    country: factory.country,
    province: factory.province,
    city: factory.city,
    addressRaw: factory.addressRaw,
    latitude: factory.latitude,
    longitude: factory.longitude,
    riskLevel: factory.riskLevel,
    importReadinessScore: factory.importReadinessScore,
    geocodeConfidence: factory.geocodeConfidence,
    productCategories: Array.from(new Set(factory.products.map((product) => product.category).filter(Boolean) as string[])),
    certTypes: Array.from(new Set(factory.certificates.map((certificate) => certificate.certType)))
  }));

  return (
    <>
      <PageHeader
        title="공장 지도"
        description="기존 Factory DB를 Leaflet 지도에 표시하는 운영 도구입니다. SupplyMap AI에서는 이 데이터를 중국/해외 베타 공장 레이어로 사용합니다."
      />
      <FactoryMap factories={markers} />
    </>
  );
}
