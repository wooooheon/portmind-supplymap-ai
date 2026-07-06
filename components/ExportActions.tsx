"use client";

import { Download, FileJson, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";

export function ExportActions({ entities }: { entities: string[] }) {
  const [entity, setEntity] = useState(entities[0] ?? "factories");
  const [format, setFormat] = useState("csv");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="rounded-md border border-line bg-white p-4 shadow-soft">
      <div className="grid gap-3 md:grid-cols-[1fr_160px_auto]">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Entity</span>
          <select className="rounded-md border border-line px-3 py-2" value={entity} onChange={(event) => setEntity(event.target.value)}>
            {entities.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Format</span>
          <select className="rounded-md border border-line px-3 py-2" value={format} onChange={(event) => setFormat(event.target.value)}>
            <option value="csv">CSV</option>
            <option value="jsonl">JSONL</option>
            <option value="json">JSON</option>
          </select>
        </label>
        <button
          type="button"
          disabled={isPending}
          className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-md bg-cobalt px-4 text-sm font-medium text-white disabled:opacity-60"
          onClick={() => {
            setMessage(null);
            startTransition(async () => {
              const response = await fetch("/api/exports", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ entity, format })
              });
              const body = (await response.json()) as { filePath?: string; error?: string };
              if (!response.ok) {
                setMessage(body.error ?? "Export failed");
                return;
              }
              setMessage(`Created ${body.filePath}`);
            });
          }}
        >
          {isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : format === "jsonl" ? <FileJson className="h-4 w-4" /> : <Download className="h-4 w-4" />}
          Export
        </button>
      </div>
      {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}
    </div>
  );
}
