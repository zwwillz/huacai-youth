import { getPublicPlayerDetail } from "@/db/player-data";
import { publicJson } from "../../response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const startedAt = performance.now();
  const { id } = await context.params;
  const player = await getPublicPlayerDetail(id);
  if (!player) return publicJson(request, { error: "PLAYER_NOT_FOUND" }, { status: 404, cache: false, durationMs: performance.now() - startedAt });
  return publicJson(request, player, { durationMs: performance.now() - startedAt });
}
