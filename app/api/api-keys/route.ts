import { NextResponse } from "next/server";
import { z } from "zod";
import { saveApiKeyMask } from "@/lib/api-key-vault/vault";

const bodySchema = z.object({
  envKeyName: z.string().min(1),
  value: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    await saveApiKeyMask(body.envKeyName, body.value);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 });
  }
}
