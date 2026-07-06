import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { RunIngestionButton } from "@/components/RunIngestionButton";
import { StatusBadge } from "@/components/StatusBadge";
import { prisma } from "@/lib/db/prisma";
import { API_SOURCE_DEFINITIONS } from "@/lib/connectors/source-definitions";

export const dynamic = "force-dynamic";

export default async function DataSourcesPage() {
  const runs = await prisma.ingestionRun.findMany({ orderBy: { startedAt: "desc" }, take: 300 });
  const lastBySource = new Map<string, (typeof runs)[number]>();
  for (const run of runs) {
    if (!lastBySource.has(run.sourceCode)) lastBySource.set(run.sourceCode, run);
  }

  return (
    <>
      <PageHeader
        title="Data Sources"
        description="연결 가능한 API 소스 목록입니다. 실제 키가 없거나 호출에 실패하면 mock mode로 원본/정규화 파일과 DB 저장 흐름을 검증합니다."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {API_SOURCE_DEFINITIONS.map((source) => {
          const lastRun = lastBySource.get(source.code);
          return (
            <article key={source.code} className="rounded-md border border-line bg-white p-4 shadow-soft">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="break-words text-base font-semibold">{source.code}</h2>
                    <StatusBadge value={source.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted">{source.name}</p>
                  <div className="mt-3 grid gap-1 text-xs text-muted">
                    <span>{source.provider}</span>
                    <span>{source.category}</span>
                    <span>{source.requiresKey ? `Key: ${source.keyEnvName}` : "No server key required or LINK endpoint"}</span>
                  </div>
                </div>
                <RunIngestionButton sourceCode={source.code} />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-3 text-xs text-muted">
                <span>Last run: {lastRun ? lastRun.startedAt.toLocaleString() : "none"}</span>
                <span>Records: {lastRun?.recordCount ?? 0}</span>
                {source.docsUrl ? (
                  <a className="inline-flex items-center gap-1 text-cobalt hover:underline" href={source.docsUrl} target="_blank">
                    Docs <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
