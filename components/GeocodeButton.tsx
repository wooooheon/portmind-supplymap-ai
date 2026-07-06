"use client";

import { MapPinned, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";

export function GeocodeButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-panel disabled:opacity-60"
      onClick={() => {
        setMessage(null);
        startTransition(async () => {
          const response = await fetch("/api/geocode", { method: "POST" });
          const body = (await response.json()) as { updated?: number; error?: string };
          setMessage(response.ok ? `Updated ${body.updated ?? 0}` : body.error ?? "Failed");
        });
      }}
    >
      {isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <MapPinned className="h-4 w-4" />}
      Geocode
      {message ? <span className="text-xs text-muted">{message}</span> : null}
    </button>
  );
}
