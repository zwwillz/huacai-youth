import { NextResponse } from "next/server";
import { SNOOKER_BUILD_MARK, SNOOKER_FOUNDATION_VERSION } from "@/lib/snooker/foundation";
import { getSnookerRepository } from "@/lib/snooker/repository";

export async function GET() {
  const repository = getSnookerRepository();
  const [rankings, players] = await Promise.all([repository.getRankings(), repository.getPlayers()]);
  const playerById = new Map(players.map((player) => [player.id, player]));
  return NextResponse.json({
    ok: true,
    version: SNOOKER_FOUNDATION_VERSION,
    buildMark: SNOOKER_BUILD_MARK,
    rankings: rankings.map((row) => ({ ...row, player: playerById.get(row.playerId) ?? null })),
  });
}
