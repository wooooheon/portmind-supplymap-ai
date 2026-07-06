import { NextResponse } from "next/server";
import { z } from "zod";
import { exportEntity, listExportEntities } from "@/lib/exporters/export";

const bodySchema = z.object({
  entity: z.string(),
  format: z.enum(["csv", "jsonl", "json"])
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    if (!listExportEntities().includes(body.entity as never)) {
      return NextResponse.json({ error: `Unsupported entity ${body.entity}` }, { status: 400 });
    }
    const file = await exportEntity(body.entity as never, body.format);
    return NextResponse.json(file);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Export failed" }, { status: 400 });
  }
}
