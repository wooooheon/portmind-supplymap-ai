"use client";

import { useState, useTransition } from "react";
import { Play, RefreshCw } from "lucide-react";

export function RunIngestionButton({ sourceCode }: { sourceCode: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-md bg-cobalt px-3 py-2 text-sm font-medium text-white hover:bg-cobalt/90 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const response = await fetch("/api/ingest", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ sourceCode, params: { mock: true } })
            });
            const body = (await response.json()) as { status?: string; recordCount?: number; error?: string };
            if (!response.ok) {
              setMessage(body.error ?? "Failed");
              return;
            }
            setMessage(`${body.status} · ${body.recordCount ?? 0} records`);
          });
        }}
      >
        {isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        Run Ingestion
      </button>
      {message ? <span className="text-xs text-muted">{message}</span> : null}
    </div>
  );
}
