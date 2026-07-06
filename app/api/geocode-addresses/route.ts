import { NextResponse } from "next/server";
import { z } from "zod";
import { geocodeAddress } from "@/lib/geocoding/geocode";

const bodySchema = z.object({
  addresses: z.array(z.string().min(2).max(500)).min(1).max(200),
  country: z.string().optional().default("CN")
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const results = await Promise.all(
      body.addresses.map(async (address) => {
        const result = await geocodeAddress({ address, country: body.country });
        return {
          address,
          result
        };
      })
    );
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Geocode failed" }, { status: 400 });
  }
}
