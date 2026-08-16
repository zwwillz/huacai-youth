import { NextRequest, NextResponse } from "next/server";
import { getPlayerEventStats, SNOOKER_BUILD_MARK, SNOOKER_FOUNDATION_VERSION } from "@/lib/snooker/foundation";
import { getSnookerRepository } from "@/lib/snooker/repository";

export async function GET(request: NextRequest) {
  const repository = getSnookerRepository();
  const snapshot = await repository.getDashboard();
  const slug = request.nextUrl.searchParams.get("slug")?.trim();

  if (slug) {
    const player = snapshot.players.find((item) => item.slug === slug);
    if (!player) return NextResponse.json({ ok: false, error: "PLAYER_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({
      ok: true,
      version: SNOOKER_FOUNDATION_VERSION,
      buildMark: SNOOKER_BUILD_MARK,
      repositoryMode: repository.mode,
      player,
      currentEventStats: getPlayerEventStats(player.id, snapshot.event),
    });
  }

  return NextResponse.json({
    ok: true,
    version: SNOOKER_FOUNDATION_VERSION,
    buildMark: SNOOKER_BUILD_MARK,
    repositoryMode: repository.mode,
    count: snapshot.players.length,
    players: snapshot.players.map((player) => ({
      ...player,
      currentEventStats: getPlayerEventStats(player.id, snapshot.event),
    })),
  });
}
