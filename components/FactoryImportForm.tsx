"use client";

import { Upload } from "lucide-react";
import { useState, useTransition } from "react";

export function FactoryImportForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="rounded-md border border-line bg-white p-4 shadow-soft"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        setMessage(null);
        startTransition(async () => {
          const response = await fetch("/api/factories/import", { method: "POST", body: formData });
          const body = (await response.json()) as { created?: number; updated?: number; totalRows?: number; error?: string };
          if (!response.ok) {
            setMessage(body.error ?? "Import failed");
            return;
          }
          setMessage(`Rows ${body.totalRows ?? 0} · created ${body.created ?? 0} · updated ${body.updated ?? 0}`);
        });
      }}
    >
      <label className="grid gap-2 text-sm">
        <span className="font-medium">Factory CSV</span>
        <input
          className="rounded-md border border-line px-3 py-2"
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="mt-3 inline-flex items-center gap-2 rounded-md bg-cobalt px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        <Upload className="h-4 w-4" />
        Import CSV
      </button>
      {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}
      <p className="mt-3 text-xs leading-5 text-muted">
        Columns: canonicalName, chineseName, englishName, country, province, city, addressRaw, productCategory,
        productName, website, sourceUrl.
      </p>
    </form>
  );
}
