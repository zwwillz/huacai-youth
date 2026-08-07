import { NextResponse } from "next/server";
import { getPublicPlayerDetail } from "@/db/player-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const player = await getPublicPlayerDetail(id);
  if (!player) return NextResponse.json({ error: "PLAYER_NOT_FOUND" }, { status: 404 });
  return NextResponse.json(player, {
    headers: { "Cache-Control": "no-store" },
  });
}
