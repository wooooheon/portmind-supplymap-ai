import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { runSupplyMapChat, type SupplyMapChatEvidenceRecord } from "@/lib/supplymap/rag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  productName: z.string().trim().min(2).max(200).optional(),
  hsCode: z.string().trim().max(20).optional(),
  country: z.string().trim().max(80).optional(),
  importCountry: z.string().trim().max(80).optional(),
  preferredRegion: z.string().trim().max(80).optional(),
  question: z.string().trim().min(4).max(4000),
  currentAnalysisId: z.string().trim().max(120).optional(),
  analysisContext: z.unknown().optional(),
  judgeDemo: z.boolean().optional(),
  useDeepSeek: z.boolean().optional(),
  llmProvider: z.enum(["deepseek", "openai"]).optional()
});

function stableId(sourceId: string, evidenceKey: string): string {
  return "chat-" + createHash("sha1").update(`${sourceId}:${evidenceKey}`).digest("hex").slice(0, 24);
}

async function persistChatEvidence(evidence: SupplyMapChatEvidenceRecord[]) {
  if (evidence.length === 0) return;
  const sources = await prisma.supplyDataSource.findMany({
    select: { id: true, code: true, providerName: true, datasetName: true, sourceType: true }
  });
  if (sources.length === 0) return;

  for (const item of evidence) {
    const source =
      sources.find((candidate) => candidate.code === item.sourceCode) ??
      sources.find((candidate) => candidate.providerName === item.providerName && candidate.datasetName === item.datasetName) ??
      sources.find((candidate) => candidate.sourceType === item.sourceType);
    if (!source) continue;
    await prisma.chatEvidence.upsert({
      where: {
        sourceId_evidenceKey: {
          sourceId: source.id,
          evidenceKey: item.evidenceKey
        }
      },
      update: {
        sessionId: item.sessionId,
        title: item.title,
        snippet: item.snippet,
        claim: item.claim,
        providerName: item.providerName,
        datasetName: item.datasetName,
        sourceType: item.sourceType,
        sourceUrl: item.url ?? item.sourceUrl,
        fetchedAt: new Date(item.fetchedAt),
        license: item.license,
        verification: item.verification
      },
      create: {
        id: stableId(source.id, item.evidenceKey),
        sourceId: source.id,
        sessionId: item.sessionId,
        evidenceKey: item.evidenceKey,
        title: item.title,
        snippet: item.snippet,
        claim: item.claim,
        providerName: item.providerName,
        datasetName: item.datasetName,
        sourceType: item.sourceType,
        sourceUrl: item.url ?? item.sourceUrl,
        fetchedAt: new Date(item.fetchedAt),
        license: item.license,
        verification: item.verification
      }
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const result = await runSupplyMapChat({
      ...body,
      country: body.country ?? body.importCountry,
      judgeDemo: body.judgeDemo ?? true,
      useDeepSeek: body.useDeepSeek ?? true,
      llmProvider: body.llmProvider
    });
    await persistChatEvidence(result.evidence).catch(() => undefined);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SupplyMap chat request failed" },
      { status: 400 }
    );
  }
}
