import Link from "next/link";
import { Download } from "lucide-react";
import { ExportActions } from "@/components/ExportActions";
import { FactoryImportForm } from "@/components/FactoryImportForm";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db/prisma";
import { listExportEntities } from "@/lib/exporters/export";

export const dynamic = "force-dynamic";

export default async function ExportsPage() {
  const files = await prisma.exportFile.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return (
    <>
      <PageHeader
        title="Exports"
        description="사람이 보기 쉬운 CSV와 RAG/LLM 분석용 JSONL 파일을 생성합니다. 생성 파일은 data/exports 아래에 저장됩니다."
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-5">
          <ExportActions entities={listExportEntities()} />
          <div className="overflow-hidden rounded-md border border-line bg-white shadow-soft">
            <div className="border-b border-line px-4 py-3 text-sm font-semibold">Generated Files</div>
            <div className="divide-y divide-line">
              {files.map((file) => (
                <div key={file.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_auto_auto] md:items-center">
                  <div>
                    <div className="font-medium">{file.filePath}</div>
                    <div className="text-xs text-muted">
                      {file.entityType} · {file.fileType} · {file.recordCount} records · {file.createdAt.toLocaleString()}
                    </div>
                  </div>
                  <Link
                    className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm hover:bg-panel"
                    href={`/api/exports/download?path=${encodeURIComponent(file.filePath)}`}
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Link>
                </div>
              ))}
              {files.length === 0 ? <p className="p-4 text-sm text-muted">No exports yet.</p> : null}
            </div>
          </div>
        </div>
        <FactoryImportForm />
      </div>
    </>
  );
}
