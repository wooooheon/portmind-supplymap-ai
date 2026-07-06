import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function DataRunsPage() {
  const runs = await prisma.ingestionRun.findMany({ orderBy: { startedAt: "desc" }, take: 100 });

  return (
    <>
      <PageHeader title="Ingestion Runs" description="수집 실행 이력과 raw/normalized 파일 경로를 확인합니다." />
      <div className="overflow-hidden rounded-md border border-line bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-panel text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Records</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Files</th>
                <th className="px-4 py-3">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {runs.map((run) => (
                <tr key={run.id}>
                  <td className="px-4 py-3 font-medium">{run.sourceCode}</td>
                  <td className="px-4 py-3">
                    <StatusBadge value={run.status} />
                  </td>
                  <td className="px-4 py-3">{run.recordCount}</td>
                  <td className="px-4 py-3 text-muted">{run.startedAt.toLocaleString()}</td>
                  <td className="max-w-sm px-4 py-3 text-xs text-muted">
                    <div className="break-all">{run.rawFilePath}</div>
                    <div className="break-all">{run.normalizedFilePath}</div>
                  </td>
                  <td className="max-w-md px-4 py-3 text-xs text-danger">{run.errorMessage?.slice(0, 180)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
