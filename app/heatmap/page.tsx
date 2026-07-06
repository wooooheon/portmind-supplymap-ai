import { PageHeader } from "@/components/PageHeader";
import { HeatmapWorkbench } from "@/components/HeatmapWorkbench";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function HeatmapPage() {
  const factories = await prisma.factory.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null }
    },
    select: {
      id: true,
      canonicalName: true,
      country: true,
      province: true,
      city: true,
      addressRaw: true,
      addressNormalized: true,
      latitude: true,
      longitude: true,
      riskLevel: true,
      geocodeProvider: true,
      geocodeConfidence: true,
      sourceTagsJson: true,
      products: {
        select: {
          category: true,
          productName: true
        }
      }
    },
    orderBy: { updatedAt: "desc" },
    take: 2000
  });

  return (
    <>
      <PageHeader
        title="해외공장 히트맵"
        description="기존 Factory DB의 해외/중국/전세계 공장 좌표를 표시하는 보조 도구입니다. SupplyMap 분석은 /supplymap에서 국내 공장 지도와 중국 베타 지도를 분리해 비교합니다."
      />
      <HeatmapWorkbench factories={factories} />
    </>
  );
}
