import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const [overseasFactories, domesticSuppliers, dataSources] = await Promise.all([
      prisma.factory.count(),
      prisma.supplier.count().catch(() => 0),
      prisma.supplyDataSource.count().catch(() => 0)
    ]);
    return NextResponse.json({
      ok: true,
      service: "SupplyMap AI",
      mode: dataSources > 0 ? "seeded-demo" : "mock-fallback",
      overseasFactories,
      domesticSuppliers,
      dataSources,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "health check failed" },
      { status: 500 }
    );
  }
}
