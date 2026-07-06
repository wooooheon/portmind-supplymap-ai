"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  envKeyName: z.string().min(1),
  value: z.string().min(1)
});

type FormValues = z.infer<typeof schema>;

export function ApiKeySettingsForm({ envKeyNames }: { envKeyNames: string[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { envKeyName: envKeyNames[0], value: "" }
  });

  return (
    <form
      className="grid gap-3 rounded-md border border-line bg-white p-4 shadow-soft md:grid-cols-[1fr_1fr_auto]"
      onSubmit={handleSubmit(async (values) => {
        setMessage(null);
        const response = await fetch("/api/api-keys", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(values)
        });
        const body = (await response.json()) as { ok?: boolean; error?: string };
        if (!response.ok) {
          setMessage(body.error ?? "Failed to save");
          return;
        }
        reset({ envKeyName: values.envKeyName, value: "" });
        setMessage("Masked key reference saved. Put the real key in .env for server-side calls.");
      })}
    >
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Key</span>
        <select className="rounded-md border border-line px-3 py-2" {...register("envKeyName")}>
          {envKeyNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Value</span>
        <input
          className="rounded-md border border-line px-3 py-2"
          type="password"
          autoComplete="off"
          placeholder="Paste key to store masked reference"
          {...register("value")}
        />
        {errors.value ? <span className="text-xs text-danger">{errors.value.message}</span> : null}
      </label>
      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-md bg-cobalt px-4 text-sm font-medium text-white disabled:opacity-60"
      >
        <Save className="h-4 w-4" />
        Save
      </button>
      {message ? <p className="md:col-span-3 text-sm text-muted">{message}</p> : null}
    </form>
  );
}
