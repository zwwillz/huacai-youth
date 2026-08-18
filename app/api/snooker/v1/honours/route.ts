import { NextResponse } from "next/server";
import { loadSnookerHonoursHub } from "@/lib/snooker/honours-hub";

export const revalidate = 1800;

export async function GET() {
  const hub = await loadSnookerHonoursHub();
  return NextResponse.json(
    { ok: hub.online, hub },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=120, s-maxage=1800, stale-while-revalidate=21600",
      },
    },
  );
}
