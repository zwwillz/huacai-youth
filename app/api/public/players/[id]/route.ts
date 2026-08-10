import { unstable_cache } from "next/cache";
import { getFormalPublicPlayerDetail } from "@/db/player-data-formal";
import { publicJson } from "../../response";

export const dynamic = "force-static";
export const dynamicParams = true;
export const revalidate = 300;
export const runtime = "nodejs";

const getCachedPlayerDetail = unstable_cache(
  getFormalPublicPlayerDetail,
  ["public-player-detail-v4"],
  { revalidate: 300, tags: ["public-players"] },
);

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const startedAt = performance.now();
  try {
    const { id } = await context.params;
    const player = await getCachedPlayerDetail(id);
    if (!player) {
      return publicJson(request, { error: "PLAYER_NOT_FOUND" }, {
        status: 404,
        cache: false,
        durationMs: performance.now() - startedAt,
      });
    }
    return publicJson(request, player, { durationMs: performance.now() - startedAt });
  } catch (error) {
    return publicJson(request, {
      error: error instanceof Error ? error.message : "球员详情读取失败。",
    }, {
      status: 500,
      cache: false,
      durationMs: performance.now() - startedAt,
    });
  }
}
