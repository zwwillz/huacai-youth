import { NextRequest, NextResponse } from "next/server";
import { eventSummary, getPlayerEventStats, SNOOKER_BUILD_MARK, SNOOKER_FOUNDATION_VERSION } from "@/lib/snooker/foundation";
import { getSnookerRepository } from "@/lib/snooker/repository";

export async function GET(request: NextRequest) {
  const repository = getSnookerRepository();
  const snapshot = await repository.getDashboard();
  const slug = request.nextUrl.searchParams.get("slug")?.trim() ?? snapshot.event.slug;
  const event = await repository.getEvent(slug);
  if (!event) return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const playerStats = snapshot.players
    .map((player) => getPlayerEventStats(player.id, event))
    .filter(Boolean);

  return NextResponse.json({
    ok: true,
    version: SNOOKER_FOUNDATION_VERSION,
    buildMark: SNOOKER_BUILD_MARK,
    repositoryMode: repository.mode,
    event,
    summary: eventSummary(event),
    playerStats,
  });
}
