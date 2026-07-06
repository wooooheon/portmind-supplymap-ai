import { NextResponse } from "next/server";
import { API_SOURCE_DEFINITIONS } from "@/lib/connectors/source-definitions";

export async function GET() {
  return NextResponse.json(API_SOURCE_DEFINITIONS);
}
