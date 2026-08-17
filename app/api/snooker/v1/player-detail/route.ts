import { NextRequest, NextResponse } from "next/server";
import { getSnookerPlayerDetailFast } from "@/lib/snooker/player-detail-fast";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug")?.trim();
  if (!slug) return NextResponse.json({ ok: false, error: "PLAYER_SLUG_REQUIRED" }, { status: 400 });

  const player = await getSnookerPlayerDetailFast(slug);
  if (!player) return NextResponse.json({ ok: false, error: "PLAYER_NOT_FOUND" }, { status: 404 });

  return NextResponse.json(
    { ok: true, player },
    {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=1800",
      },
    },
  );
}
