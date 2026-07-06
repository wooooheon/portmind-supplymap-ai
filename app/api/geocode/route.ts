import { NextResponse } from "next/server";
import { geocodeFactories } from "@/lib/geocoding/geocode";

export async function POST() {
  try {
    const updated = await geocodeFactories();
    return NextResponse.json({ updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Geocode failed" }, { status: 500 });
  }
}
