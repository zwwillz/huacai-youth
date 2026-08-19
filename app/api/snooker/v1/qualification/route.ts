import { NextResponse } from "next/server";
import { loadSnookerQualificationHub } from "@/lib/snooker/qualification-hub";

export const revalidate = 300;

export async function GET() {
  const hub = await loadSnookerQualificationHub();
  return NextResponse.json(
    { ok: hub.online, hub },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=1800",
      },
    },
  );
}
